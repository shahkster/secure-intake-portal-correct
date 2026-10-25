import './globals.css';

// Kept neutral on purpose: the client form domain must not reveal the company or the CRM.
export const metadata = { title: 'Secure form', robots: { index: false, follow: false } };
export const viewport = { width: 'device-width', initialScale: 1, viewportFit: 'cover', themeColor: '#0f1522' };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html lang="en"><body>{children}</body></html>;
}
