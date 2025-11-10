'use client';

import { openDB, type IDBPDatabase, type DBSchema } from 'idb';

export const OFFLINE_DB_NAME = 'flota_offline';
export const OFFLINE_DB_VERSION = 2;

export type PendingAction = {
  id: string;
  type: string;
  payload: Record<string, unknown>;
  createdAt: number;
};

interface FlotaOfflineDB extends DBSchema {
  evaluations_queue: {
    key: string;
    value: {
      id: string;
      payload: Record<string, unknown>;
      createdAt: number;
    };
  };
  resources: {
    key: string;
    value: {
      id: string;
      data: unknown;
      updatedAt: number;
    };
  };
  settings: {
    key: string;
    value: string;
  };
  pending_actions: {
    key: string;
    value: PendingAction;
  };
}

let dbPromise: Promise<IDBPDatabase<FlotaOfflineDB>> | null = null;

type BackgroundSyncRegistration = ServiceWorkerRegistration & {
  sync: SyncManager;
};

const hasBackgroundSync = (
  registration: ServiceWorkerRegistration
): registration is BackgroundSyncRegistration =>
  typeof registration.sync !== 'undefined' &&
  typeof registration.sync.register === 'function';

export const hasIndexedDB = () =>
  typeof window !== 'undefined' && typeof window.indexedDB !== 'undefined';

export function getOfflineDB() {
  if (!hasIndexedDB()) return null;
  if (!dbPromise) {
    dbPromise = openDB<FlotaOfflineDB>(OFFLINE_DB_NAME, OFFLINE_DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains('evaluations_queue')) {
          db.createObjectStore('evaluations_queue', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('resources')) {
          db.createObjectStore('resources', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('settings')) {
          db.createObjectStore('settings');
        }
        if (!db.objectStoreNames.contains('pending_actions')) {
          db.createObjectStore('pending_actions', { keyPath: 'id' });
        }
      }
    });
  }
  return dbPromise;
}

export async function registerBackgroundSync(tag: string) {
  if (
    typeof window === 'undefined' ||
    !('serviceWorker' in navigator) ||
    !('SyncManager' in window)
  ) {
    return;
  }
  try {
    const registration = await navigator.serviceWorker.ready;

    if (!hasBackgroundSync(registration)) {
      console.warn('Background Sync API not available in this browser');
      return;
    }

    await registration.sync.register(tag);
  } catch (error) {
    console.warn('No se pudo registrar sincronización en segundo plano', error);
  }
}
