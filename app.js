/**
 * =========================================================================
 * ENGINE 2 KHO DỮ LIỆU ĐỘC LẬP (VOCAB_DATA + EXERCISE_DATA) & LIÊN KẾT 2 CHIỀU
 * =========================================================================
 */
const DB_NAME = 'JLPT_Linked_DualRepo_DB';
const DB_VERSION = 1;
const STORE_REPO = 'dual_repo_store';

const EXTRA_CARDS_STORAGE_KEY = 'jlpt_n5_n3_extra_cards_v1';
const EXTRA_EXERCISES_STORAGE_KEY = 'jlpt_n5_n3_extra_sentences_v1';
const PROGRESS_STORAGE_KEY = 'jlpt_n5_n3_progress_v1';
const STREAK_STORAGE_KEY = 'jlpt_n5_n3_streak_v1';

const ALLOWED_LEVELS = ['N5', 'N4', 'N3'];
const SESSION_BATCH_SIZE = 12;

let REPO_CARDS = [];
let REPO_EXERCISES = [];

let state = {
  selectedLevel: 'ALL',     // 'ALL' | 'N5' | 'N4' | 'N3'
  selectedTopic: 'ALL',     // 'ALL' | tên chủ đề
  mode: 'flashcard',        // 'flashcard' | 'quiz' | 'dictation' | 'exercise' | 'match' | 'drill'
  filterUnmastered: false,
  hideFurigana: false,
  sessionMode: true,
  sessionBatchIds: [],
  sessionComplete: false,
  voiceMode: 'normal',      // 'normal' | 'slow'
  currentCardIndex: 0,
  isFlipped: false,
  customOrderIds: null,
  progress: {},
  streak: { count: 0, lastDate: '' },
  quiz: {
    questions: [],
    currentIndex: 0,
    score: 0,
    answered: false,
    wrongCards: []
  },
  dictation: {
    questions: [],
    currentIndex: 0,
    score: 0,
    answered: false,
    hintUsed: false
  },
  exercise: {
    queue: [],
    currentIndex: 0,
    completedCount: 0,
    energy: 0,
    kindFilter: 'ALL',      // 'ALL' | 'cloze' | 'sentence' | 'trap'
    answered: false,
    isCorrect: false,
    bankChips: [],
    selectedBankIds: [],
    activeTokenIdx: -1
  },
  match: {
    round: 1,
    score: 0,
    variant: 'JP_VI',       // 'JP_VI' | 'KANJI_READING'
    leftTiles: [],
    rightTiles: [],
    selectedLeftIdx: -1,
    selectedRightIdx: -1,
    matchedCount: 0
  },
  drill: {
    questions: [],
    currentIndex: 0,
    score: 0,
    answered: false,
    submode: 'MIXED'        // 'MIXED' | 'KANJI_CLOZE' | 'CONJUGATION'
  }
};

/**
 * =========================================================================
 * 1. KHÓA CỨNG ZOOM TRÊN IPHONE SAFARI (PINCH / DOUBLE-TAP / INPUT FOCUS)
 * =========================================================================
 */
function initIosZoomLock() {
  document.addEventListener('gesturestart', function (e) {
    e.preventDefault();
  }, { passive: false });

  document.addEventListener('gesturechange', function (e) {
    e.preventDefault();
  }, { passive: false });

  document.addEventListener('gestureend', function (e) {
    e.preventDefault();
  }, { passive: false });

  document.addEventListener('touchmove', function (e) {
    if (e.touches && e.touches.length > 1) {
      e.preventDefault();
    }
  }, { passive: false });
}

/**
 * =========================================================================
 * 2. INDEXEDDB LƯU TRỮ DỮ LIỆU LỚN CHO CẢ 2 KHO
 * =========================================================================
 */
function openMassiveDb() {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('No IndexedDB'));
      return;
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(STORE_REPO)) {
        db.createObjectStore(STORE_REPO);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function idbGet(key) {
  try {
    const db = await openMassiveDb();
    return await new Promise((resolve) => {
      const tx = db.transaction(STORE_REPO, 'readonly');
      const store = tx.objectStore(STORE_REPO);
      const req = store.get(key);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
    });
  } catch (e) {
    return null;
  }
}

async function idbSet(key, val) {
  try {
    const db = await openMassiveDb();
    await new Promise((resolve) => {
      const tx = db.transaction(STORE_REPO, 'readwrite');
      const store = tx.objectStore(STORE_REPO);
      store.put(val, key);
      tx.oncomplete = () => resolve(true);
      tx.onerror = () => resolve(false);
    });
    return true;
  } catch (e) {
    return false;
  }
}

/**
 * =========================================================================
 * 3. CHUẨN HÓA DỮ LIỆU VOCAB_DATA & EXERCISE_DATA (CHỐNG HỌC SAI)
 * =========================================================================
 */
function normalizeLevel(rawLevel) {
  const upper = String(rawLevel || 'N5').trim().toUpperCase();
  return ALLOWED_LEVELS.includes(upper) ? upper : 'N5';
}

function isExerciseItem(raw) {
  if (!raw || typeof raw !== 'object') return false;
  return (
    raw.type === 'exercise' ||
    raw.type === 'sentence' ||
    raw.kind === 'cloze' ||
    raw.kind === 'sentence' ||
    raw.kind === 'trap' ||
    Array.isArray(raw.tokens) ||
    Array.isArray(raw.vi_blocks) ||
    (Array.isArray(raw.options) && Boolean(raw.answer))
  );
}

function getDuplicateSignature(item) {
  if (isExerciseItem(item)) {
    const kind = item.kind || (item.type === 'sentence' ? 'sentence' : 'cloze');
    const baseText = String(item.prompt_jp || item.jp || '')
      .replace(/[。．.！!？?]/g, '')
      .trim();
    const ans = String(item.answer || item.vi || '').trim();
    return `EX||${kind}||${baseText}||${ans}`;
  }
  const jp = String(item.jp || '').trim();
  const kanji = String(item.kanji || '').trim();
  return `VOC||${jp}||${kanji}`;
}

function generateStableItemId(item, fallbackIdx = 0) {
  const sig = getDuplicateSignature(item);
  if (sig && !sig.endsWith('||||')) {
    return 'item_' + encodeURIComponent(sig);
  }
  return `item_idx_${fallbackIdx}_${Date.now()}`;
}

function splitMnemonicAndBridge(rawMnemonic) {
  const text = String(rawMnemonic || 'Ghi nhớ qua lật thẻ và luyện tập.').trim();
  const bridgeRegex = /\[N4\/N3\s*:?\s*([^\]]+)\]/i;
  const match = text.match(bridgeRegex);
  if (match) {
    const core = text.replace(bridgeRegex, '').trim();
    const bridge = match[1].trim();
    return {
      coreMnemonic: core || 'Từ vựng cốt lõi.',
      bridgeNote: bridge
    };
  }
  return {
    coreMnemonic: text,
    bridgeNote: ''
  };
}

/**
 * Nhận diện từ loại & nhóm chia thể (ưu tiên nhãn `tag` nếu có, dự phòng phân tích tự động)
 */
function inferPartOfSpeech(jp, topic, mnemonic, explicitTag) {
  const cleanJp = String(jp || '').trim();
  const tagLower = String(explicitTag || '').trim().toLowerCase();
  const tLower = String(topic || '').toLowerCase();
  const mLower = String(mnemonic || '').toLowerCase();

  if (tagLower === 'v1') return { code: 'VERB', vGroup: 1, label: 'Động từ (N1)' };
  if (tagLower === 'v2') return { code: 'VERB', vGroup: 2, label: 'Động từ (N2)' };
  if (tagLower === 'v3') return { code: 'VERB', vGroup: 3, label: 'Động từ (N3)' };
  if (tagLower === 'adj_i') return { code: 'ADJ_I', vGroup: 0, label: 'Tính từ -i' };
  if (tagLower === 'adj_na') return { code: 'ADJ_NA', vGroup: 0, label: 'Tính từ -na' };

  if (cleanJp.endsWith('ます') || cleanJp.endsWith('します')) {
    return { code: 'VERB', vGroup: 0, label: 'Động từ' };
  }

  const naAdjList = [
    'すき', 'きらい', 'じょうず', 'へた', 'きれい', 'ハンサム', 'しんせつ',
    'げんき', 'べんり', 'ふべん', 'ひま', 'にぎやか', 'しずか', 'ゆうめい',
    'たいせつ', 'だいじょうぶ', 'ざんねん', 'かんたん', 'ていねい', 'いろいろ',
    'すてき', 'じょうぶ'
  ];
  if (tLower.includes('đuôi na') || mLower.includes('đuôi na') || naAdjList.includes(cleanJp)) {
    return { code: 'ADJ_NA', vGroup: 0, label: 'Tính từ -na' };
  }

  const naExceptionsEndingInI = ['きれい', 'きらい', 'ゆうめい', 'ていねい'];
  if (!naExceptionsEndingInI.includes(cleanJp) && cleanJp.endsWith('い') && cleanJp.length >= 2 &&
      (tLower.includes('tính từ') || ['おおきい', 'ちいさい', 'あたらしい', 'ふるい', 'いい', 'わるい', 'あつい', 'さむい', 'つめたい', 'むずかしい', 'やさしい', 'たかい', 'やすい', 'ひくい', 'おもしろい', 'おいしい', 'いそがしい', 'たのしい', 'しろい', 'くろい', 'あかい', 'あおい', 'ちかい', 'とおい', 'はやい', 'おそい', 'おおい', 'すくない', 'あたたかい', 'すずしい', 'あまい', 'からい'].includes(cleanJp))) {
    return { code: 'ADJ_I', vGroup: 0, label: 'Tính từ -i' };
  }

  if (tLower.includes('đại từ') || tLower.includes('từ để hỏi')) {
    return { code: 'PRONOUN', vGroup: 0, label: 'Chỉ định / Hỏi' };
  }

  return { code: 'NOUN', vGroup: 0, label: 'Danh từ' };
}

function normalizeCardObject(raw, idx = 0) {
  const jp = String(raw.jp || raw.kanji || '').trim();
  const kanji = String(raw.kanji || '').trim();
  const topic = String(raw.topic || 'Từ vựng chung').trim() || 'Từ vựng chung';
  const mnemonic = String(raw.mnemonic || 'Ghi nhớ qua lật thẻ và luyện tập.').trim();
  const tag = String(raw.tag || '').trim();
  const pos = inferPartOfSpeech(jp, topic, mnemonic, tag);

  const normalized = {
    type: 'vocab',
    level: normalizeLevel(raw.level),
    topic,
    jp: jp || '???',
    kanji: kanji === jp ? '' : kanji,
    romaji: String(raw.romaji || '').trim(),
    vi: String(raw.vi || 'Chưa có nghĩa').trim(),
    mnemonic,
    ...(tag ? { tag } : {}),
    posCode: pos.code,
    vGroup: pos.vGroup,
    posLabel: pos.label
  };
  normalized.id = raw.id || generateStableItemId(normalized, idx);
  return normalized;
}

function normalizeExerciseObject(raw, idx = 0) {
  let kind = String(raw.kind || '').trim().toLowerCase();
  if (!['cloze', 'sentence', 'trap'].includes(kind)) {
    if (raw.type === 'sentence' || Array.isArray(raw.tokens) || Array.isArray(raw.vi_blocks)) {
      kind = 'sentence';
    } else if (Array.isArray(raw.options) && raw.answer) {
      kind = 'cloze';
    } else {
      kind = 'sentence';
    }
  }

  const refs = Array.isArray(raw.refs)
    ? raw.refs.map(r => String(r).trim()).filter(Boolean)
    : [];

  if (kind === 'sentence') {
    const jp = String(raw.jp || '').trim();
    const vi = String(raw.vi || '').trim();
    const tokens = Array.isArray(raw.tokens) && raw.tokens.length > 0
      ? raw.tokens.map(t => ({
          jp: String(t.jp || '').trim(),
          romaji: String(t.romaji || '').trim(),
          vi: String(t.vi || '').trim(),
          ref: String(t.ref || '').trim()
        })).filter(t => t.jp)
      : [{ jp: jp.replace(/[。．.！!？?]+$/g, ''), romaji: String(raw.romaji || '').trim(), vi, ref: '' }];

    const viBlocks = Array.isArray(raw.vi_blocks) && raw.vi_blocks.length > 0
      ? raw.vi_blocks.map(w => String(w).trim()).filter(Boolean)
      : vi.replace(/[.,!?？。]+$/g, '').split(/\s+/).filter(Boolean);

    const distractors = Array.isArray(raw.distractors)
      ? raw.distractors.map(w => String(w).trim()).filter(Boolean)
      : [];

    const normalized = {
      type: 'exercise',
      kind: 'sentence',
      level: normalizeLevel(raw.level),
      topic: String(raw.topic || 'Bài tập dịch câu').trim() || 'Bài tập dịch câu',
      refs,
      jp: jp || tokens.map(t => t.jp).join(''),
      romaji: String(raw.romaji || tokens.map(t => t.romaji).filter(Boolean).join(' ')).trim(),
      tokens,
      vi: vi || viBlocks.join(' '),
      vi_blocks: viBlocks,
      distractors
    };
    normalized.id = raw.id || generateStableItemId(normalized, idx);
    return normalized;
  }

  // kind === 'cloze' hoặc 'trap'
  const promptJp = String(raw.prompt_jp || raw.jp || '').trim();
  const promptVi = String(raw.prompt_vi || raw.vi || '').trim();
  const answer = String(raw.answer || '').trim();
  const options = Array.isArray(raw.options)
    ? raw.options.map(o => String(o).trim()).filter(Boolean)
    : [];
  if (answer && !options.includes(answer)) {
    options.unshift(answer);
  }

  const fullSentenceJp = String(
    raw.full_jp || promptJp.replace(/[（(]\s*[　\s]*[）)]/g, answer.replace(/\([^)]*\)/g, '').trim())
  ).trim();

  const normalized = {
    type: 'exercise',
    kind,
    level: normalizeLevel(raw.level),
    topic: String(raw.topic || 'Bài tập ngữ cảnh').trim() || 'Bài tập ngữ cảnh',
    refs,
    prompt_jp: promptJp,
    prompt_vi: promptVi,
    full_jp: fullSentenceJp,
    options,
    answer,
    explanation: String(raw.explanation || 'Chọn đáp án phù hợp nhất với ngữ cảnh câu.').trim()
  };
  normalized.id = raw.id || generateStableItemId(normalized, idx);
  return normalized;
}

