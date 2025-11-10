'use client';

import { getOfflineDB } from './db';

const SETTINGS_STORE = 'settings';

export async function readSetting<T = string>(key: string) {
  const db = getOfflineDB();
  if (!db) return null;
  const database = await db;
  const value = await database.get(SETTINGS_STORE, key);
  return (value as T | null) ?? null;
}

export async function writeSetting(key: string, value: string) {
  const db = getOfflineDB();
  if (!db) return;
  const database = await db;
  await database.put(SETTINGS_STORE, value, key);
}
