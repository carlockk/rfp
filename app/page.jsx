
import { Suspense } from 'react';
import Dashboard from './ui/Dashboard';

export default function Page(){
  return (
    <Suspense fallback={<div className="card">Cargando dashboard...</div>}>
      <Dashboard/>
    </Suspense>
  );
}
