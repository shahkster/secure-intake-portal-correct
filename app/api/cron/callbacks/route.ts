import { NextResponse } from 'next/server';
import { ensureSchema } from '@/lib/ensure';
import { sendDueCallbacks } from '@/lib/notify';
import { safeEqual } from '@/lib/throttle';

export const dynamic = 'force-dynamic';

// Hit this every 5 minutes (Vercel Cron on Pro, or a free service like cron-job.org).
// Auth: "Authorization: Bearer CRON_SECRET" header, or ?key=CRON_SECRET.
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  const url = new URL(req.url);
  const given = req.headers.get('authorization')?.replace('Bearer ', '') || url.searchParams.get('key');
  if (!secret || secret.length < 16 || !safeEqual(given || '', secret)) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  await ensureSchema();
  await sendDueCallbacks();
  return NextResponse.json({ ok: true });
}
