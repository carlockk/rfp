'use client';

import { getOfflineDB } from './db';

const RESOURCES_STORE = 'resources';

type ResourceEntry<T> = {
  id: string;
  data: T;
  updatedAt: number;
};

async function writeResource<T>(key: string, data: T) {
  const db = getOfflineDB();
  if (!db) return;
  const database = await db;
  await database.put(RESOURCES_STORE, {
    id: key,
    data,
    updatedAt: Date.now()
  } satisfies ResourceEntry<T>);
}

async function readResource<T>(key: string) {
  const db = getOfflineDB();
  if (!db) return null;
  const database = await db;
  const entry = await database.get(RESOURCES_STORE, key);
  return (entry as ResourceEntry<T> | undefined) ?? null;
}

export async function cacheEquipments(data: unknown[]) {
  await writeResource('equipments', data);
}

export async function readCachedEquipments<T = unknown[]>() {
  const entry = await readResource<T>('equipments');
  return entry?.data ?? [];
}

export async function cacheRecords(
  type: 'consumos' | 'mantenciones' | 'reparaciones',
  records: unknown[]
) {
  await writeResource(type, records);
}

export async function readRecords<T = unknown[]>(
  type: 'consumos' | 'mantenciones' | 'reparaciones'
) {
  const entry = await readResource<T>(type);
  return entry?.data ?? [];
}

export async function appendRecord(
  type: 'consumos' | 'mantenciones' | 'reparaciones',
  record: unknown,
  limit = 50
) {
  const current = await readRecords(type);
  const next = [record, ...current].slice(0, limit);
  await cacheRecords(type, next);
}
