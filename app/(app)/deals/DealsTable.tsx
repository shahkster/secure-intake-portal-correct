'use client';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState, useTransition } from 'react';
import { DEAL_STATUSES, toneOf } from '@/lib/constants';
import { ago, money, shortDate } from '@/lib/format';
import { setDealStatus } from '@/app/actions/deals';

export default function DealsTable({ deals, agents, isBoss }: any) {
  const router = useRouter();
  const sp = useSearchParams();
  const [rows, setRows] = useState<any[]>(deals);
  const [q, setQ] = useState(sp.get('q') || '');
  const [, start] = useTransition();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setRows(deals), [deals]);
  useEffect(() => setMounted(true), []);
  const setParam = (k: string, v: string) => { const p = new URLSearchParams(sp.toString()); v ? p.set(k, v) : p.delete(k); router.push('/deals?' + p.toString()); };

  return (
    <>
      <div className="filters">
        <form className="grow" onSubmit={(e) => { e.preventDefault(); setParam('q', q); }}>
          <input type="search" placeholder="Search name, policy #, email, phone" value={q} onChange={(e) => setQ(e.target.value)} />
        </form>
        <select value={sp.get('range') || 'month'} onChange={(e) => setParam('range', e.target.value)} aria-label="Closed">
          <option value="month">Closed this month</option><option value="last">Closed last month</option><option value="all">All time</option>
        </select>
        <select value={sp.get('status') || ''} onChange={(e) => setParam('status', e.target.value)} aria-label="Status">
          <option value="">All statuses</option>{DEAL_STATUSES.map((s) => <option key={s.v}>{s.v}</option>)}
        </select>
        {isBoss && (
          <select value={sp.get('agent') || ''} onChange={(e) => setParam('agent', e.target.value)} aria-label="Agent">
            <option value="">All agents</option>{agents.map((a: any) => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
        )}
      </div>
      <div className="table-wrap">
        <table className="grid">
          <thead><tr><th>Closed</th><th>Client</th><th>Policy #</th><th>Carrier</th><th>Agent</th><th>State</th><th className="r">Monthly</th><th className="r">Annual</th><th className="r">Coverage</th><th>Status</th></tr></thead>
          <tbody>
            {rows.length === 0 && <tr><td colSpan={10} className="empty">No deals here yet. Log one when you close it.</td></tr>}
            {rows.map((d) => (
              <tr key={d.id}>
                <td className="nowrap">{shortDate(d.closed_date)}</td>
                <td><Link className="name" href={`/deals/${d.id}`}>{d.client_name}</Link></td>
                <td className="nowrap quiet">{d.policy_number || '—'}</td>
                <td>{d.carrier || '—'}</td>
                <td className="nowrap">{d.agent_name || '—'}</td>
                <td>{d.state || '—'}</td>
                <td className="r num">{money(d.monthly_premium)}</td>
                <td className="r num strong">{money(Number(d.monthly_premium) * 12)}</td>
                <td className="r num">{money(d.coverage, false)}</td>
                <td className="nowrap">
                  <select className={`status-sel t-${toneOf(DEAL_STATUSES, d.status)}`} value={d.status} aria-label="Status"
                    onChange={(e) => { const s = e.target.value; setRows((r) => r.map((x) => (x.id === d.id ? { ...x, status: s, updated_at: new Date().toISOString() } : x))); start(() => setDealStatus(d.id, s)); }}>
                    {DEAL_STATUSES.map((s) => <option key={s.v}>{s.v}</option>)}
                  </select>
                  {mounted && <small className="quiet block">updated {ago(d.updated_at)}</small>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
