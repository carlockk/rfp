'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import ThemeToggle from './ThemeToggle';
import LogoutButton from './LogoutButton';
import SidebarNav from './SidebarNav';
import flotaLogo from '@/public/log.png';

export default function SidebarContainer({ links }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  return (
    <>
      <button
        type="button"
        className="sidebar__burger"
        aria-label="Abrir menú"
        onClick={() => setOpen(true)}
      >
        {String.fromCharCode(0x2261)}
      </button>
      <aside className={`sidebar${open ? ' sidebar--open' : ''}`}>
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
          <span className="sidebar__brand">R F P</span>
          <span className="sidebar__brand">Control de flotas</span>
        </div>
        <SidebarNav links={links} />
        <div className="sidebar__footer">
          <ThemeToggle />
          <LogoutButton />
        </div>
      </aside>
      {open ? (
        <div className="sidebar__backdrop" onClick={() => setOpen(false)} aria-hidden="true"></div>
      ) : null}
    </>
  );
}
