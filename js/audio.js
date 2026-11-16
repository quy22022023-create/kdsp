/* Shared Japanese speech. Settings stay in the existing AppStore key; no DOM or backend dependency. */
(function () {
  'use strict';

  if (window.KDSPAudio) return;
  const SETTINGS_KEY = 'jp_app_speech_settings_v1';
  const DEFAULTS = { voiceURI: '', rate: 0.92, pitch: 1.0 };
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

  // Bang anh xa am tiet don le (Hiragana / Katakana) bang ma Unicode an toan
  const ISOLATED_KANA_MAP = {
    '\u3092': '\u3092\u3002', // を -> を。
    '\u30F2': '\u30F2\u3002', // ヲ -> ヲ。
    '\u3093': '\u3093\u3002', // ん -> ん。
    '\u30F3': '\u30F3\u3002', // ン -> ン。
    '\u3063': '\u3063\u3001\u3064\u3002', // っ -> っ、つ。
    '\u30C3': '\u30C3\u3001\u30C4\u3002', // ッ -> ッ、ツ。
    '\u30FC': '\u3042\u30FC\u3002', // ー -> あー。
    '\u3041': '\u3042\u3002', '\u3043': '\u3044\u3002', '\u3045': '\u3046\u3002', '\u3047': '\u3048\u3002', '\u3049': '\u304A\u3002',
    '\u30A1': '\u30A2\u3002', '\u30A3': '\u30A4\u3002', '\u30A5': '\u30A6\u3002', '\u30A7': '\u30A8\u3002', '\u30A9': '\u30AA\u3002',
    '\u3083': '\u3084\u3002', '\u3085': '\u3086\u3002', '\u3087': '\u3088\u3002',
    '\u30E3': '\u30E4\u3002', '\u30E5': '\u30E6\u3002', '\u30E7': '\u30E8\u3002',
    '\u308E': '\u308F\u3002', '\u30EE': '\u30EF\u3002'
  };

  const KANA_ONLY_RE = /^[\u3040-\u309F\u30A0-\u30FF\u31F0-\u31FF\uFF65-\uFF9F\s\u30FB\u3001\u3002\uFF0F/\-]+$/;
  const SINGLE_MORA_RE = /^[\u3041-\u3096\u30A1-\u30FA][\u3099\u309A\u3041\u3043\u3045\u3047\u3049\u3083\u3085\u3087\u308E\u30A1\u30A3\u30A5\u30A7\u30A9\u30E3\u30E5\u30E7\u30EE]?$/;

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
  function isNeuralVoice(voice) {
    if (!voice) return false;
    const identity = `${voice.name || ''} ${voice.voiceURI || ''}`.toLowerCase();
    return /natural|neural|online|siri|enhanced|premium|o-ren|nanami|mayu|shiori|wavenet/i.test(identity);
  }
  function scoreVoice(voice) {
    const identity = `${voice.name || ''} ${voice.voiceURI || ''}`.toLowerCase();
    let score = 0;
    if (/natural|neural|siri|o-ren|nanami|mayu|shiori|enhanced|premium/i.test(identity)) score += 20;
    if (/online|wavenet|network/i.test(identity)) score += 6;
    if (/kyoko|haruka|mizuki|sayaka|sakura|hikari|yui|aoi|hina|ayumi|female|woman/i.test(identity)) score += 10;
    if (/google|microsoft|apple/i.test(identity)) score += 3;
    if (/compact|espeak|festival/i.test(identity)) score -= 10;
    if (/otoya|ichiro|keita|daichi|naoki|male|man/i.test(identity)) score -= 5;
    if (/^ja-jp$/i.test(String(voice.lang || ''))) score += 3;
    else if (/^ja/i.test(String(voice.lang || ''))) score += 1;
    if (voice.localService === false) score += 2;
    if (voice.default) score += 0.5;
    return score;
  }
  function getPreferredVoice() {
    return voices.find((voice) => voice.voiceURI === settings.voiceURI) ||
      voices.reduce((best, voice) => !best || scoreVoice(voice) > scoreVoice(best) ? voice : best, null);
  }

  function formatSpeechText(rawText) {
    let text = String(rawText || '').trim();
    if (!text) return { text: '', mode: 'word' };

    text = text.replace(/[\r\n]+/g, '\u3002').replace(/\u3000+/g, ' ');

    // Loai bo chu thich Romaji / Tieng Viet trong ngoac khi di kem chu Nhat
    if (/[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]/.test(text)) {
      text = text.replace(/\s*[\(\[\uFF08\u3010][a-zA-Z\u00C0-\u1EF90-9\s,\-\/\.]+[\)\]\uFF09\u3011]/g, '');
      text = text.trim();
    }

    // Thay o trong bai tap (___, [ ]) bang dau phay ngat nhip
    text = text.replace(/[_\uFF3F]{2,}|\[\s*\]|\uFF08\s*\uFF09|\(\s*\)|[\u2605\u2606]+/g, '\u3001');

    // Xu ly doc tung chu cai Kana don le trong bang chu cai
    const cleanKana = text.replace(/[\u3002\u3001\u30FB\s]/g, '');
    if (ISOLATED_KANA_MAP[cleanKana] && text.length <= 2) {
      return { text: ISOLATED_KANA_MAP[cleanKana], mode: 'kana' };
    }
    if (SINGLE_MORA_RE.test(cleanKana) && text.length <= 3) {
      return { text: cleanKana + '\u3002', mode: 'kana' };
    }

    // Xu ly doc mot day bang chu cai (VD: あ い う え お)
    if (KANA_ONLY_RE.test(text)) {
      const parts = text.split(/[\s\u30FB\uFF0F/\-,\u3001]+/).filter(Boolean);
      if (parts.length > 1 && parts.every((p) => SINGLE_MORA_RE.test(p) || ISOLATED_KANA_MAP[p])) {
        const mapped = parts.map((p) => (ISOLATED_KANA_MAP[p] ? ISOLATED_KANA_MAP[p].replace(/\u3002$/, '') : p));
        return { text: mapped.join('\u3001') + '\u3002', mode: 'kana' };
      }
    }

    // Chuyen cac dau gach cheo, dau cham giua, ngoac don thanh nhip lay hoi tu nhien
    text = text
      .replace(/[\/\uFF0F|\uFF5C\u30FB\u2022]+/g, '\u3001')
      .replace(/\s*[~\u301C\uFF5E]+\s*/g, '\u3001')
      .replace(/[\uFF08\(]([^\uFF09\)]+)[\uFF09\)]/g, '\u3001$1\u3001')
      .replace(/[\u3001,\s]*\u3001[\u3001,\s]*/g, '\u3001')
      .replace(/\u3002+/g, '\u3002')
      .replace(/^\u3001+|\u3001+$/g, '')
      .trim();

    const isSentence = text.length > 8 || /[\u3002\uFF1F\uFF01?!\u3001]/.test(text);
    const politeQuestionRe = /(\u307E\u3059\u304B|\u3067\u3059\u304B|\u307E\u3057\u305F\u304B|\u3067\u3057\u305F\u304B|\u307E\u305B\u3093\u304B|\u3067\u3057\u3087\u3046\u304B)\u3002?$/;

    if (isSentence) {
      if (politeQuestionRe.test(text)) {
        text = text.replace(/\u3002?$/, '\uFF1F');
      } else if (/[^\u3002\uFF1F\uFF01?!]$/.test(text)) {
        text += '\u3002';
      }
      return { text, mode: 'sentence' };
    }

    if (/[^\u3002\uFF1F\uFF01?!]$/.test(text)) {
      text += '\u3002';
    }
    return { text, mode: 'word' };
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
    const next = all
      .filter((voice) => voice && /^ja(?:-|_|$)/i.test(String(voice.lang || '')))
      .sort((a, b) => scoreVoice(b) - scoreVoice(a));
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
    return ready.then(persistSettings);
  }

  function cancelCurrent(match, invalidate) {
    const request = active;
    if (!request || (match.owner !== undefined && request.owner !== match.owner) ||
      (match.context !== undefined && request.context !== match.context)) return false;
    if (invalidate) requestId += 1;
    active = null;
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
    let rawSpoken;
    try { rawSpoken = text === null || text === undefined ? '' : String(text); }
    catch (_) { return false; }
    if (!rawSpoken.trim()) return false;
    options = isObject(options) ? options : {};
    init();
    if (document.hidden) return false;

    const { text: spoken, mode } = formatSpeechText(rawSpoken);
    if (!spoken) return false;

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

      const baseRate = numberInRange(options.rate, settings.rate, 0.70, 1.15);
      utterance.rate = options.rate !== undefined
        ? baseRate
        : mode === 'kana'
          ? Math.max(0.75, Number((baseRate * 0.90).toFixed(2)))
          : mode === 'word'
            ? Math.max(0.80, Number((baseRate * 0.96).toFixed(2)))
            : baseRate;

      utterance.pitch = options.pitch !== undefined
        ? numberInRange(options.pitch, 1.0, 0.85, 1.30)
        : isNeuralVoice(voice)
          ? 1.0
          : numberInRange(settings.pitch, 1.0, 0.85, 1.30);

      utterance.volume = numberInRange(options.volume, 1, 0, 1);
      if (voice) utterance.voice = voice;
    } catch (_) {
      reportError('speech-failed', 'Không thể phát âm thanh trên thiết bị này. Hãy chạm nút nghe để thử lại.', owner, context);
      return false;
    }
    if (active && !cancelCurrent({}, false)) return false;
    if (id !== requestId) return false;
    const request = { id, owner, context, engine: synth, utterance };
    active = request;
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
