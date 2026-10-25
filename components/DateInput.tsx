'use client';
import { useEffect, useState } from 'react';

const toText = (iso?: string | null) => {
  const m = (iso || '').match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[2]}/${m[3]}/${m[1]}` : '';
};

/** Types as MM/DD/YYYY (numbers only, slashes added for you). Gives back YYYY-MM-DD, or '' when empty. */
export default function DateInput({ value, onChange, id, placeholder = 'MM/DD/YYYY' }: {
  value: string | null | undefined; onChange: (iso: string) => void; id?: string; placeholder?: string;
}) {
  const [text, setText] = useState(toText(value));
  useEffect(() => { const t = toText(value); if (t || !value) setText((cur) => (cur.length === 10 || !cur ? t : cur)); }, [value]);
  const d = text.replace(/\D/g, '');
  const bad = d.length === 8 && !valid(d);

  return (
    <>
      <input id={id} inputMode="numeric" placeholder={placeholder} maxLength={10} value={text} aria-invalid={bad}
        onChange={(e) => {
          const n = e.target.value.replace(/\D/g, '').slice(0, 8);
          const t = n.length > 4 ? `${n.slice(0, 2)}/${n.slice(2, 4)}/${n.slice(4)}` : n.length > 2 ? `${n.slice(0, 2)}/${n.slice(2)}` : n;
          setText(t);
          if (!n) onChange('');
          else if (n.length === 8 && valid(n)) onChange(`${n.slice(4)}-${n.slice(0, 2)}-${n.slice(2, 4)}`);
        }} />
      {bad && <small className="bad-text">That date doesn’t exist. Use MM/DD/YYYY.</small>}
    </>
  );
}

function valid(d: string) {
  const m = +d.slice(0, 2), day = +d.slice(2, 4), y = +d.slice(4);
  if (m < 1 || m > 12 || day < 1 || y < 1900 || y > 2100) return false;
  return day <= new Date(y, m, 0).getDate();
}
