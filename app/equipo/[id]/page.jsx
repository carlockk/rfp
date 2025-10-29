import { Suspense } from 'react';
import BackButton from '@/app/ui/BackButton';
import { dbConnect } from '@/lib/db';
import Equipment from '@/models/Equipment';
import RegisterForm from './ui/RegisterForm';

export default async function Page({ params }) {
  await dbConnect();
  const eq = await Equipment.findById(params.id).lean();
  if (!eq) {
    return (
      <div className="card">
        <BackButton fallback="/" />
        <p style={{ marginTop: 12 }}>Equipo no encontrado</p>
      </div>
    );
  }

  return (
    <div className="card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <div>
          <h3 style={{ margin: 0 }}>{eq.code} - {eq.type}</h3>
          <div className="label">{eq.brand} {eq.model} · {eq.plate}</div>
        </div>
        <BackButton fallback="/" />
      </div>
      <Suspense fallback={<div>Cargando formulario...</div>}>
        <RegisterForm equipmentId={String(eq._id)} fuel={eq.fuel} adblue={eq.adblue} />
      </Suspense>
    </div>
  );
}
