import { sql } from './db';
import { brandFromBin } from './card';

export type BinInfo = { brand?: string; type?: string; bank?: string; country?: string; prepaid?: boolean; note?: string };

const title = (s?: string) => s ? s.replace(/\b\w/g, (c) => c.toUpperCase()) : undefined;

/** Looks up the card issuer from the first 6 digits only (binlist.net, cached). The full card number never reaches the server. */
export async function lookupBin(raw: string): Promise<BinInfo> {
  const bin = (raw || '').replace(/\D/g, '').slice(0, 6);
  if (bin.length < 6) return { note: 'Type at least 6 digits.' };
  const brand = brandFromBin(bin);
  const [hit] = await sql`select data from bin_cache where bin = ${bin} and fetched_at > now() - interval '180 days'`;
  if (hit) return hit.data;
  try {
    const r = await fetch(`https://lookup.binlist.net/${bin}`, { headers: { 'Accept-Version': '3' }, cache: 'no-store', signal: AbortSignal.timeout(6000) });
    if (r.status === 404) return { brand, note: 'The bank for this card isn’t in the public BIN list.' };
    if (r.status === 429) return { brand, note: 'Bank lookup is busy. Try again in a few minutes.' };
    if (!r.ok) return { brand, note: 'Bank lookup is unavailable right now.' };
    const j = await r.json();
    const info: BinInfo = {
      brand: title(j.scheme) === 'Amex' ? 'American Express' : title(j.scheme) || brand,
      type: j.type ? title(j.type) : undefined,
      bank: j.bank?.name || undefined,
      country: j.country?.name || undefined,
      prepaid: typeof j.prepaid === 'boolean' ? j.prepaid : undefined,
    };
    await sql`insert into bin_cache (bin, data) values (${bin}, ${sql.json(info as any)})
      on conflict (bin) do update set data = excluded.data, fetched_at = now()`;
    return info;
  } catch {
    return { brand, note: 'Bank lookup is unavailable right now.' };
  }
}

