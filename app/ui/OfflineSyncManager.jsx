'use client';

import { useEffect } from 'react';
import { flushEvaluationQueue } from '../../lib/offline/evaluationsQueue';

export default function OfflineSyncManager() {
  useEffect(() => {
    const handleOnline = () => {
      flushEvaluationQueue().catch((err) =>
        console.error('Error sincronizando evaluaciones', err)
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
