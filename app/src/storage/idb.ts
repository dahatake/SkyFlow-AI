const DB_NAME = 'aoct-prototype';
const STORES = ['baseline', 'scenarios', 'audit', 'diagnostics', 'workflow', 'gps'];

let dbPromise: Promise<IDBDatabase> | undefined;

export function openDB(): Promise<IDBDatabase> {
  dbPromise ??= new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 3);
    req.onupgradeneeded = () => {
      STORES.forEach((s) => {
        if (!req.result.objectStoreNames.contains(s)) req.result.createObjectStore(s, s === 'baseline' ? undefined : { keyPath: 'id' });
      });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}

function run<T>(db: IDBDatabase, store: string, mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest): Promise<T> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, mode);
    const req = fn(tx.objectStore(store));
    tx.oncomplete = () => resolve(req.result as T);
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

export const idbGet = <T,>(db: IDBDatabase, s: string, key: string) => run<T | undefined>(db, s, 'readonly', (o) => o.get(key));
export const idbGetAll = <T,>(db: IDBDatabase, s: string) => run<T[]>(db, s, 'readonly', (o) => o.getAll());
export const idbPut = (db: IDBDatabase, s: string, v: unknown, key?: string) => run<unknown>(db, s, 'readwrite', (o) => (key ? o.put(v, key) : o.put(v)));
export const idbDelete = (db: IDBDatabase, s: string, key: string) => run<unknown>(db, s, 'readwrite', (o) => o.delete(key));
export const idbClear = (db: IDBDatabase, s: string) => run<unknown>(db, s, 'readwrite', (o) => o.clear());

export function idbPutMany(db: IDBDatabase, s: string, values: unknown[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(s, 'readwrite');
    const os = tx.objectStore(s);
    values.forEach((v) => os.put(v));
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}
