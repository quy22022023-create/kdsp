/**
 * =========================================================================
 * KHO TỪ VỰNG CHUNG PHÂN CẤP N5 -> N3 (KẾT HỢP DATA.JS & LOCALSTORAGE)
 * =========================================================================
 */
const EXTRA_CARDS_STORAGE_KEY = 'jlpt_n5_n3_extra_cards_v1';
const PROGRESS_STORAGE_KEY = 'jlpt_n5_n3_progress_v1';
const ALLOWED_LEVELS = ['N5', 'N4', 'N3'];

let REPO_CARDS = [];

let state = {
  selectedLevel: 'ALL',    // 'ALL' | 'N5' | 'N4' | 'N3'
  selectedTopic: 'ALL',    // 'ALL' | tên chủ đề
  mode: 'flashcard',       // 'flashcard' | 'quiz'
  filterUnmastered: false,
  voiceMode: 'normal',     // 'normal' | 'slow'
  currentCardIndex: 0,
  isFlipped: false,
  customOrderIds: null,    // Mảng ID khi người dùng xáo trộn
  progress: {},
  quiz: {
    questions: [],
    currentIndex: 0,
    score: 0,
    answered: false,
    wrongCards: []
  }
};

/**
 * =========================================================================
 * 1. CHUẨN HÓA DỮ LIỆU & KHÓA KIỂM TRA TRÙNG LẶP
 * =========================================================================
 */
function normalizeLevel(rawLevel) {
  const upper = String(rawLevel || 'N5').trim().toUpperCase();
  return ALLOWED_LEVELS.includes(upper) ? upper : 'N5';
}

function getDuplicateSignature(item) {
  const jp = String(item.jp || '').trim();
  const kanji = String(item.kanji || '').trim();
  // Khóa nhận diện trùng: kết hợp cách đọc Hiragana/Katakana + chữ Kanji
  return `${jp}||${kanji}`;
}

function generateStableCardId(item, fallbackIdx = 0) {
  const sig = getDuplicateSignature(item);
  if (sig !== '||') {
    return 'card_' + encodeURIComponent(sig);
  }
  return `card_idx_${fallbackIdx}_${Date.now()}`;
}

