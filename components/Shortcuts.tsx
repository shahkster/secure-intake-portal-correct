'use client';
import { useEffect } from 'react';
import Icon from './Icon';

export const STATUS_KEYS: [string, string, string, string?][] = [
  ['1', 'No Answer', 'No answer', '+1 try: 1st, 2nd, 3rd…'],
  ['2', 'Not Interested', 'Not interested'],
  ['3', 'Callback', 'Callback', 'pick a time in their time zone'],
  ['4', 'Interested', 'Interested'],
  ['5', 'Contacted', 'Talked to them'],
  ['6', 'Wrong Number', 'Wrong number'],
  ['7', 'Sold', 'Sold', 'opens Log a deal'],
  ['8', 'Out of Service', 'Out of service', 'number disconnected · auto-dial skips it'],
  ['9', 'Do Not Call', 'Do not call', 'adds them to your Do Not Call list'],
];

/** Cheat sheet of every keyboard shortcut. `where` picks which extra keys to show. */
export default function Shortcuts({ where, onClose }: { where: 'list' | 'lead'; onClose: () => void }) {
  useEffect(() => {
    const k = (e: KeyboardEvent) => { if (e.key === 'Escape' || e.key === '?') { e.preventDefault(); onClose(); } };
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [onClose]);
  const extra: [string, string][] = where === 'list'
    ? [['↑ ↓ or J K', 'Move between leads'], ['C', 'Call the selected lead'], ['Enter', 'Open the lead'], ['S', 'Skip (during auto-dial)'], ['Esc', 'Stop auto-dial / unselect'], ['?', 'Show or hide this sheet']]
    : [['C', 'Call this lead'], ['Esc', 'Back to all leads'], ['Ctrl/⌘ S', 'Save the lead'], ['?', 'Show or hide this sheet']];
  return (
    <div className="modal-back" onClick={onClose}>
      <div className="modal wide" role="dialog" aria-label="Keyboard shortcuts" onClick={(e) => e.stopPropagation()}>
        <div className="row between"><h2><Icon name="keyboard" size={18} /> Shortcuts</h2><button className="icon-btn" onClick={onClose} aria-label="Close"><Icon name="x" /></button></div>
        <p className="quiet small mb">{where === 'list' ? 'Click a lead (or press ↓), then press a number. The lead updates and the next one is selected. During auto-dial the next lead is called right away.' : 'Press a number to set this lead’s result. Shortcuts pause while you’re typing in a box.'}</p>
        <div className="sheet-cols">
          <div>
            <h3 className="sub">Call results</h3>
            {STATUS_KEYS.map(([k, , label, note]) => <div key={k} className="sk"><kbd>{k}</kbd><span>{label}{note && <small className="quiet block">{note}</small>}</span></div>)}
          </div>
          <div>
            <h3 className="sub">Getting around</h3>
            {extra.map(([k, label]) => <div key={k} className="sk"><span className="kk">{k.split(' ').map((p, i) => <kbd key={i}>{p}</kbd>)}</span><span>{label}</span></div>)}
          </div>
        </div>
      </div>
    </div>
  );
}
