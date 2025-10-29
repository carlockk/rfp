
import { Suspense } from 'react';
import BackButton from '@/app/ui/BackButton';
import Summary from './ui/Summary';

export default function Page() {
  return (
    <div className="card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <BackButton fallback="/" />
          <h3 style={{ margin: 0 }}>Reportes</h3>
        </div>
      </div>
      <Suspense fallback={<div>Cargando...</div>}>
        <Summary />
      </Suspense>
    </div>
  );
}
