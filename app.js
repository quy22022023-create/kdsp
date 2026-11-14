/**
 * =========================================================================
 * KHO TỪ VỰNG CHUNG PHÂN CẤP N5 -> N3 & LUYỆN DỊCH CÂU (DUOLINGO MODE)
 * =========================================================================
 */
const EXTRA_CARDS_STORAGE_KEY = 'jlpt_n5_n3_extra_cards_v1';
const EXTRA_SENTENCES_STORAGE_KEY = 'jlpt_n5_n3_extra_sentences_v1';
const PROGRESS_STORAGE_KEY = 'jlpt_n5_n3_progress_v1';
const ALLOWED_LEVELS = ['N5', 'N4', 'N3'];

let REPO_CARDS = [];
let REPO_SENTENCES = [];

let state = {
  selectedLevel: 'ALL',    // 'ALL' | 'N5' | 'N4' | 'N3'
  selectedTopic: 'ALL',    // 'ALL' | tên chủ đề
  mode: 'flashcard',       // 'flashcard' | 'quiz' | 'translate'
  filterUnmastered: false,
  voiceMode: 'normal',     // 'normal' | 'slow'
  currentCardIndex: 0,
  isFlipped: false,
  customOrderIds: null,
  progress: {},
  quiz: {
    questions: [],
    currentIndex: 0,
    score: 0,
    answered: false,
    wrongCards: []
  },
  translate: {
    queue: [],
    currentIndex: 0,
    completedCount: 0,
    energy: 0,
    bankChips: [],      // [{ bankIdx, text, used }]
    selectedBankIds: [], // [bankIdx, ...] theo thứ tự người dùng chạm
    checked: false,
    isCorrect: false,
    activeTokenIdx: -1
  }
};

/**
 * =========================================================================
 * 1. CHUẨN HÓA DỮ LIỆU (TỪ VỰNG & CÂU DỊCH) + KHÓA KIỂM TRA TRÙNG LẶP
 * =========================================================================
 */
function normalizeLevel(rawLevel) {
  const upper = String(rawLevel || 'N5').trim().toUpperCase();
  return ALLOWED_LEVELS.includes(upper) ? upper : 'N5';
}

function isSentenceItem(raw) {
  if (!raw || typeof raw !== 'object') return false;
  return raw.type === 'sentence' || Array.isArray(raw.tokens) || Array.isArray(raw.vi_blocks);
}

function getDuplicateSignature(item) {
  if (isSentenceItem(item)) {
    const jp = String(item.jp || '').replace(/[。．.！!？?]/g, '').trim();
    return `SENT||${jp}`;
  }
  const jp = String(item.jp || '').trim();
  const kanji = String(item.kanji || '').trim();
  return `${jp}||${kanji}`;
}

function generateStableCardId(item, fallbackIdx = 0) {
  const sig = getDuplicateSignature(item);
  if (sig !== '||' && sig !== 'SENT||') {
    return 'card_' + encodeURIComponent(sig);
  }
  return `card_idx_${fallbackIdx}_${Date.now()}`;
}

function normalizeCardObject(raw, idx = 0) {
  const jp = String(raw.jp || raw.kanji || '').trim();
  const kanji = String(raw.kanji || '').trim();
  const normalized = {
    type: 'vocab',
    level: normalizeLevel(raw.level),
    topic: String(raw.topic || 'Từ vựng chung').trim() || 'Từ vựng chung',
    jp: jp || '???',
    kanji: kanji === jp ? '' : kanji,
    romaji: String(raw.romaji || '').trim(),
    vi: String(raw.vi || 'Chưa có nghĩa').trim(),
    mnemonic: String(raw.mnemonic || 'Ghi nhớ qua lật thẻ và trắc nghiệm.').trim()
  };
  normalized.id = raw.id || generateStableCardId(normalized, idx);
  return normalized;
}

function normalizeSentenceObject(raw, idx = 0) {
  const jp = String(raw.jp || '').trim();
  const vi = String(raw.vi || '').trim();
  const tokens = Array.isArray(raw.tokens) && raw.tokens.length > 0
    ? raw.tokens.map(t => ({
        jp: String(t.jp || '').trim(),
        romaji: String(t.romaji || '').trim(),
        vi: String(t.vi || '').trim()
      })).filter(t => t.jp)
    : [{ jp: jp.replace(/[。．.！!？?]+$/g, ''), romaji: String(raw.romaji || '').trim(), vi }];

  const viBlocks = Array.isArray(raw.vi_blocks) && raw.vi_blocks.length > 0
    ? raw.vi_blocks.map(w => String(w).trim()).filter(Boolean)
    : vi.replace(/[.,!?？。]+$/g, '').split(/\s+/).filter(Boolean);

  const distractors = Array.isArray(raw.distractors)
    ? raw.distractors.map(w => String(w).trim()).filter(Boolean)
    : [];

  const normalized = {
    type: 'sentence',
    level: normalizeLevel(raw.level),
    topic: String(raw.topic || 'Luyện dịch câu').trim() || 'Luyện dịch câu',
    jp: jp || tokens.map(t => t.jp).join(''),
    romaji: String(raw.romaji || tokens.map(t => t.romaji).filter(Boolean).join(' ')).trim(),
    tokens,
    vi: vi || viBlocks.join(' '),
    vi_blocks: viBlocks,
    distractors
  };
  normalized.id = raw.id || generateStableCardId(normalized, idx);
  return normalized;
}

/**
 * =========================================================================
 * 2. NẠP & LƯU DỮ LIỆU (HỢP NHẤT DATA.JS + LOCALSTORAGE)
 * =========================================================================
 */
function loadRepository() {
  const sourceArray = (typeof VOCAB_DATA !== 'undefined' && Array.isArray(VOCAB_DATA))
    ? VOCAB_DATA
    : (typeof window !== 'undefined' && Array.isArray(window.VOCAB_DATA) ? window.VOCAB_DATA : []);

  const fileVocab = [];
  const fileSentences = [];

  sourceArray.forEach((item, idx) => {
    if (isSentenceItem(item)) {
      fileSentences.push({ ...normalizeSentenceObject(item, idx), source: 'data.js' });
    } else {
      fileVocab.push({ ...normalizeCardObject(item, idx), source: 'data.js' });
    }
  });

  let extraVocab = [];
  let extraSentences = [];
  try {
    const savedExtra = localStorage.getItem(EXTRA_CARDS_STORAGE_KEY);
    if (savedExtra) {
      const parsed = JSON.parse(savedExtra);
      if (Array.isArray(parsed)) {
        parsed.forEach((item, idx) => {
          if (isSentenceItem(item)) {
            extraSentences.push({ ...normalizeSentenceObject(item, idx), source: 'json' });
          } else {
            extraVocab.push({ ...normalizeCardObject(item, idx), source: 'json' });
          }
        });
      }
    }

    const savedSentences = localStorage.getItem(EXTRA_SENTENCES_STORAGE_KEY);
    if (savedSentences) {
      const parsedSent = JSON.parse(savedSentences);
      if (Array.isArray(parsedSent)) {
        parsedSent.forEach((item, idx) => {
          extraSentences.push({ ...normalizeSentenceObject(item, idx), source: 'json' });
        });
      }
    }

    const savedProgress = localStorage.getItem(PROGRESS_STORAGE_KEY);
    if (savedProgress) {
      const parsedProg = JSON.parse(savedProgress);
      if (parsedProg && typeof parsedProg === 'object') {
        state.progress = parsedProg;
      }
    }
  } catch (e) {
    extraVocab = [];
    extraSentences = [];
    state.progress = {};
  }

  REPO_CARDS = [...fileVocab, ...extraVocab];
  REPO_SENTENCES = [...fileSentences, ...extraSentences];
}

function saveExtraCardsToStorage() {
  try {
    const extraOnly = REPO_CARDS
      .filter(c => c.source === 'json')
      .map(({ source, ...rest }) => rest);
    localStorage.setItem(EXTRA_CARDS_STORAGE_KEY, JSON.stringify(extraOnly));

    const extraSentOnly = REPO_SENTENCES
      .filter(s => s.source === 'json')
      .map(({ source, ...rest }) => rest);
    localStorage.setItem(EXTRA_SENTENCES_STORAGE_KEY, JSON.stringify(extraSentOnly));
  } catch (e) {
    showToast('Không thể lưu vào bộ nhớ trình duyệt');
  }
}

function saveProgressStorage() {
  try {
    localStorage.setItem(PROGRESS_STORAGE_KEY, JSON.stringify(state.progress));
  } catch (e) {}
}

/**
 * =========================================================================
 * 3. KIỂM TRA TRÙNG LẶP TỪ VỰNG & CÂU DỊCH
 * =========================================================================
 */
