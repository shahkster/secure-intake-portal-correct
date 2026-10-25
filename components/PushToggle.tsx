'use client';
import { useEffect, useState } from 'react';

type State = 'loading' | 'unsupported' | 'needs-install' | 'off' | 'on' | 'denied';

const b64 = (s: string) => {
  const pad = '='.repeat((4 - (s.length % 4)) % 4);
  const raw = atob((s + pad).replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
};
const isIOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
const isInstalled = () => window.matchMedia('(display-mode: standalone)').matches || (navigator as any).standalone === true;

export default function PushToggle({ banner = false }: { banner?: boolean }) {
  const [state, setState] = useState<State>('loading');
  const [installed, setInstalled] = useState(false);
  const [hidden, setHidden] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    (async () => {
      setInstalled(isInstalled());
      if (!('serviceWorker' in navigator)) return setState('unsupported');
      const reg = await navigator.serviceWorker.register('/sw.js');
      if (!('PushManager' in window) || !('Notification' in window)) return setState(isIOS() && !isInstalled() ? 'needs-install' : 'unsupported');
      if (Notification.permission === 'denied') return setState('denied');
      let sub = await reg.pushManager.getSubscription();
      if (sub && Notification.permission === 'granted') {
        // Re-subscribe if the server's key changed, then keep the server copy fresh.
        const { key } = await (await fetch('/api/push')).json();
        const cur = sub.options?.applicationServerKey;
        const same = cur && btoa(String.fromCharCode(...new Uint8Array(cur))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '') === key;
        if (!same) {
          await sub.unsubscribe();
          sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64(key) });
        }
        fetch('/api/push', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(sub) }).catch(() => {});
      }
      setState(sub ? 'on' : 'off');
      setHidden(sessionStorage.getItem('push-banner-hidden') === '1');
    })().catch(() => setState('unsupported'));
  }, []);

  async function enable() {
    setBusy(true);
    try {
      const perm = await Notification.requestPermission();
      if (perm !== 'granted') return setState(perm === 'denied' ? 'denied' : 'off');
      const reg = await navigator.serviceWorker.ready;
      const { key } = await (await fetch('/api/push')).json();
      const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64(key) });
      await fetch('/api/push', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(sub) });
      setState('on');
    } finally { setBusy(false); }
  }

  async function disable() {
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.getSubscription();
    if (sub) {
      await fetch('/api/push', { method: 'DELETE', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ endpoint: sub.endpoint }) });
      await sub.unsubscribe();
    }
    setState('off');
  }

  if (banner) {
    // Shows right after someone adds the app to their home screen and opens it.
    if (!installed || state !== 'off' || hidden) return null;
    return (
      <div className="push-banner">
        <span>Get deal, lead and callback alerts on this phone.</span>
        <button className="btn primary sm" disabled={busy} onClick={enable}>Turn on alerts</button>
        <button className="link-btn" onClick={() => { sessionStorage.setItem('push-banner-hidden', '1'); setHidden(true); }}>Later</button>
      </div>
    );
  }

  if (state === 'loading') return null;
  if (state === 'on') return <div className="push-row"><span className="good-text">Alerts are on for this device.</span><button className="link-btn" onClick={disable}>Turn off</button></div>;
  if (state === 'off') return <div className="push-row"><span className="quiet">Get alerts even when the app is closed.</span><button className="btn sm" disabled={busy} onClick={enable}>Turn on alerts</button></div>;
  if (state === 'denied') return <p className="quiet small">Alerts are blocked for this site. Turn them on in your phone or browser settings for this app.</p>;
  if (state === 'needs-install') return (
    <div className="install-help">
      <b>Get alerts on your iPhone</b>
      <ol>
        <li>Tap the Share button in Safari.</li>
        <li>Tap <b>Add to Home Screen</b>.</li>
        <li>Open the CRM from your home screen and tap <b>Turn on alerts</b>.</li>
      </ol>
    </div>
  );
  return <p className="quiet small">This browser can’t show alerts. Try Chrome, Edge, or Safari on iPhone (iOS 16.4 or newer) added to your home screen.</p>;
}
