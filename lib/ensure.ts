import { sql } from './db';
import { SCHEMA, SCHEMA_V2, SCHEMA_V3, SCHEMA_V4, SCHEMA_V6, SCHEMA_V7, SCHEMA_V8, SCHEMA_V9 } from './schema';
import { fillFromAddress } from './address';

const VERSION = '9';
let ready: Promise<void> | null = null;

/** Leads saved with the whole address in the street box get city/state/ZIP filled in. */
async function splitOldAddresses(tx: any) {
  const rows = await tx`select id, address, city, state, zip from leads
    where address ~ '[0-9]{5}' or address ~ ',' limit 50000`;
  for (const r of rows) {
    const f = fillFromAddress(r);
    if (f.address !== r.address || f.city !== r.city || f.state !== r.state || f.zip !== r.zip) {
      await tx`update leads set address = ${f.address}, city = ${f.city}, state = ${f.state}, zip = ${f.zip} where id = ${r.id}`;
    }
  }
}

async function currentVersion(q: any) {
  const [{ t }] = await q`select to_regclass('public.settings') as t`;
  if (!t) return null;
  const [r] = await q`select value from settings where key = 'schema_version'`;
  return r?.value ?? null;
}

/**
 * Creates/updates tables once. Skips instantly when the database is already current,
 * and takes a lock so two servers starting together never migrate at the same time.
 */
export function ensureSchema() {
  if (!ready) {
    ready = (async () => {
      if ((await currentVersion(sql)) === VERSION) return;
      await sql.begin(async (tx: any) => {
        await tx`select pg_advisory_xact_lock(7244110)`;
        if ((await currentVersion(tx)) === VERSION) return;
        await tx.unsafe(SCHEMA);
        await tx.unsafe(SCHEMA_V2);
        await tx.unsafe(SCHEMA_V3);
        await tx.unsafe(SCHEMA_V4);
        await tx.unsafe(SCHEMA_V6);
        await tx.unsafe(SCHEMA_V7);
        await tx.unsafe(SCHEMA_V8);
        await tx.unsafe(SCHEMA_V9);
        await splitOldAddresses(tx);
        await tx`insert into settings (key, value) values ('schema_version', ${VERSION})
          on conflict (key) do update set value = excluded.value`;
      });
    })().catch((e) => { ready = null; throw e; });
  }
  return ready;
}