function findRepositoryDuplicates() {
  const seenMap = new Map();
  const duplicateGroups = [];
  const allItems = [...REPO_CARDS, ...REPO_SENTENCES];

  allItems.forEach((card, index) => {
    const sig = getDuplicateSignature(card);
    if (!seenMap.has(sig)) {
      seenMap.set(sig, [{ card, index }]);
    } else {
      seenMap.get(sig).push({ card, index });
    }
  });

  seenMap.forEach((entries, sig) => {
    if (entries.length > 1) {
      duplicateGroups.push({ signature: sig, entries });
    }
  });

  return duplicateGroups;
}

function updateRepoDuplicateBanner() {
  const lineEl = document.getElementById('repo-dup-line');
  const statusTextEl = document.getElementById('repo-dup-status-text');
  const groups = findRepositoryDuplicates();

  if (groups.length === 0) {
    lineEl.classList.remove('has-dup');
    statusTextEl.textContent = '✓ Kiểm tra trùng: Kho sạch, không có mục trùng lặp';
  } else {
    const extraCount = groups.reduce((sum, g) => sum + (g.entries.length - 1), 0);
    lineEl.classList.add('has-dup');
    statusTextEl.textContent = `⚠️ Phát hiện ${groups.length} mục bị trùng (${extraCount} bản thừa)`;
  }
}

function openDuplicateCheckerModal() {
  const groups = findRepositoryDuplicates();
  const bodyEl = document.getElementById('repo-dup-modal-body');
  const dedupeBtn = document.getElementById('dedupe-repo-btn');
  const totalRepoCount = REPO_CARDS.length + REPO_SENTENCES.length;

  if (groups.length === 0) {
    bodyEl.innerHTML = `
      <div class="dup-check-box clean">
        ✓ Toàn bộ ${totalRepoCount} mục trong kho hiện tại đều là duy nhất, không có mục nào bị trùng lặp.
      </div>
    `;
    dedupeBtn.style.display = 'none';
  } else {
    const hasFileDuplicates = groups.some(g => g.entries.filter(e => e.card.source === 'data.js').length > 1);
    bodyEl.innerHTML = `
      <div class="dup-check-box warning">
        ⚠️ Tìm thấy ${groups.length} mục xuất hiện nhiều hơn 1 lần trong kho:
      </div>
      ${groups.map(g => {
        const first = g.entries[0].card;
        const label = first.kanji ? `${first.kanji} (${first.jp})` : first.jp;
        const locations = g.entries.map(e => `${e.card.level} • ${e.card.topic} [${e.card.source}]`).join(' | ');
        return `
          <div class="dup-item-card">
            <strong>${escapeHtml(label)}</strong> — ${escapeHtml(first.vi)}<br/>
            <span class="text-muted">Vị trí: ${escapeHtml(locations)}</span>
          </div>
        `;
      }).join('')}
      ${hasFileDuplicates ? '<p class="text-muted" style="font-size:11px;">Lưu ý: Các bản trùng nằm cứng trong tệp <strong>data.js</strong> cần được xóa trực tiếp trong tệp data.js hoặc xuất lại tệp data.js mới.</p>' : ''}
    `;
    dedupeBtn.style.display = 'block';
  }

  document.getElementById('dup-modal').style.display = 'flex';
}

function closeDuplicateCheckerModal() {
  document.getElementById('dup-modal').style.display = 'none';
}

function deduplicateRepository() {
  const seen = new Set();
  const uniqueCards = [];
  const uniqueSentences = [];
  let removedCount = 0;

  REPO_CARDS.forEach(card => {
    const sig = getDuplicateSignature(card);
    if (!seen.has(sig)) {
      seen.add(sig);
      uniqueCards.push(card);
    } else if (card.source === 'json') {
      removedCount++;
    } else {
      uniqueCards.push(card);
    }
  });

  REPO_SENTENCES.forEach(sent => {
    const sig = getDuplicateSignature(sent);
    if (!seen.has(sig)) {
      seen.add(sig);
      uniqueSentences.push(sent);
    } else if (sent.source === 'json') {
      removedCount++;
    } else {
      uniqueSentences.push(sent);
    }
  });

  REPO_CARDS = uniqueCards;
  REPO_SENTENCES = uniqueSentences;
  saveExtraCardsToStorage();
  closeDuplicateCheckerModal();
  refreshUI();
  showToast(removedCount > 0 ? `Đã dọn ${removedCount} bản trùng thừa!` : 'Đã kiểm tra xong (bản trùng nằm trong data.js)');
}

/**
 * =========================================================================
 * 4. BỘ PHÁT ÂM TIẾNG NHẬT TỰ NHIÊN 2 TẦNG & HIỆU ỨNG ÂM THANH PHẢN HỒI
 * =========================================================================
 */
let cachedJaVoice = null;
let activeUtterance = null;
let activeAudioElement = null;
let fallbackTimerId = null;
let audioUnlocked = false;
const neuralAudioCache = new Map();

function unlockMobileAudio() {
  if (audioUnlocked) return;
  audioUnlocked = true;
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (AudioCtx) {
      const ctx = new AudioCtx();
      const buffer = ctx.createBuffer(1, 1, 22050);
      const source = ctx.createBufferSource();
      source.buffer = buffer;
      source.connect(ctx.destination);
      source.start(0);
    }
  } catch (e) {}
}

function playFeedbackTone(isSuccess) {
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const now = ctx.currentTime;

    if (isSuccess) {
      // Hai nốt vui tươi (C5 -> E5) giống Duolingo
      [523.25, 659.25].forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, now + idx * 0.11);
        gain.gain.setValueAtTime(0.12, now + idx * 0.11);
        gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.11 + 0.25);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now + idx * 0.11);
        osc.stop(now + idx * 0.11 + 0.26);
      });
    } else {
      // Nốt trầm nhẹ báo chưa đúng
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(220, now);
      osc.frequency.linearRampToValueAtTime(175, now + 0.25);
      gain.gain.setValueAtTime(0.12, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.28);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.29);
    }
  } catch (e) {}
}

function resolveBestJapaneseVoice() {
  if (!('speechSynthesis' in window)) return null;
  const voices = window.speechSynthesis.getVoices() || [];
  if (!voices.length) return null;

  const jaVoices = voices.filter(v =>
    v.lang && (v.lang.toLowerCase().startsWith('ja') || v.lang.toLowerCase().includes('jp'))
  );
  if (!jaVoices.length) return null;

  const preferredKeywords = [
    'siri', 'kyoko', 'o-ren', 'nanami', 'haruka',
    'ayumi', 'google 日本語', 'sayaka', 'ichika'
  ];

  for (const kw of preferredKeywords) {
    const match = jaVoices.find(v => v.name.toLowerCase().includes(kw));
    if (match) {
      cachedJaVoice = match;
      return match;
    }
  }

  cachedJaVoice = jaVoices[0];
  return cachedJaVoice;
}

if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
  resolveBestJapaneseVoice();
  if (typeof window.speechSynthesis.onvoiceschanged !== 'undefined') {
    window.speechSynthesis.onvoiceschanged = () => resolveBestJapaneseVoice();
  }
}

function setAudioButtonsPlaying(isPlaying) {
  document.querySelectorAll('.audio-btn').forEach(btn => {
    if (btn.classList.contains('solid')) {
      btn.textContent = isPlaying ? '🔊 Đang đọc...' : '🔊 Đọc lại';
    } else {
      btn.textContent = isPlaying ? '🔊 Đang đọc...' : '🔊 Nghe';
    }
  });
}

function sanitizeJapaneseForSpeech(rawText) {
  return String(rawText || '')
    .replace(/\([^)]*\)/g, '')
    .replace(/（[^）]*）/g, '')
    .replace(/\[[^\]]*\]/g, '')
    .replace(/[〜～]/g, '')
    .replace(/\s*[\/・]\s*/g, '、')
    .trim();
}

function stopSpeech() {
  if (fallbackTimerId) {
    clearTimeout(fallbackTimerId);
    fallbackTimerId = null;
  }

  if (activeAudioElement) {
    try {
      activeAudioElement.oncanplaythrough = null;
      activeAudioElement.onplay = null;
      activeAudioElement.onended = null;
      activeAudioElement.onerror = null;
      activeAudioElement.pause();
      activeAudioElement.currentTime = 0;
    } catch (e) {}
    activeAudioElement = null;
  }

  if ('speechSynthesis' in window) {
    try {
      if (window.speechSynthesis.speaking || window.speechSynthesis.pending) {
        window.speechSynthesis.cancel();
      }
    } catch (e) {}
  }
  activeUtterance = null;
  setAudioButtonsPlaying(false);
}

function buildNeuralTtsUrls(cleanText) {
  const encoded = encodeURIComponent(cleanText);
  return [
    `https://translate.googleapis.com/translate_tts?ie=UTF-8&client=tw-ob&tl=ja&q=${encoded}`,
    `https://translate.googleapis.com/translate_tts?ie=UTF-8&client=gtx&tl=ja&q=${encoded}`
  ];
}

