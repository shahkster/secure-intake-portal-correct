import type { Tone } from '@/lib/constants';
export default function Pill({ tone, children }: { tone: Tone; children: React.ReactNode }) {
  return <span className={`pill t-${tone}`}>{children}</span>;
}
