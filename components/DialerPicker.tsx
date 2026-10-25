'use client';
import { DIALER_LABEL, readPrefs, savePrefs, useDialPrefs, type Dialer } from '@/lib/dial';

export default function DialerPicker({ full = false }: { full?: boolean }) {
  const p = useDialPrefs();
  return (
    <div className={`dialer-picker ${full ? 'full' : ''}`}>
      <label className="inline-field">
        <span>Call with</span>
        <select value={p.dialer} onChange={(e) => savePrefs({ ...readPrefs(), dialer: e.target.value as Dialer })} aria-label="Call with">
          {(Object.keys(DIALER_LABEL) as Dialer[]).map((d) => <option key={d} value={d}>{DIALER_LABEL[d]}</option>)}
        </select>
      </label>
      {p.dialer === 'gvoice' && (
        <label className="inline-field">
          <span>Google account #</span>
          <select value={p.gvAccount} onChange={(e) => savePrefs({ ...readPrefs(), gvAccount: e.target.value })} aria-label="Google account number">
            {['0', '1', '2', '3', '4'].map((n) => <option key={n} value={n}>{n}</option>)}
          </select>
        </label>
      )}
      {p.dialer === 'gvoice' && <p className="quiet small gv-tip">Works on a computer in Chrome. Account # = the number after /u/ in your Google Voice address (voice.google.com/u/<b>1</b>/…). Install the <a href="/legacy-comfort-dialer.zip" download>Legacy Comfort Dialer helper</a> so Voice presses Call for you.</p>}
      {full && p.dialer === 'zoom' && <p className="quiet small">Needs the Zoom desktop or phone app, signed in with a Zoom Phone number. The first time, your browser asks to open Zoom — tick “Always allow”.</p>}
    </div>
  );
}
