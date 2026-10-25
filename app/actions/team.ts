'use server';
import bcrypt from 'bcryptjs';
import { revalidatePath } from 'next/cache';
import { sql } from '@/lib/db';
import { requireBoss, type User } from '@/lib/session';
import { tempPassword } from '@/lib/crypto';
import { forgetDevices } from '@/lib/device';

/** The owner can manage anyone but themselves; other bosses can only manage agents. */
async function canManage(actor: User, targetId: string) {
  if (targetId === actor.id) return 'You can’t do that to your own account.';
  const [t] = await sql`select role, is_owner from users where id = ${targetId}`;
  if (!t) return 'That person doesn’t exist.';
  if (t.is_owner) return 'The owner account can’t be changed by anyone else.';
  if (t.role === 'boss' && !actor.is_owner) return 'Only the owner can manage other bosses.';
  return null;
}

export async function createUser(p: { name: string; email: string; role: string }): Promise<{ password?: string; error?: string }> {
  const boss = await requireBoss();
  const name = p.name?.trim();
  const email = p.email?.trim().toLowerCase();
  const role = p.role === 'boss' ? 'boss' : 'agent';
  if (role === 'boss' && !boss.is_owner) return { error: 'Only the owner can add bosses.' };
  if (!name || !email?.includes('@')) return { error: 'Enter a name and a valid email.' };
  const [dupe] = await sql`select id from users where email = ${email}`;
  if (dupe) return { error: 'Someone already has that email.' };
  const password = tempPassword();
  await sql`insert into users (name, email, password_hash, role) values (${name}, ${email}, ${await bcrypt.hash(password, 12)}, ${role})`;
  await sql`insert into audit_log (user_id, action, target) values (${boss.id}, 'create_user', ${email})`;
  revalidatePath('/team');
  return { password };
}

export async function resetPassword(id: string): Promise<{ password?: string; error?: string }> {
  const boss = await requireBoss();
  const no = await canManage(boss, id);
  if (no) return { error: no };
  const password = tempPassword();
  await sql`update users set password_hash = ${await bcrypt.hash(password, 12)}, must_change_password = true,
    failed_attempts = 0, locked_until = null, session_version = session_version + 1 where id = ${id}`;
  await forgetDevices(id);
  await sql`insert into audit_log (user_id, action, target) values (${boss.id}, 'reset_password', ${id})`;
  revalidatePath('/team');
  return { password };
}

export async function reset2fa(id: string): Promise<{ error?: string }> {
  const boss = await requireBoss();
  const no = await canManage(boss, id);
  if (no) return { error: no };
  await sql`update users set totp_enabled = false, totp_secret = null, totp_last_step = null, session_version = session_version + 1 where id = ${id}`;
  await forgetDevices(id);
  await sql`insert into audit_log (user_id, action, target) values (${boss.id}, 'reset_2fa', ${id})`;
  revalidatePath('/team');
  return {};
}

export async function setActive(id: string, active: boolean): Promise<{ error?: string }> {
  const boss = await requireBoss();
  const no = await canManage(boss, id);
  if (no) return { error: no };
  await sql`update users set active = ${active}, session_version = session_version + 1 where id = ${id}`;
  if (!active) { await sql`delete from push_subscriptions where user_id = ${id}`; await forgetDevices(id); } // stop alerts, forget their devices
  await sql`insert into audit_log (user_id, action, target) values (${boss.id}, ${active ? 'activate' : 'deactivate'}, ${id})`;
  revalidatePath('/team');
  return {};
}

/** Owner only: make a boss an agent or an agent a boss. */
export async function setRole(id: string, role: 'boss' | 'agent'): Promise<{ error?: string }> {
  const boss = await requireBoss();
  if (!boss.is_owner) return { error: 'Only the owner can change roles.' };
  const no = await canManage(boss, id);
  if (no) return { error: no };
  await sql`update users set role = ${role === 'boss' ? 'boss' : 'agent'}, session_version = session_version + 1 where id = ${id}`;
  await sql`insert into audit_log (user_id, action, target) values (${boss.id}, ${'role_' + role}, ${id})`;
  revalidatePath('/team');
  return {};
}