function configurePitchPreservingAudio(audioEl, rate) {
  audioEl.playbackRate = rate;
  audioEl.defaultPlaybackRate = rate;
  if ('preservesPitch' in audioEl) audioEl.preservesPitch = true;
  if ('mozPreservesPitch' in audioEl) audioEl.mozPreservesPitch = true;
  if ('webkitPreservesPitch' in audioEl) audioEl.webkitPreservesPitch = true;
}

function speakJapanese(text) {
  const cleanText = sanitizeJapaneseForSpeech(text);
  if (!cleanText) return;

  stopSpeech();
  setAudioButtonsPlaying(true);

  const targetRate = state.voiceMode === 'slow' ? 0.72 : 0.96;

  if (neuralAudioCache.has(cleanText)) {
    const cachedSrc = neuralAudioCache.get(cleanText);
    playHtml5AudioSrc(cachedSrc, targetRate, () => {
      neuralAudioCache.delete(cleanText);
      speakWithDeviceVoice(cleanText);
    });
    return;
  }

  const urls = buildNeuralTtsUrls(cleanText);
  let settled = false;

  fallbackTimerId = setTimeout(() => {
    if (!settled) {
      settled = true;
      if (activeAudioElement) {
        try { activeAudioElement.pause(); } catch (e) {}
        activeAudioElement = null;
      }
      speakWithDeviceVoice(cleanText);
    }
  }, 1800);

  const tryUrl = (idx) => {
    if (settled) return;
    if (idx >= urls.length) {
      settled = true;
      clearTimeout(fallbackTimerId);
      speakWithDeviceVoice(cleanText);
      return;
    }

    const url = urls[idx];
    const audio = new Audio();
    audio.preload = 'auto';
    audio.referrerPolicy = 'no-referrer';
    configurePitchPreservingAudio(audio, targetRate);
    activeAudioElement = audio;

    audio.onplay = () => {
      if (settled) return;
      settled = true;
      clearTimeout(fallbackTimerId);
      neuralAudioCache.set(cleanText, url);
      setAudioButtonsPlaying(true);
    };

    audio.onended = () => {
      activeAudioElement = null;
      setAudioButtonsPlaying(false);
    };

    audio.onerror = () => {
      if (!settled) tryUrl(idx + 1);
    };

    audio.src = url;
    const playPromise = audio.play();
    if (playPromise && typeof playPromise.catch === 'function') {
      playPromise.catch(() => {
        if (!settled) {
          settled = true;
          clearTimeout(fallbackTimerId);
          speakWithDeviceVoice(cleanText);
        }
      });
    }
  };

  tryUrl(0);
}

function playHtml5AudioSrc(src, rate, onFail) {
  const audio = new Audio(src);
  audio.referrerPolicy = 'no-referrer';
  configurePitchPreservingAudio(audio, rate);
  activeAudioElement = audio;

  audio.onplay = () => setAudioButtonsPlaying(true);
  audio.onended = () => {
    activeAudioElement = null;
    setAudioButtonsPlaying(false);
  };
  audio.onerror = () => {
    activeAudioElement = null;
    if (typeof onFail === 'function') onFail();
  };

  audio.play().catch(() => {
    activeAudioElement = null;
    if (typeof onFail === 'function') onFail();
  });
}

function speakWithDeviceVoice(cleanText) {
  if (!('speechSynthesis' in window)) {
    setAudioButtonsPlaying(false);
    return;
  }

  try {
    const paddedText = cleanText.length <= 2 ? `${cleanText}、` : cleanText;
    const utterance = new SpeechSynthesisUtterance(paddedText);
    const voice = cachedJaVoice || resolveBestJapaneseVoice();

    if (voice) {
      utterance.voice = voice;
      utterance.lang = voice.lang || 'ja-JP';
    } else {
      utterance.lang = 'ja-JP';
    }

    utterance.rate = state.voiceMode === 'slow' ? 0.68 : 0.92;
    utterance.pitch = 1.0;
    utterance.volume = 1.0;

    utterance.onstart = () => setAudioButtonsPlaying(true);
    utterance.onend = () => {
      activeUtterance = null;
      setAudioButtonsPlaying(false);
    };
    utterance.onerror = () => {
      activeUtterance = null;
      setAudioButtonsPlaying(false);
    };

    activeUtterance = utterance;
    window.speechSynthesis.speak(utterance);
  } catch (e) {
    setAudioButtonsPlaying(false);
  }
}

function toggleSpeechRate() {
  state.voiceMode = state.voiceMode === 'normal' ? 'slow' : 'normal';
  const btn = document.getElementById('speech-rate-btn');
  btn.textContent = state.voiceMode === 'normal' ? 'Đọc: Chuẩn' : 'Đọc: Chậm';
  showToast(state.voiceMode === 'normal' ? 'Tốc độ đọc chuẩn' : 'Tốc độ đọc chậm rõ âm');

  if (state.mode === 'translate') {
    speakTranslateSentence();
  } else {
    speakCurrentCard();
  }
}

/**
 * =========================================================================
 * 5. BỘ LỌC PHÂN CẤP (N5 -> N3) & CHỦ ĐỀ
 * =========================================================================
 */
function getCardsByLevel(level) {
  if (level === 'ALL') return REPO_CARDS;
  return REPO_CARDS.filter(c => c.level === level);
}

function getSentencesByLevel(level) {
  if (level === 'ALL') return REPO_SENTENCES;
  return REPO_SENTENCES.filter(s => s.level === level);
}

function getFilteredCards() {
  let list = getCardsByLevel(state.selectedLevel);

  if (state.selectedTopic !== 'ALL') {
    list = list.filter(c => c.topic === state.selectedTopic);
  }

  if (state.filterUnmastered) {
    list = list.filter(c => state.progress[c.id] !== 'known');
  }

  if (Array.isArray(state.customOrderIds) && state.customOrderIds.length > 0) {
    const orderIndex = new Map(state.customOrderIds.map((id, i) => [id, i]));
    list = [...list].sort((a, b) => {
      const ia = orderIndex.has(a.id) ? orderIndex.get(a.id) : 999999;
      const ib = orderIndex.has(b.id) ? orderIndex.get(b.id) : 999999;
      return ia - ib;
    });
  }

  return list;
}

function selectLevel(level) {
  state.selectedLevel = level;
  state.selectedTopic = 'ALL';
  state.currentCardIndex = 0;
  state.isFlipped = false;

  document.querySelectorAll('.level-pill').forEach(btn => {
    btn.classList.toggle('active', btn.getAttribute('data-level') === level);
  });

  refreshUI();
}

function selectTopic(topic) {
  state.selectedTopic = topic;
  state.currentCardIndex = 0;
  state.isFlipped = false;

  if (state.mode === 'flashcard') renderFlashcard();
  else if (state.mode === 'quiz') startQuiz(false);
  else startTranslateLesson();
}

function toggleUnmasteredFilter() {
  state.filterUnmastered = !state.filterUnmastered;
  state.currentCardIndex = 0;
  state.isFlipped = false;

  const btn = document.getElementById('filter-unmastered-btn');
  btn.classList.toggle('filter-active', state.filterUnmastered);

  if (state.mode === 'flashcard') renderFlashcard();
  else if (state.mode === 'quiz') startQuiz(false);
  else startTranslateLesson();
}

function resetFilters() {
  state.selectedLevel = 'ALL';
  state.selectedTopic = 'ALL';
  state.filterUnmastered = false;
  state.currentCardIndex = 0;
  state.isFlipped = false;

  document.querySelectorAll('.level-pill').forEach(btn => {
    btn.classList.toggle('active', btn.getAttribute('data-level') === 'ALL');
  });
  document.getElementById('filter-unmastered-btn').classList.remove('filter-active');
  refreshUI();
}

function shuffleCurrentCards() {
  const ids = REPO_CARDS.map(c => c.id);
  for (let i = ids.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [ids[i], ids[j]] = [ids[j], ids[i]];
  }
  state.customOrderIds = ids;
  state.currentCardIndex = 0;
  state.isFlipped = false;

  showToast('Đã xáo trộn thứ tự bài học');
  if (state.mode === 'flashcard') renderFlashcard();
  else if (state.mode === 'quiz') startQuiz(false);
  else startTranslateLesson();
}

/**
 * =========================================================================
 * 6. CẬP NHẬT GIAO DIỆN CHÍNH & LẬT THẺ 3D
 * =========================================================================
 */
