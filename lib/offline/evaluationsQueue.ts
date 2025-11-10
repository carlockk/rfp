'use client';

import { getOfflineDB, hasIndexedDB, registerBackgroundSync } from './db';
import { appendRecord } from './resources';

type EvaluationPayload = Record<string, unknown>;

type QueuedEvaluation = {
  id: string;
  payload: EvaluationPayload;
  createdAt: number;
};

const STORE_NAME = 'evaluations_queue';
const SYNC_TAG = 'sync-evaluations';

function createId() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `queued-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

async function enqueueEvaluation(payload: EvaluationPayload) {
  if (!hasIndexedDB()) return;
  const db = getOfflineDB();
  if (!db) return;
  const database = await db;
  const id = createId();
  await database.put(STORE_NAME, {
    id,
    payload,
    createdAt: Date.now()
  } as QueuedEvaluation);
  await appendRecord('mantenciones', {
    id,
    status: 'pendiente',
    payload,
    storedAt: new Date().toISOString()
  });
  await registerBackgroundSync(SYNC_TAG);
}

async function getQueuedEvaluations(): Promise<QueuedEvaluation[]> {
  if (!hasIndexedDB()) return [];
  const db = getOfflineDB();
  if (!db) return [];
  const database = await db;
  const result = await database.getAll(STORE_NAME);
  return (result as QueuedEvaluation[] | undefined) ?? [];
}

async function removeQueuedEvaluation(id: string) {
  if (!hasIndexedDB()) return;
  const db = getOfflineDB();
  if (!db) return;
  const database = await db;
  await database.delete(STORE_NAME, id);
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
  await appendRecord('mantenciones', {
    id: createId(),
    status: 'sincronizado',
    payload,
    syncedAt: new Date().toISOString()
  });
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
