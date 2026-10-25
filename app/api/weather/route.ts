import { NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { currentUser } from '@/lib/session';
import { leadWeather } from '@/lib/weather';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const u = await currentUser();
  if (!u) return NextResponse.json({ error: 'signed out' }, { status: 401 });
  const id = new URL(req.url).searchParams.get('id') || '';
  if (!/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ error: 'bad id' }, { status: 400 });
  const [l] = await sql`select id, address, city, state, zip, geo, assigned_to from leads where id = ${id}`;
  if (!l || (u.role !== 'boss' && l.assigned_to !== u.id)) return NextResponse.json({ error: 'not found' }, { status: 404 });
  return NextResponse.json(await leadWeather(l));
}
