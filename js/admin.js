(function () {
  'use strict';
  const $ = (id) => document.getElementById(id);
  let pendingData = null;
  let adminUser = null;
  let adminGatePassword = '';
  let adminUsersCache = [];

  function escapeHtml(value) {
    return String(value == null ? '' : value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function hashId(value) {
    let hash = 0;
    const text = String(value || '');
    for (let i = 0; i < text.length; i += 1) hash = ((hash << 5) - hash + text.charCodeAt(i)) | 0;
    return Math.abs(hash).toString(36);
  }

  function slug(value) {
    return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60);
  }

  function makeBatchCode() {
    const d = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    return `batch-${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
  }

  function setMessage(text, kind) {
    const el = $('admin-import-message');
    el.textContent = text;
    el.className = `admin-message${kind ? ` ${kind}` : ''}`;
    el.hidden = false;
  }

  function parseLegacyJs(text) {
    const result = { vocabulary: [], grammar: [], exercises: [] };
    const names = { VOCAB_DATA: 'vocabulary', GRAMMAR_DATA: 'grammar', EXERCISE_DATA: 'exercises' };
    let found = false;
    Object.entries(names).forEach(([variable, key]) => {
      const regex = new RegExp(`(?:var|let|const)\\s+${variable}\\s*=\\s*([\\s\\S]*?)(?:;\\s*(?=(?:var|let|const)\\s+[A-Z_]+\\s*=|$)|$)`);
      const match = text.match(regex);
      if (!match) return;
      const jsonText = match[1].trim().replace(/;\s*$/, '');
      try {
        const parsed = JSON.parse(jsonText);
        if (!Array.isArray(parsed)) throw new Error(`${variable} phải là mảng.`);
        result[key] = parsed;
        found = true;
      } catch (error) {
        throw new Error(`Không đọc được ${variable}: ${error.message}`);
      }
    });
    if (!found) throw new Error('Không nhận diện được JSON hoặc các biến VOCAB_DATA / GRAMMAR_DATA / EXERCISE_DATA.');
    return result;
  }

  function parseSource(text) {
    const trimmed = text.trim();
    if (!trimmed) throw new Error('Vui lòng chọn tệp hoặc dán dữ liệu JSON.');
    let parsed;
    try { parsed = JSON.parse(trimmed); }
    catch (_) { return parseLegacyJs(trimmed); }
    if (Array.isArray(parsed)) return classifyArray(parsed);
    if (!parsed || typeof parsed !== 'object') throw new Error('Dữ liệu phải là mảng hoặc object JSON.');
    const vocabulary = parsed.vocabulary || parsed.vocab || parsed.VOCAB_DATA || [];
    const grammar = parsed.grammar || parsed.GRAMMAR_DATA || [];
    const exercises = parsed.exercises || parsed.exercise || parsed.EXERCISE_DATA || [];
    if (![vocabulary, grammar, exercises].every(Array.isArray)) throw new Error('Các khóa vocabulary, grammar và exercises phải là mảng.');
    if (!vocabulary.length && !grammar.length && !exercises.length) {
      if (parsed.jp && parsed.vi) return classifyArray([parsed]);
      throw new Error('Object JSON không có dữ liệu trong vocabulary, grammar hoặc exercises.');
    }
    return { vocabulary, grammar, exercises };
  }

  function classifyArray(items) {
    const result = { vocabulary: [], grammar: [], exercises: [] };
    items.forEach((item) => {
      if (!item || typeof item !== 'object' || Array.isArray(item)) return;
      if (item.pattern) result.grammar.push(item);
      else if (item.type === 'exercise' || item.kind || item.prompt_jp) result.exercises.push(item);
      else if (item.jp && item.vi) result.vocabulary.push(item);
    });
    return result;
  }

  function validateData(source) {
    const result = { vocabulary: [], grammar: [], exercises: [] };
    const errors = [];
    let duplicates = 0;
    const levels = ['N5', 'N4', 'N3'];

    const vocabSeen = new Set();
    source.vocabulary.forEach((raw, index) => {
      if (!raw || typeof raw !== 'object' || !raw.jp || !raw.vi) {
        errors.push(`Từ vựng dòng ${index + 1}: thiếu jp hoặc vi.`);
        return;
      }
      const level = String(raw.level || 'N5').toUpperCase();
      if (!levels.includes(level)) { errors.push(`Từ vựng ${raw.jp}: cấp độ ${level} không hợp lệ.`); return; }
      const jp = String(raw.jp).trim();
      const kanji = String(raw.kanji || '').trim();
      const key = `${jp.toLocaleLowerCase()}|${kanji.toLocaleLowerCase()}`;
      if (vocabSeen.has(key)) { duplicates += 1; return; }
      vocabSeen.add(key);
      const id = String(raw.id || `vc_${hashId(`${level}|${jp}|${kanji}`)}`);
      result.vocabulary.push({ ...raw, id, level, topic: String(raw.topic || 'Tổng hợp'), jp, kanji, vi: String(raw.vi).trim(), romaji: String(raw.romaji || ''), mnemonic: String(raw.mnemonic || '') });
    });

    const grammarSeen = new Set();
    source.grammar.forEach((raw, index) => {
      if (!raw || typeof raw !== 'object' || !raw.pattern) { errors.push(`Ngữ pháp dòng ${index + 1}: thiếu pattern.`); return; }
      const level = String(raw.level || 'N5').toUpperCase();
      if (!levels.includes(level)) { errors.push(`Ngữ pháp ${raw.pattern}: cấp độ ${level} không hợp lệ.`); return; }
      const pattern = String(raw.pattern).trim();
      const key = `${level}|${pattern.toLocaleLowerCase()}`;
      if (grammarSeen.has(key)) { duplicates += 1; return; }
      grammarSeen.add(key);
      result.grammar.push({ ...raw, id: String(raw.id || `gr_${hashId(`${level}|${pattern}`)}`), level, topic: String(raw.topic || 'Tổng hợp'), pattern, examples: Array.isArray(raw.examples) ? raw.examples : [], commonMistakes: Array.isArray(raw.commonMistakes) ? raw.commonMistakes : [] });
    });

    const exerciseSeen = new Set();
    source.exercises.forEach((raw, index) => {
      const jp = String(raw && (raw.prompt_jp || raw.jp) || '').trim();
      if (!raw || typeof raw !== 'object' || !jp) { errors.push(`Bài tập dòng ${index + 1}: thiếu prompt_jp hoặc jp.`); return; }
      const level = String(raw.level || 'N5').toUpperCase();
      if (!levels.includes(level)) { errors.push(`Bài tập ${jp}: cấp độ ${level} không hợp lệ.`); return; }
      const kind = String(raw.kind || 'choice');
      const answer = String(raw.answer || raw.vi || '');
      const key = `${level}|${kind}|${jp.toLocaleLowerCase()}|${answer.toLocaleLowerCase()}`;
      if (exerciseSeen.has(key)) { duplicates += 1; return; }
      exerciseSeen.add(key);
      result.exercises.push({ ...raw, id: String(raw.id || `ex_${hashId(`${level}|${kind}|${jp}|${answer}`)}`), type: 'exercise', level, topic: String(raw.topic || 'Bài tập tổng hợp'), kind, prompt_jp: jp, answer, options: Array.isArray(raw.options) ? raw.options : [], refs: Array.isArray(raw.refs) ? raw.refs : [] });
    });

    if (!result.vocabulary.length && !result.grammar.length && !result.exercises.length) errors.push('Không tìm thấy mục dữ liệu hợp lệ.');
    return { data: result, errors, duplicates };
  }

  function previewData() {
    const raw = $('admin-json').value;
    try {
      const parsed = parseSource(raw);
      const checked = validateData(parsed);
      pendingData = checked.errors.length ? null : checked.data;
      const preview = $('admin-preview');
      preview.hidden = false;
      preview.innerHTML = `<strong>${checked.errors.length ? 'Có lỗi cần sửa' : 'Dữ liệu hợp lệ để nạp'}</strong><ul><li>${checked.data.vocabulary.length} từ vựng</li><li>${checked.data.grammar.length} mục ngữ pháp</li><li>${checked.data.exercises.length} bài tập</li><li>${checked.duplicates} mục trùng trong chính đợt này sẽ được bỏ qua</li>${checked.errors.slice(0, 8).map((error) => `<li style="color:#a74b60">${escapeHtml(error)}</li>`).join('')}</ul>`;
      $('admin-import-button').disabled = !pendingData;
      if (checked.errors.length) setMessage(`Phát hiện ${checked.errors.length} lỗi. Chưa thể nạp dữ liệu.`, 'error');
      else setMessage('Kiểm tra thành công. Nhấn “Nạp và xuất bản” để gửi dữ liệu lên Supabase.', 'success');
    } catch (error) {
      pendingData = null;
      $('admin-import-button').disabled = true;
      $('admin-preview').hidden = false;
      $('admin-preview').innerHTML = `<strong>Không đọc được dữ liệu</strong><ul><li style="color:#a74b60">${escapeHtml(error.message)}</li></ul>`;
      setMessage(error.message, 'error');
    }
  }

  async function importData(event) {
    event.preventDefault();
    if (!pendingData) { previewData(); if (!pendingData) return; }
    const label = $('batch-label').value.trim();
    let batchCode = slug($('batch-code').value.trim());
    if (!label || !batchCode) { setMessage('Tên đợt và mã đợt không được để trống.', 'error'); return; }
    const button = $('admin-import-button');
    button.disabled = true;
    button.textContent = 'Đang nạp…';
    try {
      const result = await AppDB.importBatch({
        batchCode, label,
        vocabulary: pendingData.vocabulary,
        grammar: pendingData.grammar,
        exercises: pendingData.exercises,
        updateExisting: $('admin-update-existing').checked
      });
      setMessage(`Đã xuất bản đợt ${result.batch_code}. Thêm: ${result.added_vocab || 0} từ, ${result.added_grammar || 0} ngữ pháp, ${result.added_exercises || 0} bài tập. Cập nhật: ${(result.updated_vocab || 0) + (result.updated_grammar || 0) + (result.updated_exercises || 0)}. Bỏ qua: ${result.skipped || 0}.`, 'success');
      $('admin-json').value = '';
      $('admin-preview').hidden = true;
      pendingData = null;
      $('admin-import-button').disabled = true;
      $('batch-code').value = makeBatchCode();
      await Promise.all([loadHistory(), loadVersions()]);
    } catch (error) {
      setMessage(`Nạp thất bại. Giao dịch đã bị hủy, dữ liệu cũ không bị xóa. ${error.message || ''}`, 'error');
    } finally {
      button.textContent = 'Nạp và xuất bản';
      button.disabled = !pendingData;
    }
  }

  async function loadHistory() {
    const host = $('admin-history');
    host.innerHTML = '<div class="empty-message">Đang tải…</div>';
    try {
      const rows = await AppDB.getBatchHistory();
      host.innerHTML = rows.length ? rows.map((row) => {
        const date = row.created_at ? new Intl.DateTimeFormat('vi-VN', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(row.created_at)) : '';
        return `<article class="history-item"><strong>${escapeHtml(row.label)}</strong><small>${escapeHtml(row.batch_code)} · ${escapeHtml(date)}<br>${Number(row.vocabulary_count || 0)} từ · ${Number(row.grammar_count || 0)} ngữ pháp · ${Number(row.exercise_count || 0)} bài tập · ${escapeHtml(row.status || 'published')}</small></article>`;
      }).join('') : '<div class="empty-message">Chưa có đợt dữ liệu nào.</div>';
    } catch (error) {
      host.innerHTML = `<div class="empty-message">Không tải được lịch sử: ${escapeHtml(error.message)}</div>`;
    }
  }

  async function loadVersions() {
    const host = $('admin-versions');
    host.innerHTML = '<div class="empty-message">Đang tải bản lưu…</div>';
    try {
      const rows = await AppDB.getContentVersions();
      host.innerHTML = rows.length ? rows.slice(0, 30).map((row) => {
        const date = row.archived_at ? new Intl.DateTimeFormat('vi-VN', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(row.archived_at)) : '';
        const typeLabel = row.item_type === 'vocab' ? 'Từ vựng' : row.item_type === 'grammar' ? 'Ngữ pháp' : 'Bài tập';
        const title = row.payload && (row.payload.jp || row.payload.pattern || row.payload.prompt_jp) || row.item_id;
        return `<article class="history-item"><strong>${escapeHtml(typeLabel)} · ${escapeHtml(title)}</strong><small>ID: ${escapeHtml(row.item_id)} · ${escapeHtml(date)}</small><button class="button button-outline version-restore-button" data-restore-version="${escapeHtml(row.id)}" type="button">Khôi phục bản này</button></article>`;
      }).join('') : '<div class="empty-message">Chưa có bản lưu. Bản lưu được tạo khi cập nhật mục đã tồn tại.</div>';
    } catch (error) {
      host.innerHTML = `<div class="empty-message">Không tải được bản lưu: ${escapeHtml(error.message)}</div>`;
    }
  }

  function setUserMessage(text, kind) {
    const element = $('admin-user-message');
    element.textContent = text;
    element.className = `admin-message${kind ? ` ${kind}` : ''}`;
    element.hidden = false;
  }

  function showGate(user) {
    adminUser = user;
    adminGatePassword = '';
    $('admin-login-panel').hidden = true;
    $('admin-denied-panel').hidden = true;
    $('admin-workspace').hidden = true;
    $('admin-gate-panel').hidden = false;
    $('admin-logout').hidden = false;
    $('admin-gate-password').value = '';
    $('admin-gate-error').textContent = '';
  }

  function showWorkspace(user) {
    adminUser = user;
    $('admin-login-panel').hidden = true;
    $('admin-denied-panel').hidden = true;
    $('admin-gate-panel').hidden = true;
    $('admin-workspace').hidden = false;
    $('admin-logout').hidden = false;
    $('batch-code').value = makeBatchCode();
    loadHistory();
    loadVersions();
    loadUsers();
  }

  async function checkAdmin(user) {
    try {
      const allowed = await AppDB.isAdmin();
      if (allowed) {
        showGate(user);
      } else {
        adminGatePassword = '';
        $('admin-login-panel').hidden = true;
        $('admin-gate-panel').hidden = true;
        $('admin-workspace').hidden = true;
        $('admin-denied-panel').hidden = false;
        $('admin-current-user').textContent = `UUID: ${user.id} · Tài khoản: ${user.user_metadata?.username || user.email || 'không có'}`;
        $('admin-logout').hidden = false;
      }
    } catch (error) {
      $('admin-login-panel').hidden = false;
      $('admin-login-error').textContent = `Không kiểm tra được quyền quản trị. Hãy chạy supabase/schema.sql. ${error.message || ''}`;
    }
  }

  async function verifyAdminGate(event) {
    event.preventDefault();
    const password = $('admin-gate-password').value;
    const button = $('admin-gate-form').querySelector('button[type="submit"]');
    $('admin-gate-error').textContent = '';
    button.disabled = true;
    button.textContent = 'Đang xác thực…';
    try {
      await AppDB.adminUsers('verify_gate', {}, password);
      adminGatePassword = password;
      showWorkspace(adminUser || await AppDB.getUser());
    } catch (error) {
      $('admin-gate-error').textContent = `${error.message || 'Không xác thực được.'} Nếu Edge Function chưa được triển khai, hãy làm theo mục Quản trị tài khoản trong README.`;
    } finally {
      button.disabled = false;
      button.textContent = 'Mở trang quản trị';
    }
  }

  function formatUserDate(value) {
    if (!value) return 'Chưa đăng nhập';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '—';
    return new Intl.DateTimeFormat('vi-VN', { dateStyle: 'medium', timeStyle: 'short' }).format(date);
  }

  function renderUsers(users) {
    adminUsersCache = Array.isArray(users) ? users : [];
    const learners = adminUsersCache.filter((user) => !user.is_admin).length;
    $('admin-user-count').textContent = `${learners} học viên · Không giới hạn`;
    const host = $('admin-user-list');
    if (!adminUsersCache.length) {
      host.innerHTML = '<div class="empty-message">Chưa có tài khoản nào. Người học có thể tự đăng ký từ ứng dụng.</div>';
      return;
    }
    host.innerHTML = adminUsersCache.map((user) => {
      const locked = Boolean(user.banned_until && new Date(user.banned_until).getTime() > Date.now());
      const role = user.is_admin ? 'Quản trị viên' : 'Học viên';
      const status = user.is_admin ? 'Tài khoản được bảo vệ' : locked ? 'Đang khóa' : 'Đang hoạt động';
      const avatar = Array.from(String(user.username || 'U'))[0].toUpperCase();
      const controls = user.is_admin ? '<p class="admin-user-protected">Không hiển thị thao tác đối với tài khoản quản trị.</p>' : `
        <div class="admin-user-reset-row">
          <input class="admin-user-password" data-user-password="${escapeHtml(user.id)}" type="password" minlength="8" maxlength="72" autocomplete="new-password" placeholder="Mật khẩu mới (ít nhất 8 ký tự)">
          <button class="button button-outline" data-user-action="reset_password" data-user-id="${escapeHtml(user.id)}" type="button">Đặt lại mật khẩu</button>
        </div>
        <div class="admin-user-buttons">
          <button class="button button-outline" data-user-action="set_status" data-user-id="${escapeHtml(user.id)}" data-disabled="${locked ? 'true' : 'false'}" type="button">${locked ? 'Mở khóa' : 'Khóa tài khoản'}</button>
          <button class="button button-danger" data-user-action="delete" data-user-id="${escapeHtml(user.id)}" type="button">Xóa tài khoản</button>
        </div>`;
      return `<article class="admin-user-card">
        <div class="admin-user-main"><span class="admin-user-avatar">${escapeHtml(avatar)}</span><div class="admin-user-copy"><strong>${escapeHtml(user.username || 'Tài khoản')}</strong><small>${escapeHtml(role)} · Tạo ${escapeHtml(formatUserDate(user.created_at))}</small><small>Đăng nhập gần nhất: ${escapeHtml(formatUserDate(user.last_sign_in_at))}</small><span class="admin-user-status ${locked ? 'is-locked' : ''}">${escapeHtml(status)}</span></div></div>
        <div class="admin-user-actions">${controls}</div>
      </article>`;
    }).join('');
  }

  async function loadUsers() {
    const host = $('admin-user-list');
    host.innerHTML = '<div class="empty-message">Đang tải danh sách tài khoản…</div>';
    try {
      const result = await AppDB.adminUsers('list', {}, adminGatePassword);
      renderUsers(result.users || []);
    } catch (error) {
      host.innerHTML = `<div class="empty-message">Không tải được tài khoản: ${escapeHtml(error.message)}. Kiểm tra Edge Function j_admin_users.</div>`;
    }
  }

  async function createLearner(event) {
    event.preventDefault();
    const username = $('admin-new-username').value.trim().toLowerCase();
    const password = $('admin-new-password').value;
    const button = $('admin-create-user-button');
    button.disabled = true;
    button.textContent = 'Đang tạo…';
    try {
      const result = await AppDB.adminUsers('create', { username, password }, adminGatePassword);
      $('admin-create-user-form').reset();
      setUserMessage(`Đã tạo tài khoản ${result.user?.username || username}. Có thể đăng nhập ngay bằng tên đăng nhập và mật khẩu vừa đặt.`, 'success');
      await loadUsers();
    } catch (error) {
      setUserMessage(`Không tạo được tài khoản: ${error.message}`, 'error');
    } finally {
      button.disabled = false;
      button.textContent = '+ Tạo tài khoản học viên';
    }
  }

  async function handleUserAction(event) {
    const button = event.target.closest('[data-user-action]');
    if (!button) return;
    const userId = button.dataset.userId;
    const action = button.dataset.userAction;
    button.disabled = true;
    try {
      if (action === 'reset_password') {
        const input = $('admin-user-list').querySelector(`[data-user-password="${userId}"]`);
        const password = input ? input.value : '';
        if (password.length < 8) throw new Error('Mật khẩu mới cần ít nhất 8 ký tự.');
        await AppDB.adminUsers('reset_password', { userId, password }, adminGatePassword);
        input.value = '';
        setUserMessage('Đã đặt lại mật khẩu. Hãy gửi mật khẩu mới cho đúng người học.', 'success');
      } else if (action === 'set_status') {
        const currentlyLocked = button.dataset.disabled === 'true';
        await AppDB.adminUsers('set_status', { userId, disabled: !currentlyLocked }, adminGatePassword);
        setUserMessage(currentlyLocked ? 'Đã mở khóa tài khoản.' : 'Đã khóa tài khoản. Người dùng sẽ không thể đăng nhập.', 'success');
      } else if (action === 'delete') {
        const target = adminUsersCache.find((user) => user.id === userId);
        const username = target ? target.username : 'tài khoản này';
        if (!window.confirm(`Xóa ${username}? Thao tác này xóa tài khoản Supabase và dữ liệu tiến độ gắn với tài khoản đó, không thể hoàn tác.`)) return;
        await AppDB.adminUsers('delete', { userId }, adminGatePassword);
        setUserMessage(`Đã xóa ${username}. Dữ liệu tiến độ của tài khoản này cũng đã bị xóa.`, 'success');
      }
      await loadUsers();
    } catch (error) {
      setUserMessage(`Không thực hiện được thao tác: ${error.message}`, 'error');
    } finally {
      button.disabled = false;
    }
  }

  async function initialize() {
    if (!AppDB.isConfigured()) {
      $('admin-setup-warning').hidden = false;
      return;
    }
    $('admin-setup-warning').hidden = false;
    $('admin-setup-warning').querySelector('h2').textContent = 'Đang kết nối Supabase';
    $('admin-setup-warning').querySelector('p').textContent = 'Đang tải thư viện xác thực và kết nối dữ liệu…';
    const sdkReady = await AppDB.loadSdk();
    if (!sdkReady) {
      $('admin-setup-warning').querySelector('h2').textContent = 'Không tải được thư viện Supabase';
      $('admin-setup-warning').querySelector('p').textContent = 'Đã có cấu hình Supabase nhưng không tải được thư viện kết nối. Kiểm tra mạng rồi tải lại trang.';
      return;
    }
    $('admin-setup-warning').hidden = true;
    AppDB.init();
    const user = await AppDB.getUser();
    if (user) await checkAdmin(user);
    else $('admin-login-panel').hidden = false;
    AppDB.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' && session && session.user) checkAdmin(session.user);
      if (event === 'SIGNED_OUT') {
        adminGatePassword = '';
        $('admin-workspace').hidden = true;
        $('admin-gate-panel').hidden = true;
        $('admin-denied-panel').hidden = true;
        $('admin-login-panel').hidden = false;
        $('admin-logout').hidden = true;
      }
    });
  }

  document.addEventListener('DOMContentLoaded', () => {
    $('admin-login-form').addEventListener('submit', async (event) => {
      event.preventDefault();
      $('admin-login-error').textContent = '';
      try {
        await AppDB.signIn($('admin-email').value.trim(), $('admin-password').value);
        const user = await AppDB.getUser();
        if (user) await checkAdmin(user);
      } catch (error) {
        $('admin-login-error').textContent = error.message || 'Không thể đăng nhập.';
      }
    });
    $('admin-gate-form').addEventListener('submit', verifyAdminGate);
    $('admin-create-user-form').addEventListener('submit', createLearner);
    $('admin-user-list').addEventListener('click', handleUserAction);
    $('admin-refresh-users').addEventListener('click', loadUsers);
    $('admin-logout').addEventListener('click', async () => {
      adminGatePassword = '';
      try { await AppDB.signOut(); } catch (error) { $('admin-login-error').textContent = error.message; }
    });
    $('admin-file').addEventListener('change', async (event) => {
      const file = event.target.files && event.target.files[0];
      if (!file) return;
      try {
        const text = typeof file.text === 'function' ? await file.text() : await new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(String(reader.result || ''));
          reader.onerror = () => reject(reader.error || new Error('Không đọc được tệp.'));
          reader.readAsText(file, 'UTF-8');
        });
        $('admin-json').value = text;
        pendingData = null;
        $('admin-import-button').disabled = true;
        previewData();
      } catch (error) { setMessage(`Không đọc được tệp: ${error.message}`, 'error'); }
    });
    $('admin-json').addEventListener('input', () => { pendingData = null; $('admin-import-button').disabled = true; });
    $('admin-preview-button').addEventListener('click', previewData);
    $('admin-import-form').addEventListener('submit', importData);
    $('admin-refresh-history').addEventListener('click', loadHistory);
    $('admin-refresh-versions').addEventListener('click', loadVersions);
    $('admin-versions').addEventListener('click', async (event) => {
      const button = event.target.closest('[data-restore-version]');
      if (!button) return;
      if (!window.confirm('Khôi phục bản lưu này? Nội dung hiện tại sẽ được lưu thành một phiên bản mới trước khi khôi phục.')) return;
      button.disabled = true;
      try {
        const result = await AppDB.restoreContentVersion(button.dataset.restoreVersion);
        setMessage(`Đã khôi phục ${result.item_type} ${result.item_id}. Mã đợt: ${result.batch_code}.`, 'success');
        await Promise.all([loadHistory(), loadVersions()]);
      } catch (error) {
        setMessage(`Không thể khôi phục: ${error.message || 'Lỗi máy chủ'}`, 'error');
        button.disabled = false;
      }
    });
    initialize();
  });
})();
