import { Suspense } from 'react';
import { redirect } from 'next/navigation';
import { requireRole } from '@/lib/auth';
import BackButton from '@/app/ui/BackButton';
import Summary from './ui/Summary';

export default async function Page() {
  const ses = await requireRole(['admin', 'superadmin']);
  if (!ses) redirect('/login');

  return (
    <div className="page">
      <div className="page-header">
        <div className="page-header__left">
          <div className="page-header__titles">
            <p className="page-header__eyebrow">Panel de administraci�n</p>
            <h1 className="page-header__title">Reportes</h1>
          </div>
        </div>
      </div>
      <Suspense fallback={<div>Cargando...</div>}>
        <Summary />
      </Suspense>
      <div className="back-button-row">
        <BackButton fallback="/" />
      </div>
    </div>
  );
}
