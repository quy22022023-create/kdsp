/* KDSP lesson progress. Per-account IndexedDB, local-first sync, no guest leakage. */
(function () {
  'use strict';

  const DB_NAME = 'jp_course_progress_v2';
  const STORE = 'records';
  const META = 'metadata';
  const GUEST = 'guest';
  const PROGRESS_KEY_LEGACY = 'jp_app_progress_v1';
  const memory = new Map();
  const listeners = new Set();
  let dbPromise = null;
  let userId = null;
  let writable = true;
  let syncPromise = null;
  let localQueue = Promise.resolve();
  let channel = null;
  let lastError = '';

  const isId = (value) => typeof value === 'string' && /^[a-z0-9][a-z0-9_-]{1,63}$/.test(value);
  const scope = () => userId || GUEST;
  const recordKey = (id, owner = scope()) => owner + '|' + id;
  const isoNow = () => new Date().toISOString();
  const obj = (data) => Boolean(data && typeof data === 'object' && !Array.isArray(data));

  function emit() {
    const state = status();
    for (const listener of listeners) {
      try { listener(state); } catch (_) { /* listener error */ }
    }
  }

  function openDb() {
    if (dbPromise) return dbPromise;
    dbPromise = new Promise((resolve) => {
      if (!('indexedDB' in window)) { writable = false; resolve(null); return; }
      let request;
      try { request = indexedDB.open(DB_NAME, 1); }
      catch (_) { writable = false; resolve(null); return; }
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
        if (!db.objectStoreNames.contains(META)) db.createObjectStore(META);
      };
      request.onsuccess = () => { request.result.onversionchange = () => request.result.close(); resolve(request.result); };
      request.onerror = request.onblocked = () => { writable = false; resolve(null); emit(); };
    });
    return dbPromise;
  }

  async function read(key, storeName = STORE) {
    const full = storeName + ':' + key;
    const db = await openDb();
    if (!db) return memory.get(full) || null;
    return new Promise((resolve) => {
      try {
        const request = db.transaction(storeName, 'readonly').objectStore(storeName).get(key);
        request.onsuccess = () => resolve(request.result || memory.get(full) || null);
        request.onerror = () => resolve(memory.get(full) || null);
      } catch (_) { resolve(memory.get(full) || null); }
    });
  }

  async function list(owner = scope()) {
    const db = await openDb();
    if (!db) return Array.from(memory.entries()).filter(([key]) => key.startsWith(STORE + ':' + owner + '|')).map(([, value]) => value);
    return new Promise((resolve) => {
      const rows = [];
      try {
        const tx = db.transaction(STORE, 'readonly');
        const req = tx.objectStore(STORE).openCursor();
        req.onsuccess = () => {
          const cursor = req.result;
          if (!cursor) return;
          if (String(cursor.key).startsWith(owner + '|')) rows.push(cursor.value);
          cursor.continue();
        };
        tx.oncomplete = () => resolve(rows);
        tx.onabort = tx.onerror = () => resolve(rows);
      } catch (_) { resolve(rows); }
    });
  }

  function normalizedActivities(value) {
    const input = Array.isArray(value) ? value : [];
    return Array.from(new Set(input.filter(isId))).slice(0, 1000);
  }

  function mergeRecords(oldRecord, newRecord, lesson) {
    const oldData = obj(oldRecord?.data) ? oldRecord.data : {};
    const newData = obj(newRecord?.data) ? newRecord.data : {};
    const completedActivities = normalizedActivities([
      ...normalizedActivities(oldData.completedActivities),
      ...normalizedActivities(newData.completedActivities)
    ]);
    const expectedIds = Array.isArray(lesson?.activities)
      ? lesson.activities.map((activity) => activity.id).filter(isId)
      : Array.isArray(newData.expectedActivities) ? normalizedActivities(newData.expectedActivities)
      : normalizedActivities(oldData.expectedActivities);
    const expectedActivities = normalizedActivities(expectedIds);
    const done = expectedActivities.length > 0 && expectedActivities.every((id) => completedActivities.includes(id));
    const wasDone = oldData.status === 'completed' || newData.status === 'completed';
    const updatedAt = new Date(Math.max(Date.parse(oldRecord?.updatedAt || '') || 0, Date.parse(newRecord?.updatedAt || '') || 0, Date.now())).toISOString();
    const completedAt = done || (wasDone && !expectedActivities.length)
      ? String(oldData.completedAt || newData.completedAt || updatedAt) : null;
    return {
      itemType: 'lesson',
      itemId: newRecord?.itemId || oldRecord?.itemId || lesson?.id,
      data: {
        ...oldData, ...newData,
        completedActivities, expectedActivities,
        status: done || (wasDone && !expectedActivities.length) ? 'completed' : completedActivities.length ? 'in_progress' : 'new',
        completedAt
      },
      updatedAt,
      dirty: Boolean(oldRecord?.dirty || newRecord?.dirty)
    };
  }

  function notifyChange(lessonId) {
    emit();
    if (channel) {
      try { channel.postMessage({ lessonId, scope: scope() }); } catch (_) { /* channel not available */ }
    }
  }

  // All mutations use the same IndexedDB readwrite transaction to avoid tab-to-tab lost updates.
  async function mutate(id, change, owner = scope(), lesson = null) {
    if (!isId(id)) throw new Error('ID bài học không hợp lệ.');
    const key = recordKey(id, owner);
    const next = { itemType: 'lesson', itemId: id, data: change, updatedAt: isoNow(), dirty: true };
    const db = await openDb();
    if (!db) {
      const merged = mergeRecords(memory.get(STORE + ':' + key), next, lesson);
      memory.set(STORE + ':' + key, merged);
      notifyChange(id);
      return merged;
    }
    return new Promise((resolve, reject) => {
      let merged;
      try {
        const tx = db.transaction(STORE, 'readwrite');
        const store = tx.objectStore(STORE);
        const request = store.get(key);
        request.onsuccess = () => {
          merged = mergeRecords(request.result, next, lesson);
          store.put(merged, key);
        };
        tx.oncomplete = () => { notifyChange(id); resolve(merged); };
        tx.onerror = tx.onabort = () => {
          lastError = 'Không thể lưu tiến độ trên thiết bị; kiểm tra dung lượng hoặc chế độ riêng tư.';
          writable = false;
          emit();
          reject(new Error(lastError));
        };
      } catch (error) { reject(error); }
    });
  }

  async function getLesson(lesson) {
    if (!isId(lesson?.id)) throw new Error('ID bài học không hợp lệ.');
    const record = await read(recordKey(lesson.id));
    if (!record) return mergeRecords(null, { itemId: lesson.id, data: {} }, lesson);
    // A course update can add new activities. Don't silently mark the expanded lesson complete.
    const data = record.data || {};
    const expectedActivities = (lesson.activities || []).map((item) => item.id).filter(isId);
    const done = expectedActivities.length > 0 && expectedActivities.every((id) => (data.completedActivities || []).includes(id));
    return {
      ...record,
      data: {
        ...data, expectedActivities,
        status: done ? 'completed' : expectedActivities.some((id) => (data.completedActivities || []).includes(id)) ? 'in_progress' : 'new',
        completedAt: done ? data.completedAt || record.updatedAt : null
      }
    };
  }

  async function completeActivity(lesson, activityId) {
    if (!isId(lesson?.id) || !Array.isArray(lesson.activities) ||
        !lesson.activities.some((item) => item.id === activityId)) {
      throw new Error('Hoạt động không thuộc bài học.');
    }
    const updated = await mutate(lesson.id, { completedActivities: [activityId] }, scope(), lesson);
    if (userId && navigator.onLine !== false) scheduleSync();
    return updated;
  }

  let syncTimer = null;
  function scheduleSync() {
    if (syncTimer) clearTimeout(syncTimer);
    syncTimer = setTimeout(() => { sync().catch(() => {}); }, 1500);
  }

  async function writeMergedRecord(id, remoteRecord, owner) {
    const key = recordKey(id, owner);
    const db = await openDb();
    if (!db) {
      const merged = mergeRecords(memory.get(STORE + ':' + key), remoteRecord);
      merged.dirty = Boolean(memory.get(STORE + ':' + key)?.dirty);
      memory.set(STORE + ':' + key, merged);
      return merged;
    }
    return new Promise((resolve, reject) => {
      let merged;
      try {
        const tx = db.transaction(STORE, 'readwrite');
        const store = tx.objectStore(STORE);
        const request = store.get(key);
        request.onsuccess = () => {
          merged = mergeRecords(request.result, remoteRecord);
          merged.dirty = Boolean(request.result?.dirty);
          store.put(merged, key);
        };
        tx.oncomplete = () => resolve(merged);
        tx.onerror = tx.onabort = () => reject(new Error('Không thể hợp nhất tiến độ.'));
      } catch (error) { reject(error); }
    });
  }

  async function markSynced(records, owner) {
    const db = await openDb();
    if (!db) {
      for (const sent of records) {
        const key = STORE + ':' + recordKey(sent.itemId, owner);
        const local = memory.get(key);
        if (local && local.updatedAt === sent.updatedAt) memory.set(key, { ...local, dirty: false });
      }
      return;
    }
    await new Promise((resolve) => {
      try {
        const tx = db.transaction(STORE, 'readwrite');
        const store = tx.objectStore(STORE);
        records.forEach((sent) => {
          const key = recordKey(sent.itemId, owner);
          const request = store.get(key);
          request.onsuccess = () => {
            const local = request.result;
            if (local && local.updatedAt === sent.updatedAt) store.put({ ...local, dirty: false }, key);
          };
        });
        tx.oncomplete = tx.onerror = tx.onabort = resolve;
      } catch (_) { resolve(); }
    });
  }

  async function sync() {
    if (!userId || !window.AppDB || !AppDB.isConfigured()) return { skipped: true };
    if (syncPromise) return syncPromise;
    const owner = userId;
    syncPromise = (async () => {
      if (navigator.onLine === false) return { offline: true };
      const actual = await AppDB.getUser();
      if (!actual || actual.id !== owner) return { skipped: true };
      const remoteRows = await AppDB.getUserProgress();
      if (scope() !== owner) return { skipped: true };
      const remoteMap = new Map();
      for (const row of Array.isArray(remoteRows) ? remoteRows : []) {
        if (row.item_type !== 'lesson' || !isId(row.item_id)) continue;
        remoteMap.set(row.item_id, {
          itemType: 'lesson', itemId: row.item_id,
          data: obj(row.data) ? row.data : {}, updatedAt: row.updated_at || isoNow(), dirty: false
        });
      }
      for (const row of remoteMap.values()) await writeMergedRecord(row.itemId, row, owner);
      const localRecords = await list(owner);
      const pending = [];
      for (const record of localRecords) {
        const remote = remoteMap.get(record.itemId);
        if (!remote || JSON.stringify(normalizedActivities(remote.data.completedActivities).sort()) !==
          JSON.stringify(normalizedActivities(record.data.completedActivities).sort()) || record.dirty) {
          pending.push(record);
        }
      }
      if (pending.length) {
        // RPC accepts at most 2,000 items; keep batches smaller for mobile networks.
        for (let i = 0; i < pending.length; i += 150) {
          if (scope() !== owner) return { skipped: true };
          const batch = pending.slice(i, i + 150);
          await AppDB.syncUserProgress(batch.map((entry) => ({
            item_type: 'lesson', item_id: entry.itemId,
            data: entry.data, updated_at: entry.updatedAt
          })));
          await markSynced(batch, owner);
        }
      }
      lastError = '';
      emit();
      return { synced: pending.length };
    })().catch((error) => {
      lastError = error.message || 'Chưa đồng bộ được tiến độ.';
      emit();
      throw error;
    }).finally(() => { syncPromise = null; });
    return syncPromise;
  }

  async function initialize() {
    await openDb();
    if ('BroadcastChannel' in window) {
      channel = new BroadcastChannel('kdsp-course-progress');
      channel.onmessage = (event) => {
        if (event.data && event.data.scope === scope()) emit();
      };
    }
    window.addEventListener('online', scheduleSync);
    // Legacy lesson records are copied to guest only, never silently uploaded to another account.
    const migrated = await read('legacy-lesson-migrated', META);
    if (!migrated && window.AppStore) {
      const legacy = await AppStore.get(PROGRESS_KEY_LEGACY, {});
      for (const [key, value] of Object.entries(obj(legacy) ? legacy : {})) {
        if (!key.startsWith('lesson:') || !isId(value?.itemId)) continue;
        const oldData = obj(value.data) ? value.data : {};
        const record = {
          itemType: 'lesson', itemId: value.itemId,
          data: { ...oldData, completedActivities: normalizedActivities(oldData.completedActivities) },
          updatedAt: value.updatedAt || isoNow(), dirty: true
        };
        const existing = await read(recordKey(value.itemId, GUEST));
        if (!existing) await putDirect(recordKey(value.itemId, GUEST), record);
      }
      await putDirect('legacy-lesson-migrated', true, META);
    }
    const logged = window.AppDB && AppDB.isConfigured() ? await AppDB.getUser().catch(() => null) : null;
    await setUser(logged);
    return status();
  }

  async function putDirect(key, value, storeName = STORE) {
    memory.set(storeName + ':' + key, value);
    const db = await openDb();
    if (!db) return false;
    return new Promise((resolve) => {
      try {
        const tx = db.transaction(storeName, 'readwrite');
        tx.objectStore(storeName).put(value, key);
        tx.oncomplete = () => resolve(true);
        tx.onerror = tx.onabort = () => { writable = false; emit(); resolve(false); };
      } catch (_) { writable = false; emit(); resolve(false); }
    });
  }

  async function setUser(user) {
    const previous = userId;
    userId = user?.id || null;
    const intended = userId;
    if (userId !== previous) emit();
    if (intended && intended !== previous) {
      try {
        if (syncPromise) await syncPromise.catch(() => {});
        if (userId === intended) await sync();
      } catch (_) { /* local progress remains available */ }
    }
  }

  async function importGuestProgress() {
    if (!userId) throw new Error('Cần đăng nhập trước khi nhập tiến độ khách.');
    const rows = await list(GUEST);
    for (const row of rows) {
      if (!isId(row.itemId)) continue;
      await mutate(row.itemId, { ...row.data, completedActivities: normalizedActivities(row.data?.completedActivities) }, userId);
    }
    if (rows.length) scheduleSync();
    return { imported: rows.length };
  }

  async function exportBackup() {
    return { format: 'kdsp-lesson-progress', schema_version: 1, exported_at: isoNow(),
      scope: userId ? 'account' : 'guest', records: await list() };
  }

  async function importBackup(backup) {
    if (!obj(backup) || backup.format !== 'kdsp-lesson-progress' || backup.schema_version !== 1 ||
        !Array.isArray(backup.records) || backup.records.length > 5000) {
      throw new Error('Tệp sao lưu tiến độ không hợp lệ.');
    }
    let imported = 0;
    for (const record of backup.records) {
      if (!isId(record.itemId) || record.itemType !== 'lesson' || !obj(record.data)) continue;
      await mutate(record.itemId, record.data);
      imported += 1;
    }
    if (userId) scheduleSync();
    return { imported };
  }

  function status() { return { scope: userId ? 'account' : 'guest', persistence: writable, syncing: Boolean(syncPromise), error: lastError }; }
  function onChange(listener) { listeners.add(listener); return () => listeners.delete(listener); }

  window.CourseProgress = {
    initialize, setUser, getLesson, completeActivity, sync, importGuestProgress,
    exportBackup, importBackup, list, status, onChange
  };
})();
