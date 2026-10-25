'use client';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useRef, useState, useTransition } from 'react';
import { LEAD_STATUSES, STATES, toneOf } from '@/lib/constants';
import { localTime, timeIn, tzFor } from '@/lib/tz';
import { age, ago, money, whenTime } from '@/lib/format';
import { placeCall, useDialPrefs, DIALER_LABEL } from '@/lib/dial';
import PeoplePicker from '@/components/PeoplePicker';
import { LEAD_SORTS, DEFAULT_DIR, dirLabel } from '@/lib/sorts';
import { assignLeads, createLead, deleteLeads, logDial, setCallback, setLeadStatus } from '@/app/actions/leads';
import Icon from '@/components/Icon';
import CallLink from '@/components/CallLink';
import DialerPicker from '@/components/DialerPicker';
import CallbackPicker from '@/components/CallbackPicker';
import Shortcuts, { STATUS_KEYS } from '@/components/Shortcuts';
import StatePicker from '@/components/StatePicker';

// Keyboard shortcuts while a lead is selected.
const KEYS: [string, string, string][] = STATUS_KEYS.map(([k, st, label]) => [k, st, label]);
const STATUS_BY_KEY: Record<string, string> = Object.fromEntries(KEYS.map(([k, s]) => [k, s]));
const SKIP_IN_DIALER = ['Sold', 'Not Interested', 'Wrong Number', 'Out of Service', 'Do Not Call'];
const ordinal = (n: number) => `${n}${['th', 'st', 'nd', 'rd'][n % 100 > 10 && n % 100 < 14 ? 0 : n % 10 < 4 ? n % 10 : 0]}`;
const shortDob = (iso: string) => { const [y, m, d] = iso.split('-'); return `${m}/${d}/${y}`; };
const fullName = (l: any) => [l.first_name, l.last_name].filter(Boolean).join(' ') || 'No name';

