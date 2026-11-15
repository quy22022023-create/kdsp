(function () {
  'use strict';

  const $ = (id) => document.getElementById(id);
  const BANKS = ['vocabulary', 'grammar', 'exercises'];
  const LEVELS = ['N5', 'N4', 'N3', 'N2', 'N1', 'OTHER'];
  const ACTIVITY_TYPES = [
    'explanation', 'vocabulary', 'kanji', 'grammar', 'tap_translate', 'matching',
    'multiple_choice', 'fill_blank', 'sentence_order', 'listening', 'speaking',
    'dictation', 'quiz'
  ];
  const ACTIVITY_LABELS = {
    explanation: 'Lý thuyết / Giải thích', vocabulary: 'Từ vựng', kanji: 'Kanji',
    grammar: 'Ngữ pháp', tap_translate: 'Chạm từ để dịch', matching: 'Ghép đôi',
    multiple_choice: 'Trắc nghiệm', fill_blank: 'Điền chỗ trống',
    sentence_order: 'Sắp xếp câu', listening: 'Luyện nghe', speaking: 'Luyện nói',
    dictation: 'Nghe và chép', quiz: 'Kiểm tra tổng hợp'
  };
  const ACTIVITY_TEMPLATES = {
    explanation: { body_markdown: '## Nội dung bài học\n\nViết phần giải thích tại đây.' },
    vocabulary: { items: [{ id: 'n5-vocab-example', jp: 'わたし', kanji: '私', reading: 'わたし', romaji: 'watashi', vi: 'Tôi' }] },
    kanji: { items: [{ kanji: '日', onyomi: ['ニチ', 'ジツ'], kunyomi: ['ひ', 'か'], meaning_vi: 'Ngày, mặt trời', examples: [] }] },
    grammar: { items: [{ pattern: '～は～です', meaning: 'A là B', structure: 'Danh từ + は + danh từ + です', explanation: '', examples: [{ jp: 'わたしは学生です。', vi: 'Tôi là học sinh.' }] }] },
    tap_translate: { sentence_jp: 'わたしは学生です。', translation_vi: 'Tôi là học sinh.', tokens: [{ text: 'わたし', reading: 'わたし', meaning_vi: 'tôi' }, { text: 'は', reading: 'は', meaning_vi: 'trợ từ chủ đề' }, { text: '学生', reading: 'がくせい', meaning_vi: 'học sinh' }, { text: 'です', reading: 'です', meaning_vi: 'là' }] },
    matching: { pairs: [{ left: 'ねこ', right: 'Con mèo' }, { left: 'いぬ', right: 'Con chó' }] },
    multiple_choice: { questions: [{ prompt: 'わたし nghĩa là gì?', options: ['Tôi', 'Bạn', 'Anh ấy', 'Cô ấy'], answer: 'Tôi', explanation: 'わたし có nghĩa là tôi.' }] },
    fill_blank: { questions: [{ prompt_jp: 'わたし ___ 学生です。', answer: 'は', options: ['は', 'を', 'に'], explanation: 'は đánh dấu chủ đề.' }] },
    sentence_order: { questions: [{ words: ['です。', '学生', 'わたしは'], answer: 'わたしは学生です。', translation_vi: 'Tôi là học sinh.' }] },
    listening: { prompts: [{ audio_text: 'おはようございます。', prompt_vi: 'Nghe và chọn lời chào đúng.', answer: 'おはようございます。' }] },
    speaking: { prompts: [{ prompt_jp: '自己紹介をしてください。', prompt_vi: 'Hãy tự giới thiệu bản thân.', sample_answer: 'わたしはアンです。' }] },
    dictation: { prompts: [{ audio_text: 'こんにちは。', answer: 'こんにちは。', translation_vi: 'Xin chào.' }] },
    quiz: { questions: [{ prompt: 'Chọn nghĩa đúng của 学生.', options: ['Học sinh', 'Giáo viên', 'Bác sĩ', 'Nhân viên'], answer: 'Học sinh', explanation: '学生（がくせい）là học sinh/sinh viên.' }] }
  };

  const state = {
    gatePassword: '',
    workspace: null,
    draftId: null,
    dirty: false,
    selectedCourseId: null,
    selectedModuleId: null,
    selectedLessonId: null,
    selectedActivityId: null,
    activeBank: 'vocabulary',
    pendingBankItems: null
  };

  function escapeHtml(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function slugify(value) {
    return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .toLowerCase().replace(/đ/g, 'd').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
      .slice(0, 44);
  }

  let newIdCounter = 0;
  function makeId(prefix, value) {
    const base = slugify(value) || prefix;
    newIdCounter += 1;
    const suffix = `${Date.now().toString(36).slice(-6)}-${newIdCounter.toString(36)}`;
    return `${prefix}-${base.slice(0, 36)}-${suffix}`.slice(0, 64).replace(/-+$/g, '');
  }

  function makeEmptyWorkspace(baseContentVersion) {
    return {
      baseContentVersion: Number(baseContentVersion) || 1,
      courses: [],
      banks: { vocabulary: [], grammar: [], exercises: [] },
      currentPaths: ['content/manifest.json', 'content/catalog.json', 'content/banks/index.json'],
      versions: {
        'content/manifest.json': Number(baseContentVersion) || 1,
        'content/catalog.json': 1,
        'content/banks/index.json': 1
      },
      manifest: {
        schema_version: 1,
        content_version: Number(baseContentVersion) || 1,
        published_at: null,
        catalog: { path: 'catalog.json', version: 1 },
        banks_index: { path: 'banks/index.json', version: 1 }
      }
    };
  }

  function normalizeWorkspace(source) {
    if (!source || typeof source !== 'object' || Array.isArray(source)) throw new Error('Tệp JSON không chứa workspace hợp lệ.');
    if (!Array.isArray(source.courses)) throw new Error('workspace.courses phải là mảng.');
    if (!source.banks || typeof source.banks !== 'object' || Array.isArray(source.banks)) throw new Error('workspace.banks phải là object.');
    const workspace = {
      ...source,
      baseContentVersion: Number(source.baseContentVersion) || 1,
      courses: source.courses,
      banks: {
        vocabulary: Array.isArray(source.banks.vocabulary) ? source.banks.vocabulary : [],
        grammar: Array.isArray(source.banks.grammar) ? source.banks.grammar : [],
        exercises: Array.isArray(source.banks.exercises) ? source.banks.exercises : []
      },
      currentPaths: Array.isArray(source.currentPaths) ? source.currentPaths : [],
      versions: source.versions && typeof source.versions === 'object' ? source.versions : {},
      manifest: source.manifest && typeof source.manifest === 'object' ? source.manifest : {}
    };
    workspace.courses.forEach((entry) => {
      if (!entry || typeof entry !== 'object') throw new Error('Một mục khóa học không hợp lệ.');
      if (!entry.course || typeof entry.course !== 'object') throw new Error('Thiếu thông tin course trong workspace.');
      if (!Array.isArray(entry.modules)) entry.modules = [];
      entry.modules.forEach((moduleEntry) => {
        if (!moduleEntry || typeof moduleEntry !== 'object' || !moduleEntry.module) throw new Error('Một chương không hợp lệ.');
        if (!Array.isArray(moduleEntry.lessons)) moduleEntry.lessons = [];
        moduleEntry.lessons.forEach((lesson) => {
          if (!lesson || typeof lesson !== 'object') throw new Error('Một bài học không hợp lệ.');
          if (!Array.isArray(lesson.activities)) lesson.activities = [];
        });
      });
    });
    return workspace;
  }

  function setPanel(id, visible) {
    const element = $(id);
    if (element) element.hidden = !visible;
  }

  function setMessage(id, message, kind) {
    const element = $(id);
    if (!element) return;
    element.textContent = message || '';
    element.className = `cms-message${kind === 'error' ? ' cms-message-error' : ''}`;
    element.hidden = !message;
  }

  function setDirty(value) {
    state.dirty = Boolean(value);
    const badge = $('cms-dirty-indicator');
    if (badge) {
      badge.textContent = state.dirty ? 'Có thay đổi chưa lưu' : 'Đã lưu bản nháp';
      badge.classList.toggle('is-dirty', state.dirty);
    }
  }

  async function callCms(action, payload) {
    const client = window.AppDB && window.AppDB.getClient();
    if (!client) throw new Error('Không khởi tạo được kết nối Supabase.');
    const { data, error } = await client.functions.invoke('j_content_admin', {
      body: { action, gatePassword: state.gatePassword, ...(payload || {}) }
    });
    if (error) {
      let message = error.message || 'Không thể gọi CMS.';
      try {
        if (error.context && typeof error.context.json === 'function') {
          const body = await error.context.json();
          if (body && body.error) message = body.error;
        }
      } catch (_) { /* Giữ thông báo lỗi SDK. */ }
      throw new Error(message);
    }
    if (data && data.error) throw new Error(data.error);
    return data || {};
  }

  function selectedCourseEntry() {
    return (state.workspace?.courses || []).find((entry) => entry.course.id === state.selectedCourseId) || null;
  }

  function selectedModuleEntry() {
    const course = selectedCourseEntry();
    return course ? course.modules.find((entry) => entry.module.id === state.selectedModuleId) || null : null;
  }

  function selectedLesson() {
    const module = selectedModuleEntry();
    return module ? module.lessons.find((lesson) => lesson.id === state.selectedLessonId) || null : null;
  }

  function selectedActivity() {
    const lesson = selectedLesson();
    return lesson ? lesson.activities.find((activity) => activity.id === state.selectedActivityId) || null : null;
  }

  function markAndRender() {
    setDirty(true);
    renderAll();
  }

  function renderStatus() {
    const workspace = state.workspace;
    if (!workspace) return;
    const courseCount = workspace.courses.length;
    const moduleCount = workspace.courses.reduce((sum, entry) => sum + entry.modules.length, 0);
    const lessonCount = workspace.courses.reduce((sum, entry) => sum + entry.modules.reduce((n, module) => n + module.lessons.length, 0), 0);
    $('cms-repo-status').textContent = 'quy22022023-create / kdsp';
    $('cms-version-status').textContent = `Phiên bản nội dung: ${workspace.baseContentVersion || 1} · Nhánh main · GitHub là nơi lưu học liệu đã xuất bản`;
    $('cms-counts').innerHTML = [
      `Khóa học: ${courseCount}`, `Chương: ${moduleCount}`, `Bài học: ${lessonCount}`,
      `Từ vựng: ${workspace.banks.vocabulary.length}`, `Ngữ pháp: ${workspace.banks.grammar.length}`, `Bài tập: ${workspace.banks.exercises.length}`
    ].map((label) => `<span class="cms-count-chip">${escapeHtml(label)}</span>`).join('');
    BANKS.forEach((bank) => { $(`cms-bank-count-${bank}`).textContent = workspace.banks[bank].length; });
  }

  function renderCourseList() {
    const host = $('cms-course-list');
    const entries = [...(state.workspace?.courses || [])].sort((a, b) => Number(a.course.order || 0) - Number(b.course.order || 0));
    if (!entries.length) {
      host.innerHTML = '<p class="cms-empty">Chưa có khóa học. Hãy tạo khóa học đầu tiên.</p>';
      return;
    }
    host.innerHTML = entries.map((entry) => {
      const course = entry.course;
      const active = course.id === state.selectedCourseId;
      return `<button type="button" class="cms-list-button${active ? ' active' : ''}" data-select-course="${escapeHtml(course.id)}"><span><strong>${escapeHtml(course.title)}</strong><small>${escapeHtml(course.level || 'N5')} · ${entry.modules.length} chương</small></span><span>›</span></button>`;
    }).join('');
    host.querySelectorAll('[data-select-course]').forEach((button) => button.addEventListener('click', () => {
      state.selectedCourseId = button.dataset.selectCourse;
      state.selectedModuleId = null;
      state.selectedLessonId = null;
      state.selectedActivityId = null;
      renderAll();
    }));
  }

  function renderCourseForm() {
    const entry = selectedCourseEntry();
    const form = $('cms-course-form');
    form.querySelectorAll('input,select,textarea,button[type="submit"]').forEach((element) => { element.disabled = !entry; });
    $('cms-delete-course').disabled = !entry;
    $('cms-course-id-label').textContent = entry ? entry.course.id : 'Chưa chọn';
    const c = entry?.course || {};
    $('cms-course-title').value = c.title || '';
    $('cms-course-level').value = c.level || 'N5';
    $('cms-course-order').value = Number(c.order || 1);
    $('cms-course-slug').value = c.slug || '';
    $('cms-course-description').value = c.description || '';
    $('cms-course-minutes').value = Number(c.estimated_minutes || 0);
    $('cms-course-tags').value = Array.isArray(c.tags) ? c.tags.join(', ') : '';
    $('cms-course-objectives').value = Array.isArray(c.objectives) ? c.objectives.join('\n') : '';
  }

  function renderModuleList() {
    const host = $('cms-module-list');
    const course = selectedCourseEntry();
    if (!course) { host.innerHTML = '<p class="cms-empty">Chọn hoặc tạo khóa học trước.</p>'; return; }
    const modules = [...course.modules].sort((a, b) => Number(a.module.order || 0) - Number(b.module.order || 0));
    if (!modules.length) { host.innerHTML = '<p class="cms-empty">Khóa học này chưa có chương.</p>'; return; }
    host.innerHTML = modules.map((entry) => `<button type="button" class="cms-list-button${entry.module.id === state.selectedModuleId ? ' active' : ''}" data-select-module="${escapeHtml(entry.module.id)}"><span><strong>${escapeHtml(entry.module.title)}</strong><small>${entry.lessons.length} bài học</small></span><span>›</span></button>`).join('');
    host.querySelectorAll('[data-select-module]').forEach((button) => button.addEventListener('click', () => {
      state.selectedModuleId = button.dataset.selectModule;
      state.selectedLessonId = null;
      state.selectedActivityId = null;
      renderAll();
    }));
  }

  function renderModuleForm() {
    const entry = selectedModuleEntry();
    const form = $('cms-module-form');
    form.querySelectorAll('input,textarea,button[type="submit"]').forEach((element) => { element.disabled = !entry; });
    $('cms-delete-module').disabled = !entry;
    $('cms-add-module').disabled = !selectedCourseEntry();
    $('cms-module-id-label').textContent = entry ? entry.module.id : 'Chưa chọn';
    $('cms-module-title').value = entry?.module.title || '';
    $('cms-module-description').value = entry?.module.description || '';
    $('cms-module-order').value = Number(entry?.module.order || 1);
  }

  function renderLessonList() {
    const host = $('cms-lesson-list');
    const module = selectedModuleEntry();
    if (!module) { host.innerHTML = '<p class="cms-empty">Chọn một chương để quản lý bài học.</p>'; return; }
    const lessons = [...module.lessons].sort((a, b) => Number(a.order || 0) - Number(b.order || 0));
    if (!lessons.length) { host.innerHTML = '<p class="cms-empty">Chương này chưa có bài học.</p>'; return; }
    host.innerHTML = lessons.map((lesson) => `<button type="button" class="cms-list-button${lesson.id === state.selectedLessonId ? ' active' : ''}" data-select-lesson="${escapeHtml(lesson.id)}"><span><strong>${escapeHtml(lesson.title)}</strong><small>${lesson.activities.length} hoạt động · ${Number(lesson.estimated_minutes || 0)} phút</small></span><span>›</span></button>`).join('');
    host.querySelectorAll('[data-select-lesson]').forEach((button) => button.addEventListener('click', () => {
      state.selectedLessonId = button.dataset.selectLesson;
      state.selectedActivityId = null;
      renderAll();
    }));
  }

  function renderLessonForm() {
    const lesson = selectedLesson();
    const form = $('cms-lesson-form');
    form.querySelectorAll('input,textarea,button[type="submit"]').forEach((element) => { element.disabled = !lesson; });
    $('cms-delete-lesson').disabled = !lesson;
    $('cms-add-lesson').disabled = !selectedModuleEntry();
    $('cms-lesson-id-label').textContent = lesson ? lesson.id : 'Chưa chọn';
    $('cms-lesson-title').value = lesson?.title || '';
    $('cms-lesson-description').value = lesson?.description || '';
    $('cms-lesson-order').value = Number(lesson?.order || 1);
    $('cms-lesson-minutes').value = Number(lesson?.estimated_minutes || 10);
    $('cms-lesson-objectives').value = Array.isArray(lesson?.objectives) ? lesson.objectives.join('\n') : '';
  }

  function renderActivityList() {
    const host = $('cms-activity-list');
    const lesson = selectedLesson();
    if (!lesson) { host.innerHTML = '<p class="cms-empty">Chọn một bài học để thêm hoạt động.</p>'; return; }
    if (!lesson.activities.length) { host.innerHTML = '<p class="cms-empty">Bài học chưa có hoạt động. Hãy thêm lý thuyết hoặc bài tập.</p>'; return; }
    host.innerHTML = [...lesson.activities].sort((a, b) => Number(a.order || 0) - Number(b.order || 0)).map((activity) => `<button type="button" class="cms-list-button${activity.id === state.selectedActivityId ? ' active' : ''}" data-select-activity="${escapeHtml(activity.id)}"><span><strong>${escapeHtml(activity.title)}</strong><small>${escapeHtml(ACTIVITY_LABELS[activity.type] || activity.type)} · thứ tự ${Number(activity.order || 0)}</small></span><span>›</span></button>`).join('');
    host.querySelectorAll('[data-select-activity]').forEach((button) => button.addEventListener('click', () => {
      state.selectedActivityId = button.dataset.selectActivity;
      renderAll();
    }));
  }

  function renderActivityForm() {
    const activity = selectedActivity();
    const form = $('cms-activity-form');
    form.querySelectorAll('input,select,textarea,button[type="submit"]').forEach((element) => { element.disabled = !activity; });
    $('cms-delete-activity').disabled = !activity;
    $('cms-fill-activity-template').disabled = !activity;
    $('cms-add-activity').disabled = !selectedLesson();
    $('cms-activity-id-label').textContent = activity ? activity.id : 'Chưa chọn';
    $('cms-activity-title').value = activity?.title || '';
    $('cms-activity-type').value = activity?.type || 'explanation';
    $('cms-activity-order').value = Number(activity?.order || 1);
    $('cms-activity-instructions').value = activity?.instructions || '';
    $('cms-activity-data').value = activity ? JSON.stringify(activity.data || {}, null, 2) : '{}';
    $('cms-activity-refs').value = activity && Array.isArray(activity.item_refs) ? JSON.stringify(activity.item_refs, null, 2) : '';
  }

  function renderBankList() {
    const bank = state.workspace?.banks?.[state.activeBank] || [];
    const host = $('cms-bank-list');
    if (!bank.length) { host.innerHTML = '<p class="cms-empty">Ngân hàng này chưa có dữ liệu.</p>'; return; }
    host.innerHTML = bank.slice(0, 30).map((item) => {
      const title = item.jp || item.pattern || item.prompt_jp || item.id;
      const meaning = item.vi || item.meaning || item.answer || item.kind || '';
      return `<div class="cms-bank-row"><div><strong>${escapeHtml(title)}</strong><small>${escapeHtml(item.level || 'N5')} · ${escapeHtml(meaning)} · ID: ${escapeHtml(item.id)}</small></div><button class="cms-button cms-button-danger" type="button" data-delete-bank-item="${escapeHtml(item.id)}">Xóa</button></div>`;
    }).join('') + (bank.length > 30 ? `<p class="cms-muted">Đang hiển thị 30/${bank.length} mục đầu tiên.</p>` : '');
    host.querySelectorAll('[data-delete-bank-item]').forEach((button) => button.addEventListener('click', () => {
      const item = bank.find((entry) => entry.id === button.dataset.deleteBankItem);
      if (!item || !window.confirm(`Xóa mục học liệu ${item.id} khỏi bản làm việc?`)) return;
      state.workspace.banks[state.activeBank] = bank.filter((entry) => entry.id !== item.id);
      setMessage('cms-bank-message', 'Đã xóa mục khỏi bản làm việc. Thay đổi chỉ lên GitHub khi xuất bản.', 'success');
      markAndRender();
    }));
  }

  function renderActivityPreview(activity) {
    const data = activity.data || {};
    if (activity.type === 'explanation') return `<div class="cms-preview-body">${escapeHtml(data.body_markdown || data.content || '')}</div>`;
    if (activity.type === 'tap_translate') {
      return `<p class="cms-preview-jp">${escapeHtml(data.sentence_jp || '')}</p><p>${escapeHtml(data.translation_vi || '')}</p><div class="cms-preview-token-list">${(data.tokens || []).map((token) => `<span class="cms-preview-token"><strong>${escapeHtml(token.text || '')}</strong><small>${escapeHtml(token.meaning_vi || '')}</small></span>`).join('')}</div>`;
    }
    if (activity.type === 'matching') return `<div class="cms-preview-pairs">${(data.pairs || []).map((pair) => `<div><strong>${escapeHtml(pair.left || '')}</strong><span>↔</span>${escapeHtml(pair.right || '')}</div>`).join('')}</div>`;
    if (Array.isArray(data.questions)) return data.questions.map((question, index) => `<div class="cms-preview-question"><strong>Câu ${index + 1}: ${escapeHtml(question.prompt || question.prompt_jp || '')}</strong>${Array.isArray(question.options) ? `<ul>${question.options.map((option) => `<li>${escapeHtml(option)}</li>`).join('')}</ul>` : ''}<small>Đáp án: ${escapeHtml(question.answer || '')}</small></div>`).join('');
    if (Array.isArray(data.prompts)) return data.prompts.map((prompt, index) => `<div class="cms-preview-question"><strong>Yêu cầu ${index + 1}: ${escapeHtml(prompt.prompt_vi || prompt.prompt_jp || prompt.audio_text || '')}</strong><small>Đáp án/mẫu: ${escapeHtml(prompt.answer || prompt.sample_answer || '')}</small></div>`).join('');
    if (Array.isArray(data.items)) return `<ul>${data.items.slice(0, 12).map((item) => `<li>${escapeHtml(item.jp || item.kanji || item.pattern || item.word || '')} — ${escapeHtml(item.vi || item.meaning_vi || item.meaning || '')}</li>`).join('')}</ul>`;
    return `<pre>${escapeHtml(JSON.stringify(data, null, 2))}</pre>`;
  }

  function renderPreview() {
    const host = $('cms-preview');
    const lesson = selectedLesson();
    if (!lesson) { host.innerHTML = '<p class="cms-empty">Chọn một bài học để xem trước.</p>'; return; }
    const course = selectedCourseEntry()?.course;
    const module = selectedModuleEntry()?.module;
    const activities = [...lesson.activities].sort((a, b) => Number(a.order || 0) - Number(b.order || 0));
    host.innerHTML = `<article class="cms-preview-card"><p class="cms-eyebrow">${escapeHtml(course?.title || '')} · ${escapeHtml(module?.title || '')}</p><h3>${escapeHtml(lesson.title)}</h3><p>${escapeHtml(lesson.description || 'Chưa có mô tả')} · ${Number(lesson.estimated_minutes || 0)} phút</p>${activities.map((activity) => `<div class="cms-preview-activity"><strong>${Number(activity.order || 0)}. ${escapeHtml(activity.title)} — ${escapeHtml(ACTIVITY_LABELS[activity.type] || activity.type)}</strong><p>${escapeHtml(activity.instructions || '')}</p>${renderActivityPreview(activity)}</div>`).join('') || '<p class="cms-empty">Chưa có hoạt động trong bài học.</p>'}</article>`;
  }

  function renderAll() {
    if (!state.workspace) return;
    renderStatus();
    renderCourseList(); renderCourseForm();
    renderModuleList(); renderModuleForm();
    renderLessonList(); renderLessonForm();
    renderActivityList(); renderActivityForm();
    renderBankList(); renderPreview();
    document.querySelectorAll('[data-bank]').forEach((button) => button.classList.toggle('active', button.dataset.bank === state.activeBank));
  }

  function validateWorkspace(workspace) {
    const errors = [];
    const idPattern = /^[a-z0-9][a-z0-9_-]{1,63}$/;
    const courseIds = new Set(); const slugs = new Set();
    const moduleIds = new Set(); const lessonIds = new Set();
    const bankIds = { vocabulary: new Set(), grammar: new Set(), exercises: new Set() };
    BANKS.forEach((bank) => (workspace.banks[bank] || []).forEach((item) => {
      if (!item || typeof item !== 'object' || Array.isArray(item)) { errors.push(`${bank}: mục dữ liệu không phải object.`); return; }
      if (!idPattern.test(String(item.id || ''))) errors.push(`${bank}: ID không hợp lệ (${item.id || 'trống'}).`);
      if (bankIds[bank].has(item.id)) errors.push(`${bank}: ID trùng ${item.id}.`);
      bankIds[bank].add(item.id);
      if (!LEVELS.includes(String(item.level || 'N5').toUpperCase())) errors.push(`${bank}: cấp độ không hợp lệ ở ${item.id}.`);
      if (bank === 'vocabulary' && (!String(item.jp || '').trim() || !String(item.vi || '').trim())) errors.push(`Từ vựng ${item.id} cần jp và vi.`);
      if (bank === 'grammar' && !String(item.pattern || '').trim()) errors.push(`Ngữ pháp ${item.id} cần pattern.`);
      if (bank === 'exercises' && (!String(item.prompt_jp || item.jp || '').trim() || !String(item.answer || '').trim())) errors.push(`Bài tập ${item.id} cần prompt_jp và answer.`);
    }));

    workspace.courses.forEach((entry) => {
      const course = entry.course || {};
      if (!idPattern.test(String(course.id || ''))) errors.push(`ID khóa học không hợp lệ: ${course.id || '(trống)'}.`);
      if (courseIds.has(course.id)) errors.push(`ID khóa học trùng: ${course.id}.`);
      courseIds.add(course.id);
      if (!String(course.title || '').trim()) errors.push(`Khóa học ${course.id} chưa có tên.`);
      if (!LEVELS.includes(String(course.level || '').toUpperCase())) errors.push(`Khóa học ${course.id} có cấp độ không hợp lệ.`);
      if (!/^[a-z0-9][a-z0-9-]*$/.test(String(course.slug || ''))) errors.push(`Slug khóa học ${course.id} không hợp lệ.`);
      if (slugs.has(course.slug)) errors.push(`Slug khóa học trùng: ${course.slug}.`);
      slugs.add(course.slug);
      (entry.modules || []).forEach((moduleEntry) => {
        const module = moduleEntry.module || {};
        if (!idPattern.test(String(module.id || ''))) errors.push(`ID chương không hợp lệ: ${module.id || '(trống)'}.`);
        if (moduleIds.has(module.id)) errors.push(`ID chương trùng: ${module.id}.`);
        moduleIds.add(module.id);
        if (!String(module.title || '').trim()) errors.push(`Chương ${module.id} chưa có tên.`);
        (moduleEntry.lessons || []).forEach((lesson) => {
          if (!idPattern.test(String(lesson.id || ''))) errors.push(`ID bài học không hợp lệ: ${lesson.id || '(trống)'}.`);
          if (lessonIds.has(lesson.id)) errors.push(`ID bài học trùng: ${lesson.id}.`);
          lessonIds.add(lesson.id);
          if (!String(lesson.title || '').trim()) errors.push(`Bài học ${lesson.id} chưa có tên.`);
          if (!Array.isArray(lesson.activities)) errors.push(`Bài học ${lesson.id} phải có activities là mảng.`);
          const activityIds = new Set();
          (lesson.activities || []).forEach((activity) => {
            if (!idPattern.test(String(activity.id || ''))) errors.push(`ID hoạt động không hợp lệ trong bài ${lesson.id}.`);
            if (activityIds.has(activity.id)) errors.push(`ID hoạt động trùng trong bài ${lesson.id}: ${activity.id}.`);
            activityIds.add(activity.id);
            if (!ACTIVITY_TYPES.includes(activity.type)) errors.push(`Dạng hoạt động không hỗ trợ: ${activity.type || '(trống)'}.`);
            if (!String(activity.title || '').trim()) errors.push(`Hoạt động ${activity.id} chưa có tiêu đề.`);
            if (!activity.data || typeof activity.data !== 'object' || Array.isArray(activity.data)) {
              errors.push(`Dữ liệu hoạt động ${activity.id} phải là object JSON.`);
            } else {
              const data = activity.data;
              if (activity.type === 'explanation' && !String(data.body_markdown || data.content || '').trim()) errors.push(`Hoạt động lý thuyết ${activity.id} cần body_markdown hoặc content.`);
              if (activity.type === 'tap_translate' && (!String(data.sentence_jp || '').trim() || !Array.isArray(data.tokens))) errors.push(`Hoạt động chạm để dịch ${activity.id} cần sentence_jp và tokens[].`);
              if (activity.type === 'matching' && (!Array.isArray(data.pairs) || !data.pairs.length)) errors.push(`Hoạt động ghép đôi ${activity.id} cần pairs[].`);
              if (['multiple_choice', 'fill_blank', 'sentence_order', 'quiz'].includes(activity.type) && (!Array.isArray(data.questions) || !data.questions.length)) errors.push(`Hoạt động ${activity.id} cần questions[].`);
              if (['listening', 'speaking', 'dictation'].includes(activity.type) && (!Array.isArray(data.prompts) || !data.prompts.length)) errors.push(`Hoạt động ${activity.id} cần prompts[].`);
              if (['vocabulary', 'kanji', 'grammar'].includes(activity.type) && !((Array.isArray(data.items) && data.items.length) || (Array.isArray(activity.item_refs) && activity.item_refs.length))) errors.push(`Hoạt động ${activity.id} cần items[] hoặc item_refs[].`);
            }
            if (activity.item_refs != null && !Array.isArray(activity.item_refs)) errors.push(`item_refs của hoạt động ${activity.id} phải là mảng.`);
            (Array.isArray(activity.item_refs) ? activity.item_refs : []).forEach((ref) => {
              const bank = ref && ref.type === 'exercise' ? 'exercises' : ref?.type;
              if (!ref || !bankIds[bank] || !bankIds[bank].has(ref.id)) errors.push(`Tham chiếu không tồn tại: ${ref?.type || '(trống)'}/${ref?.id || '(trống)'}.`);
            });
          });
        });
      });
    });
    if (!workspace.courses.length && !BANKS.some((bank) => workspace.banks[bank].length)) errors.push('Kho chưa có khóa học hoặc học liệu nào để xuất bản.');
    return errors;
  }

  function renderValidation() {
    const errors = validateWorkspace(state.workspace);
    const host = $('cms-validation');
    host.hidden = false;
    host.className = `cms-validation ${errors.length ? 'is-error' : 'is-ok'}`;
    host.innerHTML = errors.length
      ? `<strong>Phát hiện ${errors.length} vấn đề cần sửa</strong><ul>${errors.slice(0, 30).map((error) => `<li>${escapeHtml(error)}</li>`).join('')}</ul>`
      : '<strong>Kiểm tra phía trình duyệt đạt.</strong><p>Không phát hiện ID trùng, thiếu trường bắt buộc hoặc tham chiếu hỏng ở mức kiểm tra cơ bản. Máy chủ sẽ kiểm tra lại trước khi xuất bản.</p>';
    return errors;
  }

  function formValue(id) { return $(id).value.trim(); }
  function parseLines(value) { return String(value || '').split(/\r?\n/).map((line) => line.trim()).filter(Boolean); }

  function saveCourse(event) {
    event.preventDefault();
    const entry = selectedCourseEntry();
    if (!entry) return;
    const title = formValue('cms-course-title');
    const slug = formValue('cms-course-slug').toLowerCase();
    if (!title || !slug) { setMessage('cms-global-message', 'Tên và slug khóa học không được để trống.', 'error'); return; }
    if (!/^[a-z0-9][a-z0-9-]*$/.test(slug)) { setMessage('cms-global-message', 'Slug chỉ được gồm chữ thường không dấu, số và dấu gạch ngang.', 'error'); return; }
    const duplicate = state.workspace.courses.some((other) => other !== entry && other.course.slug === slug);
    if (duplicate) { setMessage('cms-global-message', 'Slug này đã được dùng ở khóa học khác.', 'error'); return; }
    Object.assign(entry.course, {
      title, slug, level: formValue('cms-course-level'),
      description: formValue('cms-course-description'),
      order: Math.max(0, Number(formValue('cms-course-order')) || 0),
      estimated_minutes: Math.max(0, Number(formValue('cms-course-minutes')) || 0),
      tags: formValue('cms-course-tags').split(',').map((tag) => tag.trim()).filter(Boolean),
      objectives: parseLines(formValue('cms-course-objectives'))
    });
    setMessage('cms-global-message', 'Đã lưu thông tin khóa học trong bộ nhớ làm việc. Hãy lưu bản nháp để giữ lại.', 'success');
    markAndRender();
  }

  function saveModule(event) {
    event.preventDefault();
    const entry = selectedModuleEntry();
    if (!entry) return;
    const title = formValue('cms-module-title');
    if (!title) { setMessage('cms-global-message', 'Tên chương không được để trống.', 'error'); return; }
    entry.module.title = title;
    entry.module.description = formValue('cms-module-description');
    entry.module.order = Math.max(0, Number(formValue('cms-module-order')) || 0);
    setMessage('cms-global-message', 'Đã lưu chương trong bộ nhớ làm việc.', 'success');
    markAndRender();
  }

  function saveLesson(event) {
    event.preventDefault();
    const lesson = selectedLesson();
    if (!lesson) return;
    const title = formValue('cms-lesson-title');
    if (!title) { setMessage('cms-global-message', 'Tên bài học không được để trống.', 'error'); return; }
    lesson.title = title;
    lesson.description = formValue('cms-lesson-description');
    lesson.order = Math.max(0, Number(formValue('cms-lesson-order')) || 0);
    lesson.estimated_minutes = Math.max(0, Number(formValue('cms-lesson-minutes')) || 0);
    lesson.objectives = parseLines(formValue('cms-lesson-objectives'));
    setMessage('cms-global-message', 'Đã lưu bài học trong bộ nhớ làm việc.', 'success');
    markAndRender();
  }

  function saveActivity(event) {
    event.preventDefault();
    const activity = selectedActivity();
    if (!activity) return;
    let data; let refs;
    try {
      data = JSON.parse(formValue('cms-activity-data') || '{}');
      if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error('Dữ liệu hoạt động phải là JSON object.');
      const refsText = formValue('cms-activity-refs');
      refs = refsText ? JSON.parse(refsText) : [];
      if (!Array.isArray(refs)) throw new Error('Tham chiếu học liệu phải là JSON array.');
    } catch (error) { setMessage('cms-global-message', error.message, 'error'); return; }
    const title = formValue('cms-activity-title');
    if (!title) { setMessage('cms-global-message', 'Tên hoạt động không được để trống.', 'error'); return; }
    activity.title = title;
    activity.type = formValue('cms-activity-type');
    activity.order = Math.max(0, Number(formValue('cms-activity-order')) || 0);
    activity.instructions = formValue('cms-activity-instructions');
    activity.data = data;
    activity.item_refs = refs;
    setMessage('cms-global-message', 'Đã lưu hoạt động. Kiểm tra phần xem trước trước khi xuất bản.', 'success');
    markAndRender();
  }

  function addCourse() {
    const title = 'Khóa học mới';
    const id = makeId('course', title);
    const entry = { course: {
      schema_version: 1, id, slug: `khoa-hoc-${Date.now().toString(36)}`, title,
      description: '', level: 'N5', language: 'ja', target_language: 'vi', order: state.workspace.courses.length + 1,
      estimated_minutes: 0, tags: [], objectives: [], cover_image: null, module_refs: [], updated_at: null
    }, modules: [] };
    state.workspace.courses.push(entry);
    state.selectedCourseId = id; state.selectedModuleId = null; state.selectedLessonId = null; state.selectedActivityId = null;
    setMessage('cms-global-message', 'Đã tạo khóa học mới. Điền tên, mô tả và lưu thông tin.', 'success');
    markAndRender();
    $('cms-course-title').focus();
    $('cms-course-title').select();
  }

  function addModule() {
    const course = selectedCourseEntry();
    if (!course) return;
    const title = `Chương ${course.modules.length + 1}`;
    const module = { schema_version: 1, id: makeId('module', title), course_id: course.course.id, title, description: '', order: course.modules.length + 1, lesson_refs: [], updated_at: null };
    course.modules.push({ module, lessons: [] });
    state.selectedModuleId = module.id; state.selectedLessonId = null; state.selectedActivityId = null;
    setMessage('cms-global-message', 'Đã thêm chương. Điền tên và lưu chương.', 'success');
    markAndRender(); $('cms-module-title').focus(); $('cms-module-title').select();
  }

  function addLesson() {
    const module = selectedModuleEntry();
    if (!module) return;
    const title = `Bài ${module.lessons.length + 1}`;
    const lesson = { schema_version: 1, id: makeId('lesson', title), course_id: selectedCourseEntry().course.id, module_id: module.module.id, title, description: '', order: module.lessons.length + 1, estimated_minutes: 10, objectives: [], activities: [], updated_at: null };
    module.lessons.push(lesson);
    state.selectedLessonId = lesson.id; state.selectedActivityId = null;
    setMessage('cms-global-message', 'Đã thêm bài học. Điền thông tin rồi thêm các hoạt động.', 'success');
    markAndRender(); $('cms-lesson-title').focus(); $('cms-lesson-title').select();
  }

  function addActivity() {
    const lesson = selectedLesson();
    if (!lesson) return;
    const type = 'explanation';
    const activity = { id: makeId('activity', `${type}-${lesson.activities.length + 1}`), type, title: `Hoạt động ${lesson.activities.length + 1}`, order: lesson.activities.length + 1, instructions: '', data: { ...ACTIVITY_TEMPLATES.explanation }, item_refs: [] };
    lesson.activities.push(activity);
    state.selectedActivityId = activity.id;
    setMessage('cms-global-message', 'Đã thêm hoạt động. Chọn dạng bài và điền dữ liệu JSON.', 'success');
    markAndRender(); $('cms-activity-title').focus(); $('cms-activity-title').select();
  }

  function deleteSelected(type) {
    if (type === 'course') {
      const course = selectedCourseEntry(); if (!course) return;
      if (!window.confirm(`Xóa khóa học “${course.course.title}” khỏi bản làm việc? Khi xuất bản, các file thuộc khóa học này sẽ bị xóa khỏi GitHub.`)) return;
      state.workspace.courses = state.workspace.courses.filter((entry) => entry !== course);
      state.selectedCourseId = state.workspace.courses[0]?.course.id || null;
      state.selectedModuleId = null; state.selectedLessonId = null; state.selectedActivityId = null;
    } else if (type === 'module') {
      const course = selectedCourseEntry(); const module = selectedModuleEntry(); if (!course || !module) return;
      if (!window.confirm(`Xóa chương “${module.module.title}” và ${module.lessons.length} bài học khỏi bản làm việc?`)) return;
      course.modules = course.modules.filter((entry) => entry !== module);
      state.selectedModuleId = course.modules[0]?.module.id || null;
      state.selectedLessonId = null; state.selectedActivityId = null;
    } else if (type === 'lesson') {
      const module = selectedModuleEntry(); const lesson = selectedLesson(); if (!module || !lesson) return;
      if (!window.confirm(`Xóa bài học “${lesson.title}” khỏi bản làm việc?`)) return;
      module.lessons = module.lessons.filter((entry) => entry !== lesson);
      state.selectedLessonId = module.lessons[0]?.id || null; state.selectedActivityId = null;
    } else if (type === 'activity') {
      const lesson = selectedLesson(); const activity = selectedActivity(); if (!lesson || !activity) return;
      if (!window.confirm(`Xóa hoạt động “${activity.title}” khỏi bài học?`)) return;
      lesson.activities = lesson.activities.filter((entry) => entry !== activity);
      state.selectedActivityId = lesson.activities[0]?.id || null;
    }
    setMessage('cms-global-message', 'Đã xóa khỏi bản làm việc. Thay đổi chỉ lên GitHub khi bạn xuất bản.', 'success');
    markAndRender();
  }

  function fillActivityTemplate() {
    const type = formValue('cms-activity-type');
    $('cms-activity-data').value = JSON.stringify(ACTIVITY_TEMPLATES[type] || {}, null, 2);
  }

  function normalizeBankItem(bank, raw, index, defaultLevel) {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new Error(`Mục ${index + 1} phải là JSON object.`);
    const item = { ...raw };
    item.level = String(item.level || defaultLevel || 'N5').toUpperCase();
    item.topic = String(item.topic || 'Tổng hợp');
    if (!LEVELS.includes(item.level)) throw new Error(`Mục ${index + 1} có cấp độ không hợp lệ.`);
    if (bank === 'vocabulary') {
      item.jp = String(item.jp || '').trim(); item.vi = String(item.vi || '').trim();
      if (!item.jp || !item.vi) throw new Error(`Từ vựng mục ${index + 1} cần jp và vi.`);
      item.kanji = String(item.kanji || '').trim(); item.romaji = String(item.romaji || '');
      item.id = String(item.id || makeId('vocab', `${item.level}-${item.jp}-${index}`));
    } else if (bank === 'grammar') {
      item.pattern = String(item.pattern || '').trim();
      if (!item.pattern) throw new Error(`Ngữ pháp mục ${index + 1} cần pattern.`);
      item.id = String(item.id || makeId('grammar', `${item.level}-${item.pattern}-${index}`));
    } else {
      item.prompt_jp = String(item.prompt_jp || item.jp || '').trim(); item.answer = String(item.answer || '').trim();
      if (!item.prompt_jp || !item.answer) throw new Error(`Bài tập mục ${index + 1} cần prompt_jp và answer.`);
      item.kind = String(item.kind || 'choice'); item.type = 'exercise'; item.id = String(item.id || makeId('exercise', `${item.level}-${item.prompt_jp}-${index}`));
    }
    if (!/^[a-z0-9][a-z0-9_-]{1,63}$/.test(item.id)) throw new Error(`ID không hợp lệ ở mục ${index + 1}: ${item.id}`);
    return item;
  }

  function previewBankImport() {
    const text = formValue('cms-bank-json');
    if (!text) { state.pendingBankItems = null; $('cms-import-bank').disabled = true; setMessage('cms-bank-message', 'Dán dữ liệu JSON trước khi kiểm tra.', 'error'); return; }
    try {
      const parsed = JSON.parse(text);
      if (!Array.isArray(parsed) && (!parsed || typeof parsed !== 'object')) throw new Error('JSON phải là một mảng hoặc object.');
      const source = Array.isArray(parsed) ? parsed : (Array.isArray(parsed.items) ? parsed.items : parsed[state.activeBank]);
      if (!Array.isArray(source)) throw new Error(`Cần một mảng JSON hoặc object có khóa ${state.activeBank}.`);
      const items = source.map((item, index) => normalizeBankItem(state.activeBank, item, index, formValue('cms-bank-default-level')));
      if (!items.length) throw new Error('Mảng JSON đang trống.');
      const ids = new Set();
      items.forEach((item) => { if (ids.has(item.id)) throw new Error(`ID bị trùng trong tệp: ${item.id}`); ids.add(item.id); });
      state.pendingBankItems = items;
      $('cms-import-bank').disabled = false;
      setMessage('cms-bank-message', `Dữ liệu hợp lệ: ${items.length} mục ${state.activeBank}. Nhấn “Thêm vào ngân hàng” để áp dụng vào bản làm việc.`, 'success');
    } catch (error) {
      state.pendingBankItems = null; $('cms-import-bank').disabled = true;
      setMessage('cms-bank-message', error.message, 'error');
    }
  }

  function importBankItems() {
    if (!state.pendingBankItems) return;
    const bank = state.activeBank;
    const existing = state.workspace.banks[bank];
    const replace = $('cms-bank-duplicate-mode').value === 'replace';
    let added = 0; let updated = 0; let skipped = 0;
    state.pendingBankItems.forEach((item) => {
      const index = existing.findIndex((current) => current.id === item.id);
      if (index < 0) { existing.push(item); added += 1; }
      else if (replace) { existing[index] = item; updated += 1; }
      else skipped += 1;
    });
    $('cms-bank-json').value = '';
    state.pendingBankItems = null; $('cms-import-bank').disabled = true;
    setMessage('cms-bank-message', `Đã áp dụng: thêm ${added}, cập nhật ${updated}, bỏ qua ${skipped}. Chưa xuất bản lên GitHub.`, 'success');
    markAndRender();
  }

  function switchBank(bank) {
    if (!BANKS.includes(bank)) return;
    state.activeBank = bank; state.pendingBankItems = null;
    $('cms-bank-json').value = ''; $('cms-import-bank').disabled = true;
    setMessage('cms-bank-message', '', 'success');
    renderAll();
  }

  async function loadWorkspace() {
    const result = await callCms('load_workspace');
    state.workspace = normalizeWorkspace(result.workspace);
    state.draftId = null;
    state.selectedCourseId = state.workspace.courses[0]?.course.id || null;
    state.selectedModuleId = null; state.selectedLessonId = null; state.selectedActivityId = null;
    const firstCourse = selectedCourseEntry();
    if (firstCourse) state.selectedModuleId = firstCourse.modules[0]?.module.id || null;
    const firstModule = selectedModuleEntry();
    if (firstModule) state.selectedLessonId = firstModule.lessons[0]?.id || null;
    const firstLesson = selectedLesson();
    if (firstLesson) state.selectedActivityId = firstLesson.activities[0]?.id || null;
    setDirty(false);
    renderAll();
    await loadDrafts();
  }

  async function saveDraft() {
    if (!state.workspace) return;
    const title = formValue('cms-draft-title') || 'Bản nháp học liệu';
    const result = await callCms('save_draft', { title, draftId: state.draftId, workspace: state.workspace });
    state.draftId = result.draftId || state.draftId;
    setDirty(false);
    setMessage('cms-global-message', 'Đã lưu bản nháp trong Supabase Storage riêng tư. Nội dung chưa được công khai trên GitHub.', 'success');
    await loadDrafts();
  }

  async function loadDrafts() {
    const host = $('cms-draft-list');
    try {
      const result = await callCms('list_drafts');
      const drafts = Array.isArray(result.drafts) ? result.drafts : [];
      if (!drafts.length) { host.innerHTML = '<p class="cms-empty">Chưa có bản nháp nào.</p>'; return; }
      host.innerHTML = drafts.map((draft) => `<div class="cms-draft-card"><div><strong>${escapeHtml(draft.title)}</strong><small>${escapeHtml(draft.status)} · Cập nhật ${escapeHtml(new Date(draft.updated_at).toLocaleString('vi-VN'))}</small></div><div class="cms-draft-actions"><button class="cms-button cms-button-light" type="button" data-load-draft="${escapeHtml(draft.id)}">Mở</button><button class="cms-button cms-button-danger" type="button" data-delete-draft="${escapeHtml(draft.id)}">Xóa</button></div></div>`).join('');
      host.querySelectorAll('[data-load-draft]').forEach((button) => button.addEventListener('click', () => loadDraft(button.dataset.loadDraft)));
      host.querySelectorAll('[data-delete-draft]').forEach((button) => button.addEventListener('click', () => deleteDraft(button.dataset.deleteDraft)));
    } catch (error) {
      host.innerHTML = `<p class="cms-empty">Không tải được danh sách nháp: ${escapeHtml(error.message)}</p>`;
    }
  }

  async function loadDraft(id) {
    if (state.dirty && !window.confirm('Mở bản nháp sẽ thay thế các thay đổi chưa lưu. Tiếp tục?')) return;
    try {
      const result = await callCms('get_draft', { draftId: id });
      state.workspace = normalizeWorkspace(result.draft.payload);
      state.draftId = id;
      $('cms-draft-title').value = result.draft.title || '';
      state.selectedCourseId = state.workspace.courses[0]?.course.id || null;
      state.selectedModuleId = selectedCourseEntry()?.modules[0]?.module.id || null;
      state.selectedLessonId = selectedModuleEntry()?.lessons[0]?.id || null;
      state.selectedActivityId = selectedLesson()?.activities[0]?.id || null;
      setDirty(false); renderAll();
      setMessage('cms-global-message', 'Đã mở bản nháp. Hãy kiểm tra phiên bản GitHub trước khi xuất bản.', 'success');
    } catch (error) { setMessage('cms-global-message', error.message, 'error'); }
  }

  async function deleteDraft(id) {
    if (!window.confirm('Xóa bản nháp này khỏi Supabase?')) return;
    try {
      await callCms('delete_draft', { draftId: id });
      if (state.draftId === id) state.draftId = null;
      await loadDrafts();
      setMessage('cms-global-message', 'Đã xóa bản nháp.', 'success');
    } catch (error) { setMessage('cms-global-message', error.message, 'error'); }
  }

  async function publishWorkspace() {
    const errors = renderValidation();
    if (errors.length) { setMessage('cms-global-message', 'Chưa thể xuất bản. Hãy sửa các lỗi trong phần kiểm tra.', 'error'); return; }
    const courseCount = state.workspace.courses.length;
    const itemCount = BANKS.reduce((sum, bank) => sum + state.workspace.banks[bank].length, 0);
    const confirmed = window.confirm(`Xuất bản ${courseCount} khóa học và ${itemCount} mục học liệu lên GitHub? Nội dung sẽ công khai. Các file không còn được tham chiếu sau khi xóa trong bản làm việc sẽ bị loại khỏi kho. Tiếp tục?`);
    if (!confirmed) return;
    $('cms-publish').disabled = true; $('cms-publish').textContent = 'Đang xuất bản…';
    try {
      await saveDraft();
      const result = await callCms('publish', { workspace: state.workspace, draftId: state.draftId });
      setMessage('cms-global-message', `Xuất bản thành công · Phiên bản ${result.result.content_version} · Commit ${result.result.commit_sha}.`, 'success');
      if (result.result.commit_url) {
        const link = document.createElement('a'); link.href = result.result.commit_url; link.target = '_blank'; link.rel = 'noopener'; link.textContent = 'Mở commit GitHub';
        $('cms-global-message').appendChild(document.createTextNode(' ')); $('cms-global-message').appendChild(link);
      }
      try { await loadWorkspace(); }
      catch (refreshError) { setMessage('cms-global-message', `Đã xuất bản lên GitHub nhưng chưa tải lại được workspace: ${refreshError.message}`, 'error'); }
    } catch (error) {
      const message = error.message || 'Không thể xuất bản.';
      if (/thay đổi|conflict|409|ref/i.test(message)) {
        setMessage('cms-global-message', `${message} Hãy tải lại GitHub, so sánh và áp dụng lại các chỉnh sửa trước khi thử lại.`, 'error');
      } else setMessage('cms-global-message', message, 'error');
    } finally {
      $('cms-publish').disabled = false; $('cms-publish').textContent = 'Xuất bản lên GitHub';
    }
  }

  function exportWorkspace() {
    if (!state.workspace) return;
    const blob = new Blob([JSON.stringify(state.workspace, null, 2)], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url; link.download = `kdsp-workspace-v${state.workspace.baseContentVersion || 1}.json`;
    document.body.appendChild(link); link.click(); link.remove(); URL.revokeObjectURL(url);
  }

  async function importWorkspaceFile(file) {
    if (!file) return;
    if (state.dirty && !window.confirm('Nhập JSON sẽ thay thế thay đổi chưa lưu. Tiếp tục?')) return;
    try {
      const parsed = JSON.parse(await file.text());
      const rawWorkspace = parsed.workspace || parsed;
      if (rawWorkspace.baseContentVersion == null) rawWorkspace.baseContentVersion = state.workspace.baseContentVersion;
      if (!rawWorkspace.headSha) rawWorkspace.headSha = state.workspace.headSha;
      const workspace = normalizeWorkspace(rawWorkspace);
      state.workspace = workspace; state.draftId = null;
      state.selectedCourseId = workspace.courses[0]?.course.id || null;
      state.selectedModuleId = selectedCourseEntry()?.modules[0]?.module.id || null;
      state.selectedLessonId = selectedModuleEntry()?.lessons[0]?.id || null;
      state.selectedActivityId = selectedLesson()?.activities[0]?.id || null;
      setDirty(true); renderAll(); renderValidation();
      setMessage('cms-global-message', 'Đã nhập JSON vào bản làm việc. Hãy kiểm tra và lưu bản nháp trước khi xuất bản.', 'success');
    } catch (error) { setMessage('cms-global-message', `Không thể nhập JSON: ${error.message}`, 'error'); }
    $('cms-import-file').value = '';
  }

  async function refreshWorkspace() {
    if (state.dirty && !window.confirm('Tải lại GitHub sẽ bỏ các thay đổi chưa lưu trên màn hình. Bạn đã lưu bản nháp chưa?')) return;
    try { await loadWorkspace(); setMessage('cms-global-message', 'Đã tải lại dữ liệu mới nhất từ GitHub.', 'success'); }
    catch (error) { setMessage('cms-global-message', error.message, 'error'); }
  }

  async function checkAdmin() {
    const user = await window.AppDB.getUser();
    if (!user) { setPanel('cms-login-panel', true); $('cms-logout').hidden = true; return; }
    $('cms-logout').hidden = false;
    let allowed = false;
    try { allowed = await window.AppDB.isAdmin(); }
    catch (error) { setPanel('cms-login-panel', false); setPanel('cms-denied-panel', true); $('cms-denied-user').textContent = error.message; return; }
    if (!allowed) {
      setPanel('cms-login-panel', false); setPanel('cms-denied-panel', true);
      $('cms-denied-user').textContent = user.email || user.id;
      return;
    }
    setPanel('cms-login-panel', false); setPanel('cms-denied-panel', false); setPanel('cms-gate-panel', true);
    $('cms-logout').hidden = false;
  }

  async function initialize() {
    if (!window.AppDB || !window.AppDB.isConfigured()) { setPanel('cms-setup-warning', true); return; }
    try {
      const ready = await window.AppDB.loadSdk();
      if (!ready || !window.AppDB.init()) throw new Error('Không tải được thư viện Supabase.');
      await checkAdmin();
    } catch (error) {
      setPanel('cms-setup-warning', true);
      $('cms-setup-warning').insertAdjacentHTML('beforeend', `<p class="cms-message cms-message-error">${escapeHtml(error.message)}</p>`);
    }
  }

  $('cms-login-form').addEventListener('submit', async (event) => {
    event.preventDefault();
    setMessage('cms-login-error', '', 'error');
    const button = event.submitter || $('cms-login-form').querySelector('button[type="submit"]');
    button.disabled = true; button.textContent = 'Đang đăng nhập…';
    try {
      await window.AppDB.signIn(formValue('cms-login-identifier'), formValue('cms-login-password'));
      await checkAdmin();
    } catch (error) { setMessage('cms-login-error', error.message, 'error'); }
    finally { button.disabled = false; button.textContent = 'Đăng nhập'; }
  });

  $('cms-gate-form').addEventListener('submit', async (event) => {
    event.preventDefault();
    const password = formValue('cms-gate-password');
    const button = event.submitter || $('cms-gate-form').querySelector('button[type="submit"]');
    button.disabled = true; button.textContent = 'Đang xác thực…';
    state.gatePassword = password;
    try {
      const result = await callCms('load_workspace');
      state.workspace = normalizeWorkspace(result.workspace);
      state.selectedCourseId = state.workspace.courses[0]?.course.id || null;
      state.selectedModuleId = selectedCourseEntry()?.modules[0]?.module.id || null;
      state.selectedLessonId = selectedModuleEntry()?.lessons[0]?.id || null;
      state.selectedActivityId = selectedLesson()?.activities[0]?.id || null;
      setPanel('cms-gate-panel', false); setPanel('cms-workspace', true);
      $('cms-logout').hidden = false;
      setDirty(false); renderAll(); await loadDrafts();
      setMessage('cms-global-message', 'Đã kết nối kho học liệu GitHub. Bạn có thể bắt đầu tạo nội dung.', 'success');
    } catch (error) {
      state.gatePassword = '';
      setMessage('cms-gate-error', error.message, 'error');
    } finally { button.disabled = false; button.textContent = 'Mở trình quản lý'; }
  });

  $('cms-logout').addEventListener('click', async () => {
    if (state.dirty && !window.confirm('Bạn còn thay đổi chưa lưu. Đăng xuất và bỏ thay đổi này?')) return;
    try { await window.AppDB.signOut(); } catch (_) { /* Tiếp tục trở về trang đăng nhập. */ }
    window.location.reload();
  });

  $('cms-add-course').addEventListener('click', addCourse);
  $('cms-add-module').addEventListener('click', addModule);
  $('cms-add-lesson').addEventListener('click', addLesson);
  $('cms-add-activity').addEventListener('click', addActivity);
  $('cms-course-form').addEventListener('submit', saveCourse);
  $('cms-module-form').addEventListener('submit', saveModule);
  $('cms-lesson-form').addEventListener('submit', saveLesson);
  $('cms-activity-form').addEventListener('submit', saveActivity);
  $('cms-delete-course').addEventListener('click', () => deleteSelected('course'));
  $('cms-delete-module').addEventListener('click', () => deleteSelected('module'));
  $('cms-delete-lesson').addEventListener('click', () => deleteSelected('lesson'));
  $('cms-delete-activity').addEventListener('click', () => deleteSelected('activity'));
  $('cms-fill-activity-template').addEventListener('click', fillActivityTemplate);
  $('cms-bank-tabs').addEventListener('click', (event) => {
    const button = event.target.closest('[data-bank]');
    if (button) switchBank(button.dataset.bank);
  });
  $('cms-preview-bank').addEventListener('click', previewBankImport);
  $('cms-import-bank').addEventListener('click', importBankItems);
  $('cms-run-validation').addEventListener('click', renderValidation);
  $('cms-save-draft').addEventListener('click', async () => {
    const button = $('cms-save-draft'); button.disabled = true; button.textContent = 'Đang lưu…';
    try { await saveDraft(); } catch (error) { setMessage('cms-global-message', error.message, 'error'); }
    finally { button.disabled = false; button.textContent = 'Lưu bản nháp'; }
  });
  $('cms-refresh-drafts').addEventListener('click', loadDrafts);
  $('cms-publish').addEventListener('click', publishWorkspace);
  $('cms-refresh').addEventListener('click', refreshWorkspace);
  $('cms-export-workspace').addEventListener('click', exportWorkspace);
  $('cms-import-workspace').addEventListener('click', () => $('cms-import-file').click());
  $('cms-import-file').addEventListener('change', (event) => importWorkspaceFile(event.target.files?.[0]));

  window.addEventListener('beforeunload', (event) => {
    if (!state.dirty) return;
    event.preventDefault(); event.returnValue = '';
  });

  initialize();
})();
