
import { Suspense } from 'react';
import Dashboard from './ui/Dashboard';

export default function Page({ searchParams }) {
  return (
    <Suspense fallback={<div className="card">Cargando dashboard...</div>}>
      <Dashboard searchParams={searchParams} />
    </Suspense>
  );
}
