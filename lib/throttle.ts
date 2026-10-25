import crypto from 'crypto';
import { headers } from 'next/headers';
import { sql } from './db';

export async function clientIp() {
  const h = await headers();
  return (h.get('x-forwarded-for') || '').split(',')[0].trim() || h.get('x-real-ip') || 'unknown';
}

/** True when `key` has failed `max` times in the last `minutes`. */
export async function tooMany(key: string, max: number, minutes: number) {
  const [{ n }] = await sql`select count(*)::int as n from auth_throttle where key = ${key} and at > now() - make_interval(mins => ${minutes})`;
  return n >= max;
}

export async function recordFail(key: string) {
  await sql`insert into auth_throttle (key) values (${key})`;
  if (Math.random() < 0.02) await sql`delete from auth_throttle where at < now() - interval '1 day'`;
}

export function safeEqual(a: string, b: string) {
  const x = Buffer.from(a || '');
  const y = Buffer.from(b || '');
  return x.length === y.length && x.length > 0 && crypto.timingSafeEqual(x, y);
}
