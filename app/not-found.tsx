import Link from 'next/link';
export default function NotFound() {
  return (
    <main className="auth">
      <div className="auth-card">
        <h1>Page not found</h1>
        <p className="quiet">This page doesn’t exist or was removed. If you followed a link to a lead or deal, it may have been deleted.</p>
        <Link className="btn primary" href="/">Go to Today</Link>
      </div>
    </main>
  );
}
