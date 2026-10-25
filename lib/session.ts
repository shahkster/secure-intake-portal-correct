import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { sql } from './db';
import { signToken, verifyToken, type Session } from './jwt';
import { ensureSchema } from './ensure';

export const COOKIE = 'crm_session';

export async function createSession(s: Session) {
  const ttl = s.stage === 'full' ? 60 * 60 * 12 : 60 * 10;
  const token = await signToken(s, ttl);
  (await cookies()).set(COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: ttl,
  });
}

export async function readSession() {
  return verifyToken((await cookies()).get(COOKIE)?.value);
}

export async function clearSession() {
  (await cookies()).delete(COOKIE);
}

export type User = {
  id: string;
  name: string;
  email: string;
  role: 'boss' | 'agent';
  must_change_password: boolean;
  is_owner: boolean;
  deals_seen_at: Date;
};

export async function currentUser(): Promise<User | null> {
  const s = await readSession();
  if (!s || s.stage !== 'full') return null;
  await ensureSchema();
  const [u] = await sql`
    select id, name, email, role, must_change_password, deals_seen_at, is_owner
    from users where id = ${s.uid} and active and session_version = ${s.sv}`;
  return (u as User) ?? null;
}

export async function requireUser(): Promise<User> {
  const u = await currentUser();
  if (!u) redirect('/login');
  return u;
}

export async function requireBoss(): Promise<User> {
  const u = await requireUser();
  if (u.role !== 'boss') redirect('/');
  return u;
}

/** The main account. Only the owner can manage other bosses, delete records, or clear Do Not Call flags. */
export async function requireOwner(): Promise<User> {
  const u = await requireBoss();
  if (!u.is_owner) redirect('/');
  return u;
}
