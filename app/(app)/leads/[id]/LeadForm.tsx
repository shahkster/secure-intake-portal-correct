'use client';
import { useEffect, useMemo, useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { LEAD_STATUSES, STATES, toneOf } from '@/lib/constants';
import { localTime, tzFor, tzAbbr, wallToDate, dateToWall, timeIn } from '@/lib/tz';
import { age } from '@/lib/format';
import { bmi } from '@/lib/bmi';
import { checkRouting, revealSensitive, saveLead } from '@/app/actions/leads';
import { clearFlag, markAsAgent } from '@/app/actions/compliance';
import { cancelSecureLink, createSecureLink } from '@/app/actions/secure';
import Icon from '@/components/Icon';
import CopyBtn from '@/components/CopyBtn';
import WeatherChip from '@/components/WeatherChip';
import CallLink from '@/components/CallLink';
import { checkBin } from '@/app/actions/resources';
import { brandFromBin, luhn } from '@/lib/card';
import { splitAddress } from '@/lib/address';
import StatePicker from '@/components/StatePicker';
import DateInput from '@/components/DateInput';
import { POLICY_TYPES } from '@/lib/constants';
import { placeCall, useDialPrefs } from '@/lib/dial';
import { logDial, setCallback, setLeadStatus } from '@/app/actions/leads';
import Shortcuts, { STATUS_KEYS } from '@/components/Shortcuts';
import CallbackPicker from '@/components/CallbackPicker';

const localTz = () => Intl.DateTimeFormat().resolvedOptions().timeZone;

export default function LeadForm({ lead, agents, isBoss, isOwner, links }: any) {
  const router = useRouter();
  const [f, setF] = useState<any>({ ...lead, ssn: '', account: '' });
  const [benes, setBenes] = useState<any[]>(lead.beneficiaries || []);
  const [msg, setMsg] = useState<{ ok?: string; err?: string }>({});
  const [revealed, setRevealed] = useState<{ ssn: string; account: string } | null>(null);
  const [dirty, setDirty] = useState(false);
  const [saving, start] = useTransition();
  const [now, setNow] = useState<Date | null>(null);
  const [bank, setBank] = useState<any>(lead.bank_name ? { valid: true, saved: lead.bank_name } : null);
  const [showKeys, setShowKeys] = useState(false);
  const [cbOpen, setCbOpen] = useState(false);
  const [attempts, setAttempts] = useState<number>(lead.attempts || 0);
  const [toast, setToast] = useState('');
  const prefs = useDialPrefs();
  useEffect(() => { if (!toast) return; const t = setTimeout(() => setToast(''), 3500); return () => clearTimeout(t); }, [toast]);

  /** Same number keys as the leads list, applied to this lead right away. */
  function quickStatus(status: string) {
    if (status === 'Callback') { setCbOpen(true); return; }
    if (status === 'Sold') { router.push(`/deals/new?lead=${lead.id}`); return; }
    if (status === 'Do Not Call' && !confirm('Put this person on your Do Not Call list? They’ll be removed for good.')) return;
    const n = attempts + (status === 'No Answer' ? 1 : 0);
    setAttempts(n);
    setF((x: any) => ({ ...x, status }));
    start(async () => {
      await setLeadStatus(lead.id, status);
      if (status === 'Do Not Call' && !isBoss) { router.push('/leads'); return; }
      router.refresh();
    });
    setToast(status === 'No Answer' ? `No answer (${n}${['th', 'st', 'nd', 'rd'][n % 100 > 10 && n % 100 < 14 ? 0 : n % 10 < 4 ? n % 10 : 0]} try)` : `Marked ${status}`);
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (e.metaKey || e.ctrlKey || e.altKey || cbOpen || showKeys) return;
      if (t && (['INPUT', 'TEXTAREA', 'SELECT'].includes(t.tagName) || t.isContentEditable)) return;
      if (e.key === '?') { setShowKeys(true); return; }
      if (e.key === 'Escape') { router.push('/leads'); return; }
      if ((e.key === 'c' || e.key === 'C') && !lead.dnc && f.phone) { if (placeCall(f.phone, prefs)) logDial(lead.id).catch(() => {}); return; }
      const hit = STATUS_KEYS.find(([k]) => k === e.key);
      if (hit && !flagged) { e.preventDefault(); quickStatus(hit[1]); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  // Callback picker: enter it in the lead's time zone (what clients say on the phone) or yours.
  const leadTz = tzFor(f.state, f.zip);
  const [cbMode, setCbMode] = useState<'theirs' | 'mine'>(leadTz ? 'theirs' : 'mine');
  const modeTz = cbMode === 'theirs' && leadTz ? leadTz : null;
  const [cbWall, setCbWall] = useState('');
  useEffect(() => {
    setNow(new Date());
    const t = setInterval(() => setNow(new Date()), 30000);
    if (lead.callback_at) setCbWall(dateToWall(lead.callback_at, leadTz && cbMode === 'theirs' ? leadTz : localTz()));
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const cbDate = cbWall ? wallToDate(cbWall, modeTz || localTz()) : null;
  function switchCb(m: 'theirs' | 'mine') {
    if (cbDate) setCbWall(dateToWall(cbDate, m === 'theirs' && leadTz ? leadTz : localTz()));
    setCbMode(m);
  }

  const set = (k: string) => (e: any) => { setF({ ...f, [k]: e.target.value }); setDirty(true); };
  const lt = now ? localTime(f.state, now, f.zip) : null;
  const digits = (f.phone || '').replace(/\D/g, '');
  const b = useMemo(() => bmi(f.height, f.weight), [f.height, f.weight]);
  const flagged = lead.dnc || lead.is_agent;

  function save() {
    start(async () => {
      const res = await saveLead(lead.id, {
        ...f,
        callback_at: cbDate ? cbDate.toISOString() : null,
        beneficiaries: benes.filter((x) => x.name?.trim()),
      });
      if (res.error) return setMsg({ err: res.error });
      if (res.hidden && !isBoss) { alert(`${res.hidden} It’s been sent to your boss and removed from your list.`); router.push('/leads'); return; }
      setMsg({ ok: res.hidden ? `Saved. ${res.hidden} Agents can’t see it now.` : 'Saved' });
      setDirty(false);
      setF((x: any) => ({ ...x, ssn: '', account: '' }));
      setRevealed(null);
      router.refresh();
    });
  }

  useEffect(() => {
    const k = (e: KeyboardEvent) => { if ((e.metaKey || e.ctrlKey) && e.key === 's') { e.preventDefault(); save(); } };
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  });

  /** A text box with a little clipboard button to copy what's in it. */
  const F = (label: string, k: string, props: any = {}) => (
    <div className="field">
      <span className="field-head"><label htmlFor={`lf-${k}`}>{label}</label><CopyBtn value={f[k]} label={label} /></span>
      <input id={`lf-${k}`} value={f[k] ?? ''} onChange={set(k)} {...props} />
    </div>
  );
  /** Same for a dropdown or other box: a label row with a copy button. */
  const Head = (label: string, value: any, htmlFor?: string) => (
    <span className="field-head">{htmlFor ? <label htmlFor={htmlFor}>{label}</label> : <span>{label}</span>}<CopyBtn value={value} label={label} /></span>
  );
  const dobText = f.dob && /^\d{4}-\d{2}-\d{2}$/.test(f.dob) ? `${f.dob.slice(5, 7)}/${f.dob.slice(8, 10)}/${f.dob.slice(0, 4)}` : f.dob;
  const contactText = [
    [f.first_name, f.middle, f.last_name].filter(Boolean).join(' '),
    f.dob && `DOB: ${dobText}`, f.phone && `Phone: ${f.phone}`, f.email && `Email: ${f.email}`,
    [f.address, [f.city, [f.state, f.zip].filter(Boolean).join(' ')].filter(Boolean).join(', ')].filter(Boolean).join(', '),
  ].filter(Boolean).join('\n');
  const wq = f.zip || [f.city, f.state].filter(Boolean).join(', ');

  return (
    <div className="lead">
      {lead.dnc && (
        <div className="flag-banner dnc">
          <div><b>Do not call.</b> {lead.dnc_reason}. Agents can’t see this lead.</div>
          {isOwner && <button className="btn sm" onClick={() => confirm('Only clear this if they gave you written permission to call, or bought from you in the last 18 months. Clear it?') && start(async () => { await clearFlag(lead.id, 'dnc'); router.refresh(); })}>They gave permission</button>}
        </div>
      )}
      {lead.is_agent && (
        <div className="flag-banner agent">
          <div><b>Looks like an insurance agent.</b> {lead.agent_reason}. Agents can’t see this lead.</div>
          {isBoss && <button className="btn sm" onClick={() => start(async () => { await clearFlag(lead.id, 'agent'); router.refresh(); })}>Not an agent, put back</button>}
        </div>
      )}

      <header className="lead-head">
        <div>
          <h1>{[f.first_name, f.middle, f.last_name].filter(Boolean).join(' ') || 'New lead'}</h1>
          <p className="quiet">
            {age(f.dob) !== null && <>{age(f.dob)} yrs · </>}
            {[f.city, f.state].filter(Boolean).join(', ') || 'No location'}
          </p>
          <div className="their-now">
            {lt ? <span className={`clock ${lt.ok ? '' : 'off'}`}><Icon name="clock" size={15} /> {lt.time} {lt.abbr} their time{lt.ok ? '' : ' · outside calling hours'}</span> : <span className="quiet small">Add a state to see their time</span>}
            {wq && <WeatherChip leadId={lead.id} fallback={`https://forecast.weather.gov/zipcity.php?inputstring=${encodeURIComponent(wq)}`} />}
          </div>
        </div>
        <div className="row gap wrap">
          <select className={`status-sel big t-${toneOf(LEAD_STATUSES, f.status)}`} value={f.status} onChange={set('status')} aria-label="Status">
            {LEAD_STATUSES.map((s) => <option key={s.v}>{s.v}</option>)}
          </select>
          {digits && !lead.dnc && <CallLink phone={f.phone} leadId={lead.id} className="btn call-btn">Call {f.phone}</CallLink>}
          <button className="btn sm" onClick={() => setShowKeys(true)} aria-label="Keyboard shortcuts"><Icon name="keyboard" size={16} /> Shortcuts</button>
        </div>
      </header>
      {attempts > 0 && f.status === 'No Answer' && <p className="quiet small attempts-line">No answer so far: {attempts} {attempts === 1 ? 'try' : 'tries'}</p>}
      {showKeys && <Shortcuts where="lead" onClose={() => setShowKeys(false)} />}
      {cbOpen && <CallbackPicker lead={f} onClose={() => setCbOpen(false)} onPick={(iso) => {
        setCbOpen(false);
        setCbWall(dateToWall(iso, modeTz || localTz()));
        setF((x: any) => ({ ...x, status: 'Callback' }));
        start(async () => { await setCallback(lead.id, iso); router.refresh(); });
        setToast(`Callback set for ${timeIn(iso)} your time`);
      }} />}
      {toast && <div className="toast" role="status">{toast}</div>}

      <section className="card">
        <div className="card-head-row"><h2>Contact</h2><span className="copy-all row">Copy all <CopyBtn value={contactText} label="All contact info" /></span></div>
        <div className="form-grid">
          {F('First name', 'first_name')}
          {F('Middle', 'middle')}
          {F('Last name', 'last_name')}
          <div className="field">
            <span className="field-head"><span className="dob-age">Date of birth {age(f.dob) !== null && <em>Age {age(f.dob)}</em>}</span><CopyBtn value={dobText} label="Date of birth" /></span>
            <DateInput value={f.dob} onChange={(v) => { setF((x: any) => ({ ...x, dob: v })); setDirty(true); }} />
          </div>
          <div className="field">{Head('Gender', f.gender, 'lf-gender')}<select id="lf-gender" value={f.gender ?? ''} onChange={set('gender')}><option value="">—</option><option>Female</option><option>Male</option></select></div>
          <div className="field">{Head('Smoker', f.smoker, 'lf-smoker')}<select id="lf-smoker" value={f.smoker ?? ''} onChange={set('smoker')}><option value="">—</option><option>No</option><option>Yes</option></select></div>
          {F('Phone', 'phone', { inputMode: 'tel' })}
          {F('Other phones', 'alt_phones', { placeholder: 'Comma separated' })}
          {F('Email', 'email', { type: 'email' })}
          {F('Street address', 'address', {
            placeholder: 'Paste a full address — it fills city, state and ZIP',
            onBlur: () => {
              const p = splitAddress(f.address);
              if (p) { setF((x: any) => ({ ...x, address: p.address, city: x.city || p.city, state: x.state || p.state, zip: x.zip || p.zip })); setDirty(true); }
            },
          })}
          {F('City', 'city')}
          <div className="field">{Head('State', f.state)}<StatePicker value={f.state} onChange={(c) => { setF((x: any) => ({ ...x, state: c })); setDirty(true); }} emptyLabel="Type FL or Florida" /></div>
          {F('ZIP', 'zip', { inputMode: 'numeric' })}
          {isBoss && (
            <label className="field"><span>Assigned agent</span>
              <select value={f.assigned_to ?? ''} onChange={set('assigned_to')}>
                <option value="">Unassigned</option>
                {agents.map((a: any) => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
            </label>
          )}
        </div>
      </section>

      <section className="card">
        <h2>Their current policy</h2>
        <div className="form-grid">
          <div className="field">{Head('Type of policy they have', f.policy_type, 'lf-policy_type')}
            <select id="lf-policy_type" value={f.policy_type ?? ''} onChange={set('policy_type')}>
              <option value="">Not asked yet</option>
              {POLICY_TYPES.map((t) => <option key={t}>{t}</option>)}
            </select>
          </div>
          {f.policy_type && f.policy_type !== 'No coverage' && <>
            {F('Company', 'policy_carrier', { placeholder: 'e.g. Globe Life', list: 'carrier-list' })}
            {F('Coverage amount ($)', 'policy_coverage', { inputMode: 'decimal' })}
            {F('Pays per month ($)', 'policy_premium', { inputMode: 'decimal' })}
          </>}
        </div>
        <datalist id="carrier-list">{['Globe Life', 'Colonial Penn', 'AARP / New York Life', 'Mutual of Omaha', 'Transamerica', 'State Farm', 'Gerber', 'Lincoln Heritage', 'Aetna', 'Ethos'].map((c) => <option key={c} value={c} />)}</datalist>
      </section>

      <section className="card">
        <h2>Policy and health</h2>
        <div className="form-grid">
          {F('Desired coverage ($)', 'desired_coverage', { inputMode: 'decimal' })}
          {F('Amount ($/mo)', 'quoted_premium', { inputMode: 'decimal' })}
          {F('Height', 'height', { placeholder: `5'10"` })}
          {F('Weight', 'weight', { placeholder: '180 lbs' })}
          <div className={`field bmi t-${b?.tone ?? 'muted'}`}>
            {Head('BMI', b ? `${b.value}` : '')}
            {b ? <><strong className="num">{b.value}</strong><small>{b.label} · {Math.floor(b.inches / 12)}′{b.inches % 12}″, {b.lb} lb</small></>
              : <small className="quiet">Fills in from height and weight</small>}
          </div>
          <div className="field span2">{Head('Health conditions and meds', f.health, 'lf-health')}<textarea id="lf-health" rows={2} value={f.health ?? ''} onChange={set('health')} placeholder="Diabetes, heart, tobacco, meds…" /></div>
        </div>
      </section>

      <section className="card">
        <h2>Callback</h2>
        <div className="cb-row">
          <input type="datetime-local" value={cbWall} onChange={(e) => { setCbWall(e.target.value); if (e.target.value) setF({ ...f, status: 'Callback' }); setDirty(true); }} aria-label="Callback date and time" />
          {leadTz && leadTz !== localTz() && (
            <div className="seg">
              <button className={cbMode === 'theirs' ? 'on' : ''} onClick={() => switchCb('theirs')}>Their time ({tzAbbr(leadTz)})</button>
              <button className={cbMode === 'mine' ? 'on' : ''} onClick={() => switchCb('mine')}>My time</button>
            </div>
          )}
          {cbWall && <button className="link-btn" onClick={() => { setCbWall(''); setDirty(true); }}>Clear</button>}
        </div>
        {cbDate && leadTz && leadTz !== localTz() && (
          <p className="quiet small">{cbMode === 'theirs' ? `That’s ${timeIn(cbDate)} your time.` : `That’s ${timeIn(cbDate, leadTz)} ${tzAbbr(leadTz, cbDate)} their time.`} You’ll get a phone alert 15 minutes before.</p>
        )}
      </section>

      <section className="card secure">
        <h2><Icon name="lock" size={16} /> Application details</h2>
        <p className="quiet small">Encrypted at rest. Every reveal is recorded with your name.</p>
        <div className="form-grid">
          <div className="field">
            {Head('SSN', revealed?.ssn ? revealed.ssn.replace(/(\d{3})(\d{2})(\d{4})/, '$1-$2-$3') : '')}
            {revealed?.ssn ? <code className="revealed">{revealed.ssn.replace(/(\d{3})(\d{2})(\d{4})/, '$1-$2-$3')}</code>
              : lead.ssn_last4 ? <code className="masked">•••-••-{lead.ssn_last4}</code> : null}
            <input type="password" autoComplete="off" inputMode="numeric" maxLength={11} placeholder={lead.ssn_last4 ? 'Type to replace' : '9 digits'} value={f.ssn} onChange={set('ssn')} />
          </div>
          <div className="field">
            {Head('Routing number', f.routing)}
            <input inputMode="numeric" maxLength={9} value={f.routing ?? ''} onChange={(e) => {
              const v = e.target.value.replace(/\D/g, '').slice(0, 9);
              setF({ ...f, routing: v }); setDirty(true); setBank(null);
              if (v.length === 9) checkRouting(v).then(setBank);
            }} />
            {bank && (bank.saved ? <small className="good-text">{bank.saved}</small>
              : <small className={bank.valid ? 'good-text' : 'bad-text'}>{bank.bank ? `${bank.bank}${bank.city ? ` · ${bank.city}` : ''}${bank.state ? `, ${bank.state}` : ''}` : bank.note}</small>)}
          </div>
          <div className="field">
            {Head('Account number', revealed?.account || '')}
            {revealed?.account ? <code className="revealed">{revealed.account}</code>
              : lead.account_last4 ? <code className="masked">••••{lead.account_last4}</code> : null}
            <input type="password" autoComplete="off" inputMode="numeric" maxLength={17} placeholder={lead.account_last4 ? 'Type to replace' : 'Bank account #'} value={f.account} onChange={set('account')} />
          </div>
          <div className="field">{Head('Account type', f.account_type, 'lf-account_type')}<select id="lf-account_type" value={f.account_type ?? ''} onChange={set('account_type')}><option value="">—</option><option>Checking</option><option>Savings</option></select></div>
          <CardCheck f={f} setF={(x: any) => { setF(x); setDirty(true); }} />
        </div>
        {(lead.ssn_last4 || lead.account_last4) && (
          revealed
            ? <button className="link-btn" onClick={() => setRevealed(null)}>Hide</button>
            : <button className="link-btn" onClick={() => start(async () => setRevealed(await revealSensitive(lead.id)))}><Icon name="eye" size={15} /> Reveal full numbers</button>
        )}
        {!flagged && <SecureLink lead={lead} phone={digits} email={f.email} links={links} />}
      </section>

      <section className="card">
        <div className="row between"><h2>Beneficiaries</h2><button className="btn" onClick={() => { setBenes([...benes, { name: '', relationship: '', percent: '' }]); setDirty(true); }}><Icon name="plus" size={15} /> Add</button></div>
        {benes.length === 0 && <p className="quiet">Add the people who receive the payout.</p>}
        {benes.map((x, i) => (
          <div className="bene" key={i}>
            <input placeholder="Full name" value={x.name} onChange={(e) => { const n = [...benes]; n[i] = { ...x, name: e.target.value }; setBenes(n); setDirty(true); }} />
            <input placeholder="Relationship" value={x.relationship} onChange={(e) => { const n = [...benes]; n[i] = { ...x, relationship: e.target.value }; setBenes(n); setDirty(true); }} />
            <input placeholder="%" inputMode="numeric" value={x.percent} onChange={(e) => { const n = [...benes]; n[i] = { ...x, percent: e.target.value }; setBenes(n); setDirty(true); }} />
            <CopyBtn value={[x.name, x.relationship, x.percent && `${x.percent}%`].filter(Boolean).join(', ')} label="Beneficiary" />
            <button className="icon-btn" aria-label="Remove" onClick={() => { setBenes(benes.filter((_, j) => j !== i)); setDirty(true); }}><Icon name="x" size={16} /></button>
          </div>
        ))}
      </section>

      <section className="card">
        <div className="card-head-row"><h2>Notes</h2><CopyBtn value={f.notes} label="Notes" /></div>
        <textarea rows={4} value={f.notes ?? ''} onChange={set('notes')} placeholder="Who answered, best time to call, anything worth remembering" />
        {!lead.is_agent && f.state && f.last_name && (
          <a className="link-btn agent-flag naic" href={`https://external-lookup-web.prod.naic.org/lookup?jurisdiction=${encodeURIComponent(f.state)}&searchType=Licensee&entityType=IND`}
            target="_blank" rel="noopener noreferrer" onClick={() => { navigator.clipboard?.writeText(f.last_name).catch(() => {}); setToast('Last name copied. Paste it in the NAIC search.'); }}>
            Check if they’re a licensed agent (NAIC)
          </a>
        )}
        {!lead.is_agent && (
          <button className="link-btn agent-flag" onClick={() => confirm('Mark this person as a licensed insurance agent? The lead will be removed from your list and sent to your boss.') && start(async () => { await markAsAgent(lead.id); isBoss ? router.refresh() : router.push('/leads'); })}>
            They’re an insurance agent
          </button>
        )}
      </section>

      <div className={`savebar ${dirty ? 'show' : ''}`}>
        {msg.err && <span className="bad-text">{msg.err}</span>}
        {msg.ok && !dirty && <span className="good-text">{msg.ok}</span>}
        {dirty && !msg.err && <span className="quiet">Unsaved changes</span>}
        <button className="btn primary" onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Save lead'}</button>
      </div>
    </div>
  );
}

function SecureLink({ lead, phone, email, links }: any) {
  const router = useRouter();
  const [o, setO] = useState({ ssn: !lead.ssn_last4, bank: !lead.account_last4, greet: '' });
  const [url, setUrl] = useState('');
  const [err, setErr] = useState('');
  const [busy, start] = useTransition();
  const name = o.greet || lead.first_name || 'there';
  const text = `Hi ${name}, here’s the secure form to finish your application. It’s private and encrypted: ${url}`;
  const status = (l: any) => l.used_at ? 'Received' : l.cancelled ? 'Replaced' : new Date(l.expires_at) < new Date() ? 'Expired' : l.verified_at ? 'Opened' : 'Waiting';

  return (
    <div className="secure-link">
      <h3><Icon name="team" size={15} /> Secure client link</h3>
      <p className="quiet small">Text or email it. They open it, type their numbers on their own phone, and it fills this lead. You get an alert when they submit.</p>
      <div className="row gap wrap">
        <label className="check"><input type="checkbox" checked={o.ssn} onChange={(e) => setO({ ...o, ssn: e.target.checked })} /> SSN</label>
        <label className="check"><input type="checkbox" checked={o.bank} onChange={(e) => setO({ ...o, bank: e.target.checked })} /> Bank details</label>
        <input className="greet" placeholder={`Greet as ${lead.first_name || 'their name'}`} value={o.greet} onChange={(e) => setO({ ...o, greet: e.target.value })} />
        <button className="btn" disabled={busy} onClick={() => start(async () => {
          setErr(''); const r: any = await createSecureLink(lead.id, o);
          if (r.error) setErr(r.error); else { setUrl(r.url); router.refresh(); }
        })}>Create secure link</button>
      </div>
      {err && <p className="note bad">{err}</p>}
      {url && (
        <div className="link-out">
          <code>{url}</code>
          <div className="row gap wrap">
            <button className="btn sm" onClick={() => navigator.clipboard.writeText(url)}>Copy link</button>
            {phone && <a className="btn sm" href={`sms:${phone}?&body=${encodeURIComponent(text)}`}>Text it</a>}
            {email && <a className="btn sm" href={`mailto:${email}?subject=${encodeURIComponent('Your secure application form')}&body=${encodeURIComponent(text)}`}>Email it</a>}
          </div>
          <small className="quiet">Works once and expires in 48 hours.</small>
        </div>
      )}
      {links?.length > 0 && (
        <ul className="link-list">
          {links.map((l: any) => (
            <li key={l.id}>
              <span>{[l.wants_ssn && 'SSN', l.wants_bank && 'Bank'].filter(Boolean).join(' + ')} · sent by {l.by}</span>
              <span className={`pill t-${status(l) === 'Received' ? 'green' : status(l) === 'Opened' ? 'violet' : status(l) === 'Waiting' ? 'blue' : 'muted'}`}>{status(l)}</span>
              {status(l) === 'Waiting' || status(l) === 'Opened' ? <button className="link-btn" onClick={() => start(async () => { await cancelSecureLink(l.id); router.refresh(); })}>Cancel</button> : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** Card BIN checker. Only the first 6 digits go to the server for the lookup; only first 6 + last 4 are saved. */
function CardCheck({ f, setF }: any) {
  const [num, setNum] = useState('');
  const [info, setInfo] = useState<any>(null);
  const [busy, setBusy] = useState(false);
  const digits = num.replace(/\D/g, '');
  const bin = digits.slice(0, 6);
  const lastBin = useRef('');

  useEffect(() => {
    if (bin.length < 6) { setInfo(null); lastBin.current = ''; return; }
    if (lastBin.current === bin) return;
    lastBin.current = bin;
    setBusy(true);
    setInfo({ brand: brandFromBin(bin) });
    checkBin(bin).then((r) => setInfo(r)).finally(() => setBusy(false));
  }, [bin]);

  const complete = digits.length >= 13;
  const valid = complete && luhn(digits);
  const fmt = (d: string) => d.replace(/(\d{4})(?=\d)/g, '$1 ');

  return (
    <div className="field span2 card-check">
      <span>Card (checks the bank from the first 6 digits)</span>
      {f.card_bin && !num && (
        <div className="card-saved">
          <Icon name="card" size={16} /> <b>{f.card_brand || 'Card'}</b>{f.card_type ? ` ${f.card_type.toLowerCase()}` : ''}{f.card_bank ? ` · ${f.card_bank}` : ''}
          <code>{f.card_bin.slice(0, 4)} {f.card_bin.slice(4)}•• •••• {f.card_last4 || '••••'}</code>
          <button className="link-btn" onClick={() => setF({ ...f, card_bin: null, card_last4: null, card_brand: null, card_bank: null, card_type: null })}>Remove</button>
        </div>
      )}
      <input inputMode="numeric" autoComplete="off" placeholder={f.card_bin ? 'Type a new card to replace' : 'Card number'} maxLength={23}
        value={fmt(digits)} onChange={(e) => setNum(e.target.value.replace(/\D/g, '').slice(0, 19))} />
      {info && (
        <small className={info.bank || info.brand ? 'good-text' : 'quiet'}>
          {[info.brand, info.type && info.type.toLowerCase(), info.prepaid ? 'prepaid' : null].filter(Boolean).join(' ')}
          {info.bank ? ` · ${info.bank}` : ''}{info.country && info.country !== 'United States of America (the)' && info.country !== 'United States' ? ` · ${info.country}` : ''}
          {busy ? ' · checking bank…' : info.note ? ` · ${info.note}` : ''}
        </small>
      )}
      {complete && !valid && <small className="bad-text">This card number has a typo (it fails the card check).</small>}
      {bin.length === 6 && (
        <div className="row gap wrap">
          <button className="btn sm" disabled={!valid} onClick={() => {
            setF({ ...f, card_bin: bin, card_last4: digits.slice(-4), card_brand: info?.brand ?? null, card_bank: info?.bank ?? null, card_type: info?.type ?? null });
            setNum('');
          }}>Keep brand, bank and last 4</button>
          <small className="quiet">The full number, expiry and CVV are never saved.</small>
        </div>
      )}
    </div>
  );
}
