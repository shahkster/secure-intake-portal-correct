'use client';
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { DEAL_STATUSES } from '@/lib/constants';
import StatePicker from '@/components/StatePicker';
import DateInput from '@/components/DateInput';
import { money } from '@/lib/format';
import { deleteDeal, saveDeal } from '@/app/actions/deals';

export default function DealForm({ deal, agents, isBoss, isOwner, meId }: any) {
  const router = useRouter();
  const [f, setF] = useState<any>({ status: 'Submitted', closed_date: new Date().toLocaleDateString('en-CA'), agent_id: meId, ...deal });
  const [err, setErr] = useState('');
  const [busy, start] = useTransition();
  const set = (k: string) => (e: any) => setF({ ...f, [k]: e.target.value });
  const F = (label: string, k: string, props: any = {}) => (
    <label className="field"><span>{label}</span><input value={f[k] ?? ''} onChange={set(k)} {...props} /></label>
  );
  const ap = Number(f.monthly_premium) * 12;

  return (
    <div className="stack">
      <section className="card">
        <h2>Client and policy</h2>
        <div className="form-grid">
          {F('Client name', 'client_name', { required: true, placeholder: 'Last, First M' })}
          {F('Phone', 'phone', { inputMode: 'tel' })}
          {F('Email', 'email', { type: 'email' })}
          <div className="field"><span>State</span><StatePicker value={f.state} onChange={(c) => setF({ ...f, state: c })} emptyLabel="Type FL or Florida" /></div>
          {F('Carrier', 'carrier', { list: 'carriers' })}
          {F('Product', 'product')}
          {F('Policy #', 'policy_number')}
          <label className="field"><span>Status</span><select value={f.status} onChange={set('status')}>{DEAL_STATUSES.map((s) => <option key={s.v}>{s.v}</option>)}</select></label>
        </div>
        <datalist id="carriers">{['Ethos', 'Mutual of Omaha', 'Americo', 'Aetna', 'Transamerica', 'Corebridge', 'Royal Neighbors', 'Foresters', 'American Amicable', 'Gerber'].map((c) => <option key={c} value={c} />)}</datalist>
      </section>
      <section className="card">
        <h2>Money and dates</h2>
        <div className="form-grid">
          {F('Monthly premium ($)', 'monthly_premium', { inputMode: 'decimal', required: true })}
          <div className="field"><span>Annual premium</span><output className="num big-out">{Number.isFinite(ap) && ap > 0 ? money(ap) : '—'}</output></div>
          {F('Coverage ($)', 'coverage', { inputMode: 'decimal' })}
          <div className="field"><span>Closed</span><DateInput value={f.closed_date} onChange={(v) => setF((x: any) => ({ ...x, closed_date: v }))} /></div>
          <div className="field"><span>Effective</span><DateInput value={f.effective_date} onChange={(v) => setF((x: any) => ({ ...x, effective_date: v }))} /></div>
          {F('Payment day of month', 'payment_day', { inputMode: 'numeric', maxLength: 2 })}
          {isBoss ? (
            <label className="field"><span>Closing agent</span><select value={f.agent_id ?? ''} onChange={set('agent_id')}>{agents.map((a: any) => <option key={a.id} value={a.id}>{a.name}</option>)}</select></label>
          ) : null}
          {F('Writing agent (on the carrier)', 'writing_agent')}
          <label className="field span2"><span>Notes</span><textarea rows={3} value={f.notes ?? ''} onChange={set('notes')} placeholder="Replacement, stop payment, anything to follow up on" /></label>
        </div>
      </section>
      {err && <p className="note bad" role="alert">{err}</p>}
      <div className="row gap">
        <button className="btn primary" disabled={busy} onClick={() => start(async () => {
          const r = await saveDeal(deal?.id ?? null, f);
          if (r.error) return setErr(r.error);
          router.push(`/deals/${r.id}`); router.refresh();
        })}>{busy ? 'Saving…' : deal?.id ? 'Save deal' : 'Log deal'}</button>
        {isOwner && deal?.id && <button className="btn danger" onClick={() => confirm('Delete this deal?') && start(async () => { await deleteDeal(deal.id); router.push('/deals'); })}>Delete deal</button>}
      </div>
    </div>
  );
}