function refreshUI() {
  const totalCount = REPO_CARDS.length + REPO_SENTENCES.length;
  const hasData = totalCount > 0;

  const countAll = REPO_CARDS.length + REPO_SENTENCES.length;
  const countN5 = REPO_CARDS.filter(c => c.level === 'N5').length + REPO_SENTENCES.filter(s => s.level === 'N5').length;
  const countN4 = REPO_CARDS.filter(c => c.level === 'N4').length + REPO_SENTENCES.filter(s => s.level === 'N4').length;
  const countN3 = REPO_CARDS.filter(c => c.level === 'N3').length + REPO_SENTENCES.filter(s => s.level === 'N3').length;

  document.getElementById('count-ALL').textContent = countAll;
  document.getElementById('count-N5').textContent = countN5;
  document.getElementById('count-N4').textContent = countN4;
  document.getElementById('count-N3').textContent = countN3;

  document.getElementById('empty-app-state').style.display = hasData ? 'none' : 'flex';
  document.getElementById('deck-stats-card').style.display = hasData ? 'flex' : 'none';
  document.getElementById('toolbar-section').style.display = hasData ? 'block' : 'none';
  document.getElementById('export-data-btn').style.display = hasData ? 'inline-block' : 'none';

  if (!hasData) {
    document.getElementById('flashcard-view').style.display = 'none';
    document.getElementById('quiz-view').style.display = 'none';
    document.getElementById('translate-view').style.display = 'none';
    return;
  }

  populateTopicDropdown();
  updateStatsHeader();
  updateRepoDuplicateBanner();

  document.getElementById('flashcard-view').style.display = state.mode === 'flashcard' ? 'flex' : 'none';
  document.getElementById('quiz-view').style.display = state.mode === 'quiz' ? 'flex' : 'none';
  document.getElementById('translate-view').style.display = state.mode === 'translate' ? 'flex' : 'none';

  if (state.mode === 'flashcard') {
    renderFlashcard();
  } else if (state.mode === 'quiz') {
    startQuiz(false);
  } else {
    startTranslateLesson();
  }
}

function populateTopicDropdown() {
  const selectEl = document.getElementById('topic-select');
  const cardsInLevel = getCardsByLevel(state.selectedLevel);
  const sentsInLevel = getSentencesByLevel(state.selectedLevel);
  const topics = Array.from(new Set([
    ...cardsInLevel.map(c => c.topic),
    ...sentsInLevel.map(s => s.topic)
  ]));

  selectEl.innerHTML = `<option value="ALL">Tất cả chủ đề (${topics.length})</option>` +
    topics.map(t => `<option value="${escapeHtml(t)}">${escapeHtml(t)}</option>`).join('');

  if (topics.includes(state.selectedTopic)) {
    selectEl.value = state.selectedTopic;
  } else {
    state.selectedTopic = 'ALL';
    selectEl.value = 'ALL';
  }
}

function updateStatsHeader() {
  const scopeCards = getCardsByLevel(state.selectedLevel);
  const total = scopeCards.length;
  const known = scopeCards.filter(c => state.progress[c.id] === 'known').length;
  const pct = total > 0 ? Math.round((known / total) * 100) : 0;

  const titleLabel = state.selectedLevel === 'ALL'
    ? 'Kho tổng hợp (N5 → N3)'
    : `Cấp độ JLPT ${state.selectedLevel}`;

  document.getElementById('deck-title-display').textContent = titleLabel;
  document.getElementById('deck-known-count').textContent = `${known} đã thuộc`;
  document.getElementById('deck-total-count').textContent = `${total} thẻ`;
  document.getElementById('deck-progress-bar').style.width = `${pct}%`;
}

function renderFlashcard() {
  const visibleCards = getFilteredCards();
  const emptyFilter = document.getElementById('empty-filter-state');
  const stage = document.getElementById('card-stage-wrapper');
  const controls = document.getElementById('flashcard-controls');
  const posText = document.getElementById('card-position-text');

  updateStatsHeader();

  if (visibleCards.length === 0) {
    emptyFilter.style.display = 'flex';
    stage.style.display = 'none';
    controls.style.display = 'none';
    posText.textContent = '0 thẻ hiển thị';
    return;
  }

  emptyFilter.style.display = 'none';
  stage.style.display = 'block';
  controls.style.display = 'flex';

  if (state.currentCardIndex >= visibleCards.length) state.currentCardIndex = 0;
  if (state.currentCardIndex < 0) state.currentCardIndex = visibleCards.length - 1;

  const card = visibleCards[state.currentCardIndex];
  const status = state.progress[card.id];
  const lvlClass = card.level.toLowerCase();

  document.getElementById('flashcard-inner').classList.toggle('is-flipped', state.isFlipped);
  posText.textContent = `Thẻ ${state.currentCardIndex + 1} / ${visibleCards.length}`;

  // Mặt trước
  const frontLvl = document.getElementById('front-level-badge');
  frontLvl.textContent = card.level;
  frontLvl.className = `level-tag ${lvlClass}`;

  const furiganaEl = document.getElementById('front-kanji-furigana');
  const mainJpEl = document.getElementById('front-jp-text');
  const displayMain = card.kanji ? card.kanji : card.jp;

  if (card.kanji && card.jp && card.kanji !== card.jp) {
    furiganaEl.textContent = card.jp;
    furiganaEl.style.display = 'block';
  } else {
    furiganaEl.style.display = 'none';
  }

  mainJpEl.textContent = displayMain;
  document.getElementById('front-sub-tag').textContent = card.topic;

  const badge = document.getElementById('front-status-badge');
  if (status === 'known') {
    badge.textContent = '✓ Đã thuộc';
    badge.className = 'badge known';
  } else if (status === 'review') {
    badge.textContent = '↻ Cần ôn lại';
    badge.className = 'badge review';
  } else {
    badge.textContent = 'Chưa học';
    badge.className = 'badge';
  }

  // Mặt sau
  const backLvl = document.getElementById('back-level-tag');
  backLvl.textContent = card.level;
  backLvl.className = `level-tag ${lvlClass}`;

  document.getElementById('back-jp-mini').textContent =
    card.kanji && card.kanji !== card.jp ? `${card.kanji} (${card.jp})` : card.jp;
  document.getElementById('back-romaji-pill').textContent = card.romaji || '---';
  document.getElementById('back-romaji-main').textContent = card.romaji ? `/${card.romaji}/` : '';
  document.getElementById('back-meaning-vi').textContent = card.vi;
  document.getElementById('back-mnemonic-text').textContent = card.mnemonic;
}

function flipCard() {
  state.isFlipped = !state.isFlipped;
  document.getElementById('flashcard-inner').classList.toggle('is-flipped', state.isFlipped);
}

function speakCurrentCard() {
  const visible = getFilteredCards();
  if (!visible.length) return;
  const card = visible[state.currentCardIndex];
  speakJapanese(card.jp || card.kanji);
}

function nextCard() {
  const visible = getFilteredCards();
  if (!visible.length) return;
  stopSpeech();
  state.isFlipped = false;
  state.currentCardIndex = (state.currentCardIndex + 1) % visible.length;
  renderFlashcard();
}

function prevCard() {
  const visible = getFilteredCards();
  if (!visible.length) return;
  stopSpeech();
  state.isFlipped = false;
  state.currentCardIndex = (state.currentCardIndex - 1 + visible.length) % visible.length;
  renderFlashcard();
}

function rateCurrentCard(rating) {
  const visible = getFilteredCards();
  if (!visible.length) return;

  stopSpeech();
  const card = visible[state.currentCardIndex];
  state.progress[card.id] = rating;
  saveProgressStorage();

  showToast(rating === 'known' ? `Đã thuộc: ${card.kanji || card.jp}` : `Cần ôn lại: ${card.kanji || card.jp}`);
  state.isFlipped = false;

  if (state.filterUnmastered && rating === 'known') {
    const updated = getFilteredCards();
    if (state.currentCardIndex >= updated.length) state.currentCardIndex = 0;
  } else {
    state.currentCardIndex = (state.currentCardIndex + 1) % visible.length;
  }

  renderFlashcard();
}

/**
 * =========================================================================
 * 7. CHẾ ĐỘ 2: TRẮC NGHIỆM THÔNG MINH THEO PHÂN CẤP (N5 -> N3)
 * =========================================================================
 */
function setMode(newMode) {
  stopSpeech();
  state.mode = newMode;
  document.getElementById('mode-flashcard-btn').classList.toggle('active', newMode === 'flashcard');
  document.getElementById('mode-quiz-btn').classList.toggle('active', newMode === 'quiz');
  document.getElementById('mode-translate-btn').classList.toggle('active', newMode === 'translate');
  refreshUI();
}

function pickQuizFormatForCard(card) {
  const hasKanji = Boolean(card.kanji && card.kanji !== card.jp);
  if (card.level === 'N5' || !hasKanji) {
    return 'JP_TO_VI';
  }
  if (card.level === 'N4') {
    return Math.random() < 0.5 ? 'JP_TO_VI' : 'KANJI_TO_READING';
  }
  const modes = ['KANJI_TO_READING', 'VI_TO_KANJI', 'JP_TO_VI'];
  return modes[Math.floor(Math.random() * modes.length)];
}

