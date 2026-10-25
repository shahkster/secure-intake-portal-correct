'use client';
import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import Icon from './Icon';
import { markRead } from '@/app/actions/notifications';
import { ago } from '@/lib/format';
import { localTime, timeIn } from '@/lib/tz';
import PushToggle from './PushToggle';
import CallLink from './CallLink';

type N = { id: string; title: string; body?: string; link?: string; read?: boolean; created_at: string };
type Data = { mine: N[]; deals: N[]; mineUnread: number; dealsUnread: number; callbacks: any[] };

export default function TopBar() {
  const [d, setD] = useState<Data | null>(null);
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<'mine' | 'deals'>('mine');
  const panel = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    let j: Data;
    try {
      const r = await fetch('/api/notifications', { cache: 'no-store' });
      if (r.status === 401 || (r.redirected && r.url.includes('/login'))) { window.location.href = '/login'; return; }
      if (!r.ok || !(r.headers.get('content-type') || '').includes('json')) return;
      j = await r.json();
    } catch { return; }
    setD(j);
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, 20000);
    const onVis = () => document.visibilityState === 'visible' && load();
    document.addEventListener('visibilitychange', onVis);
    return () => { clearInterval(t); document.removeEventListener('visibilitychange', onVis); };
  }, [load]);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => panel.current && !panel.current.contains(e.target as Node) && setOpen(false);
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [open]);

  async function switchTab(t: 'mine' | 'deals') {
    setTab(t);
    await markRead(t);
    setD((x) => x && { ...x, [t === 'mine' ? 'mineUnread' : 'dealsUnread']: 0, mine: t === 'mine' ? x.mine.map((n) => ({ ...n, read: true })) : x.mine });
  }

  const unread = (d?.mineUnread ?? 0) + (d?.dealsUnread ?? 0);
  const list = d ? (tab === 'mine' ? d.mine : d.deals) : [];

  return (
    <>
    <PushToggle banner />
    <div className="topbar">
      <div className="ticker">
        {d?.callbacks?.length ? d.callbacks.map((c) => {
          const late = new Date(c.callback_at) < new Date();
          const digits = (c.phone || '').replace(/\D/g, '');
          return (
            <div key={c.id} className={`cb ${late ? 'late' : ''}`}>
              <Icon name="clock" size={15} />
              <Link href={`/leads/${c.id}`}><b>{c.first_name} {c.last_name}</b></Link>
              <span>{late ? 'overdue since' : 'at'} {timeIn(c.callback_at)}{(() => { const lt = localTime(c.state, new Date(c.callback_at), c.zip); return lt && lt.tz !== Intl.DateTimeFormat().resolvedOptions().timeZone ? ` (${timeIn(c.callback_at, lt.tz)} ${lt.abbr} their time)` : ''; })()}</span>
              {digits && <CallLink phone={c.phone} leadId={c.id} className="cb-call" />}
            </div>
          );
        }) : <span className="quiet">No callbacks due right now</span>}
      </div>
      <div className="bell-wrap" ref={panel}>
        <button className="icon-btn" aria-label={`Notifications, ${unread} unread`} onClick={() => { setOpen(!open); if (!open) switchTab(tab); }}>
          <Icon name="bell" />
          {unread > 0 && <span className="badge">{unread > 9 ? '9+' : unread}</span>}
        </button>
        {open && (
          <div className="panel">
            <div className="seg">
              <button className={tab === 'mine' ? 'on' : ''} onClick={() => switchTab('mine')}>For me {d?.mineUnread ? <em>{d.mineUnread}</em> : null}</button>
              <button className={tab === 'deals' ? 'on' : ''} onClick={() => switchTab('deals')}>All deals {d?.dealsUnread ? <em>{d.dealsUnread}</em> : null}</button>
            </div>
            <div className="panel-list">
              {list.length === 0 && <p className="quiet pad">Nothing here yet.</p>}
              {list.map((n) => {
                const inner = (<><div className="n-title">{n.title}</div>{n.body && <div className="n-body">{n.body}</div>}<div className="n-time">{ago(n.created_at)}</div></>);
                return n.link
                  ? <Link key={n.id} href={n.link} className={`n ${n.read === false ? 'unread' : ''}`} onClick={() => setOpen(false)}>{inner}</Link>
                  : <div key={n.id} className="n">{inner}</div>;
              })}
            </div>
            <div className="pad"><PushToggle /></div>
          </div>
        )}
      </div>
    </div>
    </>
  );
}
