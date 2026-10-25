import Nav from '@/components/Nav';
import { crmMetadata } from '@/lib/crm-meta';

export const metadata = crmMetadata;
import TopBar from '@/components/TopBar';
import { requireUser } from '@/lib/session';

export const dynamic = 'force-dynamic';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const u = await requireUser();
  return (
    <div className="shell">
      <Nav role={u.role} name={u.name} owner={u.is_owner} />
      <div className="main">
        <TopBar />
        {children}
      </div>
    </div>
  );
}