function startQuiz(onlyWrong = false) {
  let pool = [];
  if (onlyWrong && state.quiz.wrongCards.length > 0) {
    pool = [...state.quiz.wrongCards];
  } else {
    const filtered = getFilteredCards();
    pool = filtered.length > 0 ? [...filtered] : [...REPO_CARDS];
  }

  if (pool.length === 0) return;

  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }

  state.quiz = {
    questions: pool.map(card => ({
      card,
      qType: pickQuizFormatForCard(card)
    })),
    currentIndex: 0,
    score: 0,
    answered: false,
    wrongCards: []
  };

  document.getElementById('quiz-summary-box').style.display = 'none';
  document.getElementById('quiz-active-box').style.display = 'flex';
  renderQuizQuestion();
}

function renderQuizQuestion() {
  const { questions, currentIndex, score } = state.quiz;
  if (currentIndex >= questions.length) {
    showQuizSummary();
    return;
  }

  state.quiz.answered = false;
  const { card: currentCard, qType } = questions[currentIndex];

  document.getElementById('quiz-question-num').textContent = `Câu ${currentIndex + 1}/${questions.length}`;
  document.getElementById('quiz-score-badge').textContent = `Điểm: ${score}`;

  const lvlTag = document.getElementById('quiz-card-level');
  lvlTag.textContent = currentCard.level;
  lvlTag.className = `level-tag ${currentCard.level.toLowerCase()} quiz-lvl`;

  const promptEl = document.getElementById('quiz-jp-prompt');
  const instructionEl = document.getElementById('quiz-instruction-text');
  const typeBadgeEl = document.getElementById('quiz-type-badge');
  promptEl.classList.remove('vi-prompt');

  if (qType === 'KANJI_TO_READING') {
    typeBadgeEl.textContent = 'Đọc Kanji';
    instructionEl.textContent = 'Chọn cách đọc Hiragana đúng của chữ Kanji:';
    promptEl.textContent = currentCard.kanji;
  } else if (qType === 'VI_TO_KANJI') {
    typeBadgeEl.textContent = 'Chọn Kanji';
    instructionEl.textContent = 'Chọn chữ Kanji tương ứng với nghĩa:';
    promptEl.textContent = currentCard.vi;
    promptEl.classList.add('vi-prompt');
  } else {
    typeBadgeEl.textContent = 'Nghĩa Việt';
    instructionEl.textContent = 'Chọn nghĩa tiếng Việt đúng:';
    promptEl.textContent = currentCard.kanji || currentCard.jp;
  }

  const romajiHint = document.getElementById('quiz-romaji-hint');
  romajiHint.textContent = `${currentCard.jp} • /${currentCard.romaji || '---'}/`;
  romajiHint.style.display = 'none';
  document.getElementById('quiz-feedback-box').style.display = 'none';

  let sameLevelPool = REPO_CARDS.filter(c => c.id !== currentCard.id && c.level === currentCard.level);
  if (qType === 'VI_TO_KANJI') {
    sameLevelPool = sameLevelPool.filter(c => Boolean(c.kanji));
  }

  let fallbackPool = REPO_CARDS.filter(c => c.id !== currentCard.id && c.level !== currentCard.level);
  if (qType === 'VI_TO_KANJI') {
    fallbackPool = fallbackPool.filter(c => Boolean(c.kanji));
  }

  const shuffleArr = arr => {
    const copy = [...arr];
    for (let i = copy.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
  };

  const candidates = [...shuffleArr(sameLevelPool), ...shuffleArr(fallbackPool)];
  const distractors = [];
  const usedLabels = new Set([getOptionText(currentCard, qType)]);

  for (const cand of candidates) {
    const label = getOptionText(cand, qType);
    if (label && !usedLabels.has(label)) {
      usedLabels.add(label);
      distractors.push(cand);
    }
    if (distractors.length === 3) break;
  }

  const options = shuffleArr([currentCard, ...distractors]);
  const letters = ['A', 'B', 'C', 'D'];
  const isJpOption = qType === 'KANJI_TO_READING' || qType === 'VI_TO_KANJI';

  document.getElementById('quiz-options-list').innerHTML = options.map((opt, idx) => `
    <button
      type="button"
      class="quiz-opt-btn ${isJpOption ? 'jp-opt' : ''}"
      data-card-id="${opt.id}"
      onclick="handleQuizAnswer(this, '${opt.id}')"
    >
      <span class="opt-letter">${letters[idx]}</span>
      <span>${escapeHtml(getOptionText(opt, qType))}</span>
    </button>
  `).join('');
}

function getOptionText(card, qType) {
  if (qType === 'KANJI_TO_READING') return card.jp;
  if (qType === 'VI_TO_KANJI') return card.kanji || card.jp;
  return card.vi;
}

function handleQuizAnswer(btnEl, selectedId) {
  if (state.quiz.answered) return;
  state.quiz.answered = true;

  const currentCard = state.quiz.questions[state.quiz.currentIndex].card;
  const isCorrect = selectedId === currentCard.id;

  speakJapanese(currentCard.jp || currentCard.kanji);
  document.getElementById('quiz-romaji-hint').style.display = 'block';

  document.querySelectorAll('.quiz-opt-btn').forEach(btn => {
    btn.disabled = true;
    const id = btn.getAttribute('data-card-id');
    if (id === currentCard.id) {
      btn.classList.add('correct');
    } else if (id === selectedId && !isCorrect) {
      btn.classList.add('wrong');
    }
  });

  if (isCorrect) {
    state.quiz.score += 1;
    if (!state.progress[currentCard.id]) state.progress[currentCard.id] = 'known';
  } else {
    state.quiz.wrongCards.push(currentCard);
    state.progress[currentCard.id] = 'review';
  }

  saveProgressStorage();
  updateStatsHeader();

  document.getElementById('quiz-score-badge').textContent = `Điểm: ${state.quiz.score}`;
  const mnemonicEl = document.getElementById('quiz-feedback-mnemonic');
  mnemonicEl.innerHTML = `<strong>${isCorrect ? '✓ Chính xác!' : '✕ Chưa đúng!'}</strong> (${escapeHtml(currentCard.vi)}) — ${escapeHtml(currentCard.mnemonic)}`;
  document.getElementById('quiz-feedback-box').style.display = 'flex';
}

function nextQuizQuestion() {
  stopSpeech();
  state.quiz.currentIndex += 1;
  renderQuizQuestion();
}

function showQuizSummary() {
  document.getElementById('quiz-active-box').style.display = 'none';
  document.getElementById('quiz-summary-box').style.display = 'flex';

  const total = state.quiz.questions.length;
  const score = state.quiz.score;
  const pct = total > 0 ? Math.round((score / total) * 100) : 0;

  document.getElementById('quiz-final-score-text').textContent =
    `Bạn trả lời đúng ${score} / ${total} câu (${pct}%)`;

  const retryBtn = document.getElementById('retry-wrong-btn');
  if (state.quiz.wrongCards.length > 0) {
    retryBtn.style.display = 'block';
    retryBtn.textContent = `Ôn lại ${state.quiz.wrongCards.length} câu làm sai`;
  } else {
    retryBtn.style.display = 'none';
  }
}

/**
 * =========================================================================
 * 8. CHẾ ĐỘ 3: DỊCH CÂU GHÉP TỪ (DUOLINGO SENTENCE BUILDER)
 * =========================================================================
 */
const DEFAULT_VI_DISTRACTORS = [
  'người Nhật', 'người Canada', 'không phải', 'rất', 'hôm qua',
  'trường học', 'của tôi', 'bạn bè', 'mỗi ngày', 'ở đâu', 'cái này'
];

function extractPrimaryMeaning(viRaw) {
  const cleaned = String(viRaw || '')
    .replace(/\([^)]*\)/g, '')
    .split(/[,;/]/)[0]
    .trim();
  return cleaned || String(viRaw || '').trim();
}

function lowerFirstChar(str) {
  if (!str) return '';
  return str.charAt(0).toLowerCase() + str.slice(1);
}

