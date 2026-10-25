import type { Metadata } from 'next';
import { BRAND, BRAND_SHORT } from './brand';

/** Branding for CRM pages only (never the client form). */
export const crmMetadata: Metadata = {
  title: BRAND,
  robots: { index: false, follow: false },
  manifest: '/manifest.webmanifest',
  appleWebApp: { capable: true, title: BRAND_SHORT, statusBarStyle: 'black-translucent' },
  icons: { icon: '/icon-192.png', apple: '/apple-touch-icon.png' },
};
