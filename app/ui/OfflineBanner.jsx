'use client';

import { useEffect, useState } from 'react';

export default function OfflineBanner() {
  const [online, setOnline] = useState(
    typeof navigator === 'undefined' ? true : navigator.onLine
  );

  useEffect(() => {
    function updateStatus() {
      setOnline(navigator.onLine);
    }
    window.addEventListener('online', updateStatus);
    window.addEventListener('offline', updateStatus);
    return () => {
      window.removeEventListener('online', updateStatus);
      window.removeEventListener('offline', updateStatus);
    };
  }, []);

  const message = online
    ? 'Conexión restablecida: los cambios se sincronizan automáticamente.'
    : 'Modo offline: tus cambios se guardarán cuando vuelva la conexión.';

  const stateClass = online ? 'network-banner--online' : 'network-banner--offline';

  return (
    <div role="status" aria-live="polite" className={`network-banner ${stateClass}`}>
      {message}
    </div>
  );
}
