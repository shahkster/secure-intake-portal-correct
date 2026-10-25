'use server';
import { revalidatePath } from 'next/cache';
import { sql } from '@/lib/db';
import { requireBoss, requireUser } from '@/lib/session';
import { lookupBin } from '@/lib/bin';
import { QUICK_LINK_SEED } from '@/lib/resources';

export async function seedQuickLinks() {
  const [{ n }] = await sql`select count(*)::int as n from quick_links`;
  if (n > 0) return;
  await sql`insert into quick_links ${sql(QUICK_LINK_SEED.map(([title, subtitle, url], i) => ({ title, subtitle: subtitle || null, url, sort: i })))}`;
}

const cleanUrl = (u: string) => {
  const t = (u || '').trim();
  if (!t) return null;
  const withProto = /^https?:\/\//i.test(t) ? t : `https://${t}`;
  try { const x = new URL(withProto); return x.protocol === 'https:' || x.protocol === 'http:' ? x.toString() : null; } catch { return null; }
};

export async function saveQuickLink(id: string | null, p: { title: string; subtitle?: string; url?: string }) {
  await requireBoss();
  const title = p.title?.trim();
  if (!title) return { error: 'Give the link a name.' };
  const url = p.url?.trim() ? cleanUrl(p.url) : null;
  if (p.url?.trim() && !url) return { error: 'That web address doesn’t look right.' };
  if (id) await sql`update quick_links set title = ${title}, subtitle = ${p.subtitle?.trim() || null}, url = ${url} where id = ${id}`;
  else await sql`insert into quick_links (title, subtitle, url, sort) values (${title}, ${p.subtitle?.trim() || null}, ${url}, (select coalesce(max(sort), 0) + 1 from quick_links))`;
  revalidatePath('/resources');
  return {};
}

export async function deleteQuickLink(id: string) {
  await requireBoss();
  await sql`delete from quick_links where id = ${id}`;
  revalidatePath('/resources');
}

/** Only ever receives the first 6 digits. */
export async function checkBin(first6: string) {
  await requireUser();
  return lookupBin(String(first6 || '').replace(/\D/g, '').slice(0, 6));
}
