(function () {
  'use strict';

  let client = null;
  let sdkPromise = null;
  const VIRTUAL_EMAIL_DOMAIN = 'accounts.japanese-learning.invalid';

  function normalizeUsername(value) {
    const username = String(value || '').trim().toLowerCase();
    if (!/^[a-z0-9_.-]{3,24}$/.test(username)) {
      throw new Error('Tên đăng nhập phải có 3–24 ký tự, chỉ gồm chữ không dấu, số, dấu chấm, gạch dưới hoặc gạch ngang.');
    }
    return username;
  }

  function toAuthEmail(identifier) {
    const value = String(identifier || '').trim();
    if (value.includes('@')) return value.toLowerCase();
    return `${normalizeUsername(value)}@${VIRTUAL_EMAIL_DOMAIN}`;
  }

  function getConfig() {
    return window.APP_CONFIG || {};
  }

  function isConfigured() {
    const cfg = getConfig();
    return Boolean(
      cfg.SUPABASE_URL &&
      cfg.SUPABASE_ANON_KEY &&
      !cfg.SUPABASE_URL.includes('YOUR_PROJECT') &&
      !cfg.SUPABASE_ANON_KEY.includes('YOUR_SUPABASE')
    );
  }

  function init() {
    if (client) return client;
    if (!isConfigured() || !window.supabase || typeof window.supabase.createClient !== 'function') return null;
    try {
      const cfg = getConfig();
      client = window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY, {
        auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
      });
    } catch (error) {
      console.error('Không thể khởi tạo Supabase:', error);
      client = null;
    }
    return client;
  }

  function loadSdk() {
    if (!isConfigured()) return Promise.resolve(false);
    if (window.supabase && typeof window.supabase.createClient === 'function') return Promise.resolve(true);
    if (sdkPromise) return sdkPromise;
    sdkPromise = new Promise((resolve) => {
      const script = document.createElement('script');
      let settled = false;
      const finish = (ready) => {
        if (settled) return;
        settled = true;
        resolve(Boolean(ready && window.supabase && typeof window.supabase.createClient === 'function'));
      };
      script.src = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2';
      script.async = true;
      script.onload = () => finish(true);
      script.onerror = () => finish(false);
      document.head.appendChild(script);
      window.setTimeout(() => finish(false), 7000);
    }).then((ready) => {
      if (!ready) sdkPromise = null;
      return ready;
    });
    return sdkPromise;
  }

  function getClient() {
    return client || init();
  }

  async function getUser() {
    const sb = getClient();
    if (!sb) return null;
    const { data, error } = await sb.auth.getUser();
    if (error) return null;
    return data.user || null;
  }

  async function signIn(identifier, password) {
    const sb = getClient();
    if (!sb) throw new Error('Chưa cấu hình kết nối Supabase.');
    const email = toAuthEmail(identifier);
    const { data, error } = await sb.auth.signInWithPassword({ email, password });
    if (error) throw error;
    return data.user;
  }

  async function signUp(usernameInput, password) {
    const sb = getClient();
    if (!sb) throw new Error('Chưa cấu hình kết nối Supabase.');
    const username = normalizeUsername(usernameInput);
    const passwordText = String(password || '');
    const passwordBytes = new TextEncoder().encode(passwordText).length;
    if (passwordBytes < 8 || passwordBytes > 72) {
      throw new Error('Mật khẩu cần dài ít nhất 8 ký tự và không vượt quá 72 byte.');
    }

    // Đăng ký qua Edge Function dùng service_role ở máy chủ để xác nhận
    // email nội bộ ngay khi tạo. Người học không cần email thật và không
    // cần tắt Confirm email trong Supabase Auth.
    const { data: registration, error: registrationError } = await sb.functions.invoke('j_register', {
      body: { username, password: passwordText }
    });
    if (registrationError) {
      let message = registrationError.message || 'Không thể tạo tài khoản.';
      try {
        if (registrationError.context && typeof registrationError.context.json === 'function') {
          const body = await registrationError.context.json();
          if (body && body.error) message = body.error;
        }
      } catch (_) { /* Giữ thông báo gốc từ Supabase Functions. */ }
      throw new Error(message);
    }
    if (!registration || registration.ok !== true) {
      throw new Error((registration && registration.error) || 'Máy chủ chưa xác nhận tạo tài khoản.');
    }

    // Tạo tài khoản xong thì đăng nhập ngay bằng email định danh nội bộ.
    const { data: loginData, error: loginError } = await sb.auth.signInWithPassword({
      email: `${username}@${VIRTUAL_EMAIL_DOMAIN}`,
      password: passwordText
    });
    if (loginError) {
      throw new Error(`Tài khoản đã được tạo nhưng chưa thể đăng nhập tự động: ${loginError.message || 'Hãy thử đăng nhập lại.'}`);
    }
    return loginData.user || registration.user || null;
  }

  async function adminUsers(action, payload, gatePassword) {
    const sb = getClient();
    if (!sb) throw new Error('Chưa cấu hình kết nối Supabase.');
    const { data, error } = await sb.functions.invoke('j_admin_users', {
      body: { action, ...(payload || {}), gatePassword: String(gatePassword || '') }
    });
    if (error) {
      let message = error.message || 'Không thể thực hiện thao tác quản trị.';
      try {
        if (error.context && typeof error.context.json === 'function') {
          const body = await error.context.json();
          if (body && body.error) message = body.error;
        }
      } catch (_) { /* Giữ thông báo gốc của SDK. */ }
      throw new Error(message);
    }
    if (data && data.error) throw new Error(data.error);
    return data || {};
  }

  async function signOut() {
    const sb = getClient();
    if (!sb) return;
    const { error } = await sb.auth.signOut();
    if (error) throw error;
  }

  async function getPublishedContent() {
    const sb = getClient();
    if (!sb) throw new Error('Chưa cấu hình Supabase hoặc thư viện kết nối chưa tải.');
    const { data, error } = await sb.rpc('j_get_published_content');
    if (error) throw error;
    return data || { vocabulary: [], grammar: [], exercises: [] };
  }

  async function isAdmin() {
    const sb = getClient();
    if (!sb) return false;
    const { data, error } = await sb.rpc('j_is_admin');
    if (error) throw error;
    return data === true;
  }

  async function importBatch(payload) {
    const sb = getClient();
    if (!sb) throw new Error('Chưa cấu hình Supabase.');
    const { data, error } = await sb.rpc('j_import_batch', {
      p_batch_code: payload.batchCode,
      p_label: payload.label,
      p_vocab: payload.vocabulary,
      p_grammar: payload.grammar,
      p_exercises: payload.exercises,
      p_update_existing: Boolean(payload.updateExisting)
    });
    if (error) throw error;
    return data;
  }

  async function getBatchHistory() {
    const sb = getClient();
    if (!sb) throw new Error('Chưa cấu hình Supabase.');
    const { data, error } = await sb.rpc('j_get_batch_history');
    if (error) throw error;
    return Array.isArray(data) ? data : [];
  }

  async function getContentVersions() {
    const sb = getClient();
    if (!sb) throw new Error('Chưa cấu hình Supabase.');
    const { data, error } = await sb.rpc('j_get_content_versions', { p_item_type: null, p_item_id: null });
    if (error) throw error;
    return Array.isArray(data) ? data : [];
  }

  async function restoreContentVersion(versionId) {
    const sb = getClient();
    if (!sb) throw new Error('Chưa cấu hình Supabase.');
    const { data, error } = await sb.rpc('j_restore_content_version', { p_version_id: versionId });
    if (error) throw error;
    return data;
  }

  async function getUserProgress() {
    const sb = getClient();
    if (!sb) throw new Error('Chưa cấu hình Supabase.');
    const { data, error } = await sb.rpc('j_get_user_progress');
    if (error) throw error;
    return Array.isArray(data) ? data : [];
  }

  async function syncUserProgress(records) {
    const sb = getClient();
    if (!sb) throw new Error('Chưa cấu hình Supabase.');
    const { data, error } = await sb.rpc('j_sync_user_progress', { p_records: records });
    if (error) throw error;
    return data;
  }

  function onAuthStateChange(callback) {
    const sb = getClient();
    if (!sb) return null;
    const { data } = sb.auth.onAuthStateChange((event, session) => callback(event, session));
    return data && data.subscription;
  }

  window.AppDB = {
    init, loadSdk, isConfigured, getClient, getUser, signIn, signUp, signOut,
    getPublishedContent, isAdmin, importBatch, getBatchHistory, getContentVersions, restoreContentVersion,
    getUserProgress, syncUserProgress, onAuthStateChange, adminUsers, normalizeUsername
  };
})();
