'use client';

import { useEffect, useMemo, useRef, useState } from 'react';

const ONLINE_VISIBILITY_MS = 10_000;
const OFFLINE_VISIBILITY_MS = 15_000;

export default function OfflineBanner() {
  const [online, setOnline] = useState(
    typeof navigator === 'undefined' ? true : navigator.onLine
  );
  const [visible, setVisible] = useState(true);
  const timeoutRef = useRef(null);

  useEffect(() => {
    function scheduleHide(nextOnline) {
      const duration = nextOnline ? ONLINE_VISIBILITY_MS : OFFLINE_VISIBILITY_MS;
      timeoutRef.current = window.setTimeout(() => setVisible(false), duration);
    }

    function updateStatus() {
      const nextOnline = navigator.onLine;
      setOnline(nextOnline);
      setVisible(true);
      if (timeoutRef.current) {
        window.clearTimeout(timeoutRef.current);
      }
      scheduleHide(nextOnline);
    }

    scheduleHide(online);
    window.addEventListener('online', updateStatus);
    window.addEventListener('offline', updateStatus);

    return () => {
      if (timeoutRef.current) {
        window.clearTimeout(timeoutRef.current);
      }
      window.removeEventListener('online', updateStatus);
      window.removeEventListener('offline', updateStatus);
    };
    // We intentionally run this effect only once on mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const message = useMemo(
    () =>
      online
        ? 'Conexion restablecida: los cambios se sincronizan automaticamente.'
        : 'Modo offline: tus cambios se guardaran cuando vuelva la conexion.',
    [online]
  );

  const stateClass = online ? 'network-banner--online' : 'network-banner--offline';

  if (!visible) return null;

  return (
    <div role="status" aria-live="polite" className={`network-banner ${stateClass}`}>
      {message}
    </div>
  );
}
