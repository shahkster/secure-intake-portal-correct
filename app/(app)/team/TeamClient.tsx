'use client';
import Link from 'next/link';
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { createUser, reset2fa, resetPassword, setActive, setRole } from '@/app/actions/team';
import { ago } from '@/lib/format';

export default function TeamClient({ users, meId, isOwner }: any) {
  const router = useRouter();
  const [f, setF] = useState({ name: '', email: '', role: 'agent' });
  const [cred, setCred] = useState<{ who: string; email?: string; password: string } | null>(null);
  const [err, setErr] = useState('');
  const [busy, start] = useTransition();

  return (
    <>
      <section className="card">
        <h2>Add a person</h2>
        <div className="form-grid">
          <label className="field"><span>Full name</span><input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></label>
          <label className="field"><span>Email (their username)</span><input type="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} /></label>
          <label className="field"><span>Role</span>
            <select value={f.role} onChange={(e) => setF({ ...f, role: e.target.value })}>
              <option value="agent">Agent: sees only their own leads and deals</option>
              {isOwner && <option value="boss">Boss: sees all leads, splits leads, manages agents</option>}
            </select>
          </label>
        </div>
        {err && <p className="note bad">{err}</p>}
        <button className="btn primary" disabled={busy} onClick={() => start(async () => {
          setErr('');
          const r = await createUser(f);
          if (r.error) return setErr(r.error);
          setCred({ who: f.name, email: f.email, password: r.password! });
          setF({ name: '', email: '', role: 'agent' });
          router.refresh();
        })}>Create account</button>
      </section>

      {cred && (
        <section className="card cred">
          <h2>Send these to {cred.who}</h2>
          <p className="quiet small">This password shows once. They’ll change it and set up 2FA when they first sign in.</p>
          <pre>{`${cred.email ? `Email: ${cred.email}\n` : ''}Temporary password: ${cred.password}\nSign in: ${typeof window !== 'undefined' ? window.location.origin : ''}/login`}</pre>
          <div className="row gap">
            <button className="btn" onClick={() => navigator.clipboard.writeText(`${cred.email ? `Email: ${cred.email}\n` : ''}Temporary password: ${cred.password}\nSign in: ${window.location.origin}/login`)}>Copy</button>
            <button className="link-btn" onClick={() => setCred(null)}>Done</button>
          </div>
        </section>
      )}

      <section className="card">
        <h2>People</h2>
        <div className="people">
          {users.map((u: any) => (
            <div key={u.id} className={`person ${u.active ? '' : 'off'}`}>
              <Link className="who person-link" href={`/team/${u.id}`} title={`See ${u.name}’s calls`}>
                <b>{u.name}{u.id === meId && ' (you)'}</b>
                <span className="quiet small">{u.email}</span>
                <span className="small">
                  {u.is_owner ? <b className="owner-tag">Owner</b> : u.role === 'boss' ? 'Boss' : 'Agent'} · {u.leads} leads · active {ago(u.last_active)}
                  {!u.totp_enabled && <span className="warn"> · 2FA not set up yet</span>}
                  {!u.active && <span className="bad-text"> · Deactivated</span>}
                </span>
                {(isOwner || u.role === 'agent' || u.id === meId) && <span className="see">See calls and results →</span>}
              </Link>
              {u.id !== meId && !u.is_owner && (isOwner || u.role === 'agent') && (
                <div className="row gap wrap">
                  <button className="btn sm" onClick={() => confirm(`Give ${u.name} a new temporary password? They’ll be signed out.`) && start(async () => { const r = await resetPassword(u.id); if (r.error) return setErr(r.error); setCred({ who: u.name, email: u.email, password: r.password! }); router.refresh(); })}>Reset password</button>
                  <button className="btn sm" onClick={() => confirm(`Make ${u.name} set up 2FA again on next sign-in? Use this if they lost their phone.`) && start(async () => { const r = await reset2fa(u.id); if (r.error) setErr(r.error); router.refresh(); })}>Reset 2FA</button>
                  {isOwner && u.active && <button className="btn sm" onClick={() => confirm(u.role === 'boss' ? `Make ${u.name} an agent? They’ll only see their own leads.` : `Make ${u.name} a boss? They’ll see all leads and manage agents.`) && start(async () => { const r = await setRole(u.id, u.role === 'boss' ? 'agent' : 'boss'); if (r.error) setErr(r.error); router.refresh(); })}>{u.role === 'boss' ? 'Make agent' : 'Make boss'}</button>}
                  <button className={`btn sm ${u.active ? 'danger' : ''}`} onClick={() => start(async () => { const r = await setActive(u.id, !u.active); if (r.error) setErr(r.error); router.refresh(); })}>{u.active ? 'Deactivate' : 'Reactivate'}</button>
                </div>
              )}
            </div>
          ))}
        </div>
      </section>
    </>
  );
}
