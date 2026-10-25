import { normState, STATE_TZ } from './constants';

export type Parts = { address: string | null; city: string | null; state: string | null; zip: string | null };

const STATE_NAMES = [
  'district of columbia', 'new hampshire', 'new jersey', 'new mexico', 'new york', 'north carolina', 'north dakota',
  'south carolina', 'south dakota', 'west virginia', 'rhode island', 'puerto rico', 'alabama', 'alaska', 'arizona',
  'arkansas', 'california', 'colorado', 'connecticut', 'delaware', 'florida', 'georgia', 'hawaii', 'idaho', 'illinois',
  'indiana', 'iowa', 'kansas', 'kentucky', 'louisiana', 'maine', 'maryland', 'massachusetts', 'michigan', 'minnesota',
  'mississippi', 'missouri', 'montana', 'nebraska', 'nevada', 'ohio', 'oklahoma', 'oregon', 'pennsylvania', 'tennessee',
  'texas', 'utah', 'vermont', 'virginia', 'washington', 'wisconsin', 'wyoming',
];

// Words that end the street part when there are no commas ("866 Kearny Ave Kearny NJ 07032").
const SUFFIX = new Set(('st street ave avenue av rd road dr drive ln lane blvd boulevard ct court pl place way ter terrace ' +
  'cir circle pkwy parkway hwy highway trl trail sq square loop run pike row aly alley xing crossing pt point cv cove ' +
  'n s e w ne nw se sw north south east west').split(' '));
const UNIT = /^(apt|apartment|unit|ste|suite|#|lot|bldg|building|fl|floor|rm|room|spc|space|trlr)$/i;

const titleCase = (s: string) => s.toLowerCase().replace(/\b([a-z])/g, (c) => c.toUpperCase());

/**
 * Splits "866 Kearny Ave, Kearny, NJ 07032" into street / city / state / ZIP.
 * Returns null when the text doesn't look like a full address (so a plain street stays as typed).
 */
export function splitAddress(raw?: string | null): Parts | null {
  if (!raw) return null;
  let s = raw.replace(/\s+/g, ' ').trim().replace(/[,\s]*(usa|u\.s\.a\.?|united states( of america)?)\.?$/i, '').trim();

  let zip: string | null = null;
  const zm = s.match(/[,\s]+(\d{5})(?:-\d{4})?$/);
  if (zm) { zip = zm[1]; s = s.slice(0, zm.index).trim(); }

  let state: string | null = null;
  const lower = s.toLowerCase();
  const full = STATE_NAMES.find((n) => lower.endsWith(' ' + n) || lower.endsWith(',' + n));
  if (full) { state = normState(full); s = s.slice(0, s.length - full.length).trim(); }
  else {
    const sm = s.match(/[,\s]+([A-Za-z]{2})\.?$/);
    if (sm && STATE_TZ[sm[1].toUpperCase()]) { state = sm[1].toUpperCase(); s = s.slice(0, sm.index).trim(); }
  }
  if (!zip && !state) return null; // not a full address
  s = s.replace(/,\s*$/, '').trim();

  let street: string | null = s;
  let city: string | null = null;
  const parts = s.split(',').map((p) => p.trim()).filter(Boolean);
  if (parts.length >= 2) {
    city = parts.pop()!;
    street = parts.join(', ');
  } else {
    // No commas: the city starts after the last street-type word (or after the unit number).
    const w = s.split(' ');
    let cut = -1;
    for (let i = 1; i < w.length - 1; i++) {
      const t = w[i].toLowerCase().replace(/[.,]/g, '');
      if (UNIT.test(t)) { cut = Math.min(i + 1, w.length - 2); continue; }
      if (SUFFIX.has(t) && !/^\d/.test(w[i + 1] || '')) cut = Math.max(cut, i);
    }
    if (cut >= 0 && cut < w.length - 1) { street = w.slice(0, cut + 1).join(' '); city = w.slice(cut + 1).join(' '); }
  }
  if (city && city === city.toUpperCase()) city = titleCase(city);
  return { address: street || null, city: city || null, state, zip };
}

/** Fills in only the empty fields of a lead from its street box when it holds a whole address. */
export function fillFromAddress<T extends { address?: any; city?: any; state?: any; zip?: any }>(row: T): T {
  const p = splitAddress(row.address);
  if (!p) return row;
  return {
    ...row,
    address: p.address ?? row.address,
    city: row.city || p.city,
    state: row.state || p.state,
    zip: row.zip || p.zip,
  };
}
