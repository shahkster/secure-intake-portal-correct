import { sql } from './db';

export const REGISTRY_REASON = 'On the National Do Not Call Registry';
export const INTERNAL_REASON = 'Asked not to be called';
export const FREEDNC_REASON = 'On the DNC list (FreeDNCList check)';

// Email domains that belong to insurers. Matching leads are hidden from agents until the boss clears them.
const CARRIER_DOMAINS = [
  'statefarm.com', 'allstate.com', 'nm.com', 'newyorklife.com', 'massmutual.com', 'metlife.com', 'prudential.com',
  'transamerica.com', 'mutualofomaha.com', 'primerica.com', 'aflac.com', 'farmersagent.com', 'farmers.com', 'amfam.com',
  'nationwide.com', 'libertymutual.com', 'lfg.com', 'johnhancock.com', 'pacificlife.com', 'protective.com',
  'foresters.com', 'americo.com', 'familyfirstlife.com', 'kemper.com', 'colonialpenn.com', 'americanamicable.com',
];
const DOMAIN_WORDS = '(insur|assuran|annuit)';

/** Flags leads on the DNC list or that look like insurance agents. Scope to a batch or a few leads, or run on all. */
export async function runFlags(scope: { leadIds?: string[]; batchId?: string } = {}) {
  if (scope.leadIds && !scope.leadIds.length) return { dnc: 0, agents: 0 };
  const where = scope.leadIds ? sql`l.id in ${sql(scope.leadIds)}`
    : scope.batchId ? sql`l.batch_id = ${scope.batchId}` : sql`true`;

  const dnc = await sql`update leads l set dnc = true,
      dnc_reason = case when d.source = 'internal' then ${INTERNAL_REASON}
                        when d.source = 'freednclist' then ${FREEDNC_REASON} else ${REGISTRY_REASON} end
    from dnc_numbers d
    where d.phone = l.phone_num and not l.dnc and not l.dnc_cleared and ${where}
    returning l.id`;

  // Matches your agent list by main phone, any other phone, email, name (ignores middle names and Jr/Sr;
  // limited to the same state when the list entry has one) and street address + ZIP.
  const listed = await sql`update leads l set is_agent = true,
      agent_reason = 'Matches a known agent by ' || m.how
    from (
      select distinct on (l.id) l.id, case w.kind
          when 'phone' then 'phone number' when 'email' then 'email' when 'address' then 'home address'
          else 'name' || case when w.state is not null then ' in ' || w.state else '' end end
          || coalesce(' (' || nullif(w.note, '') || ')', '') as how
      from leads l join agent_watchlist w on (
        (w.kind = 'phone' and (w.value = l.phone_num::text or (l.alt_phones is not null and exists (
          select 1 from regexp_split_to_table(l.alt_phones, '[,;/|]') x
          where right(regexp_replace(x, '[^0-9]', '', 'g'), 10) = w.value)))) or
        (w.kind = 'email' and w.value = lower(trim(l.email))) or
        (w.kind = 'name' and w.value = l.name_key and (w.state is null or w.state = l.state)) or
        (w.kind = 'address' and w.value = l.addr_key))
      where not l.is_agent and not l.agent_cleared and ${where}
      order by l.id, case w.kind when 'phone' then 1 when 'email' then 2 when 'address' then 3 else 4 end
    ) m
    where l.id = m.id
    returning l.id`;

  const domain = await sql`update leads l set is_agent = true,
      agent_reason = 'Email is at an insurance company (' || split_part(lower(l.email), '@', 2) || ')'
    where not l.is_agent and not l.agent_cleared and ${where} and l.email like '%@%' and (
      split_part(lower(l.email), '@', 2) ~ ${DOMAIN_WORDS} or split_part(lower(l.email), '@', 2) in ${sql(CARRIER_DOMAINS)})
    returning l.id`;

  return { dnc: dnc.length, agents: listed.length + domain.length };
}

/** Puts a lead's phone on the company's own do-not-call list (required when someone asks not to be called). */
export async function addInternalDnc(leadId: string) {
  await sql`insert into dnc_numbers (phone, source)
    select phone_num, 'internal' from leads where id = ${leadId} and phone_num is not null
    on conflict (phone) do update set source = 'internal'`;
  await sql`update leads set dnc = true, dnc_cleared = false, dnc_reason = ${INTERNAL_REASON} where id = ${leadId}`;
}

/** SQL fragment: leads an agent is allowed to see. */
export const visibleToAgents = () => sql`not l.dnc and not l.is_agent`;


/** Save the outcome of a FreeDNCList check. Only phone numbers come in — nothing else from their file. */
export async function applyDncResults(rows: { phone: string; onList: boolean }[]) {
  const on = Array.from(new Set(rows.filter((r) => r.onList).map((r) => r.phone)));
  const off = Array.from(new Set(rows.filter((r) => !r.onList).map((r) => r.phone)));
  let flagged = 0;
  if (on.length) {
    await sql`insert into dnc_numbers (phone, source)
      select x::bigint, 'freednclist' from unnest(${sql.array(on)}::text[]) as x on conflict (phone) do nothing`;
    const f = await sql`update leads set dnc = true, dnc_reason = ${FREEDNC_REASON}, dnc_checked_at = now()
      where phone_num in (select x::bigint from unnest(${sql.array(on)}::text[]) as x) and not dnc and not dnc_cleared returning id`;
    flagged = f.length;
    await sql`update leads set dnc_checked_at = now() where phone_num in (select x::bigint from unnest(${sql.array(on)}::text[]) as x)`;
  }
  if (off.length) {
    // A clean result undoes an earlier FreeDNCList match, but never your internal list or the official registry.
    await sql`delete from dnc_numbers where source = 'freednclist'
      and phone in (select x::bigint from unnest(${sql.array(off)}::text[]) as x)`;
    await sql`update leads set dnc = false, dnc_reason = null where dnc and dnc_reason = ${FREEDNC_REASON}
      and phone_num in (select x::bigint from unnest(${sql.array(off)}::text[]) as x)
      and not exists (select 1 from dnc_numbers d where d.phone = leads.phone_num)`;
    await sql`update leads set dnc_checked_at = now() where phone_num in (select x::bigint from unnest(${sql.array(off)}::text[]) as x)`;
  }
  return { flagged, clean: off.length };
}
