import './globals.css';
import { Suspense } from 'react';
import SidebarContainer from './ui/SidebarContainer';
import OfflineBanner from './ui/OfflineBanner';
import OfflineSyncManager from './ui/OfflineSyncManager';
import PushRegistration from './ui/PushRegistration';
import { getSession } from '@/lib/auth';

export const metadata = {
  title: process.env.NEXT_PUBLIC_APP_NAME || 'Flota QR',
  description: 'Gestión de flota con QR, consumo y mantenciones',
  manifest: '/manifest.json',
  icons: [
    { rel: 'icon', url: '/log.png', sizes: '256x256' },
    { rel: 'apple-touch-icon', url: '/flota.png', sizes: '512x512' }
  ]
};

export const viewport = {
  themeColor: '#0b4f6c'
};

export default async function RootLayout({ children }) {
  const session = await getSession();
  const isAuthenticated = Boolean(session);
  const navLinks =
    session?.role === 'tecnico'
      ? [
          { href: '/', label: 'Mis equipos' },
          { href: '/equipo/scan', label: 'Escanear QR' }
        ]
      : session?.role === 'supervisor'
        ? [
            { href: '/supervisor', label: 'Checklists asignados' },
            { href: '/supervisor/operador', label: 'Modo operador' },
            { href: '/equipo/scan', label: 'Escanear QR' }
          ]
      : [
          { href: '/', label: 'Dashboard' },
          { href: '/admin/equipos', label: 'Equipos' },
          { href: '/admin/checklists', label: 'Checklists' },
          { href: '/admin/formularios', label: 'Formularios' },
          { href: '/admin/checklists/historial', label: 'Historial' },
          { href: '/admin/anomalias', label: 'Anomalias' },
          { href: '/admin/reportes', label: 'Reportes' },
          { href: '/admin/usuarios', label: 'Usuarios' }
        ];

  const variant =
    session?.role === 'tecnico'
      ? session?.techProfile === 'candelaria'
        ? 'candelaria'
        : 'externo'
      : session?.role === 'supervisor'
        ? 'supervisor'
      : 'admin';

  return (
    <html lang='es' data-theme='light'>
      <body>
        <OfflineBanner />
        {isAuthenticated ? (
          <div className='app-shell'>
            <SidebarContainer links={navLinks} />
            <div className='app-main'>
              <OfflineSyncManager />
              <PushRegistration role={session?.role} />
              <main className='app-content'>
                <Suspense fallback={<div className='card'>Cargando...</div>}>
                  {children}
                </Suspense>
              </main>
              <div className={`construction-bar construction-bar--${variant}`} aria-hidden='true'></div>
            </div>
          </div>
        ) : (
          <main>
            <Suspense fallback={<div className='card'>Cargando...</div>}>
              {children}
            </Suspense>
          </main>
        )}
      </body>
    </html>
  );
}
