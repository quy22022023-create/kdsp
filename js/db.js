(function () {
  'use strict';

  let client = null;
  let sdkPromise = null;

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

  async function signIn(email, password) {
    const sb = getClient();
    if (!sb) throw new Error('Chưa cấu hình kết nối Supabase.');
    const { data, error } = await sb.auth.signInWithPassword({ email, password });
    if (error) throw error;
    return data.user;
  }

  async function signUp(email, password) {
    const sb = getClient();
    if (!sb) throw new Error('Chưa cấu hình kết nối Supabase.');
    const { data, error } = await sb.auth.signUp({ email, password });
    if (error) throw error;
    return data.user;
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
    getUserProgress, syncUserProgress, onAuthStateChange
  };
})();