function normalizeCardObject(raw, idx = 0) {
  const jp = String(raw.jp || raw.kanji || '').trim();
  const kanji = String(raw.kanji || '').trim();
  const normalized = {
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

/**
 * =========================================================================
 * 2. NẠP & LƯU DỮ LIỆU (HỢP NHẤT DATA.JS + LOCALSTORAGE)
 * =========================================================================
 */
function loadRepository() {
  const fileCards = (typeof VOCAB_DATA !== 'undefined' && Array.isArray(VOCAB_DATA))
    ? VOCAB_DATA.map((item, idx) => ({ ...normalizeCardObject(item, idx), source: 'data.js' }))
    : [];

  let extraCards = [];
  try {
    const savedExtra = localStorage.getItem(EXTRA_CARDS_STORAGE_KEY);
    if (savedExtra) {
      const parsed = JSON.parse(savedExtra);
      if (Array.isArray(parsed)) {
        extraCards = parsed.map((item, idx) => ({ ...normalizeCardObject(item, idx), source: 'json' }));
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
    extraCards = [];
    state.progress = {};
  }

  // Hợp nhất data.js và thẻ nhập thêm từ JSON
  REPO_CARDS = [...fileCards, ...extraCards];
}

function saveExtraCardsToStorage() {
  try {
    const extraOnly = REPO_CARDS
      .filter(c => c.source === 'json')
      .map(({ source, ...rest }) => rest);
    localStorage.setItem(EXTRA_CARDS_STORAGE_KEY, JSON.stringify(extraOnly));
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
 * 3. KIỂM TRA TRÙNG LẶP TỪ VỰNG (TRONG KHO & KHI NHẬP JSON)
 * =========================================================================
 */
function findRepositoryDuplicates() {
  const seenMap = new Map();
  const duplicateGroups = [];

  REPO_CARDS.forEach((card, index) => {
    const sig = getDuplicateSignature(card);
    if (!seenMap.has(sig)) {
      seenMap.set(sig, [{ card, index }]);
    } else {
      seenMap.get(sig).push({ card, index });
    }
  });

  seenMap.forEach((entries, sig) => {
    if (entries.length > 1) {
      duplicateGroups.push({
        signature: sig,
        entries
      });
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
    statusTextEl.textContent = '✓ Kiểm tra trùng: Kho sạch, không có từ trùng lặp';
  } else {
    const extraCount = groups.reduce((sum, g) => sum + (g.entries.length - 1), 0);
    lineEl.classList.add('has-dup');
    statusTextEl.textContent = `⚠️ Phát hiện ${groups.length} từ bị trùng (${extraCount} bản thừa)`;
  }
}

function openDuplicateCheckerModal() {
  const groups = findRepositoryDuplicates();
  const bodyEl = document.getElementById('repo-dup-modal-body');
  const dedupeBtn = document.getElementById('dedupe-repo-btn');

  if (groups.length === 0) {
    bodyEl.innerHTML = `
      <div class="dup-check-box clean">
        ✓ Toàn bộ ${REPO_CARDS.length} từ vựng trong kho hiện tại đều là duy nhất, không có từ nào bị trùng lặp.
      </div>
    `;
    dedupeBtn.style.display = 'none';
  } else {
    const hasFileDuplicates = groups.some(g => g.entries.filter(e => e.card.source === 'data.js').length > 1);
    bodyEl.innerHTML = `
      <div class="dup-check-box warning">
        ⚠️ Tìm thấy ${groups.length} từ vựng xuất hiện nhiều hơn 1 lần trong kho:
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
  let removedCount = 0;

  REPO_CARDS.forEach(card => {
    const sig = getDuplicateSignature(card);
    if (!seen.has(sig)) {
      seen.add(sig);
      uniqueCards.push(card);
    } else if (card.source === 'json') {
      removedCount++;
    } else {
      // Giữ lại nếu nằm trong file data.js gốc nhưng đánh dấu cảnh báo
      uniqueCards.push(card);
    }
  });

  REPO_CARDS = uniqueCards;
  saveExtraCardsToStorage();
  closeDuplicateCheckerModal();
  refreshUI();
  showToast(removedCount > 0 ? `Đã dọn ${removedCount} bản trùng thừa!` : 'Đã kiểm tra xong (bản trùng nằm trong data.js)');
}

/**
 * =========================================================================
 * 4. BỘ PHÁT ÂM TIẾNG NHẬT TỰ NHIÊN
 * =========================================================================
 */
let currentAudioPlayer = null;

function stopSpeech() {
  if (currentAudioPlayer) {
    try {
      currentAudioPlayer.pause();
      currentAudioPlayer.currentTime = 0;
    } catch (e) {}
    currentAudioPlayer = null;
  }
  if ('speechSynthesis' in window) {
    try {
      window.speechSynthesis.cancel();
    } catch (e) {}
  }
}

function speakJapanese(text) {
  if (!text) return;
  stopSpeech();

  const cleanText = text.replace(/\s*\/\s*/g, '、').trim();
  const encoded = encodeURIComponent(cleanText);
  const ttsUrl = `https://translate.google.com/translate_tts?ie=UTF-8&tl=ja&client=tw-ob&q=${encoded}`;

  try {
    const audio = new Audio(ttsUrl);
    currentAudioPlayer = audio;
    audio.playbackRate = state.voiceMode === 'normal' ? 0.95 : 0.72;
    audio.onerror = () => speakFallback(cleanText);
    audio.play().catch(() => speakFallback(cleanText));
  } catch (e) {
    speakFallback(cleanText);
  }
}

function speakFallback(cleanText) {
  if (!('speechSynthesis' in window)) return;
  try {
    const utterance = new SpeechSynthesisUtterance(cleanText);
    utterance.lang = 'ja-JP';
    utterance.rate = state.voiceMode === 'slow' ? 0.7 : 0.94;
    window.speechSynthesis.speak(utterance);
  } catch (e) {}
}

function toggleSpeechRate() {
  state.voiceMode = state.voiceMode === 'normal' ? 'slow' : 'normal';
  const btn = document.getElementById('speech-rate-btn');
  btn.textContent = state.voiceMode === 'normal' ? 'Đọc: Chuẩn' : 'Đọc: Chậm';
  showToast(state.voiceMode === 'normal' ? 'Tốc độ đọc chuẩn' : 'Tốc độ đọc chậm');
  speakCurrentCard();
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
  else startQuiz(false);
}

function toggleUnmasteredFilter() {
  state.filterUnmastered = !state.filterUnmastered;
  state.currentCardIndex = 0;
  state.isFlipped = false;

  const btn = document.getElementById('filter-unmastered-btn');
  btn.classList.toggle('filter-active', state.filterUnmastered);

  if (state.mode === 'flashcard') renderFlashcard();
  else startQuiz(false);
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

  showToast('Đã xáo trộn thứ tự thẻ');
  if (state.mode === 'flashcard') renderFlashcard();
  else startQuiz(false);
}

/**
 * =========================================================================
 * 6. CẬP NHẬT GIAO DIỆN CHÍNH & LẬT THẺ 3D
 * =========================================================================
 */
function refreshUI() {
  const hasCards = REPO_CARDS.length > 0;

  // Cập nhật số lượng trên từng tab N5 / N4 / N3
  document.getElementById('count-ALL').textContent = REPO_CARDS.length;
  document.getElementById('count-N5').textContent = REPO_CARDS.filter(c => c.level === 'N5').length;
  document.getElementById('count-N4').textContent = REPO_CARDS.filter(c => c.level === 'N4').length;
  document.getElementById('count-N3').textContent = REPO_CARDS.filter(c => c.level === 'N3').length;

  document.getElementById('empty-app-state').style.display = hasCards ? 'none' : 'flex';
  document.getElementById('deck-stats-card').style.display = hasCards ? 'flex' : 'none';
  document.getElementById('toolbar-section').style.display = hasCards ? 'block' : 'none';
  document.getElementById('export-data-btn').style.display = hasCards ? 'inline-block' : 'none';

  if (!hasCards) {
    document.getElementById('flashcard-view').style.display = 'none';
    document.getElementById('quiz-view').style.display = 'none';
    return;
  }

  populateTopicDropdown();
  updateStatsHeader();
  updateRepoDuplicateBanner();

  if (state.mode === 'flashcard') {
    document.getElementById('flashcard-view').style.display = 'flex';
    document.getElementById('quiz-view').style.display = 'none';
    renderFlashcard();
  } else {
    document.getElementById('flashcard-view').style.display = 'none';
    document.getElementById('quiz-view').style.display = 'flex';
    startQuiz(false);
  }
}

function populateTopicDropdown() {
  const selectEl = document.getElementById('topic-select');
  const cardsInLevel = getCardsByLevel(state.selectedLevel);
  const topics = Array.from(new Set(cardsInLevel.map(c => c.topic)));

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
  speakJapanese(visible[state.currentCardIndex].jp);
}

function nextCard() {
  const visible = getFilteredCards();
  if (!visible.length) return;
  state.isFlipped = false;
  state.currentCardIndex = (state.currentCardIndex + 1) % visible.length;
  renderFlashcard();
}

function prevCard() {
  const visible = getFilteredCards();
  if (!visible.length) return;
  state.isFlipped = false;
  state.currentCardIndex = (state.currentCardIndex - 1 + visible.length) % visible.length;
  renderFlashcard();
}

function rateCurrentCard(rating) {
  const visible = getFilteredCards();
  if (!visible.length) return;

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
 * 7. TRẮC NGHIỆM THÔNG MINH THEO PHÂN CẤP (N5 -> N3)
 * =========================================================================
 */
function setMode(newMode) {
  state.mode = newMode;
  document.getElementById('mode-flashcard-btn').classList.toggle('active', newMode === 'flashcard');
  document.getElementById('mode-quiz-btn').classList.toggle('active', newMode === 'quiz');
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
  // N3: ưu tiên luyện đọc Kanji và chọn Kanji từ nghĩa Việt
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

  // Ưu tiên bốc đáp án nhiễu cùng cấp độ (N5/N4/N3)
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

  speakJapanese(currentCard.jp);
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
 * 8. NHẬP JSON + DÒNG CHECK TRÙNG LẶP TRỰC TIẾP + XUẤT TỆP DATA.JS
 * =========================================================================
 */
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
      topic: 'Động từ cơ bản',
      jp: 'たべます',
      kanji: '食べます',
      romaji: 'tabemasu',
      vi: 'Ăn',
      mnemonic: 'Bộ Thực (食 - ăn) đi kèm đuôi masu'
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
      mnemonic: 'Phán xét và đưa ra quyết断'
    }
  ];
  document.getElementById('import-json-text').value = JSON.stringify(sample, null, 2);
  runLiveDuplicateCheck(false);
}

function analyzeIncomingJson(rawText) {
  const parsed = JSON.parse(rawText);
  if (!Array.isArray(parsed) || parsed.length === 0) {
    throw new Error('Dữ liệu JSON phải là một mảng [...] có ít nhất 1 từ vựng.');
  }

  const defaultLevel = normalizeLevel(document.getElementById('import-default-level').value);
  const defaultTopic = document.getElementById('import-default-topic').value.trim() || 'Từ vựng chung';

  const existingMap = new Map(REPO_CARDS.map(c => [getDuplicateSignature(c), c]));
  const batchSeen = new Set();

  const newItems = [];
  const dupWithRepo = [];
  const dupInBatch = [];

  parsed.forEach((raw, idx) => {
    const item = normalizeCardObject({
      level: raw.level || defaultLevel,
      topic: raw.topic || defaultTopic,
      jp: raw.jp,
      kanji: raw.kanji,
      romaji: raw.romaji,
      vi: raw.vi,
      mnemonic: raw.mnemonic
    }, idx);

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
    summaryEl.textContent = '🔍 Dán JSON để tự động kiểm tra từ trùng lặp với kho hiện tại.';
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
      summaryEl.textContent = `✓ Check trùng: Hợp lệ ${result.newItems.length} từ mới, không có từ nào bị trùng!`;
      listEl.style.display = 'none';
      policyRowEl.style.display = 'none';
      if (explicitClick) showToast('Không có từ nào bị trùng lặp!');
    } else {
      boxEl.className = 'dup-check-box warning';
      summaryEl.textContent = `⚠️ Phát hiện ${totalDup} từ trùng (${result.newItems.length} từ mới hợp lệ):`;

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
      if (explicitClick) showToast(`Phát hiện ${totalDup} từ trùng lặp!`);
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

  // Thêm các từ mới hoàn toàn
  analysis.newItems.forEach(item => {
    REPO_CARDS.push({ ...item, source: 'json' });
    addedCount++;
  });

  // Xử lý các từ trùng với kho nếu người dùng chọn "Cập nhật đè"
  if (policy === 'overwrite' && analysis.dupWithRepo.length > 0) {
    analysis.dupWithRepo.forEach(({ incoming, existing }) => {
      const idx = REPO_CARDS.findIndex(c => c.id === existing.id);
      if (idx !== -1) {
        REPO_CARDS[idx] = {
          ...incoming,
          id: existing.id,
          source: existing.source
        };
        updatedCount++;
      }
    });
  }

  saveExtraCardsToStorage();
  document.getElementById('import-json-text').value = '';
  closeImportModal();
  refreshUI();

  if (updatedCount > 0) {
    showToast(`Đã thêm ${addedCount} từ mới & cập nhật ${updatedCount} từ!`);
  } else {
    showToast(`Đã thêm ${addedCount} từ mới (bỏ qua ${analysis.dupWithRepo.length + analysis.dupInBatch.length} từ trùng)!`);
  }
}

function exportDataJsFile() {
  const cleanExport = REPO_CARDS.map(({ id, source, ...rest }) => rest);
  const fileContent = `/**
 * TỆP DỮ LIỆU TỪ VỰNG TRUNG TÂM (N5 -> N3)
 * Xuất tự động từ ứng dụng Flashcards (${cleanExport.length} từ vựng)
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
 * 9. TIỆN ÍCH & CỬ CHỈ VUỐT MÀN HÌNH
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
  loadRepository();
  initSwipeGestures();
  refreshUI();
});