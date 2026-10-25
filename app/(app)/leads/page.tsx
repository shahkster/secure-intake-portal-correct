import { sql } from '@/lib/db';
import { requireUser } from '@/lib/session';
import LeadsTable from './LeadsTable';
import { DEFAULT_DIR } from '@/lib/sorts';

const PER_PAGE = [25, 50, 100, 250, 500, 1000];

export default async function Leads(props: { searchParams: Promise<Record<string, string>> }) {
  const searchParams = await props.searchParams;
  const u = await requireUser();
  const boss = u.role === 'boss';
  const { q = '', state = '', status = '', agent = '', sort = 'touch', dir = '', view = '' } = searchParams;
  const flaggedView = boss && view === 'flagged';
  const mineView = boss && !flaggedView && view === 'mine'; // a boss's personal leads
  const page = Math.max(1, Number(searchParams.page) || 1);
  const PAGE = PER_PAGE.includes(Number(searchParams.per)) ? Number(searchParams.per) : 100;

  let where = flaggedView ? sql`(l.dnc or l.is_agent)` : sql`not l.dnc and not l.is_agent`;
  // Several people can be picked at once: ?agent=id1,id2,none
  const picked = agent.split(',').filter((a) => a === 'none' || /^[0-9a-f-]{36}$/i.test(a)).slice(0, 50);
  if (!boss || mineView) where = sql`${where} and l.assigned_to = ${u.id}`;
  else if (picked.length) {
    const ids = picked.filter((a) => a !== 'none');
    where = picked.includes('none')
      ? (ids.length ? sql`${where} and (l.assigned_to is null or l.assigned_to in ${sql(ids)})` : sql`${where} and l.assigned_to is null`)
      : sql`${where} and l.assigned_to in ${sql(ids)}`;
  }
  if (state) where = sql`${where} and l.state = ${state}`;
  if (status) where = sql`${where} and l.status = ${status}`;
  if (q.trim()) {
    const like = `%${q.trim()}%`;
    const digits = q.replace(/\D/g, '');
    where = digits.length >= 3
      ? sql`${where} and (concat_ws(' ', l.first_name, l.last_name) ilike ${like} or regexp_replace(coalesce(l.phone,''), '\\D', '', 'g') like ${'%' + digits + '%'})`
      : sql`${where} and (concat_ws(' ', l.first_name, l.middle, l.last_name) ilike ${like} or l.email ilike ${like} or concat_ws(' ', l.address, l.city, l.zip) ilike ${like})`;
  }
  // Sort by any column, either way. Old links (recent / untouched) still work.
  const SORTS: Record<string, any> = {
    touch: sql`coalesce(l.last_touch, l.created_at)`, added: sql`l.created_at`,
    name: sql`lower(concat_ws(' ', l.last_name, l.first_name))`, status: sql`l.status`, state: sql`l.state`,
    age: sql`l.dob`, coverage: sql`l.desired_coverage`, amount: sql`l.quoted_premium`,
    attempts: sql`l.attempts`, callback: sql`l.callback_at`, agent: sql`lower(u.name)`,
  };
  const legacy: Record<string, [string, string]> = { recent: ['touch', 'desc'], untouched: ['touch', 'asc'] };
  const [sKey, sDirRaw] = legacy[sort] || [SORTS[sort] ? sort : 'touch', dir];
  const sDir = sDirRaw === 'asc' || sDirRaw === 'desc' ? sDirRaw : DEFAULT_DIR[sKey] || 'desc';
  // Age runs the other way from date of birth: oldest person = earliest birthday.
  const sqlDir = (sKey === 'age' ? sDir === 'desc' : sDir === 'asc') ? sql`asc` : sql`desc`;
  const order = sql`${SORTS[sKey]} ${sqlDir} nulls last, l.created_at desc, l.id`;

  const [rows, [{ n }], agents] = await Promise.all([
    sql`select l.id, l.first_name, l.last_name, l.phone, l.state, l.zip, l.city, l.address, l.dnc, l.is_agent, l.dnc_reason, l.agent_reason, to_char(l.dob, 'YYYY-MM-DD') as dob, l.gender,
          l.status, l.attempts, l.last_touch, l.callback_at, l.desired_coverage, l.quoted_premium, l.assigned_to,
          u.name as agent_name
        from leads l left join users u on u.id = l.assigned_to
        where ${where} order by ${order} limit ${PAGE} offset ${(page - 1) * PAGE}`,
    sql`select count(*)::int as n from leads l where ${where}`,
    boss ? sql`select id, name from users where active order by name` : Promise.resolve([] as any[]),
  ]);
  const [{ flagged, mine, master }] = boss ? await sql`select count(*) filter (where dnc or is_agent)::int as flagged,
      count(*) filter (where not dnc and not is_agent and assigned_to = ${u.id})::int as mine,
      count(*) filter (where not dnc and not is_agent)::int as master from leads` : [{ flagged: 0, mine: 0, master: 0 }];

  return (
    <div className="page">
      <LeadsTable leads={JSON.parse(JSON.stringify(rows))} agents={JSON.parse(JSON.stringify(agents))} isBoss={boss} isOwner={u.is_owner} meId={u.id} total={n} page={page} pageSize={PAGE} flagged={flagged} flaggedView={flaggedView} mineView={mineView} counts={{ mine, master }} />
    </div>
  );
}
