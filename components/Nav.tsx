'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import Icon from './Icon';
import { BRAND } from '@/lib/brand';
import { logout } from '@/app/actions/auth';

export default function Nav({ role, name, owner = false }: { role: 'boss' | 'agent'; name: string; owner?: boolean }) {
  const path = usePathname();
  const [more, setMore] = useState(false);
  useEffect(() => setMore(false), [path]);

  const main = [
    { href: '/', label: 'Today', icon: 'home' },
    { href: '/leads', label: 'Leads', icon: 'leads' },
    { href: '/deals', label: 'Deals', icon: 'deals' },
    { href: '/resources', label: 'Resources', icon: 'book' },
  ];
  const extra = [
    ...(role === 'boss'
      ? [
          { href: '/import', label: 'Import leads', icon: 'upload' },
          { href: '/compliance', label: 'Compliance', icon: 'lock' },
          { href: '/team', label: 'Team', icon: 'team' },
        ]
      : []),
    { href: '/account', label: 'Account', icon: 'user' },
  ];
  const on = (h: string) => (h === '/' ? path === '/' : path.startsWith(h));
  const extraActive = extra.some((i) => on(i.href));

  return (
    <nav className="nav" aria-label="Main">
      <div className="brand"><span className="brand-mark">{BRAND.slice(0, 1)}</span><span className="brand-name">{BRAND}</span></div>
      {main.map((i) => (
        <Link key={i.href} href={i.href} className={on(i.href) ? 'on' : ''}><Icon name={i.icon} /> <span>{i.label}</span></Link>
      ))}
      <div className="nav-sep" />
      {extra.map((i) => (
        <Link key={i.href} href={i.href} className={`desk-only ${on(i.href) ? 'on' : ''}`}><Icon name={i.icon} /> <span>{i.label}</span></Link>
      ))}
      <button className={`more-btn ${extraActive ? 'on' : ''}`} onClick={() => setMore(!more)} aria-expanded={more}><Icon name="more" /> <span>More</span></button>
      {more && (
        <>
          <div className="sheet-back" onClick={() => setMore(false)} />
          <div className="sheet" role="menu">
            <div className="sheet-who"><b>{name}</b><span className="quiet">{owner ? 'Owner' : role === 'boss' ? 'Boss' : 'Agent'}</span></div>
            {extra.map((i) => <Link key={i.href} href={i.href} className={on(i.href) ? 'on' : ''}><Icon name={i.icon} /> {i.label}</Link>)}
            <form action={logout}><button className="sheet-out"><Icon name="out" /> Sign out</button></form>
          </div>
        </>
      )}
      <div className="me">
        <div>{name}</div>
        <div className="role">{owner ? 'Owner' : role === 'boss' ? 'Boss' : 'Agent'}</div>
        <form action={logout}><button className="link-btn"><Icon name="out" size={15} /> Sign out</button></form>
      </div>
    </nav>
  );
}
