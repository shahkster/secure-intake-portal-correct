import Link from 'next/link';
import { sql } from '@/lib/db';
import { requireBoss } from '@/lib/session';
import { ago, shortDate } from '@/lib/format';
import { DncUpload, Watchlist, Recheck, WatchRow } from './ComplianceClient';
import { FreeDnc, AgentQueue } from './Checks';

export const maxDuration = 60;

export default async function Compliance() {
  await requireBoss();
  const [[counts], [last], uploads, watch, [wc], [flags], [chk]] = await Promise.all([
    sql`select count(*) filter (where source = 'registry')::int as registry, count(*) filter (where source = 'internal')::int as internal from dnc_numbers`,
    sql`select created_at from dnc_uploads where mode = 'add' order by created_at desc limit 1`,
    sql`select name, mode, count, created_at from dnc_uploads order by created_at desc limit 6`,
    sql`select id, kind, value, state, note, created_at from agent_watchlist order by created_at desc limit 25`,
    sql`select count(*)::int as n from agent_watchlist`,
    sql`select count(*) filter (where dnc)::int as dnc, count(*) filter (where is_agent)::int as agents from leads`,
    sql`select count(distinct phone_num)::int as total,
          count(distinct phone_num) filter (where dnc_checked_at is null or dnc_checked_at < now() - interval '31 days')::int as due,
          count(*) filter (where agent_checked_at is null and not is_agent and not dnc)::int as agent_due
        from leads where phone_num is not null and not dnc`,
  ]);
  const days = last ? Math.floor((Date.now() - new Date(last.created_at).getTime()) / 86400000) : null;
  const stale = days === null || days > 28;

  return (
    <div className="page narrow">
      <header className="page-head">
        <div><h1>Compliance</h1><p className="quiet">Do Not Call scrubbing and agent screening. Flagged leads are hidden from agents.</p></div>
        <Link className="btn" href="/leads?view=flagged">See flagged leads ({flags.dnc + flags.agents})</Link>
      </header>

      <section className="card">
        <h2>Check numbers on FreeDNCList</h2>
        <FreeDnc due={chk.due} total={chk.total} hasApi={!!process.env.FREEDNC_API_KEY} />
      </section>

      <section className="card">
        <h2>Check leads on the NAIC agent lookup</h2>
        <p className="quiet small mb">{chk.agent_due.toLocaleString()} lead{chk.agent_due === 1 ? '' : 's'} not checked yet. “Licensed agent” hides the lead from agents and remembers the number for future imports.</p>
        <AgentQueue />
      </section>

      <section className="card">
        <h2>National Do Not Call Registry files</h2>
        <dl className="stat-row compact">
          <div><dt>Registry numbers loaded</dt><dd className="num">{counts.registry.toLocaleString()}</dd></div>
          <div><dt>Asked you not to call</dt><dd className="num">{counts.internal.toLocaleString()}</dd></div>
          <div><dt>Leads blocked</dt><dd className="num">{flags.dnc.toLocaleString()}</dd></div>
          <div><dt>Last registry update</dt><dd className={stale ? 'warn' : ''}>{days === null ? 'Never' : days === 0 ? 'Today' : `${days} days ago`}</dd></div>
        </dl>
        {stale && (
          <p className="note bad">
            {days === null ? 'No registry file loaded yet.' : 'Your registry data is almost a month old.'} The law requires you to re-check the National Do Not Call Registry at least every 31 days.
          </p>
        )}
        <details className="howto">
          <summary>How to get the registry files</summary>
          <ol>
            <li>Sign in at telemarketing.donotcall.gov with your agency’s SAN (Subscription Account Number). The first five area codes are free each year; more cost a yearly fee per area code.</li>
            <li>Download the full list for your area codes (first time), then the change lists each month.</li>
            <li>Upload them here. Pick “Add numbers” for full lists and additions, “Remove numbers” for deletion lists.</li>
          </ol>
        </details>
        <DncUpload />
        {uploads.length > 0 && (
          <table className="mini"><tbody>
            {uploads.map((u: any, i: number) => <tr key={i}><td>{u.name}</td><td>{u.mode === 'add' ? 'Added' : u.mode === 'remove' ? 'Removed' : 'Checked'}</td><td className="r num">{Number(u.count).toLocaleString()}</td><td className="quiet r">{shortDate(u.created_at)}</td></tr>)}
          </tbody></table>
        )}
      </section>

      <section className="card">
        <h2>Insurance agent screening</h2>
        <p className="quiet small">Leads are hidden when they match anyone on your list by phone (including their other phones), email, name (middle names and Jr/Sr ignored) or home address, when their email is at an insurance company, or when an agent marks them during a call. {flags.agents} lead{flags.agents === 1 ? ' is' : 's are'} hidden right now.</p>
        <Watchlist />
        {watch.length > 0 && (
          <>
            <h3 className="sub">Your agent list ({wc.n.toLocaleString()})</h3>
            <WatchRows rows={JSON.parse(JSON.stringify(watch))} />
          </>
        )}
      </section>

      <section className="card">
        <h2>Re-check everything</h2>
        <p className="quiet small">Runs every lead against the Do Not Call numbers and your agent list. This also happens automatically on every import, new lead and file upload.</p>
        <Recheck />
      </section>
    </div>
  );
}

function WatchRows({ rows }: { rows: any[] }) {
  return <div className="watch">{rows.map((r) => <WatchRow key={r.id} row={r} when={ago(r.created_at)} />)}</div>;
}
