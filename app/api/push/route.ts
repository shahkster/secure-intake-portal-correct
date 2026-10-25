import { NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { currentUser } from '@/lib/session';
import { pushKey, pushTo } from '@/lib/push';

export const dynamic = 'force-dynamic';

// Only real browser push services — never let the server post to an address someone typed in.
const PUSH_HOSTS = [/(^|\.)googleapis\.com$/, /(^|\.)push\.services\.mozilla\.com$/, /(^|\.)push\.apple\.com$/, /(^|\.)notify\.windows\.com$/];
function okEndpoint(e: string) {
  try { const u = new URL(e); return u.protocol === 'https:' && PUSH_HOSTS.some((r) => r.test(u.hostname)) && e.length < 1000; } catch { return false; }
}

export async function GET() {
  const u = await currentUser();
  if (!u) return NextResponse.json({ error: 'signed out' }, { status: 401 });
  return NextResponse.json({ key: await pushKey() });
}

export async function POST(req: Request) {
  const u = await currentUser();
  if (!u) return NextResponse.json({ error: 'signed out' }, { status: 401 });
  const s = await req.json();
  if (!s?.endpoint || !s?.keys?.p256dh || !s?.keys?.auth || !okEndpoint(String(s.endpoint))
    || String(s.keys.p256dh).length > 200 || String(s.keys.auth).length > 100) return NextResponse.json({ error: 'bad subscription' }, { status: 400 });
  await sql`insert into push_subscriptions (user_id, endpoint, p256dh, auth) values (${u.id}, ${s.endpoint}, ${s.keys.p256dh}, ${s.keys.auth})
    on conflict (endpoint) do update set user_id = excluded.user_id, p256dh = excluded.p256dh, auth = excluded.auth`;
  await pushTo([u.id], { title: 'Alerts are on', body: 'You’ll get deals, new leads and callback reminders here.', url: '/' });
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: Request) {
  const u = await currentUser();
  if (!u) return NextResponse.json({ error: 'signed out' }, { status: 401 });
  const { endpoint } = await req.json();
  await sql`delete from push_subscriptions where endpoint = ${endpoint} and user_id = ${u.id}`;
  return NextResponse.json({ ok: true });
}
