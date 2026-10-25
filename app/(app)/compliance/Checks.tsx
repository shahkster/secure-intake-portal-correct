'use client';
import Papa from 'papaparse';
import { useEffect, useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import StatePicker from '@/components/StatePicker';
import { agentQueue, dncApiBatch, dncResults, dncResultsDone, markAgentChecked, markAsAgent } from '@/app/actions/compliance';

const NAIC = (state: string) => `https://external-lookup-web.prod.naic.org/lookup?jurisdiction=${encodeURIComponent(state)}&searchType=Licensee&entityType=IND`;
const digits10 = (v: any) => { let d = String(v ?? '').replace(/\D/g, ''); if (d.length === 11 && d.startsWith('1')) d = d.slice(1); return d.length === 10 ? d : ''; };
const looksOn = (v: string) => /\b(dnc|yes|true|y|1|on|listed|match(ed)?|found|blocked?|registered|do not call)\b/i.test(v) && !/\b(not|no|false|clean|off|safe|ok|n)\b/i.test(v);

/** FreeDNCList: download phones only → scrub on their site → upload their results. */
export function FreeDnc({ due, total, hasApi }: { due: number; total: number; hasApi: boolean }) {
  const router = useRouter();
  const [file, setFile] = useState('');
  const [data, setData] = useState<Record<string, string>[]>([]);
  const [cols, setCols] = useState<string[]>([]);
  const [phoneCol, setPhoneCol] = useState('');
  const [statusCol, setStatusCol] = useState('');
  const [onValues, setOnValues] = useState<Set<string>>(new Set());
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);
  const [auto, setAuto] = useState('');

  function onFile(f?: File) {
    if (!f) return;
    setMsg('');
    if (!/\.csv$/i.test(f.name)) { setMsg('Download the results from FreeDNCList as a CSV, then upload that file.'); return; }
    Papa.parse<Record<string, string>>(f, {
      header: true, skipEmptyLines: 'greedy',
      complete: (r) => {
        const hs = (r.meta.fields || []).filter(Boolean);
        const rows = r.data.slice(0, 60000);
        const pc = hs.find((h) => rows.slice(0, 50).filter((x) => digits10(x[h])).length > 25) || hs.find((h) => /phone/i.test(h)) || '';
        const sc = hs.find((h) => h !== pc && /dnc|status|result|list/i.test(h)) || '';
        setFile(f.name); setData(rows); setCols(hs); setPhoneCol(pc); setStatusCol(sc);
        if (sc) setOnValues(new Set(uniq(rows, sc).filter(looksOn)));
      },
    });
  }
  const values = useMemo(() => (statusCol ? uniq(data, statusCol) : []), [data, statusCol]);
  const rows = useMemo(() => data.map((r) => ({ phone: digits10(r[phoneCol]), onList: onValues.has(String(r[statusCol] ?? '').trim()) })).filter((r) => r.phone), [data, phoneCol, statusCol, onValues]);
  const onCount = rows.filter((r) => r.onList).length;

  async function save() {
    setBusy(true);
    try {
      let flagged = 0;
      for (let i = 0; i < rows.length; i += 20000) {
        const r = await dncResults(rows.slice(i, i + 20000));
        flagged += r.flagged;
        setMsg(`Saving… ${Math.min(i + 20000, rows.length).toLocaleString()} of ${rows.length.toLocaleString()}`);
      }
      await dncResultsDone(file, rows.length, flagged);
      setMsg(`Done. ${rows.length.toLocaleString()} numbers checked, ${onCount.toLocaleString()} on the DNC list, ${flagged} lead${flagged === 1 ? '' : 's'} newly hidden from agents.`);
      setData([]); setFile('');
      router.refresh();
    } catch { setMsg('Saving stopped. Try again; anything already saved is kept.'); }
    finally { setBusy(false); }
  }

  async function runApi() {
    setBusy(true); setAuto('Starting…');
    let checked = 0, flagged = 0;
    try {
      for (let i = 0; i < 400; i++) {
        const r = await dncApiBatch();
        checked += r.checked; flagged += r.flagged;
        setAuto(`${checked.toLocaleString()} checked · ${flagged} hidden · ${r.remaining.toLocaleString()} left`);
        if (r.error) { setAuto((a) => `${a}. ${r.error}`); break; }
        if (!r.remaining || !r.checked) break;
      }
      router.refresh();
    } finally { setBusy(false); }
  }

  return (
    <div className="stack">
      <p className="quiet small">
        {due.toLocaleString()} of {total.toLocaleString()} numbers haven’t been checked in the last 31 days.
      </p>
      {hasApi && (
        <div className="row gap wrap">
          <button className="btn primary" disabled={busy || !due} onClick={runApi}>Check {due ? due.toLocaleString() : 'all'} numbers automatically</button>
          {auto && <span className="quiet small" aria-live="polite">{auto}</span>}
        </div>
      )}
      <ol className="steps-list">
        <li><a className="btn sm" href="/api/dnc-export">Download numbers to check</a> <a className="link-btn" href="/api/dnc-export?scope=all">or every number</a><br /><small className="quiet">A CSV with one column of phone numbers. No names or other lead details.</small></li>
        <li><a className="btn sm" href="https://www.freednclist.com/" target="_blank" rel="noopener noreferrer">Open FreeDNCList</a><br /><small className="quiet">Upload the file, pick the “phone” column, process it, then download the results as CSV. Guests get one file per session; a free account gets more.</small></li>
        <li>
          Upload their results here:
          <label className="drop small-drop mt"><input type="file" accept=".csv,text/csv" disabled={busy} onChange={(e) => onFile(e.target.files?.[0])} /><span>{file || 'Choose the results CSV'}</span></label>
        </li>
      </ol>
      {cols.length > 0 && (
        <div className="result-map">
          <div className="form-grid">
            <label className="field"><span>Phone number column</span><select value={phoneCol} onChange={(e) => setPhoneCol(e.target.value)}><option value="">Pick one</option>{cols.map((c) => <option key={c}>{c}</option>)}</select></label>
            <label className="field"><span>DNC result column</span><select value={statusCol} onChange={(e) => { setStatusCol(e.target.value); setOnValues(new Set(uniq(data, e.target.value).filter(looksOn))); }}><option value="">Pick one</option>{cols.filter((c) => c !== phoneCol).map((c) => <option key={c}>{c}</option>)}</select></label>
          </div>
          {statusCol && (
            <>
              <p className="small">Tick every result that means <b>on the Do Not Call list</b>:</p>
              <div className="agent-picks">
                {values.map((v) => (
                  <label key={v} className={`pick ${onValues.has(v) ? 'on' : ''}`}>
                    <input type="checkbox" checked={onValues.has(v)} onChange={() => setOnValues((s) => { const n = new Set(s); n.has(v) ? n.delete(v) : n.add(v); return n; })} />
                    {v || '(blank)'} <small className="quiet">{data.filter((r) => String(r[statusCol] ?? '').trim() === v).length.toLocaleString()}</small>
                  </label>
                ))}
              </div>
            </>
          )}
          <p className="small">{rows.length.toLocaleString()} numbers found · <b>{onCount.toLocaleString()}</b> on the list · {(rows.length - onCount).toLocaleString()} clean</p>
          <button className="btn primary" disabled={busy || !phoneCol || !statusCol || !rows.length} onClick={save}>Save results to the CRM</button>
        </div>
      )}
      {msg && <p className="quiet small" aria-live="polite">{msg}</p>}
      <p className="quiet small">A clean result isn’t permission to call — this is an extra check on top of your own list and the registry.</p>
    </div>
  );
}

