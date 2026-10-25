'use client';
import { useActionState } from 'react';
import { verify2fa, logout } from '@/app/actions/auth';
import Submit from '@/components/Submit';

export default function TwoFactor() {
  const [s, act] = useActionState(verify2fa, undefined);
  return (
    <main className="auth">
      <div className="auth-card">
        <h1>Enter your code</h1>
        <p className="quiet">Open your authenticator app and type the 6-digit code for this CRM.</p>
        <form action={act} className="stack">
          <input className="code" name="code" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9 ]{6,7}" maxLength={7} required autoFocus aria-label="6-digit code" />
          <label className="check-line"><input type="checkbox" name="remember" defaultChecked /> Remember this device for 30 days</label>
          <p className="quiet small">Untick this on a shared computer. You’ll still need your password every time.</p>
          {s?.error && <p className="note bad" role="alert">{s.error}</p>}
          <Submit>Verify</Submit>
        </form>
        <form action={logout}><button className="link-btn">Use a different account</button></form>
      </div>
    </main>
  );
}
