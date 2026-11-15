/* KDSP learning UI: safe rendering, accessible interactions, 13 activity kinds. */
(function () {
  'use strict';
  const $ = (id) => document.getElementById(id);
  const E = (value) => String(value === null || value === undefined ? '' : value)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  const TYPES = new Set(['explanation', 'vocabulary', 'kanji', 'grammar', 'tap_translate',
    'matching', 'multiple_choice', 'fill_blank', 'sentence_order', 'listening', 'speaking',
    'dictation', 'quiz']);
  let navigationCount = 0;
  let session = null;
  let toastTimeout = null;
  let activityState = {};
  let release = null;

  const refHash = (id) => encodeURIComponent(id);
  const urlCourse = (courseId) => '#/c/' + refHash(courseId);
  const urlModule = (courseId, moduleId) => urlCourse(courseId) + '/m/' + refHash(moduleId);
  const urlLesson = (courseId, moduleId, lessonId, index = 0) =>
    urlModule(courseId, moduleId) + '/l/' + refHash(lessonId) + '/' + index;
  const isValidId = (value) => /^[a-z0-9][a-z0-9_-]{1,63}$/.test(value || '');

  function showToast(message) {
    const host = $('course-toast');
    if (!host) return;
    host.textContent = message;
    host.hidden = false;
    clearTimeout(toastTimeout);
    toastTimeout = setTimeout(() => { host.hidden = true; }, 3800);
  }

  function setFeedback(message, kind) {
    const host = $('course-activity-feedback');
    host.hidden = !message;
    host.className = 'course-feedback' + (kind ? ' is-' + kind : '');
    host.textContent = message || '';
  }

  function showPage(page) {
    document.querySelectorAll('.course-screen').forEach((node) => {
      node.hidden = node.id !== page;
    });
  }

  function setNetworkStatus() {
    const state = CourseContent.status();
    const progress = CourseProgress.status();
    const labels = { online: 'Học liệu mới nhất', offline: 'Đang dùng offline', loading: 'Đang tải…', error: 'Chưa có dữ liệu' };
    const parts = [labels[state.mode] || 'Đang tải…'];
    if (!state.storageAvailable || !progress.persistence) parts.push('Lưu trữ hạn chế');
    $('course-network-status').textContent = parts.join(' · ');
  }

  function breadcrumb(items) {
    $('course-breadcrumb').innerHTML = items.map((entry, index) =>
      `${index ? '<span aria-hidden="true">/</span>' : ''}<a href="${E(entry.url)}">${E(entry.title)}</a>`).join('');
  }

  function renderError(error) {
    $('course-error-message').textContent = error.message || 'Không mở được học liệu.';
    showPage('course-error-panel');
    setNetworkStatus();
  }

  function parseRoute() {
    let hash = '/';
    try { hash = decodeURIComponent(location.hash.slice(1) || '/'); }
    catch (_) { return { page: 'catalog' }; }
    if (hash === '/' || hash === '') return { page: 'catalog' };
    const segments = hash.split('/').filter(Boolean);
    if ((segments.length === 2 || segments.length === 4 || segments.length === 6 || segments.length === 7) &&
        segments[0] === 'c' && isValidId(segments[1]) &&
        (segments.length < 4 || segments[2] === 'm' && isValidId(segments[3])) &&
        (segments.length < 6 || segments[4] === 'l' && isValidId(segments[5]))) {
      return { page: segments.length === 2 ? 'course' : segments.length === 4 ? 'module' : 'lesson',
        courseId: segments[1], moduleId: segments[3], lessonId: segments[5],
        index: segments.length === 7 ? Math.max(0, Number.parseInt(segments[6], 10) || 0) : 0 };
    }
    return { page: 'catalog' };
  }

  async function navigate() {
    const token = ++navigationCount;
    const route = parseRoute();
    $('course-network-status').textContent = 'Đang tải…';
    try {
      if (route.page === 'catalog') {
        const catalog = await CourseContent.getCatalog();
        if (token !== navigationCount) return;
        await renderCatalog(catalog);
      } else if (route.page === 'course') {
        const course = await CourseContent.getCourse(route.courseId);
        if (token !== navigationCount) return;
        renderCourse(course);
      } else if (route.page === 'module') {
        const [course, module] = await Promise.all([
          CourseContent.getCourse(route.courseId), CourseContent.getModule(route.courseId, route.moduleId)
        ]);
        if (token !== navigationCount) return;
        renderModule(course, module);
      } else {
        const [course, module, lesson] = await Promise.all([
          CourseContent.getCourse(route.courseId),
          CourseContent.getModule(route.courseId, route.moduleId),
          CourseContent.getLesson(route.courseId, route.moduleId, route.lessonId)
        ]);
        if (token !== navigationCount) return;
        await renderLesson(course, module, lesson, route.index);
      }
      setNetworkStatus();
    } catch (error) {
      if (token === navigationCount) renderError(error);
    }
  }

  async function renderCatalog(catalog) {
    session = null;
    breadcrumb([{ title: 'Khóa học', url: '#/' }]);
    const courses = Array.isArray(catalog.courses) ? catalog.courses.slice().sort((a, b) => (a.order || 0) - (b.order || 0)) : [];
    $('course-catalog-items').innerHTML = courses.length ? courses.map((course) =>
      `<a class="course-card" href="${E(urlCourse(course.id))}"><span>${E(course.level || 'JLPT')}</span>
       <strong>${E(course.title)}</strong><p>${E(course.description || 'Học theo chương và bài học.')}</p></a>`).join('') :
      '<div class="course-empty">Chưa có khóa học được xuất bản. Nội dung sẽ xuất hiện tại đây sau khi quản trị viên tạo và phát hành khóa học.</div>';
    showPage('course-catalog-panel');
    renderBackupControls();
  }

  function renderCourse(course) {
    session = null;
    breadcrumb([{ title: 'Khóa học', url: '#/' }, { title: course.title, url: urlCourse(course.id) }]);
    $('course-detail-level').textContent = course.level || '';
    $('course-detail-heading').textContent = course.title;
    $('course-detail-description').textContent = course.description || '';
    $('course-detail-meta').textContent = (course.module_refs || []).length + ' chương';
    if (!$('course-download-offline')) {
      const button = document.createElement('button');
      button.id = 'course-download-offline';
      button.type = 'button';
      button.className = 'course-button course-button-light';
      button.textContent = 'Lưu khóa học để học offline';
      $('course-detail-meta').after(button);
    }
    $('course-download-offline').dataset.courseId = course.id;
    $('course-module-items').innerHTML = (course.module_refs || []).length
      ? course.module_refs.map((ref, index) => `<a class="course-row" href="${E(urlModule(course.id, ref.id))}"><span>CHƯƠNG ${index + 1}</span><strong>${E(ref.title || ref.id)}</strong><p>Mở để xem các bài học.</p></a>`).join('')
      : '<div class="course-empty">Khóa học chưa có chương.</div>';
    showPage('course-detail-panel');
  }

  function renderModule(course, module) {
    session = null;
    breadcrumb([{ title: 'Khóa học', url: '#/' }, { title: course.title, url: urlCourse(course.id) },
      { title: module.title, url: urlModule(course.id, module.id) }]);
    $('course-module-heading').textContent = module.title;
    $('course-module-description').textContent = module.description || '';
    $('course-module-meta').textContent = (module.lesson_refs || []).length + ' bài học';
    $('course-lesson-items').innerHTML = (module.lesson_refs || []).length
      ? module.lesson_refs.map((ref, index) => `<a class="course-row" href="${E(urlLesson(course.id, module.id, ref.id))}"><span>BÀI ${index + 1}</span><strong>${E(ref.title || ref.id)}</strong><p>Mở bài học để tiếp tục.</p></a>`).join('')
      : '<div class="course-empty">Chương chưa có bài học.</div>';
    showPage('course-module-panel');
  }

  async function renderLesson(course, module, lesson, index) {
    const progress = await CourseProgress.getLesson(lesson);
    const total = lesson.activities.length;
    const current = Math.min(Math.max(0, index), Math.max(total - 1, 0));
    session = { course, module, lesson, index: current, progress };
    activityState = { questionIndex: 0, matched: new Set(), left: null, tiles: [], visited: new Set() };
    breadcrumb([{ title: 'Khóa học', url: '#/' }, { title: course.title, url: urlCourse(course.id) },
      { title: module.title, url: urlModule(course.id, module.id) }, { title: lesson.title, url: urlLesson(course.id, module.id, lesson.id) }]);
    $('course-lesson-heading').textContent = lesson.title;
    $('course-lesson-description').textContent = lesson.description || '';
    showPage('course-lesson-panel');
    await renderActivity();
  }

  function progressSummary() {
    const { lesson, progress, index } = session;
    const completed = new Set(progress.data.completedActivities || []);
    const total = lesson.activities.length;
    const done = lesson.activities.filter((item) => completed.has(item.id)).length;
    const pct = total ? Math.round(done / total * 100) : 0;
    $('course-activity-count').textContent = done + ' / ' + total + ' hoạt động';
    $('course-progress-fill').style.width = pct + '%';
    $('course-progress-percent').textContent = pct + '%';
    $('course-activity-steps').innerHTML = lesson.activities.map((item, idx) =>
      `<button type="button" class="course-step${idx === index ? ' is-current' : ''}${completed.has(item.id) ? ' is-done' : ''}" data-activity-index="${idx}" aria-label="Hoạt động ${idx + 1}: ${E(item.title)}" aria-current="${idx === index ? 'step' : 'false'}">${completed.has(item.id) ? '✓' : idx + 1}</button>`).join('');
    $('course-prev-activity').disabled = index <= 0;
    $('course-next-activity').textContent = index >= total - 1 ? 'Hoàn thành bài' : 'Tiếp theo';
    $('course-skip-activity').disabled = index >= total - 1;
  }

  async function resolveItems(activity) {
    const inline = Array.isArray(activity.data?.items) ? activity.data.items : [];
    const refs = Array.isArray(activity.item_refs) ? activity.item_refs : [];
    if (!refs.length) return inline;
    const groups = { vocabulary: [], grammar: [], exercises: [] };
    for (const ref of refs) {
      const type = ref.type === 'exercise' ? 'exercises' : ref.type;
      if (groups[type] && isValidId(ref.id)) groups[type].push(ref.id);
    }
    const results = await Promise.all(Object.keys(groups).filter((key) => groups[key].length)
      .map(async (key) => CourseContent.getItems(key, groups[key])));
    return [...inline, ...results.flat()];
  }

  function commonHeader(activity) {
    return `<p class="course-kicker">${E(activity.type.replace(/_/g, ' ').toUpperCase())}</p><h2>${E(activity.title)}</h2>
      ${activity.instructions ? `<p>${E(activity.instructions)}</p>` : ''}`;
  }

  function renderNotes(text) {
    // Limited Markdown only. Escape user data first; never render arbitrary HTML.
    const inline = (value) => E(value).replace(/\*\*([^*\n]+)\*\*/g, '<strong>$1</strong>');
    const lines = String(text || '').split(/\r?\n/);
    const result = [];
    for (const line of lines) {
      const heading = line.match(/^(#{1,3})\s+(.+)$/);
      if (heading) { result.push('<h3>' + inline(heading[2]) + '</h3>'); continue; }
      const bullet = line.match(/^[-*]\s+(.+)$/);
      if (bullet) { result.push('<p>• ' + inline(bullet[1]) + '</p>'); continue; }
      result.push(line.trim() ? '<p>' + inline(line) + '</p>' : '');
    }
    return '<div class="course-markdown">' + result.join('') + '</div>';
  }

  function renderCards(items, kind) {
    return items.length ? items.map((item) => {
      const primary = kind === 'grammar' ? item.pattern || item.jp : kind === 'kanji' ? item.kanji || item.jp : item.kanji || item.jp;
      const secondary = kind === 'grammar' ? item.meaning || item.explanation || item.structure : item.vi || item.meaning_vi || item.meaning;
      return `<div class="course-word-card"><strong>${E(primary)}</strong><small>${E(item.jp && item.jp !== primary ? item.jp + ' · ' : '')}${E(item.romaji || item.reading || '')}</small>
        <p>${E(secondary)}</p>${item.explanation && kind !== 'grammar' ? `<p>${E(item.explanation)}</p>` : ''}
        <button class="course-button course-button-light" type="button" data-speak="${E(item.jp || item.kanji || item.pattern || '')}">Nghe phát âm</button></div>`;
    }).join('') : '<p class="course-muted">Chưa có học liệu được tham chiếu.</p>';
  }

  function questionOf(activity) {
    const data = activity.data || {};
    const questions = activityState.quizQuestions || (Array.isArray(data.questions) ? data.questions : Array.isArray(data.prompts) ? data.prompts : [data]);
    if (!questions.length) return {};
    return questions[Math.min(activityState.questionIndex || 0, questions.length - 1)] || {};
  }

  function questionCount(activity) {
    const data = activity.data || {};
    if (activityState.quizQuestions) return activityState.quizQuestions.length;
    if (Array.isArray(data.questions)) return data.questions.length;
    if (Array.isArray(data.prompts)) return data.prompts.length;
    return 1;
  }

  function renderQuestionOptions(options) {
    return `<div class="course-choice-list">${options.map((option, idx) =>
      `<button type="button" class="course-choice" data-answer-index="${idx}">${E(option)}</button>`).join('')}</div>`;
  }

  function renderQuestion(activity) {
    const question = questionOf(activity);
    const total = questionCount(activity);
    const title = question.prompt || question.prompt_jp || question.prompt_vi || 'Chọn câu trả lời';
    const options = Array.isArray(question.options) ? question.options : [];
    const idx = activityState.questionIndex || 0;
    const isAudio = ['listening', 'dictation'].includes(activity.type);
    const isSpeaking = activity.type === 'speaking';
    const isOrdering = activity.type === 'sentence_order';
    let body = `<p class="course-muted">Câu ${idx + 1} / ${total}</p><p class="course-question">${E(title)}</p>`;
    if (isAudio || isSpeaking) {
      const phrase = question.audio_text || question.sample_answer || question.prompt_jp || question.answer || '';
      body += `<div class="course-inline-actions"><button type="button" class="course-button course-button-light" data-speak="${E(phrase)}">Nghe tiếng Nhật</button></div>`;
    }
    if (isSpeaking) {
      body += `<p class="course-preview">${E(question.sample_answer || 'Tự luyện nói câu trên và đối chiếu với mẫu.')}</p>
       <button type="button" class="course-button course-button-primary" data-confirm-speaking="1">Tôi đã luyện nói</button>`;
    } else if (isOrdering) {
      const words = Array.isArray(question.words) ? question.words : [];
      body += `<div class="course-preview" id="course-order-result">${E((activityState.tiles || []).map((i) => words[i]).join(' ')) || 'Chạm các từ theo đúng thứ tự'}</div>
        <div class="course-tile-list" style="display:flex;flex-wrap:wrap">${words.map((word, i) => `<button type="button" class="course-tile" data-tile-index="${i}"${activityState.tiles.includes(i) ? ' disabled' : ''}>${E(word)}</button>`).join('')}</div>
        <div class="course-inline-actions"><button class="course-button course-button-light" data-order-reset="1" type="button">Làm lại</button><button class="course-button course-button-primary" data-verify="1" type="button">Kiểm tra</button></div>`;
    } else if (options.length) {
      body += renderQuestionOptions(options);
    } else {
      body += `<label for="course-free-answer">Câu trả lời</label><input id="course-free-answer" class="course-input" type="text" maxlength="500" autocapitalize="off" autocomplete="off" spellcheck="false" placeholder="Nhập câu trả lời" />
        <button type="button" class="course-button course-button-primary" data-verify="1">Kiểm tra</button>`;
    }
    return body;
  }

  function renderMatching(activity) {
    const pairs = Array.isArray(activity.data?.pairs) ? activity.data.pairs : [];
    const rights = pairs.map((pair, index) => ({ text: pair.right, pair: index })).reverse();
    return pairs.length ? `<div class="course-match-grid"><div class="course-match-column">${pairs.map((pair, index) =>
      `<button type="button" data-match-side="left" data-match-id="${index}" class="${activityState.matched.has(index) ? 'is-matched' : ''}${activityState.left === index ? ' is-selected' : ''}" ${activityState.matched.has(index) ? 'disabled' : ''}>${E(pair.left)}</button>`).join('')}</div>
      <div class="course-match-column">${rights.map((pair) => `<button type="button" data-match-side="right" data-match-id="${pair.pair}" class="${activityState.matched.has(pair.pair) ? 'is-matched' : ''}" ${activityState.matched.has(pair.pair) ? 'disabled' : ''}>${E(pair.text)}</button>`).join('')}</div></div>`
      : '<p class="course-muted">Chưa có cặp ghép.</p>';
  }

  async function renderActivity() {
    if (!session) return;
    const { lesson, index } = session;
    progressSummary();
    setFeedback('', '');
    const host = $('course-activity-content');
    if (!lesson.activities.length) {
      host.innerHTML = '<div class="course-complete"><strong>Chưa có hoạt động trong bài</strong><p>Hãy quay lại danh sách bài học.</p></div>';
      return;
    }
    const activity = lesson.activities[index];
    if (!TYPES.has(activity.type)) {
      host.innerHTML = commonHeader(activity) + '<div class="course-notice">Dạng hoạt động này chưa được hỗ trợ trong phiên bản hiện tại.</div>';
      return;
    }
    let inner = commonHeader(activity);
    const data = activity.data || {};
    if (activity.type === 'explanation') {
      inner += renderNotes(data.body_markdown || data.content || data.text || '');
      inner += '<button class="course-button course-button-primary" type="button" data-read-confirm="1">Tôi đã đọc</button>';
    } else if (['vocabulary', 'kanji', 'grammar'].includes(activity.type)) {
      inner += renderCards(await resolveItems(activity), activity.type);
      inner += '<button type="button" class="course-button course-button-primary" data-read-confirm="1">Tôi đã học phần này</button>';
    } else if (activity.type === 'tap_translate') {
      const tokens = Array.isArray(data.tokens) ? data.tokens : [];
      inner += `<p class="course-jp">${E(data.sentence_jp || '')}</p><div class="course-tokens">${tokens.map((item, i) =>
        `<button type="button" data-token-index="${i}">${E(item.text)}</button>`).join('')}</div><p class="course-muted">Chạm từng từ để xem nghĩa và cách đọc.</p>`;
    } else if (activity.type === 'matching') {
      inner += renderMatching(activity);
    } else {
      if (activity.type === 'quiz' && (!Array.isArray(data.questions) || !data.questions.length) &&
          Array.isArray(activity.item_refs) && activity.item_refs.some((ref) => ref.type === 'exercise')) {
        if (!activityState.quizQuestions) {
          const referenced = await resolveItems(activity);
          activityState.quizQuestions = referenced.filter((item) => item.kind || item.prompt_jp).map((item) => ({
            prompt: item.prompt_jp || item.prompt || '', options: item.options || [],
            answer: item.answer || '', explanation: item.explanation || ''
          }));
        }
      }
      inner += renderQuestion(activity);
    }
    // Route may change while an async bank lookup is pending.
    if (!session || session.lesson !== lesson || session.index !== index) return;
    host.innerHTML = inner;
  }

  async function markCurrent() {
    if (!session || !session.lesson.activities.length) return;
    const { lesson, index } = session;
    const id = lesson.activities[index].id;
    try {
      session.progress = await CourseProgress.completeActivity(lesson, id);
      progressSummary();
      setFeedback('Đã ghi nhận hoạt động này.', 'success');
    } catch (error) {
      setFeedback(error.message || 'Chưa lưu được tiến độ.', 'error');
    }
  }

  function normalizeAnswer(value) {
    return String(value ?? '').normalize('NFKC').toLocaleLowerCase().replace(/[\s。！？、.,!?]+/g, '').trim();
  }

  async function checkAnswer(value) {
    if (!session) return;
    const activity = session.lesson.activities[session.index];
    const question = questionOf(activity);
    const answer = question.answer === undefined ? question.correct : question.answer;
    const correct = normalizeAnswer(value) === normalizeAnswer(answer);
    if (!correct) { setFeedback('Chưa đúng, hãy thử lại.', 'error'); return; }
    const total = questionCount(activity);
    if ((activityState.questionIndex || 0) + 1 < total) {
      activityState.questionIndex += 1;
      activityState.tiles = [];
      await renderActivity();
      setFeedback('Đúng. Chuyển sang câu tiếp theo.', 'success');
    } else {
      await markCurrent();
      if (question.explanation) setFeedback('Đúng. ' + question.explanation, 'success');
    }
  }

  function speak(text) {
    if (!text || !window.speechSynthesis || !window.SpeechSynthesisUtterance) {
      showToast('Thiết bị hiện không hỗ trợ giọng đọc Nhật.');
      return;
    }
    try {
      speechSynthesis.cancel();
      const speech = new SpeechSynthesisUtterance(String(text));
      speech.lang = 'ja-JP';
      speech.rate = 0.88;
      speechSynthesis.speak(speech);
    } catch (_) { showToast('Không thể phát âm thanh trên thiết bị này.'); }
  }

  async function handleActivityClick(event) {
    if (!session) return;
    const target = event.target.closest('button');
    if (!target) return;
    const activity = session.lesson.activities[session.index];
    if (!activity) return;
    if (target.dataset.speak !== undefined) { speak(target.dataset.speak); return; }
    if (target.dataset.readConfirm || target.dataset.confirmSpeaking) { await markCurrent(); return; }
    if (target.dataset.tokenIndex !== undefined) {
      const index = Number(target.dataset.tokenIndex);
      const token = activity.data?.tokens?.[index];
      if (!token) return;
      activityState.visited.add(index);
      setFeedback((token.reading || token.text || '') + ' — ' + (token.meaning_vi || ''), 'success');
      if (activityState.visited.size >= (activity.data.tokens || []).length) await markCurrent();
      speak(token.reading || token.text);
      return;
    }
    if (target.dataset.matchSide) {
      const pairId = Number(target.dataset.matchId);
      if (target.dataset.matchSide === 'left') {
        activityState.left = pairId;
        await renderActivity();
      } else if (activityState.left === pairId) {
        activityState.matched.add(pairId);
        activityState.left = null;
        if (activityState.matched.size >= (activity.data.pairs || []).length) {
          await markCurrent();
        } else {
          await renderActivity();
          setFeedback('Ghép đúng.', 'success');
        }
      } else { setFeedback('Chưa khớp, chọn lại.', 'error'); }
      return;
    }
    if (target.dataset.answerIndex !== undefined) {
      const answer = questionOf(activity);
      const value = answer.options?.[Number(target.dataset.answerIndex)];
      await checkAnswer(value);
      return;
    }
    if (target.dataset.tileIndex !== undefined) {
      const index = Number(target.dataset.tileIndex);
      if (!activityState.tiles.includes(index)) activityState.tiles.push(index);
      await renderActivity();
      return;
    }
    if (target.dataset.orderReset) { activityState.tiles = []; await renderActivity(); return; }
    if (target.dataset.verify) {
      const question = questionOf(activity);
      const value = activity.type === 'sentence_order'
        ? (activityState.tiles || []).map((index) => question.words?.[index] || '').join('')
        : $('course-free-answer')?.value || '';
      await checkAnswer(value);
    }
  }

  function nextActivity(offset) {
    if (!session) return;
    const { course, module, lesson, index } = session;
    if (offset > 0 && index + offset >= lesson.activities.length) {
      const done = lesson.activities.filter((item) => (session.progress.data.completedActivities || []).includes(item.id)).length;
      showToast(done === lesson.activities.length ? 'Bạn đã hoàn thành bài học.' : `Đã hoàn thành ${done}/${lesson.activities.length} hoạt động. Có thể quay lại để học tiếp.`);
      location.hash = urlModule(course.id, module.id);
      return;
    }
    const dest = Math.max(0, Math.min(lesson.activities.length - 1, index + offset));
    location.hash = urlLesson(course.id, module.id, lesson.id, dest);
  }

  async function renderBackupControls() {
    const host = $('course-catalog-items');
    if (!host || $('course-backup-panel')) return;
    const div = document.createElement('section');
    div.className = 'course-backup-actions';
    div.id = 'course-backup-panel';
    div.innerHTML = `<button type="button" class="course-button course-button-light" id="course-export-progress">Xuất bản sao tiến độ</button>
      <label>Nhập bản sao <input type="file" id="course-import-progress" accept=".json,application/json"></label>
      <button type="button" id="course-import-guest" class="course-button course-button-light" hidden>Chuyển tiến độ khách vào tài khoản</button>
      <p id="course-storage-note" class="course-muted" style="width:100%;margin:0"></p>`;
    host.after(div);
    const account = CourseProgress.status().scope === 'account';
    $('course-import-guest').hidden = !account;
    const stable = CourseProgress.status().persistence && CourseContent.status().storageAvailable;
    $('course-storage-note').textContent = stable
      ? 'Tiến độ trên thiết bị lưu trong IndexedDB. Có thể xuất JSON dự phòng.'
      : 'Bộ nhớ trình duyệt bị hạn chế. Bạn nên xuất bản sao tiến độ trước khi đóng ứng dụng.';
  }

  async function handleDownload() {
    const data = await CourseProgress.exportBackup();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'kdsp-progress-' + new Date().toISOString().slice(0, 10) + '.json';
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2500);
  }

  async function handleImport(input) {
    const file = input.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) { showToast('File sao lưu quá lớn.'); return; }
    if (!confirm('Hợp nhất tiến độ từ bản sao vào hồ sơ đang mở? Không thể hoàn tác tự động.')) return;
    try {
      const parsed = JSON.parse(await file.text());
      const result = await CourseProgress.importBackup(parsed);
      showToast('Đã hợp nhất ' + result.imported + ' bản ghi tiến độ.');
      if (session) await renderLesson(session.course, session.module, session.lesson, session.index);
    } catch (error) { showToast(error.message || 'Không thể nhập bản sao.'); }
    input.value = '';
  }

  async function begin() {
    if (!window.CourseContent || !window.CourseProgress) throw new Error('Thiếu mô-đun học liệu hoặc tiến độ.');
    CourseContent.onChange(setNetworkStatus);
    CourseProgress.onChange(setNetworkStatus);
    $('course-refresh').addEventListener('click', async () => {
      try { await CourseContent.refresh(); await navigate(); showToast('Đã kiểm tra phiên bản học liệu.'); }
      catch (error) { renderError(error); }
    });
    $('course-retry').addEventListener('click', navigate);
    $('course-prev-activity').addEventListener('click', () => nextActivity(-1));
    $('course-next-activity').addEventListener('click', () => nextActivity(1));
    $('course-skip-activity').addEventListener('click', () => nextActivity(1));
    $('course-activity-steps').addEventListener('click', (event) => {
      const btn = event.target.closest('[data-activity-index]');
      if (!btn || !session) return;
      location.hash = urlLesson(session.course.id, session.module.id, session.lesson.id, Number(btn.dataset.activityIndex));
    });
    $('course-activity-content').addEventListener('click', handleActivityClick);
    document.addEventListener('click', async (event) => {
      if (event.target.id !== 'course-download-offline') return;
      const button = event.target;
      button.disabled = true;
      button.textContent = 'Đang lưu bài học…';
      try {
        const result = await CourseContent.downloadCourse(button.dataset.courseId, ({ completed, total }) => {
          button.textContent = `Đã tải ${completed}/${total} bài`;
        });
        showToast(`Đã lưu ${result.lessons} bài học để sử dụng offline.`);
      } catch (error) {
        showToast(error.message || 'Không thể tải khóa học offline.');
      } finally {
        button.disabled = false;
        button.textContent = 'Lưu khóa học để học offline';
      }
    });
    $('course-activity-content').addEventListener('keydown', (event) => {
      if (event.key === 'Enter' && event.target.id === 'course-free-answer') {
        event.preventDefault();
        const btn = $('course-activity-content').querySelector('[data-verify]');
        if (btn) btn.click();
      }
    });
    document.addEventListener('click', (event) => {
      if (event.target.id === 'course-export-progress') handleDownload().catch((error) => showToast(error.message));
      if (event.target.id === 'course-import-guest') {
        if (!confirm('Hợp nhất tiến độ khách đã học trên thiết bị vào tài khoản đang đăng nhập?')) return;
        CourseProgress.importGuestProgress().then((result) => showToast('Đã hợp nhất ' + result.imported + ' bài học.')).catch((error) => showToast(error.message));
      }
    });
    document.addEventListener('change', (event) => {
      if (event.target.id === 'course-import-progress') handleImport(event.target);
    });
    window.addEventListener('hashchange', navigate);
    await CourseProgress.initialize();
    // Courses and cached lessons must open without waiting for the auth SDK or network.
    await navigate();
    if (window.AppDB && AppDB.isConfigured()) {
      AppDB.loadSdk().then(async (ready) => {
        if (!ready) return;
        AppDB.init();
        await CourseProgress.setUser(await AppDB.getUser());
        AppDB.onAuthStateChange(async (event, authSession) => {
          await CourseProgress.setUser(authSession?.user || null);
          if ($('course-import-guest')) $('course-import-guest').hidden = CourseProgress.status().scope !== 'account';
          if (session) renderLesson(session.course, session.module, session.lesson, session.index).catch(() => {});
        });
        if ($('course-import-guest')) $('course-import-guest').hidden = CourseProgress.status().scope !== 'account';
      }).catch(() => { /* Guest study remains available without auth. */ });
    }
  }

  document.addEventListener('DOMContentLoaded', () => begin().catch(renderError));
})();