function synthesizeSentenceFromVocabCard(card, idx) {
  const jpWord = card.jp;
  const romajiWord = card.romaji;
  const viShort = lowerFirstChar(extractPrimaryMeaning(card.vi));
  const viWords = viShort.split(/\s+/).filter(Boolean);

  const isVerb = jpWord.endsWith('ます') || jpWord.endsWith('します');
  const naAdjExceptions = ['きれい', 'きらい', 'ゆうめい', 'ていねい'];
  const isNaAdj = card.mnemonic.toLowerCase().includes('đuôi na') ||
    ['げんき', 'きれい', 'すき', 'じょうず', 'べんり', 'しずか', 'ゆうめい', 'ひま', 'しんせつ', 'たいせつ', 'だいじょうぶ', 'かんたん'].includes(jpWord);
  const isIAdj = !isVerb && !isNaAdj && !naAdjExceptions.includes(jpWord) && jpWord.endsWith('い') && jpWord.length >= 2;

  if (isVerb) {
    return {
      type: 'sentence',
      id: `auto_sent_${card.id}`,
      level: card.level,
      topic: card.topic,
      jp: `わたしはまいにち${jpWord}。`,
      romaji: `Watashi wa mainichi ${romajiWord}.`,
      tokens: [
        { jp: 'わたし', romaji: 'watashi', vi: 'tôi' },
        { jp: 'は', romaji: 'wa', vi: 'thì (trợ từ chủ đề)' },
        { jp: 'まいにち', romaji: 'mainichi', vi: 'mỗi ngày' },
        { jp: jpWord, romaji: romajiWord, vi: viShort }
      ],
      vi: `Tôi ${viShort} mỗi ngày.`,
      vi_blocks: ['Tôi', ...viWords, 'mỗi', 'ngày'],
      distractors: ['không', 'hôm qua', 'người Nhật']
    };
  }

  if (isIAdj || isNaAdj) {
    const subjects = [
      { jp: 'ベトナム', romaji: 'Betonamu', vi: 'Việt Nam', blocks: ['Việt', 'Nam'] },
      { jp: 'このまち', romaji: 'kono machi', vi: 'thành phố này', blocks: ['thành phố', 'này'] },
      { jp: 'にほん', romaji: 'Nihon', vi: 'Nhật Bản', blocks: ['Nhật', 'Bản'] }
    ];
    const subj = subjects[idx % subjects.length];
    const subjText = subj.blocks.join(' ');
    return {
      type: 'sentence',
      id: `auto_sent_${card.id}`,
      level: card.level,
      topic: card.topic,
      jp: `${subj.jp}は${jpWord}ですか。`,
      romaji: `${subj.romaji} wa ${romajiWord} desu ka.`,
      tokens: [
        { jp: subj.jp, romaji: subj.romaji, vi: subj.vi },
        { jp: 'は', romaji: 'wa', vi: 'thì (trợ từ chủ đề)' },
        { jp: jpWord, romaji: romajiWord, vi: viShort },
        { jp: 'です', romaji: 'desu', vi: 'là / thì' },
        { jp: 'か', romaji: 'ka', vi: 'không? (nghi vấn)' }
      ],
      vi: `${subjText} có ${viShort} không?`,
      vi_blocks: [...subj.blocks, 'có', ...viWords, 'không'],
      distractors: ['người Canada', 'người Nhật', 'không phải']
    };
  }

  // Mặc định cho Danh từ / Đại từ
  return {
    type: 'sentence',
    id: `auto_sent_${card.id}`,
    level: card.level,
    topic: card.topic,
    jp: `これは${jpWord}ですか。`,
    romaji: `Kore wa ${romajiWord} desu ka.`,
    tokens: [
      { jp: 'これ', romaji: 'kore', vi: 'đây / cái này' },
      { jp: 'は', romaji: 'wa', vi: 'thì (trợ từ)' },
      { jp: jpWord, romaji: romajiWord, vi: viShort },
      { jp: 'です', romaji: 'desu', vi: 'là' },
      { jp: 'か', romaji: 'ka', vi: 'không? (nghi vấn)' }
    ],
    vi: `Đây có phải là ${viShort} không?`,
    vi_blocks: ['Đây', 'có', 'phải', 'là', ...viWords, 'không'],
    distractors: ['người Nhật', 'của bạn', 'nhỏ']
  };
}

function buildTranslateLessonPool() {
  let explicitSentences = getSentencesByLevel(state.selectedLevel);
  if (state.selectedTopic !== 'ALL') {
    explicitSentences = explicitSentences.filter(s => s.topic === state.selectedTopic);
  }

  const filteredVocab = getFilteredCards();
  const synthesized = filteredVocab.map((card, i) => synthesizeSentenceFromVocabCard(card, i));

  let combined = [...explicitSentences, ...synthesized];
  if (combined.length === 0) {
    combined = [
      ...REPO_SENTENCES,
      ...REPO_CARDS.map((card, i) => synthesizeSentenceFromVocabCard(card, i))
    ];
  }

  for (let i = combined.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [combined[i], combined[j]] = [combined[j], combined[i]];
  }

  return combined.slice(0, 8);
}

function startTranslateLesson() {
  const queue = buildTranslateLessonPool();
  state.translate = {
    queue,
    currentIndex: 0,
    completedCount: 0,
    energy: state.translate.energy || 0,
    bankChips: [],
    selectedBankIds: [],
    checked: false,
    isCorrect: false,
    activeTokenIdx: -1
  };

  document.getElementById('duo-summary-box').style.display = 'none';
  document.getElementById('duo-active-box').style.display = 'flex';
  loadTranslateQuestion();
}

function loadTranslateQuestion() {
  const tState = state.translate;
  if (tState.currentIndex >= tState.queue.length) {
    showTranslateSummary();
    return;
  }

  const sentence = tState.queue[tState.currentIndex];
  const correctBlocks = [...sentence.vi_blocks];

  // Tạo danh sách từ gây nhiễu không trùng đáp án
  const usedLower = new Set(correctBlocks.map(w => w.toLowerCase()));
  const distractorPool = [
    ...(sentence.distractors || []),
    ...REPO_CARDS.map(c => lowerFirstChar(extractPrimaryMeaning(c.vi))),
    ...DEFAULT_VI_DISTRACTORS
  ];

  const chosenDistractors = [];
  for (const d of distractorPool) {
    const clean = String(d || '').trim();
    if (clean && !usedLower.has(clean.toLowerCase())) {
      usedLower.add(clean.toLowerCase());
      chosenDistractors.push(clean);
    }
    if (chosenDistractors.length >= 3) break;
  }

  const allChips = [...correctBlocks, ...chosenDistractors];
  for (let i = allChips.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [allChips[i], allChips[j]] = [allChips[j], allChips[i]];
  }

  tState.bankChips = allChips.map((text, idx) => ({
    bankIdx: idx,
    text,
    used: false
  }));
  tState.selectedBankIds = [];
  tState.checked = false;
  tState.isCorrect = false;
  tState.activeTokenIdx = -1;

  renderTranslateView();
  // Tự động đọc câu tiếng Nhật khi vào câu mới
  speakJapanese(sentence.jp);
}

function renderTranslateView() {
  const tState = state.translate;
  const total = tState.queue.length;
  const sentence = tState.queue[tState.currentIndex];
  if (!sentence) return;

  const pct = total > 0 ? Math.round((tState.completedCount / total) * 100) : 0;
  document.getElementById('duo-step-label').textContent = `${tState.currentIndex + 1}/${total}`;
  document.getElementById('duo-progress-fill').style.width = `${pct}%`;
  document.getElementById('duo-energy-count').textContent = tState.energy;
  document.getElementById('duo-source-badge').textContent = `${sentence.level} • ${sentence.topic}`;

  // 1. Render các từ tiếng Nhật có gạch chân nét đứt
  const tokensWrap = document.getElementById('duo-tokens-wrap');
  tokensWrap.innerHTML = sentence.tokens.map((tok, idx) => `
    <button
      type="button"
      class="duo-token-btn ${tState.activeTokenIdx === idx ? 'active-token' : ''}"
      onclick="handleTokenTap(event, ${idx})"
    >${escapeHtml(tok.jp)}</button>
  `).join('') + `<span class="duo-punct">。</span>`;

  // 2. Render các thẻ từ đã xếp lên 2 dòng kẻ
  const answerSlots = document.getElementById('duo-answer-slots');
  answerSlots.innerHTML = tState.selectedBankIds.map((bankIdx, slotPos) => {
    const chip = tState.bankChips[bankIdx];
    return `
      <button
        type="button"
        class="duo-chip placed"
        ${tState.checked ? 'disabled' : ''}
        onclick="event.stopPropagation(); removeAnswerChip(${slotPos})"
      >${escapeHtml(chip.text)}</button>
    `;
  }).join('');

  // 3. Render ngân hàng thẻ từ bên dưới (giữ chỗ xám khi đã chọn)
  const bankWrap = document.getElementById('duo-word-bank');
  bankWrap.innerHTML = tState.bankChips.map(chip => `
    <button
      type="button"
      class="duo-chip ${chip.used ? 'used-placeholder' : ''}"
      ${chip.used || tState.checked ? 'disabled' : ''}
      onclick="selectBankChip(${chip.bankIdx})"
    >${escapeHtml(chip.text)}</button>
  `).join('');

  // 4. Cập nhật nút KIỂM TRA / Bảng phản hồi
  const checkBtn = document.getElementById('duo-check-btn');
  const fbSheet = document.getElementById('duo-feedback-sheet');

  if (!tState.checked) {
    checkBtn.style.display = 'block';
    checkBtn.disabled = tState.selectedBankIds.length === 0;
    fbSheet.style.display = 'none';
  } else {
    checkBtn.style.display = 'none';
    fbSheet.style.display = 'flex';
    fbSheet.className = `duo-feedback-sheet ${tState.isCorrect ? 'correct' : 'wrong'}`;
    document.getElementById('duo-fb-icon').textContent = tState.isCorrect ? '✓' : '✕';
    document.getElementById('duo-fb-title').textContent = tState.isCorrect ? 'Tuyệt vời! Chính xác!' : 'Chưa chính xác';
    document.getElementById('duo-fb-subtitle').innerHTML = tState.isCorrect
      ? `<strong>${escapeHtml(sentence.vi)}</strong> (${escapeHtml(sentence.romaji)})`
      : `Đáp án đúng: <strong>${escapeHtml(sentence.vi)}</strong>`;
  }
}

