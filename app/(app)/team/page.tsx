import { sql } from '@/lib/db';
import { requireBoss } from '@/lib/session';
import TeamClient from './TeamClient';

export default async function Team() {
  const me = await requireBoss();
  const users = await sql`select u.id, u.name, u.email, u.role, u.is_owner, u.active, u.totp_enabled, u.must_change_password, u.created_at,
      (select count(*)::int from leads l where l.assigned_to = u.id) as leads,
      (select max(created_at) from activities a where a.user_id = u.id) as last_active
    from users u order by u.is_owner desc, u.active desc, u.role desc, u.name`;
  return (
    <div className="page narrow">
      <header className="page-head"><div><h1>Team</h1><p className="quiet">{me.is_owner ? 'You’re the owner: you manage everyone, including other bosses.' : 'You can add and manage agents. Only the owner can manage bosses.'} Everyone sets up two-step verification on first sign-in.</p></div></header>
      <TeamClient users={JSON.parse(JSON.stringify(users))} meId={me.id} isOwner={me.is_owner} />
    </div>
  );
}
