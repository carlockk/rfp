import { Suspense } from 'react';
import BackButton from '@/app/ui/BackButton';
import Summary from './ui/Summary';

export default function Page() {
  return (
    <div className="card card--page">
      <div className="page-header">
        <div className="page-header__left">
          <BackButton fallback="/" />
          <div className="page-header__titles">
            <p className="page-header__eyebrow">Panel de administración</p>
            <h1 className="page-header__title">Reportes</h1>
          </div>
        </div>
      </div>
      <Suspense fallback={<div>Cargando...</div>}>
        <Summary />
      </Suspense>
    </div>
  );
}