function handleTokenTap(event, tokenIdx) {
  event.stopPropagation();
  const sentence = state.translate.queue[state.translate.currentIndex];
  if (!sentence || !sentence.tokens[tokenIdx]) return;

  const tok = sentence.tokens[tokenIdx];
  state.translate.activeTokenIdx = tokenIdx;

  const tipBox = document.getElementById('duo-token-tooltip');
  document.getElementById('duo-tip-jp').textContent = tok.jp;
  document.getElementById('duo-tip-romaji').textContent = tok.romaji ? `/${tok.romaji}/` : '';
  document.getElementById('duo-tip-vi').textContent = tok.vi || '---';
  tipBox.style.display = 'flex';

  speakJapanese(tok.jp);
  renderTranslateView();
}

function hideTokenTooltip() {
  state.translate.activeTokenIdx = -1;
  const tipBox = document.getElementById('duo-token-tooltip');
  if (tipBox) tipBox.style.display = 'none';
  document.querySelectorAll('.duo-token-btn').forEach(btn => btn.classList.remove('active-token'));
}

function speakTranslateSentence() {
  const sentence = state.translate.queue[state.translate.currentIndex];
  if (sentence) speakJapanese(sentence.jp);
}

function selectBankChip(bankIdx) {
  if (state.translate.checked) return;
  const chip = state.translate.bankChips[bankIdx];
  if (!chip || chip.used) return;

  hideTokenTooltip();
  chip.used = true;
  state.translate.selectedBankIds.push(bankIdx);
  renderTranslateView();
}

function removeAnswerChip(slotPos) {
  if (state.translate.checked) return;
  const bankIdx = state.translate.selectedBankIds[slotPos];
  if (bankIdx === undefined) return;

  hideTokenTooltip();
  state.translate.selectedBankIds.splice(slotPos, 1);
  if (state.translate.bankChips[bankIdx]) {
    state.translate.bankChips[bankIdx].used = false;
  }
  renderTranslateView();
}

