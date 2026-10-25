'use client';
import Papa from 'papaparse';
import Link from 'next/link';
import { useMemo, useState, useTransition } from 'react';
import { IMPORT_FIELDS } from '@/lib/constants';
import { importLeads } from '@/app/actions/leads';

const norm = (s: string) => s.toLowerCase().replace(/[_\-.]/g, ' ').replace(/[^a-z0-9 ]/g, '').replace(/\s+/g, ' ').trim();

function guess(headers: string[]) {
  const map: Record<string, string> = {};
  const used = new Set<string>();
  for (const [key, , syn] of IMPORT_FIELDS) {
    const h = headers.find((x) => !used.has(x) && syn.includes(norm(x)));
    if (h) { map[key] = h; used.add(h); }
  }
  if (map.first_name || map.last_name) delete map.full_name;
  return map;
}

export default function ImportClient({ agents }: { agents: { id: string; name: string; role: string }[] }) {
  const [file, setFile] = useState('');
  const [headers, setHeaders] = useState<string[]>([]);
  const [raw, setRaw] = useState<Record<string, string>[]>([]);
  const [map, setMap] = useState<Record<string, string>>({});
  const [mode, setMode] = useState<'single' | 'round' | 'none'>('round');
  const [picked, setPicked] = useState<string[]>([]);
  const [skipDupes, setSkipDupes] = useState(true);
  const [batchName, setBatchName] = useState('');
  const [result, setResult] = useState<{ inserted?: number; skipped?: number; dnc?: number; agents?: number; totalHidden?: number; error?: string } | null>(null);
  const [busy, start] = useTransition();

  function onFile(f?: File) {
    if (!f) return;
    setResult(null);
    Papa.parse<Record<string, string>>(f, {
      header: true,
      skipEmptyLines: 'greedy',
      complete: (r) => {
        const hs = (r.meta.fields || []).filter(Boolean);
        setFile(f.name);
        setBatchName(f.name.replace(/\.csv$/i, ''));
        setHeaders(hs);
        setRaw(r.data);
        setMap(guess(hs));
      },
    });
  }

  const mapped = useMemo(() => raw.map((r) => {
    const o: Record<string, string> = {};
    for (const [k, h] of Object.entries(map)) if (h) o[k] = r[h] ?? '';
    return o;
  }), [raw, map]);

  const hasName = map.first_name || map.last_name || map.full_name;
  const ready = mapped.length > 0 && hasName && map.phone && (mode === 'none' || picked.length > 0);
  const perAgent = mode === 'round' && picked.length ? Math.ceil(mapped.length / picked.length) : mapped.length;

  function run() {
    start(async () => {
      const r = await importLeads({ batchName, rows: mapped, mode, agentIds: mode === 'single' ? picked.slice(0, 1) : picked, skipDupes });
      setResult(r);
      if (!r.error) { setRaw([]); setHeaders([]); setFile(''); }
    });
  }

  if (result && !result.error) {
    return (
      <section className="card">
        <h2>Imported {result.inserted?.toLocaleString()} leads</h2>
        <p className="quiet">{result.skipped ? `${result.skipped} rows were skipped as duplicates or blank. ` : ''}Assigned agents got a notification.</p>
        <p className="quiet small">Every lead in the CRM was re-checked against your Do Not Call and agent lists (phone, other phones, email, name and home address).</p>
        {(result.dnc || result.agents) ? (
          <p className="note bad">In this file: {result.dnc ? `${result.dnc} on a Do Not Call list` : ''}{result.dnc && result.agents ? ' and ' : ''}{result.agents ? `${result.agents} matched a known insurance agent` : ''}. They’re hidden from agents.</p>
        ) : <p className="good-text small">Every lead in this file passed both checks.</p>}
        {result.totalHidden ? <p className="small">{result.totalHidden.toLocaleString()} leads are hidden in total. <Link href="/leads?view=flagged">Review them under Flagged</Link>.</p> : null}
        <div className="row gap"><Link className="btn primary" href="/leads">View leads</Link><button className="btn" onClick={() => setResult(null)}>Import another file</button></div>
      </section>
    );
  }

  return (
    <>
      <section className="card">
        <h2>1. Choose a file</h2>
        <label className="drop">
          <input type="file" accept=".csv,text/csv" onChange={(e) => onFile(e.target.files?.[0])} />
          <span>{file ? <><b>{file}</b> · {raw.length.toLocaleString()} rows</> : 'Tap to choose a .csv file'}</span>
        </label>
      </section>

      {headers.length > 0 && (
        <section className="card">
          <h2>2. Match the columns</h2>
          <p className="quiet small">We matched what we could. Name and phone are required.</p>
          <div className="map-grid">
            {IMPORT_FIELDS.map(([key, label]) => (
              <label key={key} className="field">
                <span>{label}</span>
                <select value={map[key] || ''} onChange={(e) => setMap({ ...map, [key]: e.target.value })}>
                  <option value="">Skip</option>
                  {headers.map((h) => <option key={h} value={h}>{h}</option>)}
                </select>
              </label>
            ))}
          </div>
          <div className="table-wrap preview">
            <table className="grid">
              <thead><tr>{['Name', 'Phone', 'State', 'DOB', 'Coverage'].map((h) => <th key={h}>{h}</th>)}</tr></thead>
              <tbody>{mapped.slice(0, 4).map((r, i) => (
                <tr key={i}><td>{r.full_name || [r.first_name, r.last_name].filter(Boolean).join(' ')}</td><td>{r.phone}</td><td>{r.state}</td><td>{r.dob}</td><td>{r.desired_coverage}</td></tr>
              ))}</tbody>
            </table>
          </div>
        </section>
      )}

      {headers.length > 0 && (
        <section className="card">
          <h2>3. Assign the leads</h2>
          <div className="seg wide">
            <button className={mode === 'round' ? 'on' : ''} onClick={() => setMode('round')}>Split evenly</button>
            <button className={mode === 'single' ? 'on' : ''} onClick={() => { setMode('single'); setPicked(picked.slice(0, 1)); }}>One agent</button>
            <button className={mode === 'none' ? 'on' : ''} onClick={() => setMode('none')}>Leave unassigned</button>
          </div>
          {mode !== 'none' && (
            <div className="agent-picks">
              {agents.map((a) => (
                <label key={a.id} className={`pick ${picked.includes(a.id) ? 'on' : ''}`}>
                  <input type={mode === 'single' ? 'radio' : 'checkbox'} name="agent" checked={picked.includes(a.id)}
                    onChange={() => setPicked(mode === 'single' ? [a.id] : picked.includes(a.id) ? picked.filter((x) => x !== a.id) : [...picked, a.id])} />
                  {a.name}{a.role === 'boss' && <small> (boss)</small>}
                </label>
              ))}
            </div>
          )}
          {mode === 'round' && picked.length > 0 && <p className="quiet small">About {perAgent.toLocaleString()} leads each, dealt out one at a time.</p>}
          <div className="form-grid">
            <label className="field"><span>Name this import</span><input value={batchName} onChange={(e) => setBatchName(e.target.value)} /></label>
          </div>
          <label className="check"><input type="checkbox" checked={skipDupes} onChange={(e) => setSkipDupes(e.target.checked)} /> Skip phone numbers already in the CRM</label>
          {result?.error && <p className="note bad">{result.error}</p>}
          {!hasName || !map.phone ? <p className="note bad">Match a name column and the phone column to continue.</p> : null}
          <button className="btn primary" disabled={!ready || busy} onClick={run}>{busy ? 'Importing…' : `Import ${mapped.length.toLocaleString()} leads`}</button>
        </section>
      )}
    </>
  );
}
