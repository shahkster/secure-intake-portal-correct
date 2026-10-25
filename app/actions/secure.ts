'use server';
import crypto from 'crypto';
import { cookies, headers } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { sql } from '@/lib/db';
import { requireUser } from '@/lib/session';
import { encrypt } from '@/lib/crypto';
import { signClient, verifyClient } from '@/lib/jwt';
import { lookupRouting } from '@/lib/routing';
import { notify } from '@/lib/notify';
import { clientIp, recordFail, tooMany } from '@/lib/throttle';
import { ensureSchema } from '@/lib/ensure';

const hash = (t: string) => crypto.createHash('sha256').update(t).digest('hex');

async function origin() {
  if (process.env.APP_URL) return process.env.APP_URL.replace(/\/$/, '');
  const h = await headers();
  const host = h.get('x-forwarded-host') || h.get('host');
  const proto = h.get('x-forwarded-proto') || 'https';
  return `${proto}://${host}`;
}

// ---------- agent side ----------

export async function createSecureLink(leadId: string, o: { ssn: boolean; bank: boolean; greet?: string }) {
  const u = await requireUser();
  const [l] = await sql`select assigned_to, first_name, dob, dnc, is_agent from leads where id = ${leadId}`;
  if (!l || (u.role !== 'boss' && (l.assigned_to !== u.id || l.dnc || l.is_agent))) return { error: 'Not your lead.' };
  if (!o.ssn && !o.bank) return { error: 'Tick SSN, bank details, or both.' };
  // 16 random bytes = a short link that still can't be guessed.
  const token = crypto.randomBytes(16).toString('base64url');
  await sql`update secure_links set cancelled = true where lead_id = ${leadId} and used_at is null`;
  await sql`insert into secure_links (token_hash, lead_id, created_by, greet_name, wants_ssn, wants_bank, expires_at)
    values (${hash(token)}, ${leadId}, ${u.id}, ${o.greet?.trim() || l.first_name || null}, ${o.ssn}, ${o.bank}, now() + interval '48 hours')`;
  revalidatePath(`/leads/${leadId}`);
  return { url: `${await origin()}/secure/${token}` };
}

export async function cancelSecureLink(linkId: string) {
  const u = await requireUser();
  const [s] = await sql`select l.assigned_to, s.lead_id from secure_links s join leads l on l.id = s.lead_id where s.id = ${linkId}`;
  if (!s || (u.role !== 'boss' && s.assigned_to !== u.id)) return;
  await sql`update secure_links set cancelled = true where id = ${linkId}`;
  revalidatePath(`/leads/${s.lead_id}`);
}

// ---------- client side (no login) ----------

async function liveLink(token: string) {
  const [s] = await sql`select s.*, l.dob::text as dob from secure_links s join leads l on l.id = s.lead_id
    where s.token_hash = ${hash(token)}`;
  if (!s || s.cancelled || s.used_at || new Date(s.expires_at) < new Date()) return null;
  return s;
}

/** Opening the link: checks it's live and starts a 20-minute session for this browser. */
export async function clientOpen(token: string): Promise<{ ok?: boolean; error?: string }> {
  await ensureSchema();
  const ip = await clientIp();
  if (await tooMany(`client:${ip}`, 30, 60)) return { error: 'Too many tries from this connection. Wait an hour, or ask your agent for help.' };
  const s = await liveLink(String(token || '').slice(0, 64));
  if (!s) { await recordFail(`client:${ip}`); return { error: 'This link has expired or was already used. Ask your agent for a new one.' }; }
  await sql`update secure_links set verified_at = coalesce(verified_at, now()), opened_at = coalesce(opened_at, now()) where id = ${s.id}`;
  (await cookies()).set(`cl_${s.id}`, await signClient(s.id), {
    httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'strict', path: '/', maxAge: 20 * 60,
  });
  return { ok: true };
}

async function verifiedLink(token: string) {
  const s = await liveLink(token);
  if (!s) return null;
  const ok = await verifyClient((await cookies()).get(`cl_${s.id}`)?.value);
  return ok === s.id ? s : null;
}

export async function clientRouting(token: string, rn: string) {
  if (!(await verifiedLink(token))) return { valid: false, note: 'Your session ended. Reload the page.' };
  return lookupRouting(rn);
}

export async function clientSubmit(token: string, p: { ssn?: string; routing?: string; account?: string; account_type?: string }) {
  const s = await verifiedLink(token);
  if (!s) return { error: 'Your session ended or the link expired. Reload the page or ask for a new link.' };
  const row: Record<string, any> = {};
  if (s.wants_ssn) {
    const ssn = (p.ssn || '').replace(/\D/g, '');
    if (ssn.length !== 9) return { error: 'Your Social Security number should be 9 digits.' };
    row.ssn_enc = encrypt(ssn);
    row.ssn_last4 = ssn.slice(-4);
  }
  if (s.wants_bank) {
    const rn = (p.routing || '').replace(/\D/g, '');
    const acct = (p.account || '').replace(/\D/g, '');
    const bank = await lookupRouting(rn);
    if (!bank.valid) return { error: bank.note || 'Check the routing number.' };
    if (acct.length < 4 || acct.length > 17) return { error: 'Your account number should be 4 to 17 digits.' };
    row.routing = rn;
    row.account_enc = encrypt(acct);
    row.account_last4 = acct.slice(-4);
    row.account_type = p.account_type === 'Savings' ? 'Savings' : 'Checking';
    row.bank_name = bank.bank ? [bank.bank, [bank.city, bank.state].filter(Boolean).join(', ')].filter(Boolean).join(' · ') : null;
  }
  await sql`update leads set ${sql(row)}, updated_at = now() where id = ${s.lead_id}`;
  await sql`update secure_links set used_at = now() where id = ${s.id}`;
  await sql`insert into activities (user_id, lead_id, kind, detail) values (null, ${s.lead_id}, 'client_submit', 'Client filled in the secure form')`;
  (await cookies()).delete(`cl_${s.id}`);
  const [l] = await sql`select first_name, last_name, assigned_to from leads where id = ${s.lead_id}`;
  const what = [s.wants_ssn && 'SSN', s.wants_bank && 'bank details'].filter(Boolean).join(' and ');
  await notify([s.created_by, l.assigned_to], `${[l.first_name, l.last_name].filter(Boolean).join(' ')} sent their ${what}`, 'It’s saved on the lead now.', `/leads/${s.lead_id}`);
  return { ok: true };
}