function normalizeVietnameseSentence(str) {
  return String(str || '')
    .toLowerCase()
    .replace(/[.,!?？。]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function checkTranslateAnswer() {
  const tState = state.translate;
  if (tState.checked || tState.selectedBankIds.length === 0) return;

  hideTokenTooltip();
  const sentence = tState.queue[tState.currentIndex];
  const userSentence = tState.selectedBankIds
    .map(id => tState.bankChips[id].text)
    .join(' ');

  const normUser = normalizeVietnameseSentence(userSentence);
  const normExpectedBlocks = normalizeVietnameseSentence(sentence.vi_blocks.join(' '));
  const normExpectedVi = normalizeVietnameseSentence(sentence.vi);

  const isCorrect = normUser === normExpectedBlocks || normUser === normExpectedVi;

  tState.checked = true;
  tState.isCorrect = isCorrect;

  if (isCorrect) {
    tState.completedCount += 1;
    tState.energy += 5;
    playFeedbackTone(true);
    speakJapanese(sentence.jp);
  } else {
    playFeedbackTone(false);
    // Đưa câu sai xuống cuối hàng đợi để người học luyện lại giống Duolingo
    tState.queue.push(sentence);
  }

  renderTranslateView();
}

function nextTranslateQuestion() {
  stopSpeech();
  state.translate.currentIndex += 1;
  loadTranslateQuestion();
}

function showTranslateSummary() {
  document.getElementById('duo-active-box').style.display = 'none';
  document.getElementById('duo-summary-box').style.display = 'flex';
  document.getElementById('duo-final-score-text').textContent =
    `Bạn đạt tổng cộng ⚡ ${state.translate.energy} điểm năng lượng!`;
}

/**
 * =========================================================================
 * 9. NHẬP JSON + DÒNG CHECK TRÙNG LẶP + BÀI MẪU NHANH + XUẤT DATA.JS
 * =========================================================================
 */
function loadQuickDemoSession() {
  const demoItems = [
    {
      level: 'N5',
      topic: 'Tính từ & Quốc gia',
      jp: 'ちいさい',
      kanji: '小さい',
      romaji: 'chiisai',
      vi: 'Nhỏ, bé',
      mnemonic: 'Chữ Tiểu (小 - vật bị chia nhỏ) -> Nhỏ bé'
    },
    {
      level: 'N5',
      topic: 'Tính từ & Quốc gia',
      jp: 'おおきい',
      kanji: '大きい',
      romaji: 'ookii',
      vi: 'To, lớn',
      mnemonic: 'Chữ Đại (大 - người dang rộng tay chân) -> To lớn'
    },
    {
      type: 'sentence',
      level: 'N5',
      topic: 'Tính từ & Quốc gia',
      jp: 'ベトナムはちいさいですか。',
      romaji: 'Betonamu wa chiisai desu ka.',
      tokens: [
        { jp: 'ベトナム', romaji: 'Betonamu', vi: 'Việt Nam' },
        { jp: 'は', romaji: 'wa', vi: 'thì (trợ từ chủ đề)' },
        { jp: 'ちいさい', romaji: 'chiisai', vi: 'nhỏ' },
        { jp: 'です', romaji: 'desu', vi: 'là / thì' },
        { jp: 'か', romaji: 'ka', vi: 'không? (nghi vấn)' }
      ],
      vi: 'Việt Nam có nhỏ không?',
      vi_blocks: ['Việt', 'Nam', 'có', 'nhỏ', 'không'],
      distractors: ['người Nhật', 'người Canada']
    }
  ];

  demoItems.forEach((raw, idx) => {
    if (isSentenceItem(raw)) {
      REPO_SENTENCES.push({ ...normalizeSentenceObject(raw, idx), source: 'json' });
    } else {
      REPO_CARDS.push({ ...normalizeCardObject(raw, idx), source: 'json' });
    }
  });

  saveExtraCardsToStorage();
  state.mode = 'translate';
  document.getElementById('mode-flashcard-btn').classList.remove('active');
  document.getElementById('mode-quiz-btn').classList.remove('active');
  document.getElementById('mode-translate-btn').classList.add('active');
  refreshUI();
  showToast('Đã nạp bài mẫu! Chạm vào từng từ hoặc xếp câu dịch nhé.');
}

function openImportModal() {
  document.getElementById('import-error-msg').style.display = 'none';
  runLiveDuplicateCheck(false);
  document.getElementById('import-modal').style.display = 'flex';
}

function closeImportModal() {
  document.getElementById('import-modal').style.display = 'none';
}

function fillSampleJson() {
  const sample = [
    {
      level: 'N5',
      topic: 'Tính từ & Quốc gia',
      jp: 'ちいさい',
      kanji: '小さい',
      romaji: 'chiisai',
      vi: 'Nhỏ, bé',
      mnemonic: 'Chữ Tiểu (小 - vật bị chia nhỏ)'
    },
    {
      type: 'sentence',
      level: 'N5',
      topic: 'Tính từ & Quốc gia',
      jp: 'ベトナムはちいさいですか。',
      romaji: 'Betonamu wa chiisai desu ka.',
      tokens: [
        { jp: 'ベトナム', romaji: 'Betonamu', vi: 'Việt Nam' },
        { jp: 'は', romaji: 'wa', vi: 'thì (trợ từ)' },
        { jp: 'ちいさい', romaji: 'chiisai', vi: 'nhỏ' },
        { jp: 'です', romaji: 'desu', vi: 'là / thì' },
        { jp: 'か', romaji: 'ka', vi: 'không? (nghi vấn)' }
      ],
      vi: 'Việt Nam có nhỏ không?',
      vi_blocks: ['Việt', 'Nam', 'có', 'nhỏ', 'không'],
      distractors: ['người Nhật', 'người Canada']
    },
    {
      level: 'N4',
      topic: 'Giao tiếp & Ý kiến',
      jp: 'けいけん',
      kanji: '経験',
      romaji: 'keiken',
      vi: 'Kinh nghiệm',
      mnemonic: 'Kinh qua trải nghiệm thực tế'
    },
    {
      level: 'N3',
      topic: 'Tư duy & Đánh giá',
      jp: 'はんだん',
      kanji: '判断',
      romaji: 'handan',
      vi: 'Phán đoán, quyết định',
      mnemonic: 'Phán xét và đưa ra quyết định'
    }
  ];
  document.getElementById('import-json-text').value = JSON.stringify(sample, null, 2);
  runLiveDuplicateCheck(false);
}

function analyzeIncomingJson(rawText) {
  const parsed = JSON.parse(rawText);
  if (!Array.isArray(parsed) || parsed.length === 0) {
    throw new Error('Dữ liệu JSON phải là một mảng [...] có ít nhất 1 mục.');
  }

  const defaultLevel = normalizeLevel(document.getElementById('import-default-level').value);
  const defaultTopic = document.getElementById('import-default-topic').value.trim() || 'Từ vựng chung';

  const existingMap = new Map([
    ...REPO_CARDS.map(c => [getDuplicateSignature(c), c]),
    ...REPO_SENTENCES.map(s => [getDuplicateSignature(s), s])
  ]);
  const batchSeen = new Set();

  const newItems = [];
  const dupWithRepo = [];
  const dupInBatch = [];

  parsed.forEach((raw, idx) => {
    const enriched = {
      ...raw,
      level: raw.level || defaultLevel,
      topic: raw.topic || defaultTopic
    };
    const item = isSentenceItem(enriched)
      ? normalizeSentenceObject(enriched, idx)
      : normalizeCardObject(enriched, idx);

    const sig = getDuplicateSignature(item);
    if (batchSeen.has(sig)) {
      dupInBatch.push(item);
    } else {
      batchSeen.add(sig);
      if (existingMap.has(sig)) {
        dupWithRepo.push({ incoming: item, existing: existingMap.get(sig) });
      } else {
        newItems.push(item);
      }
    }
  });

  return { newItems, dupWithRepo, dupInBatch };
}

function runLiveDuplicateCheck(explicitClick = false) {
  const jsonText = document.getElementById('import-json-text').value.trim();
  const boxEl = document.getElementById('import-dup-check-box');
  const summaryEl = document.getElementById('import-dup-summary');
  const listEl = document.getElementById('import-dup-list');
  const policyRowEl = document.getElementById('import-dup-policy-row');
  const errorEl = document.getElementById('import-error-msg');

  errorEl.style.display = 'none';

  if (!jsonText) {
    boxEl.className = 'dup-check-box neutral';
    summaryEl.textContent = '🔍 Dán JSON để tự động kiểm tra trùng lặp với kho hiện tại.';
    listEl.style.display = 'none';
    policyRowEl.style.display = 'none';
    if (explicitClick) showToast('Vui lòng dán JSON trước khi kiểm tra');
    return null;
  }

  try {
    const result = analyzeIncomingJson(jsonText);
    const totalDup = result.dupWithRepo.length + result.dupInBatch.length;

    if (totalDup === 0) {
      boxEl.className = 'dup-check-box clean';
      summaryEl.textContent = `✓ Check trùng: Hợp lệ ${result.newItems.length} mục mới, không có mục nào bị trùng!`;
      listEl.style.display = 'none';
      policyRowEl.style.display = 'none';
      if (explicitClick) showToast('Không có mục nào bị trùng lặp!');
    } else {
      boxEl.className = 'dup-check-box warning';
      summaryEl.textContent = `⚠️ Phát hiện ${totalDup} mục trùng (${result.newItems.length} mục mới hợp lệ):`;

      const details = [];
      result.dupWithRepo.forEach(d => {
        const label = d.incoming.kanji ? `${d.incoming.kanji} (${d.incoming.jp})` : d.incoming.jp;
        details.push(`• Trùng với kho: ${label} — "${d.existing.vi}" (${d.existing.level})`);
      });
      result.dupInBatch.forEach(d => {
        const label = d.kanji ? `${d.kanji} (${d.jp})` : d.jp;
        details.push(`• Trùng ngay trong danh sách vừa dán: ${label}`);
      });

      listEl.innerHTML = details.map(line => `<div>${escapeHtml(line)}</div>`).join('');
      listEl.style.display = 'flex';
      policyRowEl.style.display = result.dupWithRepo.length > 0 ? 'flex' : 'none';
      if (explicitClick) showToast(`Phát hiện ${totalDup} mục trùng lặp!`);
    }

    return result;
  } catch (err) {
    boxEl.className = 'dup-check-box neutral';
    summaryEl.textContent = '⏳ Đang chờ JSON hoàn chỉnh để kiểm tra trùng...';
    listEl.style.display = 'none';
    policyRowEl.style.display = 'none';
    if (explicitClick) {
      errorEl.textContent = 'Lỗi cú pháp JSON: ' + err.message;
      errorEl.style.display = 'block';
    }
    return null;
  }
}

function importJsonToRepo() {
  const jsonText = document.getElementById('import-json-text').value.trim();
  const errorEl = document.getElementById('import-error-msg');

  if (!jsonText) {
    errorEl.textContent = 'Vui lòng dán dữ liệu JSON vào khung.';
    errorEl.style.display = 'block';
    return;
  }

  let analysis;
  try {
    analysis = analyzeIncomingJson(jsonText);
  } catch (err) {
    errorEl.textContent = 'Lỗi định dạng JSON: ' + err.message;
    errorEl.style.display = 'block';
    return;
  }

  const policy = document.getElementById('dup-handling-mode').value;
  let addedCount = 0;
  let updatedCount = 0;

  analysis.newItems.forEach(item => {
    if (isSentenceItem(item)) {
      REPO_SENTENCES.push({ ...item, source: 'json' });
    } else {
      REPO_CARDS.push({ ...item, source: 'json' });
    }
    addedCount++;
  });

  if (policy === 'overwrite' && analysis.dupWithRepo.length > 0) {
    analysis.dupWithRepo.forEach(({ incoming, existing }) => {
      if (isSentenceItem(existing)) {
        const idx = REPO_SENTENCES.findIndex(s => s.id === existing.id);
        if (idx !== -1) {
          REPO_SENTENCES[idx] = { ...incoming, id: existing.id, source: existing.source };
          updatedCount++;
        }
      } else {
        const idx = REPO_CARDS.findIndex(c => c.id === existing.id);
        if (idx !== -1) {
          REPO_CARDS[idx] = { ...incoming, id: existing.id, source: existing.source };
          updatedCount++;
        }
      }
    });
  }

  saveExtraCardsToStorage();
  document.getElementById('import-json-text').value = '';
  closeImportModal();
  refreshUI();

  if (updatedCount > 0) {
    showToast(`Đã thêm ${addedCount} mục mới & cập nhật ${updatedCount} mục!`);
  } else {
    showToast(`Đã thêm ${addedCount} mục mới (bỏ qua ${analysis.dupWithRepo.length + analysis.dupInBatch.length} mục trùng)!`);
  }
}

function exportDataJsFile() {
  const cleanExport = [
    ...REPO_CARDS.map(({ id, source, type, ...rest }) => rest),
    ...REPO_SENTENCES.map(({ id, source, ...rest }) => rest)
  ];
  const fileContent = `/**
 * TỆP DỮ LIỆU TỪ VỰNG & CÂU DỊCH TRUNG TÂM (N5 -> N3)
 * Xuất tự động từ ứng dụng Flashcards (${cleanExport.length} mục)
 */

var VOCAB_DATA = ${JSON.stringify(cleanExport, null, 2)};
`;

  const blob = new Blob([fileContent], { type: 'application/javascript;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'data.js';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  showToast('Đã tải xuống tệp data.js mới nhất!');
}

/**
 * =========================================================================
 * 10. TIỆN ÍCH & CỬ CHỈ VUỐT MÀN HÌNH
 * =========================================================================
 */
function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

let toastTimer = null;
function showToast(msg) {
  const toast = document.getElementById('toast-banner');
  toast.textContent = msg;
  toast.classList.add('show');
  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('show'), 2400);
}

function initSwipeGestures() {
  const stage = document.getElementById('card-stage-wrapper');
  if (!stage) return;
  let startX = 0;
  let startY = 0;

  stage.addEventListener('touchstart', e => {
    startX = e.changedTouches[0].screenX;
    startY = e.changedTouches[0].screenY;
  }, { passive: true });

  stage.addEventListener('touchend', e => {
    const dx = e.changedTouches[0].screenX - startX;
    const dy = e.changedTouches[0].screenY - startY;
    if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.3) {
      if (dx < 0) nextCard();
      else prevCard();
    }
  }, { passive: true });
}

window.addEventListener('DOMContentLoaded', () => {
  document.addEventListener('touchstart', unlockMobileAudio, { once: true, passive: true });
  document.addEventListener('click', unlockMobileAudio, { once: true });
  loadRepository();
  initSwipeGestures();
  refreshUI();
});