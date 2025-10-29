import './globals.css';
import { Suspense } from 'react';
import SidebarContainer from './ui/SidebarContainer';
import { getSession } from '@/lib/auth';

export const metadata = {
  title: process.env.NEXT_PUBLIC_APP_NAME || 'Flota QR',
  description: 'Gestión de flota con QR, consumo y mantenciones'
};

export default async function RootLayout({ children }) {
  const session = await getSession();
  const isAuthenticated = Boolean(session);
  const navLinks = [
    { href: '/', label: 'Dashboard' },
    { href: '/admin/equipos', label: 'Equipos' },
    { href: '/admin/reportes', label: 'Reportes' },
    { href: '/admin/usuarios', label: 'Usuarios' }
  ];

  return (
    <html lang="es" data-theme="light">
      <body>
        {isAuthenticated ? (
          <div className="app-shell">
            <SidebarContainer links={navLinks} />
            <div className="app-main">
              <div className="construction-bar" aria-hidden="true"></div>
              <main className="app-content">
                <Suspense fallback={<div className="card">Cargando...</div>}>
                  {children}
                </Suspense>
              </main>
            </div>
          </div>
        ) : (
          <main>
            <Suspense fallback={<div className="card">Cargando...</div>}>
              {children}
            </Suspense>
          </main>
        )}
      </body>
    </html>
  );
}






