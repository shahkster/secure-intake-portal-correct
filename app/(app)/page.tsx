import Link from 'next/link';
import { sql } from '@/lib/db';
import { requireUser } from '@/lib/session';
import { CONTACT_STATUSES, DEAD_DEAL } from '@/lib/constants';
import { money } from '@/lib/format';

const TZ = process.env.APP_TIMEZONE || 'America/New_York';

export default async function Today() {
  const u = await requireUser();
  const boss = u.role === 'boss';
  const dayStart = sql`(date_trunc('day', now() at time zone ${TZ}) at time zone ${TZ})`;
  const monthStart = sql`(date_trunc('month', now() at time zone ${TZ}))::date`;
  const mineOnly = boss ? sql`and true` : sql`and user_id = ${u.id}`;

  const [[act], [deals], board, perAgent, [unassigned], [callbacks]] = await Promise.all([
    sql`select
          count(distinct lead_id)::int as worked,
          count(*) filter (where kind = 'dial')::int as dials,
          count(*) filter (where kind = 'status' and detail = 'No Answer')::int as no_answer,
          count(*) filter (where kind = 'status' and detail in ${sql(CONTACT_STATUSES)})::int as contacts
        from activities where created_at >= ${dayStart} ${mineOnly}`,
    sql`select count(*)::int as n, coalesce(sum(monthly_premium * 12), 0) as ap
        from deals where created_at >= ${dayStart} and status not in ${sql(DEAD_DEAL)}
        ${boss ? sql`and true` : sql`and agent_id = ${u.id}`}`,
    sql`select u.id, u.name, count(d.id)::int as deals, coalesce(sum(d.monthly_premium * 12), 0) as ap
        from users u left join deals d on d.agent_id = u.id and d.closed_date >= ${monthStart} and d.status not in ${sql(DEAD_DEAL)}
        where u.active group by u.id, u.name having count(d.id) > 0 order by ap desc limit 10`,
    boss
      ? sql`select u.id, u.name, count(a.id)::int as n,
              count(a.id) filter (where a.kind = 'status' and a.detail in ${sql(CONTACT_STATUSES)})::int as contacts
            from users u left join activities a on a.user_id = u.id and a.created_at >= ${dayStart}
            where u.active and u.role = 'agent' group by u.id, u.name order by n desc`
      : Promise.resolve([] as any[]),
    boss ? sql`select count(*)::int as n from leads where assigned_to is null` : Promise.resolve([{ n: 0 }]),
    sql`select count(*)::int as n from leads where assigned_to = ${u.id} and status = 'Callback' and callback_at::date = (now() at time zone ${TZ})::date`,
  ]);

  const rate = act.worked ? Math.round((act.contacts / act.worked) * 100) : 0;

  return (
    <div className="page">
      <header className="page-head">
        <div>
          <h1>Good {greeting()}, {u.name.split(' ')[0]}</h1>
          <p className="quiet">{boss ? 'Here’s how the floor is doing today.' : 'Here’s your day so far.'}</p>
        </div>
        <div className="row gap">
          <Link className="btn" href="/leads?status=Callback">Callbacks today: {callbacks.n}</Link>
          <Link className="btn primary" href="/deals/new">Log a deal</Link>
        </div>
      </header>

      <section className="hero-strip">
        <div className="hero-figure">
          <span className="label">Annual premium written today</span>
          <strong className="num">{money(deals.ap)}</strong>
          <span className="quiet">{deals.n} deal{deals.n === 1 ? '' : 's'}</span>
        </div>
        <dl className="stat-row">
          <div><dt>Leads worked</dt><dd className="num">{act.worked}</dd></div>
          <div><dt>Dials</dt><dd className="num">{act.dials}</dd></div>
          <div><dt>Reached a person</dt><dd className="num">{act.contacts}</dd></div>
          <div><dt>Contact rate</dt><dd className="num">{rate}%</dd></div>
          <div><dt>No answers</dt><dd className="num">{act.no_answer}</dd></div>
          {boss && <div><dt>Unassigned leads</dt><dd className="num"><Link href="/leads?agent=none">{unassigned.n}</Link></dd></div>}
        </dl>
      </section>

      <div className={boss ? 'two-col' : ''}>
        <section className="card">
          <h2>Leaderboard this month</h2>
          {board.length === 0 ? <p className="quiet">No deals yet this month. First one takes the top spot.</p> : (
            <ol className="board">
              {board.map((b: any, i: number) => (
                <li key={b.id} className={b.id === u.id ? 'me' : ''}>
                  <span className={`rank r${i + 1}`}>{i + 1}</span>
                  <span className="who">{b.name}<small>{b.deals} deal{b.deals === 1 ? '' : 's'}</small></span>
                  <span className="num amt">{money(b.ap)}</span>
                </li>
              ))}
            </ol>
          )}
        </section>
        {boss && (
          <section className="card">
            <h2>Agent activity today</h2>
            {perAgent.length === 0 ? <p className="quiet">Add agents on the Team page to see their activity.</p> : (
              <table className="mini">
                <thead><tr><th>Agent</th><th className="r">Activity</th><th className="r">Contacts</th></tr></thead>
                <tbody>{perAgent.map((a: any) => <tr key={a.id}><td><Link href={`/team/${a.id}`}>{a.name}</Link></td><td className="r num">{a.n}</td><td className="r num">{a.contacts}</td></tr>)}</tbody>
              </table>
            )}
          </section>
        )}
      </div>
    </div>
  );
}

function greeting() {
  const h = Number(new Intl.DateTimeFormat('en-US', { timeZone: TZ, hour: 'numeric', hourCycle: 'h23' }).format(new Date()));
  return h < 12 ? 'morning' : h < 17 ? 'afternoon' : 'evening';
}
