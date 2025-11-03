import { redirect } from 'next/navigation';
import { requireRole } from '@/lib/auth';
import { dbConnect } from '@/lib/db';
import User from '@/models/User';
import UsersManager from './ui/UsersManager';

export default async function Page() {
  const ses = await requireRole(['admin', 'superadmin']);
  if (!ses) redirect('/login');

  await dbConnect();
  const baseFilter = ses.role === 'admin' ? { role: { $ne: 'superadmin' } } : {};
  const users = await User.find(baseFilter, { password: 0 }).sort({ createdAt: -1 }).lean();
  const initialUsers = users.map((u) => ({
    id: u._id.toString(),
    name: u.name || '',
    email: u.email,
    role: u.role,
    techProfile: u.techProfile || '',
    createdAt: u.createdAt ? u.createdAt.toISOString() : new Date().toISOString()
  }));

  return <UsersManager initialUsers={initialUsers} canManageSuperadmin={ses.role === 'superadmin'} />;
}

