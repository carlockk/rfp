import { redirect } from 'next/navigation';
import BackButton from '@/app/ui/BackButton';
import { dbConnect } from '@/lib/db';
import Equipment from '@/models/Equipment';
import mongoose from 'mongoose';
import { requireRole } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export default async function Page({ params }) {
  const ses = await requireRole(['admin', 'superadmin']);
  if (!ses) redirect('/login');

  await dbConnect();

  const { id } = params || {};
  if (!id || !mongoose.isValidObjectId(id)) {
    return (
      <div className="card">
        <h3 style={{ marginTop: 0 }}>Editar equipo</h3>
        <p style={{ marginTop: 12, color: 'var(--danger)' }}>ID inválido.</p>
        <div className="back-button-row">
          <BackButton fallback="/admin/equipos" />
        </div>
      </div>
    );
  }

  const eq = await Equipment.findById(id)
    .populate('operators.user','name email role techProfile')
    .lean();

  if (!eq) {
    return (
      <div className="card">
        <h3 style={{ marginTop: 0 }}>Editar equipo</h3>
        <p style={{ marginTop: 12 }}>No encontrado</p>
        <div className="back-button-row">
          <BackButton fallback="/admin/equipos" />
        </div>
      </div>
    );
  }

  // Sanitiza ObjectId y fechas para el cliente
  const data = JSON.parse(JSON.stringify(eq));

  // Import dinámico del formulario (evita problemas en build si es client)
  const Form = (await import('../ui/Form')).default;

  return (
    <div className="card">
      <h3 style={{ marginTop: 0 }}>Editar equipo</h3>
      <Form data={data} />
      <div className="back-button-row">
        <BackButton fallback="/admin/equipos" />
      </div>
    </div>
  );
}
