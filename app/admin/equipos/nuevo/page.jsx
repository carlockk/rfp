
import BackButton from '@/app/ui/BackButton';
import Form from '../ui/Form';

export default function Page() {
  return (
    <div className="card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <h3 style={{ margin: 0 }}>Nuevo equipo</h3>
        <BackButton fallback="/admin/equipos" />
      </div>
      <Form />
    </div>
  );
}
