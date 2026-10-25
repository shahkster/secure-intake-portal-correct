import Link from 'next/link';
import { sql } from '@/lib/db';
import { requireUser } from '@/lib/session';
import { DEAD_DEAL, DEAL_STATUSES } from '@/lib/constants';
import { money } from '@/lib/format';
import DealsTable from './DealsTable';

export default async function Deals(props: { searchParams: Promise<Record<string, string>> }) {
  const searchParams = await props.searchParams;
  const u = await requireUser();
  const boss = u.role === 'boss';
  const { q = '', status = '', agent = '', range = 'month' } = searchParams;
  let where = sql`true`;
  if (!boss) where = sql`${where} and d.agent_id = ${u.id}`;
  else if (agent) where = sql`${where} and d.agent_id = ${agent}`;
  if (status) where = sql`${where} and d.status = ${status}`;
  const TZ = process.env.APP_TIMEZONE || 'America/New_York';
  const m0 = sql`date_trunc('month', now() at time zone ${TZ})`;
  if (range === 'month') where = sql`${where} and d.closed_date >= ${m0}::date`;
  if (range === 'last') where = sql`${where} and d.closed_date >= (${m0} - interval '1 month')::date and d.closed_date < ${m0}::date`;
  if (q.trim()) {
    const like = `%${q.trim()}%`;
    where = sql`${where} and (d.client_name ilike ${like} or d.policy_number ilike ${like} or d.phone ilike ${like} or d.email ilike ${like})`;
  }
  const [rows, agents] = await Promise.all([
    sql`select d.id, d.client_name, d.policy_number, d.carrier, d.state, d.monthly_premium, d.coverage, d.status,
          to_char(d.closed_date, 'YYYY-MM-DD') as closed_date, to_char(d.effective_date, 'YYYY-MM-DD') as effective_date,
          d.updated_at, u.name as agent_name
        from deals d left join users u on u.id = d.agent_id where ${where}
        order by d.closed_date desc nulls last, d.created_at desc limit 500`,
    boss ? sql`select id, name from users where active order by name` : Promise.resolve([] as any[]),
  ]);
  const live = rows.filter((r: any) => !DEAD_DEAL.includes(r.status));
  const ap = live.reduce((s: number, r: any) => s + Number(r.monthly_premium) * 12, 0);

  return (
    <div className="page">
      <header className="page-head">
        <div><h1>Deals</h1><p className="quiet">{live.length} active · <span className="num">{money(ap)}</span> annual premium</p></div>
        <Link className="btn primary" href="/deals/new">Log a deal</Link>
      </header>
      <DealsTable deals={JSON.parse(JSON.stringify(rows))} agents={JSON.parse(JSON.stringify(agents))} isBoss={boss} />
    </div>
  );
}
