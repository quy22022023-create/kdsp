(function () {
  'use strict';

  const CONTENT_CACHE_KEY = 'jp_app_content_cache_v1';
  const PROGRESS_KEY = 'jp_app_progress_v1';
  const META_KEY = 'jp_app_meta_v1';
  const SESSION_SIZE = 12;
  const $ = (id) => document.getElementById(id);

  const DEMO_DATA = {
    vocabulary: [
      { id: 'demo-n5-watashi', level: 'N5', topic: 'Con người & gia đình', tag: 'noun', jp: 'わたし', kanji: '私', romaji: 'watashi', vi: 'Tôi', mnemonic: '私 là đại từ thường dùng để nói về bản thân.' },
      { id: 'demo-n5-gakusei', level: 'N5', topic: 'Con người & gia đình', tag: 'noun', jp: 'がくせい', kanji: '学生', romaji: 'gakusei', vi: 'Học sinh; sinh viên', mnemonic: '学 (học) + 生 (người/sinh) → người học.' },
      { id: 'demo-n5-tomodachi', level: 'N5', topic: 'Con người & gia đình', tag: 'noun', jp: 'ともだち', kanji: '友達', romaji: 'tomodachi', vi: 'Bạn bè', mnemonic: 'Từ chỉ bạn bè, người quen thân.' },
      { id: 'demo-n5-kazoku', level: 'N5', topic: 'Con người & gia đình', tag: 'noun', jp: 'かぞく', kanji: '家族', romaji: 'kazoku', vi: 'Gia đình', mnemonic: '家 là nhà, 族 là nhóm/người cùng một nhà.' },
      { id: 'demo-n5-gakkou', level: 'N5', topic: 'Địa điểm', tag: 'noun', jp: 'がっこう', kanji: '学校', romaji: 'gakkou', vi: 'Trường học', mnemonic: '学 (học) + 校 (trường).' },
      { id: 'demo-n5-hon', level: 'N5', topic: 'Đồ vật thường ngày', tag: 'noun', jp: 'ほん', kanji: '本', romaji: 'hon', vi: 'Sách', mnemonic: '本 còn có nghĩa là gốc hoặc nguồn trong một số từ ghép.' },
      { id: 'demo-n5-mizu', level: 'N5', topic: 'Đồ vật thường ngày', tag: 'noun', jp: 'みず', kanji: '水', romaji: 'mizu', vi: 'Nước', mnemonic: 'Kanji 水 có thể gặp trong 水曜日 (thứ Tư).' },
      { id: 'demo-n5-tabemasu', level: 'N5', topic: 'Ăn uống', tag: 'v2', jp: 'たべます', kanji: '食べます', romaji: 'tabemasu', vi: 'Ăn', mnemonic: 'Động từ nhóm 2. Thể từ điển: 食べる.' },
      { id: 'demo-n5-nomimasu', level: 'N5', topic: 'Ăn uống', tag: 'v1', jp: 'のみます', kanji: '飲みます', romaji: 'nomimasu', vi: 'Uống', mnemonic: 'Động từ nhóm 1. Thể từ điển: 飲む.' },
      { id: 'demo-n5-ikimasu', level: 'N5', topic: 'Di chuyển', tag: 'v1', jp: 'いきます', kanji: '行きます', romaji: 'ikimasu', vi: 'Đi', mnemonic: '行く là thể từ điển; 行きます là thể lịch sự.' },
      { id: 'demo-n5-mimasu', level: 'N5', topic: 'Hoạt động hằng ngày', tag: 'v2', jp: 'みます', kanji: '見ます', romaji: 'mimasu', vi: 'Xem; nhìn', mnemonic: 'Động từ nhóm 2. Thể từ điển: 見る.' },
      { id: 'demo-n5-kyou', level: 'N5', topic: 'Thời gian', tag: 'noun', jp: 'きょう', kanji: '今日', romaji: 'kyou', vi: 'Hôm nay', mnemonic: '今日 đọc là きょう, nghĩa là hôm nay.' },
      { id: 'demo-n5-ashita', level: 'N5', topic: 'Thời gian', tag: 'noun', jp: 'あした', kanji: '明日', romaji: 'ashita', vi: 'Ngày mai', mnemonic: '明日 có cách đọc phổ biến là あした.' },
      { id: 'demo-n5-arigatou', level: 'N5', topic: 'Giao tiếp', tag: 'expression', jp: 'ありがとう', kanji: '有難う', romaji: 'arigatou', vi: 'Cảm ơn', mnemonic: 'ありがとう là cách nói cảm ơn thân mật; ありがとうございます lịch sự hơn.' },
      { id: 'demo-n5-ohayou', level: 'N5', topic: 'Giao tiếp', tag: 'expression', jp: 'おはようございます', kanji: '', romaji: 'ohayou gozaimasu', vi: 'Chào buổi sáng (lịch sự)', mnemonic: 'Cách chào lịch sự vào buổi sáng.' }
    ],
    grammar: [
      { id: 'demo-gr-n5-wa-desu', level: 'N5', topic: 'Câu cơ bản', order: 1, pattern: 'N は N です', meaning: 'N là N; dùng để giới thiệu hoặc xác định chủ đề.', structure: 'Danh từ 1 + は + Danh từ 2 + です。', usage: 'は đánh dấu chủ đề của câu. です tạo sắc thái lịch sự, thường tương đương “là”.', explanation: 'は được viết là ha nhưng khi làm trợ từ chủ đề thường đọc là wa.', examples: [{ id: 'ex1', jp: 'わたしは がくせいです。', reading: 'わたしは がくせいです。', romaji: 'Watashi wa gakusei desu.', vi: 'Tôi là học sinh/sinh viên.', notes: 'は nêu chủ đề 私.' }], commonMistakes: ['Không đọc trợ từ は trong câu này là ha; đọc là wa.'], exercises: [] },
      { id: 'demo-gr-n5-o-masu', level: 'N5', topic: 'Động từ cơ bản', order: 2, pattern: 'N を Vます', meaning: 'Diễn tả hành động tác động lên tân ngữ.', structure: 'Danh từ + を + Động từ thể ます。', usage: 'を đánh dấu tân ngữ trực tiếp của ngoại động từ.', explanation: 'Trợ từ を thường được phát âm là o trong tiếng Nhật hiện đại.', examples: [{ id: 'ex2', jp: 'ほんを よみます。', reading: 'ほんを よみます。', romaji: 'Hon o yomimasu.', vi: 'Tôi đọc sách.', notes: 'ほん là tân ngữ của よみます.' }], commonMistakes: ['Không nhầm を với は khi danh từ là đối tượng trực tiếp của hành động.'], exercises: [] },
      { id: 'demo-gr-n5-de', level: 'N5', topic: 'Trợ từ cơ bản', order: 3, pattern: 'N で Vます', meaning: 'Diễn tả địa điểm diễn ra hành động hoặc phương tiện/cách thức.', structure: 'Địa điểm + で + động từ; phương tiện + で + động từ。', usage: 'で có nhiều cách dùng; cần dựa vào ngữ cảnh để xác định nghĩa.', explanation: 'Phân biệt に chỉ điểm đến/đích đến trong nhiều mẫu câu với で chỉ nơi hành động diễn ra.', examples: [{ id: 'ex3', jp: 'としょかんで べんきょうします。', reading: 'としょかんで べんきょうします。', romaji: 'Toshokan de benkyou shimasu.', vi: 'Tôi học ở thư viện.', notes: 'で đánh dấu địa điểm diễn ra hoạt động.' }], commonMistakes: ['Không dùng で thay cho に trong mọi trường hợp chỉ địa điểm.'], exercises: [] }
    ],
    exercises: [
      { id: 'demo-ex-1', type: 'exercise', kind: 'cloze', level: 'N5', topic: 'Câu cơ bản', refs: ['わたし'], prompt_jp: 'わたし（　）がくせいです。', prompt_vi: 'Tôi là học sinh/sinh viên.', options: ['は', 'を', 'で', 'と'], answer: 'は', explanation: 'は đánh dấu chủ đề của câu: わたしは がくせいです。' },
      { id: 'demo-ex-2', type: 'exercise', kind: 'cloze', level: 'N5', topic: 'Động từ cơ bản', refs: ['ほん'], prompt_jp: 'ほん（　）よみます。', prompt_vi: 'Tôi đọc sách.', options: ['を', 'は', 'へ', 'が'], answer: 'を', explanation: 'を đánh dấu tân ngữ trực tiếp của よみます.' },
      { id: 'demo-ex-3', type: 'exercise', kind: 'choice', level: 'N5', topic: 'Từ vựng', refs: ['みず'], prompt_jp: 'みず', prompt_vi: 'Chọn nghĩa đúng của từ này.', options: ['Nước', 'Lửa', 'Đất', 'Gió'], answer: 'Nước', explanation: 'みず（⽔）có nghĩa là nước.' }
    ]
  };

  let content = { vocabulary: [], grammar: [], exercises: [] };
  let progress = {};
  let meta = { streak: 0, lastStudyDate: '' };
  let currentPage = 'home';
  let roadmapLevel = 'N5';
  let selectedVocab = null;
  let studyCards = [];
  let studyIndex = 0;
  let studyTitle = 'Phiên học';
  let studyRated = new Set();
  let practiceSession = null;
  let practiceTimer = null;
  let toastTimer = null;
  let authMode = 'signin';
  let kanaScript = 'hiragana';
  let selectedKana = null;
  let currentUser = null;
  let accountSyncPromise = null;
  let isDemoMode = false;

  const KANA = {
    hiragana: [
      ['あ','a'],['い','i'],['う','u'],['え','e'],['お','o'],['か','ka'],['き','ki'],['く','ku'],['け','ke'],['こ','ko'],
      ['さ','sa'],['し','shi'],['す','su'],['せ','se'],['そ','so'],['た','ta'],['ち','chi'],['つ','tsu'],['て','te'],['と','to'],
      ['な','na'],['に','ni'],['ぬ','nu'],['ね','ne'],['の','no'],['は','ha'],['ひ','hi'],['ふ','fu'],['へ','he'],['ほ','ho'],
      ['ま','ma'],['み','mi'],['む','mu'],['め','me'],['も','mo'],['や','ya'],['ゆ','yu'],['よ','yo'],['ら','ra'],['り','ri'],
      ['る','ru'],['れ','re'],['ろ','ro'],['わ','wa'],['を','o'],['ん','n']
    ],
    katakana: [
      ['ア','a'],['イ','i'],['ウ','u'],['エ','e'],['オ','o'],['カ','ka'],['キ','ki'],['ク','ku'],['ケ','ke'],['コ','ko'],
      ['サ','sa'],['シ','shi'],['ス','su'],['セ','se'],['ソ','so'],['タ','ta'],['チ','chi'],['ツ','tsu'],['テ','te'],['ト','to'],
      ['ナ','na'],['ニ','ni'],['ヌ','nu'],['ネ','ne'],['ノ','no'],['ハ','ha'],['ヒ','hi'],['フ','fu'],['ヘ','he'],['ホ','ho'],
      ['マ','ma'],['ミ','mi'],['ム','mu'],['メ','me'],['モ','mo'],['ヤ','ya'],['ユ','yu'],['ヨ','yo'],['ラ','ra'],['リ','ri'],
      ['ル','ru'],['レ','re'],['ロ','ro'],['ワ','wa'],['ヲ','o'],['ン','n']
    ]
  };

  function escapeHtml(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function hashId(value) {
    let hash = 0;
    const text = String(value || '');
    for (let i = 0; i < text.length; i += 1) hash = ((hash << 5) - hash + text.charCodeAt(i)) | 0;
    return Math.abs(hash).toString(36);
  }

  function normalizeLevel(value) {
    const level = String(value || 'N5').toUpperCase();
    return ['N5', 'N4', 'N3'].includes(level) ? level : 'N5';
  }

  function normalizeContent(raw) {
    const source = raw && typeof raw === 'object' ? raw : {};
    const vocabRaw = Array.isArray(source.vocabulary) ? source.vocabulary : (Array.isArray(source.vocab) ? source.vocab : []);
    const grammarRaw = Array.isArray(source.grammar) ? source.grammar : [];
    const exerciseRaw = Array.isArray(source.exercises) ? source.exercises : (Array.isArray(source.exercise) ? source.exercise : []);

    const vocabulary = vocabRaw.filter((item) => item && typeof item === 'object' && item.jp && item.vi).map((item) => {
      const level = normalizeLevel(item.level);
      const jp = String(item.jp).trim();
      const kanji = String(item.kanji || '').trim();
      return { ...item, id: String(item.id || `vc_${hashId(`${level}|${jp}|${kanji}`)}`), level, topic: String(item.topic || 'Tổng hợp'), jp, kanji, romaji: String(item.romaji || ''), vi: String(item.vi), mnemonic: String(item.mnemonic || ''), tag: String(item.tag || '') };
    });

    const grammar = grammarRaw.filter((item) => item && typeof item === 'object' && item.pattern).map((item) => ({
      ...item, id: String(item.id || `gr_${hashId(`${item.level || 'N5'}|${item.pattern}`)}`),
      level: normalizeLevel(item.level), topic: String(item.topic || 'Tổng hợp'),
      pattern: String(item.pattern), meaning: String(item.meaning || ''), structure: String(item.structure || ''),
      usage: String(item.usage || ''), explanation: String(item.explanation || ''),
      examples: Array.isArray(item.examples) ? item.examples : [],
      commonMistakes: Array.isArray(item.commonMistakes) ? item.commonMistakes : []
    }));

    const exercises = exerciseRaw.filter((item) => item && typeof item === 'object' && (item.prompt_jp || item.jp)).map((item) => ({
      ...item, id: String(item.id || `ex_${hashId(`${item.level || 'N5'}|${item.kind || 'choice'}|${item.prompt_jp || item.jp}|${item.answer || ''}`)}`),
      type: 'exercise', level: normalizeLevel(item.level), topic: String(item.topic || 'Bài tập tổng hợp'),
      kind: String(item.kind || 'choice'), prompt_jp: String(item.prompt_jp || item.jp || ''),
      prompt_vi: String(item.prompt_vi || item.vi || ''), options: Array.isArray(item.options) ? item.options.map(String) : [],
      answer: String(item.answer || ''), explanation: String(item.explanation || ''), refs: Array.isArray(item.refs) ? item.refs : []
    }));
    return { vocabulary, grammar, exercises };
  }

  function totalContentCount(data = content) {
    return (data.vocabulary || []).length + (data.grammar || []).length + (data.exercises || []).length;
  }

  function getProgress(type, id) {
    return progress[`${type}:${id}`] || null;
  }

  function getProgressData(type, id) {
    const record = getProgress(type, id);
    return record && record.data && typeof record.data === 'object' ? record.data : {};
  }

  function getVocabStatus(card) {
    return getProgressData('vocab', card.id).status || 'new';
  }

  function isCardDue(card) {
    const data = getProgressData('vocab', card.id);
    if (!data.dueAt) return data.status === 'review';
    return Number(data.dueAt) <= Date.now();
  }

  function getDueCards(cards = content.vocabulary) {
    return cards.filter(isCardDue).sort((a, b) => {
      const aDue = Number(getProgressData('vocab', a.id).dueAt) || 0;
      const bDue = Number(getProgressData('vocab', b.id).dueAt) || 0;
      return aDue - bDue;
    });
  }

  function saveProgressMap() {
    AppStore.set(PROGRESS_KEY, progress).then((saved) => {
      if (!saved) showToast('Không thể lưu tiến độ trên thiết bị. Hãy kiểm tra dung lượng trình duyệt.');
    });
    scheduleRemoteSync();
  }

  function updateProgress(type, id, data) {
    const key = `${type}:${id}`;
    progress[key] = { itemType: type, itemId: id, data: { ...(getProgressData(type, id)), ...data }, updatedAt: new Date().toISOString() };
    saveProgressMap();
  }

  function markStudyActivity() {
    const today = new Date();
    const dateKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    if (meta.lastStudyDate !== dateKey) {
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayKey = `${yesterday.getFullYear()}-${String(yesterday.getMonth() + 1).padStart(2, '0')}-${String(yesterday.getDate()).padStart(2, '0')}`;
      meta.streak = meta.lastStudyDate === yesterdayKey ? (Number(meta.streak) || 0) + 1 : 1;
      meta.lastStudyDate = dateKey;
      AppStore.set(META_KEY, meta);
    }
  }

  function recordVocabReview(card, correct) {
    if (!card || !card.id) return;
    const old = getProgressData('vocab', card.id);
    const now = Date.now();
    let repetitions = Number(old.repetitions) || 0;
    let intervalDays = Number(old.intervalDays) || 0;
    let easeFactor = Number(old.easeFactor) || 2.5;
    let correctCount = Number(old.correctCount) || 0;
    let incorrectCount = Number(old.incorrectCount) || 0;
    let lapses = Number(old.lapses) || 0;
    let dueAt;

    if (correct) {
      correctCount += 1;
      repetitions += 1;
      if (repetitions === 1) intervalDays = 1;
      else if (repetitions === 2) intervalDays = 3;
      else intervalDays = Math.max(1, Math.round(intervalDays * easeFactor));
      easeFactor = Math.min(2.8, Math.max(1.3, easeFactor + 0.05));
      dueAt = now + intervalDays * 86400000;
    } else {
      incorrectCount += 1;
      lapses += 1;
      repetitions = 0;
      intervalDays = 0;
      easeFactor = Math.max(1.3, easeFactor - 0.2);
      dueAt = now + 10 * 60 * 1000;
    }

    updateProgress('vocab', card.id, {
      status: correct ? 'known' : 'review', repetitions, intervalDays,
      easeFactor: Number(easeFactor.toFixed(2)), correctCount, incorrectCount,
      lapses, lastReviewedAt: now, dueAt
    });
    markStudyActivity();
  }

  function showToast(message) {
    const toast = $('toast');
    if (!toast) return;
    toast.textContent = message;
    toast.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove('show'), 2600);
  }

  function setConnectionState(label, kind) {
    const el = $('connection-state');
    if (!el) return;
    el.textContent = label;
    el.classList.remove('online', 'offline');
    if (kind) el.classList.add(kind);
  }

  function setPage(page) {
    const valid = ['home', 'roadmap', 'vocab', 'grammar', 'kana', 'practice', 'review', 'learn'];
    currentPage = valid.includes(page) ? page : 'home';
    document.querySelectorAll('.page').forEach((node) => {
      const active = node.id === `page-${currentPage}`;
      node.classList.toggle('active', active);
      node.hidden = !active;
    });
    document.querySelectorAll('[data-page]').forEach((button) => {
      button.classList.toggle('active', button.dataset.page === currentPage);
    });
    if (currentPage === 'home') renderHome();
    if (currentPage === 'roadmap') renderRoadmap();
    if (currentPage === 'vocab') renderVocabList();
    if (currentPage === 'grammar') renderGrammarList();
    if (currentPage === 'kana') renderKana();
    if (currentPage === 'review') renderReview();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function renderHome() {
    const cards = content.vocabulary;
    const known = cards.filter((card) => getVocabStatus(card) === 'known').length;
    const due = getDueCards(cards).length;
    $('stat-vocab').textContent = String(cards.length);
    $('stat-mastered').textContent = String(known);
    $('stat-due').textContent = String(due);
    $('stat-streak').textContent = String(meta.streak || 0);
    $('today-label').textContent = new Intl.DateTimeFormat('vi-VN', { weekday: 'long', day: 'numeric', month: 'long' }).format(new Date());
    $('welcome-summary').textContent = cards.length
      ? `${cards.length} từ vựng đang có trong kho. ${due ? `${due} từ đã đến hạn ôn.` : 'Bạn có thể học từ mới hoặc ôn lại kiến thức đã học.'}`
      : 'Bắt đầu với bảng chữ cái, sau đó học từ vựng và ngữ pháp theo từng cấp độ.';
    $('empty-content-panel').hidden = totalContentCount() > 0;
    renderHomeLevels();
  }

  function renderHomeLevels() {
    const host = $('home-levels');
    const levels = ['N5', 'N4', 'N3'];
    host.innerHTML = levels.map((level) => {
      const cards = content.vocabulary.filter((card) => card.level === level);
      const known = cards.filter((card) => getVocabStatus(card) === 'known').length;
      const pct = cards.length ? Math.round((known / cards.length) * 100) : 0;
      return `<div class="level-progress-item"><span class="level-square">${level}</span><div class="level-progress-copy"><strong>${level === 'N5' ? 'Sơ cấp 1' : level === 'N4' ? 'Sơ cấp 2' : 'Trung cấp'}</strong><div class="progress-track"><span style="width:${pct}%"></span></div><small>${known}/${cards.length} từ đã nhớ</small></div><span class="progress-percent">${pct}%</span></div>`;
    }).join('');
  }

  function renderRoadmap() {
    const host = $('roadmap-lessons');
    const cards = content.vocabulary.filter((card) => card.level === roadmapLevel);
    const grammar = content.grammar.filter((item) => item.level === roadmapLevel);
    const topics = new Set([...cards.map((card) => card.topic), ...grammar.map((item) => item.topic)]);
    const topicList = Array.from(topics).sort((a, b) => a.localeCompare(b, 'vi'));
    const known = cards.filter((card) => getVocabStatus(card) === 'known').length;
    const pct = cards.length ? Math.round(known / cards.length * 100) : 0;
    $('roadmap-summary').innerHTML = `<strong>${pct}%</strong><span>${known}/${cards.length} từ đã nhớ ở ${roadmapLevel}</span><span>${grammar.length} điểm ngữ pháp</span>`;
    const kanaCard = roadmapLevel === 'N5' ? `<article class="lesson-card"><span class="lesson-number">あ</span><div><h3>Bảng chữ cái Hiragana & Katakana</h3><p>Học nhận diện 46 âm cơ bản và nghe phát âm.</p></div><button class="button button-outline" data-goto="kana" type="button">Bắt đầu →</button></article>` : '';
    const topicCards = topicList.map((topic, index) => {
      const topicCards = cards.filter((card) => card.topic === topic);
      const topicGrammar = grammar.filter((item) => item.topic === topic);
      const mastered = topicCards.filter((card) => getVocabStatus(card) === 'known').length;
      const percent = topicCards.length ? Math.round(mastered / topicCards.length * 100) : 0;
      return `<article class="lesson-card"><span class="lesson-number">${String(index + 1).padStart(2, '0')}</span><div><h3>${escapeHtml(topic)}</h3><p>${topicCards.length} từ vựng · ${topicGrammar.length} điểm ngữ pháp</p><div class="lesson-progress"><div class="progress-track"><span style="width:${percent}%"></span></div><small>${mastered}/${topicCards.length} đã nhớ</small></div></div><button class="button button-outline" data-topic="${escapeHtml(topic)}" type="button">Học chủ đề →</button></article>`;
    }).join('');
    host.innerHTML = kanaCard + topicCards + ((!topicCards && !kanaCard) || (!topicList.length && !kanaCard) ? '<div class="empty-message">Chưa có học liệu cho cấp độ này. Nội dung sẽ xuất hiện tại đây sau khi quản trị viên nạp một đợt dữ liệu mới.</div>' : '');
    document.querySelectorAll('[data-level]').forEach((button) => button.classList.toggle('active', button.dataset.level === roadmapLevel));
  }

  function getFilteredVocab() {
    const level = $('vocab-level-filter').value;
    const topic = $('vocab-topic-filter').value;
    const query = $('vocab-search').value.trim().toLocaleLowerCase();
    return content.vocabulary.filter((card) => {
      if (level !== 'ALL' && card.level !== level) return false;
      if (topic !== 'ALL' && card.topic !== topic) return false;
      if (!query) return true;
      return [card.jp, card.kanji, card.romaji, card.vi, card.topic].join(' ').toLocaleLowerCase().includes(query);
    });
  }

  function renderVocabList() {
    const topicSelect = $('vocab-topic-filter');
    const selectedTopic = topicSelect.value;
    const topics = Array.from(new Set(content.vocabulary.map((card) => card.topic))).sort((a, b) => a.localeCompare(b, 'vi'));
    topicSelect.innerHTML = '<option value="ALL">Tất cả chủ đề</option>' + topics.map((topic) => `<option value="${escapeHtml(topic)}">${escapeHtml(topic)}</option>`).join('');
    topicSelect.value = topics.includes(selectedTopic) ? selectedTopic : 'ALL';
    const cards = getFilteredVocab();
    $('vocab-count-label').textContent = `${cards.length} / ${content.vocabulary.length} từ`;
    $('vocab-list').innerHTML = cards.length ? cards.map((card) => {
      const status = getVocabStatus(card);
      const statusText = status === 'known' ? '✓' : status === 'review' ? '↻' : '•';
      return `<button class="vocab-item" data-vocab-id="${escapeHtml(card.id)}" type="button"><span class="vocab-jp-icon">${escapeHtml((card.kanji || card.jp).slice(0, 2))}</span><span class="vocab-item-copy"><strong>${escapeHtml(card.kanji || card.jp)}</strong><small>${escapeHtml(card.jp)} · ${escapeHtml(card.vi)}</small></span><span class="vocab-item-status" title="${status === 'known' ? 'Đã nhớ' : status === 'review' ? 'Cần ôn' : 'Chưa học'}">${statusText}</span></button>`;
    }).join('') : '<div class="empty-message">Không tìm thấy từ phù hợp. Hãy đổi bộ lọc hoặc nạp thêm học liệu.</div>';
  }

  function renderGrammarList() {
    const level = $('grammar-level-filter').value;
    const query = $('grammar-search').value.trim().toLocaleLowerCase();
    const items = content.grammar.filter((item) => (level === 'ALL' || item.level === level) && (!query || [item.pattern, item.meaning, item.topic, item.structure].join(' ').toLocaleLowerCase().includes(query)));
    $('grammar-list').innerHTML = items.length ? items.map((item) => {
      const examples = item.examples.map((example) => `<div class="grammar-example"><strong>${escapeHtml(example.jp || '')}</strong><span>${escapeHtml(example.romaji || example.reading || '')}${example.vi ? ` · ${escapeHtml(example.vi)}` : ''}</span>${example.notes ? `<span>${escapeHtml(example.notes)}</span>` : ''}</div>`).join('');
      const mistakes = item.commonMistakes.length ? `<ul>${item.commonMistakes.map((mistake) => `<li>${escapeHtml(mistake)}</li>`).join('')}</ul>` : '';
      const done = getProgressData('grammar', item.id).status === 'known';
      return `<details class="grammar-card"><summary><span class="tag">${escapeHtml(item.level)}</span><strong class="grammar-pattern">${escapeHtml(item.pattern)}</strong><span class="grammar-summary-copy"><strong>${escapeHtml(item.meaning || item.topic)}</strong><small>${escapeHtml(item.topic)}</small></span><span class="grammar-chevron">⌄</span></summary><div class="grammar-body"><h4>Cấu trúc</h4><p>${escapeHtml(item.structure || 'Chưa bổ sung cấu trúc.')}</p><h4>Cách dùng</h4><p>${escapeHtml(item.usage || item.explanation || 'Chưa có giải thích chi tiết.')}</p>${examples ? `<h4>Ví dụ</h4>${examples}` : ''}${mistakes ? `<h4>Lỗi thường gặp</h4>${mistakes}` : ''}<button class="button ${done ? 'button-known' : 'button-outline'} grammar-complete-button" data-grammar-complete="${escapeHtml(item.id)}" type="button">${done ? 'Đã hoàn thành ✓' : 'Đánh dấu đã học'}</button></div></details>`;
    }).join('') : '<div class="empty-message">Chưa có dữ liệu ngữ pháp phù hợp. Quản trị viên có thể bổ sung từng đợt qua admin.html.</div>';
  }

  function renderKana() {
    const rows = KANA[kanaScript];
    if (!selectedKana || !rows.some((row) => row[0] === selectedKana[0])) selectedKana = rows[0];
    $('kana-selected-char').textContent = selectedKana[0];
    $('kana-selected-romaji').textContent = selectedKana[1];
    $('kana-grid').innerHTML = rows.map(([char, romaji]) => `<button class="kana-cell ${selectedKana[0] === char ? 'active' : ''}" data-kana-char="${char}" data-kana-romaji="${romaji}" type="button"><strong>${char}</strong><small>${romaji}</small></button>`).join('');
    document.querySelectorAll('[data-kana-script]').forEach((button) => button.classList.toggle('active', button.dataset.kanaScript === kanaScript));
  }

  function speakJapanese(text) {
    if (!text || !('speechSynthesis' in window)) {
      showToast('Trình duyệt này chưa hỗ trợ phát âm tự động.');
      return;
    }
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(String(text));
    utterance.lang = 'ja-JP';
    utterance.rate = 0.82;
    window.speechSynthesis.speak(utterance);
  }

  function buildPracticeQuestion(exercise) {
    let options = Array.isArray(exercise.options) ? [...exercise.options] : [];
    let answer = String(exercise.answer || '');
    if ((!answer || options.length < 2) && exercise.vi) {
      answer = String(exercise.vi);
      options = [answer, ...(Array.isArray(exercise.distractors) ? exercise.distractors : [])];
    }
    if (options.length < 2 || !answer) return null;
    if (!options.includes(answer)) options.unshift(answer);
    options = Array.from(new Set(options.map(String))).slice(0, 6);
    return {
      source: 'exercise', id: exercise.id, level: exercise.level,
      jp: exercise.prompt_jp || exercise.jp || exercise.prompt || '',
      prompt: exercise.prompt_vi || exercise.promptVi || exercise.prompt || 'Chọn đáp án đúng.', options: shuffle(options),
      answer, explanation: exercise.explanation || 'Đối chiếu cấu trúc câu và ngữ cảnh.', refs: exercise.refs || []
    };
  }

  function shuffle(items) {
    const array = [...items];
    for (let i = array.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
  }

  function createVocabQuestion(card, pool) {
    const distractors = shuffle(pool.filter((item) => item.id !== card.id && item.vi !== card.vi)).slice(0, 3).map((item) => item.vi);
    const options = shuffle([card.vi, ...distractors]);
    return { source: 'vocab', id: card.id, level: card.level, jp: card.kanji || card.jp, prompt: 'Chọn nghĩa tiếng Việt đúng.', options, answer: card.vi, explanation: `${card.jp}${card.romaji ? ` (${card.romaji})` : ''} có nghĩa là “${card.vi}”.`, refs: [card.jp] };
  }

  function startPractice() {
    const level = $('practice-level').value;
    const count = Number($('practice-count').value) || 10;
    const vocabPool = content.vocabulary.filter((card) => level === 'ALL' || card.level === level);
    const grammarExercises = content.grammar.flatMap((grammar) => (Array.isArray(grammar.exercises) ? grammar.exercises : []).map((exercise, index) => ({
      ...exercise, type: 'exercise', id: String(exercise.id || `${grammar.id}_ex_${index + 1}`),
      level: exercise.level || grammar.level, topic: exercise.topic || grammar.topic,
      prompt_jp: exercise.prompt_jp || exercise.jp || exercise.prompt || grammar.pattern,
      prompt_vi: exercise.prompt_vi || exercise.promptVi || exercise.prompt || grammar.meaning,
      refs: exercise.refs || grammar.vocabularyRefs || []
    })));
    const exercises = [...content.exercises, ...grammarExercises]
      .filter((item) => level === 'ALL' || item.level === level)
      .map(buildPracticeQuestion).filter(Boolean);
    let questions = shuffle(exercises);
    if (questions.length < count && vocabPool.length >= 2) {
      const extra = shuffle(vocabPool).slice(0, Math.min(count - questions.length, vocabPool.length)).map((card) => createVocabQuestion(card, vocabPool));
      questions = questions.concat(extra);
    }
    questions = shuffle(questions).slice(0, count);
    if (!questions.length) {
      showToast('Chưa có đủ dữ liệu để tạo bài luyện tập. Hãy nạp thêm từ vựng hoặc bài tập.');
      return;
    }
    practiceSession = { questions, index: 0, score: 0, answered: false };
    $('practice-start-panel').hidden = true;
    $('practice-session').hidden = false;
    setPage('practice');
    renderPracticeQuestion();
  }

  function renderPracticeQuestion() {
    const session = practiceSession;
    if (!session) return;
    if (session.index >= session.questions.length) {
      $('practice-session').innerHTML = `<div class="completion-mark">✓</div><h2 style="text-align:center">Hoàn thành luyện tập</h2><p class="muted" style="text-align:center">Bạn trả lời đúng ${session.score}/${session.questions.length} câu.</p><div class="completion-actions"><button id="practice-again" class="button button-primary" type="button">Luyện phiên mới</button><button id="practice-back" class="button button-outline" type="button">Về tổng quan</button></div>`;
      return;
    }
    const question = session.questions[session.index];
    session.answered = false;
    $('practice-session').innerHTML = `<div class="quiz-topline"><span>Câu ${session.index + 1}/${session.questions.length}</span><span>Điểm: ${session.score}</span></div><div class="progress-track" style="margin-top:10px"><span style="width:${(session.index / session.questions.length) * 100}%"></span></div><div class="quiz-question"><p class="eyebrow">${escapeHtml(question.level || 'JLPT')}</p><h2>${escapeHtml(question.jp)}</h2><p>${escapeHtml(question.prompt)}</p></div><div class="quiz-options">${question.options.map((option, index) => `<button class="quiz-option" data-practice-option="${index}" type="button">${escapeHtml(option)}</button>`).join('')}</div><div id="quiz-feedback" class="quiz-feedback" hidden></div><div class="quiz-footer"><span class="muted">${question.source === 'exercise' ? 'Bài tập trong học liệu' : 'Ôn từ vựng'}</span><button id="practice-next" class="button button-primary" type="button" disabled>Tiếp theo →</button></div>`;
  }

  function answerPractice(optionIndex) {
    const session = practiceSession;
    if (!session || session.answered) return;
    const question = session.questions[session.index];
    const selected = question.options[optionIndex];
    const correct = selected === question.answer;
    session.answered = true;
    if (correct) session.score += 1;

    if (question.source === 'vocab') {
      const card = content.vocabulary.find((item) => item.id === question.id);
      if (card) recordVocabReview(card, correct);
    } else {
      updateProgress('exercise', question.id, { status: correct ? 'known' : 'review', lastAnsweredAt: Date.now(), correctCount: Number(getProgressData('exercise', question.id).correctCount || 0) + (correct ? 1 : 0) });
      const linked = content.vocabulary.filter((card) => question.refs.some((ref) => ref === card.id || ref === card.jp || ref === card.kanji));
      linked.forEach((card) => recordVocabReview(card, correct));
      markStudyActivity();
    }

    document.querySelectorAll('[data-practice-option]').forEach((button) => {
      const index = Number(button.dataset.practiceOption);
      button.disabled = true;
      if (question.options[index] === question.answer) button.classList.add('correct');
      else if (index === optionIndex) button.classList.add('incorrect');
    });
    const feedback = $('quiz-feedback');
    feedback.hidden = false;
    feedback.innerHTML = `<strong>${correct ? 'Chính xác!' : `Chưa đúng. Đáp án: ${escapeHtml(question.answer)}`}</strong><p>${escapeHtml(question.explanation)}</p>`;
    $('practice-next').disabled = false;
    $('practice-next').textContent = session.index === session.questions.length - 1 ? 'Xem kết quả →' : 'Tiếp theo →';
  }

  function nextPracticeQuestion() {
    if (!practiceSession) return;
    practiceSession.index += 1;
    renderPracticeQuestion();
  }

  function renderReview() {
    const level = $('review-level-filter').value;
    const cards = content.vocabulary.filter((card) => level === 'ALL' || card.level === level);
    const due = getDueCards(cards);
    const weak = cards.filter((card) => {
      const data = getProgressData('vocab', card.id);
      return data.status === 'review' || Number(data.incorrectCount) > 0;
    }).sort((a, b) => Number(getProgressData('vocab', b.id).incorrectCount || 0) - Number(getProgressData('vocab', a.id).incorrectCount || 0));
    $('review-due-count').textContent = String(due.length);
    $('review-description').textContent = due.length ? `Có ${due.length} từ cần ôn. Từ đến hạn sớm được ưu tiên trước.` : 'Hiện chưa có từ đến hạn. Bạn có thể xem lại các từ chưa vững hoặc học từ mới.';
    $('start-review-button').textContent = due.length ? 'Bắt đầu ôn tập →' : weak.length ? 'Ôn từ chưa vững →' : 'Ôn lại toàn bộ từ →';
    $('review-weak-list').innerHTML = weak.length ? weak.slice(0, 6).map((card) => `<div class="compact-row"><div><strong>${escapeHtml(card.kanji || card.jp)}</strong><small>${escapeHtml(card.vi)}</small></div><em>${Number(getProgressData('vocab', card.id).incorrectCount || 0)} lần sai</em></div>`).join('') : '<div class="empty-message">Chưa có từ cần chú ý. Hãy bắt đầu học để tạo lịch ôn tập.</div>';
    const known = cards.filter((card) => getVocabStatus(card) === 'known').length;
    const review = cards.filter((card) => getVocabStatus(card) === 'review').length;
    const fresh = cards.length - known - review;
    const parts = [{ label: 'Đã nhớ', count: known, color: '#73bda0' }, { label: 'Cần ôn', count: review, color: '#e6a1ad' }, { label: 'Chưa học', count: fresh, color: '#aaa3d7' }];
    $('review-breakdown').innerHTML = parts.map((part) => `<div class="breakdown-row"><span>${part.label}</span><div class="progress-track"><span style="width:${cards.length ? part.count / cards.length * 100 : 0}%;background:${part.color}"></span></div><strong>${part.count}</strong></div>`).join('');
  }

  function startStudy(cards, title) {
    const unique = [];
    const seen = new Set();
    (cards || []).forEach((card) => {
      if (card && !seen.has(card.id)) { seen.add(card.id); unique.push(card); }
    });
    studyCards = unique;
    studyIndex = 0;
    studyTitle = title || 'Phiên học';
    studyRated = new Set();
    $('learn-title').textContent = studyTitle;
    $('learn-eyebrow').textContent = `${unique.length} THẺ TRONG PHIÊN`;
    $('learn-subtitle').textContent = 'Chạm vào thẻ để xem nghĩa, cách đọc và mẹo ghi nhớ.';
    setPage('learn');
    renderStudyCard();
  }

  function renderStudyCard() {
    const empty = studyCards.length === 0;
    const complete = studyIndex >= studyCards.length;
    $('study-empty').hidden = !empty;
    $('study-card-area').hidden = empty || complete;
    $('study-complete').hidden = empty || !complete;
    if (empty) return;
    if (complete) {
      $('study-complete-summary').textContent = `Bạn đã đi hết ${studyCards.length} thẻ trong phiên. ${studyRated.size} thẻ đã được đánh giá để cập nhật lịch ôn.`;
      $('study-position').textContent = `${studyCards.length} / ${studyCards.length}`;
      $('study-progress-bar').style.width = '100%';
      return;
    }
    const card = studyCards[studyIndex];
    $('study-position').textContent = `${studyIndex + 1} / ${studyCards.length}`;
    $('study-progress-bar').style.width = `${(studyIndex / studyCards.length) * 100}%`;
    $('study-level-label').textContent = card.level;
    $('study-card-level').textContent = card.level;
    $('study-card-topic').textContent = card.topic;
    $('study-card-jp').textContent = card.jp;
    $('study-card-kanji').textContent = card.kanji && card.kanji !== card.jp ? card.kanji : '';
    $('study-card-romaji').textContent = card.romaji || 'Chưa có Romaji';
    $('study-card-meaning').textContent = card.vi;
    $('study-card-mnemonic').textContent = card.mnemonic || 'Hãy chú ý cách đọc và ngữ cảnh sử dụng của từ.';
    $('study-card').classList.remove('flipped');
    $('study-card').setAttribute('aria-pressed', 'false');
  }

  function rateCurrentCard(correct) {
    const card = studyCards[studyIndex];
    if (!card || studyRated.has(card.id)) return;
    recordVocabReview(card, correct);
    studyRated.add(card.id);
    studyIndex += 1;
    renderStudyCard();
    renderHome();
    if (currentPage === 'review') renderReview();
  }

  function moveStudy(delta) {
    if (!studyCards.length) return;
    studyIndex = Math.max(0, Math.min(studyCards.length, studyIndex + delta));
    renderStudyCard();
  }

  function startVocabSession() {
    const filtered = currentPage === 'vocab' ? getFilteredVocab() : content.vocabulary;
    const fresh = filtered.filter((card) => getVocabStatus(card) !== 'known');
    const due = getDueCards(filtered);
    const chosen = (due.length ? due : fresh.length ? fresh : filtered).slice(0, SESSION_SIZE);
    startStudy(chosen, 'Học từ vựng');
  }

  function startTopicSession(topic) {
    const cards = content.vocabulary.filter((card) => card.level === roadmapLevel && card.topic === topic);
    if (cards.length) startStudy(cards.slice(0, SESSION_SIZE), topic);
    else {
      setPage('grammar');
      $('grammar-search').value = topic;
      renderGrammarList();
    }
  }

  function startReviewSession() {
    const level = $('review-level-filter').value;
    const pool = content.vocabulary.filter((card) => level === 'ALL' || card.level === level);
    const due = getDueCards(pool);
    const weak = pool.filter((card) => getVocabStatus(card) === 'review' || Number(getProgressData('vocab', card.id).incorrectCount) > 0);
    const fresh = pool.filter((card) => getVocabStatus(card) !== 'known');
    const cards = due.length ? due : weak.length ? weak : fresh.length ? fresh : content.vocabulary;
    startStudy(cards.slice(0, SESSION_SIZE), due.length ? 'Ôn từ đến hạn' : weak.length ? 'Ôn từ chưa vững' : 'Ôn lại từ vựng');
  }

  function openVocabDetail(cardId) {
    const card = content.vocabulary.find((item) => item.id === cardId);
    if (!card) return;
    selectedVocab = card;
    $('detail-level').textContent = card.level;
    $('detail-topic').textContent = card.topic;
    $('vocab-detail-jp').textContent = card.kanji || card.jp;
    $('vocab-detail-reading').textContent = `${card.jp}${card.romaji ? ` · ${card.romaji}` : ''}`;
    $('vocab-detail-meaning').textContent = card.vi;
    $('vocab-detail-mnemonic').textContent = card.mnemonic || 'Chưa có ghi chú ghi nhớ.';
    $('vocab-modal').hidden = false;
  }

  function closeModal(id) {
    const modal = $(id);
    if (modal) modal.hidden = true;
  }

  async function loadDemoData() {
    content = normalizeContent(DEMO_DATA);
    isDemoMode = true;
    await AppStore.remove(CONTENT_CACHE_KEY);
    renderAll();
    setConnectionState('Dữ liệu minh họa', 'offline');
    showToast('Đã nạp dữ liệu minh họa trên thiết bị này. Chưa gửi dữ liệu lên Supabase.');
  }

  async function refreshContent() {
    if (!AppDB.isConfigured()) {
      showToast('Chưa cấu hình Supabase. Hãy nhập URL và anon key trong config.js.');
      return;
    }
    try {
      setConnectionState('Đang tải dữ liệu…', '');
      const sdkReady = await AppDB.loadSdk();
      if (!sdkReady) throw new Error('Không tải được thư viện Supabase. Ứng dụng vẫn hoạt động ngoại tuyến.');
      AppDB.init();
      const remote = normalizeContent(await AppDB.getPublishedContent());
      if (totalContentCount(remote) > 0) {
        content = remote;
        isDemoMode = false;
        await AppStore.set(CONTENT_CACHE_KEY, content);
        setConnectionState('Đã đồng bộ học liệu', 'online');
        renderAll();
        showToast(`Đã tải ${content.vocabulary.length} từ, ${content.grammar.length} ngữ pháp và ${content.exercises.length} bài tập.`);
      } else {
        setConnectionState('Máy chủ chưa có học liệu', 'offline');
        showToast('Supabase chưa có nội dung đã xuất bản. Dữ liệu đang lưu trên thiết bị được giữ nguyên.');
      }
    } catch (error) {
      setConnectionState('Đang dùng dữ liệu trên máy', 'offline');
      showToast(`Không tải được dữ liệu: ${error.message || 'Lỗi kết nối'}`);
    }
  }

  let remoteSyncTimer;
  function scheduleRemoteSync() {
    if (!currentUser || !AppDB.isConfigured() || isDemoMode) return;
    clearTimeout(remoteSyncTimer);
    remoteSyncTimer = setTimeout(() => syncProgressToRemote(false), 1800);
  }

  async function syncProgressToRemote(showMessage) {
    if (!currentUser || !AppDB.isConfigured() || isDemoMode) return;
    try {
      const records = Object.values(progress).filter((record) => !String(record.itemId || '').startsWith('demo-')).map((record) => ({
        item_type: record.itemType, item_id: record.itemId,
        data: record.data || {}, updated_at: record.updatedAt || new Date().toISOString()
      }));
      for (let i = 0; i < records.length; i += 2000) {
        await AppDB.syncUserProgress(records.slice(i, i + 2000));
      }
      if (showMessage) showToast('Tiến độ đã đồng bộ lên tài khoản.');
    } catch (error) {
      if (showMessage) showToast(`Chưa đồng bộ được: ${error.message || 'Lỗi máy chủ'}`);
    }
  }

  async function syncAccountProgress() {
    if (!currentUser) return;
    if (accountSyncPromise) return accountSyncPromise;
    accountSyncPromise = (async () => {
      try {
        const remoteRows = await AppDB.getUserProgress();
        progress = AppStore.mergeProgress(progress, remoteRows);
        await AppStore.set(PROGRESS_KEY, progress);
        await syncProgressToRemote(false);
        renderAll();
        showToast('Đã hợp nhất tiến độ trên thiết bị và tài khoản.');
      } catch (error) {
        showToast(`Đăng nhập được nhưng chưa tải được tiến độ: ${error.message || 'Lỗi đồng bộ'}`);
      }
    })();
    try { await accountSyncPromise; }
    finally { accountSyncPromise = null; }
  }

  function updateAccountModal() {
    const loggedIn = Boolean(currentUser);
    $('account-user-panel').hidden = !loggedIn;
    $('account-form').hidden = loggedIn;
    $('account-user-email').textContent = currentUser ? currentUser.email || 'Tài khoản Supabase' : '';
    $('account-modal-title').textContent = loggedIn ? 'Tài khoản đã kết nối' : 'Học không cần tài khoản';
    $('account-modal-description').textContent = loggedIn
      ? 'Tiến độ học được lưu trên thiết bị và có thể đồng bộ lên tài khoản.'
      : 'Tiến độ hiện tại được lưu trên thiết bị. Đăng nhập để đồng bộ sang thiết bị khác.';
  }

  function openAccountModal() {
    updateAccountModal();
    $('account-error').textContent = '';
    $('account-modal').hidden = false;
    if (AppDB.isConfigured() && !currentUser) {
      AppDB.loadSdk().then(async (ready) => {
        if (!ready) return;
        AppDB.init();
        currentUser = await AppDB.getUser();
        updateAccountModal();
      }).catch(() => {});
    }
  }

  async function handleAccountSubmit(event) {
    event.preventDefault();
    const email = $('account-email').value.trim();
    const password = $('account-password').value;
    const errorEl = $('account-error');
    errorEl.textContent = '';
    if (!AppDB.isConfigured()) {
      errorEl.textContent = 'Chưa cấu hình Supabase. Bạn vẫn có thể học ngoại tuyến.';
      return;
    }
    const submit = $('account-submit');
    submit.disabled = true;
    submit.textContent = 'Đang xử lý…';
    try {
      const sdkReady = await AppDB.loadSdk();
      if (!sdkReady) throw new Error('Không tải được thư viện Supabase. Bạn vẫn có thể học ngoại tuyến.');
      AppDB.init();
      if (authMode === 'signup') {
        const user = await AppDB.signUp(email, password);
        currentUser = await AppDB.getUser();
        if (!currentUser) {
          errorEl.textContent = 'Tài khoản đã được tạo. Hãy xác nhận email theo hướng dẫn Supabase, sau đó đăng nhập.';
          return;
        }
        showToast(`Đã tạo tài khoản ${user.email || email}.`);
      } else {
        await AppDB.signIn(email, password);
        currentUser = await AppDB.getUser();
      }
      updateAccountModal();
      await syncAccountProgress();
    } catch (error) {
      errorEl.textContent = error.message || 'Không thể xác thực tài khoản.';
    } finally {
      submit.disabled = false;
      submit.textContent = authMode === 'signin' ? 'Đăng nhập và đồng bộ' : 'Tạo tài khoản';
    }
  }

  async function handleSignOut() {
    try {
      await AppDB.signOut();
      currentUser = null;
      updateAccountModal();
      showToast('Đã đăng xuất. Tiến độ trên thiết bị vẫn được giữ lại.');
    } catch (error) {
      showToast(error.message || 'Không thể đăng xuất.');
    }
  }

  function renderAll() {
    renderHome();
    renderRoadmap();
    renderVocabList();
    renderGrammarList();
    renderKana();
    renderReview();
    if (currentPage === 'learn') renderStudyCard();
  }

  let authListenerRegistered = false;

  function registerAuthListener() {
    if (authListenerRegistered) return;
    authListenerRegistered = true;
    AppDB.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' && session && session.user) {
        currentUser = session.user;
        syncAccountProgress();
      } else if (event === 'SIGNED_OUT') {
        currentUser = null;
      }
    });
  }

  async function connectSupabaseInBackground() {
    try {
      const sdkReady = await AppDB.loadSdk();
      if (!sdkReady) {
        setConnectionState('Chế độ ngoại tuyến', 'offline');
        return;
      }
      AppDB.init();
      try {
        const remote = normalizeContent(await AppDB.getPublishedContent());
        if (totalContentCount(remote) > 0) {
          content = remote;
          await AppStore.set(CONTENT_CACHE_KEY, content);
          isDemoMode = false;
          setConnectionState('Đã tải học liệu', 'online');
          renderAll();
        } else if (totalContentCount(content) > 0) {
          setConnectionState('Dùng học liệu đã lưu', 'offline');
        } else {
          setConnectionState('Máy chủ chưa có học liệu', 'offline');
        }
      } catch (error) {
        console.warn('Tải học liệu từ Supabase không thành công:', error);
        setConnectionState('Đang dùng dữ liệu trên máy', 'offline');
      }
      currentUser = await AppDB.getUser();
      if (currentUser) await syncAccountProgress();
      registerAuthListener();
    } catch (error) {
      console.warn('Không thể khởi tạo kết nối Supabase:', error);
      setConnectionState('Chế độ ngoại tuyến', 'offline');
    }
  }

  async function initialize() {
    try {
      const savedProgress = await AppStore.get(PROGRESS_KEY, {});
      progress = savedProgress && typeof savedProgress === 'object' ? savedProgress : {};
      const savedMeta = await AppStore.get(META_KEY, null);
      if (savedMeta && typeof savedMeta === 'object') meta = { ...meta, ...savedMeta };
      const cached = await AppStore.get(CONTENT_CACHE_KEY, null);
      if (cached) content = normalizeContent(cached);
    } catch (error) {
      console.warn('Không thể đọc dữ liệu lưu trên thiết bị:', error);
    }

    renderAll();
    if (AppDB.isConfigured()) {
      setConnectionState('Đang kết nối…', '');
      connectSupabaseInBackground();
    } else {
      setConnectionState('Chế độ ngoại tuyến', 'offline');
    }
  }

  function bindEvents() {
    document.addEventListener('click', (event) => {
      const pageButton = event.target.closest('[data-page]');
      if (pageButton) { setPage(pageButton.dataset.page); return; }
      const gotoButton = event.target.closest('[data-goto]');
      if (gotoButton) { setPage(gotoButton.dataset.goto); return; }
      const closeButton = event.target.closest('[data-close-modal]');
      if (closeButton) { closeModal(closeButton.dataset.closeModal); return; }
      const vocabButton = event.target.closest('[data-vocab-id]');
      if (vocabButton) { openVocabDetail(vocabButton.dataset.vocabId); return; }
      const topicButton = event.target.closest('[data-topic]');
      if (topicButton) { startTopicSession(topicButton.dataset.topic); return; }
      const levelButton = event.target.closest('[data-level]');
      if (levelButton) { roadmapLevel = levelButton.dataset.level; renderRoadmap(); return; }
      const grammarDone = event.target.closest('[data-grammar-complete]');
      if (grammarDone) {
        const id = grammarDone.dataset.grammarComplete;
        const isDone = getProgressData('grammar', id).status === 'known';
        updateProgress('grammar', id, { status: isDone ? 'new' : 'known', completedAt: isDone ? null : Date.now() });
        renderGrammarList();
        showToast(isDone ? 'Đã bỏ trạng thái hoàn thành.' : 'Đã ghi nhận hoàn thành ngữ pháp.');
        return;
      }
      const kanaButton = event.target.closest('[data-kana-char]');
      if (kanaButton) {
        selectedKana = [kanaButton.dataset.kanaChar, kanaButton.dataset.kanaRomaji];
        renderKana();
        return;
      }
      const kanaScriptButton = event.target.closest('[data-kana-script]');
      if (kanaScriptButton) { kanaScript = kanaScriptButton.dataset.kanaScript; selectedKana = null; renderKana(); return; }
      const practiceOption = event.target.closest('[data-practice-option]');
      if (practiceOption) { answerPractice(Number(practiceOption.dataset.practiceOption)); return; }
    });

    $('account-button').addEventListener('click', openAccountModal);
    $('account-form').addEventListener('submit', handleAccountSubmit);
    $('account-mode-toggle').addEventListener('click', () => {
      authMode = authMode === 'signin' ? 'signup' : 'signin';
      $('account-submit').textContent = authMode === 'signin' ? 'Đăng nhập và đồng bộ' : 'Tạo tài khoản';
      $('account-mode-toggle').textContent = authMode === 'signin' ? 'Chưa có tài khoản? Tạo tài khoản' : 'Đã có tài khoản? Đăng nhập';
      $('account-password').autocomplete = authMode === 'signin' ? 'current-password' : 'new-password';
      $('account-error').textContent = '';
    });
    $('sign-out-button').addEventListener('click', handleSignOut);
    $('sync-now-button').addEventListener('click', () => syncProgressToRemote(true));

    $('continue-learning').addEventListener('click', () => content.vocabulary.length ? startVocabSession() : setPage('kana'));
    $('load-demo-button').addEventListener('click', loadDemoData);
    $('refresh-content-button').addEventListener('click', refreshContent);
    $('start-vocab-session').addEventListener('click', startVocabSession);
    $('vocab-search').addEventListener('input', renderVocabList);
    $('vocab-level-filter').addEventListener('change', renderVocabList);
    $('vocab-topic-filter').addEventListener('change', renderVocabList);
    $('grammar-level-filter').addEventListener('change', renderGrammarList);
    $('grammar-search').addEventListener('input', renderGrammarList);
    $('start-practice-button').addEventListener('click', startPractice);
    $('practice-session').addEventListener('click', (event) => {
      if (event.target.id === 'practice-next') nextPracticeQuestion();
      if (event.target.id === 'practice-again') { $('practice-start-panel').hidden = false; $('practice-session').hidden = true; startPractice(); }
      if (event.target.id === 'practice-back') { $('practice-start-panel').hidden = false; $('practice-session').hidden = true; setPage('home'); }
    });
    $('start-review-button').addEventListener('click', startReviewSession);
    $('review-level-filter').addEventListener('change', renderReview);
    $('study-card').addEventListener('click', () => {
      $('study-card').classList.toggle('flipped');
      $('study-card').setAttribute('aria-pressed', $('study-card').classList.contains('flipped') ? 'true' : 'false');
    });
    $('study-audio').addEventListener('click', () => { const card = studyCards[studyIndex]; if (card) speakJapanese(card.jp); });
    $('study-again').addEventListener('click', () => rateCurrentCard(false));
    $('study-known').addEventListener('click', () => rateCurrentCard(true));
    $('study-prev').addEventListener('click', () => moveStudy(-1));
    $('study-next').addEventListener('click', () => moveStudy(1));
    $('exit-learning').addEventListener('click', () => setPage('home'));
    $('study-next-batch').addEventListener('click', () => {
      const excluded = new Set(studyCards.map((card) => card.id));
      const next = content.vocabulary.filter((card) => !excluded.has(card.id) && getVocabStatus(card) !== 'known');
      const fallback = content.vocabulary.filter((card) => !excluded.has(card.id));
      startStudy((next.length ? next : fallback).slice(0, SESSION_SIZE), 'Học tiếp từ vựng');
    });
    $('detail-audio').addEventListener('click', () => selectedVocab && speakJapanese(selectedVocab.jp));
    $('detail-study').addEventListener('click', () => {
      if (!selectedVocab) return;
      closeModal('vocab-modal');
      startStudy([selectedVocab], 'Học một từ');
    });
    $('kana-audio-button').addEventListener('click', () => selectedKana && speakJapanese(selectedKana[0]));
    document.querySelectorAll('.modal-backdrop').forEach((modal) => modal.addEventListener('click', (event) => {
      if (event.target === modal) modal.hidden = true;
    }));
    window.addEventListener('online', () => { if (AppDB.isConfigured()) refreshContent(); });
  }

  document.addEventListener('DOMContentLoaded', () => {
    bindEvents();
    initialize();
  });
})();
