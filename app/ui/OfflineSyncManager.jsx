'use client';

import { useEffect } from 'react';
import { flushEvaluationQueue } from '../../lib/offline/evaluationsQueue';
import { cacheEquipments } from '@/lib/offline/resources';
import { registerBackgroundSync } from '@/lib/offline/db';

async function syncEquipmentsCache() {
  try {
    const response = await fetch('/api/equipments', { cache: 'no-store' });
    if (!response.ok) return;
    const equipments = await response.json();
    await cacheEquipments(equipments);
  } catch (error) {
    console.warn('No se pudo actualizar el cache de equipos', error);
  }
}

export default function OfflineSyncManager() {
  useEffect(() => {
    registerBackgroundSync('sync-evaluations').catch(() => {});
    const handleOnline = () => {
      Promise.all([flushEvaluationQueue(), syncEquipmentsCache()]).catch((err) =>
        console.error('Error sincronizando datos offline', err)
      );
    };

    window.addEventListener('online', handleOnline);
    handleOnline();

    return () => {
      window.removeEventListener('online', handleOnline);
    };
  }, []);

  return null;
}
