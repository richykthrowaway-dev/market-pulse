import { useCallback } from 'react';

const IDB_NAME = 'market-pulse-journal';
const IDB_STORE = 'screenshots';

function openIdb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(IDB_NAME, 3); // v3 adds strategy store
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains('trades'))      db.createObjectStore('trades');
      if (!db.objectStoreNames.contains('settings'))    db.createObjectStore('settings');
      if (!db.objectStoreNames.contains(IDB_STORE))    db.createObjectStore(IDB_STORE);
      if (!db.objectStoreNames.contains('strategy'))    db.createObjectStore('strategy');
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function putBlob(key: string, blob: Blob): Promise<void> {
  const db = await openIdb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(IDB_STORE, 'readwrite');
    tx.objectStore(IDB_STORE).put(blob, key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function getBlob(key: string): Promise<Blob | null> {
  const db = await openIdb();
  return new Promise((resolve) => {
    const tx = db.transaction(IDB_STORE, 'readonly');
    const req = tx.objectStore(IDB_STORE).get(key);
    req.onsuccess = () => resolve(req.result ?? null);
    req.onerror = () => resolve(null);
  });
}

async function deleteBlob(key: string): Promise<void> {
  const db = await openIdb();
  return new Promise((resolve) => {
    const tx = db.transaction(IDB_STORE, 'readwrite');
    tx.objectStore(IDB_STORE).delete(key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => resolve();
  });
}

export function useJournalScreenshots() {
  const save = useCallback(async (tradeId: string, blob: Blob): Promise<string> => {
    const key = `screenshot:${tradeId}`;
    await putBlob(key, blob);
    return key;
  }, []);

  const load = useCallback(async (key: string): Promise<string | null> => {
    const blob = await getBlob(key);
    return blob ? URL.createObjectURL(blob) : null;
  }, []);

  const remove = useCallback(async (key: string): Promise<void> => {
    await deleteBlob(key);
  }, []);

  return { save, load, remove } as const;
}