function uniq(rows: Record<string, string>[], col: string) {
  return Array.from(new Set(rows.map((r) => String(r[col] ?? '').trim()))).slice(0, 30);
}

/** Go through leads one by one and check them on the NAIC licensee lookup. */
export function AgentQueue() {
  const [state, setState] = useState('');
  const [list, setList] = useState<any[] | null>(null);
  const [copied, setCopied] = useState('');
  const [, start] = useTransition();
  const load = (s = state) => start(async () => setList(JSON.parse(JSON.stringify(await agentQueue(s)))));
  useEffect(() => { load(''); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const done = (id: string) => setList((l) => (l || []).filter((x) => x.id !== id));

  return (
    <div className="stack">
      <div className="row gap wrap">
        <StatePicker value={state} onChange={(c) => { setState(c); load(c); }} emptyLabel="All states" />
        <span className="quiet small">Tap “Look up” — it opens the NAIC search for their state and copies their last name. Paste it, tick the NAIC terms box, search, then come back and pick the result.</span>
      </div>
      {list === null && <p className="quiet small">Loading…</p>}
      {list?.length === 0 && <p className="quiet">Nothing left to check{state ? ` in ${state}` : ''}.</p>}
      <div className="queue">
        {list?.map((l) => (
          <div key={l.id} className="q-row">
            <div><b>{[l.first_name, l.middle, l.last_name].filter(Boolean).join(' ')}</b><small className="quiet block">{[l.city, l.state].filter(Boolean).join(', ') || 'No state'}</small></div>
            <div className="row gap wrap">
              {l.state
                ? <a className="btn sm" href={NAIC(l.state)} target="_blank" rel="noopener noreferrer" onClick={() => { navigator.clipboard?.writeText(l.last_name).catch(() => {}); setCopied(l.id); }}>{copied === l.id ? 'Last name copied ✓' : 'Look up'}</a>
                : <span className="quiet small">Add a state to look up</span>}
              <button className="btn sm danger" onClick={() => { done(l.id); start(() => markAsAgent(l.id)); }}>Licensed agent</button>
              <button className="btn sm" onClick={() => { done(l.id); start(() => markAgentChecked(l.id)); }}>Not an agent</button>
            </div>
          </div>
        ))}
      </div>
      {list && list.length > 0 && <button className="link-btn" onClick={() => load()}>Load more</button>}
    </div>
  );
}
