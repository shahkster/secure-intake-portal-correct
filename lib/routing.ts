import { sql } from './db';

/** ABA mod-10 checksum — catches most typos with no network call. */
export function abaValid(rn: string) {
  if (!/^\d{9}$/.test(rn)) return false;
  const d = rn.split('').map(Number);
  return (3 * (d[0] + d[3] + d[6]) + 7 * (d[1] + d[4] + d[7]) + (d[2] + d[5] + d[8])) % 10 === 0;
}

export type BankInfo = { valid: boolean; bank?: string; city?: string; state?: string; note?: string };

/** Looks up who the bank is. Uses API Ninjas when ROUTING_API_KEY is set; results are cached. */
export async function lookupRouting(raw: string): Promise<BankInfo> {
  const rn = (raw || '').replace(/\D/g, '');
  if (rn.length !== 9) return { valid: false, note: 'Routing numbers are 9 digits.' };
  if (!abaValid(rn)) return { valid: false, note: 'This isn’t a real routing number. Check for a typo.' };

  const [hit] = await sql`select bank, city, state from routing_cache where rn = ${rn} and fetched_at > now() - interval '90 days'`;
  if (hit?.bank) return { valid: true, bank: hit.bank, city: hit.city, state: hit.state };

  const key = process.env.ROUTING_API_KEY;
  if (!key) return { valid: true, note: 'Number format checks out. Add ROUTING_API_KEY to also see the bank name.' };
  try {
    const r = await fetch(`https://api.api-ninjas.com/v1/routingnumber?routing_number=${rn}`, {
      headers: { 'X-Api-Key': key }, cache: 'no-store', signal: AbortSignal.timeout(6000),
    });
    if (!r.ok) return { valid: true, note: 'Number format checks out. Bank lookup is unavailable right now.' };
    const j = await r.json();
    const row = Array.isArray(j) ? j[0] : j;
    if (!row?.bank_name) return { valid: true, note: 'Number format checks out, but no bank was found for it. Double-check with the client.' };
    const info = { bank: String(row.bank_name), city: row.city ? String(row.city) : null, state: row.state ? String(row.state) : null };
    await sql`insert into routing_cache (rn, bank, city, state) values (${rn}, ${info.bank}, ${info.city}, ${info.state})
      on conflict (rn) do update set bank = excluded.bank, city = excluded.city, state = excluded.state, fetched_at = now()`;
    return { valid: true, bank: info.bank, city: info.city ?? undefined, state: info.state ?? undefined };
  } catch {
    return { valid: true, note: 'Number format checks out. Bank lookup is unavailable right now.' };
  }
}
