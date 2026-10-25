import { sql } from '@/lib/db';
import { requireBoss } from '@/lib/session';
import { shortDate } from '@/lib/format';
import ImportClient from './ImportClient';

export const maxDuration = 60;

export default async function ImportPage() {
  await requireBoss();
  const [agents, batches] = await Promise.all([
    sql`select id, name, role from users where active order by role desc, name`,
    sql`select b.name, b.row_count, b.created_at, u.name as by from import_batches b left join users u on u.id = b.created_by order by b.created_at desc limit 10`,
  ]);
  return (
    <div className="page narrow">
      <header className="page-head"><div><h1>Import leads</h1><p className="quiet">Upload a CSV, match its columns, then hand the leads to your agents.</p></div></header>
      <ImportClient agents={JSON.parse(JSON.stringify(agents))} />
      {batches.length > 0 && (
        <section className="card">
          <h2>Recent imports</h2>
          <table className="mini"><tbody>
            {batches.map((b: any, i: number) => <tr key={i}><td>{b.name}</td><td className="r num">{b.row_count} leads</td><td className="quiet">{shortDate(b.created_at)} by {b.by}</td></tr>)}
          </tbody></table>
        </section>
      )}
    </div>
  );
}
