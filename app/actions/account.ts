'use server';
import bcrypt from 'bcryptjs';
import { redirect } from 'next/navigation';
import { sql } from '@/lib/db';
import { requireUser, createSession } from '@/lib/session';

type R = { error?: string; ok?: boolean } | undefined;

export async function changePassword(_: R, fd: FormData): Promise<R> {
  const u = await requireUser();
  const current = String(fd.get('current') || '');
  const next = String(fd.get('next') || '');
  const confirm = String(fd.get('confirm') || '');
  const [row] = await sql`select password_hash, session_version from users where id = ${u.id}`;
  if (!(await bcrypt.compare(current, row.password_hash))) return { error: 'Your current password is wrong.' };
  if (next.length < 10) return { error: 'Use at least 10 characters.' };
  if (next !== confirm) return { error: 'The new passwords don’t match.' };
  if (next === current) return { error: 'Pick a password different from the temporary one.' };
  const [r] = await sql`update users set password_hash = ${await bcrypt.hash(next, 12)}, must_change_password = false,
    session_version = session_version + 1 where id = ${u.id} returning session_version`;
  await createSession({ uid: u.id, role: u.role, name: u.name, sv: r.session_version, stage: 'full', mcp: false });
  if (u.must_change_password) redirect('/');
  return { ok: true };
}
