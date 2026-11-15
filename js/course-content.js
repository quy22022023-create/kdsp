/* KDSP public course content — version-pinned, offline-aware, no secrets. */
(function () {
  'use strict';

  const DB_NAME = 'jp_course_assets_v1';
  const DB_VERSION = 1;
  const CACHE_STORE = 'assets';
  const META_STORE = 'meta';
  const BASE = new URL('./content/', window.KDSP_CONTENT_BASE_URL || document.baseURI);
  const MAX_JSON_BYTES = 3 * 1024 * 1024;
  const BANK_TYPES = ['vocabulary', 'grammar', 'exercises'];
  const memory = new Map();
  let dbPromise = null;
  let manifest = null;
  let manifestPromise = null;
  let cataloguePromise = null;
  let bankIndexPromise = null;
  let currentMode = 'loading';
  let storageAvailable = true;
  const listeners = new Set();

  const isObject = (value) => Boolean(value && typeof value === 'object' && !Array.isArray(value));
  const isId = (id) => typeof id === 'string' && /^[a-z0-9][a-z0-9_-]{1,63}$/.test(id);

  function validatePath(relative) {
    if (typeof relative !== 'string' || !/^[a-z0-9_./-]+\.json$/.test(relative) ||
        relative.startsWith('/') || relative.includes('..') || relative.includes('//')) {
      throw new Error('Đường dẫn học liệu không an toàn.');
    }
    return relative;
  }

  function validateRef(ref) {
    if (!isObject(ref) || !isId(ref.id) || !Number.isSafeInteger(ref.version) || ref.version < 1) {
      throw new Error('Tham chiếu học liệu không hợp lệ.');
    }
    return validatePath(ref.path);
  }

  function validateManifest(source) {
    if (!isObject(source) || source.schema_version !== 1 ||
      !Number.isSafeInteger(source.content_version) || source.content_version < 1 ||
      !isObject(source.catalog) || !isObject(source.banks_index) ||
      !Number.isSafeInteger(source.catalog.version) || source.catalog.version < 1 ||
      !Number.isSafeInteger(source.banks_index.version) || source.banks_index.version < 1 ||
      source.catalog.path !== 'catalog.json' || source.banks_index.path !== 'banks/index.json') {
      throw new Error('Manifest không đúng phiên bản schema 1.');
    }
    return source;
  }

  function notify() {
    for (const fn of listeners) {
      try { fn({ mode: currentMode, contentVersion: manifest && manifest.content_version, storageAvailable }); }
      catch (_) { /* Listener must not break content fetch. */ }
    }
  }

  function openDb() {
    if (dbPromise) return dbPromise;
    dbPromise = new Promise((resolve) => {
      if (!('indexedDB' in window)) { storageAvailable = false; resolve(null); return; }
      let request;
      try { request = indexedDB.open(DB_NAME, DB_VERSION); }
      catch (_) { storageAvailable = false; resolve(null); return; }
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(CACHE_STORE)) db.createObjectStore(CACHE_STORE);
        if (!db.objectStoreNames.contains(META_STORE)) db.createObjectStore(META_STORE);
      };
      request.onsuccess = () => {
        const db = request.result;
        db.onversionchange = () => db.close();
        resolve(db);
      };
      request.onerror = request.onblocked = () => { storageAvailable = false; resolve(null); notify(); };
    });
    return dbPromise;
  }

  async function readLocal(storeName, key) {
    const memKey = storeName + ':' + key;
    if (memory.has(memKey)) return memory.get(memKey);
    const db = await openDb();
    if (!db) return null;
    return new Promise((resolve) => {
      try {
        const req = db.transaction(storeName, 'readonly').objectStore(storeName).get(key);
        req.onsuccess = () => { if (req.result !== undefined) memory.set(memKey, req.result); resolve(req.result ?? null); };
        req.onerror = () => resolve(null);
      } catch (_) { resolve(null); }
    });
  }

  async function writeLocal(storeName, key, value) {
    memory.set(storeName + ':' + key, value);
    const db = await openDb();
    if (!db) return false;
    return new Promise((resolve) => {
      try {
        const tx = db.transaction(storeName, 'readwrite');
        tx.objectStore(storeName).put(value, key);
        tx.oncomplete = () => resolve(true);
        tx.onerror = tx.onabort = () => { storageAvailable = false; notify(); resolve(false); };
      } catch (_) { storageAvailable = false; notify(); resolve(false); }
    });
  }

  async function fetchJson(relative, version) {
    relative = validatePath(relative);
    const url = new URL(relative, BASE);
    url.searchParams.set('v', String(version));
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 13000);
    try {
      const result = await fetch(url.toString(), { cache: 'no-store', signal: controller.signal, credentials: 'same-origin' });
      if (!result.ok) throw new Error('Không tải được ' + relative + ' (HTTP ' + result.status + ').');
      const contentLength = Number(result.headers.get('content-length') || 0);
      if (contentLength > MAX_JSON_BYTES) throw new Error('Tệp học liệu quá lớn: ' + relative);
      const body = await result.text();
      if (body.length > MAX_JSON_BYTES) throw new Error('Tệp học liệu vượt giới hạn: ' + relative);
      let payload;
      try { payload = JSON.parse(body); }
      catch (_) { throw new Error('Máy chủ trả về dữ liệu không phải JSON cho ' + relative + '.'); }
      if (!isObject(payload)) throw new Error('Dữ liệu JSON không phải object: ' + relative);
      return payload;
    } finally { clearTimeout(timeout); }
  }

  async function asset(relative, version, validator, options = {}) {
    relative = validatePath(relative);
    if (!Number.isSafeInteger(version) || version < 1) throw new Error('Version học liệu không hợp lệ.');
    const key = relative + '@' + version;
    const cached = await readLocal(CACHE_STORE, key);
    if (cached && !options.force) {
      try { validator(cached); return cached; } catch (_) { /* retry */ }
    }
    try {
      const data = await fetchJson(relative, version);
      validator(data);
      await writeLocal(CACHE_STORE, key, data);
      currentMode = 'online';
      notify();
      return data;
    } catch (error) {
      if (cached) {
        try { validator(cached); currentMode = 'offline'; notify(); return cached; }
        catch (_) { /* corrupt cache */ }
      }
      throw error;
    }
  }

  async function getManifest(options = {}) {
    if (manifest && !options.refresh) return manifest;
    if (manifestPromise && !options.refresh) return manifestPromise;
    const work = (async () => {
      const previous = manifest || await readLocal(META_STORE, 'last-valid-manifest');
      try {
        const query = 'manifest.json';
        const latest = validateManifest(await fetchJson(query, Date.now()));
        // Do not promote an incomplete release: both entry points must exist.
        await Promise.all([
          asset(latest.catalog.path, latest.catalog.version, (data) => {
            if (!Array.isArray(data.courses) || data.schema_version !== 1) throw new Error('Catalog không hợp lệ.');
          }),
          asset(latest.banks_index.path, latest.banks_index.version, (data) => {
            if (data.schema_version !== 1 || BANK_TYPES.some((type) => !isObject(data[type]) || !Array.isArray(data[type].shards))) {
              throw new Error('Chỉ mục ngân hàng học liệu không hợp lệ.');
            }
          })
        ]);
        manifest = latest;
        await writeLocal(META_STORE, 'last-valid-manifest', latest);
        currentMode = 'online';
        notify();
        return latest;
      } catch (error) {
        if (previous) {
          manifest = validateManifest(previous);
          currentMode = 'offline';
          notify();
          return manifest;
        }
        currentMode = 'error';
        notify();
        throw error;
      }
    })();
    manifestPromise = work;
    try { return await work; }
    finally { manifestPromise = null; }
  }

  async function getCatalog() {
    const current = await getManifest();
    return asset(current.catalog.path, current.catalog.version, (data) => {
      if (data.schema_version !== 1 || !Array.isArray(data.courses)) throw new Error('Danh mục khóa học không hợp lệ.');
      const ids = new Set();
      for (const item of data.courses) {
        validateRef(item);
        if (ids.has(item.id)) throw new Error('ID khóa học trùng.');
        ids.add(item.id);
      }
    });
  }

  async function getBankIndex() {
    const current = await getManifest();
    return asset(current.banks_index.path, current.banks_index.version, (data) => {
      if (data.schema_version !== 1 || BANK_TYPES.some((type) => !isObject(data[type]) || !Array.isArray(data[type].shards))) {
        throw new Error('Chỉ mục bank không hợp lệ.');
      }
      for (const type of BANK_TYPES) for (const ref of data[type].shards) validateRef(ref);
    });
  }

  async function getCourse(courseId) {
    const catalog = await getCatalog();
    const ref = catalog.courses.find((item) => item.id === courseId);
    if (!ref) throw new Error('Không tìm thấy khóa học.');
    return asset(validateRef(ref), ref.version, (data) => {
      if (data.id !== courseId || data.schema_version !== 1 || !Array.isArray(data.module_refs)) {
        throw new Error('Khóa học không khớp với danh mục.');
      }
      data.module_refs.forEach(validateRef);
    });
  }

  async function getModule(courseId, moduleId) {
    const course = await getCourse(courseId);
    const ref = course.module_refs.find((item) => item.id === moduleId);
    if (!ref) throw new Error('Không tìm thấy chương.');
    return asset(validateRef(ref), ref.version, (data) => {
      if (data.id !== moduleId || data.course_id !== courseId || data.schema_version !== 1 || !Array.isArray(data.lesson_refs)) {
        throw new Error('Chương không khớp với khóa học.');
      }
      data.lesson_refs.forEach(validateRef);
    });
  }

  async function getLesson(courseId, moduleId, lessonId) {
    const module = await getModule(courseId, moduleId);
    const ref = module.lesson_refs.find((item) => item.id === lessonId);
    if (!ref) throw new Error('Không tìm thấy bài học.');
    return asset(validateRef(ref), ref.version, (data) => {
      if (data.id !== lessonId || data.course_id !== courseId || data.module_id !== moduleId ||
          data.schema_version !== 1 || !Array.isArray(data.activities)) {
        throw new Error('Bài học không khớp với chương.');
      }
    });
  }

  async function getBank(type, options = {}) {
    if (!BANK_TYPES.includes(type)) throw new Error('Loại ngân hàng không được hỗ trợ.');
    const index = await getBankIndex();
    const refs = index[type].shards.filter((item) => !options.level || item.level === options.level);
    // Limit concurrency to keep mobile Safari memory/network pressure predictable.
    const result = new Array(refs.length);
    let cursor = 0;
    const workers = Array.from({ length: Math.min(4, refs.length) }, async () => {
      while (cursor < refs.length) {
        const index = cursor++;
        const ref = refs[index];
        const data = await asset(validateRef(ref), ref.version, (shard) => {
          if (shard.schema_version !== 1 || shard.bank_type !== type || !Array.isArray(shard.items)) {
            throw new Error('File bank không hợp lệ.');
          }
        });
        result[index] = data.items;
      }
    });
    await Promise.all(workers);
    return result.flat();
  }

  async function getItems(type, ids) {
    const list = await getBank(type === 'exercise' ? 'exercises' : type);
    const lookup = new Map(list.map((value) => [value.id, value]));
    return (Array.isArray(ids) ? ids : []).map((id) => lookup.get(id)).filter(Boolean);
  }

  async function downloadCourse(courseId, onProgress) {
    const course = await getCourse(courseId);
    const moduleIds = course.module_refs.map((ref) => ref.id);
    const modules = [];
    for (const id of moduleIds) modules.push(await getModule(courseId, id));
    const tasks = modules.flatMap((module) => module.lesson_refs.map((ref) => ({ moduleId: module.id, lessonId: ref.id })));
    if (tasks.length > 800) throw new Error('Khóa học quá lớn để tải ngoại tuyến trong một lần.');
    let completed = 0;
    const usedBankTypes = new Set();
    for (let start = 0; start < tasks.length; start += 3) {
      const chunk = tasks.slice(start, start + 3);
      const lessons = await Promise.all(chunk.map((task) => getLesson(courseId, task.moduleId, task.lessonId)));
      for (const lesson of lessons) {
        for (const activity of lesson.activities) {
          for (const ref of Array.isArray(activity.item_refs) ? activity.item_refs : []) {
            if (ref.type === 'exercise') usedBankTypes.add('exercises');
            else if (BANK_TYPES.includes(ref.type)) usedBankTypes.add(ref.type);
          }
        }
        completed += 1;
        if (typeof onProgress === 'function') onProgress({ completed, total: tasks.length });
      }
    }
    for (const type of usedBankTypes) await getBank(type);
    if (!storageAvailable) throw new Error('Thiết bị không cho phép lưu học liệu bền vững. Không thể xác nhận tải offline.');
    return { courseId, lessons: completed, bankTypes: Array.from(usedBankTypes) };
  }

  async function refresh() {
    // Promoting a new manifest should invalidate only in-memory lookups; IDB is version keyed.
    manifest = null;
    cataloguePromise = null;
    bankIndexPromise = null;
    return getManifest({ refresh: true });
  }

  function status() {
    return { mode: currentMode, contentVersion: manifest && manifest.content_version, storageAvailable };
  }

  function onChange(fn) {
    listeners.add(fn);
    return () => listeners.delete(fn);
  }

  window.CourseContent = {
    getManifest, getCatalog, getCourse, getModule, getLesson, getBankIndex, getBank,
    getItems, downloadCourse, refresh, status, onChange, validatePath, validateRef
  };
})();
