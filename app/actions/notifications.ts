'use server';
import { sql } from '@/lib/db';
import { requireUser } from '@/lib/session';

export async function markRead(tab: 'mine' | 'deals') {
  const u = await requireUser();
  if (tab === 'mine') await sql`update notifications set read = true where user_id = ${u.id} and not read`;
  else await sql`update users set deals_seen_at = now() where id = ${u.id}`;
}
