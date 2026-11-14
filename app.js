/**
 * =========================================================================
 * 1. QUẢN LÝ 2 KHO DỮ LIỆU ĐỘC LẬP (VOCAB_DATA & EXERCISE_DATA) + INDEXEDDB
 * =========================================================================
 */
const STORAGE_REPO_VOCAB_KEY = 'jp_n5_n3_vocab_v4';
const STORAGE_REPO_EXERCISE_KEY = 'jp_n5_n3_exercise_v4';
const STORAGE_PROGRESS_KEY = 'jp_n5_n3_progress_v4';
const STORAGE_STREAK_KEY = 'jp_n5_n3_streak_v4';
const SESSION_BATCH_SIZE = 12;

const IDB_NAME = 'JLPT_DualRepo_DB';
const IDB_VERSION = 1;
const IDB_STORE = 'kv_store';

let REPO_CARDS = [];      // Kho 1: Từ vựng & Kanji (vocab_data.js)
let REPO_EXERCISES = [];  // Kho 2: Câu hỏi & Bài tập ngữ cảnh (exercise_data.js)

let state = {
  selectedLevel: 'ALL',     // 'ALL' | 'N5' | 'N4' | 'N3'
  selectedTopic: 'ALL',     // 'ALL' | tên chủ đề
  studyFocus: 'guided',     // 'guided' (Lộ trình 4 chặng) | 'vocab_only' (Chỉ học từ vựng)
  guidedStepIndex: 0,       // 0: flashcard -> 1: match -> 2: drill -> 3: exercise
  mode: 'flashcard',        // 'flashcard' | 'quiz' | 'dictation' | 'exercise' | 'match' | 'drill' | 'kana'
  filterUnmastered: false,
  hideFurigana: false,
  sessionMode: true,
  sessionBatchIds: [],
  currentIndex: 0,
  isFlipped: false,
  voiceMode: 'normal',      // 'normal' | 'slow'
  progress: {},             // { [cardId]: 'known' | 'review' }
  streak: { count: 0, lastDate: '' },
  quiz: {
    questions: [],
    currentIndex: 0,
    score: 0,
    wrongCards: [],
    answered: false
  },
  dictation: {
    questions: [],
    currentIndex: 0,
    score: 0,
    answered: false,
    hintUsed: false
  },
  exercise: {
    items: [],
    currentIndex: 0,
    energy: 0,
    kindFilter: 'ALL',      // 'ALL' | 'cloze' | 'sentence' | 'trap'
    selectedIndices: [],
    bankTokens: [],
    activeTokenIdx: null,
    checked: false
  },
  match: {
    round: 1,
    score: 0,
    variant: 'JP_VI',       // 'JP_VI' | 'KANJI_HIRA'
    pairs: [],
    leftItems: [],
    rightItems: [],
    selectedLeftId: null,
    selectedRightId: null,
    matchedIds: []
  },
  drill: {
    questions: [],
    currentIndex: 0,
    score: 0,
    answered: false,
    submode: 'MIXED'        // 'MIXED' | 'KANJI_CLOZE' | 'CONJUGATION'
  },
  kana: {
    script: 'hiragana',     // 'hiragana' | 'katakana'
    subtab: 'chart',        // 'chart' | 'quiz'
    group: 'BASIC',         // 'BASIC' | 'DAKUTEN' | 'YOON'
    selectedIdx: 0,
    quizQuestions: [],
    quizIndex: 0,
    quizScore: 0,
    quizAnswered: false
  }
};

const GUIDED_STEP_MODES = ['flashcard', 'match', 'drill', 'exercise'];

/**
 * =========================================================================
 * 2. BỘ NHỚ INDEXEDDB DUNG LƯỢNG LỚN
 * =========================================================================
 */
function openDatabase() {
  return new Promise((resolve) => {
    if (!('indexedDB' in window)) {
      resolve(null);
      return;
    }
    const req = indexedDB.open(IDB_NAME, IDB_VERSION);
    req.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(IDB_STORE)) {
        db.createObjectStore(IDB_STORE);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => resolve(null);
  });
}

async function idbGet(key) {
  const db = await openDatabase();
  if (!db) return null;
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(IDB_STORE, 'readonly');
      const store = tx.objectStore(IDB_STORE);
      const req = store.get(key);
      req.onsuccess = () => resolve(req.result ?? null);
      req.onerror = () => resolve(null);
    } catch (e) {
      resolve(null);
    }
  });
}

async function idbSet(key, val) {
  const db = await openDatabase();
  if (!db) return false;
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(IDB_STORE, 'readwrite');
      const store = tx.objectStore(IDB_STORE);
      store.put(val, key);
      tx.oncomplete = () => resolve(true);
      tx.onerror = () => resolve(false);
    } catch (e) {
      resolve(false);
    }
  });
}

/**
 * =========================================================================
 * 3. CHUẨN HÓA DỮ LIỆU TỪ VỰNG (VOCAB) & BÀI TẬP (EXERCISE)
 * =========================================================================
 */
function escapeHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function normalizeKeyText(str) {
  return String(str || '').trim().toLowerCase().replace(/\s+/g, '');
}

function getCardUniqueKey(item) {
  const jp = normalizeKeyText(item.jp);
  const kj = normalizeKeyText(item.kanji);
  return `${jp}__${kj}`;
}

function getExerciseUniqueKey(item) {
  const kind = normalizeKeyText(item.kind || 'sentence');
  const mainJp = normalizeKeyText(item.prompt_jp || item.jp);
  const ans = normalizeKeyText(item.answer || item.vi);
  return `EX__${kind}__${mainJp}__${ans}`;
}

function makeCardId(level, topic, jp, kanji) {
  const raw = `${level}_${topic}_${jp}_${kanji || ''}`;
  let hash = 0;
  for (let i = 0; i < raw.length; i++) {
    hash = (hash << 5) - hash + raw.charCodeAt(i);
    hash |= 0;
  }
  return `vc_${Math.abs(hash)}`;
}

function makeExerciseId(level, kind, jpText, answerText) {
  const raw = `ex_${level}_${kind}_${jpText}_${answerText}`;
  let hash = 0;
  for (let i = 0; i < raw.length; i++) {
    hash = (hash << 5) - hash + raw.charCodeAt(i);
    hash |= 0;
  }
  return `ex_${Math.abs(hash)}`;
}

function isExerciseEntry(raw) {
  if (!raw || typeof raw !== 'object') return false;
  if (raw.type === 'exercise' || raw.type === 'sentence') return true;
  if (raw.kind === 'cloze' || raw.kind === 'sentence' || raw.kind === 'trap') return true;
  if (raw.prompt_jp && Array.isArray(raw.options)) return true;
  if (Array.isArray(raw.tokens) && Array.isArray(raw.vi_blocks)) return true;
  return false;
}

function normalizeCardItem(item, fallbackLevel = 'N5', fallbackTopic = 'Tổng hợp') {
  const rawLevel = String(item.level || fallbackLevel).toUpperCase().trim();
  const level = ['N5', 'N4', 'N3'].includes(rawLevel) ? rawLevel : 'N5';
  const topic = String(item.topic || fallbackTopic).trim() || 'Tổng hợp';
  const tag = String(item.tag || '').trim().toLowerCase();
  const jp = String(item.jp || '').trim();
  const kanji = String(item.kanji || '').trim();
  const romaji = String(item.romaji || '').trim();
  const vi = String(item.vi || '').trim();
  const mnemonic = String(item.mnemonic || 'Chưa có ghi chú chiết tự.').trim();

  return {
    id: makeCardId(level, topic, jp, kanji),
    level,
    topic,
    tag,
    jp,
    kanji,
    romaji,
    vi,
    mnemonic
  };
}

function normalizeExerciseItem(item, fallbackLevel = 'N5', fallbackTopic = 'Bài tập ngữ cảnh') {
  const rawLevel = String(item.level || fallbackLevel).toUpperCase().trim();
  const level = ['N5', 'N4', 'N3'].includes(rawLevel) ? rawLevel : 'N5';
  const topic = String(item.topic || fallbackTopic).trim() || 'Bài tập ngữ cảnh';

  let kind = String(item.kind || '').toLowerCase().trim();
  if (!['cloze', 'sentence', 'trap'].includes(kind)) {
    if (Array.isArray(item.tokens) || Array.isArray(item.vi_blocks) || item.type === 'sentence') {
      kind = 'sentence';
    } else {
      kind = 'cloze';
    }
  }

  const refs = Array.isArray(item.refs)
    ? item.refs.map(r => String(r).trim()).filter(Boolean)
    : [];

  if (kind === 'sentence') {
    const jp = String(item.jp || item.prompt_jp || '').trim();
    const romaji = String(item.romaji || '').trim();
    const vi = String(item.vi || item.prompt_vi || '').trim();

    const tokens = Array.isArray(item.tokens) && item.tokens.length > 0
      ? item.tokens.map(t => ({
          jp: String(t.jp || '').trim(),
          romaji: String(t.romaji || '').trim(),
          vi: String(t.vi || '').trim(),
          ref: String(t.ref || '').trim()
        })).filter(t => t.jp)
      : [{ jp, romaji, vi }];

    tokens.forEach(t => {
      if (t.ref && !refs.includes(t.ref)) refs.push(t.ref);
    });

    const vi_blocks = Array.isArray(item.vi_blocks) && item.vi_blocks.length > 0
      ? item.vi_blocks.map(w => String(w).trim()).filter(Boolean)
      : vi.replace(/[.?!。？！,]/g, '').split(/\s+/).filter(Boolean);

    const distractors = Array.isArray(item.distractors)
      ? item.distractors.map(w => String(w).trim()).filter(Boolean)
      : ['không', 'hôm qua', 'ở đâu'];

    return {
      id: makeExerciseId(level, kind, jp, vi),
      type: 'exercise',
      kind: 'sentence',
      level,
      topic,
      refs,
      jp,
      romaji,
      tokens,
      vi,
      vi_blocks,
      distractors,
      explanation: String(item.explanation || '').trim()
    };
  }

  const prompt_jp = String(item.prompt_jp || item.jp || '').trim();
  const prompt_vi = String(item.prompt_vi || item.vi || '').trim();
  const options = Array.isArray(item.options)
    ? item.options.map(o => String(o).trim()).filter(Boolean)
    : [];
  const answer = String(item.answer || options[0] || '').trim();
  const explanation = String(item.explanation || 'Hãy chú ý ngữ cảnh và trợ từ đi kèm trong câu.').trim();

  return {
    id: makeExerciseId(level, kind, prompt_jp, answer),
    type: 'exercise',
    kind,
    level,
    topic,
    refs,
    prompt_jp,
    prompt_vi,
    options,
    answer,
    explanation
  };
}

function parseMnemonicAndBridge(rawMnemonic) {
  const text = String(rawMnemonic || 'Chưa có ghi chú.').trim();
  const regex = /\[(?:N4\/N3|N4|N3)\s*:\s*([^\]]+)\]/i;
  const match = text.match(regex);
  if (!match) {
    return { mainTip: text, bridgeTip: '' };
  }
  const bridgeTip = match[1].trim();
  const mainTip = text.replace(regex, '').trim() || 'Ghi nhớ mặt chữ và ngữ cảnh sử dụng.';
  return { mainTip, bridgeTip };
}

function detectWordCategory(card) {
  const tag = String(card.tag || '').toLowerCase();
  const jp = String(card.jp || '').trim();
  const kj = String(card.kanji || '').trim();

  if (tag === 'v3' || jp === 'します' || jp === 'きます' || jp.endsWith('します')) {
    return { pos: 'VERB', group: 3, label: 'Động từ N3 (Bất quy tắc)' };
  }
  if (tag === 'v2') {
    return { pos: 'VERB', group: 2, label: 'Động từ Nhóm 2' };
  }
  if (tag === 'v1') {
    return { pos: 'VERB', group: 1, label: 'Động từ Nhóm 1' };
  }
  if (tag === 'adj_i') {
    return { pos: 'ADJ_I', group: 0, label: 'Tính từ -i (い)' };
  }
  if (tag === 'adj_na') {
    return { pos: 'ADJ_NA', group: 0, label: 'Tính từ -na (な)' };
  }
  if (tag === 'noun') {
    return { pos: 'NOUN', group: 0, label: 'Danh từ' };
  }

  if (jp.endsWith('ます')) {
    const stem = jp.slice(0, -2);
    const group1Exceptions = ['かえり', 'はいり', 'はしり', 'しり', 'きり', 'いり', 'すべり', 'へり', 'しゃべり'];
    if (group1Exceptions.includes(stem)) {
      return { pos: 'VERB', group: 1, label: 'Động từ Nhóm 1 (Đặc biệt)' };
    }
    const g2Endings = ['え', 'け', 'せ', 'て', 'ね', 'へ', 'め', 'れ', 'げ', 'ぜ', 'で', 'べ', 'ぺ', 'み', 'き', 'じ', 'び'];
    if (stem.length === 1 || g2Endings.some(ch => stem.endsWith(ch))) {
      return { pos: 'VERB', group: 2, label: 'Động từ Nhóm 2' };
    }
    return { pos: 'VERB', group: 1, label: 'Động từ Nhóm 1' };
  }

  const naExceptions = ['きれい', 'ゆうめい', 'きらい', 'とくい', 'ていねい'];
  if (naExceptions.includes(jp) || jp.endsWith('な')) {
    return { pos: 'ADJ_NA', group: 0, label: 'Tính từ -na (な)' };
  }

  if (jp.endsWith('い') && (kj.endsWith('い') || jp === 'いい' || jp === 'かっこいい')) {
    return { pos: 'ADJ_I', group: 0, label: 'Tính từ -i (い)' };
  }

  return { pos: 'NOUN', group: 0, label: 'Từ vựng' };
}

function generateWordConjugations(card) {
  const cat = detectWordCategory(card);
  const jp = String(card.jp || '').trim();

  if (cat.pos === 'VERB' && jp.endsWith('ます')) {
    const stem = jp.slice(0, -2);
    const neg = `${stem}ません`;
    const past = `${stem}ました`;
    let te = '';

    if (cat.group === 3) {
      if (jp === 'きます' || jp.endsWith('きます')) te = jp.slice(0, -3) + 'きて';
      else te = `${stem}て`;
    } else if (cat.group === 2) {
      te = `${stem}て`;
    } else {
      if (jp === 'いきます' || jp.endsWith('いきます')) {
        te = `${jp.slice(0, -4)}いって`;
      } else {
        const lastChar = stem.slice(-1);
        const base = stem.slice(0, -1);
        if (['い', 'ち', 'り'].includes(lastChar)) te = `${base}って`;
        else if (['み', 'び', 'に'].includes(lastChar)) te = `${base}んで`;
        else if (lastChar === 'き') te = `${base}いて`;
        else if (lastChar === 'ぎ') te = `${base}いで`;
        else if (lastChar === 'し') te = `${base}して`;
        else te = `${stem}て`;
      }
    }

    return [
      { formName: 'Thể phủ định lịch sự (〜ません)', answer: neg, wrongs: [`${stem}ない`, `${stem}ました`, `${stem}て`] },
      { formName: 'Thể quá khứ lịch sự (〜ました)', answer: past, wrongs: [`${stem}ません`, `${stem}た`, `${stem}ます`] },
      { formName: 'Thể nối câu / yêu cầu (〜て)', answer: te, wrongs: [`${stem}て`, `${stem}って`, `${stem}んで`, `${stem}いて`].filter(x => x !== te).slice(0, 3) }
    ];
  }

  if (cat.pos === 'ADJ_I') {
    const base = (jp === 'いい' || jp === 'よい') ? 'よ' : jp.slice(0, -1);
    return [
      { formName: 'Phủ định tính từ -i (Không...)', answer: `${base}くないです`, wrongs: [`${jp}じゃないです`, `${base}かったです`, `${base}くないでした`] },
      { formName: 'Quá khứ tính từ -i (Đã...)', answer: `${base}かったです`, wrongs: [`${jp}でした`, `${base}くないです`, `${base}かったでした`] }
    ];
  }

  if (cat.pos === 'ADJ_NA') {
    const clean = jp.replace(/な$/, '');
    return [
      { formName: 'Phủ định lịch sự (Không...)', answer: `${clean}じゃありません`, wrongs: [`${clean}くないです`, `${clean}でした`, `${clean}ます`] },
      { formName: 'Quá khứ lịch sự (Đã...)', answer: `${clean}でした`, wrongs: [`${clean}かったです`, `${clean}ました`, `${clean}じゃありません`] }
    ];
  }

  return [];
}

/**
 * =========================================================================
 * 4. LIÊN KẾT CHÉO 2 CHIỀU GIỮA VOCAB_DATA.JS & EXERCISE_DATA.JS
 * =========================================================================
 */
function findVocabCardsByKeys(refKeys) {
  if (!Array.isArray(refKeys) || refKeys.length === 0) return [];
  const normalizedRefs = refKeys.map(k => normalizeKeyText(k)).filter(Boolean);
  return REPO_CARDS.filter(card => {
    const jp = normalizeKeyText(card.jp);
    const kj = normalizeKeyText(card.kanji);
    return normalizedRefs.includes(jp) || (kj && normalizedRefs.includes(kj));
  });
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

  const hayStack = `${ex.prompt_jp || ''} ${ex.jp || ''}`;
  return REPO_CARDS.filter(c =>
    (c.kanji && c.kanji.length >= 2 && hayStack.includes(c.kanji)) ||
    (c.jp && c.jp.length >= 3 && hayStack.includes(c.jp))
  ).slice(0, 4);
}

