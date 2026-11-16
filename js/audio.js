/* Shared Japanese speech. Settings stay in the existing AppStore key; no DOM or backend dependency. */
(function () {
  'use strict';

  if (window.KDSPAudio) return;
  const SETTINGS_KEY = 'jp_app_speech_settings_v1';
  const DEFAULTS = { voiceURI: '', rate: 0.92, pitch: 1.04 };
  const listeners = new Set();
  const patchedFields = new Set();
  let settings = { ...DEFAULTS };
  let savedExtras = {};
  let voices = [];
  let voiceStatus = 'waiting';
  let status = 'idle';
  let lastError = null;
  let stateOwner = null;
  let stateContext = null;
  let requestId = 0;
  let active = null;
  let initPromise = null;
  let writePromise = null;
  let revision = 0;
  let writtenRevision = 0;
  let settingsReadFailed = false;

  const isObject = (value) => Boolean(value && typeof value === 'object' && !Array.isArray(value));
  function numberInRange(value, fallback, min, max) {
    if ((typeof value !== 'number' && typeof value !== 'string') || String(value).trim() === '') return fallback;
    const number = Number(value);
    return Number.isFinite(number) ? Math.max(min, Math.min(max, number)) : fallback;
  }
  function validPatch(patch) {
    const next = {};
    if (!isObject(patch)) return next;
    if (typeof patch.voiceURI === 'string') next.voiceURI = patch.voiceURI;
    for (const [key, min, max] of [['rate', 0.70, 1.15], ['pitch', 0.85, 1.30]]) {
      const value = numberInRange(patch[key], null, min, max);
      if (value !== null) next[key] = value;
    }
    return next;
  }
  function engine() {
    try { return window.speechSynthesis || null; } catch (_) { return null; }
  }
  function supported(synth = engine()) {
    return Boolean(synth && typeof synth.speak === 'function' && typeof synth.cancel === 'function' &&
      typeof window.SpeechSynthesisUtterance === 'function');
  }
  function getSettings() { return { ...settings }; }
  function getVoices() { return voices.slice(); }
  function getState(type = 'state') {
    return {
      type, settings: getSettings(), voices: getVoices(), voiceStatus, status,
      error: lastError ? { ...lastError } : null,
      owner: active ? active.owner : stateOwner,
      context: active ? active.context : stateContext,
      requestId: active ? active.id : requestId
    };
  }
  function emit(type) {
    // A subscriber may stop speech or start another request; it cannot corrupt later snapshots.
    for (const listener of Array.from(listeners)) {
      try { listener(getState(type)); } catch (_) { /* UI listeners must not break speech. */ }
    }
  }
  function reportError(code, message, owner, context) {
    lastError = { code, message };
    if (!active) {
      status = code === 'unavailable' ? 'unavailable' : 'error';
      stateOwner = owner || null;
      stateContext = context || null;
    }
    emit('error');
  }
  function scoreVoice(voice) {
    const identity = `${voice.name || ''} ${voice.voiceURI || ''}`.toLowerCase();
    let score = 0;
    if (/nanami|kyoko|haruka|mizuki|sayaka|sakura|hikari|yui|aoi|hina|female|woman/i.test(identity)) score += 8;
    if (/google|microsoft|siri|apple|enhanced|premium|neural|online/i.test(identity)) score += 2;
    if (/otoya|ichiro|male|man/i.test(identity)) score -= 3;
    if (/^ja-jp$/i.test(String(voice.lang || ''))) score += 2;
    if (voice.localService === false) score += 1;
    if (voice.default) score += 0.5;
    return score;
  }
  function getPreferredVoice() {
    return voices.find((voice) => voice.voiceURI === settings.voiceURI) ||
      voices.reduce((best, voice) => !best || scoreVoice(voice) > scoreVoice(best) ? voice : best, null);
  }
  function refreshVoices(finalAttempt = false, owner, context) {
    const synth = engine();
    let all;
    try { all = synth && typeof synth.getVoices === 'function' ? Array.from(synth.getVoices() || []) : []; }
    catch (_) {
      voiceStatus = 'unavailable';
      reportError('voices-unavailable', 'Không thể đọc danh sách giọng trên thiết bị. Hãy chạm nút nghe để thử lại.', owner, context);
      return false;
    }
    const next = all.filter((voice) => voice && /^ja(?:-|$)/i.test(String(voice.lang || '')));
    const nextStatus = next.length ? 'ready' : all.length || finalAttempt || !supported(synth) ? 'unavailable' : 'waiting';
    const changed = nextStatus !== voiceStatus || next.length !== voices.length || next.some((voice, index) => {
      const old = voices[index];
      return !old || voice.voiceURI !== old.voiceURI || voice.name !== old.name || voice.lang !== old.lang;
    });
    voices = next;
    voiceStatus = nextStatus;
    if (changed) emit('voices');
    return true;
  }
  function subscribe(listener) {
    if (typeof listener !== 'function') return () => {};
    listeners.add(listener);
    return () => listeners.delete(listener);
  }

  function applySavedSettings(saved) {
    if (!isObject(saved)) return;
    savedExtras = { ...saved };
    for (const key of Object.keys(DEFAULTS)) delete savedExtras[key];
    const loaded = validPatch(saved);
    for (const key of Object.keys(loaded)) if (!patchedFields.has(key)) settings[key] = loaded[key];
  }

  function init() {
    if (initPromise) return initPromise;
    // Promise assignment precedes storage work, including reentrant UI callbacks.
    initPromise = Promise.resolve().then(async () => {
      try {
        const saved = window.AppStore && typeof window.AppStore.get === 'function'
          ? await window.AppStore.get(SETTINGS_KEY, null) : null;
        applySavedSettings(saved);
      } catch (_) {
        settingsReadFailed = true;
        reportError('settings-read', 'Không thể đọc cài đặt giọng đọc đã lưu trên thiết bị.');
      }
      emit('settings');
      return getSettings();
    });
    const synth = engine();
    if (!supported(synth)) status = 'unavailable';
    if (synth) {
      const onVoicesChanged = () => refreshVoices(true);
      let attached = false;
      try {
        if (typeof synth.addEventListener === 'function') {
          synth.addEventListener('voiceschanged', onVoicesChanged);
          attached = true;
        }
      } catch (_) { /* Some older engines expose an unusable EventTarget method. */ }
      if (!attached) {
        // Older engines expose only the property. Preserve the existing listener.
        try {
          const previous = synth.onvoiceschanged;
          synth.onvoiceschanged = function (event) {
            if (typeof previous === 'function') {
              try { previous.call(this, event); } catch (_) { /* Independent listener. */ }
            }
            onVoicesChanged();
          };
        } catch (_) { /* The fallback timer and explicit speak still refresh voices. */ }
      }
    }
    refreshVoices();
    if (typeof window.setTimeout === 'function') window.setTimeout(() => refreshVoices(true), 350);
    window.addEventListener('pagehide', () => stop());
    document.addEventListener('visibilitychange', () => { if (document.hidden) stop(); });
    return initPromise;
  }

  function persistSettings() {
    if (writePromise) return writePromise;
    writePromise = (async () => {
      if (settingsReadFailed) {
        // One retry per user persistence attempt; never overwrite preferences we could not read.
        try {
          const store = window.AppStore;
          if (!store || typeof store.get !== 'function') throw new Error('Settings storage unavailable');
          applySavedSettings(await store.get(SETTINGS_KEY, null));
          settingsReadFailed = false;
          emit('settings');
        } catch (_) {
          reportError('settings-read', 'Không thể đọc cài đặt giọng đọc đã lưu trên thiết bị.');
          return false;
        }
      }
      let saved = true;
      while (writtenRevision < revision) {
        const writingRevision = revision;
        try {
          const store = window.AppStore;
          const success = store && typeof store.set === 'function' &&
            await store.set(SETTINGS_KEY, { ...savedExtras, ...settings });
          if (!success) throw new Error('Settings storage unavailable');
        } catch (_) {
          saved = false;
          reportError('settings-write', 'Chưa lưu được cài đặt giọng đọc trên thiết bị. Hãy kiểm tra dung lượng lưu trữ.');
        }
        // One failed attempt must not loop forever; a later user edit can try again.
        writtenRevision = writingRevision;
      }
      return saved;
    })().finally(() => { writePromise = null; });
    return writePromise;
  }
  function setSettings(patch) {
    const ready = init();
    const next = validPatch(patch);
    if (!Object.keys(next).length) return ready.then(() => true);
    for (const key of Object.keys(next)) {
      settings[key] = next[key];
      patchedFields.add(key);
    }
    revision += 1;
    emit('settings');
    // Never persist defaults over saved fields that have not finished loading yet.
    return ready.then(persistSettings);
  }

  function cancelCurrent(match, invalidate) {
    const request = active;
    if (!request || (match.owner !== undefined && request.owner !== match.owner) ||
      (match.context !== undefined && request.context !== match.context)) return false;
    if (invalidate) requestId += 1;
    active = null; // Cancel callbacks from this request are now obsolete.
    try { request.engine.cancel(); }
    catch (_) {
      if (!active) active = request;
      reportError('cancel-failed', 'Không thể dừng âm thanh trên thiết bị. Hãy thử lại.', request.owner, request.context);
      return false;
    }
    if (!active) {
      status = 'idle';
      lastError = null;
      stateOwner = request.owner;
      stateContext = request.context;
      emit('state');
    }
    return true;
  }
  function stop(options = {}) {
    return cancelCurrent(isObject(options) ? options : {}, true);
  }
  function speechError(event) {
    const code = event && event.error ? String(event.error) : 'speech-failed';
    const message = code === 'not-allowed'
      ? 'Thiết bị chưa cho phép phát âm. Hãy chạm nút nghe một lần nữa.'
      : code === 'language-unavailable' || code === 'voice-unavailable'
        ? 'Thiết bị chưa có giọng tiếng Nhật phù hợp. Hãy kiểm tra giọng đọc trong cài đặt thiết bị.'
        : 'Không thể phát âm thanh trên thiết bị này. Hãy chạm nút nghe để thử lại.';
    return { code, message };
  }
  function speak(text, options = {}) {
    let spoken;
    try { spoken = text === null || text === undefined ? '' : String(text); }
    catch (_) { return false; }
    if (!spoken.trim()) return false;
    options = isObject(options) ? options : {};
    init(); // Do not await: native speech must stay in the user's click call stack.
    if (document.hidden) return false;
    const id = ++requestId;
    const owner = typeof options.owner === 'string' ? options.owner : null;
    const context = typeof options.context === 'string' ? options.context : null;
    const synth = engine();
    if (!supported(synth)) {
      reportError('unavailable', 'Trình duyệt này chưa hỗ trợ phát âm tự động.', owner, context);
      return false;
    }
    if (!refreshVoices(false, owner, context) || id !== requestId) return false;
    let utterance;
    try {
      utterance = new window.SpeechSynthesisUtterance(spoken);
      const voice = getPreferredVoice();
      utterance.lang = voice && voice.lang ? voice.lang : 'ja-JP';
      utterance.rate = numberInRange(options.rate, settings.rate, 0.70, 1.15);
      utterance.pitch = numberInRange(options.pitch, settings.pitch, 0.85, 1.30);
      utterance.volume = numberInRange(options.volume, 1, 0, 1);
      if (voice) utterance.voice = voice;
    } catch (_) {
      reportError('speech-failed', 'Không thể phát âm thanh trên thiết bị này. Hãy chạm nút nghe để thử lại.', owner, context);
      return false;
    }
    if (active && !cancelCurrent({}, false)) return false;
    if (id !== requestId) return false;
    const request = { id, owner, context, engine: synth, utterance };
    active = request; // Strong reference until end/error/explicit stop (important on Safari).
    status = 'pending';
    lastError = null;
    stateOwner = owner;
    stateContext = context;
    utterance.onstart = () => {
      if (active !== request) return;
      status = 'speaking';
      emit('state');
    };
    utterance.onend = () => {
      if (active !== request) return;
      active = null;
      status = 'idle';
      emit('state');
    };
    utterance.onerror = (event) => {
      if (active !== request) return;
      active = null;
      const error = speechError(event);
      if (error.code === 'canceled' || error.code === 'interrupted') {
        status = 'idle';
        emit('state');
      } else reportError(error.code, error.message, owner, context);
    };
    try { synth.speak(utterance); }
    catch (_) {
      if (active === request) {
        active = null;
        reportError('speech-failed', 'Không thể phát âm thanh trên thiết bị này. Hãy chạm nút nghe để thử lại.', owner, context);
      }
      return false;
    }
    if (active === request) emit('state');
    return true;
  }

  window.KDSPAudio = { init, speak, stop, getVoices, getPreferredVoice, getSettings, setSettings, subscribe, getState };
})();
