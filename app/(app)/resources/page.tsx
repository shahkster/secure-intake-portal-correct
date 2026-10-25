import { sql } from '@/lib/db';
import { requireUser } from '@/lib/session';
import { seedQuickLinks } from '@/app/actions/resources';
import ResourcesClient from './ResourcesClient';

export default async function Resources() {
  const u = await requireUser();
  await seedQuickLinks();
  const links = await sql`select id, title, subtitle, url from quick_links order by sort, created_at`;
  const visible = u.role === 'boss' ? links : links.filter((l: any) => l.url);
  return (
    <div className="page">
      <header className="page-head"><div><h1>Resources</h1><p className="quiet">Carrier numbers, scripts, what to write, and where to log in.</p></div></header>
      <ResourcesClient links={JSON.parse(JSON.stringify(visible))} isBoss={u.role === 'boss'} />
    </div>
  );
}
