import Link from 'next/link';
import { sql } from '@/lib/db';
import SetupForm from './SetupForm';
export const dynamic = 'force-dynamic';
export default async function Setup() {
  let done = false;
  try {
    const [{ n }] = await sql`select count(*)::int as n from users where role = 'boss'`;
    done = n > 0;
  } catch { /* tables don't exist yet */ }
  return (
    <main className="auth">
      <div className="auth-card">
        <h1>First-time setup</h1>
        {done ? (
          <><p className="quiet">This CRM is already set up.</p><Link className="btn primary" href="/login">Go to sign in</Link></>
        ) : (
          <><p className="quiet">Creates the database tables and your boss account. This page locks itself once a boss exists.</p><SetupForm /></>
        )}
      </div>
    </main>
  );
}
