import BackButton from '@/app/ui/BackButton';
import { dbConnect } from '@/lib/db';
import Equipment from '@/models/Equipment';
import mongoose from 'mongoose';

export const dynamic = 'force-dynamic';

export default async function Page({ params }) {
  await dbConnect();

  const { id } = params || {};
  if (!id || !mongoose.isValidObjectId(id)) {
    return (
      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <h3 style={{ margin: 0 }}>Editar equipo</h3>
          <BackButton fallback="/admin/equipos" />
        </div>
        <p style={{ marginTop: 12, color: 'var(--danger)' }}>ID inválido.</p>
      </div>
    );
  }

  const eq = await Equipment.findById(id).lean();

  if (!eq) {
    return (
      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <h3 style={{ margin: 0 }}>Editar equipo</h3>
          <BackButton fallback="/admin/equipos" />
        </div>
        <p style={{ marginTop: 12 }}>No encontrado</p>
      </div>
    );
  }

  // Sanitiza ObjectId y fechas para el cliente
  const data = JSON.parse(JSON.stringify(eq));

  // Import dinámico del formulario (evita problemas en build si es client)
  const Form = (await import('../ui/Form')).default;

  return (
    <div className="card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <h3 style={{ margin: 0 }}>Editar equipo</h3>
        <BackButton fallback="/admin/equipos" />
      </div>
      <Form data={data} />
    </div>
  );
}
