'use client';

import { useEffect, useState } from 'react';

export default function OfflineBanner() {
  const [isOffline, setIsOffline] = useState(
    typeof navigator !== 'undefined' ? !navigator.onLine : false
  );

  useEffect(() => {
    function updateStatus() {
      setIsOffline(!navigator.onLine);
    }
    window.addEventListener('online', updateStatus);
    window.addEventListener('offline', updateStatus);
    return () => {
      window.removeEventListener('online', updateStatus);
      window.removeEventListener('offline', updateStatus);
    };
  }, []);

  if (!isOffline) return null;

  return (
    <div
      role="status"
      aria-live="assertive"
      style={{
        position: 'fixed',
        bottom: 16,
        left: '50%',
        transform: 'translateX(-50%)',
        background: '#0b4f6c',
        color: '#fff',
        padding: '12px 20px',
        borderRadius: 999,
        boxShadow: '0 6px 20px rgba(0,0,0,0.25)',
        zIndex: 1000
      }}
    >
      Sin conexión. Las evaluaciones se enviarán automáticamente al reconectar.
    </div>
  );
}
