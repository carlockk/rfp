import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import SupervisorDashboard from '../ui/SupervisorDashboard';

export default async function Page() {
  const session = await getSession();
  if (!session || session.role !== 'supervisor') {
    redirect('/login');
  }

  return <SupervisorDashboard />;
}
