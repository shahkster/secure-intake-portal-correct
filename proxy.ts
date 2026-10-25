import { NextResponse, type NextRequest } from 'next/server';
import { verifyToken } from '@/lib/jwt';

const OPEN = ['/login', '/setup'];
// Files anyone can load on the CRM address (app icon, install file, alerts worker).
const CRM_PUBLIC = /^\/(favicon\.ico|robots\.txt|sw\.js|manifest\.webmanifest|icon-\d+\.png|apple-touch-icon\.png)$/;
// The only things the client-form domain will serve.
const CLIENT_PUBLIC = /^\/(secure\/[^/]+|c\/[^/]+|client-icon\.png|client-touch\.png|robots\.txt)$/;

// The client-form domain (e.g. mysecureclient.com). It never shows the CRM, and the CRM address never shows client forms.
const SECURE_HOST = (process.env.SECURE_HOST || '').toLowerCase().replace(/^https?:\/\//, '').replace(/\/.*$/, '').replace(/^www\./, '');

function notFound() {
  return new NextResponse(
    '<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><title>Not found</title>' +
    '<body style="font:16px system-ui;background:#0f1522;color:#8d98ae;display:grid;place-items:center;min-height:100vh;margin:0">' +
    '<p>This page doesn’t exist. Check the link you were sent.</p></body>',
    { status: 404, headers: { 'content-type': 'text/html; charset=utf-8', 'x-robots-tag': 'noindex' } },
  );
}

export async function proxy(req: NextRequest) {
  const p = req.nextUrl.pathname;
  const host = (req.headers.get('host') || '').toLowerCase().split(':')[0].replace(/^www\./, '');

  if (SECURE_HOST) {
    if (host === SECURE_HOST) return CLIENT_PUBLIC.test(p) ? NextResponse.next() : notFound();
    if (p.startsWith('/secure/') || p.startsWith('/c/') || p.startsWith('/client-')) return notFound();
  } else if (p.startsWith('/secure/') || p.startsWith('/c/') || p.startsWith('/client-')) {
    return NextResponse.next();
  }

  if (OPEN.includes(p) || CRM_PUBLIC.test(p) || p.startsWith('/api/cron/')) return NextResponse.next();

  const s = await verifyToken(req.cookies.get('crm_session')?.value);
  const go = (to: string) => NextResponse.redirect(new URL(to, req.url));

  if (!s) return go('/login');
  if (s.stage === 'pending') return p === '/login/2fa' ? NextResponse.next() : go('/login/2fa');
  if (s.stage === 'setup') return p === '/setup-2fa' ? NextResponse.next() : go('/setup-2fa');
  if (p === '/login/2fa' || p === '/setup-2fa') return go('/');
  if (s.mcp && p !== '/account') return go('/account?first=1');
  return NextResponse.next();
}

// Runs on every request except Next's own build files, so the domain wall covers icons and the install file too.
export const config = { matcher: ['/((?!_next/).*)'] };
