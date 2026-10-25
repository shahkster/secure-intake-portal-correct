'use server';
import { revalidatePath } from 'next/cache';
import { sql } from '@/lib/db';
import { requireBoss, requireUser } from '@/lib/session';
import { REGISTRY_REASON, applyDncResults, runFlags } from '@/lib/flags';
import { notify } from '@/lib/notify';
import { splitAddress } from '@/lib/address';

/** One chunk of numbers from a registry file (add) or a change-list deletion file (remove). */
export async function dncChunk(numbers: string[], mode: 'add' | 'remove') {
  await requireBoss();
  const clean = numbers.filter((n) => /^\d{10}$/.test(n)).slice(0, 60000);
  if (!clean.length) return 0;
  if (mode === 'add') {
    const r = await sql`insert into dnc_numbers (phone, source)
      select x::bigint, 'registry' from unnest(${sql.array(clean)}::text[]) as x
      on conflict (phone) do nothing returning 1`;
    return r.length;
  }
  const r = await sql`delete from dnc_numbers where source = 'registry'
    and phone in (select x::bigint from unnest(${sql.array(clean)}::text[]) as x) returning 1`;
  return r.length;
}

export async function dncFinish(name: string, mode: 'add' | 'remove', count: number) {
  const u = await requireBoss();
  await sql`insert into dnc_uploads (name, mode, count, created_by) values (${name}, ${mode}, ${count}, ${u.id})`;
  if (mode === 'remove') {
    await sql`update leads l set dnc = false, dnc_reason = null where l.dnc and l.dnc_reason = ${REGISTRY_REASON}
      and not exists (select 1 from dnc_numbers d where d.phone = l.phone_num)`;
  }
  const flags = await runFlags();
  revalidatePath('/compliance');
  revalidatePath('/leads');
  return flags;
}

export async function recheckAll() {
  await requireBoss();
  const r = await runFlags();
  revalidatePath('/compliance');
  revalidatePath('/leads');
  return r;
}

/**
 * Paste or upload: one agent per line. Phones, emails, home addresses and full names are detected automatically,
 * and a line can hold several of them (e.g. "John Carter, 555-201-3344, 12 Main St, Springfield, IL 62701").
 */
