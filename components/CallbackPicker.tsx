'use client';
import { useEffect, useState } from 'react';
import { dateToWall, tzAbbr, tzFor, timeIn, wallToDate } from '@/lib/tz';
import Icon from './Icon';

const localTz = () => Intl.DateTimeFormat().resolvedOptions().timeZone;

function addDays(ymd: string, n: number) {
  const [y, m, d] = ymd.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
}

/** Quick callback times in the lead's own time zone. */
export default function CallbackPicker({ lead, onPick, onClose }: { lead: any; onPick: (iso: string) => void; onClose: () => void }) {
  const tz = tzFor(lead.state, lead.zip) || localTz();
  const theirs = tz !== localTz();
  const now = new Date();
  const today = dateToWall(now, tz).slice(0, 10);
  const tomorrow = addDays(today, 1);
  const at = (day: string, hm: string) => wallToDate(`${day}T${hm}`, tz);
  const presets: [string, Date][] = [
    ['In 1 hour', new Date(now.getTime() + 3600_000)],
    ['In 2 hours', new Date(now.getTime() + 7200_000)],
    ['This evening, 6:00 PM', at(today, '18:00')],
    ['Tomorrow, 10:00 AM', at(tomorrow, '10:00')],
    ['Tomorrow, 2:00 PM', at(tomorrow, '14:00')],
    ['Tomorrow, 6:00 PM', at(tomorrow, '18:00')],
  ].filter(([, d]) => (d as Date).getTime() > now.getTime() + 5 * 60_000) as [string, Date][];
  const [custom, setCustom] = useState(dateToWall(new Date(now.getTime() + 3600_000), tz));

  useEffect(() => {
    const k = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [onClose]);

  return (
    <div className="modal-back" onClick={onClose}>
      <div className="modal" role="dialog" aria-label="Set a callback" onClick={(e) => e.stopPropagation()}>
        <div className="row between"><h2>Call {lead.first_name || 'them'} back</h2><button className="icon-btn" onClick={onClose} aria-label="Close"><Icon name="x" /></button></div>
        <p className="quiet small">Times are in {theirs ? `their time (${tzAbbr(tz)})` : 'your time'}.</p>
        <div className="presets">
          {presets.map(([label, d]) => (
            <button key={label} className="preset" onClick={() => onPick(d.toISOString())}>
              <b>{label}</b>
              <span className="quiet">{theirs ? `${timeIn(d)} your time` : d.toLocaleDateString('en-US', { weekday: 'short' })}</span>
            </button>
          ))}
        </div>
        <div className="row gap wrap custom-cb">
          <input type="datetime-local" value={custom} onChange={(e) => setCustom(e.target.value)} aria-label="Custom callback time" />
          <button className="btn primary" disabled={!custom} onClick={() => onPick(wallToDate(custom, tz).toISOString())}>Set callback</button>
        </div>
      </div>
    </div>
  );
}
