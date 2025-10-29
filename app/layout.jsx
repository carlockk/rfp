import './globals.css';
import Image from 'next/image';
import { Suspense } from 'react';
import ThemeToggle from './ui/ThemeToggle';
import LogoutButton from './ui/LogoutButton';
import SidebarNav from './ui/SidebarNav';
import { getSession } from '@/lib/auth';
import flotaLogo from '@/public/flota.png';

export const metadata = {
  title: process.env.NEXT_PUBLIC_APP_NAME || 'Flota QR',
  description: 'Gestion de flota con QR, consumo y mantenciones'
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
            <aside className="sidebar">
              <div className="sidebar__logo">
                <div className="sidebar__logo-ring">
                  <Image
                    src={flotaLogo}
                    alt="Flota"
                    width={64}
                    height={64}
                    className="sidebar__logo-image"
                    priority
                  />
                </div>
                <span className="sidebar__brand">FLOTA</span>
              </div>
              <SidebarNav links={navLinks} />
              <div className="sidebar__footer">
                <ThemeToggle />
                <LogoutButton />
              </div>
            </aside>
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
