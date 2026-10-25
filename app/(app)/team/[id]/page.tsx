import Link from 'next/link';
import { redirect } from 'next/navigation';
import { sql } from '@/lib/db';
import { requireBoss } from '@/lib/session';
import { CONTACT_STATUSES, DEAD_DEAL, LEAD_STATUSES, toneOf } from '@/lib/constants';
import { money } from '@/lib/format';
import CallLink from '@/components/CallLink';

const TZ = process.env.APP_TIMEZONE || 'America/New_York';
const RANGES: [string, string][] = [['today', 'Today'], ['yesterday', 'Yesterday'], ['week', 'Last 7 days'], ['month', 'This month'], ['all', 'All time']];

const when = (d: string | Date) =>
  new Date(d).toLocaleString('en-US', { timeZone: TZ, month: 'numeric', day: 'numeric', hour: 'numeric', minute: '2-digit' });

/** One team member's calling activity: how many calls, who they called, and how each call went. */
export default async function Member({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string>> }) {
  const me = await requireBoss();
  const { id } = await params;
  const sp = await searchParams;
  if (!/^[0-9a-f-]{36}$/i.test(id)) redirect('/team');
  const [p] = await sql`select id, name, email, role, is_owner, active from users where id = ${id}`;
  if (!p) redirect('/team');
  // Other bosses can see agents and themselves; only the owner can see other bosses.
  if (p.role === 'boss' && p.id !== me.id && !me.is_owner) redirect('/team');

  const range = RANGES.some(([k]) => k === sp.range) ? sp.range : 'today';
  const view = sp.view === 'timeline' ? 'timeline' : 'people';
  const dayStart = sql`(date_trunc('day', now() at time zone ${TZ}) at time zone ${TZ})`;
  const span = {
    today: sql`a.created_at >= ${dayStart}`,
    yesterday: sql`a.created_at >= ${dayStart} - interval '1 day' and a.created_at < ${dayStart}`,
    week: sql`a.created_at >= now() - interval '7 days'`,
    month: sql`a.created_at >= (date_trunc('month', now() at time zone ${TZ}) at time zone ${TZ})`,
    all: sql`true`,
  }[range]!;

  const [[s], results, [deals], [owned], people, timeline] = await Promise.all([
    sql`select count(*) filter (where kind = 'dial')::int as dials,
          count(distinct lead_id) filter (where kind = 'dial')::int as called,
          count(distinct lead_id)::int as worked,
          count(*) filter (where kind = 'status' and detail in ${sql(CONTACT_STATUSES)})::int as contacts,
          count(*) filter (where kind = 'status' and detail = 'No Answer')::int as no_answer,
          min(created_at) filter (where kind = 'dial') as first_dial, max(created_at) as last_at
        from activities a where user_id = ${id} and ${span}`,
    sql`select detail as status, count(*)::int as n from activities a
        where user_id = ${id} and kind = 'status' and ${span} group by detail order by n desc`,
    sql`select count(*)::int as n, coalesce(sum(monthly_premium * 12), 0) as ap
        from deals a where agent_id = ${id} and status not in ${sql(DEAD_DEAL)} and ${span}`,
    sql`select count(*)::int as n from leads where assigned_to = ${id}`,
    view === 'people'
      ? sql`select l.id, l.first_name, l.last_name, l.phone, l.state, l.city, l.status,
              count(*) filter (where a.kind = 'dial')::int as dials,
              max(a.created_at) as last_at,
              (array_agg(a.detail order by a.created_at desc) filter (where a.kind = 'status'))[1] as result
            from activities a join leads l on l.id = a.lead_id
            where a.user_id = ${id} and a.kind in ('dial', 'status') and ${span}
            group by l.id order by last_at desc limit 500`
      : Promise.resolve([] as any[]),
    view === 'timeline'
      ? sql`select a.kind, a.detail, a.created_at, l.id as lead_id, l.first_name, l.last_name
            from activities a left join leads l on l.id = a.lead_id
            where a.user_id = ${id} and a.kind in ('dial', 'status', 'edit') and ${span}
            order by a.created_at desc limit 500`
      : Promise.resolve([] as any[]),
  ]);

  const rate = s.called ? Math.round((s.contacts / s.called) * 100) : 0;
  const link = (q: Record<string, string>) => `/team/${id}?${new URLSearchParams({ range, view, ...q })}`;
  const nm = (r: any) => [r.first_name, r.last_name].filter(Boolean).join(' ') || 'Unnamed lead';
  const what = (r: any) => (r.kind === 'dial' ? 'Called' : r.kind === 'edit' ? 'Edited the lead' : `Marked ${r.detail}`);

  return (
    <div className="page">
      <Link href="/team" className="back quiet">← Team</Link>
      <header className="page-head">
        <div>
          <h1>{p.name}{p.id === me.id && ' (you)'}</h1>
          <p className="quiet">{p.is_owner ? 'Owner' : p.role === 'boss' ? 'Boss' : 'Agent'} · {owned.n.toLocaleString()} leads assigned{!p.active && ' · Deactivated'}</p>
        </div>
      </header>

      <nav className="seg range-tabs" aria-label="Time range">
        {RANGES.map(([k, label]) => <Link key={k} href={link({ range: k })} className={range === k ? 'on' : ''} aria-current={range === k ? 'page' : undefined}>{label}</Link>)}
      </nav>

      <section className="card">
        <dl className="stat-row">
          <div><dt>Calls made</dt><dd>{s.dials.toLocaleString()}</dd></div>
          <div><dt>People called</dt><dd>{s.called.toLocaleString()}</dd></div>
          <div><dt>Talked to</dt><dd>{s.contacts.toLocaleString()}</dd></div>
          <div><dt>Contact rate</dt><dd>{rate}%</dd></div>
          <div><dt>No answer</dt><dd>{s.no_answer.toLocaleString()}</dd></div>
          <div><dt>Deals</dt><dd>{deals.n}{deals.n > 0 && <small className="quiet"> · {money(deals.ap)} AP</small>}</dd></div>
        </dl>
        <p className="quiet small mt">
          {s.last_at ? <>Last activity {when(s.last_at)}{s.first_dial && range !== 'all' ? ` · first call ${when(s.first_dial)}` : ''}.</> : 'No activity in this time range.'}
          {' '}Counts calls placed from the CRM (tapping a number or auto-dial).
        </p>
        {results.length > 0 && (
          <div className="result-chips">
            {results.map((r: any) => <span key={r.status} className={`pill t-${toneOf(LEAD_STATUSES, r.status)}`}>{r.status} · {r.n}</span>)}
          </div>
        )}
      </section>

      <section className="card">
        <div className="row between wrap gap">
          <h2>{view === 'people' ? 'Who they called' : 'Everything they did'}</h2>
          <nav className="seg" aria-label="View">
            <Link href={link({ view: 'people' })} className={view === 'people' ? 'on' : ''}>By person</Link>
            <Link href={link({ view: 'timeline' })} className={view === 'timeline' ? 'on' : ''}>Timeline</Link>
          </nav>
        </div>

        {view === 'people' ? (
          people.length === 0 ? <p className="quiet">Nobody called in this time range.</p> : (
            <div className="table-wrap">
              <table className="grid">
                <thead><tr><th>Lead</th><th>Phone</th><th>Where</th><th className="r">Calls</th><th>Last result</th><th>Status now</th><th>Last time</th></tr></thead>
                <tbody>
                  {people.map((r: any) => (
                    <tr key={r.id}>
                      <td><Link href={`/leads/${r.id}`}>{nm(r)}</Link></td>
                      <td><CallLink phone={r.phone} leadId={r.id} /></td>
                      <td className="nowrap">{[r.city, r.state].filter(Boolean).join(', ') || '—'}</td>
                      <td className="r num">{r.dials}</td>
                      <td>{r.result ? <span className={`pill t-${toneOf(LEAD_STATUSES, r.result)}`}>{r.result}</span> : <span className="quiet">No result set</span>}</td>
                      <td><span className={`pill t-${toneOf(LEAD_STATUSES, r.status)}`}>{r.status}</span></td>
                      <td className="nowrap quiet">{when(r.last_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {people.length === 500 && <p className="quiet small">Showing the latest 500. Pick a shorter time range to see the rest.</p>}
            </div>
          )
        ) : (
          timeline.length === 0 ? <p className="quiet">No activity in this time range.</p> : (
            <ol className="timeline">
              {timeline.map((r: any, i: number) => (
                <li key={i}>
                  <span className="quiet nowrap">{when(r.created_at)}</span>
                  <span>{what(r)}{' '}{r.lead_id ? <Link href={`/leads/${r.lead_id}`}>{nm(r)}</Link> : <span className="quiet">(deleted lead)</span>}</span>
                </li>
              ))}
            </ol>
          )
        )}
      </section>
    </div>
  );
}
