import { redirect } from 'next/navigation';
import LoginForm from './LoginForm';
import { currentUser } from '@/lib/session';
export default async function Login(props: { searchParams: Promise<{ ready?: string }> }) {
  const searchParams = await props.searchParams;
  if (await currentUser()) redirect('/');
  return (
    <main className="auth">
      <div className="auth-card">
        <h1>Sign in</h1>
        <p className="quiet">Accounts are created by your agency. Ask your boss if you need one.</p>
        <LoginForm ready={!!searchParams.ready} />
      </div>
    </main>
  );
}
