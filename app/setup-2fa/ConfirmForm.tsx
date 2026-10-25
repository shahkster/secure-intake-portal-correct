'use client';
import { useActionState } from 'react';
import { confirm2faSetup } from '@/app/actions/auth';
import Submit from '@/components/Submit';
export default function ConfirmForm() {
  const [s, act] = useActionState(confirm2faSetup, undefined);
  return (
    <form action={act} className="stack">
      <label className="field"><span>Code from the app</span>
        <input className="code" name="code" inputMode="numeric" autoComplete="one-time-code" maxLength={7} required />
      </label>
      {s?.error && <p className="note bad" role="alert">{s.error}</p>}
      <Submit>Turn on two-step verification</Submit>
    </form>
  );
}
