import webpush from 'web-push';
import { sql } from './db';
import { encrypt, decrypt } from './crypto';

let ready: Promise<string> | null = null;

/** VAPID keys are created automatically the first time and kept (encrypted) in the database. */
export function pushKey(): Promise<string> {
  if (!ready) {
    ready = (async () => {
      let [row] = await sql`select value from settings where key = 'vapid'`;
      if (!row) {
        const k = webpush.generateVAPIDKeys();
        await sql`insert into settings (key, value) values ('vapid', ${JSON.stringify({ pub: k.publicKey, priv: encrypt(k.privateKey) })})
          on conflict (key) do nothing`;
        [row] = await sql`select value from settings where key = 'vapid'`;
      }
      let v = JSON.parse(row.value);
      let priv: string;
      try { priv = decrypt(v.priv); } catch {
        // ENCRYPTION_KEY changed: make fresh keys. Devices re-subscribe automatically next time they open the app.
        const k = webpush.generateVAPIDKeys();
        v = { pub: k.publicKey, priv: encrypt(k.privateKey) };
        await sql`update settings set value = ${JSON.stringify(v)} where key = 'vapid'`;
        await sql`delete from push_subscriptions`;
        priv = k.privateKey;
      }
      const [boss] = await sql`select email from users where role = 'boss' order by created_at limit 1`;
      webpush.setVapidDetails(`mailto:${boss?.email || 'admin@example.com'}`, v.pub, priv);
      return v.pub as string;
    })().catch((e) => { ready = null; throw e; });
  }
  return ready;
}

export type PushMsg = { title: string; body?: string; url?: string; tag?: string };

/** Sends to everyone's phones/computers when userIds is 'all'. Never throws. */
export async function pushTo(userIds: string[] | 'all', msg: PushMsg) {
  try {
    if (userIds !== 'all' && !userIds.length) return;
    await pushKey();
    const subs = userIds === 'all'
      ? await sql`select s.* from push_subscriptions s join users u on u.id = s.user_id where u.active`
      : await sql`select s.* from push_subscriptions s join users u on u.id = s.user_id where u.active and s.user_id in ${sql(userIds)}`;
    const payload = JSON.stringify(msg);
    await Promise.all(subs.map(async (s: any) => {
      try {
        await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, payload, { TTL: 3600, urgency: 'high' });
      } catch (e: any) {
        if (e?.statusCode === 404 || e?.statusCode === 410) await sql`delete from push_subscriptions where id = ${s.id}`;
      }
    }));
  } catch (e) {
    console.error('push failed', e);
  }
}
