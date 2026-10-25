import { requireUser } from '@/lib/session';
import PasswordForm from './PasswordForm';
import PushToggle from '@/components/PushToggle';
import DialerPicker from '@/components/DialerPicker';
import ForgetDevices from '@/components/ForgetDevices';
import { sql } from '@/lib/db';

const TZ = process.env.APP_TIMEZONE || 'America/New_York';
const when = (d: Date) => new Date(d).toLocaleString('en-US', { timeZone: TZ, month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
export default async function Account() {
  const u = await requireUser();
  const devices = await sql`select label, created_at, last_used_at, expires_at from trusted_devices where user_id = ${u.id} and expires_at > now() order by last_used_at desc`;
  return (
    <div className="page narrow">
      <header className="page-head"><div><h1>{u.must_change_password ? 'Pick your own password' : 'Your account'}</h1>
        <p className="quiet">{u.must_change_password ? 'You signed in with a temporary password. Choose a new one to continue.' : `${u.name} · ${u.email}`}</p></div></header>
      {!u.must_change_password && <section className="card"><h2>Phone and desktop alerts</h2><PushToggle /></section>}
      {!u.must_change_password && <section className="card"><h2>How you place calls</h2><DialerPicker full /></section>}
      <section className="card"><h2>Change password</h2><PasswordForm /></section>
      {!u.must_change_password && (
        <section className="card">
          <div className="row between"><h2>Remembered devices</h2><ForgetDevices count={devices.length} /></div>
          {devices.length === 0
            ? <p className="quiet">None. Tick “Remember this device” when you enter your 6-digit code to skip it for 30 days on that device.</p>
            : <ul className="device-list">{devices.map((d: any, i: number) => (
                <li key={i}><b>{d.label}</b><span className="quiet small">Last used {when(d.last_used_at)} · asks for the code again after {when(d.expires_at)}</span></li>
              ))}</ul>}
        </section>
      )}
      {!u.must_change_password && <p className="quiet small">Lost your authenticator phone? Ask your boss to reset your two-step verification.</p>}
    </div>
  );
}
