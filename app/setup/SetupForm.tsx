'use client';
import { useActionState } from 'react';
import { bootstrap } from '@/app/actions/auth';
import Submit from '@/components/Submit';
export default function SetupForm() {
  const [s, act] = useActionState(bootstrap, undefined);
  return (
    <form action={act} className="stack">
      <label className="field"><span>Setup key (SETUP_KEY from Vercel)</span><input name="key" type="password" required /></label>
      <label className="field"><span>Your name</span><input name="name" required /></label>
      <label className="field"><span>Email</span><input name="email" type="email" required /></label>
      <label className="field"><span>Password (10+ characters)</span><input name="password" type="password" minLength={10} required autoComplete="new-password" /></label>
      {s?.error && <p className="note bad" role="alert">{s.error}</p>}
      <Submit>Create boss account</Submit>
    </form>
  );
}
