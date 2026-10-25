import { NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { currentUser } from '@/lib/session';
import { sendDueCallbacks } from '@/lib/notify';

export const dynamic = 'force-dynamic';

export async function GET() {
  const u = await currentUser();
  if (!u) return NextResponse.json({ error: 'signed out' }, { status: 401 });
  const [mine, deals, [mc], [dc], callbacks] = await Promise.all([
    sql`select id, title, body, link, read, created_at from notifications where user_id = ${u.id} order by created_at desc limit 25`,
    sql`select id, title, body, link, created_at from notifications where user_id is null order by created_at desc limit 25`,
    sql`select count(*)::int as n from notifications where user_id = ${u.id} and not read`,
    sql`select count(*)::int as n from notifications where user_id is null and created_at > ${u.deals_seen_at}`,
    sql`select id, first_name, last_name, phone, state, zip, callback_at from leads
        where assigned_to = ${u.id} and status = 'Callback' and not dnc and not is_agent and callback_at is not null
        and callback_at <= now() + interval '30 minutes' and callback_at > now() - interval '3 days'
        order by callback_at limit 12`,
  ]);
  sendDueCallbacks().catch(() => {});
  return NextResponse.json({ mine, deals, mineUnread: mc.n, dealsUnread: dc.n, callbacks });
}
