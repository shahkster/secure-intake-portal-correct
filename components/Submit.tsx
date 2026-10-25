'use client';
import { useFormStatus } from 'react-dom';
export default function Submit({ children, className = 'btn primary' }: { children: React.ReactNode; className?: string }) {
  const { pending } = useFormStatus();
  return <button className={className} disabled={pending}>{pending ? 'Working…' : children}</button>;
}
