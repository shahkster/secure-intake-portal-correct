import { sql } from './db';

const UA = { 'User-Agent': `(${process.env.APP_NAME || 'LEGACY COMFORT LIFE'}, crm-weather)`, Accept: 'application/geo+json' };

export function forecastLink(l: { city?: string; state?: string; zip?: string; geo?: string | null }) {
  if (l.geo) {
    const [lat, lon] = l.geo.split('|')[0].split(',');
    return `https://forecast.weather.gov/MapClick.php?lat=${lat}&lon=${lon}`;
  }
  const q = l.zip || [l.city, l.state].filter(Boolean).join(', ');
  return q ? `https://forecast.weather.gov/zipcity.php?inputstring=${encodeURIComponent(q)}` : null;
}

/** Current conditions at the lead's address (US Census geocoder + National Weather Service, both free). */
export async function leadWeather(l: any) {
  const link = forecastLink(l);
  const addr = [l.address, l.city, l.state, l.zip].filter(Boolean).join(', ');
  let coords: string | null = null;
  if (l.geo && l.geo.split('|')[1] === addr) coords = l.geo.split('|')[0];
  if (!coords && l.address && (l.zip || (l.city && l.state))) {
    try {
      const r = await fetch(`https://geocoding.geo.census.gov/geocoder/locations/onelineaddress?address=${encodeURIComponent(addr)}&benchmark=Public_AR_Current&format=json`,
        { cache: 'no-store', signal: AbortSignal.timeout(7000) });
      const j = await r.json();
      const c = j?.result?.addressMatches?.[0]?.coordinates;
      if (c) {
        coords = `${Number(c.y).toFixed(4)},${Number(c.x).toFixed(4)}`;
        await sql`update leads set geo = ${coords + '|' + addr} where id = ${l.id}`;
      }
    } catch { /* fall back to link only */ }
  }
  if (!coords) return { link, place: [l.city, l.state].filter(Boolean).join(', ') || null };
  try {
    const p = await fetch(`https://api.weather.gov/points/${coords}`, { headers: UA, next: { revalidate: 86400 }, signal: AbortSignal.timeout(7000) });
    const pj = await p.json();
    const hourlyUrl = String(pj?.properties?.forecastHourly || '');
    if (!hourlyUrl.startsWith('https://api.weather.gov/')) throw new Error('unexpected forecast URL');
    const place = pj?.properties?.relativeLocation?.properties;
    const h = await fetch(hourlyUrl, { headers: UA, next: { revalidate: 900 }, signal: AbortSignal.timeout(7000) });
    const hj = await h.json();
    const now = hj?.properties?.periods?.[0];
    const [lat, lon] = coords.split(',');
    return {
      link: `https://forecast.weather.gov/MapClick.php?lat=${lat}&lon=${lon}`,
      place: place ? `${place.city}, ${place.state}` : [l.city, l.state].filter(Boolean).join(', '),
      temp: now?.temperature, unit: now?.temperatureUnit, short: now?.shortForecast,
    };
  } catch {
    return { link, place: [l.city, l.state].filter(Boolean).join(', ') || null };
  }
}
