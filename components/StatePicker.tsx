'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import { STATES, STATE_LABELS } from '@/lib/constants';

/** Type "FL" or "Florida" — shows and saves the two-letter code. */
export default function StatePicker({ value, onChange, emptyLabel = 'Any state', className = '', id }: {
  value: string | null | undefined; onChange: (code: string) => void; emptyLabel?: string; className?: string; id?: string;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const [hi, setHi] = useState(0);
  const box = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);

  const list = useMemo(() => {
    const t = q.trim().toLowerCase();
    const all = STATES.map((c) => ({ c, n: STATE_LABELS[c] || c }));
    if (!t) return all;
    const starts = all.filter((s) => s.c.toLowerCase().startsWith(t) || s.n.toLowerCase().startsWith(t));
    const inside = all.filter((s) => !starts.includes(s) && s.n.toLowerCase().includes(t));
    return [...starts, ...inside];
  }, [q]);

  useEffect(() => setHi(0), [q]);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => { if (box.current && !box.current.contains(e.target as Node)) { setOpen(false); setQ(''); } };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [open]);

  const pick = (c: string) => { onChange(c); setOpen(false); setQ(''); input.current?.blur(); };
  const shown = open ? q : value ? `${value} · ${STATE_LABELS[value] || ''}` : '';

  return (
    <div className={`state-pick ${className}`} ref={box}>
      <input ref={input} id={id} value={shown} placeholder={emptyLabel} autoComplete="off" spellCheck={false}
        role="combobox" aria-expanded={open} aria-label="State"
        onFocus={() => { setOpen(true); setQ(''); }}
        onChange={(e) => { setQ(e.target.value); setOpen(true); }}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown') { e.preventDefault(); setHi((h) => Math.min(h + 1, list.length - 1)); }
          else if (e.key === 'ArrowUp') { e.preventDefault(); setHi((h) => Math.max(h - 1, 0)); }
          else if (e.key === 'Enter') { e.preventDefault(); if (list[hi]) pick(list[hi].c); }
          else if (e.key === 'Escape') { setOpen(false); setQ(''); input.current?.blur(); }
        }} />
      {value && !open && <button type="button" className="sp-clear" aria-label="Clear state" onClick={() => onChange('')}>×</button>}
      {open && (
        <ul className="sp-list" role="listbox">
          {list.length === 0 && <li className="sp-none">No state matches “{q}”</li>}
          {list.map((s, i) => (
            <li key={s.c} role="option" aria-selected={s.c === value} className={i === hi ? 'hi' : ''}
              onMouseDown={(e) => { e.preventDefault(); pick(s.c); }} onMouseEnter={() => setHi(i)}>
              <b>{s.c}</b><span>{s.n}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
