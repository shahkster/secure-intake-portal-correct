'use client';
import { useState } from 'react';
import Icon from './Icon';

/** Little clipboard button: copies `value` and shows a check for a moment. Hidden when there's nothing to copy. */
export default function CopyBtn({ value, label }: { value?: string | number | null; label: string }) {
  const [done, setDone] = useState(false);
  const text = value == null ? '' : String(value).trim();
  if (!text) return <span className="copy-btn ghost" aria-hidden="true" />;
  async function copy(e: React.MouseEvent) {
    e.preventDefault(); e.stopPropagation();
    try { await navigator.clipboard.writeText(text); }
    catch {
      const t = document.createElement('textarea');
      t.value = text; t.setAttribute('readonly', ''); t.style.position = 'fixed'; t.style.opacity = '0';
      document.body.appendChild(t); t.select(); document.execCommand('copy'); t.remove();
    }
    setDone(true); setTimeout(() => setDone(false), 1400);
  }
  return (
    <button type="button" className={`copy-btn ${done ? 'done' : ''}`} onClick={copy} aria-label={done ? `${label} copied` : `Copy ${label}`} title={done ? 'Copied' : `Copy ${label.toLowerCase()}`}>
      <Icon name={done ? 'check' : 'clipboard'} size={14} />
    </button>
  );
}
