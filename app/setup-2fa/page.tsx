import { redirect } from 'next/navigation';
import { authenticator } from 'otplib';
import QRCode from 'qrcode';
import { sql } from '@/lib/db';
import { readSession } from '@/lib/session';
import { decrypt, encrypt } from '@/lib/crypto';
import ConfirmForm from './ConfirmForm';
import { BRAND } from '@/lib/brand';

export const dynamic = 'force-dynamic';

export default async function Setup2fa() {
  const s = await readSession();
  if (!s || s.stage !== 'setup') redirect('/login');
  const [u] = await sql`select email, totp_secret, totp_enabled from users where id = ${s.uid} and active`;
  if (!u) redirect('/login');
  let secret = u.totp_secret ? decrypt(u.totp_secret) : '';
  if (!secret) {
    secret = authenticator.generateSecret();
    await sql`update users set totp_secret = ${encrypt(secret)} where id = ${s.uid}`;
  }
  const uri = authenticator.keyuri(u.email, process.env.APP_NAME || BRAND, secret);
  const qr = await QRCode.toDataURL(uri, { margin: 1, width: 220 });
  return (
    <main className="auth">
      <div className="auth-card">
        <h1>Set up two-step verification</h1>
        <ol className="steps">
          <li>Install Google Authenticator on your phone (App Store or Google Play).</li>
          <li>In Google Authenticator, tap + then Scan a QR code, and scan this.</li>
          <li>Type the 6-digit code it shows.</li>
        </ol>
        <img className="qr" src={qr} alt="QR code for your authenticator app" width={220} height={220} />
        <details className="manual"><summary>Can’t scan? Enter this key instead</summary><code>{secret.match(/.{1,4}/g)?.join(' ')}</code></details>
        <ConfirmForm />
      </div>
    </main>
  );
}
