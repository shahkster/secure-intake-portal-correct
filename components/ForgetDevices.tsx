'use client';
import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { forgetMyDevices } from '@/app/actions/auth';

export default function ForgetDevices({ count }: { count: number }) {
  const router = useRouter();
  const [busy, start] = useTransition();
  if (!count) return null;
  return (
    <button className="btn sm" disabled={busy} onClick={() => confirm('Make every remembered device ask for your 6-digit code again?') && start(async () => { await forgetMyDevices(); router.refresh(); })}>
      {busy ? 'Forgetting…' : 'Forget all devices'}
    </button>
  );
}