function generateBaseFormCandidates(rawSurface) {
  const clean = String(rawSurface || '')
    .replace(/\([^)]*\)/g, '')
    .replace(/（[^）]*）/g, '')
    .replace(/[。、．.！!？?「」『』\s]/g, '')
    .trim();

  if (!clean) return [];
  const candidates = new Set([clean]);

  const masuEndings = ['ませんでした', 'ました', 'ません', 'ましょう'];
  for (const end of masuEndings) {
    if (clean.endsWith(end) && clean.length > end.length) {
      candidates.add(clean.slice(0, -end.length) + 'ます');
    }
  }

  const teNormalized = clean
    .replace(/(ています|ていました|てください|ている)$/, 'て')
    .replace(/(でいます|でいました|でください|でいる)$/, 'で');

  if (teNormalized === 'いって') {
    candidates.add('いきます');
    candidates.add('いいます');
  } else if (teNormalized === 'きて') {
    candidates.add('きます');
  } else if (teNormalized === 'して') {
    candidates.add('します');
  } else if (teNormalized.endsWith('って') && teNormalized.length > 2) {
    const stem = teNormalized.slice(0, -2);
    candidates.add(stem + 'います');
    candidates.add(stem + 'ちます');
    candidates.add(stem + 'ります');
  } else if (teNormalized.endsWith('んで') && teNormalized.length > 2) {
    const stem = teNormalized.slice(0, -2);
    candidates.add(stem + 'みます');
    candidates.add(stem + 'びます');
    candidates.add(stem + 'にます');
  } else if (teNormalized.endsWith('いて') && teNormalized.length > 2) {
    candidates.add(teNormalized.slice(0, -2) + 'きます');
  } else if (teNormalized.endsWith('いで') && teNormalized.length > 2) {
    candidates.add(teNormalized.slice(0, -2) + 'ぎます');
  } else if (teNormalized.endsWith('して') && teNormalized.length > 2) {
    const stem = teNormalized.slice(0, -2);
    candidates.add(stem + 'します');
  } else if (teNormalized.endsWith('て') && teNormalized.length > 1) {
    candidates.add(teNormalized.slice(0, -1) + 'ます');
  }

  const adjEndings = ['くなかったです', 'くなかった', 'かったです', 'かった', 'くないです', 'くない'];
  for (const end of adjEndings) {
    if (clean.endsWith(end) && clean.length > end.length) {
      const stem = clean.slice(0, -end.length);
      if (stem === 'よ' || stem === '良') candidates.add('いい');
      else candidates.add(stem + 'い');
    }
  }

  const naEndings = ['じゃありませんでした', 'じゃありません', 'ではありません', 'でした'];
  for (const end of naEndings) {
    if (clean.endsWith(end) && clean.length > end.length) {
      candidates.add(clean.slice(0, -end.length));
    }
  }

  return Array.from(candidates);
}

function findVocabCardForTap(rawSurface) {
  const candidates = generateBaseFormCandidates(rawSurface);
  if (candidates.length === 0) return null;

  for (const cand of candidates) {
    const exact = REPO_CARDS.find(c => c.jp === cand || c.kanji === cand);
    if (exact) return exact;
  }

  const mainClean = candidates[0];
  if (mainClean.length >= 2) {
    const partial = REPO_CARDS.find(c =>
      (c.kanji && c.kanji.length >= 2 && mainClean.includes(c.kanji)) ||
      (c.jp && c.jp.length >= 3 && mainClean.includes(c.jp))
    );
    if (partial) return partial;
  }

  return null;
}

function handlePromptWordTap(rawSurface) {
  const cleanWord = String(rawSurface || '').replace(/\([^)]*\)/g, '').trim();
  if (!cleanWord) return;

  const matchedCard = findVocabCardForTap(cleanWord);
  if (matchedCard) {
    openVocabPeekModal(matchedCard.id);
  } else {
    speakJapanese(cleanWord);
    showToast(`🔊 ${cleanWord} (Chưa có thẻ riêng trong kho từ vựng)`);
  }
}

function renderInteractiveJapanesePrompt(jpText) {
  const raw = String(jpText || '').trim();
  if (!raw) return '';

  const parts = raw.split(/(\s+|（[\s　]*）|\([\s　]*\)|[。、．.！!？?])/g).filter(Boolean);

  return parts.map(part => {
    if (/^\s+$/.test(part)) return ' ';
    if (/^(（[\s　]*）|\([\s　]*\)|[。、．.！!？?])$/.test(part)) {
      return `<span>${escapeHtml(part)}</span>`;
    }
    const particleMatch = part.match(/^(.{2,})(は|が|を|に|へ|で|と|も|から|まで)$/);
    if (particleMatch) {
      const wordCore = particleMatch[1];
      const particle = particleMatch[2];
      return `<button type="button" class="ex-tap-word" onclick="handlePromptWordTap('${escapeHtml(wordCore)}')">${escapeHtml(wordCore)}</button><span>${escapeHtml(particle)}</span>`;
    }
    return `<button type="button" class="ex-tap-word" onclick="handlePromptWordTap('${escapeHtml(part)}')">${escapeHtml(part)}</button>`;
  }).join('');
}

let activePeekCardId = '';

function openVocabPeekModal(cardId) {
  const card = REPO_CARDS.find(c => c.id === cardId);
  if (!card) return;

  const cat = detectWordCategory(card);
  const { mainTip, bridgeTip } = parseMnemonicAndBridge(card.mnemonic);

  const lvlEl = document.getElementById('peek-level-tag');
  lvlEl.textContent = card.level;
  lvlEl.className = `level-tag ${card.level.toLowerCase()}`;
  document.getElementById('peek-pos-tag').textContent = cat.label;

  document.getElementById('peek-jp-title').textContent = card.kanji
    ? `${card.kanji} (${card.jp})`
    : card.jp;
  document.getElementById('peek-romaji').textContent = `/${card.romaji}/`;
  document.getElementById('peek-vi').textContent = card.vi;
  document.getElementById('peek-mnemonic').textContent = mainTip;

  const bridgeBox = document.getElementById('peek-bridge-box');
  if (bridgeTip) {
    bridgeBox.style.display = 'block';
    document.getElementById('peek-bridge-text').textContent = bridgeTip;
  } else {
    bridgeBox.style.display = 'none';
  }

  const speakBtn = document.getElementById('peek-speak-btn');
  speakBtn.onclick = () => speakJapanese(card.jp);

  document.getElementById('vocab-peek-modal').style.display = 'flex';
  speakJapanese(card.jp);
}

function closeVocabPeekModal() {
  document.getElementById('vocab-peek-modal').style.display = 'none';
}

function openPeekFromActiveToken() {
  if (activePeekCardId) {
    openVocabPeekModal(activePeekCardId);
  }
}

function flagLinkedVocabForReview(ex) {
  const linked = resolveLinkedVocabForExercise(ex);
  if (linked.length === 0) return '';

  linked.forEach(card => {
    state.progress[card.id] = 'review';
  });
  saveProgress();
  updateStatsHeader();

  const names = linked.map(c => c.kanji || c.jp).join(', ');
  return `🔄 Đã tự động đánh dấu "Cần ôn lại" cho từ vựng: ${names}`;
}

/**
 * =========================================================================
 * 5. KHỞI TẠO & LƯU TRỮ DỮ LIỆU 2 KHO
 * =========================================================================
 */
function parseMultiJsonBlocks(rawText) {
  const text = String(rawText || '').trim();
  if (!text) return [];

  const cleaned = text
    .replace(/^(?:var|let|const)\s+(?:VOCAB_DATA|EXERCISE_DATA)\s*=\s*/i, '')
    .replace(/;\s*$/, '')
    .trim();

  try {
    const direct = JSON.parse(cleaned);
    if (Array.isArray(direct)) return direct;
    if (direct && typeof direct === 'object') return [direct];
  } catch (err) {}

  const combined = [];
  let depth = 0;
  let startIdx = -1;
  let inString = false;
  let escapeNext = false;

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
      if (depth === 0) startIdx = i;
      depth++;
    } else if (ch === ']') {
      depth--;
      if (depth === 0 && startIdx !== -1) {
        const chunk = cleaned.slice(startIdx, i + 1);
        try {
          const parsedChunk = JSON.parse(chunk);
          if (Array.isArray(parsedChunk)) combined.push(...parsedChunk);
        } catch (e) {}
        startIdx = -1;
      }
    }
  }

  if (combined.length > 0) return combined;
  throw new Error('Cú pháp JSON không hợp lệ. Hãy kiểm tra dấu ngoặc vuông [...] hoặc dấu phẩy.');
}

async function initRepository() {
  const staticVocab = Array.isArray(window.VOCAB_DATA) ? window.VOCAB_DATA : [];
  const staticExercises = Array.isArray(window.EXERCISE_DATA) ? window.EXERCISE_DATA : [];

  let storedVocab = await idbGet(STORAGE_REPO_VOCAB_KEY);
  let storedEx = await idbGet(STORAGE_REPO_EXERCISE_KEY);

  if (!Array.isArray(storedVocab)) {
    try {
      const rawV = localStorage.getItem(STORAGE_REPO_VOCAB_KEY);
      if (rawV) storedVocab = JSON.parse(rawV);
    } catch (e) {}
  }
  if (!Array.isArray(storedEx)) {
    try {
      const rawE = localStorage.getItem(STORAGE_REPO_EXERCISE_KEY);
      if (rawE) storedEx = JSON.parse(rawE);
    } catch (e) {}
  }

  const mergedVocabMap = new Map();
  const mergedExMap = new Map();

  [...staticVocab, ...(Array.isArray(storedVocab) ? storedVocab : [])].forEach(item => {
    if (!item) return;
    if (isExerciseEntry(item)) {
      const ex = normalizeExerciseItem(item);
      if (ex.jp || ex.prompt_jp) mergedExMap.set(getExerciseUniqueKey(ex), ex);
    } else if (item.jp && item.vi) {
      const card = normalizeCardItem(item);
      mergedVocabMap.set(getCardUniqueKey(card), card);
    }
  });

  [...staticExercises, ...(Array.isArray(storedEx) ? storedEx : [])].forEach(item => {
    if (!item) return;
    if (isExerciseEntry(item)) {
      const ex = normalizeExerciseItem(item);
      if (ex.jp || ex.prompt_jp) mergedExMap.set(getExerciseUniqueKey(ex), ex);
    } else if (item.jp && item.vi) {
      const card = normalizeCardItem(item);
      mergedVocabMap.set(getCardUniqueKey(card), card);
    }
  });

  REPO_CARDS = Array.from(mergedVocabMap.values());
  REPO_EXERCISES = Array.from(mergedExMap.values());

  await saveRepository();

  try {
    const savedProgress = localStorage.getItem(STORAGE_PROGRESS_KEY);
    if (savedProgress) state.progress = JSON.parse(savedProgress);
  } catch (e) {
    state.progress = {};
  }

  loadStreak();
}

async function saveRepository() {
  await idbSet(STORAGE_REPO_VOCAB_KEY, REPO_CARDS);
  await idbSet(STORAGE_REPO_EXERCISE_KEY, REPO_EXERCISES);
  try {
    localStorage.setItem(STORAGE_REPO_VOCAB_KEY, JSON.stringify(REPO_CARDS));
    localStorage.setItem(STORAGE_REPO_EXERCISE_KEY, JSON.stringify(REPO_EXERCISES));
  } catch (e) {}
}

function saveProgress() {
  try {
    localStorage.setItem(STORAGE_PROGRESS_KEY, JSON.stringify(state.progress));
  } catch (e) {}
}

function getTodayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function loadStreak() {
  try {
    const raw = localStorage.getItem(STORAGE_STREAK_KEY);
    if (raw) state.streak = JSON.parse(raw);
  } catch (e) {
    state.streak = { count: 0, lastDate: '' };
  }
  renderStreakBadge();
}

function markStudyActivityToday() {
  const today = getTodayStr();
  if (state.streak.lastDate === today) return;

  const yesterdayDate = new Date();
  yesterdayDate.setDate(yesterdayDate.getDate() - 1);
  const yesterday = `${yesterdayDate.getFullYear()}-${String(yesterdayDate.getMonth() + 1).padStart(2, '0')}-${String(yesterdayDate.getDate()).padStart(2, '0')}`;

  if (state.streak.lastDate === yesterday) {
    state.streak.count = (state.streak.count || 0) + 1;
  } else {
    state.streak.count = 1;
  }
  state.streak.lastDate = today;

  try {
    localStorage.setItem(STORAGE_STREAK_KEY, JSON.stringify(state.streak));
  } catch (e) {}
  renderStreakBadge();
}

function renderStreakBadge() {
  const el = document.getElementById('streak-pill');
  if (el) el.textContent = `🔥 ${state.streak.count || 0}`;
}

/**
 * =========================================================================
 * 6. KIỂM TRA TRÙNG LẶP RIÊNG BIỆT CHO CẢ 2 KHO
 * =========================================================================
 */
