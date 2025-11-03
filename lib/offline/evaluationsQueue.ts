'use client';

type EvaluationPayload = Record<string, unknown>;

type QueuedEvaluation = {
  id: string;
  payload: EvaluationPayload;
  createdAt: number;
};

const DB_NAME = 'flota_offline';
const STORE_NAME = 'evaluations_queue';
const DB_VERSION = 1;

let dbPromise: Promise<IDBDatabase> | null = null;

const hasIndexedDB = () =>
  typeof window !== 'undefined' && typeof indexedDB !== 'undefined';

function openDB(): Promise<IDBDatabase> {
  if (!hasIndexedDB()) {
    return Promise.reject(new Error('IndexedDB no disponible'));
  }
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }
  return dbPromise;
}

function runTransaction<T>(
  mode: IDBTransactionMode,
  runner: (store: IDBObjectStore) => IDBRequest<T> | void
): Promise<T | undefined> {
  return openDB().then(
    (db) =>
      new Promise<T | undefined>((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, mode);
        const store = tx.objectStore(STORE_NAME);
        const request = runner(store);
        tx.oncomplete = () => {
          if (request && 'result' in request) {
            resolve(request.result as T);
          } else {
            resolve(undefined);
          }
        };
        tx.onabort = () => reject(tx.error);
        tx.onerror = () => reject(tx.error);
      })
  );
}

function createId() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `queued-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export async function enqueueEvaluation(payload: EvaluationPayload) {
  if (!hasIndexedDB()) return;
  await runTransaction('readwrite', (store) =>
    store.put({
      id: createId(),
      payload,
      createdAt: Date.now()
    } as QueuedEvaluation)
  );
}

async function getQueuedEvaluations(): Promise<QueuedEvaluation[]> {
  if (!hasIndexedDB()) return [];
  const result = await runTransaction<QueuedEvaluation[]>('readonly', (store) =>
    store.getAll()
  );
  return result ?? [];
}

async function removeQueuedEvaluation(id: string) {
  if (!hasIndexedDB()) return;
  await runTransaction('readwrite', (store) => store.delete(id));
}

async function postEvaluation(payload: EvaluationPayload) {
  const response = await fetch('/api/evaluations', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || 'Error enviando evaluación');
  }
  return response;
}

export async function flushEvaluationQueue() {
  if (!hasIndexedDB()) return;
  const items = await getQueuedEvaluations();
  for (const item of items) {
    try {
      await postEvaluation(item.payload);
      await removeQueuedEvaluation(item.id);
    } catch (err) {
      console.error('No se pudo sincronizar evaluación', err);
      break;
    }
  }
}

export async function submitEvaluation(payload: EvaluationPayload) {
  if (typeof window === 'undefined') {
    return postEvaluation(payload);
  }

  const online = navigator.onLine;
  if (!online) {
    await enqueueEvaluation(payload);
    return { queued: true };
  }

  try {
    return await postEvaluation(payload);
  } catch (err) {
    await enqueueEvaluation(payload);
    throw err;
  }
}