export async function addWatchlist(text: string, note: string) {
  await requireBoss();
  const items: { kind: string; a: string; b: string }[] = [];
  const add = (kind: string, a: string, b = '') => items.push({ kind, a, b });
  for (const raw of String(text || '').slice(0, 2_000_000).split(/[\n\r]+/)) {
    let line = raw.replace(/"/g, ' ').trim();
    if (!line) continue;
    for (const m of line.match(/[\w.+-]+@[\w-]+\.[\w.-]+/g) || []) add('email', m.toLowerCase());
    line = line.replace(/[\w.+-]+@[\w-]+\.[\w.-]+/g, ' ');
    for (const m of line.match(/(\+?1[\s.-]?)?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}/g) || []) {
      const d = m.replace(/\D/g, '').slice(-10);
      if (d.length === 10) add('phone', String(Number(d)));
    }
    line = line.replace(/(\+?1[\s.-]?)?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}/g, ' ');
    const cells = line.split(/[\t;]|,(?![^,]*\d{5})/).map((c) => c.trim()).filter(Boolean);
    // Address: the part with a house number and a ZIP. Name: the remaining words.
    const joined = cells.join(', ');
    const addrStart = joined.search(/\b\d+\s+[A-Za-z]/);
    if (addrStart >= 0) {
      const p = splitAddress(joined.slice(addrStart));
      if (p?.address && p.zip) add('address', p.address, p.zip);
    }
    const nameText = (addrStart >= 0 ? joined.slice(0, addrStart) : joined).replace(/[,\d]/g, ' ').replace(/\s+/g, ' ').trim();
    const words = nameText.split(' ').filter((w) => /^[A-Za-z'.-]+$/.test(w));
    if (words.length >= 2) add('name', words[0], words[words.length - 1]);
  }
  if (!items.length) return { added: 0, flagged: 0 };
  let added = 0;
  for (let i = 0; i < items.length; i += 1000) {
    const chunk = items.slice(i, i + 1000);
    const r = await sql`insert into agent_watchlist (kind, value, note)
      select x.kind, case x.kind when 'name' then norm_name(x.a, x.b) when 'address' then norm_addr(x.a, x.b) else x.a end, ${note || null}
      from unnest(${sql.array(chunk.map((c) => c.kind))}::text[], ${sql.array(chunk.map((c) => c.a))}::text[], ${sql.array(chunk.map((c) => c.b))}::text[]) as x(kind, a, b)
      where case x.kind when 'name' then norm_name(x.a, x.b) when 'address' then norm_addr(x.a, x.b) else x.a end is not null
      on conflict do nothing returning 1`;
    added += r.length;
  }
  const flags = await runFlags();
  revalidatePath('/compliance');
  revalidatePath('/leads');
  return { added, flagged: flags.agents };
}

export async function removeWatchlist(id: string) {
  await requireBoss();
  await sql`delete from agent_watchlist where id = ${id}`;
  revalidatePath('/compliance');
}

/** Agent (or boss) marks a lead as a licensed agent during a call. Hides it and remembers the number. */
export async function markAsAgent(leadId: string) {
  const u = await requireUser();
  const [l] = await sql`select assigned_to, phone_num, alt_phones, email, first_name, last_name, state, name_key, addr_key from leads where id = ${leadId}`;
  if (!l || (u.role !== 'boss' && l.assigned_to !== u.id)) throw new Error('Not your lead');
  await sql`update leads set is_agent = true, agent_cleared = false, agent_checked_at = now(), agent_reason = ${'Marked as an agent by ' + u.name} where id = ${leadId}`;
  // Remember everything about them so the same person is caught in any future import.
  const note = `Marked by ${u.name}`;
  const alt = String(l.alt_phones || '').split(/[,;/|]/).map((x) => x.replace(/\D/g, '').slice(-10)).filter((x) => x.length === 10);
  const watch = [
    ...[l.phone_num ? String(l.phone_num) : null, ...alt.map((x) => String(Number(x)))].filter(Boolean).map((v) => ({ kind: 'phone', value: v, state: null, note })),
    l.email ? { kind: 'email', value: String(l.email).trim().toLowerCase(), state: null, note } : null,
    l.name_key ? { kind: 'name', value: l.name_key, state: l.state || null, note } : null,
    l.addr_key ? { kind: 'address', value: l.addr_key, state: null, note } : null,
  ].filter(Boolean);
  if (watch.length) await sql`insert into agent_watchlist ${sql(watch as any[])} on conflict do nothing`;
  await runFlags(); // catch their other copies already in the CRM
  if (u.role !== 'boss') {
    const bosses = await sql`select id from users where role = 'boss' and active`;
    await notify(bosses.map((b: any) => b.id), 'Lead marked as an insurance agent', `${l.first_name ?? ''} ${l.last_name ?? ''} · by ${u.name}`, `/leads/${leadId}`);
  }
  revalidatePath('/leads');
}

/** Boss only: put a flagged lead back in the agents' list. */
export async function clearFlag(leadId: string, kind: 'dnc' | 'agent') {
  const u = await requireBoss();
  if (kind === 'dnc' && !u.is_owner) throw new Error('Only the owner can clear a Do Not Call flag');
  if (kind === 'dnc') await sql`update leads set dnc = false, dnc_cleared = true, dnc_reason = null where id = ${leadId}`;
  else await sql`update leads set is_agent = false, agent_cleared = true, agent_reason = null where id = ${leadId}`;
  await sql`insert into audit_log (user_id, action, target) values (${u.id}, ${'clear_' + kind}, ${leadId})`;
  revalidatePath(`/leads/${leadId}`);
  revalidatePath('/leads');
}

/** Results file from FreeDNCList, already reduced to phone + on-list in the browser. */
export async function dncResults(rows: { phone: string; onList: boolean }[]) {
  await requireBoss();
  const clean = (rows || []).slice(0, 60000).map((r) => {
    let d = String(r.phone || '').replace(/\D/g, '');
    if (d.length === 11 && d.startsWith('1')) d = d.slice(1);
    return { phone: d, onList: !!r.onList };
  }).filter((r) => /^\d{10}$/.test(r.phone));
  const r = await applyDncResults(clean);
  revalidatePath('/compliance');
  revalidatePath('/leads');
  return r;
}

export async function dncResultsDone(name: string, total: number, flagged: number) {
  const u = await requireBoss();
  await sql`insert into dnc_uploads (name, mode, count, created_by) values (${'FreeDNCList: ' + String(name).slice(0, 120)}, 'check', ${total}, ${u.id})`;
  if (flagged) {
    const bosses = await sql`select id from users where role = 'boss' and active`;
    await notify(bosses.map((b: any) => b.id), `${flagged} lead${flagged === 1 ? '' : 's'} hidden after a DNC check`, 'Review them under Leads → Flagged.', '/leads?view=flagged');
  }
  revalidatePath('/compliance');
}

/** Paid FreeDNCList API (Business VIP). Checks up to 10 numbers per call (stays under Vercel's time limit); the page keeps calling until done. */
export async function dncApiBatch(): Promise<{ checked: number; flagged: number; remaining: number; error?: string }> {
  await requireBoss();
  const key = process.env.FREEDNC_API_KEY;
  if (!key) return { checked: 0, flagged: 0, remaining: 0, error: 'Add FREEDNC_API_KEY to use automatic checks.' };
  const due = await sql`select distinct phone_num from leads where phone_num is not null and not dnc
    and (dnc_checked_at is null or dnc_checked_at < now() - interval '31 days') limit 10`;
  const results: { phone: string; onList: boolean }[] = [];
  let error: string | undefined;
  for (const r of due as any[]) {
    const phone = String(r.phone_num);
    try {
      const res = await fetch('https://www.freednclist.com/api_number.php', {
        method: 'POST',
        headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone_number: phone }),
        cache: 'no-store',
        signal: AbortSignal.timeout(5000),
      });
      if (res.status === 401 || res.status === 403) { error = 'FreeDNCList rejected the API key.'; break; }
      if (res.status === 429) { error = 'FreeDNCList says slow down. Try again in a few minutes.'; break; }
      const j = await res.json().catch(() => null);
      // A failed or unclear answer is NOT treated as "clean" — the number stays unchecked.
      if (!res.ok || !j || j.success !== true || typeof j.on_dnc_list === 'undefined') continue;
      const v = j.on_dnc_list;
      results.push({ phone, onList: v === true || v === 1 || /^(true|yes|1)$/i.test(String(v)) });
    } catch { /* timeout: leave unchecked */ }
  }
  const r = results.length ? await applyDncResults(results) : { flagged: 0 };
  const [{ n }] = await sql`select count(distinct phone_num)::int as n from leads where phone_num is not null and not dnc
    and (dnc_checked_at is null or dnc_checked_at < now() - interval '31 days')`;
  if (results.length) { revalidatePath('/compliance'); revalidatePath('/leads'); }
  if (!error && due.length && !results.length) error = 'FreeDNCList didn’t give clear answers. Nothing was marked; try again later.';
  return { checked: results.length, flagged: r.flagged, remaining: n, error };
}

/** NAIC check: the lead isn't a licensed agent. */
export async function markAgentChecked(leadId: string) {
  const u = await requireUser();
  const [l] = await sql`select assigned_to from leads where id = ${leadId}`;
  if (!l || (u.role !== 'boss' && l.assigned_to !== u.id)) throw new Error('Not your lead');
  await sql`update leads set agent_checked_at = now() where id = ${leadId}`;
}

export async function agentQueue(state: string) {
  await requireBoss();
  const st = /^[A-Z]{2}$/.test(state) ? state : null;
  return sql`select id, first_name, middle, last_name, state, city from leads
    where agent_checked_at is null and not is_agent and not dnc and last_name is not null
    ${st ? sql`and state = ${st}` : sql`and true`}
    order by created_at desc limit 25`;
}