/**
 * =========================================================================
 * 4. NẠP & LƯU DỮ LIỆU TỪ 2 TỆP VOCAB_DATA.JS & EXERCISE_DATA.JS
 * =========================================================================
 */
function getTodayKey() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

function getYesterdayKey() {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function loadStreak() {
  try {
    const raw = localStorage.getItem(STREAK_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      const today = getTodayKey();
      const yesterday = getYesterdayKey();
      if (parsed.lastDate === today || parsed.lastDate === yesterday) {
        state.streak = { count: parsed.count || 0, lastDate: parsed.lastDate };
      } else {
        state.streak = { count: 0, lastDate: '' };
      }
    }
  } catch (e) {}
  renderStreakPill();
}

function recordStudyActivity() {
  const today = getTodayKey();
  if (state.streak.lastDate === today) return;

  const yesterday = getYesterdayKey();
  if (state.streak.lastDate === yesterday) {
    state.streak.count += 1;
  } else {
    state.streak.count = 1;
  }
  state.streak.lastDate = today;

  try {
    localStorage.setItem(STREAK_STORAGE_KEY, JSON.stringify(state.streak));
  } catch (e) {}
  renderStreakPill();
}

function renderStreakPill() {
  const el = document.getElementById('streak-pill');
  if (el) el.textContent = `🔥 ${state.streak.count}`;
}

async function loadRepository() {
  const vocabSource = (typeof VOCAB_DATA !== 'undefined' && Array.isArray(VOCAB_DATA))
    ? VOCAB_DATA
    : (typeof window !== 'undefined' && Array.isArray(window.VOCAB_DATA) ? window.VOCAB_DATA : []);

  const exerciseSource = (typeof EXERCISE_DATA !== 'undefined' && Array.isArray(EXERCISE_DATA))
    ? EXERCISE_DATA
    : (typeof window !== 'undefined' && Array.isArray(window.EXERCISE_DATA) ? window.EXERCISE_DATA : []);

  const fileVocab = [];
  const fileExercises = [];

  vocabSource.forEach((item, idx) => {
    if (isExerciseItem(item)) {
      fileExercises.push({ ...normalizeExerciseObject(item, idx), source: 'vocab_data.js' });
    } else {
      fileVocab.push({ ...normalizeCardObject(item, idx), source: 'vocab_data.js' });
    }
  });

  exerciseSource.forEach((item, idx) => {
    if (isExerciseItem(item)) {
      fileExercises.push({ ...normalizeExerciseObject(item, idx), source: 'exercise_data.js' });
    } else {
      fileVocab.push({ ...normalizeCardObject(item, idx), source: 'exercise_data.js' });
    }
  });

  let idbCards = await idbGet('extra_cards');
  let idbExercises = await idbGet('extra_exercises');
  let idbProgress = await idbGet('user_progress');

  if (!Array.isArray(idbCards)) {
    try {
      const lsCards = JSON.parse(localStorage.getItem(EXTRA_CARDS_STORAGE_KEY) || '[]');
      idbCards = Array.isArray(lsCards) ? lsCards : [];
      if (idbCards.length > 0) await idbSet('extra_cards', idbCards);
    } catch (e) {
      idbCards = [];
    }
  }

  if (!Array.isArray(idbExercises)) {
    try {
      const lsEx = JSON.parse(localStorage.getItem(EXTRA_EXERCISES_STORAGE_KEY) || '[]');
      idbExercises = Array.isArray(lsEx) ? lsEx : [];
      if (idbExercises.length > 0) await idbSet('extra_exercises', idbExercises);
    } catch (e) {
      idbExercises = [];
    }
  }

  if (!idbProgress || typeof idbProgress !== 'object') {
    try {
      const lsProg = JSON.parse(localStorage.getItem(PROGRESS_STORAGE_KEY) || '{}');
      idbProgress = (lsProg && typeof lsProg === 'object') ? lsProg : {};
      if (Object.keys(idbProgress).length > 0) await idbSet('user_progress', idbProgress);
    } catch (e) {
      idbProgress = {};
    }
  }

  const extraVocab = [];
  const extraExercises = [];

  idbCards.forEach((item, idx) => {
    if (isExerciseItem(item)) {
      extraExercises.push({ ...normalizeExerciseObject(item, idx), source: 'json' });
    } else {
      extraVocab.push({ ...normalizeCardObject(item, idx), source: 'json' });
    }
  });

  idbExercises.forEach((item, idx) => {
    extraExercises.push({ ...normalizeExerciseObject(item, idx), source: 'json' });
  });

  state.progress = idbProgress || {};
  REPO_CARDS = [...fileVocab, ...extraVocab];
  REPO_EXERCISES = [...fileExercises, ...extraExercises];
}

async function saveExtraReposToStorage() {
  const extraVocabOnly = REPO_CARDS
    .filter(c => c.source === 'json')
    .map(({ source, type, posCode, vGroup, posLabel, ...rest }) => rest);

  const extraExOnly = REPO_EXERCISES
    .filter(ex => ex.source === 'json')
    .map(({ source, ...rest }) => rest);

  const savedToIdb = await idbSet('extra_cards', extraVocabOnly);
  await idbSet('extra_exercises', extraExOnly);

  try {
    localStorage.setItem(EXTRA_CARDS_STORAGE_KEY, JSON.stringify(extraVocabOnly));
    localStorage.setItem(EXTRA_EXERCISES_STORAGE_KEY, JSON.stringify(extraExOnly));
  } catch (e) {
    if (!savedToIdb) {
      showToast('Bộ nhớ trình duyệt đã đầy, hãy bấm "Xuất" để lưu tệp!');
    }
  }
}

async function saveProgressStorage() {
  await idbSet('user_progress', state.progress);
  try {
    localStorage.setItem(PROGRESS_STORAGE_KEY, JSON.stringify(state.progress));
  } catch (e) {}
}

/**
 * =========================================================================
 * 5. LIÊN KẾT CHÉO 2 CHIỀU GIỮA VOCAB_DATA VÀ EXERCISE_DATA
 * =========================================================================
 */
function findVocabCardsByKeys(keys) {
  if (!Array.isArray(keys) || keys.length === 0) return [];
  const normalizedKeys = keys.map(k => String(k || '').trim()).filter(Boolean);
  if (normalizedKeys.length === 0) return [];

  const matched = [];
  const seenIds = new Set();

  normalizedKeys.forEach(key => {
    REPO_CARDS.forEach(card => {
      if (!seenIds.has(card.id) && (card.jp === key || card.kanji === key)) {
        seenIds.add(card.id);
        matched.push(card);
      }
    });
  });

  return matched;
}

function resolveLinkedVocabForExercise(ex) {
  const keys = [...(ex.refs || [])];
  if (Array.isArray(ex.tokens)) {
    ex.tokens.forEach(t => {
      if (t.ref) keys.push(t.ref);
      if (t.jp) keys.push(t.jp);
    });
  }
  const direct = findVocabCardsByKeys(keys);
  if (direct.length > 0) return direct;

  // Dự phòng tìm từ vựng xuất hiện trong câu bài tập
  const hayStack = `${ex.prompt_jp || ''} ${ex.jp || ''}`;
  return REPO_CARDS.filter(c =>
    (c.kanji && c.kanji.length >= 2 && hayStack.includes(c.kanji)) ||
    (c.jp && c.jp.length >= 3 && hayStack.includes(c.jp))
  ).slice(0, 4);
}

async function syncWrongExerciseToVocabReview(ex) {
  const linkedCards = resolveLinkedVocabForExercise(ex);
  if (linkedCards.length === 0) return [];

  let markedLabels = [];
  linkedCards.forEach(card => {
    if (state.progress[card.id] !== 'review') {
      state.progress[card.id] = 'review';
    }
    markedLabels.push(card.kanji || card.jp);
  });

  await saveProgressStorage();
  updateStatsHeader();
  return markedLabels;
}

function openVocabPeekModal(cardId) {
  const card = REPO_CARDS.find(c => c.id === cardId);
  if (!card) return;

  const lvlEl = document.getElementById('peek-level-tag');
  lvlEl.textContent = card.level;
  lvlEl.className = `level-tag ${card.level.toLowerCase()}`;

  document.getElementById('peek-pos-tag').textContent = card.posLabel || 'Từ vựng';
  document.getElementById('peek-jp-title').textContent =
    card.kanji ? `${card.kanji} (${card.jp})` : card.jp;
  document.getElementById('peek-romaji').textContent = card.romaji ? `/${card.romaji}/` : '';
  document.getElementById('peek-vi').textContent = card.vi;

  const { coreMnemonic, bridgeNote } = splitMnemonicAndBridge(card.mnemonic);
  document.getElementById('peek-mnemonic').textContent = coreMnemonic;

  const bridgeBox = document.getElementById('peek-bridge-box');
  if (bridgeNote) {
    document.getElementById('peek-bridge-text').textContent = bridgeNote;
    bridgeBox.style.display = 'block';
  } else {
    bridgeBox.style.display = 'none';
  }

  document.getElementById('peek-speak-btn').onclick = () => speakJapanese(card.jp || card.kanji);
  document.getElementById('vocab-peek-modal').style.display = 'flex';
  speakJapanese(card.jp || card.kanji);
}

function closeVocabPeekModal() {
  document.getElementById('vocab-peek-modal').style.display = 'none';
}

/**
 * =========================================================================
 * 6. KIỂM TRA TRÙNG LẶP ĐỘC LẬP CHO TỪ VỰNG & BÀI TẬP
 * =========================================================================
 */
function findRepositoryDuplicates() {
  const seenMap = new Map();
  const duplicateGroups = [];
  const allItems = [...REPO_CARDS, ...REPO_EXERCISES];

  allItems.forEach((item, index) => {
    const sig = getDuplicateSignature(item);
    if (!seenMap.has(sig)) {
      seenMap.set(sig, [{ item, index }]);
    } else {
      seenMap.get(sig).push({ item, index });
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
    statusTextEl.textContent = '✓ Kiểm tra trùng: Cả 2 kho đều sạch, không có mục trùng';
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

  if (groups.length === 0) {
    bodyEl.innerHTML = `
      <div class="dup-check-box clean">
        ✓ Toàn bộ ${REPO_CARDS.length} từ vựng và ${REPO_EXERCISES.length} bài tập đều là duy nhất, không có bản trùng lặp.
      </div>
    `;
    dedupeBtn.style.display = 'none';
  } else {
    const hasFileDuplicates = groups.some(g => g.entries.filter(e => e.item.source !== 'json').length > 1);
    bodyEl.innerHTML = `
      <div class="dup-check-box warning">
        ⚠️ Tìm thấy ${groups.length} mục xuất hiện nhiều hơn 1 lần:
      </div>
      ${groups.slice(0, 60).map(g => {
        const first = g.entries[0].item;
        const isEx = isExerciseItem(first);
        const label = isEx
          ? `[Bài tập ${first.kind}] ${first.prompt_jp || first.jp}`
          : `[Từ vựng] ${first.kanji ? `${first.kanji} (${first.jp})` : first.jp}`;
        const locations = g.entries.map(e => `${e.item.level} • ${e.item.topic} [${e.item.source}]`).join(' | ');
        return `
          <div class="dup-item-card">
            <strong>${escapeHtml(label)}</strong><br/>
            <span class="text-muted">Vị trí: ${escapeHtml(locations)}</span>
          </div>
        `;
      }).join('')}
      ${hasFileDuplicates ? '<p class="text-muted" style="font-size:11px;">Lưu ý: Các bản trùng nằm cứng trong tệp <strong>vocab_data.js</strong> hoặc <strong>exercise_data.js</strong> cần được xuất lại tệp mới để ghi đè.</p>' : ''}
    `;
    dedupeBtn.style.display = 'block';
  }

  document.getElementById('dup-modal').style.display = 'flex';
}

function closeDuplicateCheckerModal() {
  document.getElementById('dup-modal').style.display = 'none';
}

async function deduplicateRepository() {
  const seen = new Set();
  const uniqueCards = [];
  const uniqueExercises = [];
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

  REPO_EXERCISES.forEach(ex => {
    const sig = getDuplicateSignature(ex);
    if (!seen.has(sig)) {
      seen.add(sig);
      uniqueExercises.push(ex);
    } else if (ex.source === 'json') {
      removedCount++;
    } else {
      uniqueExercises.push(ex);
    }
  });

  REPO_CARDS = uniqueCards;
  REPO_EXERCISES = uniqueExercises;
  await saveExtraReposToStorage();
  closeDuplicateCheckerModal();
  refreshUI();
  showToast(removedCount > 0 ? `Đã dọn ${removedCount} bản trùng thừa!` : 'Đã kiểm tra xong');
}

/**
 * =========================================================================
 * 7. BỘ PHÁT ÂM TIẾNG NHẬT TỰ NHIÊN 2 TẦNG & ÂM THANH PHẢN HỒI
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

function speakJapanese(text, forceSlow = null) {
  const cleanText = sanitizeJapaneseForSpeech(text);
  if (!cleanText) return;

  stopSpeech();
  setAudioButtonsPlaying(true);

  const isSlow = forceSlow !== null ? forceSlow : (state.voiceMode === 'slow');
  const targetRate = isSlow ? 0.72 : 0.96;

  if (neuralAudioCache.has(cleanText)) {
    const cachedSrc = neuralAudioCache.get(cleanText);
    playHtml5AudioSrc(cachedSrc, targetRate, () => {
      neuralAudioCache.delete(cleanText);
      speakWithDeviceVoice(cleanText, isSlow);
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
      speakWithDeviceVoice(cleanText, isSlow);
    }
  }, 1800);

  const tryUrl = (idx) => {
    if (settled) return;
    if (idx >= urls.length) {
      settled = true;
      clearTimeout(fallbackTimerId);
      speakWithDeviceVoice(cleanText, isSlow);
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
      if (neuralAudioCache.size > 200) {
        const firstKey = neuralAudioCache.keys().next().value;
        neuralAudioCache.delete(firstKey);
      }
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
          speakWithDeviceVoice(cleanText, isSlow);
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

function speakWithDeviceVoice(cleanText, isSlow = false) {
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

    utterance.rate = isSlow ? 0.68 : 0.92;
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
  btn.textContent = state.voiceMode === 'normal' ? 'Chuẩn' : 'Chậm';
  showToast(state.voiceMode === 'normal' ? 'Tốc độ đọc chuẩn' : 'Tốc độ đọc chậm rõ âm');

  if (state.mode === 'exercise') speakCurrentExercise();
  else if (state.mode === 'dictation') speakDictationCard(false);
  else speakCurrentCard();
}

/**
 * =========================================================================
 * 8. BỘ LỌC PHÂN CẤP (N5 -> N3), ẨN FURIGANA & CHIA PHIÊN 12 THẺ
 * =========================================================================
 */
function getCardsByLevel(level) {
  if (level === 'ALL') return REPO_CARDS;
  return REPO_CARDS.filter(c => c.level === level);
}

function getExercisesByLevel(level) {
  if (level === 'ALL') return REPO_EXERCISES;
  return REPO_EXERCISES.filter(ex => ex.level === level);
}

function getBaseFilteredCards() {
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

function buildSmartFlashcardBatch() {
  const base = getBaseFilteredCards();
  if (base.length === 0) {
    state.sessionBatchIds = [];
    return;
  }

  const reviewCards = base.filter(c => state.progress[c.id] === 'review');
  const newCards = base.filter(c => !state.progress[c.id]);
  const knownCards = base.filter(c => state.progress[c.id] === 'known');

  const prioritized = [...reviewCards, ...newCards, ...knownCards];
  state.sessionBatchIds = prioritized.slice(0, SESSION_BATCH_SIZE).map(c => c.id);
  state.sessionComplete = false;
  state.currentCardIndex = 0;
  state.isFlipped = false;
}

function getVisibleFlashcards() {
  const base = getBaseFilteredCards();
  if (!state.sessionMode || base.length <= SESSION_BATCH_SIZE) {
    return base;
  }

  const baseMap = new Map(base.map(c => [c.id, c]));
  const batchCards = state.sessionBatchIds
    .map(id => baseMap.get(id))
    .filter(Boolean);

  if (batchCards.length === 0) {
    buildSmartFlashcardBatch();
    return state.sessionBatchIds.map(id => baseMap.get(id)).filter(Boolean);
  }

  return batchCards;
}

function toggleSessionScope() {
  state.sessionMode = !state.sessionMode;
  state.sessionComplete = false;
  state.currentCardIndex = 0;
  state.isFlipped = false;
  if (state.sessionMode) {
    buildSmartFlashcardBatch();
  }
  renderFlashcard();
}

function startNextFlashcardBatch() {
  const seenSet = new Set(state.sessionBatchIds);
  const currentIds = REPO_CARDS.map(c => c.id);
  const remaining = currentIds.filter(id => !seenSet.has(id));
  const rotated = currentIds.filter(id => seenSet.has(id));
  state.customOrderIds = [...remaining, ...rotated];

  buildSmartFlashcardBatch();
  renderFlashcard();
}

function toggleFuriganaVisibility() {
  state.hideFurigana = !state.hideFurigana;
  const btn = document.getElementById('toggle-furigana-btn');
  btn.classList.toggle('furi-hidden', state.hideFurigana);
  btn.textContent = state.hideFurigana ? '🙈 Ẩn Furi' : '👁️ Furigana';
  showToast(state.hideFurigana ? 'Đã ẩn Furigana: Luyện nhìn mặt chữ Kanji!' : 'Đã hiện Furigana trên Kanji');
  if (state.mode === 'flashcard') renderFlashcard();
  else if (state.mode === 'match') renderMatchBoard();
}

function selectLevel(level) {
  state.selectedLevel = level;
  state.selectedTopic = 'ALL';
  state.currentCardIndex = 0;
  state.isFlipped = false;
  state.sessionComplete = false;

  document.querySelectorAll('.level-pill').forEach(btn => {
    btn.classList.toggle('active', btn.getAttribute('data-level') === level);
  });

  if (state.sessionMode) buildSmartFlashcardBatch();
  refreshUI();
}

function selectTopic(topic) {
  state.selectedTopic = topic;
  state.currentCardIndex = 0;
  state.isFlipped = false;
  state.sessionComplete = false;

  if (state.sessionMode) buildSmartFlashcardBatch();
  launchActiveMode();
}

function toggleUnmasteredFilter() {
  state.filterUnmastered = !state.filterUnmastered;
  state.currentCardIndex = 0;
  state.isFlipped = false;
  state.sessionComplete = false;

  const btn = document.getElementById('filter-unmastered-btn');
  btn.classList.toggle('filter-active', state.filterUnmastered);

  if (state.sessionMode) buildSmartFlashcardBatch();
  launchActiveMode();
}

function resetFilters() {
  state.selectedLevel = 'ALL';
  state.selectedTopic = 'ALL';
  state.filterUnmastered = false;
  state.currentCardIndex = 0;
  state.isFlipped = false;
  state.sessionComplete = false;

  document.querySelectorAll('.level-pill').forEach(btn => {
    btn.classList.toggle('active', btn.getAttribute('data-level') === 'ALL');
  });
  document.getElementById('filter-unmastered-btn').classList.remove('filter-active');
  if (state.sessionMode) buildSmartFlashcardBatch();
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
  state.sessionComplete = false;

  if (state.sessionMode) buildSmartFlashcardBatch();
  showToast('Đã xáo trộn thứ tự bài học');
  launchActiveMode();
}

function launchActiveMode() {
  if (state.mode === 'flashcard') renderFlashcard();
  else if (state.mode === 'quiz') startQuiz(false);
  else if (state.mode === 'dictation') startDictationLesson();
  else if (state.mode === 'exercise') startExerciseLesson();
  else if (state.mode === 'match') startMatchRound();
  else if (state.mode === 'drill') startDrillLesson();
}

/**
 * =========================================================================
 * 9. CẬP NHẬT GIAO DIỆN CHÍNH & CHẾ ĐỘ 1: LẬT THẺ 3D
 * =========================================================================
 */
function refreshUI() {
  const totalCount = REPO_CARDS.length + REPO_EXERCISES.length;
  const hasData = totalCount > 0;

  const countAll = totalCount;
  const countN5 = REPO_CARDS.filter(c => c.level === 'N5').length + REPO_EXERCISES.filter(s => s.level === 'N5').length;
  const countN4 = REPO_CARDS.filter(c => c.level === 'N4').length + REPO_EXERCISES.filter(s => s.level === 'N4').length;
  const countN3 = REPO_CARDS.filter(c => c.level === 'N3').length + REPO_EXERCISES.filter(s => s.level === 'N3').length;

  document.getElementById('count-ALL').textContent = countAll;
  document.getElementById('count-N5').textContent = countN5;
  document.getElementById('count-N4').textContent = countN4;
  document.getElementById('count-N3').textContent = countN3;

  document.getElementById('empty-app-state').style.display = hasData ? 'none' : 'flex';
  document.getElementById('deck-stats-card').style.display = hasData ? 'flex' : 'none';
  document.getElementById('toolbar-section').style.display = hasData ? 'block' : 'none';
  document.getElementById('export-menu-btn').style.display = hasData ? 'inline-block' : 'none';
  document.getElementById('search-repo-btn').style.display = hasData ? 'inline-block' : 'none';

  const views = ['flashcard-view', 'quiz-view', 'dictation-view', 'exercise-view', 'match-view', 'drill-view'];
  if (!hasData) {
    views.forEach(v => { document.getElementById(v).style.display = 'none'; });
    return;
  }

  populateTopicDropdown();
  updateStatsHeader();
  updateRepoDuplicateBanner();

  views.forEach(v => {
    document.getElementById(v).style.display = v === `${state.mode}-view` ? 'flex' : 'none';
  });

  if (state.mode === 'flashcard' && state.sessionMode && state.sessionBatchIds.length === 0) {
    buildSmartFlashcardBatch();
  }
  launchActiveMode();
}

function populateTopicDropdown() {
  const selectEl = document.getElementById('topic-select');
  const cardsInLevel = getCardsByLevel(state.selectedLevel);
  const exInLevel = getExercisesByLevel(state.selectedLevel);
  const topics = Array.from(new Set([
    ...cardsInLevel.map(c => c.topic),
    ...exInLevel.map(s => s.topic)
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
  const scopeEx = getExercisesByLevel(state.selectedLevel);
  const totalVocab = scopeCards.length;
  const known = scopeCards.filter(c => state.progress[c.id] === 'known').length;
  const pct = totalVocab > 0 ? Math.round((known / totalVocab) * 100) : 0;

  const titleLabel = state.selectedLevel === 'ALL'
    ? 'Kho tổng hợp (N5 → N3)'
    : `Cấp độ JLPT ${state.selectedLevel}`;

  document.getElementById('deck-title-display').textContent = titleLabel;
  document.getElementById('deck-known-count').textContent = `${known} đã thuộc`;
  document.getElementById('deck-total-count').textContent = `${totalVocab} từ • ${scopeEx.length} bài`;
  document.getElementById('deck-progress-bar').style.width = `${pct}%`;
}

function renderFlashcard() {
  const baseCards = getBaseFilteredCards();
  const visibleCards = getVisibleFlashcards();
  const emptyFilter = document.getElementById('empty-filter-state');
  const sessionDoneBox = document.getElementById('session-complete-box');
  const stage = document.getElementById('card-stage-wrapper');
  const controls = document.getElementById('flashcard-controls');
  const posText = document.getElementById('card-position-text');
  const scopeBtn = document.getElementById('session-scope-btn');

  updateStatsHeader();

  if (baseCards.length <= SESSION_BATCH_SIZE) {
    scopeBtn.textContent = `Tổng ${baseCards.length} thẻ`;
  } else {
    scopeBtn.textContent = state.sessionMode
      ? `Phiên ${SESSION_BATCH_SIZE}/${baseCards.length} thẻ ▾`
      : `Tất cả ${baseCards.length} thẻ ▾`;
  }

  if (visibleCards.length === 0) {
    emptyFilter.style.display = 'flex';
    sessionDoneBox.style.display = 'none';
    stage.style.display = 'none';
    controls.style.display = 'none';
    posText.textContent = '0 thẻ hiển thị';
    return;
  }

  emptyFilter.style.display = 'none';

  if (state.sessionComplete && state.sessionMode && baseCards.length > SESSION_BATCH_SIZE) {
    sessionDoneBox.style.display = 'flex';
    stage.style.display = 'none';
    controls.style.display = 'none';
    posText.textContent = `Hoàn thành ${visibleCards.length}/${visibleCards.length} thẻ`;
    return;
  }

  sessionDoneBox.style.display = 'none';
  stage.style.display = 'block';
  controls.style.display = 'flex';

  if (state.currentCardIndex >= visibleCards.length) state.currentCardIndex = 0;
  if (state.currentCardIndex < 0) state.currentCardIndex = visibleCards.length - 1;

  const card = visibleCards[state.currentCardIndex];
  const status = state.progress[card.id];
  const lvlClass = card.level.toLowerCase();

  document.getElementById('flashcard-inner').classList.toggle('is-flipped', state.isFlipped);
  posText.textContent = `Thẻ ${state.currentCardIndex + 1} / ${visibleCards.length}`;

  const frontLvl = document.getElementById('front-level-badge');
  frontLvl.textContent = card.level;
  frontLvl.className = `level-tag ${lvlClass}`;

  document.getElementById('front-pos-badge').textContent = card.posLabel || 'Từ vựng';

  const furiganaEl = document.getElementById('front-kanji-furigana');
  const mainJpEl = document.getElementById('front-jp-text');
  const hasSeparateKanji = Boolean(card.kanji && card.jp && card.kanji !== card.jp);
  const displayMain = card.kanji ? card.kanji : card.jp;

  if (hasSeparateKanji && !state.hideFurigana) {
    furiganaEl.textContent = card.jp;
    furiganaEl.style.display = 'block';
  } else {
    furiganaEl.style.display = 'none';
  }

  mainJpEl.textContent = displayMain;
  document.getElementById('front-sub-tag').textContent = card.topic;

  document.getElementById('front-bottom-hint').textContent = (hasSeparateKanji && state.hideFurigana)
    ? '🙈 Đang ẩn Furigana • Chạm để kiểm tra cách đọc'
    : '↻ Chạm để xem Romaji, Nghĩa & Chiết tự Kanji';

  const badge = document.getElementById('front-status-badge');
  if (status === 'known') {
    badge.textContent = '✓ Đã thuộc';
    badge.className = 'badge known';
  } else if (status === 'review') {
    badge.textContent = '↻ Cần ôn';
    badge.className = 'badge review';
  } else {
    badge.textContent = 'Mới';
    badge.className = 'badge';
  }

  const backLvl = document.getElementById('back-level-tag');
  backLvl.textContent = card.level;
  backLvl.className = `level-tag ${lvlClass}`;

  document.getElementById('back-jp-mini').textContent =
    hasSeparateKanji ? `${card.kanji} (${card.jp})` : card.jp;
  document.getElementById('back-romaji-pill').textContent = card.romaji || '---';
  document.getElementById('back-romaji-main').textContent = card.romaji ? `/${card.romaji}/` : '';
  document.getElementById('back-meaning-vi').textContent = card.vi;

  const { coreMnemonic, bridgeNote } = splitMnemonicAndBridge(card.mnemonic);
  document.getElementById('back-mnemonic-text').textContent = coreMnemonic;

  const bridgeBox = document.getElementById('back-bridge-box');
  if (bridgeNote) {
    document.getElementById('back-bridge-text').textContent = bridgeNote;
    bridgeBox.style.display = 'block';
  } else {
    bridgeBox.style.display = 'none';
  }
}

function flipCard() {
  state.isFlipped = !state.isFlipped;
  document.getElementById('flashcard-inner').classList.toggle('is-flipped', state.isFlipped);
}

function speakCurrentCard() {
  const visible = getVisibleFlashcards();
  if (!visible.length) return;
  const card = visible[state.currentCardIndex];
  speakJapanese(card.jp || card.kanji);
}

function nextCard() {
  const visible = getVisibleFlashcards();
  if (!visible.length) return;
  stopSpeech();
  state.isFlipped = false;

  const baseCards = getBaseFilteredCards();
  if (state.sessionMode && baseCards.length > SESSION_BATCH_SIZE && state.currentCardIndex === visible.length - 1) {
    state.sessionComplete = true;
    playFeedbackTone(true);
    recordStudyActivity();
    renderFlashcard();
    return;
  }

  state.currentCardIndex = (state.currentCardIndex + 1) % visible.length;
  renderFlashcard();
}

function prevCard() {
  const visible = getVisibleFlashcards();
  if (!visible.length) return;
  stopSpeech();
  state.isFlipped = false;
  state.currentCardIndex = (state.currentCardIndex - 1 + visible.length) % visible.length;
  renderFlashcard();
}

async function rateCurrentCard(rating) {
  const visible = getVisibleFlashcards();
  if (!visible.length) return;

  stopSpeech();
  recordStudyActivity();
  const card = visible[state.currentCardIndex];
  state.progress[card.id] = rating;
  await saveProgressStorage();

  showToast(rating === 'known' ? `Đã thuộc: ${card.kanji || card.jp}` : `Cần ôn lại: ${card.kanji || card.jp}`);
  state.isFlipped = false;

  const baseCards = getBaseFilteredCards();
  if (state.sessionMode && baseCards.length > SESSION_BATCH_SIZE && state.currentCardIndex === visible.length - 1) {
    state.sessionComplete = true;
    playFeedbackTone(true);
    renderFlashcard();
    return;
  }

  if (state.filterUnmastered && rating === 'known') {
    const updated = getVisibleFlashcards();
    if (state.currentCardIndex >= updated.length) state.currentCardIndex = 0;
  } else {
    state.currentCardIndex = (state.currentCardIndex + 1) % visible.length;
  }

  renderFlashcard();
}

function setMode(newMode) {
  stopSpeech();
  state.mode = newMode;
  const modes = ['flashcard', 'quiz', 'dictation', 'exercise', 'match', 'drill'];
  modes.forEach(m => {
    const btn = document.getElementById(`mode-${m}-btn`);
    if (btn) btn.classList.toggle('active', m === newMode);
  });
  refreshUI();
}

/**
 * =========================================================================
 * 10. CHẾ ĐỘ 2: TRẮC NGHIỆM TỪ VỰNG ĐA CHIỀU
 * =========================================================================
 */
function pickQuizFormatForCard(card) {
  const hasKanji = Boolean(card.kanji && card.kanji !== card.jp);
  const roll = Math.random();

  if (roll < 0.22) return 'AUDIO_TO_VI';
  if (!hasKanji) return 'JP_TO_VI';
  if (card.level === 'N5') return roll < 0.72 ? 'JP_TO_VI' : 'KANJI_TO_READING';
  if (card.level === 'N4') return roll < 0.55 ? 'JP_TO_VI' : 'KANJI_TO_READING';
  const modes = ['KANJI_TO_READING', 'VI_TO_KANJI', 'JP_TO_VI'];
  return modes[Math.floor(Math.random() * modes.length)];
}

function startQuiz(onlyWrong = false) {
  let pool = [];
  if (onlyWrong && state.quiz.wrongCards.length > 0) {
    pool = [...state.quiz.wrongCards];
  } else {
    const filtered = getBaseFilteredCards();
    pool = filtered.length > 0 ? [...filtered] : [...REPO_CARDS];
  }

  if (pool.length === 0) return;

  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }

  const limitedPool = pool.slice(0, 10);

  state.quiz = {
    questions: limitedPool.map(card => ({
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

function speakQuizCard() {
  const current = state.quiz.questions[state.quiz.currentIndex];
  if (current && current.card) {
    speakJapanese(current.card.jp || current.card.kanji);
  }
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
  const listenBtnEl = document.getElementById('quiz-big-listen-btn');
  const instructionEl = document.getElementById('quiz-instruction-text');
  const typeBadgeEl = document.getElementById('quiz-type-badge');
  promptEl.classList.remove('vi-prompt');
  promptEl.style.display = 'block';
  listenBtnEl.style.display = 'none';

  if (qType === 'AUDIO_TO_VI') {
    typeBadgeEl.textContent = '🎧 Nghe hiểu';
    instructionEl.textContent = 'Nghe âm thanh và chọn nghĩa tiếng Việt đúng:';
    promptEl.style.display = 'none';
    listenBtnEl.style.display = 'inline-block';
    speakJapanese(currentCard.jp || currentCard.kanji);
  } else if (qType === 'KANJI_TO_READING') {
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
  romajiHint.textContent = `${currentCard.kanji ? currentCard.kanji + ' • ' : ''}${currentCard.jp} /${currentCard.romaji || '---'}/`;
  romajiHint.style.display = 'none';
  document.getElementById('quiz-feedback-box').style.display = 'none';

  let sameGroupPool = REPO_CARDS.filter(c =>
    c.id !== currentCard.id &&
    c.level === currentCard.level &&
    (currentCard.tag ? c.tag === currentCard.tag : c.posCode === currentCard.posCode)
  );
  let sameLevelPool = REPO_CARDS.filter(c => c.id !== currentCard.id && c.level === currentCard.level);
  let fallbackPool = REPO_CARDS.filter(c => c.id !== currentCard.id && c.level !== currentCard.level);

  if (qType === 'VI_TO_KANJI') {
    sameGroupPool = sameGroupPool.filter(c => Boolean(c.kanji));
    sameLevelPool = sameLevelPool.filter(c => Boolean(c.kanji));
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

  const candidates = [
    ...shuffleArr(sameGroupPool),
    ...shuffleArr(sameLevelPool),
    ...shuffleArr(fallbackPool)
  ];
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

async function handleQuizAnswer(btnEl, selectedId) {
  if (state.quiz.answered) return;
  state.quiz.answered = true;
  recordStudyActivity();

  const currentCard = state.quiz.questions[state.quiz.currentIndex].card;
  const isCorrect = selectedId === currentCard.id;

  speakJapanese(currentCard.jp || currentCard.kanji);
  document.getElementById('quiz-romaji-hint').style.display = 'block';

  document.querySelectorAll('#quiz-options-list .quiz-opt-btn').forEach(btn => {
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

  await saveProgressStorage();
  updateStatsHeader();

  document.getElementById('quiz-score-badge').textContent = `Điểm: ${state.quiz.score}`;
  const { coreMnemonic } = splitMnemonicAndBridge(currentCard.mnemonic);
  const mnemonicEl = document.getElementById('quiz-feedback-mnemonic');
  mnemonicEl.innerHTML = `<strong>${isCorrect ? '✓ Chính xác!' : '✕ Chưa đúng!'}</strong> (${escapeHtml(currentCard.vi)}) — ${escapeHtml(coreMnemonic)}`;
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
 * 11. CHẾ ĐỘ 3: NGHE & GÕ PHẢN XẠ (AUDIO DICTATION)
 * =========================================================================
 */
function startDictationLesson() {
  let pool = getBaseFilteredCards();
  if (pool.length === 0) pool = [...REPO_CARDS];
  if (pool.length === 0) return;

  const shuffled = [...pool];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }

  state.dictation = {
    questions: shuffled.slice(0, 10),
    currentIndex: 0,
    score: 0,
    answered: false,
    hintUsed: false
  };

  document.getElementById('dict-summary-box').style.display = 'none';
  document.getElementById('dict-active-box').style.display = 'flex';
  renderDictationQuestion();
}

function renderDictationQuestion() {
  const d = state.dictation;
  if (d.currentIndex >= d.questions.length) {
    document.getElementById('dict-active-box').style.display = 'none';
    document.getElementById('dict-summary-box').style.display = 'flex';
    document.getElementById('dict-final-score-text').textContent =
      `Bạn nghe & gõ đúng ${d.score} / ${d.questions.length} từ!`;
    return;
  }

  const card = d.questions[d.currentIndex];
  d.answered = false;
  d.hintUsed = false;

  document.getElementById('dict-step-text').textContent = `Câu ${d.currentIndex + 1}/${d.questions.length}`;
  document.getElementById('dict-score-badge').textContent = `Điểm: ${d.score}`;

  const lvlTag = document.getElementById('dict-level-tag');
  lvlTag.textContent = card.level;
  lvlTag.className = `level-tag ${card.level.toLowerCase()} quiz-lvl`;

  const hintEl = document.getElementById('dict-hint-line');
  hintEl.style.display = 'none';
  hintEl.textContent = '';

  const inputEl = document.getElementById('dict-answer-input');
  inputEl.value = '';
  inputEl.disabled = false;

  document.getElementById('dict-submit-btn').disabled = false;
  document.getElementById('dict-feedback-card').style.display = 'none';

  speakJapanese(card.jp || card.kanji);
  setTimeout(() => inputEl.focus(), 120);
}

function speakDictationCard(forceSlow) {
  const card = state.dictation.questions[state.dictation.currentIndex];
  if (card) speakJapanese(card.jp || card.kanji, forceSlow);
}

function revealDictationHint() {
  const d = state.dictation;
  const card = d.questions[d.currentIndex];
  if (!card || d.answered) return;

  d.hintUsed = true;
  const cleanRomaji = String(card.romaji || '').replace(/\([^)]*\)/g, '').trim();
  const firstChars = cleanRomaji.slice(0, Math.min(2, cleanRomaji.length));
  const hintEl = document.getElementById('dict-hint-line');
  hintEl.textContent = `💡 Gợi ý: Bắt đầu bằng "${firstChars}..." • Nghĩa: ${extractPrimaryMeaning(card.vi)}`;
  hintEl.style.display = 'block';
}

function normalizeDictationAnswer(str) {
  return String(str || '')
    .toLowerCase()
    .replace(/\([^)]*\)/g, '')
    .replace(/[^a-z0-9\u3040-\u30ff\u4e00-\u9faf]/g, '')
    .trim();
}

function handleDictationEnter() {
  if (!state.dictation.answered) checkDictationAnswer();
  else nextDictationQuestion();
}

async function checkDictationAnswer() {
  const d = state.dictation;
  if (d.answered) return;

  const inputEl = document.getElementById('dict-answer-input');
  const rawInput = inputEl.value.trim();
  if (!rawInput) {
    showToast('Hãy gõ cách đọc bạn nghe được nhé!');
    return;
  }

  d.answered = true;
  inputEl.disabled = true;
  document.getElementById('dict-submit-btn').disabled = true;
  recordStudyActivity();

  const card = d.questions[d.currentIndex];
  const userNorm = normalizeDictationAnswer(rawInput);

  const validRomajiVariants = String(card.romaji || '')
    .split(/[/,]|hoặc/i)
    .map(v => normalizeDictationAnswer(v))
    .filter(Boolean);

  const validTargets = new Set([
    ...validRomajiVariants,
    normalizeDictationAnswer(card.jp),
    normalizeDictationAnswer(card.kanji)
  ]);

  const isCorrect = validTargets.has(userNorm);
  if (isCorrect) {
    d.score += 1;
    playFeedbackTone(true);
    if (!state.progress[card.id]) state.progress[card.id] = 'known';
  } else {
    playFeedbackTone(false);
    state.progress[card.id] = 'review';
  }

  await saveProgressStorage();
  updateStatsHeader();

  document.getElementById('dict-score-badge').textContent = `Điểm: ${d.score}`;
  const statusEl = document.getElementById('dict-fb-status');
  statusEl.textContent = isCorrect ? '✓ Nghe chuẩn xác!' : `✕ Bạn gõ "${rawInput}" — Chưa khớp`;
  statusEl.className = `dict-fb-status ${isCorrect ? 'ok' : 'bad'}`;

  document.getElementById('dict-fb-word').textContent =
    card.kanji ? `${card.kanji} (${card.jp})` : card.jp;
  document.getElementById('dict-fb-meaning').textContent = `/${card.romaji}/ — ${card.vi}`;
  const { coreMnemonic } = splitMnemonicAndBridge(card.mnemonic);
  document.getElementById('dict-fb-mnemonic').textContent = coreMnemonic;
  document.getElementById('dict-feedback-card').style.display = 'flex';
}

function nextDictationQuestion() {
  stopSpeech();
  state.dictation.currentIndex += 1;
  renderDictationQuestion();
}

/**
 * =========================================================================
 * 12. CHẾ ĐỘ 4: BÀI TẬP NGỮ CẢNH CHUẨN 100% (CLOZE • SENTENCE • TRAP)
 *     KHÔNG BAO GIỜ TỰ BỊA CÂU GIẢ • LIÊN KẾT CHÉO 2 CHIỀU VỚI VOCAB_DATA
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

function cycleExerciseKindFilter() {
  const order = ['ALL', 'cloze', 'sentence', 'trap'];
  const nextIdx = (order.indexOf(state.exercise.kindFilter) + 1) % order.length;
  state.exercise.kindFilter = order[nextIdx];

  const labels = {
    ALL: 'Tất cả dạng ⇄',
    cloze: 'Chỉ Điền khuyết ⇄',
    sentence: 'Chỉ Dịch câu ⇄',
    trap: 'Chỉ Bẫy dễ nhầm ⇄'
  };
  document.getElementById('ex-kind-filter-btn').textContent = labels[state.exercise.kindFilter];
  startExerciseLesson();
}

function resetExerciseScope() {
  state.selectedLevel = 'ALL';
  state.selectedTopic = 'ALL';
  state.exercise.kindFilter = 'ALL';
  document.getElementById('ex-kind-filter-btn').textContent = 'Tất cả dạng ⇄';
  document.querySelectorAll('.level-pill').forEach(btn => {
    btn.classList.toggle('active', btn.getAttribute('data-level') === 'ALL');
  });
  refreshUI();
}

function buildSmartExerciseQueue() {
  let pool = getExercisesByLevel(state.selectedLevel);

  if (state.selectedTopic !== 'ALL') {
    const topicMatched = pool.filter(ex => ex.topic === state.selectedTopic);
    // Nếu chủ đề từ vựng trùng khớp tên chủ đề bài tập thì lọc theo chủ đề; nếu không, tìm bài tập liên kết qua refs của từ vựng trong chủ đề đó!
    if (topicMatched.length > 0) {
      pool = topicMatched;
    } else {
      const vocabInTopic = getBaseFilteredCards();
      const topicWords = new Set();
      vocabInTopic.forEach(c => {
        if (c.jp) topicWords.add(c.jp);
        if (c.kanji) topicWords.add(c.kanji);
      });
      const refMatched = pool.filter(ex => {
        const linked = resolveLinkedVocabForExercise(ex);
        return linked.some(c => topicWords.has(c.jp) || (c.kanji && topicWords.has(c.kanji)));
      });
      pool = refMatched;
    }
  }

  if (state.exercise.kindFilter !== 'ALL') {
    pool = pool.filter(ex => ex.kind === state.exercise.kindFilter);
  }

  if (pool.length === 0) return [];

  // Ưu tiên 2 chiều: Bài tập chứa từ đang 'review' hoặc nằm trong phiên học 12 thẻ hiện tại sẽ được đưa lên đầu!
  const reviewIds = new Set(
    REPO_CARDS.filter(c => state.progress[c.id] === 'review').map(c => c.id)
  );
  const batchIds = new Set(state.sessionBatchIds || []);

  const scored = pool.map(ex => {
    const linked = resolveLinkedVocabForExercise(ex);
    let priorityScore = 0;
    linked.forEach(card => {
      if (reviewIds.has(card.id)) priorityScore += 10;
      else if (batchIds.has(card.id)) priorityScore += 5;
    });
    return {
      ex,
      priorityScore,
      isPriority: priorityScore >= 5,
      rand: Math.random()
    };
  });

  scored.sort((a, b) => {
    if (b.priorityScore !== a.priorityScore) return b.priorityScore - a.priorityScore;
    return a.rand - b.rand;
  });

  return scored.slice(0, 10).map(s => ({ ...s.ex, _isPriority: s.isPriority }));
}

function startExerciseLesson() {
  const queue = buildSmartExerciseQueue();

  state.exercise = {
    queue,
    currentIndex: 0,
    completedCount: 0,
    energy: state.exercise.energy || 0,
    kindFilter: state.exercise.kindFilter,
    answered: false,
    isCorrect: false,
    bankChips: [],
    selectedBankIds: [],
    activeTokenIdx: -1
  };

  if (queue.length === 0) {
    document.getElementById('ex-empty-box').style.display = 'flex';
    document.getElementById('ex-active-box').style.display = 'none';
    document.getElementById('ex-summary-box').style.display = 'none';
    return;
  }

  document.getElementById('ex-empty-box').style.display = 'none';
  document.getElementById('ex-summary-box').style.display = 'none';
  document.getElementById('ex-active-box').style.display = 'flex';
  loadExerciseQuestion();
}

function loadExerciseQuestion() {
  const exState = state.exercise;
  if (exState.currentIndex >= exState.queue.length) {
    document.getElementById('ex-active-box').style.display = 'none';
    document.getElementById('ex-summary-box').style.display = 'flex';
    document.getElementById('ex-final-score-text').textContent =
      `Bạn đạt tổng cộng ⚡ ${exState.energy} điểm luyện tập!`;
    return;
  }

  const currentEx = exState.queue[exState.currentIndex];
  exState.answered = false;
  exState.isCorrect = false;
  exState.activeTokenIdx = -1;

  if (currentEx.kind === 'sentence') {
    const correctBlocks = [...currentEx.vi_blocks];
    const usedLower = new Set(correctBlocks.map(w => w.toLowerCase()));
    const distractorPool = [
      ...(currentEx.distractors || []),
      ...REPO_CARDS.slice(0, 40).map(c => lowerFirstChar(extractPrimaryMeaning(c.vi))),
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

    exState.bankChips = allChips.map((text, idx) => ({
      bankIdx: idx,
      text,
      used: false
    }));
    exState.selectedBankIds = [];
  }

  renderExerciseView();
  if (currentEx.kind === 'sentence') {
    speakJapanese(currentEx.jp);
  }
}

function renderExerciseView() {
  const exState = state.exercise;
  const total = exState.queue.length;
  const currentEx = exState.queue[exState.currentIndex];
  if (!currentEx) return;

  const pct = total > 0 ? Math.round((exState.completedCount / total) * 100) : 0;
  document.getElementById('ex-step-label').textContent = `${exState.currentIndex + 1}/${total}`;
  document.getElementById('ex-progress-fill').style.width = `${pct}%`;
  document.getElementById('ex-energy-count').textContent = exState.energy;

  const kindNames = {
    cloze: '📝 Điền khuyết ngữ cảnh',
    sentence: '🧩 Dịch câu ghép từ',
    trap: '⚠️ Bẫy từ dễ nhầm'
  };
  document.getElementById('ex-kind-pill').textContent = kindNames[currentEx.kind] || 'Bài tập';

  const prioEl = document.getElementById('ex-priority-badge');
  prioEl.style.display = currentEx._isPriority ? 'inline-block' : 'none';

  // Hiển thị thanh từ vựng liên kết (chạm để mở thẻ Kanji trong vocab_data.js)
  const linkedVocab = resolveLinkedVocabForExercise(currentEx);
  const refsRow = document.getElementById('ex-refs-row');
  if (linkedVocab.length > 0) {
    refsRow.style.display = 'flex';
    refsRow.innerHTML = `<span class="ex-ref-label">📖 Tra Kanji:</span>` +
      linkedVocab.map(card => `
        <button type="button" class="ex-ref-chip" onclick="openVocabPeekModal('${card.id}')">
          ${escapeHtml(card.kanji || card.jp)}
        </button>
      `).join('');
  } else {
    refsRow.style.display = 'none';
  }

  const choicePanel = document.getElementById('ex-choice-panel');
  const sentencePanel = document.getElementById('ex-sentence-panel');

  if (currentEx.kind === 'sentence') {
    choicePanel.style.display = 'none';
    sentencePanel.style.display = 'flex';
    renderSentenceExercisePanel(currentEx);
  } else {
    sentencePanel.style.display = 'none';
    choicePanel.style.display = 'flex';
    renderChoiceExercisePanel(currentEx);
  }
}

function renderChoiceExercisePanel(ex) {
  document.getElementById('ex-source-badge').textContent = `${ex.level} • ${ex.topic}`;
  document.getElementById('ex-choice-prompt-jp').textContent = ex.prompt_jp;
  document.getElementById('ex-choice-prompt-vi').textContent = ex.prompt_vi ? `Nghĩa: ${ex.prompt_vi}` : '';
  document.getElementById('ex-choice-feedback').style.display = 'none';

  const opts = [...ex.options];
  for (let i = opts.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [opts[i], opts[j]] = [opts[j], opts[i]];
  }

  const letters = ['A', 'B', 'C', 'D'];
  document.getElementById('ex-choice-options').innerHTML = opts.map((optText, idx) => `
    <button
      type="button"
      class="quiz-opt-btn jp-opt"
      data-opt-val="${escapeHtml(optText)}"
      onclick="handleChoiceExerciseAnswer(this)"
    >
      <span class="opt-letter">${letters[idx]}</span>
      <span>${escapeHtml(optText)}</span>
    </button>
  `).join('');
}

async function handleChoiceExerciseAnswer(btnEl) {
  const exState = state.exercise;
  if (exState.answered) return;
  exState.answered = true;
  recordStudyActivity();

  const currentEx = exState.queue[exState.currentIndex];
  const selectedVal = btnEl.getAttribute('data-opt-val');
  const isCorrect = selectedVal === currentEx.answer;

  if (currentEx.full_jp) speakJapanese(currentEx.full_jp);

  document.querySelectorAll('#ex-choice-options .quiz-opt-btn').forEach(btn => {
    btn.disabled = true;
    const val = btn.getAttribute('data-opt-val');
    if (val === currentEx.answer) {
      btn.classList.add('correct');
    } else if (btn === btnEl && !isCorrect) {
      btn.classList.add('wrong');
    }
  });

  const syncNoteEl = document.getElementById('ex-choice-sync-note');
  syncNoteEl.style.display = 'none';

  if (isCorrect) {
    exState.completedCount += 1;
    exState.energy += 5;
    playFeedbackTone(true);
  } else {
    playFeedbackTone(false);
    exState.queue.push(currentEx);
    const marked = await syncWrongExerciseToVocabReview(currentEx);
    if (marked.length > 0) {
      syncNoteEl.textContent = `📌 Đã tự đánh dấu "Cần ôn" cho từ: ${marked.join(', ')}`;
      syncNoteEl.style.display = 'block';
    }
  }

  document.getElementById('ex-energy-count').textContent = exState.energy;
  const fbBox = document.getElementById('ex-choice-feedback');
  fbBox.className = `duo-feedback-sheet ${isCorrect ? 'correct' : 'wrong'}`;
  fbBox.style.display = 'flex';
  document.getElementById('ex-choice-fb-icon').textContent = isCorrect ? '✓' : '✕';
  document.getElementById('ex-choice-fb-title').textContent = isCorrect ? 'Chính xác!' : `Đáp án đúng: ${currentEx.answer}`;
  document.getElementById('ex-choice-fb-exp').textContent = currentEx.explanation;
}

function renderSentenceExercisePanel(sentence) {
  const exState = state.exercise;

  const tokensWrap = document.getElementById('duo-tokens-wrap');
  tokensWrap.innerHTML = sentence.tokens.map((tok, idx) => `
    <button
      type="button"
      class="duo-token-btn ${exState.activeTokenIdx === idx ? 'active-token' : ''}"
      onclick="handleTokenTap(event, ${idx})"
    >${escapeHtml(tok.jp)}</button>
  `).join('') + `<span class="duo-punct">。</span>`;

  const answerSlots = document.getElementById('duo-answer-slots');
  answerSlots.innerHTML = exState.selectedBankIds.map((bankIdx, slotPos) => {
    const chip = exState.bankChips[bankIdx];
    return `
      <button
        type="button"
        class="duo-chip placed"
        ${exState.answered ? 'disabled' : ''}
        onclick="event.stopPropagation(); removeAnswerChip(${slotPos})"
      >${escapeHtml(chip.text)}</button>
    `;
  }).join('');

  const bankWrap = document.getElementById('duo-word-bank');
  bankWrap.innerHTML = exState.bankChips.map(chip => `
    <button
      type="button"
      class="duo-chip ${chip.used ? 'used-placeholder' : ''}"
      ${chip.used || exState.answered ? 'disabled' : ''}
      onclick="selectBankChip(${chip.bankIdx})"
    >${escapeHtml(chip.text)}</button>
  `).join('');

  const actionRow = document.getElementById('duo-action-row');
  const checkBtn = document.getElementById('duo-check-btn');
  const fbSheet = document.getElementById('duo-feedback-sheet');

  if (!exState.answered) {
    actionRow.style.display = 'flex';
    checkBtn.disabled = exState.selectedBankIds.length === 0;
    fbSheet.style.display = 'none';
  } else {
    actionRow.style.display = 'none';
    fbSheet.style.display = 'flex';
    fbSheet.className = `duo-feedback-sheet ${exState.isCorrect ? 'correct' : 'wrong'}`;
    document.getElementById('duo-fb-icon').textContent = exState.isCorrect ? '✓' : '✕';
    document.getElementById('duo-fb-title').textContent = exState.isCorrect ? 'Tuyệt vời! Chính xác!' : 'Chưa chính xác';
    document.getElementById('duo-fb-subtitle').innerHTML = exState.isCorrect
      ? `<strong>${escapeHtml(sentence.vi)}</strong> (${escapeHtml(sentence.romaji)})`
      : `Đáp án đúng: <strong>${escapeHtml(sentence.vi)}</strong>`;
  }
}

let activePeekCardId = '';

function handleTokenTap(event, tokenIdx) {
  event.stopPropagation();
  const sentence = state.exercise.queue[state.exercise.currentIndex];
  if (!sentence || !sentence.tokens[tokenIdx]) return;

  const tok = sentence.tokens[tokenIdx];
  state.exercise.activeTokenIdx = tokenIdx;

  const tipBox = document.getElementById('duo-token-tooltip');
  document.getElementById('duo-tip-jp').textContent = tok.jp;
  document.getElementById('duo-tip-romaji').textContent = tok.romaji ? `/${tok.romaji}/` : '';
  document.getElementById('duo-tip-vi').textContent = tok.vi || '---';

  const matchedCards = findVocabCardsByKeys([tok.ref, tok.jp]);
  const vocabBtn = document.getElementById('duo-tip-vocab-btn');
  if (matchedCards.length > 0) {
    activePeekCardId = matchedCards[0].id;
    vocabBtn.style.display = 'inline-block';
  } else {
    activePeekCardId = '';
    vocabBtn.style.display = 'none';
  }

  tipBox.style.display = 'flex';
  speakJapanese(tok.jp);
  renderSentenceExercisePanel(sentence);
}

function openPeekFromActiveToken() {
  if (activePeekCardId) openVocabPeekModal(activePeekCardId);
}

function hideTokenTooltip() {
  state.exercise.activeTokenIdx = -1;
  const tipBox = document.getElementById('duo-token-tooltip');
  if (tipBox) tipBox.style.display = 'none';
  document.querySelectorAll('.duo-token-btn').forEach(btn => btn.classList.remove('active-token'));
}

function speakCurrentExercise() {
  const currentEx = state.exercise.queue[state.exercise.currentIndex];
  if (!currentEx) return;
  if (currentEx.kind === 'sentence') speakJapanese(currentEx.jp);
  else speakJapanese(currentEx.full_jp || currentEx.prompt_jp);
}

function selectBankChip(bankIdx) {
  if (state.exercise.answered) return;
  const chip = state.exercise.bankChips[bankIdx];
  if (!chip || chip.used) return;

  hideTokenTooltip();
  chip.used = true;
  state.exercise.selectedBankIds.push(bankIdx);
  renderSentenceExercisePanel(state.exercise.queue[state.exercise.currentIndex]);
}

function removeAnswerChip(slotPos) {
  if (state.exercise.answered) return;
  const bankIdx = state.exercise.selectedBankIds[slotPos];
  if (bankIdx === undefined) return;

  hideTokenTooltip();
  state.exercise.selectedBankIds.splice(slotPos, 1);
  if (state.exercise.bankChips[bankIdx]) {
    state.exercise.bankChips[bankIdx].used = false;
  }
  renderSentenceExercisePanel(state.exercise.queue[state.exercise.currentIndex]);
}

function useTranslateHint() {
  const exState = state.exercise;
  if (exState.answered) return;
  const sentence = exState.queue[exState.currentIndex];
  if (!sentence || sentence.kind !== 'sentence') return;

  const expected = sentence.vi_blocks;
  let matchPrefixLen = 0;
  while (
    matchPrefixLen < exState.selectedBankIds.length &&
    matchPrefixLen < expected.length &&
    exState.bankChips[exState.selectedBankIds[matchPrefixLen]].text.toLowerCase() === expected[matchPrefixLen].toLowerCase()
  ) {
    matchPrefixLen++;
  }

  while (exState.selectedBankIds.length > matchPrefixLen) {
    const removedIdx = exState.selectedBankIds.pop();
    if (exState.bankChips[removedIdx]) exState.bankChips[removedIdx].used = false;
  }

  if (matchPrefixLen < expected.length) {
    const nextWord = expected[matchPrefixLen].toLowerCase();
    const candidate = exState.bankChips.find(c => !c.used && c.text.toLowerCase() === nextWord);
    if (candidate) {
      candidate.used = true;
      exState.selectedBankIds.push(candidate.bankIdx);
      showToast(`Gợi ý từ tiếp theo: "${candidate.text}"`);
      renderSentenceExercisePanel(sentence);
    }
  }
}

function normalizeVietnameseSentence(str) {
  return String(str || '')
    .toLowerCase()
    .replace(/[.,!?？。]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

async function checkTranslateAnswer() {
  const exState = state.exercise;
  if (exState.answered || exState.selectedBankIds.length === 0) return;

  hideTokenTooltip();
  recordStudyActivity();
  const sentence = exState.queue[exState.currentIndex];
  const userSentence = exState.selectedBankIds
    .map(id => exState.bankChips[id].text)
    .join(' ');

  const normUser = normalizeVietnameseSentence(userSentence);
  const normExpectedBlocks = normalizeVietnameseSentence(sentence.vi_blocks.join(' '));
  const normExpectedVi = normalizeVietnameseSentence(sentence.vi);

  const isCorrect = normUser === normExpectedBlocks || normUser === normExpectedVi;

  exState.answered = true;
  exState.isCorrect = isCorrect;

  const syncNoteEl = document.getElementById('duo-fb-sync-note');
  syncNoteEl.style.display = 'none';

  if (isCorrect) {
    exState.completedCount += 1;
    exState.energy += 5;
    playFeedbackTone(true);
    speakJapanese(sentence.jp);
  } else {
    playFeedbackTone(false);
    exState.queue.push(sentence);
    const marked = await syncWrongExerciseToVocabReview(sentence);
    if (marked.length > 0) {
      syncNoteEl.textContent = `📌 Đã tự đánh dấu "Cần ôn" cho từ: ${marked.join(', ')}`;
      syncNoteEl.style.display = 'block';
    }
  }

  document.getElementById('ex-energy-count').textContent = exState.energy;
  renderSentenceExercisePanel(sentence);
}

function nextExerciseQuestion() {
  stopSpeech();
  state.exercise.currentIndex += 1;
  loadExerciseQuestion();
}

/**
 * =========================================================================
 * 13. CHẾ ĐỘ 5: GHÉP ĐÔI (NHẬT-VIỆT HOẶC KANJI-CÁCH ĐỌC)
 * =========================================================================
 */
function toggleMatchVariant() {
  state.match.variant = state.match.variant === 'JP_VI' ? 'KANJI_READING' : 'JP_VI';
  document.getElementById('match-variant-btn').textContent =
    state.match.variant === 'JP_VI' ? 'Nhật ↔ Việt ⇄' : 'Kanji ↔ Đọc ⇄';
  startMatchRound();
}

function startMatchRound() {
  let pool = getBaseFilteredCards();
  if (pool.length < 2) pool = [...REPO_CARDS];

  if (state.match.variant === 'KANJI_READING') {
    const kanjiOnly = pool.filter(c => Boolean(c.kanji && c.jp && c.kanji !== c.jp));
    if (kanjiOnly.length >= 2) {
      pool = kanjiOnly;
    } else {
      state.match.variant = 'JP_VI';
      document.getElementById('match-variant-btn').textContent = 'Nhật ↔ Việt ⇄';
      showToast('Chưa đủ từ có Kanji trong bộ lọc này, chuyển về Nhật ↔ Việt');
    }
  }

  if (pool.length === 0) return;

  const shuffled = [...pool];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }

  const pairs = shuffled.slice(0, Math.min(5, shuffled.length));
  const isKanjiReading = state.match.variant === 'KANJI_READING';

  const leftTiles = pairs.map(card => ({
    id: card.id,
    main: isKanjiReading ? card.kanji : (card.kanji || card.jp),
    sub: (!isKanjiReading && card.kanji && card.jp && card.kanji !== card.jp && !state.hideFurigana) ? card.jp : '',
    speakText: card.jp || card.kanji,
    matched: false,
    wrong: false
  }));

  const rightTiles = pairs.map(card => ({
    id: card.id,
    text: isKanjiReading ? card.jp : extractPrimaryMeaning(card.vi),
    isJp: isKanjiReading,
    matched: false,
    wrong: false
  }));

  for (let i = rightTiles.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [rightTiles[i], rightTiles[j]] = [rightTiles[j], rightTiles[i]];
  }

  state.match = {
    round: state.match.round || 1,
    score: state.match.score || 0,
    variant: state.match.variant,
    leftTiles,
    rightTiles,
    selectedLeftIdx: -1,
    selectedRightIdx: -1,
    matchedCount: 0
  };

  document.getElementById('match-summary-box').style.display = 'none';
  document.getElementById('match-active-box').style.display = 'flex';
  renderMatchBoard();
}

function renderMatchBoard() {
  const m = state.match;
  const totalPairs = m.leftTiles.length;
  const pct = totalPairs > 0 ? Math.round((m.matchedCount / totalPairs) * 100) : 0;

  document.getElementById('match-round-label').textContent = `Lượt ${m.round}`;
  document.getElementById('match-progress-fill').style.width = `${pct}%`;
  document.getElementById('match-score-count').textContent = m.score;

  document.getElementById('match-left-col').innerHTML = m.leftTiles.map((tile, idx) => `
    <button
      type="button"
      class="match-tile jp-tile ${m.selectedLeftIdx === idx ? 'selected' : ''} ${tile.matched ? 'matched' : ''} ${tile.wrong ? 'wrong-flash' : ''}"
      ${tile.matched ? 'disabled' : ''}
      onclick="handleMatchSelect('left', ${idx})"
    >
      <span>${escapeHtml(tile.main)}</span>
      ${tile.sub ? `<span class="tile-sub">${escapeHtml(tile.sub)}</span>` : ''}
    </button>
  `).join('');

  document.getElementById('match-right-col').innerHTML = m.rightTiles.map((tile, idx) => `
    <button
      type="button"
      class="match-tile ${tile.isJp ? 'jp-tile' : ''} ${m.selectedRightIdx === idx ? 'selected' : ''} ${tile.matched ? 'matched' : ''} ${tile.wrong ? 'wrong-flash' : ''}"
      ${tile.matched ? 'disabled' : ''}
      onclick="handleMatchSelect('right', ${idx})"
    >
      <span>${escapeHtml(tile.text)}</span>
    </button>
  `).join('');
}

function handleMatchSelect(side, idx) {
  const m = state.match;
  if (side === 'left') {
    const tile = m.leftTiles[idx];
    if (!tile || tile.matched) return;
    m.selectedLeftIdx = idx;
    speakJapanese(tile.speakText);
  } else {
    const tile = m.rightTiles[idx];
    if (!tile || tile.matched) return;
    m.selectedRightIdx = idx;
  }

  if (m.selectedLeftIdx !== -1 && m.selectedRightIdx !== -1) {
    const lTile = m.leftTiles[m.selectedLeftIdx];
    const rTile = m.rightTiles[m.selectedRightIdx];

    if (lTile.id === rTile.id) {
      lTile.matched = true;
      rTile.matched = true;
      m.matchedCount += 1;
      m.score += 2;
      m.selectedLeftIdx = -1;
      m.selectedRightIdx = -1;
      playFeedbackTone(true);
      recordStudyActivity();

      if (m.matchedCount >= m.leftTiles.length) {
        m.round += 1;
        renderMatchBoard();
        setTimeout(() => {
          document.getElementById('match-active-box').style.display = 'none';
          document.getElementById('match-summary-box').style.display = 'flex';
          document.getElementById('match-final-text').textContent = `Tổng điểm phản xạ: ⚡ ${m.score} điểm`;
        }, 400);
        return;
      }
    } else {
      const wrongL = m.selectedLeftIdx;
      const wrongR = m.selectedRightIdx;
      lTile.wrong = true;
      rTile.wrong = true;
      m.selectedLeftIdx = -1;
      m.selectedRightIdx = -1;
      playFeedbackTone(false);
      renderMatchBoard();

      setTimeout(() => {
        if (m.leftTiles[wrongL]) m.leftTiles[wrongL].wrong = false;
        if (m.rightTiles[wrongR]) m.rightTiles[wrongR].wrong = false;
        renderMatchBoard();
      }, 380);
      return;
    }
  }

  renderMatchBoard();
}

/**
 * =========================================================================
 * 14. CHẾ ĐỘ 6: LUYỆN KANJI CHIẾT TỰ & CHIA THỂ (HỖ TRỢ NHÃN TAG V1/V2/V3)
 * =========================================================================
 */
const ICHIDAN_MASU_STEMS = new Set([
  'たべ', 'み', 'おき', 'ね', 'おしえ', 'かり', 'でき', 'おぼえ', 'わすれ',
  'つとめ', 'あけ', 'しめ', 'つけ', 'かけ', 'あげ', 'くれ', 'おり', 'あび', 'い'
]);

function conjugateJapaneseItem(card) {
  const jp = card.jp;
  const kanji = card.kanji || jp;

  if (card.posCode === 'VERB' && jp.endsWith('ます')) {
    const stemJp = jp.slice(0, -2);
    const stemKanji = kanji.endsWith('ます') ? kanji.slice(0, -2) : stemJp;

    const negJp = `${stemJp}ません`;
    const negKanji = `${stemKanji}ません`;
    const pastJp = `${stemJp}ました`;
    const pastKanji = `${stemKanji}ました`;

    let teJp = '';
    if (card.vGroup === 3 || jp === 'いきます' || jp.endsWith('します') || (jp === 'きます' && kanji === '来ます')) {
      if (jp === 'いきます') teJp = 'いって';
      else if (jp === 'きます' && kanji === '来ます') teJp = 'きて';
      else if (jp.endsWith('します')) teJp = `${jp.slice(0, -3)}して`;
      else teJp = `${stemJp}て`;
    } else if (card.vGroup === 2 || (card.vGroup === 0 && ICHIDAN_MASU_STEMS.has(stemJp))) {
      teJp = `${stemJp}て`;
    } else {
      const lastChar = stemJp.slice(-1);
      const base = stemJp.slice(0, -1);
      if (['い', 'ち', 'り'].includes(lastChar)) teJp = `${base}って`;
      else if (['み', 'び', 'に'].includes(lastChar)) teJp = `${base}んで`;
      else if (lastChar === 'き') teJp = `${base}いて`;
      else if (lastChar === 'ぎ') teJp = `${base}いで`;
      else if (lastChar === 'し') teJp = `${base}して`;
      else teJp = `${stemJp}て`;
    }

    const targets = [
      {
        formName: 'Thể Phủ Định (Không ~)',
        answerJp: negJp,
        answerDisplay: negKanji !== negJp ? `${negKanji} (${negJp})` : negJp,
        distractors: [`${stemJp}ました`, `${stemJp}ませんでした`, teJp]
      },
      {
        formName: 'Thể Quá Khứ (Đã ~)',
        answerJp: pastJp,
        answerDisplay: pastKanji !== pastJp ? `${pastKanji} (${pastJp})` : pastJp,
        distractors: [`${stemJp}ません`, `${stemJp}ませんでした`, teJp]
      },
      {
        formName: 'Thể 〜て (Nối câu / Xin hãy ~)',
        answerJp: teJp,
        answerDisplay: teJp,
        distractors: [`${stemJp}ません`, `${stemJp}ました`, `${stemJp}ない`]
      }
    ];

    return targets[Math.floor(Math.random() * targets.length)];
  }

  if (card.posCode === 'ADJ_I' && jp.endsWith('い')) {
    const isIi = jp === 'いい';
    const stemJp = isIi ? 'よ' : jp.slice(0, -1);
    const stemKanji = isIi ? '良' : (kanji.endsWith('い') ? kanji.slice(0, -1) : stemJp);

    const negJp = `${stemJp}くないです`;
    const pastJp = `${stemJp}かったです`;

    const targets = [
      {
        formName: 'Phủ định Tính từ -i (Không ~)',
        answerJp: negJp,
        answerDisplay: stemKanji !== stemJp ? `${stemKanji}くないです (${negJp})` : negJp,
        distractors: [`${jp}じゃありません`, `${stemJp}かったです`, `${stemJp}くなかったです`]
      },
      {
        formName: 'Quá khứ Tính từ -i (Đã từng ~)',
        answerJp: pastJp,
        answerDisplay: stemKanji !== stemJp ? `${stemKanji}かったです (${pastJp})` : pastJp,
        distractors: [`${jp}でした`, `${stemJp}くないです`, `${stemJp}くなかったです`]
      }
    ];
    return targets[Math.floor(Math.random() * targets.length)];
  }

  if (card.posCode === 'ADJ_NA') {
    const negJp = `${jp}じゃありません`;
    const pastJp = `${jp}でした`;
    const targets = [
      {
        formName: 'Phủ định Tính từ -na (Không ~)',
        answerJp: negJp,
        answerDisplay: kanji !== jp ? `${kanji}じゃありません (${negJp})` : negJp,
        distractors: [`${jp}くないです`, `${jp}でした`, `${jp}かったです`]
      },
      {
        formName: 'Quá khứ Tính từ -na (Đã từng ~)',
        answerJp: pastJp,
        answerDisplay: kanji !== jp ? `${kanji}でした (${pastJp})` : pastJp,
        distractors: [`${jp}かったです`, `${jp}じゃありません`, `${jp}くないです`]
      }
    ];
    return targets[Math.floor(Math.random() * targets.length)];
  }

  return null;
}

function buildKanjiClozePrompt(card) {
  const { coreMnemonic } = splitMnemonicAndBridge(card.mnemonic);
  if (!card.kanji) return null;

  let masked = coreMnemonic;
  for (const ch of card.kanji) {
    if (/[\u4e00-\u9faf]/.test(ch)) {
      masked = masked.split(ch).join('【？】');
    }
  }
  return masked;
}

function cycleDrillSubmode() {
  const order = ['MIXED', 'KANJI_CLOZE', 'CONJUGATION'];
  const nextIdx = (order.indexOf(state.drill.submode) + 1) % order.length;
  state.drill.submode = order[nextIdx];

  const labels = {
    MIXED: 'Hỗn hợp (Kanji + Chia thể) ⇄',
    KANJI_CLOZE: 'Chỉ Chiết tự Kanji ⇄',
    CONJUGATION: 'Chỉ Chia thể Ngữ pháp ⇄'
  };
  document.getElementById('drill-submode-btn').textContent = labels[state.drill.submode];
  startDrillLesson();
}

function startDrillLesson() {
  let pool = getBaseFilteredCards();
  if (pool.length === 0) pool = [...REPO_CARDS];
  if (pool.length === 0) return;

  const shuffled = [...pool];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }

  const questions = [];
  for (const card of shuffled) {
    const conj = conjugateJapaneseItem(card);
    const hasKanji = Boolean(card.kanji && card.kanji !== card.jp);

    if (state.drill.submode === 'CONJUGATION' && conj) {
      questions.push({ kind: 'CONJUGATION', card, conj });
    } else if (state.drill.submode === 'KANJI_CLOZE' && hasKanji) {
      questions.push({ kind: 'KANJI_CLOZE', card });
    } else if (state.drill.submode === 'MIXED') {
      if (conj && Math.random() < 0.5) {
        questions.push({ kind: 'CONJUGATION', card, conj });
      } else if (hasKanji) {
        questions.push({ kind: 'KANJI_CLOZE', card });
      } else if (conj) {
        questions.push({ kind: 'CONJUGATION', card, conj });
      }
    }

    if (questions.length >= 10) break;
  }

  if (questions.length === 0) {
    shuffled.slice(0, 10).forEach(card => {
      questions.push({ kind: 'KANJI_CLOZE', card });
    });
  }

  state.drill = {
    questions,
    currentIndex: 0,
    score: 0,
    answered: false,
    submode: state.drill.submode
  };

  document.getElementById('drill-summary-box').style.display = 'none';
  document.getElementById('drill-active-box').style.display = 'flex';
  renderDrillQuestion();
}

function speakDrillCard() {
  const q = state.drill.questions[state.drill.currentIndex];
  if (!q) return;
  if (q.kind === 'CONJUGATION' && state.drill.answered && q.conj) {
    speakJapanese(q.conj.answerJp);
  } else {
    speakJapanese(q.card.jp || q.card.kanji);
  }
}

function renderDrillQuestion() {
  const d = state.drill;
  if (d.currentIndex >= d.questions.length) {
    document.getElementById('drill-active-box').style.display = 'none';
    document.getElementById('drill-summary-box').style.display = 'flex';
    document.getElementById('drill-final-score-text').textContent =
      `Bạn trả lời đúng ${d.score} / ${d.questions.length} câu!`;
    return;
  }

  d.answered = false;
  const q = d.questions[d.currentIndex];
  const card = q.card;

  document.getElementById('drill-step-num').textContent = `Câu ${d.currentIndex + 1}/${d.questions.length}`;
  document.getElementById('drill-score-badge').textContent = `Điểm: ${d.score}`;

  const lvlTag = document.getElementById('drill-level-tag');
  lvlTag.textContent = card.level;
  lvlTag.className = `level-tag ${card.level.toLowerCase()}`;

  const kindPill = document.getElementById('drill-kind-pill');
  const instEl = document.getElementById('drill-instruction');
  const mainEl = document.getElementById('drill-main-prompt');
  const subHintEl = document.getElementById('drill-sub-hint');
  document.getElementById('drill-feedback-box').style.display = 'none';

  let options = [];

  if (q.kind === 'CONJUGATION' && q.conj) {
    kindPill.textContent = `Chia thể • ${card.posLabel}`;
    instEl.textContent = `Chuyển từ gốc sang: ${q.conj.formName}`;
    mainEl.className = 'drill-main-text jp-target';
    mainEl.textContent = card.kanji ? `${card.kanji} (${card.jp})` : card.jp;
    subHintEl.textContent = `Nghĩa gốc: ${card.vi}`;

    const correctOpt = { text: q.conj.answerDisplay, isCorrect: true, speak: q.conj.answerJp };
    const wrongOpts = q.conj.distractors.slice(0, 3).map(txt => ({
      text: txt,
      isCorrect: false,
      speak: txt
    }));
    options = [correctOpt, ...wrongOpts];
  } else {
    kindPill.textContent = 'Chiết tự Kanji';
    instEl.textContent = 'Dựa vào gợi ý chiết tự bên dưới, chọn từ đúng:';
    mainEl.className = 'drill-main-text';
    mainEl.textContent = buildKanjiClozePrompt(card) || `Nghĩa tiếng Việt: "${card.vi}"`;
    subHintEl.textContent = `Nghĩa: ${card.vi}`;

    const correctLabel = card.kanji ? `${card.kanji} (${card.jp})` : `${card.jp} /${card.romaji}/`;
    const correctOpt = { text: correctLabel, isCorrect: true, speak: card.jp };

    const others = REPO_CARDS.filter(c => c.id !== card.id && (card.kanji ? Boolean(c.kanji) : true));
    for (let i = others.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [others[i], others[j]] = [others[j], others[i]];
    }

    const wrongOpts = others.slice(0, 3).map(c => ({
      text: c.kanji ? `${c.kanji} (${c.jp})` : `${c.jp} /${c.romaji}/`,
      isCorrect: false,
      speak: c.jp
    }));
    options = [correctOpt, ...wrongOpts];
  }

  for (let i = options.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [options[i], options[j]] = [options[j], options[i]];
  }

  const letters = ['A', 'B', 'C', 'D'];
  document.getElementById('drill-options-list').innerHTML = options.map((opt, idx) => `
    <button
      type="button"
      class="quiz-opt-btn jp-opt"
      data-correct="${opt.isCorrect ? '1' : '0'}"
      onclick="handleDrillAnswer(this, ${opt.isCorrect ? 'true' : 'false'}, '${escapeHtml(opt.speak)}')"
    >
      <span class="opt-letter">${letters[idx]}</span>
      <span>${escapeHtml(opt.text)}</span>
    </button>
  `).join('');
}

function handleDrillAnswer(btnEl, isCorrect, speakStr) {
  if (state.drill.answered) return;
  state.drill.answered = true;
  recordStudyActivity();

  const q = state.drill.questions[state.drill.currentIndex];
  speakJapanese(speakStr || q.card.jp);

  document.querySelectorAll('#drill-options-list .quiz-opt-btn').forEach(btn => {
    btn.disabled = true;
    if (btn.getAttribute('data-correct') === '1') {
      btn.classList.add('correct');
    } else if (btn === btnEl && !isCorrect) {
      btn.classList.add('wrong');
    }
  });

  if (isCorrect) {
    state.drill.score += 1;
    playFeedbackTone(true);
  } else {
    playFeedbackTone(false);
  }

  document.getElementById('drill-score-badge').textContent = `Điểm: ${state.drill.score}`;
  const { coreMnemonic } = splitMnemonicAndBridge(q.card.mnemonic);
  document.getElementById('drill-feedback-note').innerHTML =
    `<strong>${isCorrect ? '✓ Chính xác!' : '✕ Chưa đúng!'}</strong> ${escapeHtml(coreMnemonic)}`;
  document.getElementById('drill-feedback-box').style.display = 'flex';
}

function nextDrillQuestion() {
  stopSpeech();
  state.drill.currentIndex += 1;
  renderDrillQuestion();
}

/**
 * =========================================================================
 * 15. TRA CỨU TỪ VỰNG NHANH TRONG KHO
 * =========================================================================
 */
function openSearchModal() {
  document.getElementById('search-repo-subtitle').textContent =
    `Đang lưu trữ ${REPO_CARDS.length} từ vựng & ${REPO_EXERCISES.length} bài tập`;
  document.getElementById('search-modal').style.display = 'flex';
  renderSearchResults();
  setTimeout(() => document.getElementById('repo-search-input').focus(), 100);
}

function closeSearchModal() {
  document.getElementById('search-modal').style.display = 'none';
}

function renderSearchResults() {
  const kw = document.getElementById('repo-search-input').value.trim().toLowerCase();
  const lvl = document.getElementById('repo-search-level').value;

  let list = lvl === 'ALL' ? REPO_CARDS : REPO_CARDS.filter(c => c.level === lvl);

  if (kw) {
    list = list.filter(c =>
      c.jp.toLowerCase().includes(kw) ||
      (c.kanji && c.kanji.toLowerCase().includes(kw)) ||
      c.romaji.toLowerCase().includes(kw) ||
      c.vi.toLowerCase().includes(kw) ||
      c.topic.toLowerCase().includes(kw) ||
      c.mnemonic.toLowerCase().includes(kw)
    );
  }

  const totalMatches = list.length;
  const shown = list.slice(0, 60);

  document.getElementById('search-results-count').textContent =
    totalMatches > 60
      ? `Tìm thấy ${totalMatches} từ (hiển thị 60 kết quả đầu tiên)`
      : `Tìm thấy ${totalMatches} từ khớp`;

  document.getElementById('search-results-list').innerHTML = shown.map(card => {
    const title = card.kanji ? `${card.kanji} (${card.jp})` : card.jp;
    return `
      <div class="search-item-card">
        <div class="search-item-top">
          <div class="badge-group">
            <span class="level-tag ${card.level.toLowerCase()}">${card.level}</span>
            <span class="search-jp-title">${escapeHtml(title)}</span>
          </div>
          <button type="button" class="audio-btn" onclick="speakJapanese('${escapeHtml(card.jp)}')">🔊</button>
        </div>
        <div class="search-vi-text">/${escapeHtml(card.romaji)}/ — ${escapeHtml(card.vi)}</div>
        <div class="search-note-text">${escapeHtml(card.mnemonic)}</div>
      </div>
    `;
  }).join('');
}

/**
 * =========================================================================
 * 16. NHẬP JSON ĐA KHỐI & XUẤT ĐỘC LẬP VOCAB_DATA.JS / EXERCISE_DATA.JS
 * =========================================================================
 */
function parseFlexibleJsonBlocks(rawText) {
  const trimmed = String(rawText || '').trim();
  if (!trimmed) {
    throw new Error('Dữ liệu trống.');
  }

  let cleaned = trimmed
    .replace(/^[\s\S]*?var\s+(?:VOCAB_DATA|EXERCISE_DATA)\s*=\s*/i, '')
    .replace(/;\s*$/, '')
    .trim();

  try {
    const single = JSON.parse(cleaned);
    if (Array.isArray(single) && single.length > 0) return single;
  } catch (e) {}

  const merged = [];
  let depth = 0;
  let inString = false;
  let escapeNext = false;
  let blockStart = -1;

  for (let i = 0; i < cleaned.length; i++) {
    const ch = cleaned[i];
    if (escapeNext) {
      escapeNext = false;
      continue;
    }
    if (ch === '\\' && inString) {
      escapeNext = true;
      continue;
    }
    if (ch === '"') {
      inString = !inString;
      continue;
    }
    if (inString) continue;

    if (ch === '[') {
      if (depth === 0) blockStart = i;
      depth++;
    } else if (ch === ']') {
      depth--;
      if (depth === 0 && blockStart !== -1) {
        const slice = cleaned.slice(blockStart, i + 1);
        const arr = JSON.parse(slice);
        if (Array.isArray(arr)) merged.push(...arr);
        blockStart = -1;
      }
    }
  }

  if (merged.length > 0) return merged;
  throw new Error('Không tìm thấy mảng JSON [...] hợp lệ. Hãy kiểm tra dấu ngoặc vuông hoặc dấu phẩy.');
}

function handleImportFileUpload(event) {
  const file = event.target.files && event.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = (e) => {
    document.getElementById('import-json-text').value = String(e.target.result || '');
    runLiveDuplicateCheck(false);
    showToast(`Đã đọc tệp "${file.name}"!`);
  };
  reader.readAsText(file, 'utf-8');
  event.target.value = '';
}

async function loadQuickDemoSession() {
  const demoVocab = [
    {
      level: 'N5',
      topic: 'Động từ cốt lõi',
      tag: 'v1',
      jp: 'いきます',
      kanji: '行きます',
      romaji: 'ikimasu',
      vi: 'Đi',
      mnemonic: 'Chữ Hành (行 - hình ngã tư đường) -> Đi trên đường. [N4/N3: Mở rộng nghĩa tổ chức sự kiện (行う)]'
    },
    {
      level: 'N5',
      topic: 'Địa điểm & Công trình',
      tag: 'noun',
      jp: 'えき',
      kanji: '駅',
      romaji: 'eki',
      vi: 'Nhà ga',
      mnemonic: 'Chữ Dịch (駅 - Mã 馬 con ngựa + Xích 尺 thước đo) -> Trạm dừng ngựa ngày xưa. [N4/N3: Nhân viên nhà ga (駅員 - ekiin)]'
    },
    {
      level: 'N5',
      topic: 'Tính từ N5 (Phần 1)',
      tag: 'adj_i',
      jp: 'あつい',
      kanji: '暑い',
      romaji: 'atsui',
      vi: 'Nóng (thời tiết)',
      mnemonic: 'Chữ Thử (暑 - Nhật 日 mặt trời + Giả 者 người) -> Người bị mặt trời thiêu đốt. [N4/N3: Mùa hè nóng bức gay gắt]'
    },
    {
      level: 'N5',
      topic: 'Tính từ N5 (Phần 1)',
      tag: 'adj_i',
      jp: 'あつい',
      kanji: '熱い',
      romaji: 'atsui',
      vi: 'Nóng (nhiệt độ đồ vật, thức uống)',
      mnemonic: 'Chữ Nhiệt (熱 - Chấp 執 + Hỏa 灬 ngọn lửa) -> Nung chảy bằng lửa. [N4/N3: Danh từ Phát sốt (熱 - netsu)]'
    }
  ];

  const demoExercises = [
    {
      type: 'exercise',
      kind: 'cloze',
      level: 'N5',
      topic: 'Động từ cốt lõi',
      refs: ['いきます', 'えき'],
      prompt_jp: 'わたしは まいにち でんしゃ（　）えきへ いきます。',
      prompt_vi: 'Mỗi ngày tôi đi đến nhà ga bằng tàu điện.',
      options: ['で', 'を', 'に', 'へ'],
      answer: 'で',
      explanation: 'Trợ từ で đứng sau phương tiện giao thông (でんしゃで = bằng tàu điện).'
    },
    {
      type: 'exercise',
      kind: 'trap',
      level: 'N5',
      topic: 'Tính từ N5 (Phần 1)',
      refs: ['あつい'],
      prompt_jp: 'この おちゃは とても（　）ですから、きをつけて ください。',
      prompt_vi: 'Trà này rất nóng nên hãy cẩn thận.',
      options: ['熱い (あつい)', '暑い (あつい)', '寒い (さむい)', '冷たい (つめたい)'],
      answer: '熱い (あつい)',
      explanation: '熱い dùng cho đồ vật/thức uống nóng; còn 暑い chỉ dùng cho thời tiết nóng.'
    },
    {
      type: 'exercise',
      kind: 'sentence',
      level: 'N5',
      topic: 'Động từ cốt lõi',
      refs: ['いきます', 'えき'],
      jp: 'あしたえきへいきます。',
      romaji: 'Ashita eki e ikimasu.',
      tokens: [
        { jp: 'あした', romaji: 'ashita', vi: 'ngày mai' },
        { jp: 'えき', romaji: 'eki', vi: 'nhà ga', ref: 'えき' },
        { jp: 'へ', romaji: 'e', vi: 'đến (hướng tới)' },
        { jp: 'いきます', romaji: 'ikimasu', vi: 'đi', ref: 'いきます' }
      ],
      vi: 'Ngày mai tôi đi đến nhà ga.',
      vi_blocks: ['Ngày', 'mai', 'tôi', 'đi', 'đến', 'nhà ga'],
      distractors: ['hôm qua', 'bệnh viện', 'không']
    }
  ];

  demoVocab.forEach((raw, idx) => {
    REPO_CARDS.push({ ...normalizeCardObject(raw, idx), source: 'json' });
  });
  demoExercises.forEach((raw, idx) => {
    REPO_EXERCISES.push({ ...normalizeExerciseObject(raw, idx), source: 'json' });
  });

  await saveExtraReposToStorage();
  buildSmartFlashcardBatch();
  refreshUI();
  showToast('Đã nạp bộ mẫu Từ vựng + 3 dạng Bài tập liên kết!');
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
      topic: 'Động từ cốt lõi',
      tag: 'v1',
      jp: 'かいます',
      kanji: '買います',
      romaji: 'kaimasu',
      vi: 'Mua',
      mnemonic: 'Chữ Mãi (買 - lưới 罒 bắt sò 貝 tiền tệ) -> Dùng tiền mua đồ.'
    },
    {
      type: 'exercise',
      kind: 'cloze',
      level: 'N5',
      topic: 'Động từ cốt lõi',
      refs: ['かいます'],
      prompt_jp: 'スーパー（　）やさいを かいます。',
      prompt_vi: 'Tôi mua rau ở siêu thị.',
      options: ['で', 'に', 'へ', 'が'],
      answer: 'で',
      explanation: 'Trợ từ で chỉ địa điểm diễn ra hành động (mua đồ ở siêu thị).'
    }
  ];
  document.getElementById('import-json-text').value = JSON.stringify(sample, null, 2);
  runLiveDuplicateCheck(false);
}

function analyzeIncomingJson(rawText) {
  const parsed = parseFlexibleJsonBlocks(rawText);

  const defaultLevel = normalizeLevel(document.getElementById('import-default-level').value);
  const defaultTopic = document.getElementById('import-default-topic').value.trim() || 'Từ vựng chung';

  const existingMap = new Map([
    ...REPO_CARDS.map(c => [getDuplicateSignature(c), c]),
    ...REPO_EXERCISES.map(ex => [getDuplicateSignature(ex), ex])
  ]);
  const batchSeen = new Set();

  const newVocab = [];
  const newExercises = [];
  const dupWithRepo = [];
  const dupInBatch = [];

  parsed.forEach((raw, idx) => {
    const enriched = {
      ...raw,
      level: raw.level || defaultLevel,
      topic: raw.topic || defaultTopic
    };
    const isEx = isExerciseItem(enriched);
    const item = isEx
      ? normalizeExerciseObject(enriched, idx)
      : normalizeCardObject(enriched, idx);

    const sig = getDuplicateSignature(item);
    if (batchSeen.has(sig)) {
      dupInBatch.push(item);
    } else {
      batchSeen.add(sig);
      if (existingMap.has(sig)) {
        dupWithRepo.push({ incoming: item, existing: existingMap.get(sig) });
      } else if (isEx) {
        newExercises.push(item);
      } else {
        newVocab.push(item);
      }
    }
  });

  return { newVocab, newExercises, dupWithRepo, dupInBatch };
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
    summaryEl.textContent = '🔍 Dán JSON hoặc chọn tệp để tự động phân luồng & kiểm tra trùng.';
    listEl.style.display = 'none';
    policyRowEl.style.display = 'none';
    if (explicitClick) showToast('Vui lòng dán JSON trước khi kiểm tra');
    return null;
  }

  try {
    const result = analyzeIncomingJson(jsonText);
    const totalDup = result.dupWithRepo.length + result.dupInBatch.length;
    const summaryParts = [];
    if (result.newVocab.length > 0) summaryParts.push(`${result.newVocab.length} từ vựng mới`);
    if (result.newExercises.length > 0) summaryParts.push(`${result.newExercises.length} bài tập mới`);
    const validLabel = summaryParts.length > 0 ? summaryParts.join(' & ') : '0 mục mới';

    if (totalDup === 0) {
      boxEl.className = 'dup-check-box clean';
      summaryEl.textContent = `✓ Hợp lệ: ${validLabel}, không có mục nào bị trùng!`;
      listEl.style.display = 'none';
      policyRowEl.style.display = 'none';
      if (explicitClick) showToast('Không có mục nào bị trùng lặp!');
    } else {
      boxEl.className = 'dup-check-box warning';
      summaryEl.textContent = `⚠️ Phát hiện ${totalDup} mục trùng (${validLabel}):`;

      const details = [];
      result.dupWithRepo.slice(0, 40).forEach(d => {
        const isEx = isExerciseItem(d.incoming);
        const label = isEx
          ? `[Bài tập] ${d.incoming.prompt_jp || d.incoming.jp}`
          : `[Từ vựng] ${d.incoming.kanji ? `${d.incoming.kanji} (${d.incoming.jp})` : d.incoming.jp}`;
        details.push(`• Trùng với kho: ${label}`);
      });
      result.dupInBatch.slice(0, 20).forEach(d => {
        const isEx = isExerciseItem(d);
        const label = isEx
          ? `[Bài tập] ${d.prompt_jp || d.jp}`
          : `[Từ vựng] ${d.kanji ? `${d.kanji} (${d.jp})` : d.jp}`;
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
    summaryEl.textContent = '⏳ Đang chờ khối JSON hoàn chỉnh để kiểm tra trùng...';
    listEl.style.display = 'none';
    policyRowEl.style.display = 'none';
    if (explicitClick) {
      errorEl.textContent = 'Lỗi cú pháp JSON: ' + err.message;
      errorEl.style.display = 'block';
    }
    return null;
  }
}

async function importJsonToRepo() {
  const jsonText = document.getElementById('import-json-text').value.trim();
  const errorEl = document.getElementById('import-error-msg');

  if (!jsonText) {
    errorEl.textContent = 'Vui lòng dán dữ liệu JSON hoặc chọn tệp từ máy.';
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
  let addedVocab = 0;
  let addedEx = 0;
  let updatedCount = 0;

  analysis.newVocab.forEach(item => {
    REPO_CARDS.push({ ...item, source: 'json' });
    addedVocab++;
  });

  analysis.newExercises.forEach(item => {
    REPO_EXERCISES.push({ ...item, source: 'json' });
    addedEx++;
  });

  if (policy === 'overwrite' && analysis.dupWithRepo.length > 0) {
    analysis.dupWithRepo.forEach(({ incoming, existing }) => {
      if (isExerciseItem(existing)) {
        const idx = REPO_EXERCISES.findIndex(s => s.id === existing.id);
        if (idx !== -1) {
          REPO_EXERCISES[idx] = { ...incoming, id: existing.id, source: existing.source };
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

  await saveExtraReposToStorage();
  document.getElementById('import-json-text').value = '';
  closeImportModal();
  if (state.sessionMode) buildSmartFlashcardBatch();
  refreshUI();

  const msgParts = [];
  if (addedVocab > 0) msgParts.push(`${addedVocab} từ vựng`);
  if (addedEx > 0) msgParts.push(`${addedEx} bài tập`);
  if (updatedCount > 0) msgParts.push(`cập nhật ${updatedCount} mục`);
  showToast(msgParts.length > 0 ? `Đã nạp ${msgParts.join(', ')}!` : 'Không có mục mới nào được thêm');
}

function openExportModal() {
  document.getElementById('export-vocab-count').textContent = `${REPO_CARDS.length} từ vựng & Kanji (N5 → N3)`;
  document.getElementById('export-ex-count').textContent = `${REPO_EXERCISES.length} câu bài tập ngữ cảnh (Điền khuyết, Dịch câu, Bẫy từ)`;
  document.getElementById('export-modal').style.display = 'flex';
}

function closeExportModal() {
  document.getElementById('export-modal').style.display = 'none';
}

function triggerFileDownload(filename, content) {
  const blob = new Blob([content], { type: 'application/javascript;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function exportVocabDataJsFile() {
  const cleanExport = REPO_CARDS.map(({ id, source, type, posCode, vGroup, posLabel, ...rest }) => rest);
  const fileContent = `/**
 * TỆP DỮ LIỆU TỪ VỰNG & KANJI TRUNG TÂM (N5 -> N3)
 * Xuất tự động từ ứng dụng Flashcards (${cleanExport.length} từ vựng)
 */

var VOCAB_DATA = ${JSON.stringify(cleanExport, null, 2)};
`;
  triggerFileDownload('vocab_data.js', fileContent);
  showToast(`Đã xuất vocab_data.js (${cleanExport.length} từ)!`);
}

function exportExerciseDataJsFile() {
  const cleanExport = REPO_EXERCISES.map(({ id, source, _isPriority, full_jp, ...rest }) => rest);
  const fileContent = `/**
 * TỆP DỮ LIỆU BÀI TẬP NGỮ CẢNH CHUẨN XÁC (N5 -> N3)
 * Gồm 3 dạng: Điền khuyết (cloze), Dịch câu ghép từ (sentence), Bẫy dễ nhầm (trap)
 * Xuất tự động (${cleanExport.length} bài tập)
 */

var EXERCISE_DATA = ${JSON.stringify(cleanExport, null, 2)};
`;
  triggerFileDownload('exercise_data.js', fileContent);
  showToast(`Đã xuất exercise_data.js (${cleanExport.length} bài tập)!`);
}

/**
 * =========================================================================
 * 17. TIỆN ÍCH, CỬ CHỈ VUỐT & PHÍM TẮT
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

function initKeyboardShortcuts() {
  document.addEventListener('keydown', e => {
    if (['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement.tagName)) return;
    if (state.mode !== 'flashcard') return;

    if (e.code === 'Space') {
      e.preventDefault();
      flipCard();
    } else if (e.code === 'ArrowRight') {
      nextCard();
    } else if (e.code === 'ArrowLeft') {
      prevCard();
    } else if (e.key === '1') {
      rateCurrentCard('review');
    } else if (e.key === '2') {
      rateCurrentCard('known');
    }
  });
}

window.addEventListener('DOMContentLoaded', async () => {
  initIosZoomLock();
  document.addEventListener('touchstart', unlockMobileAudio, { once: true, passive: true });
  document.addEventListener('click', unlockMobileAudio, { once: true });
  loadStreak();
  await loadRepository();
  initSwipeGestures();
  initKeyboardShortcuts();
  refreshUI();
});