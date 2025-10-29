
import BackButton from '@/app/ui/BackButton';
import { dbConnect } from '@/lib/db';
import Equipment from '@/models/Equipment';
import Form from '../ui/Form';

export default async function Page({ params }) {
  await dbConnect();
  const data = await Equipment.findById(params.id).lean();
  return (
    <div className="card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <h3 style={{ margin: 0 }}>Editar equipo</h3>
        <BackButton fallback="/admin/equipos" />
      </div>
      <Form data={JSON.parse(JSON.stringify(data))} />
    </div>
  );
}
