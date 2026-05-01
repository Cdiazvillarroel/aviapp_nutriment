// lib/offline/db.ts
//
// IndexedDB wrapper for Nutriflock offline storage.
// Provides typed read/write to local mirror tables of Supabase data,
// plus a mutation queue for offline writes.
//
// Architecture:
//  - "data" store: mirror of server data (visits, flocks, scoring_definitions, visit_scores, photos)
//  - "mutations" store: pending writes that will be flushed when online
//  - "blobs" store: binary data (photos taken offline, pending upload)
//  - "meta" store: sync timestamps, app state

const DB_NAME = "nutriflock";
const DB_VERSION = 1;

// Object store names
export const STORES = {
  visits: "visits",
  flocks: "flocks",
  scoring_definitions: "scoring_definitions",
  visit_scores: "visit_scores",
  visit_flocks: "visit_flocks",
  farms: "farms",
  photos: "photos",          // metadata of photos
  blobs: "blobs",            // binary blobs of photos awaiting upload
  mutations: "mutations",     // pending writes queue
  meta: "meta",               // sync timestamps, etc.
} as const;

// Types matching Supabase shapes (subset we care about for offline)
export interface OfflineVisit {
  id: string;
  client_id: string;
  farm_id: string;
  scheduled_at: string;
  status: string;
  bird_count: number | null;
  notes: string | null;
  // Joined data we precompute for display
  farm_name?: string;
}

export interface OfflineFlock {
  id: string;
  reference: string | null;
  placement_date: string;
  house_id: string;
  // Computed for display
  age_days?: number;
  house_name?: string;
  breed_name?: string | null;
}

export interface OfflineScoringDefinition {
  id: string;
  name: string;
  scale_max: number;
  module: string;
  module_order: number;
  order_in_module: number;
  field_type: "score" | "numeric" | "sex";
}

export interface OfflineVisitScore {
  id: string;
  visit_id: string;
  flock_id: string;
  bird_number: number;
  definition_id: string;
  score: number | null;
  numeric_value: number | null;
  text_value: string | null;
  // Local-only flags
  _is_local?: boolean;     // created offline, not yet synced
  _updated_at?: string;    // last local update
}

export interface OfflineVisitFlock {
  visit_id: string;
  flock_id: string;
}

export interface OfflineFarm {
  id: string;
  name: string;
}

export interface OfflinePhoto {
  id: string;                  // server uuid OR local temp id
  visit_score_id: string;
  storage_path: string;        // server path, may be empty if pending
  url?: string;                // signed URL when available
  _local_blob_id?: string;     // points to blobs store if pending upload
  _is_local?: boolean;
}

export interface OfflineBlob {
  id: string;                  // matches OfflinePhoto._local_blob_id
  blob: Blob;
  mime_type: string;
  visit_score_id: string;
  created_at: string;
}

// Mutation types — what kind of write was queued
export type MutationType =
  | "upsert_score"
  | "upload_photo";

export interface PendingMutation {
  id: string;                  // ULID-like timestamp+random
  type: MutationType;
  created_at: string;
  attempts: number;
  last_error?: string;
  // Payload depends on type
  payload: any;
}

// Open/upgrade DB
let dbPromise: Promise<IDBDatabase> | null = null;

export function openDB(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;

  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);

    req.onerror = () => reject(req.error);
    req.onsuccess = () => resolve(req.result);

    req.onupgradeneeded = (event) => {
      const db = req.result;

      if (!db.objectStoreNames.contains(STORES.visits)) {
        const store = db.createObjectStore(STORES.visits, { keyPath: "id" });
        store.createIndex("by_status", "status");
        store.createIndex("by_scheduled_at", "scheduled_at");
      }
      if (!db.objectStoreNames.contains(STORES.flocks)) {
        db.createObjectStore(STORES.flocks, { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains(STORES.scoring_definitions)) {
        db.createObjectStore(STORES.scoring_definitions, { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains(STORES.visit_scores)) {
        const store = db.createObjectStore(STORES.visit_scores, { keyPath: "id" });
        store.createIndex("by_visit", "visit_id");
      }
      if (!db.objectStoreNames.contains(STORES.visit_flocks)) {
        const store = db.createObjectStore(STORES.visit_flocks, {
          keyPath: ["visit_id", "flock_id"]
        });
        store.createIndex("by_visit", "visit_id");
      }
      if (!db.objectStoreNames.contains(STORES.farms)) {
        db.createObjectStore(STORES.farms, { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains(STORES.photos)) {
        const store = db.createObjectStore(STORES.photos, { keyPath: "id" });
        store.createIndex("by_visit_score", "visit_score_id");
      }
      if (!db.objectStoreNames.contains(STORES.blobs)) {
        db.createObjectStore(STORES.blobs, { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains(STORES.mutations)) {
        const store = db.createObjectStore(STORES.mutations, { keyPath: "id" });
        store.createIndex("by_created_at", "created_at");
      }
      if (!db.objectStoreNames.contains(STORES.meta)) {
        db.createObjectStore(STORES.meta, { keyPath: "key" });
      }
    };
  });

  return dbPromise;
}

// Generic helpers
export async function idbGet<T>(storeName: string, key: IDBValidKey): Promise<T | null> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, "readonly");
    const store = tx.objectStore(storeName);
    const req = store.get(key);
    req.onsuccess = () => resolve(req.result ?? null);
    req.onerror = () => reject(req.error);
  });
}

export async function idbGetAll<T>(storeName: string): Promise<T[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, "readonly");
    const store = tx.objectStore(storeName);
    const req = store.getAll();
    req.onsuccess = () => resolve(req.result as T[]);
    req.onerror = () => reject(req.error);
  });
}

export async function idbGetByIndex<T>(
  storeName: string,
  indexName: string,
  value: IDBValidKey
): Promise<T[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, "readonly");
    const store = tx.objectStore(storeName);
    const index = store.index(indexName);
    const req = index.getAll(value);
    req.onsuccess = () => resolve(req.result as T[]);
    req.onerror = () => reject(req.error);
  });
}

export async function idbPut<T>(storeName: string, value: T): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, "readwrite");
    const store = tx.objectStore(storeName);
    const req = store.put(value);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

export async function idbPutMany<T>(storeName: string, values: T[]): Promise<void> {
  if (values.length === 0) return;
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, "readwrite");
    const store = tx.objectStore(storeName);
    let count = 0;
    for (const v of values) {
      const req = store.put(v);
      req.onsuccess = () => {
        count++;
        if (count === values.length) resolve();
      };
      req.onerror = () => reject(req.error);
    }
  });
}

export async function idbDelete(storeName: string, key: IDBValidKey): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, "readwrite");
    const store = tx.objectStore(storeName);
    const req = store.delete(key);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

export async function idbClear(storeName: string): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, "readwrite");
    const store = tx.objectStore(storeName);
    const req = store.clear();
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

// Meta helpers (timestamps, etc.)
export async function setMeta(key: string, value: any): Promise<void> {
  await idbPut(STORES.meta, { key, value });
}

export async function getMeta<T>(key: string): Promise<T | null> {
  const row = await idbGet<{ key: string; value: T }>(STORES.meta, key);
  return row?.value ?? null;
}

// Generate ULID-like ID for mutations and local entities
export function generateLocalId(prefix: string = "local"): string {
  const timestamp = Date.now().toString(36);
  const rand = Math.random().toString(36).substring(2, 10);
  return `${prefix}_${timestamp}_${rand}`;
}
