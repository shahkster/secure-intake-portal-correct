'use server';
import { revalidatePath } from 'next/cache';
import { sql } from '@/lib/db';
import { requireBoss, requireOwner, requireUser, type User } from '@/lib/session';
import { encrypt, decrypt } from '@/lib/crypto';
import { notify } from '@/lib/notify';
import { normPhone, num, parseDate } from '@/lib/format';
import { normState, LEAD_STATUSES } from '@/lib/constants';
import { addInternalDnc, runFlags } from '@/lib/flags';
import { lookupRouting } from '@/lib/routing';
import { fillFromAddress } from '@/lib/address';

async function assertLead(u: User, id: string) {
  const [l] = await sql`select assigned_to, dnc, is_agent from leads where id = ${id}`;
  if (!l) throw new Error('Lead not found');
  if (u.role !== 'boss' && (l.assigned_to !== u.id || l.dnc || l.is_agent)) throw new Error('Not your lead');
}

export async function setLeadStatus(id: string, status: string) {
  const u = await requireUser();
  await assertLead(u, id);
  if (!LEAD_STATUSES.some((s) => s.v === status)) throw new Error('Unknown status');
  await sql`update leads set status = ${status},
    attempts = attempts + ${status === 'No Answer' ? 1 : 0},
    last_touch = now(), updated_at = now() where id = ${id}`;
  await sql`insert into activities (user_id, lead_id, kind, detail) values (${u.id}, ${id}, 'status', ${status})`;
  if (status === 'Do Not Call') await addInternalDnc(id);
  // No list reload here: the leads page updates the row itself, so you stay on the same lead.
}

export async function logDial(id: string) {
  const u = await requireUser();
  await assertLead(u, id);
  await sql`update leads set last_touch = now() where id = ${id}`;
  await sql`insert into activities (user_id, lead_id, kind) values (${u.id}, ${id}, 'dial')`;
}

const TEXT_FIELDS = ['first_name', 'last_name', 'middle', 'gender', 'smoker', 'alt_phones', 'email', 'address',
  'city', 'zip', 'height', 'weight', 'health', 'notes', 'account_type', 'policy_type', 'policy_carrier'] as const;

export async function saveLead(id: string, p: any): Promise<{ error?: string; hidden?: string }> {
  const u = await requireUser();
  await assertLead(u, id);
  const t = (v: any) => (v === undefined || v === null || String(v).trim() === '' ? null : String(v).trim());

  const row: Record<string, any> = {};
  for (const k of TEXT_FIELDS) row[k] = t(p[k]);
  row.phone = normPhone(p.phone);
  row.state = normState(p.state);
  Object.assign(row, fillFromAddress({ address: row.address, city: row.city, state: row.state, zip: row.zip }));
  row.dob = parseDate(p.dob);
  row.desired_coverage = num(p.desired_coverage);
  row.quoted_premium = num(p.quoted_premium);
  row.policy_coverage = num(p.policy_coverage);
  row.policy_premium = num(p.policy_premium);
  row.callback_at = p.callback_at ? new Date(p.callback_at) : null;
  row.callback_notified_at = null;
  row.beneficiaries = sql.json(Array.isArray(p.beneficiaries) ? p.beneficiaries.slice(0, 10) : []);
  if (LEAD_STATUSES.some((s) => s.v === p.status)) row.status = p.status;

  const routing = t(p.routing)?.replace(/\D/g, '') ?? null;
  if (routing && routing.length !== 9) return { error: 'Routing number must be 9 digits.' };
  row.routing = routing;
  if (routing) {
    const bank = await lookupRouting(routing);
    if (!bank.valid) return { error: bank.note || 'That routing number isn’t valid.' };
    row.bank_name = bank.bank ? [bank.bank, [bank.city, bank.state].filter(Boolean).join(', ')].filter(Boolean).join(' · ') : null;
  } else row.bank_name = null;

  const ssn = t(p.ssn)?.replace(/\D/g, '');
  if (ssn) {
    if (ssn.length !== 9) return { error: 'SSN must be 9 digits.' };
    row.ssn_enc = encrypt(ssn);
    row.ssn_last4 = ssn.slice(-4);
  }
  const acct = t(p.account)?.replace(/\D/g, '');
  if (acct) {
    if (acct.length < 4 || acct.length > 17) return { error: 'Account number should be 4–17 digits.' };
    row.account_enc = encrypt(acct);
    row.account_last4 = acct.slice(-4);
  }
  if (u.role === 'boss' && 'assigned_to' in p) row.assigned_to = p.assigned_to || null;
  // Card: only the first 6 and last 4 digits ever reach the server (the most card rules allow keeping).
  if ('card_bin' in p) {
    const bin = String(p.card_bin || '').replace(/\D/g, '').slice(0, 6);
    const last4 = String(p.card_last4 || '').replace(/\D/g, '').slice(-4);
    if (bin && bin.length !== 6) return { error: 'Card BIN should be the first 6 digits.' };
    row.card_bin = bin || null;
    row.card_last4 = last4 || null;
    row.card_brand = bin ? (p.card_brand ? String(p.card_brand).slice(0, 40) : null) : null;
    row.card_bank = bin ? (p.card_bank ? String(p.card_bank).slice(0, 80) : null) : null;
    row.card_type = bin ? (p.card_type ? String(p.card_type).slice(0, 20) : null) : null;
  }

  const [before] = await sql`select assigned_to from leads where id = ${id}`;
  await sql`update leads set ${sql(row)}, updated_at = now(), last_touch = now() where id = ${id}`;
  await sql`insert into activities (user_id, lead_id, kind, detail) values (${u.id}, ${id}, 'edit', null)`;
  if (row.status === 'Do Not Call') await addInternalDnc(id);
  const flags = await runFlags({ leadIds: [id] });
  if (row.status === 'Do Not Call') flags.dnc = Math.max(flags.dnc, 1);
  if (u.role === 'boss' && row.assigned_to && row.assigned_to !== before.assigned_to) {
    await notify([row.assigned_to], 'New lead assigned to you', `${row.first_name ?? ''} ${row.last_name ?? ''}`.trim(), `/leads/${id}`);
  }
  revalidatePath(`/leads/${id}`);
  revalidatePath('/leads');
  if (flags.dnc || flags.agents) {
    if (u.role !== 'boss') await notify(await bossIdsLocal(), 'A lead was flagged and hidden', `${row.first_name ?? ''} ${row.last_name ?? ''}`.trim(), `/leads/${id}`);
    return { hidden: flags.dnc ? 'This number is on the Do Not Call list.' : 'This lead looks like an insurance agent.' };
  }
  return {};
}

