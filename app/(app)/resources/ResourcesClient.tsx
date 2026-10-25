'use client';
import { useEffect, useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import CallLink from '@/components/CallLink';
import DialerPicker from '@/components/DialerPicker';
import Icon from '@/components/Icon';
import {
  PHONES, CLIENT_GUIDES, CHEAT_SHEET, BENEFICIARY_SCRIPT, REBUTTALS, GV_STEPS, GV_EXTENSION_URL, LICENSE_FEES, NIPR_FEE,
} from '@/lib/resources';
import { money } from '@/lib/format';
import { deleteQuickLink, saveQuickLink } from '@/app/actions/resources';

const TABS = [
  ['phones', 'Carrier phones'],
  ['write', 'What to write'],
  ['scripts', 'Scripts'],
  ['client', 'Client walkthroughs'],
  ['links', 'Quick links'],
  ['licensing', 'Licensing'],
] as const;
type Tab = (typeof TABS)[number][0];

export default function ResourcesClient({ links, isBoss }: any) {
  const [tab, setTab] = useState<Tab>('phones');
  useEffect(() => {
    const h = window.location.hash.slice(1) as Tab;
    if (TABS.some(([k]) => k === h)) setTab(h);
  }, []);
  const go = (t: Tab) => { setTab(t); history.replaceState(null, '', `#${t}`); };

  return (
    <>
      <nav className="tabs" aria-label="Resource sections">
        {TABS.map(([k, label]) => <button key={k} className={tab === k ? 'on' : ''} onClick={() => go(k)}>{label}</button>)}
      </nav>
      {tab === 'phones' && <Phones />}
      {tab === 'write' && <WhatToWrite />}
      {tab === 'scripts' && <Scripts />}
      {tab === 'client' && <ClientGuides />}
      {tab === 'links' && <QuickLinks links={links} isBoss={isBoss} />}
      {tab === 'licensing' && <Licensing />}
    </>
  );
}

function Phones() {
  const [q, setQ] = useState('');
  const rows = PHONES.filter((r) => !q || `${r.carrier} ${r.label}`.toLowerCase().includes(q.toLowerCase()));
  return (
    <section className="card">
      <div className="row between wrap gap"><h2>Carrier phone numbers</h2><DialerPicker /></div>
      <input type="search" placeholder="Search carriers" value={q} onChange={(e) => setQ(e.target.value)} className="mb" />
      <div className="phonebook">
        {rows.map((r, i) => (
          <div key={i} className="pb-row">
            <div className="pb-who"><b>{r.carrier}</b><span>{r.label}</span>{r.note && <small className="quiet">{r.note}</small>}{r.email && <a className="small" href={`mailto:${r.email}`}>{r.email}</a>}</div>
            <div className="pb-act">
              <CallLink phone={r.phone} />
              <button className="icon-btn sm" aria-label={`Copy ${r.phone}`} onClick={() => navigator.clipboard.writeText(r.phone)}><Icon name="copy" size={15} /></button>
            </div>
          </div>
        ))}
        {rows.length === 0 && <p className="quiet">No carrier matches “{q}”.</p>}
      </div>
    </section>
  );
}

function WhatToWrite() {
  const c = CHEAT_SHEET;
  return (
    <>
      <section className="card callout"><p>{c.defaultOrder}</p></section>
      <div className="two-col">
        <section className="card">
          <h2>Final expense by age</h2>
          <table className="mini"><thead><tr><th>Age</th><th>Write</th><th>Backups</th></tr></thead>
            <tbody>{c.byAge.map(([a, w, b]) => <tr key={a}><td className="nowrap"><b>{a}</b></td><td>{w}</td><td className="quiet">{b}</td></tr>)}</tbody></table>
        </section>
        <section className="card">
          <h2>By health</h2>
          {c.byHealth.map(([tone, label, order]) => (
            <div key={tone} className={`health h-${tone.toLowerCase()}`}><b>{tone}</b> <span className="quiet">{label}</span><p>{order}</p></div>
          ))}
        </section>
      </div>
      <div className="two-col">
        <section className="card">
          <h2>By product</h2>
          <table className="mini"><tbody>{c.byProduct.map(([p, w]) => <tr key={p}><td><b>{p}</b></td><td>{w}</td></tr>)}</tbody></table>
        </section>
        <section className="card">
          <h2>Good to know</h2>
          <ul className="plain">{c.goodToKnow.map((g) => <li key={g}>{g}</li>)}</ul>
        </section>
      </div>
    </>
  );
}

function Scripts() {
  const [open, setOpen] = useState<number | null>(null);
  return (
    <div className="two-col top">
      <section className="card">
        <h2>Rebuttals</h2>
        <p className="quiet small mb">Tap an objection to see the answer.</p>
        <div className="accordion">
          {REBUTTALS.map(([q, a], i) => (
            <div key={i} className={`acc ${open === i ? 'open' : ''}`}>
              <button onClick={() => setOpen(open === i ? null : i)} aria-expanded={open === i}>{q}</button>
              {open === i && <p>{a}</p>}
            </div>
          ))}
        </div>
      </section>
      <section className="card">
        <h2>Beneficiary call script</h2>
        <p className="quiet small mb">Calling the beneficiary after you set up a client.</p>
        <ol className="script">{BENEFICIARY_SCRIPT.map(([k, v]) => <li key={k}><b>{k}</b><p>{v}</p></li>)}</ol>
      </section>
    </div>
  );
}

function ClientGuides() {
  return (
    <>
      <div className="two-col top">
        {CLIENT_GUIDES.map((g) => (
          <section key={g.id} className="card">
            <h2>{g.title}</h2>
            <p className="quiet small mb">{g.subtitle}</p>
            <ol className="steps-list">{g.steps.map((s, i) => <li key={i}>{s}</li>)}</ol>
            {g.tip && <p className="note tip">{g.tip}</p>}
          </section>
        ))}
      </div>
      <section className="card">
        <h2>Google Voice click-to-call in Chrome</h2>
        <ol className="steps-list">{GV_STEPS.map((s, i) => <li key={i}>{s}</li>)}</ol>
        <a className="btn primary" href={GV_EXTENSION_URL} target="_blank" rel="noopener noreferrer">Open the Chrome Web Store</a>
      </section>
    </>
  );
}

function QuickLinks({ links, isBoss }: { links: any[]; isBoss: boolean }) {
  const router = useRouter();
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState({ title: '', subtitle: '', url: '' });
  const [err, setErr] = useState('');
  const [busy, start] = useTransition();
  const missing = links.filter((l) => !l.url).length;

  function edit(l: any) { setEditing(l?.id ?? 'new'); setDraft({ title: l?.title ?? '', subtitle: l?.subtitle ?? '', url: l?.url ?? '' }); setErr(''); }
  function save() {
    start(async () => {
      const r = await saveQuickLink(editing === 'new' ? null : editing, draft);
      if (r.error) return setErr(r.error);
      setEditing(null); router.refresh();
    });
  }

  return (
    <section className="card">
      <div className="row between wrap gap"><h2>Quick links</h2>{isBoss && <button className="btn" onClick={() => edit(null)}><Icon name="plus" size={15} /> Add link</button>}</div>
      {isBoss && missing > 0 && <p className="note tip">{missing} link{missing === 1 ? ' needs' : 's need'} a web address. Agents only see links that have one. Tap Edit to add it.</p>}
      {links.length === 0 && <p className="quiet">No links yet.{isBoss ? '' : ' Your boss can add them.'}</p>}
      {editing && (
        <div className="link-edit">
          <div className="form-grid">
            <label className="field"><span>Name</span><input value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} autoFocus /></label>
            <label className="field"><span>Description</span><input value={draft.subtitle} onChange={(e) => setDraft({ ...draft, subtitle: e.target.value })} /></label>
            <label className="field span2"><span>Web address</span><input type="url" inputMode="url" placeholder="https://" value={draft.url} onChange={(e) => setDraft({ ...draft, url: e.target.value })} /></label>
          </div>
          {err && <p className="note bad">{err}</p>}
          <div className="row gap"><button className="btn primary" disabled={busy} onClick={save}>Save link</button><button className="link-btn" onClick={() => setEditing(null)}>Cancel</button></div>
        </div>
      )}
      <div className="links-grid">
        {links.map((l) => (
          <div key={l.id} className={`ql ${l.url ? '' : 'empty'}`}>
            {l.url
              ? <a href={l.url} target="_blank" rel="noopener noreferrer"><b>{l.title}</b>{l.subtitle && <span>{l.subtitle}</span>}<Icon name="out" size={14} /></a>
              : <div><b>{l.title}</b>{l.subtitle && <span>{l.subtitle}</span>}<small className="warn">No address yet</small></div>}
            {isBoss && (
              <div className="ql-tools">
                <button className="link-btn" onClick={() => edit(l)}>Edit</button>
                <button className="link-btn" onClick={() => confirm(`Delete “${l.title}”?`) && start(async () => { await deleteQuickLink(l.id); router.refresh(); })}>Delete</button>
              </div>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}

function Licensing() {
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [q, setQ] = useState('');
  const stateTotal = useMemo(() => LICENSE_FEES.filter(([s]) => picked.has(s)).reduce((a, [, f]) => a + f, 0), [picked]);
  const nipr = picked.size * NIPR_FEE;
  const toggle = (s: string) => setPicked((p) => { const n = new Set(p); n.has(s) ? n.delete(s) : n.add(s); return n; });
  const rows = LICENSE_FEES.filter(([s]) => !q || s.toLowerCase().includes(q.toLowerCase()));
  return (
    <section className="card">
      <h2>Non-resident life license fees</h2>
      <p className="quiet small mb">Pick the states you want. Each state also adds a {money(NIPR_FEE)} NIPR processing fee, included in the total. NIPR estimates as of 9/1/2026 for a non-resident individual producer, Life line. Fees change, so treat these as estimates.</p>
      <div className="lic-total">
        <div><span>{picked.size} state{picked.size === 1 ? '' : 's'}</span><strong className="num">{money(stateTotal + nipr)}</strong></div>
        <small className="quiet">{money(stateTotal)} state fees + {money(nipr)} NIPR fees</small>
        {picked.size > 0 && <button className="link-btn" onClick={() => setPicked(new Set())}>Clear</button>}
      </div>
      <input type="search" placeholder="Find a state" value={q} onChange={(e) => setQ(e.target.value)} className="mb" />
      <div className="lic-grid">
        {rows.map(([s, f]) => (
          <label key={s} className={`lic ${picked.has(s) ? 'on' : ''}`}>
            <input type="checkbox" checked={picked.has(s)} onChange={() => toggle(s)} />
            <span>{s}</span><b className="num">{money(f, f % 1 !== 0)}</b>
          </label>
        ))}
      </div>
    </section>
  );
}
