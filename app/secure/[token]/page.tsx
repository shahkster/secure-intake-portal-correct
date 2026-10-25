import crypto from 'crypto';
import type { Metadata } from 'next';
import { sql } from '@/lib/db';
import { ensureSchema } from '@/lib/ensure';
import ClientForm from './ClientForm';

export const dynamic = 'force-dynamic';

// Neutral on purpose: nothing here names the company or links back to the CRM.
export const metadata: Metadata = {
  title: 'Secure Client Form',
  description: 'Your private, encrypted form to finish your application.',
  robots: { index: false, follow: false },
  icons: { icon: '/client-icon.png', apple: '/client-touch.png' },
  openGraph: { title: 'Secure Client Form', description: 'Your private, encrypted form to finish your application.', images: ['/client-icon.png'] },
};

export default async function SecurePage(props: { params: Promise<{ token: string }> }) {
  const { token } = await props.params;
  await ensureSchema();
  const h = crypto.createHash('sha256').update(token).digest('hex');
  const [s] = await sql`select s.greet_name, s.wants_ssn, s.wants_bank, s.expires_at, s.used_at, s.cancelled, u.name as agent
    from secure_links s left join users u on u.id = s.created_by where s.token_hash = ${h}`;
  const dead = !s || s.cancelled || s.used_at || new Date(s.expires_at) < new Date();
  return (
    <main className="client-page">
      <div className="client-card">
        <header className="client-brand">
          <span className="client-lock" aria-hidden="true">🔒</span>
          <span>Secure Client Form</span>
        </header>
        {dead ? (
          <div className="client-body">
            <h1>{s?.used_at ? 'All done' : 'This link isn’t active'}</h1>
            <p className="quiet">{s?.used_at ? 'Your information was already received. Thank you — you can close this page.' : 'It expired or was replaced by a newer link. Ask your agent to send a new one.'}</p>
          </div>
        ) : (
          <ClientForm token={token} greet={s.greet_name} agent={s.agent ? String(s.agent).split(' ')[0] : null} wantsSsn={s.wants_ssn} wantsBank={s.wants_bank} />
        )}
        <footer className="client-foot">Encrypted connection · Your information goes only to your agent</footer>
      </div>
    </main>
  );
}
