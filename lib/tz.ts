import { STATE_TZ } from './constants';

// States split across time zones: ZIP prefixes (first 3 digits) that differ from the state's main zone.
const ZIP3_TZ: Record<string, string> = {
  '324': 'America/Chicago', '325': 'America/Chicago', // Florida panhandle
  '798': 'America/Denver', '799': 'America/Denver', '885': 'America/Denver', // El Paso, TX
  '835': 'America/Los_Angeles', '838': 'America/Los_Angeles', // North Idaho
  '979': 'America/Boise', // Ontario, OR
  '373': 'America/New_York', '374': 'America/New_York', '376': 'America/New_York', '377': 'America/New_York',
  '378': 'America/New_York', '379': 'America/New_York', // East Tennessee
  '420': 'America/Chicago', '421': 'America/Chicago', '422': 'America/Chicago', '423': 'America/Chicago',
  '424': 'America/Chicago', // West Kentucky
  '463': 'America/Chicago', '464': 'America/Chicago', '476': 'America/Chicago', '477': 'America/Chicago', // NW & SW Indiana
  '691': 'America/Denver', '693': 'America/Denver', // West Nebraska
  '577': 'America/Denver', // West South Dakota
  '586': 'America/Denver', // SW North Dakota
};

export function tzFor(state?: string | null, zip?: string | null) {
  const z = (zip || '').replace(/\D/g, '').slice(0, 3);
  if (z.length === 3 && ZIP3_TZ[z]) return ZIP3_TZ[z];
  return state ? STATE_TZ[state] : undefined;
}

export function tzAbbr(tz: string, at = new Date()) {
  return new Intl.DateTimeFormat('en-US', { timeZone: tz, timeZoneName: 'short' })
    .formatToParts(at).find((p) => p.type === 'timeZoneName')?.value ?? '';
}

/** Lead's local time and whether it's inside 8am–9pm calling hours. */
export function localTime(state?: string | null, now = new Date(), zip?: string | null) {
  const tz = tzFor(state, zip);
  if (!tz) return null;
  const time = new Intl.DateTimeFormat('en-US', { timeZone: tz, hour: 'numeric', minute: '2-digit' }).format(now);
  const hour = Number(new Intl.DateTimeFormat('en-US', { timeZone: tz, hour: 'numeric', hourCycle: 'h23' }).format(now));
  return { time, ok: hour >= 8 && hour < 21, abbr: tzAbbr(tz, now), tz };
}

export function timeIn(iso: string | Date, tz?: string) {
  return new Date(iso).toLocaleString('en-US', { timeZone: tz, hour: 'numeric', minute: '2-digit' });
}

function offsetMs(tz: string, d: Date) {
  const p = new Intl.DateTimeFormat('en-US', {
    timeZone: tz, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  }).formatToParts(d);
  const g = (t: string) => Number(p.find((x) => x.type === t)!.value);
  return Date.UTC(g('year'), g('month') - 1, g('day'), g('hour') % 24, g('minute'), g('second')) - Math.floor(d.getTime() / 1000) * 1000;
}

/** "2026-10-21T15:00" read as a wall clock in `tz` → real instant. */
export function wallToDate(wall: string, tz: string) {
  const [d, t] = wall.split('T');
  const [y, m, dd] = d.split('-').map(Number);
  const [hh, mm] = t.split(':').map(Number);
  const guess = Date.UTC(y, m - 1, dd, hh, mm);
  const off = offsetMs(tz, new Date(guess));
  let res = guess - off;
  const off2 = offsetMs(tz, new Date(res));
  if (off2 !== off) res = guess - off2;
  return new Date(res);
}

/** Real instant → "YYYY-MM-DDTHH:mm" wall clock in `tz` (for datetime-local inputs). */
export function dateToWall(iso: string | Date, tz: string) {
  const d = new Date(iso);
  return new Date(d.getTime() + offsetMs(tz, d)).toISOString().slice(0, 16);
}

export const myTz = () => Intl.DateTimeFormat().resolvedOptions().timeZone;
