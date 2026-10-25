'use client';
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { addWatchlist, dncChunk, dncFinish, recheckAll, removeWatchlist } from '@/app/actions/compliance';

const CHUNK_BYTES = 4 * 1024 * 1024;
const BATCH = 50000;

/** Pull 10-digit numbers out of a registry file, however it's formatted (one per line, "areacode,number", etc). */
function numbersFrom(text: string) {
  const out: string[] = [];
  for (const line of text.split(/\r?\n/)) {
    let d = line.replace(/\D/g, '');
    if (d.length === 11 && d.startsWith('1')) d = d.slice(1);
    if (d.length === 10) out.push(d);
  }
  return out;
}

export function DncUpload() {
  const router = useRouter();
  const [mode, setMode] = useState<'add' | 'remove'>('add');
  const [progress, setProgress] = useState<string>('');
  const [busy, setBusy] = useState(false);

  async function run(files: FileList | null) {
    if (!files?.length) return;
    setBusy(true);
    try {
      for (const file of Array.from(files)) {
        let total = 0, offset = 0, carry = '', batch: string[] = [];
        const flush = async () => { if (batch.length) { total += await dncChunk(batch, mode); batch = []; } };
        while (offset < file.size) {
          const text = carry + (await file.slice(offset, offset + CHUNK_BYTES).text());
          offset += CHUNK_BYTES;
          const cut = offset < file.size ? text.lastIndexOf('\n') : text.length;
          carry = text.slice(cut);
          batch.push(...numbersFrom(text.slice(0, cut)));
          while (batch.length >= BATCH) { const b = batch.splice(0, BATCH); total += await dncChunk(b, mode); }
          setProgress(`${file.name}: ${Math.min(100, Math.round((offset / file.size) * 100))}% · ${total.toLocaleString()} ${mode === 'add' ? 'added' : 'removed'}`);
        }
        batch.push(...numbersFrom(carry));
        await flush();
        setProgress(`${file.name}: checking your leads…`);
        const r = await dncFinish(file.name, mode, total);
        setProgress(`${file.name}: ${total.toLocaleString()} numbers ${mode === 'add' ? 'added' : 'removed'}. ${r.dnc} lead${r.dnc === 1 ? '' : 's'} newly blocked.`);
      }
      router.refresh();
    } catch (e: any) {
      setProgress(`Upload stopped: ${e?.message || 'something went wrong'}. Try again; numbers already loaded are kept.`);
    } finally { setBusy(false); }
  }

  return (
    <div className="stack dnc-up">
      <div className="seg">
        <button className={mode === 'add' ? 'on' : ''} onClick={() => setMode('add')}>Add numbers</button>
        <button className={mode === 'remove' ? 'on' : ''} onClick={() => setMode('remove')}>Remove numbers</button>
      </div>
      <label className="drop">
        <input type="file" accept=".txt,.csv,text/plain,text/csv" multiple disabled={busy} onChange={(e) => run(e.target.files)} />
        <span>{busy ? 'Uploading… keep this page open' : 'Choose registry files (.txt or .csv)'}</span>
      </label>
      {progress && <p className="quiet small" aria-live="polite">{progress}</p>}
    </div>
  );
}

export function Watchlist() {
  const router = useRouter();
  const [text, setText] = useState('');
  const [note, setNote] = useState('');
  const [msg, setMsg] = useState('');
  const [busy, start] = useTransition();
  return (
    <div className="stack">
      <label className="field"><span>Add agents: one per line. Phone, email, name and home address are all picked up, even on the same line.</span>
        <textarea rows={4} value={text} onChange={(e) => setText(e.target.value)} placeholder={'John Carter, 555-201-3344, 12 Main St, Springfield, IL 62701\njane@smithagency.com\nMary Lopez'} />
      </label>
      <div className="row gap wrap">
        <label className="drop small-drop">
          <input type="file" accept=".csv,.txt" onChange={async (e) => { const f = e.target.files?.[0]; if (f) setText((await f.text()).slice(0, 2_000_000)); }} />
          <span>Or load a CSV</span>
        </label>
        <input className="grow-input" placeholder="Note (optional), e.g. “From vendor list”" value={note} onChange={(e) => setNote(e.target.value)} />
        <button className="btn primary" disabled={busy || !text.trim()} onClick={() => start(async () => {
          const r = await addWatchlist(text, note);
          setMsg(`Added ${r.added} to your list. ${r.flagged} lead${r.flagged === 1 ? '' : 's'} newly hidden.`);
          setText(''); router.refresh();
        })}>Add to agent list</button>
      </div>
      {msg && <p className="good-text small">{msg}</p>}
    </div>
  );
}

export function WatchRow({ row, when }: { row: any; when: string }) {
  const router = useRouter();
  const [busy, start] = useTransition();
  const shown = row.kind === 'phone' ? row.value.replace(/(\d{3})(\d{3})(\d{4})/, '$1-$2-$3')
    : row.kind === 'address' ? `${row.value.split('|')[0]} · ZIP ${row.value.split('|')[1] || ''}`
    : row.kind === 'name' ? row.value.replace(/\b\w/g, (c: string) => c.toUpperCase()) + (row.state ? ` (${row.state})` : '')
    : row.value;
  return (
    <div className="watch-row">
      <span><small className="quiet">{row.kind}</small> {shown}</span>
      <span className="quiet small">{row.note || ''} · {when}</span>
      <button className="link-btn" disabled={busy} onClick={() => start(async () => { await removeWatchlist(row.id); router.refresh(); })}>Remove</button>
    </div>
  );
}

export function Recheck() {
  const router = useRouter();
  const [msg, setMsg] = useState('');
  const [busy, start] = useTransition();
  return (
    <div className="row gap wrap">
      <button className="btn" disabled={busy} onClick={() => start(async () => {
        const r = await recheckAll();
        setMsg(`Done. ${r.dnc} more on Do Not Call, ${r.agents} more look like agents.`);
        router.refresh();
      })}>{busy ? 'Checking…' : 'Re-check all leads'}</button>
      {msg && <span className="quiet small">{msg}</span>}
    </div>
  );
}
