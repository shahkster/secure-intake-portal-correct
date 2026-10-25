import { sql } from './db';
import { pushTo } from './push';

/** Personal notification for specific people (bell + phone). */
export async function notify(userIds: (string | null | undefined)[], title: string, body = '', link: string | null = null) {
  const ids = Array.from(new Set(userIds.filter(Boolean))) as string[];
  if (!ids.length) return;
  await sql`insert into notifications ${sql(ids.map((user_id) => ({ user_id, title, body, link })))}`;
  await pushTo(ids, { title, body, url: link ?? '/' });
}

/** Team-wide deal feed — everyone sees it under "All deals" and gets a phone alert. */
export async function dealFeed(title: string, body = '', link: string | null = null) {
  await sql`insert into notifications (user_id, title, body, link) values (null, ${title}, ${body}, ${link})`;
  await pushTo('all', { title, body, url: link ?? '/deals', tag: 'deal' });
}

export async function bossIds(): Promise<string[]> {
  const rows = await sql`select id from users where role = 'boss' and active`;
  return rows.map((r: any) => r.id);
}

/** Phone alerts for callbacks coming up in the next 15 minutes. Runs from the cron and from bell polling. */
let lastRun = 0;
export async function sendDueCallbacks() {
  if (Date.now() - lastRun < 55_000) return;
  lastRun = Date.now();
  const due = await sql`update leads set callback_notified_at = now()
    where status = 'Callback' and callback_at is not null and callback_notified_at is null
      and callback_at <= now() + interval '15 minutes' and callback_at > now() - interval '2 hours'
      and assigned_to is not null and not dnc and not is_agent
    returning id, first_name, last_name, phone, callback_at, assigned_to`;
  for (const l of due as any[]) {
    const mins = Math.round((new Date(l.callback_at).getTime() - Date.now()) / 60000);
    await pushTo([l.assigned_to], {
      title: mins > 0 ? `Callback in ${mins} min` : 'Callback now',
      body: `${[l.first_name, l.last_name].filter(Boolean).join(' ')} · ${l.phone ?? ''}`,
      url: `/leads/${l.id}`, tag: `cb-${l.id}`,
    });
  }
}