function findRepositoryDuplicates() {
  const groups = new Map();

  REPO_CARDS.forEach((card, index) => {
    const key = `V__${getCardUniqueKey(card)}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push({ kind: 'vocab', item: card, index });
  });

  REPO_EXERCISES.forEach((ex, index) => {
    const key = getExerciseUniqueKey(ex);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push({ kind: 'exercise', item: ex, index });
  });

  const duplicateGroups = [];
  groups.forEach((entries, key) => {
    if (entries.length > 1) {
      duplicateGroups.push({ key, entries });
    }
  });
  return duplicateGroups;
}

function updateRepoDuplicateBanner() {
  const lineEl = document.getElementById('repo-dup-line');
  const statusTextEl = document.getElementById('repo-dup-status-text');
  const dotEl = document.getElementById('drawer-dup-dot');
  if (!lineEl || !statusTextEl) return;

  const groups = findRepositoryDuplicates();
  if (groups.length === 0) {
    lineEl.classList.remove('has-dup');
    statusTextEl.textContent = '✓ Cả 2 kho đều sạch, không trùng';
    if (dotEl) dotEl.style.display = 'none';
  } else {
    const extraCount = groups.reduce((sum, g) => sum + (g.entries.length - 1), 0);
    lineEl.classList.add('has-dup');
    statusTextEl.textContent = `⚠️ ${groups.length} mục trùng (${extraCount} thừa)`;
    if (dotEl) dotEl.style.display = 'block';
  }
}

function openDuplicateCheckerModal() {
  const modal = document.getElementById('dup-modal');
  const body = document.getElementById('repo-dup-modal-body');
  const dedupeBtn = document.getElementById('dedupe-repo-btn');
  const groups = findRepositoryDuplicates();

  if (groups.length === 0) {
    dedupeBtn.style.display = 'none';
    body.innerHTML = `
      <div class="dup-check-box clean">
        <strong>✓ Cả 2 kho Từ vựng (${REPO_CARDS.length}) & Bài tập (${REPO_EXERCISES.length}) đều sạch!</strong>
        <span>Không phát hiện mục nào bị trùng lặp.</span>
      </div>
    `;
  } else {
    const extraCount = groups.reduce((sum, g) => sum + (g.entries.length - 1), 0);
    dedupeBtn.style.display = 'block';
    dedupeBtn.textContent = `Dọn sạch ${extraCount} bản trùng thừa`;

    body.innerHTML = groups.map(g => {
      const first = g.entries[0].item;
      const title = first.prompt_jp || (first.kanji ? `${first.kanji} (${first.jp})` : first.jp);
      return `
        <div class="dup-item-row">
          <div>
            <strong>${escapeHtml(title)}</strong>
            <div class="text-muted">${escapeHtml(first.vi || first.prompt_vi || '')}</div>
          </div>
          <span class="badge review">Lặp ${g.entries.length} lần</span>
        </div>
      `;
    }).join('');
  }

  modal.style.display = 'flex';
}

function closeDuplicateCheckerModal() {
  document.getElementById('dup-modal').style.display = 'none';
}

async function deduplicateRepository() {
  const seenVocab = new Map();
  REPO_CARDS.forEach(c => seenVocab.set(getCardUniqueKey(c), c));
  REPO_CARDS = Array.from(seenVocab.values());

  const seenEx = new Map();
  REPO_EXERCISES.forEach(ex => seenEx.set(getExerciseUniqueKey(ex), ex));
  REPO_EXERCISES = Array.from(seenEx.values());

  await saveRepository();
  closeDuplicateCheckerModal();
  refreshUI();
  showToast('✓ Đã dọn sạch toàn bộ mục trùng trong 2 kho!');
}

function runLiveDuplicateCheck(showToastMsg = false) {
  const rawJson = document.getElementById('import-json-text').value.trim();
  const defaultLevel = document.getElementById('import-default-level').value;
  const defaultTopic = document.getElementById('import-default-topic').value.trim() || 'Tổng hợp';

  const boxEl = document.getElementById('import-dup-check-box');
  const summaryEl = document.getElementById('import-dup-summary');
  const listEl = document.getElementById('import-dup-list');
  const policyRow = document.getElementById('import-dup-policy-row');
  const errorEl = document.getElementById('import-error-msg');

  errorEl.style.display = 'none';

  if (!rawJson) {
    boxEl.className = 'dup-check-box neutral';
    summaryEl.textContent = '🔍 Dán JSON hoặc chọn tệp để tự động phân luồng Từ vựng / Bài tập.';
    listEl.style.display = 'none';
    policyRow.style.display = 'none';
    return;
  }

  let parsed;
  try {
    parsed = parseMultiJsonBlocks(rawJson);
  } catch (e) {
    boxEl.className = 'dup-check-box warn';
    summaryEl.textContent = '⚠️ JSON chưa hợp lệ — hãy kiểm tra dấu phẩy hoặc dấu ngoặc vuông [...].';
    listEl.style.display = 'none';
    policyRow.style.display = 'none';
    return;
  }

  const repoVocabMap = new Map();
  REPO_CARDS.forEach(c => repoVocabMap.set(getCardUniqueKey(c), c));
  const repoExMap = new Map();
  REPO_EXERCISES.forEach(s => repoExMap.set(getExerciseUniqueKey(s), s));

  const seenInBatch = new Set();
  const dupWithRepo = [];
  const dupInBatch = [];
  let newVocabCount = 0;
  let newExCount = 0;

  parsed.forEach(raw => {
    if (!raw || typeof raw !== 'object') return;
    if (isExerciseEntry(raw)) {
      const ex = normalizeExerciseItem(raw, defaultLevel, defaultTopic);
      if (!ex.jp && !ex.prompt_jp) return;
      const key = getExerciseUniqueKey(ex);
      if (seenInBatch.has(key)) {
        dupInBatch.push({ title: ex.prompt_jp || ex.jp, sub: 'Bài tập trùng trong JSON' });
      } else {
        seenInBatch.add(key);
        if (repoExMap.has(key)) {
          dupWithRepo.push({ title: ex.prompt_jp || ex.jp, sub: `Đã có (${ex.kind})` });
        } else {
          newExCount++;
        }
      }
    } else if (raw.jp && raw.vi) {
      const card = normalizeCardItem(raw, defaultLevel, defaultTopic);
      const key = getCardUniqueKey(card);
      if (seenInBatch.has(key)) {
        dupInBatch.push({ title: card.kanji ? `${card.kanji} (${card.jp})` : card.jp, sub: 'Từ vựng trùng trong JSON' });
      } else {
        seenInBatch.add(key);
        if (repoVocabMap.has(key)) {
          dupWithRepo.push({ title: card.kanji ? `${card.kanji} (${card.jp})` : card.jp, sub: 'Đã có trong vocab_data' });
        } else {
          newVocabCount++;
        }
      }
    }
  });

  if (dupWithRepo.length === 0 && dupInBatch.length === 0) {
    boxEl.className = 'dup-check-box clean';
    summaryEl.textContent = `✓ Sẵn sàng nạp: +${newVocabCount} từ vựng & +${newExCount} bài tập mới (0 trùng)!`;
    listEl.style.display = 'none';
    policyRow.style.display = 'none';
  } else {
    boxEl.className = 'dup-check-box warn';
    summaryEl.textContent = `⚠️ Phát hiện ${dupWithRepo.length} mục đã có & ${dupInBatch.length} mục lặp • Mới: +${newVocabCount} từ, +${newExCount} bài tập.`;
    const preview = [...dupWithRepo, ...dupInBatch].slice(0, 20);
    listEl.innerHTML = preview.map(d => `
      <div class="dup-item-row">
        <strong>${escapeHtml(d.title)}</strong>
        <span class="text-muted">${escapeHtml(d.sub)}</span>
      </div>
    `).join('');
    listEl.style.display = 'flex';
    policyRow.style.display = dupWithRepo.length > 0 ? 'flex' : 'none';
  }

  if (showToastMsg) {
    showToast(`Kiểm tra xong: +${newVocabCount} từ, +${newExCount} bài tập`);
  }
}

function handleImportFileUpload(event) {
  const file = event.target.files && event.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (e) => {
    document.getElementById('import-json-text').value = String(e.target.result || '');
    runLiveDuplicateCheck();
    showToast(`📂 Đã đọc tệp ${file.name}`);
  };
  reader.readAsText(file, 'UTF-8');
}

/**
 * =========================================================================
 * 7. HỆ THỐNG ÂM THANH TIẾNG NHẬT 2 TẦNG (IPHONE SAFARI & GITHUB PAGES)
 * =========================================================================
 */
let jpVoice = null;
let currentAudioObj = null;
let speechRequestId = 0;
let audioUnlocked = false;
const ttsBlobCache = new Map();

function unlockiOSAudio() {
  if (audioUnlocked) return;
  audioUnlocked = true;
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (AudioCtx) {
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      gain.gain.value = 0.0001;
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(0);
      osc.stop(0.01);
    }
  } catch (e) {}
}

document.addEventListener('touchstart', unlockiOSAudio, { once: true, passive: true });
document.addEventListener('click', unlockiOSAudio, { once: true, passive: true });

function loadJapaneseVoices() {
  if (!('speechSynthesis' in window)) return;
  const voices = window.speechSynthesis.getVoices();
  if (!voices || voices.length === 0) return;

  const jaVoices = voices.filter(v => {
    const lang = (v.lang || '').toLowerCase();
    return lang.includes('ja') || lang.includes('jp');
  });

  if (jaVoices.length > 0) {
    const priorityNames = ['Siri', 'Kyoko', 'O-Ren', 'Nanami', 'Haruka', 'Google 日本語', 'Enhanced', 'Premium'];
    let best = null;
    for (const name of priorityNames) {
      best = jaVoices.find(v => v.name && v.name.includes(name));
      if (best) break;
    }
    jpVoice = best || jaVoices.find(v => v.localService) || jaVoices[0];
  }
}

if ('speechSynthesis' in window) {
  loadJapaneseVoices();
  window.speechSynthesis.onvoiceschanged = loadJapaneseVoices;
}

function setSpeakingIndicator(active) {
  document.querySelectorAll('.audio-btn, .quiz-audio-mini, .duo-speaker-btn, .dict-play-btn').forEach(btn => {
    btn.classList.toggle('speaking', active);
  });
}

function stopSpeech() {
  speechRequestId += 1;
  if (currentAudioObj) {
    try {
      currentAudioObj.pause();
      currentAudioObj.src = '';
    } catch (e) {}
    currentAudioObj = null;
  }
  if ('speechSynthesis' in window) {
    try {
      window.speechSynthesis.cancel();
    } catch (e) {}
  }
  setSpeakingIndicator(false);
}

function normalizeTextForSpeech(rawText) {
  let clean = String(rawText || '')
    .replace(/\([^)]*\)/g, '')
    .replace(/（[^）]*）/g, '')
    .replace(/\[[^\]]*\]/g, '')
    .replace(/[〜～~]/g, '')
    .trim();
  if (!clean) return '';
  if (!/[。！？.!?,、]$/.test(clean)) {
    clean += '。';
  }
  return clean;
}

function speakViaNativeWebSpeech(cleanText, isSlow, reqId) {
  if (!('speechSynthesis' in window)) {
    setSpeakingIndicator(false);
    return;
  }
  try {
    window.speechSynthesis.cancel();
    if (window.speechSynthesis.paused) window.speechSynthesis.resume();

    if (!jpVoice) loadJapaneseVoices();

    const utter = new SpeechSynthesisUtterance(cleanText);
    utter.lang = 'ja-JP';
    if (jpVoice) utter.voice = jpVoice;
    utter.rate = isSlow ? 0.68 : 0.92;
    utter.pitch = 1.0;

    utter.onstart = () => {
      if (reqId === speechRequestId) setSpeakingIndicator(true);
    };
    utter.onend = () => {
      if (reqId === speechRequestId) setSpeakingIndicator(false);
    };
    utter.onerror = () => {
      if (reqId === speechRequestId) setSpeakingIndicator(false);
    };

    window.speechSynthesis.speak(utter);
  } catch (e) {
    setSpeakingIndicator(false);
  }
}

function playCachedOrRemoteStream(url, cacheKey, isSlow, reqId, fallbackFn) {
  const audio = new Audio();
  audio.preload = 'auto';
  audio.playsInline = true;
  audio.playbackRate = isSlow ? 0.76 : 1.0;

  if ('preservesPitch' in audio) audio.preservesPitch = true;
  else if ('webkitPreservesPitch' in audio) audio.webkitPreservesPitch = true;

  currentAudioObj = audio;

  let settled = false;
  const fallbackTimer = setTimeout(() => {
    if (!settled && reqId === speechRequestId) {
      settled = true;
      fallbackFn();
    }
  }, 1600);

  audio.onplaying = () => {
    settled = true;
    clearTimeout(fallbackTimer);
    if (reqId === speechRequestId) setSpeakingIndicator(true);
  };

  audio.onended = () => {
    clearTimeout(fallbackTimer);
    if (reqId === speechRequestId) setSpeakingIndicator(false);
  };

  audio.onerror = () => {
    clearTimeout(fallbackTimer);
    if (!settled && reqId === speechRequestId) {
      settled = true;
      fallbackFn();
    }
  };

  audio.src = url;
  const playPromise = audio.play();
  if (playPromise !== undefined) {
    playPromise.catch(() => {
      clearTimeout(fallbackTimer);
      if (!settled && reqId === speechRequestId) {
        settled = true;
        fallbackFn();
      }
    });
  }
}

function speakJapanese(rawText, forceSlow = null) {
  const cleanText = normalizeTextForSpeech(rawText);
  if (!cleanText) return;

  stopSpeech();
  const reqId = speechRequestId;
  const isSlow = forceSlow !== null ? forceSlow : (state.voiceMode === 'slow');
  setSpeakingIndicator(true);

  const cacheKey = `${cleanText}_${isSlow ? 'slow' : 'norm'}`;
  if (ttsBlobCache.has(cacheKey)) {
    playCachedOrRemoteStream(
      ttsBlobCache.get(cacheKey),
      cacheKey,
      isSlow,
      reqId,
      () => speakViaNativeWebSpeech(cleanText, isSlow, reqId)
    );
    return;
  }

  const speedParam = isSlow ? '0.35' : '0.9';
  const streamUrl = `https://translate.googleapis.com/translate_tts?ie=UTF-8&client=tw-ob&tl=ja&ttsspeed=${speedParam}&q=${encodeURIComponent(cleanText)}`;

  fetch(streamUrl, { referrerPolicy: 'no-referrer' })
    .then(res => {
      if (!res.ok) throw new Error('TTS stream blocked');
      return res.blob();
    })
    .then(blob => {
      const blobUrl = URL.createObjectURL(blob);
      ttsBlobCache.set(cacheKey, blobUrl);
      if (reqId === speechRequestId) {
        playCachedOrRemoteStream(
          blobUrl,
          cacheKey,
          isSlow,
          reqId,
          () => speakViaNativeWebSpeech(cleanText, isSlow, reqId)
        );
      }
    })
    .catch(() => {
      if (reqId === speechRequestId) {
        playCachedOrRemoteStream(
          streamUrl,
          cacheKey,
          isSlow,
          reqId,
          () => speakViaNativeWebSpeech(cleanText, isSlow, reqId)
        );
      }
    });
}

function playFeedbackTone(isCorrect) {
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);

    const now = ctx.currentTime;
    if (isCorrect) {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(523.25, now);
      osc.frequency.setValueAtTime(659.25, now + 0.09);
      gain.gain.setValueAtTime(0.1, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.26);
      osc.start(now);
      osc.stop(now + 0.26);
    } else {
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(220, now);
      osc.frequency.setValueAtTime(175, now + 0.12);
      gain.gain.setValueAtTime(0.12, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.28);
      osc.start(now);
      osc.stop(now + 0.28);
    }
  } catch (e) {}
}

function toggleSpeechRate() {
  state.voiceMode = state.voiceMode === 'normal' ? 'slow' : 'normal';
  const btn = document.getElementById('speech-rate-btn');
  if (btn) btn.textContent = state.voiceMode === 'normal' ? '🔊 Đọc: Chuẩn' : '🐢 Đọc: Chậm';
  showToast(state.voiceMode === 'normal' ? 'Tốc độ đọc chuẩn' : 'Tốc độ đọc chậm rõ âm');

  if (state.mode === 'exercise') speakCurrentExercise();
  else if (state.mode === 'dictation') speakDictationCard(false);
  else if (state.mode === 'kana') speakSelectedKana();
  else speakCurrentCard();
}

function speakCurrentCard() {
  const cards = getActiveSessionCards();
  const card = cards[state.currentIndex];
  if (!card) return;
  speakJapanese(card.jp);
}

/**
 * =========================================================================
 * 8. ĐIỀU KHIỂN MENU 3 GẠCH (DRAWER), LỘ TRÌNH & BỘ LỌC
 * =========================================================================
 */
function openDrawerMenu() {
  const drawer = document.getElementById('nav-drawer-backdrop');
  if (drawer) drawer.style.display = 'flex';
}

function closeDrawerMenu() {
  const drawer = document.getElementById('nav-drawer-backdrop');
  if (drawer) drawer.style.display = 'none';
}

function setStudyFocus(focus) {
  state.studyFocus = focus === 'vocab_only' ? 'vocab_only' : 'guided';

  document.getElementById('focus-guided-btn').classList.toggle('active', state.studyFocus === 'guided');
  document.getElementById('focus-vocab-btn').classList.toggle('active', state.studyFocus === 'vocab_only');

  const stripFocusBtn = document.getElementById('strip-focus-btn');
  if (stripFocusBtn) {
    stripFocusBtn.textContent = state.studyFocus === 'guided' ? '🛤️ Lộ trình' : '📚 Chỉ Từ Vựng';
    stripFocusBtn.classList.toggle('active-chip', state.studyFocus === 'guided');
  }

  if (state.studyFocus === 'vocab_only' && state.mode === 'exercise') {
    setMode('flashcard');
    return;
  }

  if (state.studyFocus === 'guided' && state.mode === 'kana') {
    state.guidedStepIndex = 0;
    setMode('flashcard');
    return;
  }

  updateGuidedPathUI();
  showToast(state.studyFocus === 'guided' ? 'Chế độ: Học theo lộ trình 4 chặng' : 'Chế độ: Chỉ tập trung học Từ vựng');
}

function toggleStudyFocusQuick() {
  setStudyFocus(state.studyFocus === 'guided' ? 'vocab_only' : 'guided');
}

function updateGuidedPathUI() {
  const bar = document.getElementById('guided-path-bar');
  if (!bar) return;

  const hasData = (REPO_CARDS.length + REPO_EXERCISES.length) > 0;
  const shouldShow = hasData && state.studyFocus === 'guided' && state.mode !== 'kana';
  bar.style.display = shouldShow ? 'flex' : 'none';

  if (!shouldShow) return;

  const stepIdx = GUIDED_STEP_MODES.indexOf(state.mode);
  if (stepIdx !== -1) state.guidedStepIndex = stepIdx;

  document.querySelectorAll('.guided-step-pill').forEach(pill => {
    const s = Number(pill.getAttribute('data-step'));
    pill.classList.toggle('active', s === state.guidedStepIndex);
  });
}

function jumpGuidedStep(stepIdx) {
  state.guidedStepIndex = stepIdx;
  const targetMode = GUIDED_STEP_MODES[stepIdx] || 'flashcard';
  setMode(targetMode);
}

function advanceGuidedStep() {
  const nextStep = (state.guidedStepIndex + 1) % GUIDED_STEP_MODES.length;
  jumpGuidedStep(nextStep);
}

function getCardsByLevel(level) {
  if (level === 'ALL') return [...REPO_CARDS];
  return REPO_CARDS.filter(c => c.level === level);
}

function getExercisesByLevel(level) {
  if (level === 'ALL') return [...REPO_EXERCISES];
  return REPO_EXERCISES.filter(s => s.level === level);
}

function getFilteredPoolCards() {
  let list = getCardsByLevel(state.selectedLevel);
  if (state.selectedTopic !== 'ALL') {
    list = list.filter(c => c.topic === state.selectedTopic);
  }
  if (state.filterUnmastered) {
    list = list.filter(c => state.progress[c.id] !== 'known');
  }
  return list;
}

function buildSmartFlashcardBatch() {
  const pool = getFilteredPoolCards();
  if (pool.length === 0) {
    state.sessionBatchIds = [];
    return;
  }

  const reviewList = pool.filter(c => state.progress[c.id] === 'review');
  const newList = pool.filter(c => !state.progress[c.id]);
  const knownList = pool.filter(c => state.progress[c.id] === 'known');

  const prioritized = [...reviewList, ...newList, ...knownList];
  state.sessionBatchIds = prioritized.slice(0, SESSION_BATCH_SIZE).map(c => c.id);
  state.currentIndex = 0;
  state.isFlipped = false;
}

function getActiveSessionCards() {
  const pool = getFilteredPoolCards();
  if (!state.sessionMode) return pool;

  const validBatch = state.sessionBatchIds
    .map(id => pool.find(c => c.id === id))
    .filter(Boolean);

  if (validBatch.length === 0 && pool.length > 0) {
    buildSmartFlashcardBatch();
    return state.sessionBatchIds.map(id => pool.find(c => c.id === id)).filter(Boolean);
  }
  return validBatch;
}

function toggleSessionScope() {
  state.sessionMode = !state.sessionMode;
  state.currentIndex = 0;
  state.isFlipped = false;
  if (state.sessionMode) buildSmartFlashcardBatch();
  renderFlashcard();
  showToast(state.sessionMode ? 'Chế độ Phiên ngắn 12 thẻ' : 'Chế độ Xem toàn bộ danh sách');
}

function startNextFlashcardBatch() {
  const pool = getFilteredPoolCards();
  if (pool.length === 0) return;

  const currentSet = new Set(state.sessionBatchIds);
  const remaining = pool.filter(c => !currentSet.has(c.id));
  const nextSource = remaining.length > 0 ? remaining : pool;

  state.sessionBatchIds = nextSource.slice(0, SESSION_BATCH_SIZE).map(c => c.id);
  state.currentIndex = 0;
  state.isFlipped = false;
  document.getElementById('session-complete-box').style.display = 'none';
  renderFlashcard();
}

