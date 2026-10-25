'use server';
import { revalidatePath } from 'next/cache';
import { sql } from '@/lib/db';
import { requireUser } from '@/lib/session';
import { dealFeed, notify } from '@/lib/notify';
import { DEAL_STATUSES, normState } from '@/lib/constants';
import { money, num, parseDate, normPhone } from '@/lib/format';

export async function saveDeal(id: string | null, p: any): Promise<{ id?: string; error?: string }> {
  const u = await requireUser();
  const client_name = String(p.client_name || '').trim();
  if (!client_name) return { error: 'Add the client’s name.' };
  const monthly = num(p.monthly_premium);
  if (monthly === null || monthly <= 0) return { error: 'Add the monthly premium.' };
  const status = DEAL_STATUSES.some((s) => s.v === p.status) ? p.status : 'Submitted';

  let existing: any = null;
  if (id) {
    [existing] = await sql`select * from deals where id = ${id}`;
    if (!existing) return { error: 'Deal not found.' };
    if (u.role !== 'boss' && existing.agent_id !== u.id) return { error: 'You can only edit your own deals.' };
  }
  if (p.lead_id && p.lead_id !== existing?.lead_id) {
    const [lead] = await sql`select assigned_to from leads where id = ${p.lead_id}`;
    if (!lead || (u.role !== 'boss' && lead.assigned_to !== u.id)) return { error: 'That lead isn’t yours.' };
  }
  const agent_id = u.role === 'boss' ? p.agent_id || existing?.agent_id || u.id : existing?.agent_id || u.id;
  const pd = num(p.payment_day);

  const row = {
    client_name,
    lead_id: p.lead_id || existing?.lead_id || null,
    policy_number: p.policy_number?.trim() || null,
    carrier: p.carrier?.trim() || null,
    product: p.product?.trim() || null,
    state: normState(p.state),
    phone: normPhone(p.phone),
    email: p.email?.trim() || null,
    coverage: num(p.coverage),
    monthly_premium: monthly,
    closed_date: parseDate(p.closed_date) ?? new Date().toISOString().slice(0, 10),
    effective_date: parseDate(p.effective_date),
    payment_day: pd && pd >= 1 && pd <= 31 ? pd : null,
    status,
    agent_id,
    writing_agent: p.writing_agent?.trim() || null,
    notes: p.notes?.trim() || null,
  };

  const [agent] = await sql`select name from users where id = ${agent_id}`;
  const ap = money(monthly * 12);

  if (!id) {
    const [d] = await sql`insert into deals ${sql(row)} returning id`;
    if (row.lead_id) await sql`update leads set status = 'Sold', updated_at = now() where id = ${row.lead_id}`;
    await dealFeed(`${agent?.name ?? 'An agent'} closed a deal`, `${client_name} · ${ap}/yr · ${row.carrier ?? ''}`.trim(), `/deals/${d.id}`);
    if (agent_id !== u.id) await notify([agent_id], 'A deal was logged for you', client_name, `/deals/${d.id}`);
    revalidatePath('/deals');
    revalidatePath('/');
    return { id: d.id };
  }

  await sql`update deals set ${sql(row)}, updated_at = now() where id = ${id}`;
  await announceStatus(u.id, id, existing, status, client_name, agent_id);
  revalidatePath('/deals');
  revalidatePath(`/deals/${id}`);
  return { id };
}

async function announceStatus(actorId: string, id: string, existing: any, status: string, client: string, agentId: string) {
  if (existing.status === status) return;
  const title = `${client}: ${existing.status} → ${status}`;
  await dealFeed(title, existing.policy_number ? `Policy ${existing.policy_number}` : '', `/deals/${id}`);
  if (agentId && agentId !== actorId) await notify([agentId], `Status changed to ${status}`, client, `/deals/${id}`);
}

export async function setDealStatus(id: string, status: string) {
  const u = await requireUser();
  if (!DEAL_STATUSES.some((s) => s.v === status)) throw new Error('Unknown status');
  const [d] = await sql`select * from deals where id = ${id}`;
  if (!d) throw new Error('Deal not found');
  if (u.role !== 'boss' && d.agent_id !== u.id) throw new Error('Not your deal');
  await sql`update deals set status = ${status}, updated_at = now() where id = ${id}`;
  await announceStatus(u.id, id, d, status, d.client_name, d.agent_id);
  revalidatePath('/deals');
}

export async function deleteDeal(id: string) {
  const u = await requireUser();
  if (u.role !== 'boss' || !u.is_owner) throw new Error('Only the owner can delete deals');
  await sql`delete from deals where id = ${id}`;
  revalidatePath('/deals');
}
