'use client';
import { useEffect, useRef, useState } from 'react';

type Person = { id: string; name: string };

/** Pick one or more people from a checklist. */
export default function PeoplePicker({ people, value, onChange, label, includeNone = false, noneLabel = 'Unassigned', meId, action }: {
  people: Person[]; value: string[]; onChange: (ids: string[]) => void; label: string;
  includeNone?: boolean; noneLabel?: string; meId?: string; action?: { text: (n: number) => string; run: (ids: string[]) => void };
}) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<string[]>(value);
  const [q, setQ] = useState('');
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => setDraft(value), [value]);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => { if (box.current && !box.current.contains(e.target as Node)) { setOpen(false); if (!action) onChange(draft); } };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  });
  const opts = [...(includeNone ? [{ id: 'none', name: noneLabel }] : []), ...people]
    .filter((p) => !q || p.name.toLowerCase().includes(q.toLowerCase()));
  const toggle = (id: string) => setDraft((d) => (d.includes(id) ? d.filter((x) => x !== id) : [...d, id]));
  const nameOf = (id: string) => (id === 'none' ? noneLabel : people.find((p) => p.id === id)?.name || '');
  const summary = value.length === 0 ? label : value.length === 1 ? nameOf(value[0]) : `${value.length} people`;

  return (
    <div className="people-pick" ref={box}>
      <button type="button" className={`pp-btn ${value.length ? 'has' : ''}`} onClick={() => setOpen(!open)} aria-expanded={open}>
        {action ? label : summary}<span aria-hidden="true">▾</span>
      </button>
      {open && (
        <div className="pp-menu">
          {people.length > 6 && <input className="pp-search" placeholder="Search people" value={q} onChange={(e) => setQ(e.target.value)} autoFocus />}
          <div className="pp-list">
            {opts.map((p) => (
              <label key={p.id} className={`pp-row ${draft.includes(p.id) ? 'on' : ''}`}>
                <input type="checkbox" checked={draft.includes(p.id)} onChange={() => toggle(p.id)} />
                <span>{p.name}{p.id === meId ? ' (me)' : ''}</span>
              </label>
            ))}
          </div>
          <div className="pp-foot">
            <button type="button" className="link-btn" onClick={() => setDraft(draft.length ? [] : opts.map((o) => o.id).filter((x) => x !== 'none'))}>{draft.length ? 'Clear' : 'Select all'}</button>
            {action
              ? <button type="button" className="btn primary sm" disabled={!draft.length} onClick={() => { action.run(draft); setOpen(false); setDraft([]); }}>{action.text(draft.length)}</button>
              : <button type="button" className="btn primary sm" onClick={() => { onChange(draft); setOpen(false); }}>Show</button>}
          </div>
        </div>
      )}
    </div>
  );
}
