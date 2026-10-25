import { notFound, redirect } from 'next/navigation';
import Link from 'next/link';
import { sql } from '@/lib/db';
import { requireUser } from '@/lib/session';
import { ago } from '@/lib/format';
import LeadForm from './LeadForm';

export default async function LeadPage(props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const u = await requireUser();
  if (!/^[0-9a-f-]{36}$/i.test(params.id)) notFound();
  const [l] = await sql`select id, first_name, last_name, middle, to_char(dob, 'YYYY-MM-DD') as dob, gender, smoker,
      phone, alt_phones, email, address, city, state, zip, desired_coverage, quoted_premium, height, weight, health, notes,
      status, attempts, callback_at, last_touch, assigned_to, ssn_last4, routing, account_last4, account_type,
      beneficiaries, created_at, bank_name, dnc, dnc_reason, is_agent, agent_reason,
      card_bin, card_last4, card_brand, card_bank, card_type, policy_type, policy_carrier, policy_coverage, policy_premium
    from leads where id = ${params.id}`;
  if (!l) notFound();
  if (u.role !== 'boss' && (l.assigned_to !== u.id || l.dnc || l.is_agent)) redirect('/leads');

  const [agents, history, deals, links] = await Promise.all([
    u.role === 'boss' ? sql`select id, name from users where active order by name` : Promise.resolve([] as any[]),
    sql`select a.kind, a.detail, a.created_at, u.name from activities a left join users u on u.id = a.user_id
        where a.lead_id = ${params.id} order by a.created_at desc limit 40`,
    sql`select id, client_name, status, monthly_premium from deals where lead_id = ${params.id} order by created_at desc`,
    sql`select s.id, s.wants_ssn, s.wants_bank, s.expires_at, s.verified_at, s.used_at, s.cancelled, s.created_at, u.name as by
        from secure_links s left join users u on u.id = s.created_by where s.lead_id = ${params.id} order by s.created_at desc limit 5`,
  ]);

  return (
    <div className="page narrow">
      <Link href="/leads" className="back">← All leads</Link>
      <LeadForm lead={JSON.parse(JSON.stringify(l))} agents={JSON.parse(JSON.stringify(agents))} isBoss={u.role === 'boss'} isOwner={u.is_owner} links={JSON.parse(JSON.stringify(links))} />
      <div className="two-col">
        <section className="card">
          <h2>Deals</h2>
          {deals.length === 0 ? <p className="quiet">No deal logged for this lead.</p> :
            deals.map((d: any) => <Link key={d.id} className="list-link" href={`/deals/${d.id}`}>{d.client_name} · {d.status}</Link>)}
          <Link className="btn primary" href={`/deals/new?lead=${l.id}`}>Log a deal for this lead</Link>
        </section>
        <section className="card">
          <h2>History</h2>
          {history.length === 0 ? <p className="quiet">Nothing logged yet.</p> : (
            <ul className="history">
              {history.map((h: any, i: number) => (
                <li key={i}><span>{h.kind === 'client_submit' ? <b>Client sent their details through the secure link</b> : <>{h.name ?? 'Someone'} {h.kind === 'dial' ? 'dialed' : h.kind === 'status' ? <>set status to <b>{h.detail}</b></> : 'edited details'}</>}</span><time>{ago(h.created_at)}</time></li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
