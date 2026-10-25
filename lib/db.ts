import postgres from 'postgres';

// Neon adds settings to its address (like channel_binding) that this database library
// doesn't understand and would send to the server as errors. Remove them here.
function cleanUrl(raw: string) {
  try {
    const u = new URL(raw);
    for (const k of ['channel_binding', 'sslmode', 'sslrootcert', 'options', 'pgbouncer']) u.searchParams.delete(k);
    return u.toString();
  } catch {
    return raw;
  }
}

const g = globalThis as any;
const url = cleanUrl(process.env.DATABASE_URL || '');
const local = url.includes('localhost') || url.includes('127.0.0.1');

export const sql: postgres.Sql<any> =
  g.__crm_sql ??
  postgres(url, {
    // Verifies the database's certificate. Set DB_SSL=require only if your provider uses a private certificate.
    ssl: local ? false : ((process.env.DB_SSL as any) || 'verify-full'),
    max: 5,
    idle_timeout: 20,
    connect_timeout: 15,
    prepare: false, // works with Neon's connection pooler
    onnotice: () => {},
  });
if (process.env.NODE_ENV !== 'production') g.__crm_sql = sql;
