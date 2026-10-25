'use client';
import { useActionState } from 'react';
import { login } from '@/app/actions/auth';
import Submit from '@/components/Submit';

export default function LoginForm({ ready }: { ready: boolean }) {
  const [s, act] = useActionState(login, undefined);
  return (
    <form action={act} className="stack">
      {ready && <p className="note good">Your boss account is ready. Sign in to set up two-step verification.</p>}
      <label className="field"><span>Email</span><input name="email" type="email" autoComplete="username" required autoFocus /></label>
      <label className="field"><span>Password</span><input name="password" type="password" autoComplete="current-password" required /></label>
      {s?.error && <p className="note bad" role="alert">{s.error}</p>}
      <Submit>Sign in</Submit>
    </form>
  );
}
