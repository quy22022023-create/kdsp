(function () {
  'use strict';

  const DB_NAME = 'jp_learning_app_v1';
  const DB_VERSION = 1;
  const STORE_NAME = 'app_kv';
  const memoryFallback = new Map();
  let dbPromise;

  function openDb() {
    if (dbPromise) return dbPromise;
    dbPromise = new Promise((resolve) => {
      if (!('indexedDB' in window)) return resolve(null);
      let request;
      try {
        request = indexedDB.open(DB_NAME, DB_VERSION);
      } catch (_) {
        return resolve(null);
      }
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) db.createObjectStore(STORE_NAME);
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => resolve(null);
      request.onblocked = () => resolve(null);
    });
    return dbPromise;
  }

  async function get(key, fallbackValue) {
    const fallback = () => {
      try {
        const raw = localStorage.getItem(key);
        if (raw !== null) return JSON.parse(raw);
      } catch (_) { /* Safari private mode / quota: use memory fallback. */ }
      return memoryFallback.has(key) ? memoryFallback.get(key) : fallbackValue;
    };

    const db = await openDb();
    if (!db) return fallback();
    return new Promise((resolve) => {
      try {
        const tx = db.transaction(STORE_NAME, 'readonly');
        const req = tx.objectStore(STORE_NAME).get(key);
        req.onsuccess = () => resolve(req.result !== undefined ? req.result : fallback());
        req.onerror = () => resolve(fallback());
      } catch (_) {
        resolve(fallback());
      }
    });
  }

  async function set(key, value) {
    memoryFallback.set(key, value);
    let localSaved = false;
    try {
      localStorage.setItem(key, JSON.stringify(value));
      localSaved = true;
    } catch (_) { /* IndexedDB may still succeed. */ }

    const db = await openDb();
    if (!db) return localSaved;
    return new Promise((resolve) => {
      try {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        tx.objectStore(STORE_NAME).put(value, key);
        tx.oncomplete = () => resolve(true);
        tx.onerror = () => resolve(localSaved);
        tx.onabort = () => resolve(localSaved);
      } catch (_) {
        resolve(localSaved);
      }
    });
  }

  async function remove(key) {
    memoryFallback.delete(key);
    try { localStorage.removeItem(key); } catch (_) { /* ignore */ }
    const db = await openDb();
    if (!db) return;
    await new Promise((resolve) => {
      try {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        tx.objectStore(STORE_NAME).delete(key);
        tx.oncomplete = resolve;
        tx.onerror = resolve;
      } catch (_) { resolve(); }
    });
  }

  function mergeProgress(localMap, remoteRows) {
    const merged = { ...(localMap || {}) };
    (Array.isArray(remoteRows) ? remoteRows : []).forEach((row) => {
      if (!row || !row.item_type || !row.item_id) return;
      const key = `${row.item_type}:${row.item_id}`;
      const incoming = {
        itemType: row.item_type,
        itemId: row.item_id,
        data: row.data && typeof row.data === 'object' ? row.data : {},
        updatedAt: row.updated_at || new Date().toISOString()
      };
      const existing = merged[key];
      const oldTime = existing ? Date.parse(existing.updatedAt || 0) || 0 : 0;
      const newTime = Date.parse(incoming.updatedAt) || 0;
      if (!existing || newTime >= oldTime) merged[key] = incoming;
    });
    return merged;
  }

  window.AppStore = { get, set, remove, mergeProgress };
})();
