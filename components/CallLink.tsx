'use client';
import { dialUrl, placeCall, useDialPrefs } from '@/lib/dial';
import { logDial } from '@/app/actions/leads';
import Icon from './Icon';

/** A phone number that dials through whichever dialer the person picked (phone, Zoom or Google Voice). */
export default function CallLink({ phone, leadId, className = 'call', children }: { phone: string; leadId?: string; className?: string; children?: React.ReactNode }) {
  const p = useDialPrefs();
  const href = dialUrl(phone, p);
  if (!href) return <span className="quiet">{phone || '—'}</span>;
  return (
    <a className={className} href={href} onClick={(e) => {
      // Google Voice: always use the same tab (Voice stops working when it's open in two tabs).
      if (p.dialer === 'gvoice') { e.preventDefault(); if (!placeCall(phone, p)) return; }
      if (leadId) logDial(leadId).catch(() => {});
    }}>
      <Icon name="phone" size={14} /> {children ?? phone}
    </a>
  );
}