function toggleFuriganaVisibility() {
  state.hideFurigana = !state.hideFurigana;
  const btn = document.getElementById('toggle-furigana-btn');
  const quickBtn = document.getElementById('quick-furi-btn');
  if (btn) {
    btn.classList.toggle('furi-hidden', state.hideFurigana);
    btn.textContent = state.hideFurigana ? '🙈 Đang ẩn Furi' : '👁️ Furigana';
  }
  if (quickBtn) {
    quickBtn.classList.toggle('active-chip', state.hideFurigana);
    quickBtn.textContent = state.hideFurigana ? '🙈 Ẩn Furi' : '👁️ Furi';
  }
  showToast(state.hideFurigana ? 'Đã ẩn Furigana: Luyện nhìn mặt chữ Kanji!' : 'Đã hiện Furigana trên Kanji');
  if (state.mode === 'flashcard') renderFlashcard();
  else if (state.mode === 'match') renderMatchBoard();
}

function selectLevel(level) {
  stopSpeech();
  state.selectedLevel = level;
  state.selectedTopic = 'ALL';
  state.currentIndex = 0;
  state.isFlipped = false;

  document.querySelectorAll('.level-pill').forEach(btn => {
    btn.classList.toggle('active', btn.getAttribute('data-level') === level);
  });

  buildSmartFlashcardBatch();
  refreshUI();
}

function selectTopic(topic) {
  stopSpeech();
  state.selectedTopic = topic;
  state.currentIndex = 0;
  state.isFlipped = false;
  buildSmartFlashcardBatch();
  updateStatsHeader();
  populateTopicDropdown();
  launchActiveMode();
}

function toggleUnmasteredFilter() {
  stopSpeech();
  state.filterUnmastered = !state.filterUnmastered;
  state.currentIndex = 0;
  state.isFlipped = false;

  const btn = document.getElementById('filter-unmastered-btn');
  const dot = document.getElementById('filter-dot');
  if (btn) btn.classList.toggle('filter-active', state.filterUnmastered);
  if (dot) dot.classList.toggle('active', state.filterUnmastered);

  buildSmartFlashcardBatch();
  launchActiveMode();
}

function resetFilters() {
  state.filterUnmastered = false;
  state.selectedTopic = 'ALL';
  state.currentIndex = 0;
  state.isFlipped = false;

  const btn = document.getElementById('filter-unmastered-btn');
  const dot = document.getElementById('filter-dot');
  if (btn) btn.classList.remove('filter-active');
  if (dot) dot.classList.remove('active');
  document.getElementById('topic-select').value = 'ALL';

  buildSmartFlashcardBatch();
  refreshUI();
}

function shuffleCurrentCards() {
  stopSpeech();
  for (let i = REPO_CARDS.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [REPO_CARDS[i], REPO_CARDS[j]] = [REPO_CARDS[j], REPO_CARDS[i]];
  }
  state.currentIndex = 0;
  state.isFlipped = false;
  buildSmartFlashcardBatch();
  launchActiveMode();
  showToast('↻ Đã xáo trộn thứ tự thẻ');
}

