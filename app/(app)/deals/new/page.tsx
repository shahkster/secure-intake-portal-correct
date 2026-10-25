import Link from 'next/link';
import { sql } from '@/lib/db';
import { requireUser } from '@/lib/session';
import DealForm from '../DealForm';

export default async function NewDeal(props: { searchParams: Promise<{ lead?: string }> }) {
  const searchParams = await props.searchParams;
  const u = await requireUser();
  let prefill: any = {};
  if (searchParams.lead && /^[0-9a-f-]{36}$/i.test(searchParams.lead)) {
    const [l] = await sql`select id, first_name, middle, last_name, phone, email, state, quoted_premium, desired_coverage, assigned_to from leads where id = ${searchParams.lead}`;
    if (l && (u.role === 'boss' || l.assigned_to === u.id)) {
      prefill = {
        lead_id: l.id,
        client_name: [l.last_name, [l.first_name, l.middle].filter(Boolean).join(' ')].filter(Boolean).join(', '),
        phone: l.phone, email: l.email, state: l.state,
        monthly_premium: l.quoted_premium ?? '', coverage: l.desired_coverage ?? '',
      };
    }
  }
  const agents = u.role === 'boss' ? await sql`select id, name from users where active order by name` : [];
  return (
    <div className="page narrow">
      <Link href="/deals" className="back">← All deals</Link>
      <header className="page-head"><h1>Log a deal</h1></header>
      <DealForm deal={JSON.parse(JSON.stringify(prefill))} agents={JSON.parse(JSON.stringify(agents))} isBoss={u.role === 'boss'} isOwner={u.is_owner} meId={u.id} />
    </div>
  );
}