export default function LeadsTable({ leads, agents, isBoss, isOwner, meId, total, page, pageSize, flagged, flaggedView, mineView, counts }: any) {
  const router = useRouter();
  const sp = useSearchParams();
  const prefs = useDialPrefs();
  const [rows, setRows] = useState<any[]>(leads);
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [now, setNow] = useState<Date | null>(null);
  const [q, setQ] = useState(sp.get('q') || '');
  const [adding, setAdding] = useState(false);
  const [cursor, setCursor] = useState(-1);
  const [dialing, setDialing] = useState(false);
  const [cbFor, setCbFor] = useState<{ i: number; advance: boolean } | null>(null);
  const [toast, setToast] = useState<{ text: string; action?: { label: string; run: () => void } } | null>(null);
  const [showKeys, setShowKeys] = useState(false);
  const [, start] = useTransition();
  const rowRefs = useRef<(HTMLTableRowElement | null)[]>([]);
  const resume = sp.get('dial') === '1';
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const legacySort: Record<string, [string, 'asc' | 'desc']> = { recent: ['touch', 'desc'], untouched: ['touch', 'asc'] };
  const rawSort = sp.get('sort') || 'touch';
  const sortKey = legacySort[rawSort]?.[0] || (DEFAULT_DIR[rawSort] ? rawSort : 'touch');
  const rawDir = sp.get('dir');
  const sortDir: 'asc' | 'desc' = legacySort[rawSort]?.[1] || (rawDir === 'asc' || rawDir === 'desc' ? rawDir : DEFAULT_DIR[sortKey]);
  const sortBy = (k: string, d: 'asc' | 'desc') => setParam('sort', k, { dir: d });
  /** Column header you can tap to sort by; tap again to flip high/low. */
  const SortTh = ({ k, label, right }: { k: string; label: string; right?: boolean }) => {
    const on = sortKey === k;
    return (
      <th className={right ? 'r' : undefined} aria-sort={on ? (sortDir === 'asc' ? 'ascending' : 'descending') : undefined}>
        <button type="button" className={`th-sort ${on ? 'on' : ''}`} onClick={() => sortBy(k, on ? (sortDir === 'asc' ? 'desc' : 'asc') : DEFAULT_DIR[k])} title={on ? `${dirLabel(k, sortDir)} — tap to flip` : `Sort by ${label.toLowerCase()}`}>
          {label}<span aria-hidden="true">{on ? (sortDir === 'asc' ? ' ↑' : ' ↓') : ' ↕'}</span>
        </button>
      </th>
    );
  };

  // When the list reloads, stay on the same lead instead of jumping back to the top.
  const curId = useRef<string | null>(null);
  useEffect(() => {
    setRows(leads); setSel(new Set());
    const keep = curId.current ? leads.findIndex((l: any) => l.id === curId.current) : -1;
    if (keep >= 0) { setCursor(keep); return; }
    setCursor(resume && leads.length ? 0 : -1); setDialing(false);
  }, [leads]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { curId.current = cursor >= 0 ? rows[cursor]?.id ?? null : null; }, [cursor, rows]);
  useEffect(() => { setNow(new Date()); const t = setInterval(() => setNow(new Date()), 30000); return () => clearInterval(t); }, []);
  // Remember the chosen page size.
  useEffect(() => {
    if (sp.get('per')) return;
    try { const v = localStorage.getItem('crm-per-page'); if (v && v !== String(pageSize)) setParam('per', v); } catch {}
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (cursor >= 0) rowRefs.current[cursor]?.scrollIntoView({ block: 'nearest' }); }, [cursor]);
  useEffect(() => { if (!toast) return; const t = setTimeout(() => setToast(null), 4000); return () => clearTimeout(t); }, [toast]);

  function setParam(k: string, v: string, extra?: Record<string, string>) {
    const p = new URLSearchParams(sp.toString());
    v ? p.set(k, v) : p.delete(k);
    if (k !== 'page') p.delete('page');
    p.delete('dial');
    if (extra) Object.entries(extra).forEach(([a, b]) => (b ? p.set(a, b) : p.delete(a)));
    router.push('/leads?' + p.toString());
  }

  const eligible = useCallback((i: number) => {
    const l = rows[i];
    if (!l || !(l.phone || '').replace(/\D/g, '') || l.dnc || SKIP_IN_DIALER.includes(l.status)) return false;
    const lt = localTime(l.state, new Date(), l.zip);
    return !lt || lt.ok;
  }, [rows]);
  const nextEligible = (from: number) => { for (let i = from; i < rows.length; i++) if (eligible(i)) return i; return -1; };

  function callRow(i: number) {
    const l = rows[i];
    if (!l || !placeCall(l.phone, prefs)) return;
    logDial(l.id).catch(() => {});
    setRows((r) => r.map((x, j) => (j === i ? { ...x, last_touch: new Date().toISOString() } : x)));
  }

  function changeStatus(id: string, status: string) {
    setRows((r) => r.map((x) => (x.id === id ? { ...x, status, attempts: x.attempts + (status === 'No Answer' ? 1 : 0), last_touch: new Date().toISOString() } : x)));
    start(() => setLeadStatus(id, status));
  }

  /** Move on after a disposition. In auto-dial, dials the next callable lead right away (same tap/key press). */
  function advance(i: number) {
    if (!dialing) { setCursor(Math.min(i + 1, rows.length - 1)); return; }
    const n = nextEligible(i + 1);
    if (n >= 0) { setCursor(n); callRow(n); return; }
    setDialing(false);
    setToast(page < pages
      ? { text: 'End of this page.', action: { label: 'Keep dialing next page', run: () => setParam('page', String(page + 1), { dial: '1' }) } }
      : { text: 'You reached the end of the list.' });
  }

  function dispose(i: number, status: string) {
    const l = rows[i];
    if (!l) return;
    if (status === 'Callback') { setCbFor({ i, advance: dialing }); return; }
    if (status === 'Sold') { router.push(`/deals/new?lead=${l.id}`); return; }
    if (status === 'Do Not Call' && !confirm(`Put ${fullName(l)} on your Do Not Call list? They’ll be removed for good.`)) return;
    changeStatus(l.id, status);
    const n = l.attempts + (status === 'No Answer' ? 1 : 0);
    setToast({ text: `${fullName(l)}: ${status === 'No Answer' ? `No answer (${ordinal(n)} try)` : status}` });
    advance(i);
  }

  function startDialing(from = Math.max(cursor, 0)) {
    const i = nextEligible(from);
    if (i < 0) { setToast({ text: 'Nobody on this page can be called right now (outside calling hours or no number).' }); return; }
    setDialing(true); setCursor(i); callRow(i);
  }

  // Keyboard shortcuts
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (e.metaKey || e.ctrlKey || e.altKey || cbFor || adding || showKeys) return;
      if (t && (['INPUT', 'TEXTAREA', 'SELECT'].includes(t.tagName) || t.isContentEditable)) return;
      const k = e.key;
      if (k === '?') { setShowKeys((s) => !s); return; }
      if (k === 'Escape') { if (dialing) setDialing(false); else setCursor(-1); return; }
      if (k === 'ArrowDown' || k === 'j') { e.preventDefault(); setCursor((c) => Math.min(c + 1, rows.length - 1)); return; }
      if (k === 'ArrowUp' || k === 'k') { e.preventDefault(); setCursor((c) => Math.max(c - 1, 0)); return; }
      if (cursor < 0) {
        if (STATUS_BY_KEY[k] || k === 'c' || k === 'Enter') setToast({ text: 'Click a lead or press ↓ to pick one first.' });
        return;
      }
      if (k === 'Enter') { router.push(`/leads/${rows[cursor].id}`); return; }
      if (k === 'c') { callRow(cursor); return; }
      if (k === 's' && dialing) { advance(cursor); return; }
      if (STATUS_BY_KEY[k]) { e.preventDefault(); dispose(cursor, STATUS_BY_KEY[k]); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const toggle = (id: string) => setSel((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const allOn = rows.length > 0 && rows.every((r) => sel.has(r.id));
  const cur = cursor >= 0 ? rows[cursor] : null;
  const curLt = cur && now ? localTime(cur.state, now, cur.zip) : null;
  const myTz = now ? Intl.DateTimeFormat().resolvedOptions().timeZone : '';

  return (
    <>
      <header className="page-head">
        <div>
          <h1>{flaggedView ? 'Flagged leads' : mineView ? 'My leads' : isBoss ? 'Master leads' : 'Leads'}</h1>
          <p className="quiet">{flaggedView ? 'On a Do Not Call list or look like insurance agents. Only bosses can see these.' : `${total.toLocaleString()} ${!isBoss || mineView ? 'assigned to you' : 'across your whole team'}`}</p>
        </div>
        <div className="row gap wrap">
          {isBoss && <Link className="btn" href="/import"><Icon name="upload" size={16} /> Import</Link>}
          <button className="btn" onClick={() => setAdding(true)}><Icon name="plus" size={16} /> Add lead</button>
          {!flaggedView && <button className="btn primary" onClick={() => startDialing(resume ? 0 : undefined)}><Icon name="phone" size={16} /> {resume ? 'Continue auto-dial' : 'Start auto-dial'}</button>}
        </div>
      </header>

      <div className="toolbar">
        {isBoss && (
          <div className="seg view-tabs three">
            <button className={!flaggedView && !mineView ? 'on' : ''} onClick={() => setParam('view', '', { agent: '' })}>Master leads {counts?.master ? <em>{counts.master.toLocaleString()}</em> : null}</button>
            <button className={mineView ? 'on' : ''} onClick={() => setParam('view', 'mine', { agent: '' })}>My leads {counts?.mine ? <em>{counts.mine.toLocaleString()}</em> : null}</button>
            <button className={flaggedView ? 'on' : ''} onClick={() => setParam('view', 'flagged')}>Flagged {flagged ? <em>{flagged}</em> : null}</button>
          </div>
        )}
        <DialerPicker />
        <button className="btn sm keys-btn" onClick={() => setShowKeys(true)}><Icon name="keyboard" size={16} /> Shortcuts</button>
      </div>

      {showKeys && <Shortcuts where="list" onClose={() => setShowKeys(false)} />}

      {adding && <AddLead agents={agents} isBoss={isBoss} onClose={() => setAdding(false)} onDone={(id: string) => router.push(`/leads/${id}`)} />}

      <div className="filters">
        <form onSubmit={(e) => { e.preventDefault(); setParam('q', q); }} className="grow">
          <input type="search" placeholder="Search name, phone or address" value={q} onChange={(e) => setQ(e.target.value)} />
        </form>
        <select value={sp.get('status') || ''} onChange={(e) => setParam('status', e.target.value)} aria-label="Status">
          <option value="">All statuses</option>
          {LEAD_STATUSES.map((s) => <option key={s.v}>{s.v}</option>)}
        </select>
        <StatePicker value={sp.get('state') || ''} onChange={(c) => setParam('state', c)} emptyLabel="All states" />
        {isBoss && !mineView && (
          <PeoplePicker people={agents} meId={meId} includeNone label="Everyone" value={(sp.get('agent') || '').split(',').filter(Boolean)}
            onChange={(ids) => setParam('agent', ids.join(','))} />
        )}
        <div className="sort-pick">
          <select value={sortKey} onChange={(e) => sortBy(e.target.value, DEFAULT_DIR[e.target.value])} aria-label="Sort by">
            {LEAD_SORTS.filter((o) => isBoss || o.key !== 'agent').map((o) => <option key={o.key} value={o.key}>Sort: {o.label}</option>)}
          </select>
          <button type="button" className="btn sort-dir" onClick={() => sortBy(sortKey, sortDir === 'asc' ? 'desc' : 'asc')} aria-label={`Order: ${dirLabel(sortKey, sortDir)}. Tap to flip.`} title="Flip the order">
            <span aria-hidden="true">{sortDir === 'asc' ? '↑' : '↓'}</span> {dirLabel(sortKey, sortDir)}
          </button>
        </div>
        {(sp.get('q') || sp.get('status') || sp.get('state') || sp.get('agent')) && <button className="link-btn" onClick={() => { setQ(''); const p = new URLSearchParams(); for (const k of ['view', 'per']) { const v = sp.get(k); if (v) p.set(k, v); } router.push('/leads?' + p.toString()); }}>Clear filters</button>}
      </div>

      {isBoss && sel.size > 0 && (
        <div className="bulk">
          <b>{sel.size} selected</b>
          <PeoplePicker people={agents} meId={meId} label="Assign / split to…" value={[]} onChange={() => {}}
            action={{
              text: (n) => n > 1 ? `Split evenly between ${n}` : 'Assign',
              run: (ids) => start(async () => {
                const n = sel.size;
                await assignLeads(Array.from(sel), ids);
                setSel(new Set()); router.refresh();
                setToast({ text: ids.length > 1 ? `Split ${n} leads between ${ids.length} people (about ${Math.ceil(n / ids.length)} each).` : `Assigned ${n} leads.` });
              }),
            }} />
          <button className="btn sm" onClick={() => start(async () => { await assignLeads(Array.from(sel), null); setSel(new Set()); router.refresh(); })}>Unassign</button>
          {isOwner && <button className="btn danger sm" onClick={() => { if (confirm(`Delete ${sel.size} leads? This can’t be undone.`)) start(async () => { await deleteLeads(Array.from(sel)); router.refresh(); }); }}>Delete</button>}
          <button className="link-btn" onClick={() => setSel(new Set())}>Clear</button>
        </div>
      )}

      <div className="table-wrap">
        <table className="grid">
          <thead>
            <tr>
              {isBoss && <th className="chk"><input type="checkbox" checked={allOn} onChange={() => setSel(allOn ? new Set() : new Set(rows.map((r) => r.id)))} aria-label="Select all" /></th>}
              <SortTh k="status" label="Status" /><SortTh k="name" label="Name" /><th>Address</th><th>Phone</th><SortTh k="state" label="Their time" /><SortTh k="age" label="Date of birth" />
              <SortTh k="coverage" label="Coverage" right /><SortTh k="amount" label="Amount" right /><SortTh k="touch" label="Last touch" /><SortTh k="callback" label="Callback" />
              {isBoss && <SortTh k="agent" label="Agent" />}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr><td colSpan={12} className="empty">
                {flaggedView ? 'Nothing flagged. Every lead passed the checks.' : sp.toString() ? 'No leads match these filters.' : isBoss ? 'No leads yet.' : 'No leads assigned to you yet. Your boss will send some soon.'}
                {' '}{isBoss && !flaggedView && !sp.toString() && <Link href="/import">Import a CSV</Link>}
              </td></tr>
            )}
            {rows.map((l, i) => {
              const lt = now ? localTime(l.state, now, l.zip) : null;
              const tz = tzFor(l.state, l.zip);
              const wq = l.zip || [l.city, l.state].filter(Boolean).join(', ');
              const late = now && l.callback_at && new Date(l.callback_at) < now;
              return (
                <tr key={l.id} ref={(el) => { rowRefs.current[i] = el; }}
                  className={`${sel.has(l.id) ? 'picked' : ''} ${cursor === i ? 'cursor' : ''}`}
                  onClick={(e) => { if (!(e.target as HTMLElement).closest('a,button,select,input')) setCursor(i); }}>
                  {isBoss && <td className="chk"><input type="checkbox" checked={sel.has(l.id)} onChange={() => toggle(l.id)} aria-label={`Select ${fullName(l)}`} /></td>}
                  <td className="nowrap">
                    <select className={`status-sel t-${toneOf(LEAD_STATUSES, l.status)}`} value={l.status} onChange={(e) => {
                      const v = e.target.value;
                      if (v === 'Callback') { setCbFor({ i, advance: false }); return; }
                      if (v === 'Do Not Call' && !confirm(`Put ${fullName(l)} on your Do Not Call list?`)) return;
                      changeStatus(l.id, v);
                    }} aria-label="Status">
                      {LEAD_STATUSES.map((s) => <option key={s.v}>{s.v}</option>)}
                    </select>
                    {l.attempts > 0 && <span className="attempts" title="No-answer tries">{ordinal(l.attempts)}</span>}
                  </td>
                  <td>
                    <Link className="name" href={`/leads/${l.id}`}>{fullName(l)}</Link>
                    {l.dnc && <small className="flag-tag dnc block">{l.dnc_reason || 'Do Not Call'}</small>}
                    {l.is_agent && <small className="flag-tag agent block">{l.agent_reason || 'Insurance agent'}</small>}
                  </td>
                  <td className="addr">{l.address || l.city || l.zip
                    ? <>{l.address && <span className="block">{l.address}</span>}<span className="quiet">{[l.city, [l.state, l.zip].filter(Boolean).join(' ')].filter(Boolean).join(', ')}</span></>
                    : <span className="quiet">—</span>}</td>
                  <td className="nowrap">{l.dnc ? <span className="quiet">{l.phone}</span> : <CallLink phone={l.phone} leadId={l.id} />}</td>
                  <td className="nowrap">
                    {l.state || '—'} {lt && <span className={lt.ok ? 'quiet' : 'warn'} title={lt.ok ? 'Inside calling hours' : 'Outside 8am–9pm calling hours'}>{lt.time} {lt.abbr}</span>}
                    {wq && <a className="wx" href={`https://forecast.weather.gov/zipcity.php?inputstring=${encodeURIComponent(wq)}`} target="_blank" rel="noopener noreferrer" title={`Weather in ${l.city || l.zip || l.state}`}>weather</a>}
                  </td>
                  <td className="nowrap num">{l.dob ? <>{shortDob(l.dob)} <span className="quiet">({age(l.dob)})</span></> : '—'}</td>
                  <td className="r num">{l.desired_coverage ? money(l.desired_coverage, false) : '—'}</td>
                  <td className="r num">{l.quoted_premium ? money(l.quoted_premium) : '—'}</td>
                  <td className="nowrap quiet">{now ? ago(l.last_touch) : ''}</td>
                  <td className={`nowrap ${late && l.status === 'Callback' ? 'warn' : ''}`}>
                    {l.callback_at ? (now ? <>{whenTime(l.callback_at)}{tz && tz !== myTz && <small className="quiet block">{timeIn(l.callback_at, tz)} their time</small>}</> : '') : '—'}
                  </td>
                  {isBoss && <td className="nowrap">{l.agent_name || <span className="quiet">Unassigned</span>}</td>}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {total > 0 && (
        <div className="pager">
          <label className="inline-field">
            <span>Leads per page</span>
            <select value={pageSize} onChange={(e) => { try { localStorage.setItem('crm-per-page', e.target.value); } catch {} setParam('per', e.target.value); }} aria-label="Leads per page">
              {[25, 50, 100, 250, 500, 1000].map((n) => <option key={n} value={n}>{n.toLocaleString()}</option>)}
            </select>
          </label>
          <span className="quiet">{((page - 1) * pageSize + 1).toLocaleString()}–{Math.min(page * pageSize, total).toLocaleString()} of {total.toLocaleString()}</span>
          {pages > 1 && <>
            <button className="btn" disabled={page <= 1} onClick={() => setParam('page', String(page - 1))}>Previous</button>
            <span className="quiet">Page {page} of {pages}</span>
            <button className="btn" disabled={page >= pages} onClick={() => setParam('page', String(page + 1))}>Next</button>
          </>}
        </div>
      )}

      {cur && (
        <div className={`dial-bar ${dialing ? 'live' : ''}`} role="region" aria-label="Selected lead">
          <div className="db-who">
            {dialing && <span className="live-dot" aria-hidden="true" />}
            <div>
              <b>{fullName(cur)}</b>
              <small className="quiet">
                {cur.phone || 'No phone'}{curLt ? ` · ${curLt.time} ${curLt.abbr}` : ''}{cur.attempts ? ` · ${ordinal(cur.attempts)} try` : ''}
                {dialing ? ` · auto-dial via ${DIALER_LABEL[prefs.dialer]}` : ''}
              </small>
            </div>
          </div>
          <div className="db-keys">
            {KEYS.map(([k, s, label]) => (
              <button key={k} className={`db-key t-${toneOf(LEAD_STATUSES, s)}`} onClick={() => dispose(cursor, s)}><kbd>{k}</kbd>{label}</button>
            ))}
          </div>
          <div className="db-act">
            <button className="btn sm call-btn" onClick={() => callRow(cursor)}><Icon name="phone" size={14} /> Call</button>
            {dialing
              ? <><button className="btn sm" onClick={() => advance(cursor)}>Skip</button><button className="btn sm danger" onClick={() => setDialing(false)}>Stop</button></>
              : <button className="icon-btn sm" onClick={() => setCursor(-1)} aria-label="Close"><Icon name="x" size={15} /></button>}
          </div>
        </div>
      )}

      {cbFor && rows[cbFor.i] && (
        <CallbackPicker lead={rows[cbFor.i]} onClose={() => setCbFor(null)} onPick={(iso) => {
          const { i, advance: adv } = cbFor;
          const l = rows[i];
          setCbFor(null);
          setRows((r) => r.map((x, j) => (j === i ? { ...x, status: 'Callback', callback_at: iso, last_touch: new Date().toISOString() } : x)));
          start(() => setCallback(l.id, iso));
          setToast({ text: `${fullName(l)}: callback ${whenTime(iso)}` });
          if (adv) advance(i); else setCursor(Math.min(i + 1, rows.length - 1));
        }} />
      )}

      {toast && (
        <div className="toast" role="status">
          <span>{toast.text}</span>
          {toast.action && <button className="link-btn" onClick={() => { toast.action!.run(); setToast(null); }}>{toast.action.label}</button>}
        </div>
      )}
    </>
  );
}

function AddLead({ agents, isBoss, onClose, onDone }: any) {
  const [f, setF] = useState<any>({});
  const [err, setErr] = useState('');
  const [busy, start] = useTransition();
  return (
    <div className="card add-lead">
      <div className="row between"><h2>New lead</h2><button className="icon-btn" onClick={onClose} aria-label="Close"><Icon name="x" /></button></div>
      <div className="form-grid">
        <label className="field"><span>First name</span><input autoFocus onChange={(e) => setF({ ...f, first_name: e.target.value })} /></label>
        <label className="field"><span>Last name</span><input onChange={(e) => setF({ ...f, last_name: e.target.value })} /></label>
        <label className="field"><span>Phone</span><input inputMode="tel" onChange={(e) => setF({ ...f, phone: e.target.value })} /></label>
        <div className="field"><span>State</span><StatePicker value={f.state} onChange={(c) => setF({ ...f, state: c })} emptyLabel="Type FL or Florida" /></div>
        {isBoss && <label className="field"><span>Assign to</span><select onChange={(e) => setF({ ...f, assigned_to: e.target.value })}><option value="">Unassigned</option>{agents.map((a: any) => <option key={a.id} value={a.id}>{a.name}</option>)}</select></label>}
      </div>
      {err && <p className="note bad">{err}</p>}
      <button className="btn primary" disabled={busy} onClick={() => start(async () => { const r = await createLead(f); r.error ? setErr(r.error) : onDone(r.id); })}>Create lead</button>
    </div>
  );
}
