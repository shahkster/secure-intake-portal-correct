import { createHash, randomBytes } from 'crypto';
import { cookies, headers } from 'next/headers';
import { sql } from './db';

/** "Remember this device": a random token in a locked-down cookie; only its hash is stored. */
export const DEVICE_COOKIE = 'crm_device';
const DAYS = 30;
const hash = (t: string) => createHash('sha256').update(t).digest('hex');

function deviceLabel(ua: string) {
  const os = /iPhone/.test(ua) ? 'iPhone' : /iPad/.test(ua) ? 'iPad' : /Android/.test(ua) ? 'Android' : /Mac OS X/.test(ua) ? 'Mac' : /Windows/.test(ua) ? 'Windows' : /Linux/.test(ua) ? 'Linux' : 'Device';
  const br = /Edg\//.test(ua) ? 'Edge' : /Chrome\//.test(ua) ? 'Chrome' : /Firefox\//.test(ua) ? 'Firefox' : /Safari\//.test(ua) ? 'Safari' : 'browser';
  return `${br} on ${os}`;
}

export async function rememberDevice(userId: string) {
  const token = randomBytes(32).toString('base64url');
  const ua = (await headers()).get('user-agent') || '';
  await sql`insert into trusted_devices (user_id, token_hash, label, expires_at)
    values (${userId}, ${hash(token)}, ${deviceLabel(ua)}, now() + ${DAYS + ' days'}::interval)`;
  (await cookies()).set(DEVICE_COOKIE, token, {
    httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: '/', maxAge: DAYS * 86400,
  });
}

/** True when this browser was remembered by this same person and hasn't expired. */
export async function isTrustedDevice(userId: string) {
  const token = (await cookies()).get(DEVICE_COOKIE)?.value;
  if (!token || token.length > 100) return false;
  const r = await sql`update trusted_devices set last_used_at = now()
    where token_hash = ${hash(token)} and user_id = ${userId} and expires_at > now() returning id`;
  return r.length === 1;
}

export async function forgetDevices(userId: string) {
  await sql`delete from trusted_devices where user_id = ${userId}`;
}
