'use client';
import { useActionState } from 'react';
import { changePassword } from '@/app/actions/account';
import Submit from '@/components/Submit';
export default function PasswordForm() {
  const [s, act] = useActionState(changePassword, undefined);
  return (
    <form action={act} className="stack narrow-form">
      <label className="field"><span>Current password</span><input name="current" type="password" autoComplete="current-password" required /></label>
      <label className="field"><span>New password (10+ characters)</span><input name="next" type="password" autoComplete="new-password" minLength={10} required /></label>
      <label className="field"><span>Confirm new password</span><input name="confirm" type="password" autoComplete="new-password" required /></label>
      {s?.error && <p className="note bad" role="alert">{s.error}</p>}
      {s?.ok && <p className="note good">Password changed. Other devices were signed out.</p>}
      <Submit>Save password</Submit>
    </form>
  );
}
