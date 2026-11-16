(function () {
  'use strict';

  const DB_NAME = 'jp_learning_app_v1';
  const DB_VERSION = 1;
  const STORE_NAME = 'app_kv';
  // Only partial writes create metadata; existing values and IDB schema stay unchanged.
  const FALLBACK_PREFIX = 'jp_app_store_fallback_v1:';
  const memoryFallback = new Map();
  const failedWrites = new Map();
  const mutations = new Map();
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

  function rawLocal(key) {
    try { return localStorage.getItem(key); } catch (_) { return undefined; }
  }

  function fingerprint(value) {
    return JSON.stringify({ present: value !== undefined, value });
  }

  function partialWrites(key) {
    const candidates = [];
    const inMemory = failedWrites.get(key);
    if (inMemory) candidates.push(inMemory);
    try {
      const raw = localStorage.getItem(FALLBACK_PREFIX + key);
      if (raw === null) return candidates;
      const marker = JSON.parse(raw);
      if (!marker || marker.version !== 1 || typeof marker.local !== 'string' ||
          typeof marker.previous !== 'string') return candidates;
      // Malformed markers cannot redirect reads to unparsable values.
      JSON.parse(marker.local);
      const previous = JSON.parse(marker.previous);
      if (!previous || typeof previous.present !== 'boolean' ||
          (!previous.present && Object.prototype.hasOwnProperty.call(previous, 'value'))) return candidates;
      candidates.push(marker);
    } catch (_) { /* Ignore malformed optional metadata. */ }
    return candidates;
  }

  function readPartial(key, persisted) {
    for (const marker of partialWrites(key)) {
      try {
        // A removed/replaced durable marker invalidates the matching in-memory candidate too.
        if (marker.durableRaw && rawLocal(FALLBACK_PREFIX + key) !== marker.durableRaw) continue;
        // A stale in-memory candidate must not hide another tab's newer durable fallback.
        if (marker.previous !== fingerprint(persisted) || rawLocal(key) !== marker.local) continue;
        if (Object.prototype.hasOwnProperty.call(marker, 'value')) return { value: marker.value };
        return { value: JSON.parse(marker.local) };
      } catch (_) { /* Try the next independently guarded candidate. */ }
    }
    return null;
  }

  function queueMutation(key, operation) {
    const previous = mutations.get(key) || Promise.resolve();
    const work = previous.catch(() => {}).then(operation);
    mutations.set(key, work);
    work.finally(() => { if (mutations.get(key) === work) mutations.delete(key); }).catch(() => {});
    return work;
  }

  async function get(key, fallbackValue) {
    const fallback = () => {
      const pending = failedWrites.get(key);
      // An unsaved value remains available in this document, unless another tab changed LS.
      if (pending && rawLocal(key) === pending.local && memoryFallback.has(key)) return memoryFallback.get(key);
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
        req.onsuccess = () => {
          const partial = readPartial(key, req.result);
          resolve(partial ? partial.value : req.result !== undefined ? req.result : fallback());
        };
        req.onerror = () => resolve(fallback());
      } catch (_) { resolve(fallback()); }
    });
  }

  async function write(key, value) {
    memoryFallback.set(key, value);
    let localSaved = false;
    const markerBefore = rawLocal(FALLBACK_PREFIX + key);
    let local = rawLocal(key);
    try {
      const serialized = JSON.stringify(value);
      localStorage.setItem(key, serialized);
      local = localStorage.getItem(key);
      localSaved = true;
    } catch (_) { /* IndexedDB may still succeed. */ }

    const db = await openDb();
    if (!db) {
      if (!localSaved) failedWrites.set(key, { local, value });
      return localSaved;
    }
    return new Promise((resolve) => {
      let previous;
      let observed = false;
      let settled = false;
      const failed = () => {
        if (settled) return;
        settled = true;
        if (observed) {
          let base;
          try { base = fingerprint(previous); } catch (_) { /* Non-JSON IDB values cannot have a durable marker. */ }
          const marker = { version: 1, previous: base, local, value };
          failedWrites.set(key, marker);
          if (localSaved && typeof local === 'string' && typeof base === 'string' && rawLocal(key) === local) {
            try {
              const durableRaw = JSON.stringify({ version: 1, previous: base, local, id: Date.now().toString(36) + Math.random().toString(36).slice(2) });
              localStorage.setItem(FALLBACK_PREFIX + key, durableRaw);
              marker.durableRaw = durableRaw;
              resolve(true);
              return;
            } catch (_) { /* Keep the in-memory value; do not claim reload durability. */ }
          }
        }
        resolve(false);
      };
      try {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        const read = store.get(key);
        read.onsuccess = () => {
          previous = read.result;
          observed = true;
          try { store.put(value, key); } catch (_) { tx.abort(); }
        };
        tx.oncomplete = () => {
          settled = true;
          failedWrites.delete(key);
          // Stale metadata is harmless (its prior-IDB guard no longer matches).
          // Remove only our matching marker, never another tab's newer fallback metadata.
          try {
            const raw = localStorage.getItem(FALLBACK_PREFIX + key);
            if (markerBefore !== null && raw === markerBefore) localStorage.removeItem(FALLBACK_PREFIX + key);
          } catch (_) { /* Metadata cleanup is optional. */ }
          resolve(true);
        };
        tx.onabort = failed;
        tx.onerror = () => {}; // The default IDB error action aborts the transaction.
      } catch (_) { failed(); }
    });
  }

  function set(key, value) {
    return queueMutation(key, () => write(key, value));
  }

  function remove(key) {
    return queueMutation(key, async () => {
      memoryFallback.delete(key);
      failedWrites.delete(key);
      try {
        localStorage.removeItem(key);
        localStorage.removeItem(FALLBACK_PREFIX + key);
      } catch (_) { /* ignore */ }
      const db = await openDb();
      if (!db) return;
      await new Promise((resolve) => {
        try {
          const tx = db.transaction(STORE_NAME, 'readwrite');
          tx.objectStore(STORE_NAME).delete(key);
          tx.oncomplete = resolve;
          tx.onerror = tx.onabort = resolve;
        } catch (_) { resolve(); }
      });
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
