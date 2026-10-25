'use client';
import { useEffect, useState } from 'react';

export type Dialer = 'tel' | 'zoom' | 'gvoice';
export type DialPrefs = { dialer: Dialer; gvAccount: string };

const KEY = 'crm-dial-prefs';
const DEFAULT: DialPrefs = { dialer: 'tel', gvAccount: '1' };

export function readPrefs(): DialPrefs {
  try { return { ...DEFAULT, ...JSON.parse(localStorage.getItem(KEY) || '{}') }; } catch { return DEFAULT; }
}
export function savePrefs(p: DialPrefs) {
  try { localStorage.setItem(KEY, JSON.stringify(p)); } catch {}
  window.dispatchEvent(new Event('crm-dial-prefs'));
}

/** Current dialer settings; updates everywhere when changed. */
export function useDialPrefs() {
  const [p, setP] = useState<DialPrefs>(DEFAULT);
  useEffect(() => {
    const load = () => setP(readPrefs());
    load();
    window.addEventListener('crm-dial-prefs', load);
    window.addEventListener('storage', load);
    return () => { window.removeEventListener('crm-dial-prefs', load); window.removeEventListener('storage', load); };
  }, []);
  return p;
}

export function e164(phone?: string | null) {
  let d = (phone || '').replace(/\D/g, '');
  if (d.length === 11 && d.startsWith('1')) d = d.slice(1);
  return d.length === 10 ? `+1${d}` : d ? `+${d}` : '';
}

/** Zoom: zoomphonecall:// auto-dials in the Zoom app (Android only supports callto:). Google Voice: opens the web dialer with the number filled in. */
export function dialUrl(phone: string, p: DialPrefs) {
  const n = e164(phone);
  if (!n) return '';
  if (p.dialer === 'zoom') {
    const android = typeof navigator !== 'undefined' && /android/i.test(navigator.userAgent);
    return android ? `callto:${n}` : `zoomphonecall://${n}`;
  }
  // #crm-autodial tells the Legacy Comfort Dialer helper (Chrome extension) to press Call for you.
  if (p.dialer === 'gvoice') return `https://voice.google.com/u/${/^\d$/.test(p.gvAccount) ? p.gvAccount : '0'}/calls?a=nc,${encodeURIComponent(n)}#crm-autodial`;
  return `tel:${n}`;
}

/** Places the call. Must run inside a click or key press so the browser allows it. */
export function placeCall(phone: string, p: DialPrefs) {
  const url = dialUrl(phone, p);
  if (!url) return false;
  if (p.dialer === 'gvoice') {
    // Reuses one Google Voice tab and brings it to the front.
    const w = window.open(url, 'crm-gvoice');
    if (!w) { alert('Your browser blocked the Google Voice tab. Click the blocked pop-up icon in the address bar and choose "Always allow" for this site, then try again.'); return false; }
    try { w.opener = null; } catch {}
    try { w.focus(); } catch {}
    return true;
  }
  window.location.href = url;
  return true;
}

export const DIALER_LABEL: Record<Dialer, string> = { tel: 'Phone app', zoom: 'Zoom Phone', gvoice: 'Google Voice' };
