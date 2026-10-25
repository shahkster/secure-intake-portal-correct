import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { sql } from '@/lib/db';
import { requireUser } from '@/lib/session';
import { DEAL_STATUSES, toneOf } from '@/lib/constants';
import Pill from '@/components/Pill';
import DealForm from '../DealForm';

export default async function DealPage(props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const u = await requireUser();
  if (!/^[0-9a-f-]{36}$/i.test(params.id)) notFound();
  const [d] = await sql`select id, lead_id, client_name, policy_number, carrier, product, state, phone, email, coverage, monthly_premium,
      to_char(closed_date, 'YYYY-MM-DD') as closed_date, to_char(effective_date, 'YYYY-MM-DD') as effective_date,
      payment_day, status, agent_id, writing_agent, notes from deals where id = ${params.id}`;
  if (!d) notFound();
  if (u.role !== 'boss' && d.agent_id !== u.id) redirect('/deals');
  const agents = u.role === 'boss' ? await sql`select id, name from users where active order by name` : [];
  return (
    <div className="page narrow">
      <Link href="/deals" className="back">← All deals</Link>
      <header className="page-head">
        <div><h1>{d.client_name}</h1><p className="quiet">{d.policy_number ? `Policy ${d.policy_number}` : 'No policy number yet'} {d.carrier && `· ${d.carrier}`}</p></div>
        <div className="row gap"><Pill tone={toneOf(DEAL_STATUSES, d.status)}>{d.status}</Pill>{d.lead_id && <Link className="btn" href={`/leads/${d.lead_id}`}>Open lead</Link>}</div>
      </header>
      <DealForm deal={JSON.parse(JSON.stringify(d))} agents={JSON.parse(JSON.stringify(agents))} isBoss={u.role === 'boss'} isOwner={u.is_owner} meId={u.id} />
    </div>
  );
}
