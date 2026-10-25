'use client';
import Link from 'next/link';
export default function AppError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="page narrow">
      <section className="card error-card">
        <h1>Something didn’t load</h1>
        <p className="quiet">This is usually a dropped connection. Try again, and if it keeps happening, send your boss this code: <code>{error.digest || 'no code'}</code></p>
        <div className="row gap"><button className="btn primary" onClick={reset}>Try again</button><Link className="btn" href="/">Go to Today</Link></div>
      </section>
    </div>
  );
}