async function bossIdsLocal() {
  const r = await sql`select id from users where role = 'boss' and active`;
  return r.map((x: any) => x.id);
}

export async function checkRouting(rn: string) {
  await requireUser();
  return lookupRouting(rn);
}

export async function revealSensitive(id: string) {
  const u = await requireUser();
  await assertLead(u, id);
  const [l] = await sql`select ssn_enc, account_enc from leads where id = ${id}`;
  await sql`insert into audit_log (user_id, action, target) values (${u.id}, 'reveal_sensitive', ${id})`;
  return {
    ssn: l.ssn_enc ? decrypt(l.ssn_enc) : '',
    account: l.account_enc ? decrypt(l.account_enc) : '',
  };
}

/** Give leads to one person, or split them evenly between several (dealt out one at a time). Empty list = unassign. */
export async function assignLeads(ids: string[], agentIds: string[] | string | null) {
  const u = await requireBoss();
  ids = (ids || []).filter((x) => /^[0-9a-f-]{36}$/i.test(x)).slice(0, 5000);
  // Other bosses can't take leads away from the owner.
  if (ids.length && !u.is_owner) ids = (await sql`select l.id from leads l left join users o on o.id = l.assigned_to
    where l.id in ${sql(ids)} and coalesce(o.is_owner, false) = false`).map((r: any) => r.id);
  if (!ids.length) return;
  const wanted = (Array.isArray(agentIds) ? agentIds : agentIds ? [agentIds] : []).filter((w) => /^[0-9a-f-]{36}$/i.test(w));
  const valid = wanted.length ? (await sql`select id from users where id in ${sql(wanted)} and active`).map((r: any) => r.id) : [];
  const people = wanted.filter((w) => valid.includes(w));
  if (!people.length) {
    await sql`update leads set assigned_to = null, updated_at = now() where id in ${sql(ids)}`;
  } else {
    const pairs = ids.map((id, i) => ({ id, to: people[i % people.length] }));
    await sql`update leads l set assigned_to = x.who, updated_at = now()
      from unnest(${sql.array(pairs.map((p) => p.id))}::uuid[], ${sql.array(pairs.map((p) => p.to))}::uuid[]) as x(id, who)
      where l.id = x.id`;
    for (const p of people) {
      const n = pairs.filter((x) => x.to === p).length;
      if (p !== u.id) await notify([p], `${n} lead${n > 1 ? 's' : ''} assigned to you`, '', '/leads');
    }
  }
  await sql`insert into audit_log (user_id, action, target) values (${u.id}, 'assign_leads', ${`${ids.length} → ${people.length ? people.length + ' people' : 'unassigned'}`})`;
  revalidatePath('/leads');
}

export async function deleteLeads(ids: string[]) {
  const u = await requireOwner();
  if (!ids.length) return;
  await sql`delete from leads where id in ${sql(ids)}`;
  await sql`insert into audit_log (user_id, action, target) values (${u.id}, 'delete_leads', ${String(ids.length)})`;
  revalidatePath('/leads');
}

export async function createLead(p: any): Promise<{ id?: string; error?: string }> {
  const u = await requireUser();
  if (!p.first_name && !p.last_name) return { error: 'Add a name.' };
  const [l] = await sql`insert into leads (first_name, last_name, phone, state, assigned_to)
    values (${p.first_name || null}, ${p.last_name || null}, ${normPhone(p.phone)}, ${normState(p.state)},
    ${u.role === 'boss' ? p.assigned_to || null : u.id}) returning id`;
  await runFlags({ leadIds: [l.id] });
  revalidatePath('/leads');
  return { id: l.id };
}

