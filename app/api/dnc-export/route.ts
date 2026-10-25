import { currentUser } from '@/lib/session';
import { sql } from '@/lib/db';

export const dynamic = 'force-dynamic';

/** Phone numbers only — no names or other lead details ever leave the CRM. */
export async function GET(req: Request) {
  const u = await currentUser();
  if (!u || u.role !== 'boss') return new Response('Not allowed', { status: 403 });
  const scope = new URL(req.url).searchParams.get('scope') === 'all' ? 'all' : 'due';
  const rows = await sql`select distinct phone_num from leads
    where phone_num is not null and not dnc
    ${scope === 'due' ? sql`and (dnc_checked_at is null or dnc_checked_at < now() - interval '31 days')` : sql`and true`}
    order by phone_num`;
  const body = 'phone\n' + rows.map((r: any) => String(r.phone_num)).join('\n') + '\n';
  const date = new Date().toISOString().slice(0, 10);
  return new Response(body, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="phones-to-check-${date}.csv"`,
      'Cache-Control': 'no-store',
    },
  });
}