function launchActiveMode() {
  if (state.mode === 'kana') renderKanaModule();
  else if (state.mode === 'flashcard') renderFlashcard();
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
function updateHeaderContextBadge() {
  const modeNames = {
    flashcard: 'Lật Thẻ 3D',
    quiz: 'Trắc Nghiệm',
    dictation: 'Nghe & Gõ',
    exercise: 'Bài Tập Ngữ Cảnh',
    match: 'Ghép Đôi',
    drill: 'Kanji & Chia Thể',
    kana: 'Bảng Chữ Cái'
  };
  const lvlText = state.mode === 'kana'
    ? (state.kana.script === 'hiragana' ? 'Hiragana' : 'Katakana')
    : (state.selectedLevel === 'ALL' ? 'N5–N3' : state.selectedLevel);

  const badgeEl = document.getElementById('active-context-badge');
  if (badgeEl) {
    badgeEl.textContent = `${lvlText} • ${modeNames[state.mode] || 'Lật Thẻ 3D'}`;
  }
}

function refreshUI() {
  const totalCount = REPO_CARDS.length + REPO_EXERCISES.length;
  const hasData = totalCount > 0;
  const isKanaMode = state.mode === 'kana';

  const countAll = totalCount;
  const countN5 = REPO_CARDS.filter(c => c.level === 'N5').length + REPO_EXERCISES.filter(s => s.level === 'N5').length;
  const countN4 = REPO_CARDS.filter(c => c.level === 'N4').length + REPO_EXERCISES.filter(s => s.level === 'N4').length;
  const countN3 = REPO_CARDS.filter(c => c.level === 'N3').length + REPO_EXERCISES.filter(s => s.level === 'N3').length;

  document.getElementById('count-ALL').textContent = countAll;
  document.getElementById('count-N5').textContent = countN5;
  document.getElementById('count-N4').textContent = countN4;
  document.getElementById('count-N3').textContent = countN3;

  document.getElementById('empty-app-state').style.display = (!hasData && !isKanaMode) ? 'flex' : 'none';
  document.getElementById('deck-stats-card').style.display = (hasData && !isKanaMode) ? 'flex' : 'none';
  document.getElementById('toolbar-section').style.display = (hasData && !isKanaMode) ? 'flex' : 'none';
  document.getElementById('export-menu-btn').style.display = hasData ? 'block' : 'none';
  document.getElementById('search-repo-btn').style.display = hasData ? 'inline-flex' : 'none';

  updateHeaderContextBadge();
  updateGuidedPathUI();

  const views = ['flashcard-view', 'quiz-view', 'dictation-view', 'exercise-view', 'match-view', 'drill-view', 'kana-view'];
  if (!hasData && !isKanaMode) {
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

  const stripTopicLabel = document.getElementById('strip-topic-label');
  if (stripTopicLabel) {
    stripTopicLabel.textContent = state.selectedTopic === 'ALL'
      ? `Tất cả chủ đề (${topics.length})`
      : state.selectedTopic;
  }
}

function updateStatsHeader() {
  const scopeCards = getCardsByLevel(state.selectedLevel);
  const scopeEx = getExercisesByLevel(state.selectedLevel);
  const totalVocab = scopeCards.length;
  const known = scopeCards.filter(c => state.progress[c.id] === 'known').length;
  const pct = totalVocab > 0 ? Math.round((known / totalVocab) * 100) : 0;

  const titleLabel = state.selectedLevel === 'ALL'
    ? 'Kho N5–N3'
    : `JLPT ${state.selectedLevel}`;

  document.getElementById('deck-title-display').textContent = titleLabel;
  document.getElementById('deck-known-count').textContent = `${known}/${totalVocab} thuộc`;
  document.getElementById('deck-total-count').textContent = `${totalVocab} từ vựng • ${scopeEx.length} bài tập`;
  document.getElementById('deck-progress-bar').style.width = `${pct}%`;
}

function setMode(newMode) {
  stopSpeech();
  closeDrawerMenu();
  state.mode = newMode;
  const modes = ['flashcard', 'quiz', 'dictation', 'exercise', 'match', 'drill', 'kana'];
  modes.forEach(m => {
    const btn = document.getElementById(`mode-${m}-btn`);
    if (btn) btn.classList.toggle('active', m === newMode);
  });
  refreshUI();
}

function renderFlashcard() {
  const pool = getFilteredPoolCards();
  const cards = getActiveSessionCards();
  const emptyFilterEl = document.getElementById('empty-filter-state');
  const sessionCompleteEl = document.getElementById('session-complete-box');
  const stageEl = document.getElementById('card-stage-wrapper');
  const controlsEl = document.getElementById('flashcard-controls');
  const posText = document.getElementById('card-position-text');
  const scopeBtn = document.getElementById('session-scope-btn');

  sessionCompleteEl.style.display = 'none';
  scopeBtn.textContent = state.sessionMode
    ? `Phiên ${cards.length}/${pool.length} thẻ ▾`
    : `Toàn bộ ${pool.length} thẻ ▾`;

  if (cards.length === 0) {
    emptyFilterEl.style.display = 'flex';
    stageEl.style.display = 'none';
    controlsEl.style.display = 'none';
    posText.textContent = '0 / 0';
    return;
  }

  emptyFilterEl.style.display = 'none';
  stageEl.style.display = 'flex';
  controlsEl.style.display = 'grid';

  if (state.currentIndex >= cards.length) state.currentIndex = 0;
  if (state.currentIndex < 0) state.currentIndex = cards.length - 1;

  const card = cards[state.currentIndex];
  const innerEl = document.getElementById('flashcard-inner');
  innerEl.classList.toggle('is-flipped', state.isFlipped);

  posText.textContent = `Thẻ ${state.currentIndex + 1} / ${cards.length}`;

  const lvlClass = `level-tag ${card.level.toLowerCase()}`;
  const frontLvl = document.getElementById('front-level-badge');
  const backLvl = document.getElementById('back-level-tag');
  frontLvl.className = lvlClass;
  frontLvl.textContent = card.level;
  backLvl.className = lvlClass;
  backLvl.textContent = card.level;

  const cat = detectWordCategory(card);
  document.getElementById('front-pos-badge').textContent = cat.label;

  const statusBadge = document.getElementById('front-status-badge');
  const st = state.progress[card.id];
  if (st === 'known') {
    statusBadge.textContent = '✓ Đã thuộc';
    statusBadge.className = 'badge known';
  } else if (st === 'review') {
    statusBadge.textContent = '↻ Cần ôn';
    statusBadge.className = 'badge review';
  } else {
    statusBadge.textContent = 'Mới';
    statusBadge.className = 'badge';
  }

  const furiEl = document.getElementById('front-kanji-furigana');
  const mainJpEl = document.getElementById('front-jp-text');
  const hintEl = document.getElementById('front-bottom-hint');

  if (card.kanji) {
    mainJpEl.textContent = card.kanji;
    if (state.hideFurigana) {
      furiEl.style.display = 'none';
      hintEl.textContent = '🙈 Đang ẩn Furigana • Chạm lật thẻ để kiểm tra cách đọc';
    } else {
      furiEl.textContent = card.jp;
      furiEl.style.display = 'block';
      hintEl.textContent = '↻ Chạm để xem Romaji, Nghĩa & Chiết tự Kanji';
    }
  } else {
    furiEl.style.display = 'none';
    mainJpEl.textContent = card.jp;
    hintEl.textContent = '↻ Chạm để xem Romaji, Nghĩa & Chiết tự Kanji';
  }

  document.getElementById('front-sub-tag').textContent = card.topic;
  document.getElementById('back-jp-mini').textContent = card.kanji
    ? `${card.kanji} (${card.jp})`
    : card.jp;
  document.getElementById('back-romaji-pill').textContent = card.romaji;
  document.getElementById('back-romaji-main').textContent = `/${card.romaji}/`;
  document.getElementById('back-meaning-vi').textContent = card.vi;

  const { mainTip, bridgeTip } = parseMnemonicAndBridge(card.mnemonic);
  document.getElementById('back-mnemonic-text').textContent = mainTip;

  const bridgeBox = document.getElementById('back-bridge-box');
  const bridgeText = document.getElementById('back-bridge-text');
  if (bridgeTip) {
    bridgeBox.style.display = 'block';
    bridgeText.textContent = bridgeTip;
  } else {
    bridgeBox.style.display = 'none';
  }
}

function flipCard() {
  const cards = getActiveSessionCards();
  if (cards.length === 0) return;
  state.isFlipped = !state.isFlipped;
  document.getElementById('flashcard-inner').classList.toggle('is-flipped', state.isFlipped);
  if (state.isFlipped) speakCurrentCard();
}

function nextCard() {
  stopSpeech();
  const cards = getActiveSessionCards();
  if (cards.length === 0) return;

  if (state.sessionMode && state.currentIndex === cards.length - 1) {
    document.getElementById('card-stage-wrapper').style.display = 'none';
    document.getElementById('flashcard-controls').style.display = 'none';
    document.getElementById('session-complete-box').style.display = 'flex';
    markStudyActivityToday();
    return;
  }

  state.isFlipped = false;
  state.currentIndex = (state.currentIndex + 1) % cards.length;
  renderFlashcard();
}

function prevCard() {
  stopSpeech();
  const cards = getActiveSessionCards();
  if (cards.length === 0) return;
  state.isFlipped = false;
  state.currentIndex = (state.currentIndex - 1 + cards.length) % cards.length;
  renderFlashcard();
}

function rateCurrentCard(rating) {
  const cards = getActiveSessionCards();
  if (cards.length === 0) return;
  const card = cards[state.currentIndex];
  state.progress[card.id] = rating;
  saveProgress();
  markStudyActivityToday();
  updateStatsHeader();
  nextCard();
}

/**
 * =========================================================================
 * 10. CHẾ ĐỘ 2: TRẮC NGHIỆM ĐA CHIỀU
 * =========================================================================
 */
function startQuiz(onlyWrong = false) {
  stopSpeech();
  let source = onlyWrong && state.quiz.wrongCards.length > 0
    ? [...state.quiz.wrongCards]
    : getFilteredPoolCards();

  if (source.length === 0) source = [...REPO_CARDS];
  if (source.length === 0) return;

  const reviewOnes = source.filter(c => state.progress[c.id] === 'review');
  const others = source.filter(c => state.progress[c.id] !== 'review');
  for (let i = others.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [others[i], others[j]] = [others[j], others[i]];
  }

  const combined = [...reviewOnes, ...others].slice(0, 10);
  const questionModes = ['JP_TO_VI', 'KANJI_TO_HIRA', 'VI_TO_JP', 'AUDIO_TO_VI'];

  state.quiz.questions = combined.map((card, idx) => {
    let qMode = questionModes[idx % questionModes.length];
    if (qMode === 'KANJI_TO_HIRA' && !card.kanji) qMode = 'JP_TO_VI';
    return { card, qMode };
  });

  state.quiz.currentIndex = 0;
  state.quiz.score = 0;
  state.quiz.wrongCards = [];
  state.quiz.answered = false;

  document.getElementById('quiz-active-box').style.display = 'flex';
  document.getElementById('quiz-summary-box').style.display = 'none';
  renderQuizQuestion();
}

function speakQuizCard() {
  const item = state.quiz.questions[state.quiz.currentIndex];
  if (!item) return;
  speakJapanese(item.card.jp);
}

function renderQuizQuestion() {
  const q = state.quiz;
  if (q.currentIndex >= q.questions.length) {
    showQuizSummary();
    return;
  }

  q.answered = false;
  const { card: current, qMode } = q.questions[q.currentIndex];

  document.getElementById('quiz-question-num').textContent = `Câu ${q.currentIndex + 1} / ${q.questions.length}`;
  document.getElementById('quiz-score-badge').textContent = `Điểm: ${q.score}`;

  const qLvl = document.getElementById('quiz-card-level');
  qLvl.className = `level-tag ${current.level.toLowerCase()} quiz-lvl`;
  qLvl.textContent = current.level;

  const typeBadge = document.getElementById('quiz-type-badge');
  const instructionEl = document.getElementById('quiz-instruction-text');
  const promptEl = document.getElementById('quiz-jp-prompt');
  const bigListenBtn = document.getElementById('quiz-big-listen-btn');
  const hintEl = document.getElementById('quiz-romaji-hint');

  hintEl.style.display = 'none';
  document.getElementById('quiz-feedback-box').style.display = 'none';

  const sameTagPool = REPO_CARDS.filter(c => c.id !== current.id && c.tag && c.tag === current.tag);
  const fallbackPool = REPO_CARDS.filter(c => c.id !== current.id);
  const distractorSource = sameTagPool.length >= 3 ? sameTagPool : fallbackPool;

  for (let i = distractorSource.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [distractorSource[i], distractorSource[j]] = [distractorSource[j], distractorSource[i]];
  }

  const distractors = distractorSource.slice(0, 3);
  const options = [current, ...distractors];
  for (let i = options.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [options[i], options[j]] = [options[j], options[i]];
  }

  if (qMode === 'KANJI_TO_HIRA') {
    typeBadge.textContent = 'Đọc Kanji';
    instructionEl.textContent = 'Chọn cách đọc Hiragana đúng cho chữ Kanji:';
    promptEl.style.display = 'block';
    bigListenBtn.style.display = 'none';
    promptEl.textContent = current.kanji;
    hintEl.textContent = `/${current.romaji}/ — ${current.vi}`;
  } else if (qMode === 'VI_TO_JP') {
    typeBadge.textContent = 'Việt → Nhật';
    instructionEl.textContent = 'Chọn từ tiếng Nhật tương ứng với nghĩa:';
    promptEl.style.display = 'block';
    bigListenBtn.style.display = 'none';
    promptEl.textContent = current.vi;
    hintEl.textContent = `${current.kanji || current.jp} (/${current.romaji}/)`;
  } else if (qMode === 'AUDIO_TO_VI') {
    typeBadge.textContent = '🎧 Nghe hiểu';
    instructionEl.textContent = 'Nghe âm thanh và chọn nghĩa tiếng Việt đúng:';
    promptEl.style.display = 'none';
    bigListenBtn.style.display = 'inline-flex';
    hintEl.textContent = `${current.kanji ? `${current.kanji} (${current.jp})` : current.jp} — /${current.romaji}/`;
    setTimeout(() => speakJapanese(current.jp), 120);
  } else {
    typeBadge.textContent = 'Nhật → Việt';
    instructionEl.textContent = 'Chọn nghĩa tiếng Việt đúng:';
    promptEl.style.display = 'block';
    bigListenBtn.style.display = 'none';
    promptEl.textContent = state.hideFurigana && current.kanji
      ? current.kanji
      : (current.kanji ? `${current.kanji} (${current.jp})` : current.jp);
    hintEl.textContent = `${current.jp} • /${current.romaji}/`;
  }

  const letters = ['A', 'B', 'C', 'D'];
  const listEl = document.getElementById('quiz-options-list');
  listEl.innerHTML = options.map((opt, idx) => {
    let label = opt.vi;
    if (qMode === 'KANJI_TO_HIRA') label = `${opt.jp} (/${opt.romaji}/)`;
    else if (qMode === 'VI_TO_JP') label = opt.kanji ? `${opt.kanji} (${opt.jp})` : opt.jp;

    return `
      <button
        type="button"
        class="quiz-opt-btn"
        data-id="${opt.id}"
        onclick="handleQuizAnswer(this, '${opt.id}', '${current.id}')"
      >
        <span class="opt-letter">${letters[idx]}</span>
        <span>${escapeHtml(label)}</span>
      </button>
    `;
  }).join('');
}

function handleQuizAnswer(btnEl, selectedId, correctId) {
  const q = state.quiz;
  if (q.answered) return;
  q.answered = true;

  const { card: current } = q.questions[q.currentIndex];
  const isCorrect = selectedId === correctId;
  speakJapanese(current.jp);

  document.querySelectorAll('#quiz-options-list .quiz-opt-btn').forEach(btn => {
    btn.disabled = true;
    const id = btn.getAttribute('data-id');
    if (id === correctId) btn.classList.add('correct');
    else if (btn === btnEl && !isCorrect) btn.classList.add('wrong');
  });

  if (isCorrect) {
    q.score += 1;
    state.progress[current.id] = 'known';
    playFeedbackTone(true);
  } else {
    q.wrongCards.push(current);
    state.progress[current.id] = 'review';
    playFeedbackTone(false);
  }

  saveProgress();
  markStudyActivityToday();
  updateStatsHeader();

  document.getElementById('quiz-score-badge').textContent = `Điểm: ${q.score}`;
  document.getElementById('quiz-romaji-hint').style.display = 'block';
  document.getElementById('quiz-feedback-mnemonic').textContent = `💡 ${current.mnemonic}`;
  document.getElementById('quiz-feedback-box').style.display = 'flex';
}

function nextQuizQuestion() {
  stopSpeech();
  state.quiz.currentIndex += 1;
  renderQuizQuestion();
}

function showQuizSummary() {
  const q = state.quiz;
  document.getElementById('quiz-active-box').style.display = 'none';
  document.getElementById('quiz-summary-box').style.display = 'flex';
  document.getElementById('quiz-final-score-text').textContent = `Đúng ${q.score} / ${q.questions.length} câu`;

  const retryBtn = document.getElementById('retry-wrong-btn');
  if (q.wrongCards.length > 0) {
    retryBtn.style.display = 'block';
    retryBtn.textContent = `Ôn lại ${q.wrongCards.length} từ làm sai`;
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
  stopSpeech();
  let pool = getFilteredPoolCards();
  if (pool.length === 0) pool = [...REPO_CARDS];
  if (pool.length === 0) return;

  const shuffled = [...pool];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }

  state.dictation.questions = shuffled.slice(0, 10);
  state.dictation.currentIndex = 0;
  state.dictation.score = 0;
  state.dictation.answered = false;

  document.getElementById('dict-active-box').style.display = 'flex';
  document.getElementById('dict-summary-box').style.display = 'none';
  renderDictationQuestion();
}

function speakDictationCard(slow = false) {
  const card = state.dictation.questions[state.dictation.currentIndex];
  if (!card) return;
  speakJapanese(card.jp, slow);
}

function renderDictationQuestion() {
  const d = state.dictation;
  if (d.currentIndex >= d.questions.length) {
    document.getElementById('dict-active-box').style.display = 'none';
    document.getElementById('dict-summary-box').style.display = 'flex';
    document.getElementById('dict-final-score-text').textContent = `Đúng ${d.score} / ${d.questions.length} từ`;
    return;
  }

  d.answered = false;
  d.hintUsed = false;
  const card = d.questions[d.currentIndex];

  document.getElementById('dict-step-text').textContent = `Câu ${d.currentIndex + 1}/${d.questions.length}`;
  document.getElementById('dict-score-badge').textContent = `Điểm: ${d.score}`;

  const lvlEl = document.getElementById('dict-level-tag');
  lvlEl.className = `level-tag ${card.level.toLowerCase()} quiz-lvl`;
  lvlEl.textContent = card.level;

  const hintEl = document.getElementById('dict-hint-line');
  hintEl.style.display = 'none';
  hintEl.textContent = '';

  const inputEl = document.getElementById('dict-answer-input');
  inputEl.value = '';
  inputEl.disabled = false;
  document.getElementById('dict-submit-btn').disabled = false;
  document.getElementById('dict-feedback-card').style.display = 'none';

  setTimeout(() => speakDictationCard(false), 120);
}

function revealDictationHint() {
  const d = state.dictation;
  const card = d.questions[d.currentIndex];
  if (!card) return;
  const hintEl = document.getElementById('dict-hint-line');
  hintEl.style.display = 'block';
  hintEl.textContent = `💡 Gợi ý: Nghĩa là "${card.vi}" • Bắt đầu bằng "${card.romaji.slice(0, 2)}..." (${card.jp.slice(0, 1)}...)`;
}

function normalizeRomajiCompare(str) {
  return String(str || '')
    .toLowerCase()
    .replace(/[\s\-'.~〜。、]/g, '')
    .replace(/ou/g, 'o')
    .replace(/uu/g, 'u')
    .replace(/oo/g, 'o')
    .replace(/sy/g, 'sh')
    .replace(/ty/g, 'ch')
    .replace(/tu/g, 'tsu')
    .replace(/ti/g, 'chi')
    .replace(/si/g, 'shi')
    .replace(/hu/g, 'fu');
}

function handleDictationEnter() {
  if (state.dictation.answered) nextDictationQuestion();
  else checkDictationAnswer();
}

function checkDictationAnswer() {
  const d = state.dictation;
  if (d.answered) return;

  const inputEl = document.getElementById('dict-answer-input');
  const userRaw = inputEl.value.trim();
  if (!userRaw) {
    showToast('Hãy gõ câu trả lời trước khi kiểm tra!');
    return;
  }

  d.answered = true;
  inputEl.disabled = true;
  document.getElementById('dict-submit-btn').disabled = true;

  const card = d.questions[d.currentIndex];
  const userNorm = normalizeRomajiCompare(userRaw);
  const romajiNorm = normalizeRomajiCompare(card.romaji);
  const jpNorm = normalizeKeyText(card.jp);
  const kjNorm = normalizeKeyText(card.kanji);

  const isCorrect =
    userNorm === romajiNorm ||
    normalizeKeyText(userRaw) === jpNorm ||
    (kjNorm && normalizeKeyText(userRaw) === kjNorm);

  const statusEl = document.getElementById('dict-fb-status');
  if (isCorrect) {
    d.score += 1;
    state.progress[card.id] = 'known';
    statusEl.textContent = '✓ Chính xác tuyệt đối!';
    statusEl.style.color = '#15803D';
    playFeedbackTone(true);
  } else {
    state.progress[card.id] = 'review';
    statusEl.textContent = `✕ Chưa khớp (Bạn gõ: "${userRaw}")`;
    statusEl.style.color = '#B91C1C';
    playFeedbackTone(false);
  }

  saveProgress();
  markStudyActivityToday();
  updateStatsHeader();

  document.getElementById('dict-score-badge').textContent = `Điểm: ${d.score}`;
  document.getElementById('dict-fb-word').textContent = card.kanji ? `${card.kanji} (${card.jp})` : card.jp;
  document.getElementById('dict-fb-meaning').textContent = `/${card.romaji}/ — ${card.vi}`;
  document.getElementById('dict-fb-mnemonic').textContent = `💡 ${card.mnemonic}`;
  document.getElementById('dict-feedback-card').style.display = 'flex';
  speakJapanese(card.jp);
}

function nextDictationQuestion() {
  stopSpeech();
  state.dictation.currentIndex += 1;
  renderDictationQuestion();
}

/**
 * =========================================================================
 * 12. CHẾ ĐỘ 4: BÀI TẬP NGỮ CẢNH CHUẨN XÁC (TỪ EXERCISE_DATA.JS)
 * =========================================================================
 */
function getPrioritizedExercises() {
  let pool = getExercisesByLevel(state.selectedLevel);
  if (state.selectedTopic !== 'ALL') {
    pool = pool.filter(ex => ex.topic === state.selectedTopic);
  }
  if (state.exercise.kindFilter !== 'ALL') {
    pool = pool.filter(ex => ex.kind === state.exercise.kindFilter);
  }

  const activeSessionVocab = getActiveSessionCards();
  const focusKeys = new Set();
  REPO_CARDS.forEach(c => {
    if (state.progress[c.id] === 'review') {
      focusKeys.add(normalizeKeyText(c.jp));
      if (c.kanji) focusKeys.add(normalizeKeyText(c.kanji));
    }
  });
  activeSessionVocab.forEach(c => {
    focusKeys.add(normalizeKeyText(c.jp));
    if (c.kanji) focusKeys.add(normalizeKeyText(c.kanji));
  });

  const priorityList = [];
  const normalList = [];

  pool.forEach(ex => {
    const exRefs = (ex.refs || []).map(r => normalizeKeyText(r));
    const isPriority = exRefs.some(r => focusKeys.has(r));
    if (isPriority) priorityList.push({ ...ex, _isPriority: true });
    else normalList.push({ ...ex, _isPriority: false });
  });

  return [...priorityList, ...normalList];
}

function cycleExerciseKindFilter() {
  const order = ['ALL', 'cloze', 'sentence', 'trap'];
  const labels = {
    ALL: 'Tất cả dạng ⇄',
    cloze: 'Điền khuyết ⇄',
    sentence: 'Dịch câu ⇄',
    trap: 'Bẫy từ dễ nhầm ⇄'
  };
  const nextIdx = (order.indexOf(state.exercise.kindFilter) + 1) % order.length;
  state.exercise.kindFilter = order[nextIdx];
  document.getElementById('ex-kind-filter-btn').textContent = labels[state.exercise.kindFilter];
  startExerciseLesson();
}

function resetExerciseScope() {
  state.selectedLevel = 'ALL';
  state.selectedTopic = 'ALL';
  state.exercise.kindFilter = 'ALL';
  document.getElementById('ex-kind-filter-btn').textContent = 'Tất cả dạng ⇄';
  refreshUI();
}

function startExerciseLesson() {
  stopSpeech();
  const pool = getPrioritizedExercises();

  const emptyBox = document.getElementById('ex-empty-box');
  const activeBox = document.getElementById('ex-active-box');
  const summaryBox = document.getElementById('ex-summary-box');

  if (pool.length === 0) {
    emptyBox.style.display = 'flex';
    activeBox.style.display = 'none';
    summaryBox.style.display = 'none';
    return;
  }

  emptyBox.style.display = 'none';
  activeBox.style.display = 'flex';
  summaryBox.style.display = 'none';

  state.exercise.items = pool.slice(0, 10);
  state.exercise.currentIndex = 0;
  renderExerciseQuestion();
}

function speakCurrentExercise() {
  const ex = state.exercise.items[state.exercise.currentIndex];
  if (!ex) return;
  if (ex.kind === 'sentence') {
    speakJapanese(ex.jp);
  } else {
    const cleanPrompt = String(ex.prompt_jp || '').replace(/（[\s　]*）|\([\s　]*\)/g, '、');
    speakJapanese(cleanPrompt);
  }
}

function renderExerciseQuestion() {
  const exState = state.exercise;
  if (exState.currentIndex >= exState.items.length) {
    document.getElementById('ex-active-box').style.display = 'none';
    document.getElementById('ex-summary-box').style.display = 'flex';
    document.getElementById('ex-final-score-text').textContent = `Tổng điểm năng lượng: ⚡ ${exState.energy}`;
    return;
  }

  const current = exState.items[exState.currentIndex];
  exState.checked = false;
  exState.activeTokenIdx = null;

  const pct = Math.round((exState.currentIndex / exState.items.length) * 100);
  document.getElementById('ex-step-label').textContent = `${exState.currentIndex + 1}/${exState.items.length}`;
  document.getElementById('ex-progress-fill').style.width = `${pct}%`;
  document.getElementById('ex-energy-count').textContent = exState.energy;

  const kindMap = {
    cloze: '📝 Điền khuyết ngữ cảnh',
    sentence: '🧩 Dịch câu ghép từ',
    trap: '⚠️ Bẫy từ dễ nhầm'
  };
  document.getElementById('ex-kind-pill').textContent = kindMap[current.kind] || 'Bài tập';
  document.getElementById('ex-priority-badge').style.display = current._isPriority ? 'inline-block' : 'none';

  const linkedVocab = resolveLinkedVocabForExercise(current);
  const refsRow = document.getElementById('ex-refs-row');
  if (linkedVocab.length > 0) {
    refsRow.style.display = 'flex';
    refsRow.innerHTML = `<span class="ex-refs-label">📖 Tra Kanji:</span>` +
      linkedVocab.map(v => `
        <button type="button" class="ref-vocab-chip" onclick="openVocabPeekModal('${v.id}')">
          ${escapeHtml(v.kanji || v.jp)}
        </button>
      `).join('');
  } else {
    refsRow.style.display = 'none';
  }

  const choicePanel = document.getElementById('ex-choice-panel');
  const sentencePanel = document.getElementById('ex-sentence-panel');

  if (current.kind === 'sentence') {
    choicePanel.style.display = 'none';
    sentencePanel.style.display = 'flex';
    setupSentenceExercisePanel(current);
  } else {
    sentencePanel.style.display = 'none';
    choicePanel.style.display = 'flex';
    renderChoiceExercisePanel(current);
  }
}

function renderChoiceExercisePanel(ex) {
  document.getElementById('ex-source-badge').textContent = `${ex.level} • ${ex.topic}`;
  document.getElementById('ex-choice-prompt-jp').innerHTML = renderInteractiveJapanesePrompt(ex.prompt_jp);
  document.getElementById('ex-choice-prompt-vi').textContent = ex.prompt_vi ? `Nghĩa: ${ex.prompt_vi}` : '';
  document.getElementById('ex-choice-feedback').style.display = 'none';

  const opts = [...(ex.options || [])];
  for (let i = opts.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [opts[i], opts[j]] = [opts[j], opts[i]];
  }

  const letters = ['A', 'B', 'C', 'D'];
  document.getElementById('ex-choice-options').innerHTML = opts.map((opt, idx) => `
    <button
      type="button"
      class="quiz-opt-btn"
      data-opt="${escapeHtml(opt)}"
      onclick="handleChoiceExerciseAnswer(this, '${escapeHtml(opt)}')"
    >
      <span class="opt-letter">${letters[idx]}</span>
      <span>${escapeHtml(opt)}</span>
    </button>
  `).join('');
}

function handleChoiceExerciseAnswer(btnEl, selectedOpt) {
  const exState = state.exercise;
  if (exState.checked) return;
  exState.checked = true;

  const current = exState.items[exState.currentIndex];
  const isCorrect = normalizeKeyText(selectedOpt) === normalizeKeyText(current.answer);

  document.querySelectorAll('#ex-choice-options .quiz-opt-btn').forEach(btn => {
    btn.disabled = true;
    const val = btn.getAttribute('data-opt');
    if (normalizeKeyText(val) === normalizeKeyText(current.answer)) {
      btn.classList.add('correct');
    } else if (btn === btnEl && !isCorrect) {
      btn.classList.add('wrong');
    }
  });

  const fbBox = document.getElementById('ex-choice-feedback');
  const fbIcon = document.getElementById('ex-choice-fb-icon');
  const fbTitle = document.getElementById('ex-choice-fb-title');
  const fbExp = document.getElementById('ex-choice-fb-exp');
  const syncNote = document.getElementById('ex-choice-sync-note');

  if (isCorrect) {
    exState.energy += 5;
    document.getElementById('ex-energy-count').textContent = exState.energy;
    fbBox.className = 'duo-feedback-sheet is-correct';
    fbIcon.textContent = '✓';
    fbTitle.textContent = 'Chính xác!';
    fbExp.textContent = current.explanation;
    syncNote.style.display = 'none';
    playFeedbackTone(true);
  } else {
    fbBox.className = 'duo-feedback-sheet is-wrong';
    fbIcon.textContent = '✕';
    fbTitle.textContent = `Đáp án đúng: ${current.answer}`;
    fbExp.textContent = current.explanation;
    const syncMsg = flagLinkedVocabForReview(current);
    if (syncMsg) {
      syncNote.style.display = 'block';
      syncNote.textContent = syncMsg;
    } else {
      syncNote.style.display = 'none';
    }
    playFeedbackTone(false);
  }

  markStudyActivityToday();
  fbBox.style.display = 'flex';
}

function setupSentenceExercisePanel(sentence) {
  const exState = state.exercise;
  exState.selectedIndices = [];

  const allChips = [...sentence.vi_blocks, ...(sentence.distractors || []).slice(0, 3)];
  for (let i = allChips.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [allChips[i], allChips[j]] = [allChips[j], allChips[i]];
  }
  exState.bankTokens = allChips;

  document.getElementById('duo-token-tooltip').style.display = 'none';
  document.getElementById('duo-feedback-sheet').style.display = 'none';
  document.getElementById('duo-action-row').style.display = 'flex';
  document.getElementById('duo-check-btn').disabled = true;

  renderSentenceExercisePanel(sentence);
  setTimeout(() => speakJapanese(sentence.jp), 120);
}

function renderSentenceExercisePanel(sentence) {
  const exState = state.exercise;

  const tokensWrap = document.getElementById('duo-tokens-wrap');
  tokensWrap.innerHTML = sentence.tokens.map((tok, idx) => `
    <button
      type="button"
      class="duo-jp-token ${exState.activeTokenIdx === idx ? 'active-token' : ''}"
      onclick="onTapJapaneseToken(${idx})"
    >${escapeHtml(tok.jp)}</button>
  `).join('');

  const answerSlots = document.getElementById('duo-answer-slots');
  answerSlots.innerHTML = exState.selectedIndices.map((bankIdx, posIdx) => {
    const word = exState.bankTokens[bankIdx];
    return `
      <button
        type="button"
        class="duo-chip in-answer"
        onclick="removeWordFromAnswer(${posIdx})"
      >${escapeHtml(word)}</button>
    `;
  }).join('');

  const bankEl = document.getElementById('duo-word-bank');
  bankEl.innerHTML = exState.bankTokens.map((word, bankIdx) => {
    const isUsed = exState.selectedIndices.includes(bankIdx);
    return `
      <button
        type="button"
        class="duo-chip ${isUsed ? 'ghost-slot' : ''}"
        onclick="selectWordFromBank(${bankIdx})"
      >${escapeHtml(word)}</button>
    `;
  }).join('');

  document.getElementById('duo-check-btn').disabled = exState.selectedIndices.length === 0;
}

function onTapJapaneseToken(tokenIdx) {
  const exState = state.exercise;
  const sentence = exState.items[exState.currentIndex];
  if (!sentence || !sentence.tokens[tokenIdx]) return;

  exState.activeTokenIdx = tokenIdx;
  const tok = sentence.tokens[tokenIdx];

  const tipBox = document.getElementById('duo-token-tooltip');
  document.getElementById('duo-tip-jp').textContent = tok.jp;
  document.getElementById('duo-tip-romaji').textContent = `/${tok.romaji}/`;
  document.getElementById('duo-tip-vi').textContent = tok.vi;

  const matchedCards = findVocabCardsByKeys([tok.ref, tok.jp]);
  const singleMatch = matchedCards.length > 0 ? matchedCards[0] : findVocabCardForTap(tok.jp);
  const vocabBtn = document.getElementById('duo-tip-vocab-btn');
  if (singleMatch) {
    activePeekCardId = singleMatch.id;
    vocabBtn.style.display = 'inline-block';
  } else {
    activePeekCardId = '';
    vocabBtn.style.display = 'none';
  }

  tipBox.style.display = 'flex';
  speakJapanese(tok.jp);
  renderSentenceExercisePanel(sentence);
}

function hideTokenTooltip() {
  state.exercise.activeTokenIdx = null;
  const tip = document.getElementById('duo-token-tooltip');
  if (tip) tip.style.display = 'none';
}

function selectWordFromBank(bankIdx) {
  const exState = state.exercise;
  if (exState.checked) return;
  if (exState.selectedIndices.includes(bankIdx)) return;

  exState.selectedIndices.push(bankIdx);
  renderSentenceExercisePanel(exState.items[exState.currentIndex]);
}

function removeWordFromAnswer(posIdx) {
  const exState = state.exercise;
  if (exState.checked) return;

  exState.selectedIndices.splice(posIdx, 1);
  renderSentenceExercisePanel(exState.items[exState.currentIndex]);
}

function useTranslateHint() {
  const exState = state.exercise;
  if (exState.checked) return;
  const current = exState.items[exState.currentIndex];
  if (!current) return;

  const targetBlocks = current.vi_blocks;
  let matchLen = 0;
  while (matchLen < exState.selectedIndices.length && matchLen < targetBlocks.length) {
    const chosenWord = exState.bankTokens[exState.selectedIndices[matchLen]];
    if (normalizeVietnameseCompare(chosenWord) === normalizeVietnameseCompare(targetBlocks[matchLen])) {
      matchLen++;
    } else {
      break;
    }
  }

  exState.selectedIndices = exState.selectedIndices.slice(0, matchLen);
  if (matchLen >= targetBlocks.length) return;

  const nextNeededWord = targetBlocks[matchLen];
  const targetBankIdx = exState.bankTokens.findIndex((w, idx) =>
    !exState.selectedIndices.includes(idx) &&
    normalizeVietnameseCompare(w) === normalizeVietnameseCompare(nextNeededWord)
  );

  if (targetBankIdx !== -1) {
    exState.selectedIndices.push(targetBankIdx);
    renderSentenceExercisePanel(current);
    showToast(`💡 Đã gợi ý từ "${nextNeededWord}"`);
  }
}

function normalizeVietnameseCompare(str) {
  return String(str || '')
    .toLowerCase()
    .replace(/[.?!,。？！]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function checkTranslateAnswer() {
  const exState = state.exercise;
  if (exState.checked || exState.selectedIndices.length === 0) return;

  exState.checked = true;
  const current = exState.items[exState.currentIndex];

  const userSentence = exState.selectedIndices.map(i => exState.bankTokens[i]).join(' ');
  const targetSentence = current.vi_blocks.join(' ');
  const isCorrect =
    normalizeVietnameseCompare(userSentence) === normalizeVietnameseCompare(targetSentence) ||
    normalizeVietnameseCompare(userSentence) === normalizeVietnameseCompare(current.vi);

  const sheet = document.getElementById('duo-feedback-sheet');
  const iconEl = document.getElementById('duo-fb-icon');
  const titleEl = document.getElementById('duo-fb-title');
  const subEl = document.getElementById('duo-fb-subtitle');
  const syncNote = document.getElementById('duo-fb-sync-note');

  document.getElementById('duo-action-row').style.display = 'none';
  sheet.style.display = 'flex';

  if (isCorrect) {
    exState.energy += 5;
    document.getElementById('ex-energy-count').textContent = exState.energy;
    sheet.className = 'duo-feedback-sheet is-correct';
    iconEl.textContent = '✓';
    titleEl.textContent = 'Tuyệt vời! Chính xác!';
    subEl.textContent = `${current.jp} (${current.romaji})`;
    syncNote.style.display = 'none';
    playFeedbackTone(true);
  } else {
    sheet.className = 'duo-feedback-sheet is-wrong';
    iconEl.textContent = '✕';
    titleEl.textContent = 'Đáp án chuẩn là:';
    subEl.textContent = current.vi;
    const syncMsg = flagLinkedVocabForReview(current);
    if (syncMsg) {
      syncNote.style.display = 'block';
      syncNote.textContent = syncMsg;
    } else {
      syncNote.style.display = 'none';
    }
    playFeedbackTone(false);
  }

  markStudyActivityToday();
}

function nextExerciseQuestion() {
  stopSpeech();
  state.exercise.currentIndex += 1;
  renderExerciseQuestion();
}

/**
 * =========================================================================
 * 13. CHẾ ĐỘ 5: GHÉP ĐÔI TỪ VỰNG
 * =========================================================================
 */
function toggleMatchVariant() {
  state.match.variant = state.match.variant === 'JP_VI' ? 'KANJI_HIRA' : 'JP_VI';
  const btn = document.getElementById('match-variant-btn');
  btn.textContent = state.match.variant === 'JP_VI' ? 'Nhật ↔ Việt ⇄' : 'Kanji ↔ Cách đọc ⇄';
  startMatchRound();
}

function startMatchRound() {
  stopSpeech();
  let pool = getFilteredPoolCards();
  if (state.match.variant === 'KANJI_HIRA') {
    pool = pool.filter(c => Boolean(c.kanji));
  }
  if (pool.length < 3) pool = [...REPO_CARDS];
  if (pool.length === 0) return;

  const shuffled = [...pool];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }

  const picked = shuffled.slice(0, Math.min(5, shuffled.length));
  const left = [...picked];
  const right = [...picked];

  for (let i = left.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [left[i], left[j]] = [left[j], left[i]];
  }
  for (let i = right.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [right[i], right[j]] = [right[j], right[i]];
  }

  state.match.pairs = picked;
  state.match.leftItems = left;
  state.match.rightItems = right;
  state.match.selectedLeftId = null;
  state.match.selectedRightId = null;
  state.match.matchedIds = [];

  document.getElementById('match-active-box').style.display = 'flex';
  document.getElementById('match-summary-box').style.display = 'none';
  renderMatchBoard();
}

function renderMatchBoard() {
  const m = state.match;
  const pct = m.pairs.length > 0 ? Math.round((m.matchedIds.length / m.pairs.length) * 100) : 0;

  document.getElementById('match-round-label').textContent = `${m.matchedIds.length}/${m.pairs.length} cặp`;
  document.getElementById('match-progress-fill').style.width = `${pct}%`;
  document.getElementById('match-score-count').textContent = m.score;

  const leftCol = document.getElementById('match-left-col');
  const rightCol = document.getElementById('match-right-col');

  leftCol.innerHTML = m.leftItems.map(item => {
    const isMatched = m.matchedIds.includes(item.id);
    const isSelected = m.selectedLeftId === item.id;
    const mainText = item.kanji || item.jp;
    const subText = m.variant === 'KANJI_HIRA'
      ? item.vi
      : (!state.hideFurigana && item.kanji ? item.jp : '');
    return `
      <button
        type="button"
        class="match-tile jp-tile ${isMatched ? 'matched' : ''} ${isSelected ? 'selected' : ''}"
        onclick="selectMatchLeft('${item.id}')"
      >
        <span>${escapeHtml(mainText)}</span>
        ${subText ? `<span class="match-tile-sub">${escapeHtml(subText)}</span>` : ''}
      </button>
    `;
  }).join('');

  rightCol.innerHTML = m.rightItems.map(item => {
    const isMatched = m.matchedIds.includes(item.id);
    const isSelected = m.selectedRightId === item.id;
    const rightText = m.variant === 'KANJI_HIRA' ? `${item.jp} (${item.romaji})` : item.vi;
    return `
      <button
        type="button"
        class="match-tile ${isMatched ? 'matched' : ''} ${isSelected ? 'selected' : ''}"
        onclick="selectMatchRight('${item.id}')"
      >
        <span>${escapeHtml(rightText)}</span>
      </button>
    `;
  }).join('');
}

function selectMatchLeft(cardId) {
  const m = state.match;
  if (m.matchedIds.includes(cardId)) return;

  const card = m.pairs.find(c => c.id === cardId);
  if (card) speakJapanese(card.jp);

  m.selectedLeftId = m.selectedLeftId === cardId ? null : cardId;
  checkMatchAttempt();
}

function selectMatchRight(cardId) {
  const m = state.match;
  if (m.matchedIds.includes(cardId)) return;

  m.selectedRightId = m.selectedRightId === cardId ? null : cardId;
  checkMatchAttempt();
}

function checkMatchAttempt() {
  const m = state.match;
  renderMatchBoard();

  if (!m.selectedLeftId || !m.selectedRightId) return;

  if (m.selectedLeftId === m.selectedRightId) {
    const matchedId = m.selectedLeftId;
    m.matchedIds.push(matchedId);
    m.score += 2;
    state.progress[matchedId] = 'known';
    saveProgress();
    markStudyActivityToday();
    updateStatsHeader();

    m.selectedLeftId = null;
    m.selectedRightId = null;
    playFeedbackTone(true);
    renderMatchBoard();

    if (m.matchedIds.length >= m.pairs.length) {
      setTimeout(() => {
        document.getElementById('match-active-box').style.display = 'none';
        document.getElementById('match-summary-box').style.display = 'flex';
        document.getElementById('match-final-text').textContent = `Tổng điểm: ⚡ ${m.score}`;
      }, 320);
    }
  } else {
    playFeedbackTone(false);
    setTimeout(() => {
      m.selectedLeftId = null;
      m.selectedRightId = null;
      renderMatchBoard();
    }, 360);
  }
}

/**
 * =========================================================================
 * 14. CHẾ ĐỘ 6: LUYỆN KANJI CHIẾT TỰ & CHIA THỂ ĐỘNG TỪ / TÍNH TỪ
 * =========================================================================
 */
function cycleDrillSubmode() {
  const modes = ['MIXED', 'KANJI_CLOZE', 'CONJUGATION'];
  const labels = {
    MIXED: 'Hỗn hợp (Kanji + Chia thể) ⇄',
    KANJI_CLOZE: 'Chỉ luyện Chiết tự Kanji ⇄',
    CONJUGATION: 'Chỉ luyện Chia thể Động/Tính từ ⇄'
  };
  const nextIdx = (modes.indexOf(state.drill.submode) + 1) % modes.length;
  state.drill.submode = modes[nextIdx];
  document.getElementById('drill-submode-btn').textContent = labels[state.drill.submode];
  startDrillLesson();
}

function startDrillLesson() {
  stopSpeech();
  let pool = getFilteredPoolCards();
  if (pool.length === 0) pool = [...REPO_CARDS];
  if (pool.length === 0) return;

  const generated = [];

  pool.forEach(card => {
    const { mainTip } = parseMnemonicAndBridge(card.mnemonic);
    if (card.kanji && state.drill.submode !== 'CONJUGATION') {
      const otherKanjiCards = REPO_CARDS.filter(c => c.id !== card.id && c.kanji);
      const wrongs = otherKanjiCards
        .sort(() => Math.random() - 0.5)
        .slice(0, 3)
        .map(c => `${c.kanji} (${c.jp})`);
      if (wrongs.length >= 2) {
        generated.push({
          kind: 'KANJI_CLOZE',
          card,
          instruction: 'Dựa vào chiết tự & nghĩa, chọn đúng chữ Kanji:',
          mainPrompt: `「${card.vi}」`,
          subHint: `💡 ${mainTip}`,
          correctAnswer: `${card.kanji} (${card.jp})`,
          options: [ `${card.kanji} (${card.jp})`, ...wrongs ].sort(() => Math.random() - 0.5)
        });
      }
    }

    if (state.drill.submode !== 'KANJI_CLOZE') {
      const conjugations = generateWordConjugations(card);
      conjugations.forEach(conj => {
        generated.push({
          kind: 'CONJUGATION',
          card,
          instruction: `Chia từ sau sang ${conj.formName}:`,
          mainPrompt: card.kanji ? `${card.kanji} (${card.jp})` : card.jp,
          subHint: `Nghĩa gốc: ${card.vi} (/${card.romaji}/)`,
          correctAnswer: conj.answer,
          options: [conj.answer, ...conj.wrongs.slice(0, 3)].sort(() => Math.random() - 0.5)
        });
      });
    }
  });

  for (let i = generated.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [generated[i], generated[j]] = [generated[j], generated[i]];
  }

  state.drill.questions = generated.slice(0, 10);
  state.drill.currentIndex = 0;
  state.drill.score = 0;
  state.drill.answered = false;

  document.getElementById('drill-active-box').style.display = 'flex';
  document.getElementById('drill-summary-box').style.display = 'none';
  renderDrillQuestion();
}

function speakDrillCard() {
  const q = state.drill.questions[state.drill.currentIndex];
  if (!q) return;
  speakJapanese(q.card.jp);
}

function renderDrillQuestion() {
  const dr = state.drill;
  if (dr.questions.length === 0) {
    document.getElementById('drill-main-prompt').textContent = 'Chưa đủ từ có Kanji hoặc Động/Tính từ trong phạm vi này.';
    document.getElementById('drill-options-list').innerHTML = '';
    return;
  }

  if (dr.currentIndex >= dr.questions.length) {
    document.getElementById('drill-active-box').style.display = 'none';
    document.getElementById('drill-summary-box').style.display = 'flex';
    document.getElementById('drill-final-score-text').textContent = `Đúng ${dr.score} / ${dr.questions.length} câu`;
    return;
  }

  dr.answered = false;
  const item = dr.questions[dr.currentIndex];

  document.getElementById('drill-step-num').textContent = `Câu ${dr.currentIndex + 1}/${dr.questions.length}`;
  document.getElementById('drill-score-badge').textContent = `Điểm: ${dr.score}`;

  const lvlEl = document.getElementById('drill-level-tag');
  lvlEl.className = `level-tag ${item.card.level.toLowerCase()}`;
  lvlEl.textContent = item.card.level;

  document.getElementById('drill-kind-pill').textContent =
    item.kind === 'KANJI_CLOZE' ? 'Chiết tự Kanji' : 'Chia thể Ngữ pháp';

  document.getElementById('drill-instruction').textContent = item.instruction;
  document.getElementById('drill-main-prompt').textContent = item.mainPrompt;
  document.getElementById('drill-sub-hint').textContent = item.subHint;
  document.getElementById('drill-feedback-box').style.display = 'none';

  const letters = ['A', 'B', 'C', 'D'];
  document.getElementById('drill-options-list').innerHTML = item.options.map((opt, idx) => `
    <button
      type="button"
      class="quiz-opt-btn"
      data-opt="${escapeHtml(opt)}"
      onclick="handleDrillAnswer(this, '${escapeHtml(opt)}')"
    >
      <span class="opt-letter">${letters[idx]}</span>
      <span>${escapeHtml(opt)}</span>
    </button>
  `).join('');
}

function handleDrillAnswer(btnEl, selectedOpt) {
  const dr = state.drill;
  if (dr.answered) return;
  dr.answered = true;

  const item = dr.questions[dr.currentIndex];
  const isCorrect = selectedOpt === item.correctAnswer;

  document.querySelectorAll('#drill-options-list .quiz-opt-btn').forEach(btn => {
    btn.disabled = true;
    const val = btn.getAttribute('data-opt');
    if (val === item.correctAnswer) btn.classList.add('correct');
    else if (btn === btnEl && !isCorrect) btn.classList.add('wrong');
  });

  if (isCorrect) {
    dr.score += 1;
    playFeedbackTone(true);
  } else {
    playFeedbackTone(false);
  }

  markStudyActivityToday();
  document.getElementById('drill-score-badge').textContent = `Điểm: ${dr.score}`;
  document.getElementById('drill-feedback-note').textContent =
    `✓ Đáp án: ${item.correctAnswer} • Từ gốc: ${item.card.kanji || item.card.jp} (${item.card.vi})`;
  document.getElementById('drill-feedback-box').style.display = 'flex';
  speakJapanese(item.card.jp);
}

function nextDrillQuestion() {
  stopSpeech();
  state.drill.currentIndex += 1;
  renderDrillQuestion();
}

/**
 * =========================================================================
 * 15. CHẾ ĐỘ 7: BẢNG CHỮ CÁI HIRAGANA & KATAKANA TƯƠNG TÁC
 * =========================================================================
 */
const KANA_DATA = {
  BASIC: [
    { h: 'あ', k: 'ア', r: 'a', tip: 'Hiragana あ giống chữ A có nét vòng bụng; Katakana ア giống cái rìu.' },
    { h: 'い', k: 'イ', r: 'i', tip: 'Hai nét thẳng đứng song song như hai người đang đứng (i).' },
    { h: 'う', k: 'ウ', r: 'u', tip: 'Nét trên chấm xuống lưng cong như người đang cúi (u).' },
    { h: 'え', k: 'エ', r: 'e', tip: 'Katakana エ giống chữ Công (工) hoặc thanh dầm sắt chữ I/E.' },
    { h: 'お', k: 'オ', r: 'o', tip: 'Nét tròn bụng có dấu chấm bên phải như quả bóng golf (o).' },
    { h: 'か', k: 'カ', r: 'ka', tip: 'Giống chữ Lực (力) thêm dấu phẩy (cắt ка).' },
    { h: 'き', k: 'キ', r: 'ki', tip: 'Hình chiếc chìa khóa cổ (Key = ki).' },
    { h: 'く', k: 'ク', r: 'ku', tip: 'Giống mỏ chim cúc cu đang há ra (ku).' },
    { h: 'け', k: 'ケ', r: 'ke', tip: 'Hai nét đối nhau như cánh cửa tre (ke).' },
    { h: 'こ', k: 'コ', r: 'ko', tip: 'Hai nét ngang trên dưới như hai con cá nhỏ (ko).' },
    { h: 'さ', k: 'サ', r: 'sa', tip: 'Giống chữ き nhưng chỉ có 1 nét gạch ngang.' },
    { h: 'し', k: 'シ', r: 'shi', tip: 'Hình cái móc câu hoặc ống hút cong lên (shi).' },
    { h: 'す', k: 'ス', r: 'su', tip: 'Nét xoắn tròn ở giữa như sợi mì đang treo (su).' },
    { h: 'せ', k: 'セ', r: 'se', tip: 'Bắt nguồn từ chữ Thế (世) trong thế giới (sekai).' },
    { h: 'そ', k: 'ソ', r: 'so', tip: 'Đường khâu zíc-zắc (sew = so).' },
    { h: 'た', k: 'タ', r: 'ta', tip: 'Nét đầu giống chữ t, nét sau giống chữ a -> ta.' },
    { h: 'ち', k: 'チ', r: 'chi', tip: 'Hình giống số 5 (chi).' },
    { h: 'つ', k: 'ツ', r: 'tsu', tip: 'Hình ngọn sóng thần cuộn tròn (tsunami).' },
    { h: 'て', k: 'テ', r: 'te', tip: 'Lòng bàn tay cong (手 = te).' },
    { h: 'と', k: 'ト', r: 'to', tip: 'Cái gai đâm vào ngón chân cái (toe = to).' },
    { h: 'な', k: 'ナ', r: 'na', tip: 'Chữ thập (+) kèm nút thắt bên dưới (na).' },
    { h: 'に', k: 'ニ', r: 'ni', tip: 'Katakana ニ chính là số 2 (ni) trong tiếng Nhật.' },
    { h: 'ぬ', k: 'ヌ', r: 'nu', tip: 'Hai chiếc đũa gắp sợi mì xoắn (noodle = nu).' },
    { h: 'ね', k: 'ネ', r: 'ne', tip: 'Đuôi xoắn tròn như con mèo đang cuộn (neko).' },
    { h: 'の', k: 'ノ', r: 'no', tip: 'Biển báo cấm tròn gạch chéo (NO = no).' },
    { h: 'は', k: 'ハ', r: 'ha', tip: 'Katakana ハ giống mái nhà hoặc ria mép cười ha ha.' },
    { h: 'ひ', k: 'ヒ', r: 'hi', tip: 'Khuôn miệng đang cười hì hì (hi).' },
    { h: 'ふ', k: 'フ', r: 'fu', tip: 'Sườn núi Phú Sĩ (Fuji = fu).' },
    { h: 'へ', k: 'ヘ', r: 'he', tip: 'Đỉnh đồi nhọn chỉ hướng lên trời (heaven = he).' },
    { h: 'ほ', k: 'ホ', r: 'ho', tip: 'Giống chữ は nhưng có 2 gạch ngang như ống khói (ho).' },
    { h: 'ま', k: 'マ', r: 'ma', tip: 'Hai gạch ngang có vòng thắt ở đáy (mama = ma).' },
    { h: 'み', k: 'ミ', r: 'mi', tip: 'Katakana ミ là 3 vạch như bộ râu mèo (mi).' },
    { h: 'む', k: 'ム', r: 'mu', tip: 'Hình con bò có sừng kêu muu (mu).' },
    { h: 'め', k: 'メ', r: 'me', tip: 'Con mắt (目 = me) có nét gạch chéo.' },
    { h: 'も', k: 'モ', r: 'mo', tip: 'Lưỡi câu móc thêm 2 con mồi (more = mo).' },
    { h: 'や', k: 'ヤ', r: 'ya', tip: 'Hình đầu con bò rừng Tây Tạng (yak = ya).' },
    { h: '', k: '', r: '', empty: true },
    { h: 'ゆ', k: 'ユ', r: 'yu', tip: 'Hình con cá bơi dưới suối nước nóng (湯 = yu).' },
    { h: '', k: '', r: '', empty: true },
    { h: 'よ', k: 'ヨ', r: 'yo', tip: 'Hình chiếc yo-yo treo trên dây (yo).' },
    { h: 'ら', k: 'ラ', r: 'ra', tip: 'Giống số 5 có nắp ở trên (ra).' },
    { h: 'り', k: 'リ', r: 'ri', tip: 'Hai nhánh lau sậy bên bờ sông (river = ri).' },
    { h: 'る', k: 'ル', r: 'ru', tip: 'Giống số 3 nhưng có vòng lặp tròn ở đuôi (ru).' },
    { h: 'れ', k: 'レ', r: 're', tip: 'Cột thẳng có nét hất ra ngoài (re).' },
    { h: 'ろ', k: 'ロ', r: 'ro', tip: 'Giống số 3 không có vòng lặp; Katakana ロ là cái miệng vuông.' },
    { h: 'わ', k: 'ワ', r: 'wa', tip: 'Giống chữ れ nhưng nét phải uốn tròn vào trong (wa).' },
    { h: '', k: '', r: '', empty: true },
    { h: 'を', k: 'ヲ', r: 'wo', tip: 'Trợ từ tân ngữ đọc là "o" (chỉ dùng làm trợ từ).' },
    { h: '', k: '', r: '', empty: true },
    { h: 'ん', k: 'ン', r: 'n', tip: 'Trông giống chữ n viết thường trong tiếng Anh.' }
  ],
  DAKUTEN: [
    { h: 'が', k: 'ガ', r: 'ga', tip: 'Hàng か thêm dấu 텐텐 (゛) -> ga' },
    { h: 'ぎ', k: 'ギ', r: 'gi', tip: 'き + ゛ -> gi' },
    { h: 'ぐ', k: 'グ', r: 'gu', tip: 'く + ゛ -> gu' },
    { h: 'げ', k: 'ゲ', r: 'ge', tip: 'け + ゛ -> ge' },
    { h: 'ご', k: 'ゴ', r: 'go', tip: 'こ + ゛ -> go' },
    { h: 'ざ', k: 'ザ', r: 'za', tip: 'さ + ゛ -> za' },
    { h: 'じ', k: 'ジ', r: 'ji', tip: 'し + ゛ -> ji' },
    { h: 'ず', k: 'ズ', r: 'zu', tip: 'す + ゛ -> zu' },
    { h: 'ぜ', k: 'ゼ', r: 'ze', tip: 'せ + ゛ -> ze' },
    { h: 'ぞ', k: 'ゾ', r: 'zo', tip: 'そ + ゛ -> zo' },
    { h: 'だ', k: 'ダ', r: 'da', tip: 'た + ゛ -> da' },
    { h: 'ぢ', k: 'ヂ', r: 'ji (di)', tip: 'ち + ゛ -> đọc giống じ (ji)' },
    { h: 'づ', k: 'ヅ', r: 'zu (du)', tip: 'つ + ゛ -> đọc giống ず (zu)' },
    { h: 'で', k: 'デ', r: 'de', tip: 'て + ゛ -> de' },
    { h: 'ど', k: 'ド', r: 'do', tip: 'と + ゛ -> do' },
    { h: 'ば', k: 'バ', r: 'ba', tip: 'は + ゛ -> ba' },
    { h: 'び', k: 'ビ', r: 'bi', tip: 'ひ + ゛ -> bi' },
    { h: 'ぶ', k: 'ブ', r: 'bu', tip: 'ふ + ゛ -> bu' },
    { h: 'べ', k: 'ベ', r: 'be', tip: 'へ + ゛ -> be' },
    { h: 'ぼ', k: 'ボ', r: 'bo', tip: 'ほ + ゛ -> bo' },
    { h: 'ぱ', k: 'パ', r: 'pa', tip: 'は + dấu tròn (゜) -> pa' },
    { h: 'ぴ', k: 'ピ', r: 'pi', tip: 'ひ + ゜ -> pi' },
    { h: 'ぷ', k: 'プ', r: 'pu', tip: 'ふ + ゜ -> pu' },
    { h: 'ぺ', k: 'ペ', r: 'pe', tip: 'へ + ゜ -> pe' },
    { h: 'ぽ', k: 'ポ', r: 'po', tip: 'ほ + ゜ -> po' }
  ],
  YOON: [
    { h: 'きゃ', k: 'キャ', r: 'kya', tip: 'き + ゃ nhỏ -> kya' },
    { h: 'きゅ', k: 'キュ', r: 'kyu', tip: 'き + ゅ nhỏ -> kyu' },
    { h: 'きょ', k: 'キョ', r: 'kyo', tip: 'き + ょ nhỏ -> kyo' },
    { h: 'しゃ', k: 'シャ', r: 'sha', tip: 'し + ゃ nhỏ -> sha (như trong しゃしん - bức ảnh)' },
    { h: 'しゅ', k: 'シュ', r: 'shu', tip: 'し + ゅ nhỏ -> shu' },
    { h: 'しょ', k: 'ショ', r: 'sho', tip: 'し + ょ nhỏ -> sho (như trong としょかん - thư viện)' },
    { h: 'ちゃ', k: 'チャ', r: 'cha', tip: 'ち + ゃ nhỏ -> cha (おちゃ - trà)' },
    { h: 'ちゅ', k: 'チュ', r: 'chu', tip: 'ち + ゅ nhỏ -> chu' },
    { h: 'ちょ', k: 'チョ', r: 'cho', tip: 'ち + ょ nhỏ -> cho' },
    { h: 'にゃ', k: 'ニャ', r: 'nya', tip: 'に + ゃ nhỏ -> nya' },
    { h: 'にゅ', k: 'ニュ', r: 'nyu', tip: 'に + ゅ nhỏ -> nyu' },
    { h: 'にょ', k: 'ニョ', r: 'nyo', tip: 'に + ょ nhỏ -> nyo' },
    { h: 'ひゃ', k: 'ヒャ', r: 'hya', tip: 'ひ + ゃ nhỏ -> hya (ひゃく - 100)' },
    { h: 'ひゅ', k: 'ヒュ', r: 'hyu', tip: 'ひ + ゅ nhỏ -> hyu' },
    { h: 'ひょ', k: 'ヒョ', r: 'hyo', tip: 'ひ + ょ nhỏ -> hyo' },
    { h: 'みゃ', k: 'ミャ', r: 'mya', tip: 'み + ゃ nhỏ -> mya' },
    { h: 'みゅ', k: 'ミュ', r: 'myu', tip: 'み + ゅ nhỏ -> myu' },
    { h: 'みょ', k: 'ミョ', r: 'myo', tip: 'み + ょ nhỏ -> myo' },
    { h: 'りゃ', k: 'リャ', r: 'rya', tip: 'り + ゃ nhỏ -> rya' },
    { h: 'りゅ', k: 'リュ', r: 'ryu', tip: 'り + ゅ nhỏ -> ryu' },
    { h: 'りょ', k: 'リョ', r: 'ryo', tip: 'り + ょ nhỏ -> ryo (りょこう - du lịch)' }
  ]
};

function setKanaScript(script) {
  state.kana.script = script === 'katakana' ? 'katakana' : 'hiragana';
  document.getElementById('kana-script-hira').classList.toggle('active', state.kana.script === 'hiragana');
  document.getElementById('kana-script-kata').classList.toggle('active', state.kana.script === 'katakana');
  updateHeaderContextBadge();
  renderKanaModule();
}

function setKanaSubtab(subtab) {
  state.kana.subtab = subtab === 'quiz' ? 'quiz' : 'chart';
  document.getElementById('kana-tab-chart').classList.toggle('active', state.kana.subtab === 'chart');
  document.getElementById('kana-tab-quiz').classList.toggle('active', state.kana.subtab === 'quiz');
  renderKanaModule();
}

function setKanaGroup(group) {
  state.kana.group = ['BASIC', 'DAKUTEN', 'YOON'].includes(group) ? group : 'BASIC';
  state.kana.selectedIdx = 0;
  document.querySelectorAll('#kana-group-pills .pill-btn').forEach(btn => {
    btn.classList.toggle('filter-active', btn.getAttribute('data-kgroup') === state.kana.group);
  });
  renderKanaModule();
}

function renderKanaModule() {
  const chartPanel = document.getElementById('kana-chart-panel');
  const quizPanel = document.getElementById('kana-quiz-panel');

  if (state.kana.subtab === 'quiz') {
    chartPanel.style.display = 'none';
    quizPanel.style.display = 'flex';
    startKanaQuiz();
    return;
  }

  quizPanel.style.display = 'none';
  chartPanel.style.display = 'flex';

  const list = KANA_DATA[state.kana.group] || KANA_DATA.BASIC;
  const gridEl = document.getElementById('kana-grid');
  gridEl.classList.toggle('yoon-grid', state.kana.group === 'YOON');

  gridEl.innerHTML = list.map((item, idx) => {
    if (item.empty) {
      return `<div class="kana-cell empty-slot"></div>`;
    }
    const ch = state.kana.script === 'katakana' ? item.k : item.h;
    const isSel = idx === state.kana.selectedIdx;
    return `
      <button
        type="button"
        class="kana-cell ${isSel ? 'selected' : ''}"
        onclick="selectKanaCell(${idx})"
      >
        <span class="kana-char-main">${escapeHtml(ch)}</span>
        <span class="kana-char-sub">${escapeHtml(item.r)}</span>
      </button>
    `;
  }).join('');

  updateKanaDetailBanner();
}

function selectKanaCell(idx) {
  const list = KANA_DATA[state.kana.group] || KANA_DATA.BASIC;
  const item = list[idx];
  if (!item || item.empty) return;
  state.kana.selectedIdx = idx;
  renderKanaModule();
  speakSelectedKana();
}

function updateKanaDetailBanner() {
  const list = KANA_DATA[state.kana.group] || KANA_DATA.BASIC;
  const item = list[state.kana.selectedIdx] || list[0];
  if (!item || item.empty) return;

  const ch = state.kana.script === 'katakana' ? item.k : item.h;
  const pairChar = state.kana.script === 'katakana' ? item.h : item.k;

  document.getElementById('kana-detail-char').textContent = ch;
  document.getElementById('kana-detail-romaji').textContent = `/${item.r}/ • Chữ tương ứng: ${pairChar}`;
  document.getElementById('kana-detail-tip').textContent = item.tip;
}

function speakSelectedKana() {
  const list = KANA_DATA[state.kana.group] || KANA_DATA.BASIC;
  const item = list[state.kana.selectedIdx] || list[0];
  if (!item || item.empty) return;
  speakJapanese(item.h);
}

function startKanaQuiz() {
  const list = (KANA_DATA[state.kana.group] || KANA_DATA.BASIC).filter(x => !x.empty);
  const shuffled = [...list].sort(() => Math.random() - 0.5);
  state.kana.quizQuestions = shuffled.slice(0, 10);
  state.kana.quizIndex = 0;
  state.kana.quizScore = 0;
  state.kana.quizAnswered = false;
  renderKanaQuizQuestion();
}

function speakKanaQuizChar() {
  const q = state.kana.quizQuestions[state.kana.quizIndex];
  if (!q) return;
  speakJapanese(q.h);
}

function renderKanaQuizQuestion() {
  const k = state.kana;
  if (k.quizIndex >= k.quizQuestions.length) {
    showToast(`🎉 Hoàn thành! Đúng ${k.quizScore}/${k.quizQuestions.length} chữ cái!`);
    startKanaQuiz();
    return;
  }

  k.quizAnswered = false;
  const current = k.quizQuestions[k.quizIndex];
  const displayChar = k.script === 'katakana' ? current.k : current.h;

  document.getElementById('kana-quiz-progress').textContent = `Câu ${k.quizIndex + 1}/${k.quizQuestions.length}`;
  document.getElementById('kana-quiz-score').textContent = `Điểm: ${k.quizScore}`;
  document.getElementById('kana-quiz-char').textContent = displayChar;
  document.getElementById('kana-quiz-feedback').style.display = 'none';

  const allPool = (KANA_DATA[k.group] || KANA_DATA.BASIC).filter(x => !x.empty && x.r !== current.r);
  const distractors = allPool.sort(() => Math.random() - 0.5).slice(0, 3);
  const options = [current, ...distractors].sort(() => Math.random() - 0.5);
  const letters = ['A', 'B', 'C', 'D'];

  document.getElementById('kana-quiz-options').innerHTML = options.map((opt, idx) => `
    <button
      type="button"
      class="quiz-opt-btn"
      data-romaji="${escapeHtml(opt.r)}"
      onclick="handleKanaQuizAnswer(this, '${escapeHtml(opt.r)}')"
    >
      <span class="opt-letter">${letters[idx]}</span>
      <span>${escapeHtml(opt.r)} (${escapeHtml(k.script === 'katakana' ? opt.h : opt.k)})</span>
    </button>
  `).join('');
}

function handleKanaQuizAnswer(btnEl, selectedRomaji) {
  const k = state.kana;
  if (k.quizAnswered) return;
  k.quizAnswered = true;

  const current = k.quizQuestions[k.quizIndex];
  const isCorrect = selectedRomaji === current.r;

  document.querySelectorAll('#kana-quiz-options .quiz-opt-btn').forEach(btn => {
    btn.disabled = true;
    const r = btn.getAttribute('data-romaji');
    if (r === current.r) btn.classList.add('correct');
    else if (btn === btnEl && !isCorrect) btn.classList.add('wrong');
  });

  if (isCorrect) {
    k.quizScore += 1;
    playFeedbackTone(true);
  } else {
    playFeedbackTone(false);
  }

  markStudyActivityToday();
  document.getElementById('kana-quiz-score').textContent = `Điểm: ${k.quizScore}`;
  document.getElementById('kana-quiz-tip').textContent = `💡 ${current.h} / ${current.k} (${current.r}): ${current.tip}`;
  document.getElementById('kana-quiz-feedback').style.display = 'flex';
  speakJapanese(current.h);
}

function nextKanaQuizQuestion() {
  stopSpeech();
  state.kana.quizIndex += 1;
  renderKanaQuizQuestion();
}

/**
 * =========================================================================
 * 16. TRA CỨU TỪ VỰNG NHANH TOÀN KHO (SEARCH MODAL)
 * =========================================================================
 */
function openSearchModal() {
  document.getElementById('search-modal').style.display = 'flex';
  document.getElementById('repo-search-input').value = '';
  renderSearchResults();
  setTimeout(() => document.getElementById('repo-search-input').focus(), 60);
}

function closeSearchModal() {
  document.getElementById('search-modal').style.display = 'none';
}

function renderSearchResults() {
  const q = document.getElementById('repo-search-input').value.trim().toLowerCase();
  const lvl = document.getElementById('repo-search-level').value;

  let pool = lvl === 'ALL' ? REPO_CARDS : REPO_CARDS.filter(c => c.level === lvl);
  if (q) {
    pool = pool.filter(c =>
      c.jp.toLowerCase().includes(q) ||
      (c.kanji && c.kanji.toLowerCase().includes(q)) ||
      c.romaji.toLowerCase().includes(q) ||
      c.vi.toLowerCase().includes(q) ||
      c.mnemonic.toLowerCase().includes(q) ||
      c.topic.toLowerCase().includes(q)
    );
  }

  document.getElementById('search-results-count').textContent =
    `Tìm thấy ${pool.length} từ vựng (hiển thị tối đa 60 kết quả đầu)`;

  const preview = pool.slice(0, 60);
  const listEl = document.getElementById('search-results-list');
  listEl.innerHTML = preview.map(card => `
    <div class="search-item-card">
      <div class="search-item-top">
        <div>
          <span class="level-tag ${card.level.toLowerCase()}">${card.level}</span>
          <span class="search-item-jp">${escapeHtml(card.kanji ? `${card.kanji} (${card.jp})` : card.jp)}</span>
        </div>
        <button type="button" class="audio-btn" onclick="speakJapanese('${escapeHtml(card.jp)}')">🔊</button>
      </div>
      <div class="search-item-vi">/${escapeHtml(card.romaji)}/ — ${escapeHtml(card.vi)}</div>
      <div class="search-item-mnem">${escapeHtml(card.mnemonic)}</div>
    </div>
  `).join('');
}

/**
 * =========================================================================
 * 17. NHẬP DỮ LIỆU, XUẤT ĐỘC LẬP 2 TỆP & NẠP BỘ MẪU
 * =========================================================================
 */
function openImportModal() {
  document.getElementById('import-error-msg').style.display = 'none';
  if (state.selectedLevel !== 'ALL') {
    document.getElementById('import-default-level').value = state.selectedLevel;
  }
  document.getElementById('import-modal').style.display = 'flex';
  runLiveDuplicateCheck();
}

function closeImportModal() {
  document.getElementById('import-modal').style.display = 'none';
}

function getDemoDataset() {
  return [
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
      topic: 'Động từ cốt lõi',
      tag: 'v2',
      jp: 'たべます',
      kanji: '食べます',
      romaji: 'tabemasu',
      vi: 'Ăn',
      mnemonic: 'Chữ Thực (食 - mái nhà che bát cơm ngon) -> Ăn. [N4/N3: Ghép thành しょくじ (bữa ăn), しょくどう (nhà ăn)]'
    },
    {
      level: 'N5',
      topic: 'Động từ cốt lõi',
      tag: 'v1',
      jp: 'よみます',
      kanji: '読みます',
      romaji: 'yomimasu',
      vi: 'Đọc',
      mnemonic: 'Chữ Độc (読 - bộ Ngôn 言 + chữ Bán 売) -> Đọc sách. [N4/N3: Đọc là ドク trong どくしょ (đọc sách)]'
    },
    {
      level: 'N5',
      topic: 'Địa điểm & Đời sống',
      tag: 'noun',
      jp: 'えき',
      kanji: '駅',
      romaji: 'eki',
      vi: 'Nhà ga',
      mnemonic: 'Chữ Dịch (駅 - bộ Mã 馬 chỉ trạm dừng ngựa xưa) -> Nhà ga. [N4/N3: えきまえ (trước nhà ga)]'
    },
    {
      level: 'N5',
      topic: 'Địa điểm & Đời sống',
      tag: 'noun',
      jp: 'としょかん',
      kanji: '図書館',
      romaji: 'toshokan',
      vi: 'Thư viện',
      mnemonic: 'Đồ Thư Quán (図書館 - tòa nhà lưu giữ sách và bản đồ). [N4/N3: びじゅつかん (bảo tàng mỹ thuật)]'
    },
    {
      level: 'N5',
      topic: 'Tính từ N5 (Phần 1)',
      tag: 'adj_i',
      jp: 'あつい',
      kanji: '熱い',
      romaji: 'atsui',
      vi: 'Nóng (đồ vật, thức uống)',
      mnemonic: 'Chữ Nhiệt (熱 - có 4 chấm hỏa 灬 ở dưới) -> Nóng bỏng tay. [N4/N3: Phân biệt với 暑い (trời nóng)]'
    },
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
      kind: 'sentence',
      level: 'N5',
      topic: 'Động từ cốt lõi',
      refs: ['よみます', 'としょかん'],
      jp: 'としょかんでほんをよみます。',
      romaji: 'Toshokan de hon o yomimasu.',
      tokens: [
        { jp: 'としょかん', romaji: 'toshokan', vi: 'thư viện', ref: 'としょかん' },
        { jp: 'で', romaji: 'de', vi: 'ở / tại' },
        { jp: 'ほん', romaji: 'hon', vi: 'sách' },
        { jp: 'を', romaji: 'o', vi: '(trợ từ tân ngữ)' },
        { jp: 'よみます', romaji: 'yomimasu', vi: 'đọc', ref: 'よみます' }
      ],
      vi: 'Tôi đọc sách ở thư viện.',
      vi_blocks: ['Tôi', 'đọc', 'sách', 'ở', 'thư viện'],
      distractors: ['nhà ga', 'ăn', 'hôm qua']
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
    }
  ];
}

function fillSampleJson() {
  document.getElementById('import-default-level').value = 'N5';
  document.getElementById('import-default-topic').value = 'Động từ cốt lõi';
  document.getElementById('import-json-text').value = JSON.stringify(getDemoDataset(), null, 2);
  runLiveDuplicateCheck();
}

async function loadQuickDemoSession() {
  const demo = getDemoDataset();
  demo.forEach(raw => {
    if (isExerciseEntry(raw)) {
      REPO_EXERCISES.push(normalizeExerciseItem(raw));
    } else {
      REPO_CARDS.push(normalizeCardItem(raw));
    }
  });
  await saveRepository();
  buildSmartFlashcardBatch();
  refreshUI();
  showToast('⚡ Đã nạp bộ mẫu (Từ vựng + 3 dạng Bài tập liên kết)!');
}

async function importJsonToRepo() {
  const defaultLevel = document.getElementById('import-default-level').value;
  const defaultTopic = document.getElementById('import-default-topic').value.trim() || 'Tổng hợp';
  const rawJson = document.getElementById('import-json-text').value.trim();
  const policyEl = document.getElementById('dup-handling-mode');
  const dupPolicy = policyEl ? policyEl.value : 'skip';
  const errorEl = document.getElementById('import-error-msg');

  if (!rawJson) {
    errorEl.textContent = 'Vui lòng dán mảng JSON hoặc chọn tệp dữ liệu.';
    errorEl.style.display = 'block';
    return;
  }

  try {
    const parsed = parseMultiJsonBlocks(rawJson);

    const vocabKeyToIndex = new Map();
    REPO_CARDS.forEach((c, idx) => vocabKeyToIndex.set(getCardUniqueKey(c), idx));
    const exKeyToIndex = new Map();
    REPO_EXERCISES.forEach((s, idx) => exKeyToIndex.set(getExerciseUniqueKey(s), idx));

    const seenInCurrentBatch = new Set();
    let addedVocab = 0;
    let addedEx = 0;
    let updatedCount = 0;
    let skippedCount = 0;

    parsed.forEach(raw => {
      if (!raw || typeof raw !== 'object') return;

      if (isExerciseEntry(raw)) {
        const ex = normalizeExerciseItem(raw, defaultLevel, defaultTopic);
        if (!ex.jp && !ex.prompt_jp) return;
        const key = getExerciseUniqueKey(ex);

        if (seenInCurrentBatch.has(key)) {
          skippedCount++;
          return;
        }
        seenInCurrentBatch.add(key);

        if (exKeyToIndex.has(key)) {
          if (dupPolicy === 'overwrite') {
            REPO_EXERCISES[exKeyToIndex.get(key)] = ex;
            updatedCount++;
          } else {
            skippedCount++;
          }
        } else {
          exKeyToIndex.set(key, REPO_EXERCISES.length);
          REPO_EXERCISES.push(ex);
          addedEx++;
        }
      } else if (raw.jp && raw.vi) {
        const card = normalizeCardItem(raw, defaultLevel, defaultTopic);
        const key = getCardUniqueKey(card);

        if (seenInCurrentBatch.has(key)) {
          skippedCount++;
          return;
        }
        seenInCurrentBatch.add(key);

        if (vocabKeyToIndex.has(key)) {
          if (dupPolicy === 'overwrite') {
            REPO_CARDS[vocabKeyToIndex.get(key)] = card;
            updatedCount++;
          } else {
            skippedCount++;
          }
        } else {
          vocabKeyToIndex.set(key, REPO_CARDS.length);
          REPO_CARDS.push(card);
          addedVocab++;
        }
      }
    });

    await saveRepository();
    state.currentIndex = 0;
    state.isFlipped = false;
    buildSmartFlashcardBatch();

    document.getElementById('import-json-text').value = '';
    closeImportModal();
    refreshUI();

    showToast(`✓ Đã nạp +${addedVocab} từ, +${addedEx} bài tập (cập nhật ${updatedCount}, bỏ qua ${skippedCount})`);
  } catch (err) {
    errorEl.textContent = err.message || 'Lỗi định dạng JSON.';
    errorEl.style.display = 'block';
  }
}

function openExportModal() {
  document.getElementById('export-vocab-count').textContent = `${REPO_CARDS.length} từ vựng & Kanji trong kho`;
  document.getElementById('export-ex-count').textContent = `${REPO_EXERCISES.length} câu bài tập ngữ cảnh trong kho`;
  document.getElementById('export-modal').style.display = 'flex';
}

function closeExportModal() {
  document.getElementById('export-modal').style.display = 'none';
}

function exportVocabDataJsFile() {
  const cleanVocab = REPO_CARDS.map(c => ({
    level: c.level,
    topic: c.topic,
    tag: c.tag || undefined,
    jp: c.jp,
    kanji: c.kanji,
    romaji: c.romaji,
    vi: c.vi,
    mnemonic: c.mnemonic
  }));

  const fileContent =
`/**
 * TỆP 1: KHO TỪ VỰNG & KANJI THUẦN TÚY (N5 -> N3)
 * Tổng số: ${cleanVocab.length} từ vựng
 */

var VOCAB_DATA = ${JSON.stringify(cleanVocab, null, 2)};
`;

  const blob = new Blob([fileContent], { type: 'application/javascript;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'vocab_data.js';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  showToast('⬇ Đã tải xuống tệp vocab_data.js');
}

function exportExerciseDataJsFile() {
  const cleanEx = REPO_EXERCISES.map(s => {
    if (s.kind === 'sentence') {
      return {
        type: 'exercise',
        kind: 'sentence',
        level: s.level,
        topic: s.topic,
        refs: s.refs,
        jp: s.jp,
        romaji: s.romaji,
        tokens: s.tokens,
        vi: s.vi,
        vi_blocks: s.vi_blocks,
        distractors: s.distractors
      };
    }
    return {
      type: 'exercise',
      kind: s.kind,
      level: s.level,
      topic: s.topic,
      refs: s.refs,
      prompt_jp: s.prompt_jp,
      prompt_vi: s.prompt_vi,
      options: s.options,
      answer: s.answer,
      explanation: s.explanation
    };
  });

  const fileContent =
`/**
 * TỆP 2: KHO BÀI TẬP NGỮ CẢNH CHUẨN XÁC (N5 -> N3)
 * Tổng số: ${cleanEx.length} câu bài tập
 */

var EXERCISE_DATA = ${JSON.stringify(cleanEx, null, 2)};
`;

  const blob = new Blob([fileContent], { type: 'application/javascript;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'exercise_data.js';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  showToast('⬇ Đã tải xuống tệp exercise_data.js');
}

function showToast(msg) {
  const toast = document.getElementById('toast-banner');
  if (!toast) return;
  toast.textContent = msg;
  toast.classList.add('show');
  clearTimeout(window.__toastTimer);
  window.__toastTimer = setTimeout(() => {
    toast.classList.remove('show');
  }, 2400);
}

/**
 * =========================================================================
 * 18. KHÓA ZOOM IPHONE SAFARI, VUỐT MÀN HÌNH & KHỞI CHẠY
 * =========================================================================
 */
function setupTouchAndKeyboard() {
  let touchStartX = 0;
  let touchStartY = 0;
  const stage = document.getElementById('card-stage-wrapper');

  if (stage) {
    stage.addEventListener('touchstart', e => {
      touchStartX = e.changedTouches[0].screenX;
      touchStartY = e.changedTouches[0].screenY;
    }, { passive: true });

    stage.addEventListener('touchend', e => {
      const dx = e.changedTouches[0].screenX - touchStartX;
      const dy = e.changedTouches[0].screenY - touchStartY;
      if (Math.abs(dx) > 55 && Math.abs(dx) > Math.abs(dy) * 1.4) {
        if (dx < 0) nextCard();
        else prevCard();
      }
    }, { passive: true });
  }

  // Chặn triệt để Pinch-to-Zoom và Double-tap Zoom trên iPhone Safari
  document.addEventListener('gesturestart', e => {
    e.preventDefault();
  }, { passive: false });

  document.addEventListener('gesturechange', e => {
    e.preventDefault();
  }, { passive: false });

  document.addEventListener('dblclick', e => {
    e.preventDefault();
  }, { passive: false });

  window.addEventListener('keydown', e => {
    const tag = (e.target && e.target.tagName) || '';
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
    if (state.mode !== 'flashcard') return;

    if (e.code === 'Space') {
      e.preventDefault();
      flipCard();
    } else if (e.code === 'ArrowRight') {
      e.preventDefault();
      nextCard();
    } else if (e.code === 'ArrowLeft') {
      e.preventDefault();
      prevCard();
    } else if (e.key === '1') {
      rateCurrentCard('review');
    } else if (e.key === '2') {
      rateCurrentCard('known');
    }
  });
}

window.addEventListener('DOMContentLoaded', async () => {
  await initRepository();
  setupTouchAndKeyboard();
  buildSmartFlashcardBatch();
  refreshUI();
});