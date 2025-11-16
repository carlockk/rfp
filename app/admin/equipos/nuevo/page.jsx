import { redirect } from 'next/navigation';
import { requireRole } from '@/lib/auth';
import BackButton from '@/app/ui/BackButton';
import Form from '../ui/Form';

export default async function Page() {
  const ses = await requireRole(['admin', 'superadmin']);
  if (!ses) redirect('/login');

  return (
    <div className="card">
      <h3 style={{ marginTop: 0 }}>Nuevo equipo</h3>
      <Form />
      <div className="back-button-row">
        <BackButton fallback="/admin/equipos" />
      </div>
    </div>
  );
}
