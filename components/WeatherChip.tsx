'use client';
import { useEffect, useState } from 'react';

export default function WeatherChip({ leadId, fallback }: { leadId: string; fallback: string | null }) {
  const [w, setW] = useState<any>(null);
  useEffect(() => {
    let on = true;
    fetch(`/api/weather?id=${leadId}`).then((r) => (r.ok ? r.json() : null)).then((j) => on && setW(j || { link: fallback })).catch(() => on && setW({ link: fallback }));
    return () => { on = false; };
  }, [leadId, fallback]);
  if (!w) return <span className="weather quiet">Checking their weather…</span>;
  if (!w.link) return null;
  return (
    <a className="weather" href={w.link} target="_blank" rel="noopener noreferrer">
      {w.temp != null ? <><b>{w.temp}°{w.unit}</b> {w.short}</> : 'Their weather'}{w.place ? ` in ${w.place}` : ''} ↗
    </a>
  );
}
