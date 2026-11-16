/* KDSP tap-to-translate: dictionary-backed Japanese word lookup. */
(function () {
  'use strict';
  const MIN_LENGTH = 1;
  const MAX_TERMS = 12000;
  const dictionary = new Map();
  let termsByFirstChar = new Map();
  let sortedTerms = [];
  let observer = null;
  let popup = null;
  let active = null;

  const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
  const isJapanese = (char) => /[\u3040-\u30ff\u3400-\u9fff\uF900-\uFAFF]/u.test(char);
  const isWordChar = (char) => /[\u3040-\u30ff\u3400-\u9fff\uF900-\uFAFFー々〆ヶ]/u.test(char);

  function normalizeEntry(item) {
    if (!item || typeof item !== 'object' || !item.vi) return null;
    const forms = [item.jp, item.kanji].filter((value) => typeof value === 'string' && value.trim());
    if (!forms.length) return null;
    return { reading: item.reading || item.romaji || item.jp || forms[0], meaning: String(item.vi), level: item.level || '', topic: item.topic || '' };
  }

  function setDictionary(items) {
    dictionary.clear();
    (Array.isArray(items) ? items : []).slice(0, MAX_TERMS).forEach((item) => {
      const entry = normalizeEntry(item);
      if (!entry) return;
      [item.jp, item.kanji].filter(Boolean).forEach((form) => {
        const key = String(form).trim();
        if (key.length >= MIN_LENGTH && !dictionary.has(key)) dictionary.set(key, entry);
      });
    });
    sortedTerms = Array.from(dictionary.keys()).sort((a, b) => b.length - a.length);
    termsByFirstChar = new Map();
    sortedTerms.forEach((term) => { const first = term[0]; if (!termsByFirstChar.has(first)) termsByFirstChar.set(first, []); termsByFirstChar.get(first).push(term); });
    if (observer) scan(document.body);
  }

  function ensurePopup() {
    if (popup) return popup;
    popup = document.createElement('aside');
    popup.className = 'kdsp-translation-popover';
    popup.hidden = true;
    popup.setAttribute('role', 'status');
    popup.setAttribute('aria-live', 'polite');
    popup.innerHTML = '<button class="kdsp-translation-close" type="button" aria-label="Đóng">×</button><strong class="kdsp-translation-word"></strong><span class="kdsp-translation-reading"></span><span class="kdsp-translation-meaning"></span><small class="kdsp-translation-meta"></small>';
    document.body.appendChild(popup);
    popup.querySelector('.kdsp-translation-close').addEventListener('click', closePopup);
    document.addEventListener('keydown', (event) => { if (event.key === 'Escape') closePopup(); });
    document.addEventListener('click', (event) => {
      if (popup && !popup.hidden && !popup.contains(event.target) && !event.target.closest('.kdsp-tap-word')) closePopup();
    });
    return popup;
  }

  function closePopup() {
    if (popup) popup.hidden = true;
    if (active) active.setAttribute('aria-expanded', 'false');
    active = null;
  }

  function showEntry(element, entry, word) {
    const panel = ensurePopup();
    if (active) active.setAttribute('aria-expanded', 'false');
    active = element;
    active.setAttribute('aria-expanded', 'true');
    panel.querySelector('.kdsp-translation-word').textContent = word;
    panel.querySelector('.kdsp-translation-reading').textContent = 'Cách đọc: ' + entry.reading;
    panel.querySelector('.kdsp-translation-meaning').textContent = entry.meaning;
    panel.querySelector('.kdsp-translation-meta').textContent = [entry.level, entry.topic].filter(Boolean).join(' · ') || 'Từ điển học liệu KDSP';
    panel.hidden = false;
    const rect = element.getBoundingClientRect();
    const width = Math.min(320, window.innerWidth - 24);
    const left = Math.max(12, Math.min(rect.left, window.innerWidth - width - 12));
    panel.style.width = width + 'px';
    panel.style.left = left + 'px';
    panel.style.top = Math.max(12, Math.min(rect.bottom + 8, window.innerHeight - 180)) + 'px';
  }

  function wrapTextNode(node) {
    const text = node.nodeValue;
    if (!text || !text.split('').some(isJapanese)) return;
    const fragment = document.createDocumentFragment();
    let cursor = 0;
    let changed = false;
    while (cursor < text.length) {
      let match = null;
      if (isWordChar(text[cursor])) {
        for (const term of (termsByFirstChar.get(text[cursor]) || [])) {
          if (text.startsWith(term, cursor) && (!match || term.length > match.length)) match = term;
        }
      }
      if (match) {
        const span = document.createElement('span');
        span.className = 'kdsp-tap-word';
        span.tabIndex = 0;
        span.setAttribute('role', 'button');
        span.setAttribute('aria-label', 'Dịch ' + match);
        span.setAttribute('aria-expanded', 'false');
        span.textContent = match;
        span.dataset.kdspWord = match;
        fragment.appendChild(span);
        cursor += match.length;
        changed = true;
      } else {
        const start = cursor++;
        while (cursor < text.length && !(termsByFirstChar.get(text[cursor]) || []).some((term) => text.startsWith(term, cursor))) cursor++;
        fragment.appendChild(document.createTextNode(text.slice(start, cursor)));
      }
    }
    if (changed) node.parentNode.replaceChild(fragment, node);
  }

  function scan(root) {
    if (!root || !dictionary.size) return;
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode(node) {
        const parent = node.parentElement;
        if (!parent || !node.nodeValue.trim() || parent.closest('script,style,textarea,input,select,button,a,[contenteditable="true"],.kdsp-tap-word,.kdsp-translation-popover,[data-no-translate]')) return NodeFilter.FILTER_REJECT;
        if (!node.nodeValue.split('').some(isJapanese)) return NodeFilter.FILTER_REJECT;
        return NodeFilter.FILTER_ACCEPT;
      }
    });
    const nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);
    nodes.forEach((node) => wrapTextNode(node));
  }

  document.addEventListener('click', (event) => {
    const word = event.target.closest('.kdsp-tap-word');
    if (!word) return;
    event.preventDefault();
    event.stopPropagation();
    const entry = dictionary.get(word.dataset.kdspWord);
    if (entry) showEntry(word, entry, word.dataset.kdspWord);
  }, true);
  document.addEventListener('keydown', (event) => {
    if ((event.key === 'Enter' || event.key === ' ') && event.target.matches('.kdsp-tap-word')) {
      event.preventDefault();
      event.target.click();
    }
  });

  function start() {
    scan(document.body);
    observer = new MutationObserver((records) => records.forEach((record) => {
      record.addedNodes.forEach((node) => { if (node.nodeType === Node.ELEMENT_NODE || node.nodeType === Node.TEXT_NODE) scan(node); });
    }));
    observer.observe(document.body, { childList: true, subtree: true });
  }
  window.KDSPTapTranslate = { setDictionary, refresh: () => scan(document.body), close: closePopup };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();
})();