type ImportPayload = {
  batchName: string;
  rows: Record<string, string>[];
  mode: 'single' | 'round' | 'none';
  agentIds: string[];
  skipDupes: boolean;
};

export async function importLeads(p: ImportPayload): Promise<{ inserted?: number; skipped?: number; dnc?: number; agents?: number; totalHidden?: number; error?: string }> {
  const u = await requireBoss();
  if (!Array.isArray(p.rows) || !p.rows.length) return { error: 'The file has no rows.' };
  if (p.rows.length > 20000) return { error: 'Split files over 20,000 rows into smaller uploads.' };
  if (p.mode !== 'none' && !p.agentIds?.length) return { error: 'Pick at least one agent, or choose “Leave unassigned”.' };

  const valid = await sql`select id from users where id in ${sql(p.agentIds.length ? p.agentIds : ['00000000-0000-0000-0000-000000000000'])} and active`;
  const agents = valid.map((r: any) => r.id);

  const cleaned = p.rows.map((r) => {
    let first = r.first_name?.trim() || null;
    let last = r.last_name?.trim() || null;
    if (!first && !last && r.full_name) {
      const parts = r.full_name.trim().split(/\s+/);
      first = parts.shift() || null;
      last = parts.pop() || null;
      if (parts.length && !r.middle) r.middle = parts.join(' ');
    }
    return fillFromAddress({
      first_name: first, last_name: last, middle: r.middle?.trim() || null,
      phone: normPhone(r.phone), alt_phones: r.alt_phones?.trim() || null, email: r.email?.trim() || null,
      dob: parseDate(r.dob), gender: r.gender?.trim() || null, address: r.address?.trim() || null,
      city: r.city?.trim() || null, state: normState(r.state), zip: r.zip?.trim() || null,
      desired_coverage: num(r.desired_coverage), quoted_premium: num(r.quoted_premium), notes: r.notes?.trim() || null,
    });
  }).filter((r) => r.first_name || r.last_name || r.phone);

  let rows = cleaned;
  let skipped = p.rows.length - cleaned.length;
  if (p.skipDupes) {
    const phones = Array.from(new Set(rows.map((r) => r.phone).filter(Boolean))) as string[];
    const existing = new Set<string>();
    for (let i = 0; i < phones.length; i += 1000) {
      const found = await sql`select phone from leads where phone in ${sql(phones.slice(i, i + 1000))}`;
      found.forEach((f: any) => existing.add(f.phone));
    }
    const seen = new Set<string>();
    rows = rows.filter((r) => {
      if (!r.phone) return true;
      if (existing.has(r.phone) || seen.has(r.phone)) return false;
      seen.add(r.phone);
      return true;
    });
    skipped += cleaned.length - rows.length;
  }
  if (!rows.length) return { inserted: 0, skipped };

  const [batch] = await sql`insert into import_batches (name, row_count, created_by)
    values (${p.batchName?.trim() || `Import ${new Date().toLocaleDateString('en-US')}`}, ${rows.length}, ${u.id}) returning id`;

  const full = rows.map((r, i) => {
    const assigned_to = p.mode === 'none' ? null : p.mode === 'single' ? agents[0] : agents[i % agents.length];
    return { ...r, assigned_to, batch_id: batch.id };
  });
  for (let i = 0; i < full.length; i += 500) {
    await sql`insert into leads ${sql(full.slice(i, i + 500))}`;
  }
  // Check the whole CRM, not just this file, so every lead is screened against the latest lists.
  await runFlags();
  const [flags] = await sql`select count(*) filter (where dnc)::int as dnc, count(*) filter (where is_agent)::int as agents,
    (select count(*)::int from leads where dnc or is_agent) as total from leads where batch_id = ${batch.id}`;
  const clean = await sql`select assigned_to, count(*)::int as n from leads
    where batch_id = ${batch.id} and assigned_to is not null and not dnc and not is_agent group by assigned_to`;
  for (const c of clean as any[]) {
    await notify([c.assigned_to], `${c.n} new lead${c.n > 1 ? 's' : ''} assigned to you`, p.batchName || 'CSV import', '/leads');
  }
  revalidatePath('/leads');
  return { inserted: full.length, skipped, dnc: flags.dnc, agents: flags.agents, totalHidden: flags.total };
}

export async function setCallback(id: string, iso: string) {
  const u = await requireUser();
  await assertLead(u, id);
  const at = new Date(iso);
  if (Number.isNaN(at.getTime())) throw new Error('Bad time');
  await sql`update leads set status = 'Callback', callback_at = ${at}, callback_notified_at = null,
    last_touch = now(), updated_at = now() where id = ${id}`;
  await sql`insert into activities (user_id, lead_id, kind, detail) values (${u.id}, ${id}, 'status', 'Callback')`;
}
