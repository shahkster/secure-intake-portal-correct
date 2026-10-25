'use server';
import bcrypt from 'bcryptjs';
import { authenticator } from 'otplib';
import { redirect } from 'next/navigation';
import { sql } from '@/lib/db';
import { ensureSchema } from '@/lib/ensure';
import { decrypt } from '@/lib/crypto';
import { clearSession, createSession, readSession } from '@/lib/session';
import { clientIp, recordFail, safeEqual, tooMany } from '@/lib/throttle';
import { forgetDevices, isTrustedDevice, rememberDevice } from '@/lib/device';
import { requireUser } from '@/lib/session';

const DUMMY_HASH = '$2a$12$9JVL9HdbtMIxXNzLuUqA0ORnv2Am9pK2aXD2.oyqUkLOM8zaYQ3mK';
const SLOW = 'Too many tries from this connection. Wait 15 minutes and try again.';

authenticator.options = { window: 1 };

type R = { error?: string } | undefined;
const BAD_LOGIN = 'That email and password don’t match an active account.';

async function bumpFail(id: string) {
  await sql`update users set
    failed_attempts = failed_attempts + 1,
    locked_until = case when failed_attempts + 1 >= 8 then now() + interval '15 minutes' else locked_until end
    where id = ${id}`;
}
const isLocked = (u: any) => u.locked_until && new Date(u.locked_until) > new Date();

export async function login(_: R, fd: FormData): Promise<R> {
  const email = String(fd.get('email') || '').trim().toLowerCase().slice(0, 200);
  const password = String(fd.get('password') || '').slice(0, 200);
  await ensureSchema();
  const ip = await clientIp();
  if (await tooMany(`ip:${ip}`, 20, 15)) return { error: SLOW };
  const [u] = await sql`select * from users where email = ${email}`;
  if (!u || !u.active) {
    await bcrypt.compare(password, DUMMY_HASH); // same timing as a real account
    await recordFail(`ip:${ip}`);
    return { error: BAD_LOGIN };
  }
  if (isLocked(u)) return { error: 'Too many wrong tries. This account is locked for 15 minutes.' };
  if (!(await bcrypt.compare(password, u.password_hash))) {
    await bumpFail(u.id);
    await recordFail(`ip:${ip}`);
    return { error: BAD_LOGIN };
  }
  await sql`update users set failed_attempts = 0, locked_until = null where id = ${u.id}`;
  // A remembered device skips the 6-digit code (the password is still checked above).
  if (u.totp_enabled && (await isTrustedDevice(u.id))) await finish(u);
  await createSession({
    uid: u.id, role: u.role, name: u.name, sv: u.session_version,
    stage: u.totp_enabled ? 'pending' : 'setup',
  });
  redirect(u.totp_enabled ? '/login/2fa' : '/setup-2fa');
}

/** Checks a 6-digit code and refuses to accept the same code twice. */
async function checkTotp(u: any, raw: string) {
  const token = raw.replace(/\D/g, '');
  if (token.length !== 6) return false;
  const delta = authenticator.checkDelta(token, decrypt(u.totp_secret));
  if (delta === null) return false;
  const step = Math.floor(Date.now() / 30000) + delta;
  const r = await sql`update users set totp_last_step = ${step}
    where id = ${u.id} and (totp_last_step is null or totp_last_step < ${step}) returning id`;
  return r.length === 1;
}

async function finish(u: any) {
  await sql`update users set failed_attempts = 0, locked_until = null where id = ${u.id}`;
  await createSession({
    uid: u.id, role: u.role, name: u.name, sv: u.session_version, stage: 'full', mcp: u.must_change_password,
  });
  redirect(u.must_change_password ? '/account?first=1' : '/');
}

export async function verify2fa(_: R, fd: FormData): Promise<R> {
  const s = await readSession();
  if (!s || s.stage !== 'pending') redirect('/login');
  const [u] = await sql`select * from users where id = ${s.uid} and active`;
  if (!u?.totp_secret || !u.totp_enabled) redirect('/login');
  if (isLocked(u)) return { error: 'Too many wrong tries. This account is locked for 15 minutes.' };
  const ip = await clientIp();
  if (await tooMany(`ip:${ip}`, 20, 15)) return { error: SLOW };
  if (!(await checkTotp(u, String(fd.get('code') || '')))) {
    await bumpFail(u.id);
    await recordFail(`ip:${ip}`);
    return { error: 'That code didn’t work. Enter the newest 6-digit code from your authenticator app.' };
  }
  if (fd.get('remember') === 'on') await rememberDevice(u.id);
  await finish(u);
}

export async function confirm2faSetup(_: R, fd: FormData): Promise<R> {
  const s = await readSession();
  if (!s || s.stage !== 'setup') redirect('/login');
  const [u] = await sql`select * from users where id = ${s.uid} and active`;
  if (!u?.totp_secret) redirect('/login');
  const ip = await clientIp();
  if (await tooMany(`ip:${ip}`, 20, 15)) return { error: SLOW };
  if (!(await checkTotp(u, String(fd.get('code') || '')))) {
    await recordFail(`ip:${ip}`);
    return { error: 'That code didn’t match. Check the app shows this account, then enter the newest code.' };
  }
  await sql`update users set totp_enabled = true where id = ${u.id}`;
  if (fd.get('remember') === 'on') await rememberDevice(u.id);
  await finish(u);
}

/** Account page: make every remembered device ask for the 6-digit code again. */
export async function forgetMyDevices() {
  const u = await requireUser();
  await forgetDevices(u.id);
}

export async function logout() {
  await clearSession();
  redirect('/login');
}

export async function bootstrap(_: R, fd: FormData): Promise<R> {
  const key = process.env.SETUP_KEY || '';
  if (key.length < 12) return { error: 'Set a SETUP_KEY of 12+ characters in your environment variables first.' };
  const ip = await clientIp();
  await ensureSchema();
  if (await tooMany(`setup:${ip}`, 10, 60)) return { error: SLOW };
  if (!safeEqual(String(fd.get('key') || ''), key)) { await recordFail(`setup:${ip}`); return { error: 'Setup key is wrong.' }; }
  const name = String(fd.get('name') || '').trim();
  const email = String(fd.get('email') || '').trim().toLowerCase();
  const password = String(fd.get('password') || '');
  if (!name || !email.includes('@')) return { error: 'Enter your name and a valid email.' };
  if (password.length < 10) return { error: 'Use a password with at least 10 characters.' };
  await ensureSchema();
  const [{ n }] = await sql`select count(*)::int as n from users where role = 'boss'`;
  if (n > 0) return { error: 'A boss account already exists. Sign in instead.' };
  await sql`insert into users (name, email, password_hash, role, must_change_password, is_owner)
    values (${name}, ${email}, ${await bcrypt.hash(password, 12)}, 'boss', false, true)`;
  redirect('/login?ready=1');
}
