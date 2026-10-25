'use client';
import { useEffect, useState, useTransition } from 'react';
import { clientOpen, clientRouting, clientSubmit } from '@/app/actions/secure';

const CHECKS = ['Connecting securely', 'Verifying your link', 'Encrypting your session', 'Preparing your form'];
const STEP_MS = 950; // about 4 seconds in total

function Secret({ label, value, onChange, max, hint }: any) {
  const [show, setShow] = useState(false);
  return (
    <label className="field">
      <span>{label}</span>
      <div className="secret">
        <input type={show ? 'text' : 'password'} inputMode="numeric" autoComplete="off" maxLength={max}
          value={value} onChange={(e) => onChange(e.target.value.replace(/\D/g, '').slice(0, max))} />
        <button type="button" className="eye" onClick={() => setShow(!show)} aria-label={show ? 'Hide' : 'Show'}>{show ? 'Hide' : 'Show'}</button>
      </div>
      {hint && <small className="quiet">{hint}</small>}
    </label>
  );
}

export default function ClientForm({ token, greet, agent, wantsSsn, wantsBank }: any) {
  const [step, setStep] = useState<'check' | 'form' | 'done' | 'dead'>('check');
  const [done, setDone] = useState(0);
  const [err, setErr] = useState('');
  const [f, setF] = useState({ ssn: '', routing: '', account: '', account2: '', account_type: 'Checking' });
  const [bank, setBank] = useState<any>(null);
  const [busy, start] = useTransition();
  const name = greet ? `, ${greet}` : '';

  // The security check: really opens the link while the checklist plays.
  useEffect(() => {
    let alive = true;
    const opened = clientOpen(token);
    (async () => {
      for (let i = 1; i <= CHECKS.length; i++) {
        await new Promise((r) => setTimeout(r, STEP_MS));
        if (i === 2) { const r = await opened; if (!alive) return; if (r.error) { setErr(r.error); setStep('dead'); return; } }
        if (alive) setDone(i);
      }
      await new Promise((r) => setTimeout(r, 450));
      if (alive) setStep('form');
    })();
    return () => { alive = false; };
  }, [token]);

  if (step === 'dead') return (
    <div className="client-body">
      <h1>This link isn’t active</h1>
      <p className="quiet">{err}</p>
    </div>
  );

  if (step === 'done') return (
    <div className="client-body center">
      <div className="big-check" aria-hidden="true">✓</div>
      <h1>Thank you{name}</h1>
      <p className="quiet">Your information was sent securely to {agent || 'your agent'}. You can close this page.</p>
    </div>
  );

  if (step === 'check') return (
    <div className="client-body">
      <h1>Hi{name} 👋</h1>
      <p className="quiet">{agent ? `${agent} sent` : 'Your agent sent'} you this private form so you don’t have to read sensitive numbers over the phone. One moment while we secure your session.</p>
      <ul className="checks" aria-live="polite">
        {CHECKS.map((c, i) => (
          <li key={c} className={i < done ? 'ok' : i === done ? 'run' : ''}>
            <span className="ck" aria-hidden="true">{i < done ? '✓' : ''}</span>
            <span>{c}{i < done ? '' : i === done ? '…' : ''}</span>
          </li>
        ))}
      </ul>
      <div className="check-bar"><div style={{ width: `${(done / CHECKS.length) * 100}%` }} /></div>
    </div>
  );

  const ssnOk = !wantsSsn || f.ssn.length === 9;
  const bankOk = !wantsBank || (f.routing.length === 9 && bank?.valid && f.account.length >= 4 && f.account === f.account2);

  return (
    <div className="client-body">
      <div className="verified-pill">✓ Secure session verified</div>
      <h1>Enter your details</h1>
      <p className="quiet">Numbers stay hidden as you type. Tap Show to double-check them.</p>
      <form className="stack" onSubmit={(e) => { e.preventDefault(); setErr(''); start(async () => { const r = await clientSubmit(token, f); r.error ? setErr(r.error) : setStep('done'); }); }}>
        {wantsSsn && <Secret label="Social Security number" value={f.ssn} max={9} onChange={(v: string) => setF({ ...f, ssn: v })} hint={`${f.ssn.length} of 9 digits`} />}
        {wantsBank && (
          <>
            <label className="field">
              <span>Routing number</span>
              <input inputMode="numeric" maxLength={9} value={f.routing} onChange={(e) => {
                const v = e.target.value.replace(/\D/g, '').slice(0, 9);
                setF({ ...f, routing: v }); setBank(null);
                if (v.length === 9) clientRouting(token, v).then(setBank);
              }} />
              {bank && <small className={bank.valid ? 'good-text' : 'bad-text'}>{bank.bank ? `${bank.bank}${bank.city ? `, ${bank.city}` : ''}${bank.state ? `, ${bank.state}` : ''}` : bank.note}</small>}
              <small className="quiet">The first 9 digits at the bottom left of a check.</small>
            </label>
            <Secret label="Account number" value={f.account} max={17} onChange={(v: string) => setF({ ...f, account: v })} />
            <Secret label="Type the account number again" value={f.account2} max={17} onChange={(v: string) => setF({ ...f, account2: v })}
              hint={f.account2 && f.account !== f.account2 ? 'These don’t match yet.' : ''} />
            <div className="seg">
              {['Checking', 'Savings'].map((t) => <button type="button" key={t} className={f.account_type === t ? 'on' : ''} onClick={() => setF({ ...f, account_type: t })}>{t}</button>)}
            </div>
          </>
        )}
        {err && <p className="note bad" role="alert">{err}</p>}
        <button className="btn primary big" disabled={busy || !ssnOk || !bankOk}>{busy ? 'Sending securely…' : 'Send securely'}</button>
      </form>
    </div>
  );
}
