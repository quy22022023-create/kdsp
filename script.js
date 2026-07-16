"use strict";

const DEFAULT_VOCABULARY = [
    { id: "default-1", hanzi: "结婚", pinyin: "jiéhūn", meaning: "Kết hôn", example: "他们明年准备结婚。", exampleMeaning: "Họ dự định kết hôn vào năm sau.", level: "HSK4", topic: "Cuộc sống" },
    { id: "default-2", hanzi: "安排", pinyin: "ānpái", meaning: "Sắp xếp, thu xếp", example: "我已经安排好了明天的工作。", exampleMeaning: "Tôi đã sắp xếp xong công việc ngày mai.", level: "HSK4", topic: "Công việc" },
    { id: "default-3", hanzi: "高兴", pinyin: "gāoxìng", meaning: "Vui vẻ, vui mừng", example: "见到你我很高兴。", exampleMeaning: "Gặp bạn tôi rất vui.", level: "HSK1", topic: "Cảm xúc" },
    { id: "default-4", hanzi: "完成", pinyin: "wánchéng", meaning: "Hoàn thành", example: "我按时完成了任务。", exampleMeaning: "Tôi đã hoàn thành nhiệm vụ đúng hạn.", level: "HSK3", topic: "Công việc" },
    { id: "default-5", hanzi: "压力", pinyin: "yālì", meaning: "Áp lực", example: "最近工作压力很大。", exampleMeaning: "Gần đây áp lực công việc rất lớn.", level: "HSK4", topic: "Công việc" },
    { id: "default-6", hanzi: "减少", pinyin: "jiǎnshǎo", meaning: "Giảm bớt", example: "运动可以减少压力。", exampleMeaning: "Vận động có thể giảm bớt áp lực.", level: "HSK4", topic: "Sức khỏe" }
];

const DEFAULT_READINGS = [{
    id: "reading-default-1",
    title: "Sắp xếp thời gian",
    passage: "无论是学习还是工作，我们都需要有条理地安排时间。只有按时完成任务，才能减少压力。",
    translation: "Dù là học tập hay làm việc, chúng ta đều cần sắp xếp thời gian một cách có trật tự. Chỉ khi hoàn thành nhiệm vụ đúng hạn mới có thể giảm bớt áp lực.",
    questions: [{
        question: "Theo đoạn văn, làm thế nào để giảm bớt áp lực?",
        options: ["安排时间 (Sắp xếp thời gian)", "按时完成任务 (Hoàn thành nhiệm vụ đúng hạn)", "减少工作 (Giảm bớt công việc)"],
        answerIndex: 1,
        explanation: "Đoạn văn nói rõ: 只有按时完成任务，才能减少压力。"
    }]
}];

const DEFAULT_FILLS = [{
    id: "fill-default-1",
    question: "听到他们下个月要（___）的消息，大家都非常高兴。",
    options: ["安排", "结婚"],
    answer: "结婚",
    explanation: "结婚 nghĩa là kết hôn và phù hợp với ngữ cảnh 'tháng sau sẽ kết hôn'."
}];

const DB_NAME = "hsk-personal-ai";
const DB_VERSION = 1;
const STORES = { settings: "settings", vocabulary: "vocabulary", progress: "progress", questions: "questions", activity: "activity" };

let db;
let vocabulary = [];
let progressMap = new Map();
let aiQuestions = [];
let activities = [];
let appSettings = {};
let flashcardQueue = [];
let currentIndex = 0;
let writingWord = null;
let quizWord = null;
let readingIndex = 0;
let fillIndex = 0;
let currentAIPracticeIndex = 0;

const $ = (id) => document.getElementById(id);

function uid(prefix = "id") {
    return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function openDatabase() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);
        request.onupgradeneeded = () => {
            const database = request.result;
            if (!database.objectStoreNames.contains(STORES.settings)) database.createObjectStore(STORES.settings, { keyPath: "key" });
            if (!database.objectStoreNames.contains(STORES.vocabulary)) database.createObjectStore(STORES.vocabulary, { keyPath: "id" });
            if (!database.objectStoreNames.contains(STORES.progress)) database.createObjectStore(STORES.progress, { keyPath: "wordId" });
            if (!database.objectStoreNames.contains(STORES.questions)) database.createObjectStore(STORES.questions, { keyPath: "id" });
            if (!database.objectStoreNames.contains(STORES.activity)) database.createObjectStore(STORES.activity, { keyPath: "id" });
        };
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

function storeRequest(storeName, mode, operation) {
    return new Promise((resolve, reject) => {
        const tx = db.transaction(storeName, mode);
        const store = tx.objectStore(storeName);
        let result;
        try { result = operation(store); } catch (error) { reject(error); return; }
        tx.oncomplete = () => resolve(result?.result);
        tx.onerror = () => reject(tx.error || result?.error);
    });
}

async function getAll(storeName) { return storeRequest(storeName, "readonly", store => store.getAll()); }
async function putOne(storeName, value) { return storeRequest(storeName, "readwrite", store => store.put(value)); }
async function deleteOne(storeName, key) { return storeRequest(storeName, "readwrite", store => store.delete(key)); }
async function clearStore(storeName) { return storeRequest(storeName, "readwrite", store => store.clear()); }

async function replaceStore(storeName, values) {
    await clearStore(storeName);
    if (!values.length) return;
    await storeRequest(storeName, "readwrite", store => values.forEach(value => store.put(value)));
}

async function initApp() {
    try {
        db = await openDatabase();
        vocabulary = await getAll(STORES.vocabulary);
        if (!vocabulary.length) {
            vocabulary = DEFAULT_VOCABULARY.map(normalizeWord);
            await replaceStore(STORES.vocabulary, vocabulary);
        }
        const progress = await getAll(STORES.progress);
        progressMap = new Map(progress.map(item => [item.wordId, item]));
        aiQuestions = await getAll(STORES.questions);
        activities = (await getAll(STORES.activity)).sort((a, b) => b.timestamp - a.timestamp).slice(0, 40);
        const settingsRows = await getAll(STORES.settings);
        appSettings = Object.fromEntries(settingsRows.map(row => [row.key, row.value]));
        applySettingsToUI();
        prepareDropZone();
        resetFlashcardSession();
        nextWritingQuestion();
        newQuizQuestion();
        renderReading();
        renderFill();
        refreshAllUI();
        runEnvironmentCheck();
        $("storage-state").textContent = "Đã lưu bằng IndexedDB";
        registerServiceWorker();
    } catch (error) {
        console.error(error);
        $("storage-state").textContent = "Không thể mở bộ nhớ cục bộ";
        showToast("Lỗi khởi tạo dữ liệu: " + error.message);
    }
}

function normalizeWord(raw, index = 0) {
    const hanzi = String(raw.hanzi ?? raw.word ?? raw.chinese ?? "").trim();
    const pinyin = String(raw.pinyin ?? raw.pronunciation ?? "").trim();
    const meaning = String(raw.meaning ?? raw.vietnamese ?? raw.translation ?? "").trim();
    return {
        id: String(raw.id || `word-${hanzi || index}-${Math.random().toString(36).slice(2, 7)}`),
        hanzi, pinyin, meaning,
        example: String(raw.example || "").trim(),
        exampleMeaning: String(raw.exampleMeaning || raw.example_translation || "").trim(),
        level: String(raw.level || "").trim(),
        topic: String(raw.topic || raw.category || "").trim(),
        note: String(raw.note || "").trim()
    };
}

function validateVocabulary(rawData) {
    const source = Array.isArray(rawData) ? rawData : rawData?.vocabulary;
    if (!Array.isArray(source)) throw new Error("JSON phải là một mảng từ hoặc có trường vocabulary là mảng.");
    const valid = [];
    const errors = [];
    const seen = new Set();
    source.forEach((item, index) => {
        const word = normalizeWord(item, index);
        if (!word.hanzi || !word.meaning) {
            errors.push(`Dòng ${index + 1}: thiếu hanzi hoặc meaning.`);
            return;
        }
        const key = `${word.hanzi}|${word.pinyin}`;
        if (seen.has(key)) {
            errors.push(`Dòng ${index + 1}: trùng từ ${word.hanzi}.`);
            return;
        }
        seen.add(key);
        valid.push(word);
    });
    if (!valid.length) throw new Error("Không tìm thấy từ hợp lệ trong file.");
    return { valid, errors };
}

function switchTab(tabId, button) {
    closeMoreMenu();
    document.querySelectorAll(".tab-content").forEach(tab => tab.classList.remove("active"));
    const target = $(tabId);
    if (target) target.classList.add("active");
    document.querySelectorAll(".nav-btn").forEach(btn => btn.classList.toggle("active", btn.dataset.tab === tabId));
    if (button) button.classList.add("active");
    const titles = { dashboard: "Hôm nay", flashcard: "Học từ", writing: "Luyện gõ", quiz: "Luyện tập", reading: "Đọc hiểu", fill: "Điền từ", ai: "AI ra đề", data: "Dữ liệu", settings: "Cài đặt" };
    if ($("page-title")) $("page-title").textContent = titles[tabId] || "HSK Personal AI";
    if (tabId === "dashboard") renderDashboard();
    if (tabId === "ai") renderAIBankSummary();
    window.scrollTo({ top: 0, behavior: "smooth" });
}

function getProgress(wordId) {
    return progressMap.get(wordId) || {
        wordId, repetitions: 0, interval: 0, ease: 2.5, dueAt: 0,
        correct: 0, incorrect: 0, favorite: false, mastered: false, lastStudied: 0
    };
}

async function saveProgress(item) {
    progressMap.set(item.wordId, item);
    await putOne(STORES.progress, item);
}

function calculateSRS(progress, quality) {
    const next = { ...progress };
    if (quality < 3) {
        next.repetitions = 0;
        next.interval = quality === 0 ? 0 : 1;
        next.incorrect += 1;
    } else {
        next.repetitions += 1;
        next.correct += 1;
        if (next.repetitions === 1) next.interval = 1;
        else if (next.repetitions === 2) next.interval = 3;
        else next.interval = Math.max(1, Math.round(next.interval * next.ease));
    }
    next.ease = Math.max(1.3, next.ease + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02)));
    next.dueAt = Date.now() + next.interval * 86400000;
    next.lastStudied = Date.now();
    next.mastered = next.repetitions >= 4 && next.interval >= 14;
    return next;
}

function getFilteredWords(filter) {
    const now = Date.now();
    if (filter === "due") return vocabulary.filter(w => getProgress(w.id).dueAt <= now);
    if (filter === "weak") return vocabulary.filter(w => getProgress(w.id).incorrect > getProgress(w.id).correct || getProgress(w.id).incorrect >= 2);
    if (filter === "favorite") return vocabulary.filter(w => getProgress(w.id).favorite);
    return [...vocabulary];
}

function resetFlashcardSession() {
    const filter = $("fc-filter")?.value || "all";
    flashcardQueue = getFilteredWords(filter);
    if (!flashcardQueue.length) flashcardQueue = [...vocabulary];
    currentIndex = 0;
    renderFlashcard();
}

function renderFlashcard() {
    if (!flashcardQueue.length) return;
    const word = flashcardQueue[currentIndex % flashcardQueue.length];
    const showPinyin = appSettings.showPinyin !== false;
    $("fc-front").textContent = word.hanzi;
    $("fc-back").innerHTML = `${showPinyin && word.pinyin ? `<strong>${escapeHtml(word.pinyin)}</strong><br>` : ""}<span>${escapeHtml(word.meaning)}</span>${word.example ? `<hr><small>${escapeHtml(word.example)}</small>${word.exampleMeaning ? `<br><small>${escapeHtml(word.exampleMeaning)}</small>` : ""}` : ""}`;
    document.querySelector(".card")?.classList.remove("flipped");
    const progress = getProgress(word.id);
    $("favorite-btn").textContent = progress.favorite ? "★ Đã yêu thích" : "☆ Yêu thích";
    $("fc-progress").style.width = `${((currentIndex + 1) / flashcardQueue.length) * 100}%`;
    if (appSettings.autoSpeak) speakText(word.hanzi);
}

function flipFlashcard() { document.querySelector(".card")?.classList.toggle("flipped"); }
function nextFlashcard() { currentIndex = (currentIndex + 1) % flashcardQueue.length; renderFlashcard(); }
function shuffleFlashcards() { flashcardQueue = shuffle([...flashcardQueue]); currentIndex = 0; renderFlashcard(); showToast("Đã trộn bộ thẻ."); }

async function rateFlashcard(quality) {
    const word = flashcardQueue[currentIndex];
    if (!word) return;
    const updated = calculateSRS(getProgress(word.id), quality);
    await saveProgress(updated);
    await logActivity(quality >= 3 ? "flashcard-correct" : "flashcard-wrong", `${word.hanzi} · ${word.meaning}`);
    nextFlashcard();
    refreshAllUI();
}

async function toggleFavorite() {
    const word = flashcardQueue[currentIndex];
    if (!word) return;
    const progress = { ...getProgress(word.id), favorite: !getProgress(word.id).favorite };
    await saveProgress(progress);
    renderFlashcard();
    refreshAllUI();
}

function speakText(text) {
    if (!("speechSynthesis" in window)) return showToast("Trình duyệt không hỗ trợ phát âm.");
    speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "zh-CN";
    utterance.rate = 0.82;
    speechSynthesis.speak(utterance);
}
function speakCurrentWord() { const word = flashcardQueue[currentIndex] || vocabulary[0]; if (word) speakText(word.hanzi); }

function nextWritingQuestion() {
    writingWord = pick(vocabulary);
    if (!writingWord) return;
    $("wt-meaning").textContent = writingWord.meaning;
    $("wt-pinyin").textContent = appSettings.showPinyin === false ? "Đã ẩn" : (writingWord.pinyin || "Không có");
    $("wt-input").value = "";
    setResult("wt-result", "", "");
}
function handleWritingEnter(event) { if (event.key === "Enter") checkWriting(); }
async function checkWriting() {
    if (!writingWord) return;
    const input = $("wt-input").value.trim();
    const correct = input === writingWord.hanzi;
    setResult("wt-result", correct ? "🎉 Chính xác!" : `❌ Chưa đúng. Đáp án: ${writingWord.hanzi}`, correct ? "ok" : "error");
    const updated = calculateSRS(getProgress(writingWord.id), correct ? 4 : 1);
    await saveProgress(updated);
    await logActivity(correct ? "writing-correct" : "writing-wrong", `${writingWord.hanzi} · ${writingWord.meaning}`);
    refreshAllUI();
}

function newQuizQuestion() {
    quizWord = pick(vocabulary);
    if (!quizWord) return;
    const mode = $("quiz-mode")?.value || "hanzi-meaning";
    let prompt, label, answer, distractorField;
    if (mode === "meaning-hanzi") { prompt = quizWord.meaning; label = "Chọn chữ Hán đúng"; answer = quizWord.hanzi; distractorField = "hanzi"; }
    else if (mode === "pinyin-hanzi") { prompt = quizWord.pinyin || quizWord.meaning; label = "Chọn chữ Hán đúng"; answer = quizWord.hanzi; distractorField = "hanzi"; }
    else { prompt = quizWord.hanzi; label = "Chọn nghĩa đúng"; answer = quizWord.meaning; distractorField = "meaning"; }
    $("quiz-prompt").textContent = prompt;
    $("quiz-label").textContent = label;
    const distractors = shuffle(vocabulary.filter(w => w.id !== quizWord.id).map(w => w[distractorField]).filter(Boolean)).slice(0, 3);
    const options = shuffle([...new Set([answer, ...distractors])]);
    $("quiz-options").innerHTML = options.map(option => `<button class="option-btn" type="button" onclick='answerQuiz(${JSON.stringify(option)})'>${escapeHtml(option)}</button>`).join("");
    setResult("quiz-result", "", "");
}

async function answerQuiz(selected) {
    if (!quizWord) return;
    const mode = $("quiz-mode").value;
    const answer = mode === "hanzi-meaning" ? quizWord.meaning : quizWord.hanzi;
    const correct = selected === answer;
    document.querySelectorAll("#quiz-options .option-btn").forEach(btn => {
        btn.disabled = true;
        if (btn.textContent === answer) btn.classList.add("correct");
        else if (btn.textContent === selected) btn.classList.add("wrong");
    });
    setResult("quiz-result", correct ? "🎉 Đúng rồi!" : `❌ Đáp án đúng: ${answer}`, correct ? "ok" : "error");
    await saveProgress(calculateSRS(getProgress(quizWord.id), correct ? 4 : 1));
    await logActivity(correct ? "quiz-correct" : "quiz-wrong", `${quizWord.hanzi} · ${quizWord.meaning}`);
    refreshAllUI();
}

function getReadings() {
    const fromAI = aiQuestions.filter(q => q.category === "reading" && q.passage);
    return [...DEFAULT_READINGS, ...fromAI.map(q => ({
        id: q.id, title: q.title || "Bài đọc AI", passage: q.passage, translation: q.translation || "",
        questions: q.questions || [{ question: q.question, options: q.options || [], answerIndex: q.answerIndex ?? 0, explanation: q.explanation || "" }]
    }))];
}

function renderReading() {
    const readings = getReadings();
    const item = readings[readingIndex % readings.length];
    if (!item) return;
    $("reading-container").innerHTML = `
        <article class="panel">
            <h3>${escapeHtml(item.title || "Bài đọc")}</h3>
            <div class="passage">${escapeHtml(item.passage)}</div>
            ${item.translation ? `<details><summary>Xem bản dịch</summary><p>${escapeHtml(item.translation)}</p></details>` : ""}
            <div>${item.questions.map((q, qi) => `
                <div class="reading-question">
                    <strong>${qi + 1}. ${escapeHtml(q.question)}</strong>
                    <div class="reading-options">${q.options.map((opt, oi) => `<label><input type="radio" name="reading-${qi}" value="${oi}"> ${escapeHtml(opt)}</label>`).join("")}</div>
                    <button type="button" onclick="checkReading(${qi})">Kiểm tra</button>
                    <p id="reading-result-${qi}" class="result"></p>
                </div>`).join("")}</div>
        </article>`;
}
function loadNextReading() { readingIndex++; renderReading(); }
function checkReading(questionIndex) {
    const readings = getReadings();
    const item = readings[readingIndex % readings.length];
    const q = item.questions[questionIndex];
    const selected = document.querySelector(`input[name="reading-${questionIndex}"]:checked`);
    if (!selected) return setResult(`reading-result-${questionIndex}`, "Hãy chọn một đáp án.", "error");
    const correct = Number(selected.value) === Number(q.answerIndex);
    setResult(`reading-result-${questionIndex}`, `${correct ? "🎉 Đúng." : "❌ Chưa đúng."} ${q.explanation || ""}`, correct ? "ok" : "error");
    logActivity(correct ? "reading-correct" : "reading-wrong", item.title || "Bài đọc");
}

function getFills() {
    const fromAI = aiQuestions.filter(q => q.category === "fill_blank" && q.question);
    return [...DEFAULT_FILLS, ...fromAI.map(q => ({ id: q.id, question: q.question, options: q.options || [], answer: q.answer, explanation: q.explanation || "" }))];
}
function renderFill() {
    const fills = getFills();
    const item = fills[fillIndex % fills.length];
    if (!item) return;
    $("fill-question").textContent = item.question;
    $("fill-hint").textContent = item.options.length ? `Từ gợi ý: ${item.options.join(" · ")}` : "";
    $("fill-select").innerHTML = `<option value="">-- Chọn từ thích hợp --</option>${item.options.map(option => `<option value="${escapeAttribute(option)}">${escapeHtml(option)}</option>`).join("")}`;
    setResult("fill-result", "", "");
}
function loadNextFill() { fillIndex++; renderFill(); }
async function checkFill() {
    const fills = getFills();
    const item = fills[fillIndex % fills.length];
    const selected = $("fill-select").value;
    const correct = selected === item.answer;
    setResult("fill-result", correct ? `🎉 Đúng rồi! ${item.explanation || ""}` : `❌ Đáp án: ${item.answer}. ${item.explanation || ""}`, correct ? "ok" : "error");
    await logActivity(correct ? "fill-correct" : "fill-wrong", item.question.slice(0, 60));
    refreshAllUI();
}

function getStats() {
    const all = [...progressMap.values()];
    const correct = all.reduce((sum, p) => sum + (p.correct || 0), 0);
    const incorrect = all.reduce((sum, p) => sum + (p.incorrect || 0), 0);
    return {
        total: vocabulary.length,
        due: vocabulary.filter(w => getProgress(w.id).dueAt <= Date.now()).length,
        mastered: vocabulary.filter(w => getProgress(w.id).mastered).length,
        accuracy: correct + incorrect ? Math.round(correct / (correct + incorrect) * 100) : 0
    };
}

function refreshAllUI() {
    const stats = getStats();
    $("stat-total").textContent = stats.total;
    $("stat-due").textContent = stats.due;
    $("stat-mastered").textContent = stats.mastered;
    $("stat-accuracy").textContent = `${stats.accuracy}%`;
    $("data-word-count").textContent = vocabulary.length;
    $("ai-bank-count").textContent = aiQuestions.length;
    renderDashboard();
    renderAIBankSummary();
}

function renderDashboard() {
    const goal = Number(appSettings.dailyWordGoal || 20);
    const qGoal = Number(appSettings.dailyQuestionGoal || 20);
    const stats = getStats();
    $("daily-plan").innerHTML = `<div>• Ôn <strong>${Math.min(stats.due, goal)}</strong> từ đến hạn</div><div>• Học mới tối đa <strong>${Math.min(goal, Math.max(0, stats.total - stats.mastered))}</strong> từ</div><div>• Làm <strong>${qGoal}</strong> câu cho mỗi hạng mục đã chọn</div>`;
    const weak = vocabulary.map(w => ({ word: w, score: getProgress(w.id).incorrect - getProgress(w.id).correct })).sort((a, b) => b.score - a.score).filter(x => x.score > 0).slice(0, 8);
    $("weak-words").innerHTML = weak.length ? weak.map(x => `<span class="chip">${escapeHtml(x.word.hanzi)} · sai ${getProgress(x.word.id).incorrect}</span>`).join("") : `<span class="muted">Chưa có từ yếu. Hãy bắt đầu luyện tập.</span>`;
    $("recent-activity").innerHTML = activities.length ? activities.slice(0, 6).map(a => `<div class="activity-item"><strong>${escapeHtml(activityLabel(a.type))}</strong><br><small>${escapeHtml(a.detail)} · ${formatTime(a.timestamp)}</small></div>`).join("") : `<span class="muted">Chưa có hoạt động.</span>`;
}

function startQuickSession() { switchTab("flashcard"); resetFlashcardSession(); }
function startDueReview() { $("fc-filter").value = "due"; resetFlashcardSession(); switchTab("flashcard"); }

async function logActivity(type, detail) {
    const item = { id: uid("activity"), type, detail, timestamp: Date.now() };
    activities.unshift(item);
    activities = activities.slice(0, 40);
    await putOne(STORES.activity, item);
}

function activityLabel(type) {
    const labels = {
        "flashcard-correct": "Flashcard: nhớ", "flashcard-wrong": "Flashcard: quên",
        "writing-correct": "Luyện gõ: đúng", "writing-wrong": "Luyện gõ: sai",
        "quiz-correct": "Trắc nghiệm: đúng", "quiz-wrong": "Trắc nghiệm: sai",
        "reading-correct": "Đọc hiểu: đúng", "reading-wrong": "Đọc hiểu: sai",
        "fill-correct": "Điền từ: đúng", "fill-wrong": "Điền từ: sai", "ai-generated": "AI đã tạo đề"
    };
    return labels[type] || "Hoạt động";
}

function prepareDropZone() {
    const zone = $("drop-zone");
    ["dragenter", "dragover"].forEach(name => zone.addEventListener(name, event => { event.preventDefault(); zone.classList.add("dragover"); }));
    ["dragleave", "drop"].forEach(name => zone.addEventListener(name, event => { event.preventDefault(); zone.classList.remove("dragover"); }));
    zone.addEventListener("drop", event => {
        const file = event.dataTransfer.files?.[0];
        if (file) importVocabularyFile({ target: { files: [file], value: "" } });
    });
}

async function importVocabularyFile(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
        const parsed = JSON.parse(await file.text());
        const { valid, errors } = validateVocabulary(parsed);
        const merge = $("merge-import").checked;
        let next = valid;
        if (merge) {
            const map = new Map(vocabulary.map(w => [`${w.hanzi}|${w.pinyin}`, w]));
            valid.forEach(w => map.set(`${w.hanzi}|${w.pinyin}`, w));
            next = [...map.values()];
        }
        vocabulary = next;
        await replaceStore(STORES.vocabulary, vocabulary);
        if (!merge) { await clearStore(STORES.progress); progressMap.clear(); }
        resetFlashcardSession(); nextWritingQuestion(); newQuizQuestion(); refreshAllUI();
        setResult("import-result", `Đã nhập ${valid.length} từ.${errors.length ? ` Bỏ qua ${errors.length} mục lỗi.` : ""}`, "ok");
        showToast("Nhập bộ từ thành công.");
    } catch (error) {
        setResult("import-result", `Không thể nhập: ${error.message}`, "error");
    } finally { event.target.value = ""; }
}

function downloadJSON(filename, data) {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url; anchor.download = filename; anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function exportVocabulary() { downloadJSON("hsk-vocabulary.json", { meta: { name: "Bộ từ cá nhân", exportedAt: new Date().toISOString() }, vocabulary }); }
async function exportFullBackup() {
    downloadJSON("hsk-personal-ai-backup.json", { version: 1, exportedAt: new Date().toISOString(), vocabulary, progress: [...progressMap.values()], questions: aiQuestions, activity: activities, settings: appSettings });
}
async function importFullBackup(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
        const data = JSON.parse(await file.text());
        if (!Array.isArray(data.vocabulary)) throw new Error("Bản sao lưu không có vocabulary hợp lệ.");
        vocabulary = data.vocabulary.map(normalizeWord);
        aiQuestions = Array.isArray(data.questions) ? data.questions : [];
        activities = Array.isArray(data.activity) ? data.activity : [];
        progressMap = new Map((Array.isArray(data.progress) ? data.progress : []).map(p => [p.wordId, p]));
        appSettings = data.settings || {};
        await replaceStore(STORES.vocabulary, vocabulary);
        await replaceStore(STORES.progress, [...progressMap.values()]);
        await replaceStore(STORES.questions, aiQuestions);
        await replaceStore(STORES.activity, activities);
        for (const [key, value] of Object.entries(appSettings)) await putOne(STORES.settings, { key, value });
        applySettingsToUI(); resetFlashcardSession(); nextWritingQuestion(); newQuizQuestion(); renderReading(); renderFill(); refreshAllUI();
        showToast("Đã khôi phục bản sao lưu.");
    } catch (error) { showToast("Không thể khôi phục: " + error.message); }
    finally { event.target.value = ""; }
}
async function restoreDefaultVocabulary() {
    if (!confirm("Khôi phục bộ từ mẫu và xóa tiến độ hiện tại?")) return;
    vocabulary = DEFAULT_VOCABULARY.map(normalizeWord);
    progressMap.clear();
    await replaceStore(STORES.vocabulary, vocabulary);
    await clearStore(STORES.progress);
    resetFlashcardSession(); nextWritingQuestion(); newQuizQuestion(); refreshAllUI();
    showToast("Đã khôi phục bộ từ mẫu.");
}

function updateProviderFields() {
    const gemini = $("provider").value === "gemini";
    $("base-url-label").classList.toggle("hidden", gemini);
    if (gemini && !$("model-name").value) $("model-name").value = "gemini-2.0-flash";
}
function applySettingsToUI() {
    $("provider").value = appSettings.provider || "gemini";
    $("api-key").value = appSettings.apiKey || "";
    $("model-name").value = appSettings.model || "gemini-2.0-flash";
    $("base-url").value = appSettings.baseUrl || "https://api.groq.com/openai/v1";
    $("setting-show-pinyin").checked = appSettings.showPinyin !== false;
    $("setting-auto-speak").checked = Boolean(appSettings.autoSpeak);
    $("daily-word-goal").value = appSettings.dailyWordGoal || 20;
    $("daily-question-goal").value = appSettings.dailyQuestionGoal || 20;
    if (appSettings.theme === "dark") document.body.classList.add("dark");
    updateProviderFields();
}
async function saveSetting(key, value) { appSettings[key] = value; await putOne(STORES.settings, { key, value }); }
async function saveSettings() {
    await saveSetting("provider", $("provider").value);
    await saveSetting("apiKey", $("api-key").value.trim());
    await saveSetting("model", $("model-name").value.trim());
    await saveSetting("baseUrl", $("base-url").value.trim().replace(/\/$/, ""));
    setResult("settings-result", "Đã lưu cấu hình AI trên thiết bị.", "ok");
    setAIStatus("Đã cấu hình", "ok");
}
async function saveLearningSettings() {
    await saveSetting("showPinyin", $("setting-show-pinyin").checked);
    await saveSetting("autoSpeak", $("setting-auto-speak").checked);
    await saveSetting("dailyWordGoal", Number($("daily-word-goal").value || 20));
    await saveSetting("dailyQuestionGoal", Number($("daily-question-goal").value || 20));
    renderFlashcard(); renderDashboard(); showToast("Đã lưu mục tiêu học.");
}
async function toggleTheme() {
    document.body.classList.toggle("dark");
    await saveSetting("theme", document.body.classList.contains("dark") ? "dark" : "light");
}

function getAIConfig() {
    return {
        provider: $("provider").value || appSettings.provider,
        apiKey: $("api-key").value.trim() || appSettings.apiKey,
        model: $("model-name").value.trim() || appSettings.model,
        baseUrl: ($("base-url").value.trim() || appSettings.baseUrl || "").replace(/\/$/, "")
    };
}

async function callAI(messages, expectJSON = true) {
    const config = getAIConfig();
    if (!config.apiKey) throw new Error("Bạn chưa nhập API key trong Cài đặt.");
    if (config.provider === "gemini") {
        const model = config.model || "gemini-2.0-flash";
        const prompt = messages.map(m => `${m.role.toUpperCase()}: ${m.content}`).join("\n\n");
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(config.apiKey)}`, {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ contents: [{ role: "user", parts: [{ text: prompt }] }], generationConfig: { temperature: 0.55, responseMimeType: expectJSON ? "application/json" : "text/plain" } })
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data?.error?.message || `Gemini trả lỗi ${response.status}`);
        return data?.candidates?.[0]?.content?.parts?.map(p => p.text).join("") || "";
    }
    if (!config.baseUrl) throw new Error("Thiếu Base URL cho API OpenAI-compatible.");
    const response = await fetch(`${config.baseUrl}/chat/completions`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${config.apiKey}` },
        body: JSON.stringify({ model: config.model, messages, temperature: 0.55 })
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data?.error?.message || `API trả lỗi ${response.status}`);
    return data?.choices?.[0]?.message?.content || "";
}

async function testAIConnection() {
    const button = document.querySelector('button[onclick="testAIConnection()"]');
    if (button) button.disabled = true;
    setResult("settings-result", "Đang kiểm tra kết nối…", "");
    try {
        const text = await callAI([{ role: "user", content: "Trả về JSON duy nhất: {\"status\":\"ok\"}" }]);
        parseAIJSON(text);
        setResult("settings-result", "Kết nối AI thành công.", "ok");
        setAIStatus("Đã kết nối", "ok");
    } catch (error) {
        setResult("settings-result", `Kết nối thất bại: ${error.message}`, "error");
        setAIStatus("Lỗi kết nối", "error");
    } finally { if (button) button.disabled = false; }
}

function selectWordsForAI(source, count = 30) {
    let words = getFilteredWords(source);
    if (!words.length) words = [...vocabulary];
    return shuffle(words).slice(0, count).map(w => ({ hanzi: w.hanzi, pinyin: w.pinyin, meaning: w.meaning, example: w.example }));
}

function categoryInstruction(category) {
    const instructions = {
        fill_blank: "Mỗi câu gồm question có đúng một chỗ trống （___）, options 4 từ, answer nằm trong options, explanation tiếng Việt.",
        sentence_order: "Mỗi câu gồm question là yêu cầu tiếng Việt, fragments là mảng các cụm tiếng Trung bị đảo, answer là câu đúng, explanation tiếng Việt.",
        reading: "Tạo bài đọc ngắn. Mỗi mục gồm title, passage, translation, questions; mỗi question có question, options 4 đáp án, answerIndex từ 0 đến 3, explanation.",
        grammar: "Mỗi câu gồm question, options 4 đáp án, answer, explanation tiếng Việt và grammarPoint.",
        error_correction: "Mỗi câu gồm question là câu tiếng Trung có lỗi, answer là câu đã sửa, explanation tiếng Việt.",
        writing: "Mỗi mục gồm question là đề bài viết ngắn, requiredWords là mảng 2-4 từ bắt buộc, sampleAnswer và explanation tiếng Việt."
    };
    return instructions[category] || instructions.fill_blank;
}

async function generateAIQuestions() {
    const button = $("generate-ai-btn");
    const category = $("ai-category").value;
    const count = Math.min(20, Math.max(1, Number($("ai-count").value || 20)));
    const difficulty = $("ai-difficulty").value;
    const source = $("ai-word-source").value;
    const selectedWords = selectWordsForAI(source, 35);
    button.disabled = true;
    setResult("ai-generate-result", `AI đang tạo ${count} câu…`, "");
    try {
        const prompt = `Bạn là giáo viên tiếng Trung chuyên HSK. Hãy tạo đúng ${count} mục bài tập loại ${category}, độ khó ${difficulty}, ưu tiên các từ trong danh sách dưới đây. Không tạo câu mơ hồ, không để nhiều đáp án đúng. Giải thích bằng tiếng Việt. ${categoryInstruction(category)}\n\nDanh sách từ:\n${JSON.stringify(selectedWords)}\n\nChỉ trả về JSON hợp lệ theo cấu trúc: {"category":"${category}","questions":[...]}. Không markdown.`;
        const raw = await callAI([{ role: "system", content: "Bạn tạo dữ liệu bài tập tiếng Trung chính xác, ngắn gọn và luôn trả JSON hợp lệ." }, { role: "user", content: prompt }]);
        const parsed = parseAIJSON(raw);
        const questions = validateAIQuestions(parsed.questions, category).slice(0, count);
        if (!questions.length) throw new Error("AI không trả về câu hỏi hợp lệ.");
        const stamped = questions.map(q => ({ ...q, id: q.id || uid("aiq"), category, difficulty, createdAt: Date.now(), sourceWords: selectedWords.map(w => w.hanzi), status: "new" }));
        for (const question of stamped) await putOne(STORES.questions, question);
        aiQuestions.push(...stamped);
        await logActivity("ai-generated", `${stamped.length} câu · ${category}`);
        renderAIBankSummary(); renderReading(); renderFill(); refreshAllUI();
        setResult("ai-generate-result", `Đã tạo và lưu ${stamped.length}/${count} câu hợp lệ.`, "ok");
        setAIStatus("Hoạt động", "ok");
    } catch (error) {
        console.error(error);
        setResult("ai-generate-result", `Không thể tạo đề: ${error.message}`, "error");
        setAIStatus("Có lỗi", "error");
    } finally { button.disabled = false; }
}

function parseAIJSON(text) {
    if (typeof text === "object") return text;
    const clean = String(text).trim().replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
    try { return JSON.parse(clean); }
    catch {
        const start = clean.indexOf("{"); const end = clean.lastIndexOf("}");
        if (start >= 0 && end > start) return JSON.parse(clean.slice(start, end + 1));
        throw new Error("Phản hồi AI không phải JSON hợp lệ.");
    }
}

function validateAIQuestions(items, category) {
    if (!Array.isArray(items)) throw new Error("Thiếu mảng questions.");
    return items.filter(item => {
        if (!item || typeof item !== "object") return false;
        if (category === "reading") return Boolean(item.passage && Array.isArray(item.questions) && item.questions.length);
        if (category === "sentence_order") return Boolean(item.answer && Array.isArray(item.fragments) && item.fragments.length);
        if (category === "writing") return Boolean(item.question && item.sampleAnswer);
        if (category === "error_correction") return Boolean(item.question && item.answer);
        if (["fill_blank", "grammar"].includes(category)) return Boolean(item.question && item.answer && Array.isArray(item.options) && item.options.includes(item.answer));
        return Boolean(item.question);
    });
}

function renderAIBankSummary() {
    const target = $("ai-bank-summary");
    if (!target) return;
    const groups = aiQuestions.reduce((acc, q) => { acc[q.category] = (acc[q.category] || 0) + 1; return acc; }, {});
    target.innerHTML = Object.keys(groups).length ? Object.entries(groups).map(([key, value]) => `<div class="ai-bank-row"><span>${escapeHtml(categoryLabel(key))}</span><strong>${value}</strong></div>`).join("") : `<p class="muted">Chưa có câu hỏi AI.</p>`;
}

function categoryLabel(key) {
    return ({ fill_blank: "Điền từ", sentence_order: "Sắp xếp câu", reading: "Đọc hiểu", grammar: "Ngữ pháp", error_correction: "Sửa câu sai", writing: "Bài viết" })[key] || key;
}

function startAIBankPractice() {
    if (!aiQuestions.length) return showToast("Kho câu hỏi AI đang trống.");
    currentAIPracticeIndex = 0;
    $("ai-practice-area").classList.remove("hidden");
    renderAIPracticeQuestion();
}

function renderAIPracticeQuestion() {
    const q = aiQuestions[currentAIPracticeIndex % aiQuestions.length];
    const area = $("ai-practice-area");
    let body = `<div class="ai-question-box"><span class="badge">${escapeHtml(categoryLabel(q.category))}</span>`;
    if (q.category === "reading") {
        const sub = q.questions?.[0];
        body += `<h3>${escapeHtml(q.title || "Bài đọc")}</h3><div class="passage">${escapeHtml(q.passage)}</div><p><strong>${escapeHtml(sub?.question || "")}</strong></p>${renderAIOptions(sub?.options || [], sub?.answerIndex)}`;
    } else if (q.category === "sentence_order") {
        body += `<h3>${escapeHtml(q.question || "Sắp xếp thành câu đúng")}</h3><div class="chip-list">${(q.fragments || []).map(x => `<span class="chip">${escapeHtml(x)}</span>`).join("")}</div><textarea id="ai-user-answer" rows="3" placeholder="Nhập câu đã sắp xếp"></textarea>`;
    } else if (["fill_blank", "grammar"].includes(q.category)) {
        body += `<h3>${escapeHtml(q.question)}</h3>${renderAIOptions(q.options || [], q.answer)}`;
    } else {
        body += `<h3>${escapeHtml(q.question || "")}</h3><textarea id="ai-user-answer" rows="5" placeholder="Nhập câu trả lời của bạn"></textarea>`;
    }
    body += `<div class="inline-controls"><button type="button" onclick="revealAIAnswer()">Xem đáp án</button><button class="secondary" type="button" onclick="nextAIPractice()">Câu tiếp theo</button><button class="danger ghost" type="button" onclick="reportAIQuestion()">Báo câu lỗi</button></div><div id="ai-answer-box" class="ai-answer hidden"></div></div>`;
    area.innerHTML = body;
}

function renderAIOptions(options, answerMarker) {
    return `<div class="option-grid">${options.map((option, index) => `<button class="option-btn" type="button" onclick='selectAIOption(this, ${JSON.stringify(option)}, ${JSON.stringify(answerMarker)}, ${index})'>${escapeHtml(option)}</button>`).join("")}</div>`;
}
function selectAIOption(button, option, answerMarker, index) {
    const correct = typeof answerMarker === "number" ? index === answerMarker : option === answerMarker;
    document.querySelectorAll("#ai-practice-area .option-btn").forEach(btn => btn.disabled = true);
    button.classList.add(correct ? "correct" : "wrong");
    showToast(correct ? "Đúng rồi!" : "Chưa đúng, hãy xem đáp án.");
}
function revealAIAnswer() {
    const q = aiQuestions[currentAIPracticeIndex % aiQuestions.length];
    let answer = q.answer || q.sampleAnswer || "";
    let explanation = q.explanation || "";
    if (q.category === "reading") {
        const sub = q.questions?.[0];
        answer = sub?.options?.[sub.answerIndex] || "";
        explanation = sub?.explanation || q.translation || "";
    }
    $("ai-answer-box").classList.remove("hidden");
    $("ai-answer-box").innerHTML = `<strong>Đáp án:</strong><p>${escapeHtml(String(answer))}</p>${explanation ? `<strong>Giải thích:</strong><p>${escapeHtml(explanation)}</p>` : ""}`;
}
function nextAIPractice() { currentAIPracticeIndex = (currentAIPracticeIndex + 1) % aiQuestions.length; renderAIPracticeQuestion(); }
async function reportAIQuestion() {
    const q = aiQuestions[currentAIPracticeIndex % aiQuestions.length];
    if (!q) return;
    q.status = "reported";
    await putOne(STORES.questions, q);
    showToast("Đã đánh dấu câu hỏi có lỗi.");
    nextAIPractice();
}
function exportAIQuestions() { downloadJSON("hsk-ai-question-bank.json", { exportedAt: new Date().toISOString(), questions: aiQuestions }); }
async function clearAIQuestions() {
    if (!confirm("Xóa toàn bộ câu hỏi AI đã lưu?")) return;
    aiQuestions = [];
    await clearStore(STORES.questions);
    $("ai-practice-area").classList.add("hidden");
    renderAIBankSummary(); renderReading(); renderFill(); refreshAllUI();
}
function setAIStatus(text, type = "") { const badge = $("ai-status-badge"); badge.textContent = text; badge.className = `badge ${type}`.trim(); }

function setResult(id, text, type) {
    const element = $(id);
    if (!element) return;
    element.textContent = text;
    element.className = `result ${type || ""}`.trim();
}
function showToast(message) {
    const toast = $("toast");
    toast.textContent = message;
    toast.classList.add("show");
    clearTimeout(showToast.timer);
    showToast.timer = setTimeout(() => toast.classList.remove("show"), 2600);
}
function pick(array) { return array[Math.floor(Math.random() * array.length)]; }
function shuffle(array) { for (let i = array.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [array[i], array[j]] = [array[j], array[i]]; } return array; }
function escapeHtml(value) { return String(value ?? "").replace(/[&<>'"]/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[char]); }
function escapeAttribute(value) { return escapeHtml(value); }
function formatTime(timestamp) { return new Intl.DateTimeFormat("vi-VN", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }).format(new Date(timestamp)); }
function registerServiceWorker() { if ("serviceWorker" in navigator && location.protocol.startsWith("http")) navigator.serviceWorker.register("service-worker.js").catch(console.warn); }

document.addEventListener("keydown", event => {
    if (event.key === " " && $("flashcard")?.classList.contains("active") && event.target === document.body) { event.preventDefault(); flipFlashcard(); }
});


function openMoreMenu() {
    const overlay = $("more-overlay");
    if (overlay) overlay.classList.add("open");
}

function closeMoreMenu(event) {
    const overlay = $("more-overlay");
    if (!overlay) return;
    if (event && event.target !== overlay) return;
    overlay.classList.remove("open");
}

function runEnvironmentCheck() {
    const target = $("environment-status");
    if (!target) return;
    const checks = [
        ["Bộ nhớ IndexedDB", "indexedDB" in window, "Lưu tiến độ học"],
        ["Đọc tiếng Trung", "speechSynthesis" in window, "Phát âm bằng giọng hệ thống"],
        ["Chọn file JSON", "FileReader" in window, "Nhập bộ từ và sao lưu"],
        ["Kết nối Internet", navigator.onLine, "Dùng tính năng AI"],
        ["Chế độ máy chủ", location.protocol === "http:" || location.protocol === "https:", "PWA và cache offline"]
    ];
    target.innerHTML = checks.map(([name, ok, note]) => `<div class="environment-row"><div><strong>${name}</strong><br><small class="muted">${note}</small></div><span class="${ok ? "env-ok" : "env-warn"}">${ok ? "Sẵn sàng" : "Hạn chế"}</span></div>`).join("");
}

window.addEventListener("online", runEnvironmentCheck);
window.addEventListener("offline", runEnvironmentCheck);

document.addEventListener("DOMContentLoaded", initApp);

/* ===== V3 core: daily smart session, CRUD vocabulary, stronger offline practice ===== */
let smartSession = null;

function localDateKey(timestamp = Date.now()) {
    const d = new Date(timestamp);
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
}

function getTodayActivityStats() {
    const key = localDateKey();
    const today = activities.filter(a => localDateKey(a.timestamp) === key);
    const answerEvents = today.filter(a => /-(correct|wrong)$/.test(a.type));
    const correct = answerEvents.filter(a => a.type.endsWith("-correct")).length;
    const activeDays = [...new Set(activities.map(a => localDateKey(a.timestamp)))].sort().reverse();
    let streak = 0;
    const cursor = new Date();
    for (let i=0;i<365;i++) {
        const k = localDateKey(cursor.getTime());
        if (activeDays.includes(k)) { streak++; cursor.setDate(cursor.getDate()-1); }
        else if (i===0) cursor.setDate(cursor.getDate()-1);
        else break;
    }
    return { done: answerEvents.length, correct, streak };
}

const originalRefreshAllUIV3 = refreshAllUI;
refreshAllUI = function() {
    originalRefreshAllUIV3();
    renderV3Today();
    if ($("vocabulary-manager")?.classList.contains("active")) renderVocabularyManager();
};

function renderV3Today() {
    if (!$('today-done')) return;
    const stat = getTodayActivityStats();
    const goal = Number(appSettings.dailyWordGoal || 20);
    const percent = Math.min(100, Math.round(stat.done / Math.max(1, goal) * 100));
    $('today-done').textContent = stat.done;
    $('today-correct').textContent = stat.correct;
    $('today-streak').textContent = stat.streak;
    $('today-progress-label').textContent = `${stat.done}/${goal}`;
    $('today-progress-bar').style.width = `${percent}%`;
}

function buildSmartSession() {
    const goal = Math.max(5, Math.min(50, Number(appSettings.dailyWordGoal || 20)));
    const due = shuffle(vocabulary.filter(w => getProgress(w.id).dueAt <= Date.now()));
    const weak = shuffle(vocabulary.filter(w => getProgress(w.id).incorrect > getProgress(w.id).correct));
    const unseen = shuffle(vocabulary.filter(w => getProgress(w.id).repetitions === 0));
    const pool = [];
    const used = new Set();
    [...due, ...weak, ...unseen, ...shuffle([...vocabulary])].forEach(w => {
        if (!used.has(w.id) && pool.length < goal) { used.add(w.id); pool.push(w); }
    });
    const items = pool.map((word, index) => ({ type: index % 3 === 0 ? 'flashcard' : index % 3 === 1 ? 'meaningQuiz' : 'typing', word }));
    return { items, index: 0, correct: 0, startedAt: Date.now() };
}

function startSmartSession() {
    if (!vocabulary.length) return showToast('Chưa có từ vựng để học.');
    smartSession = buildSmartSession();
    switchTab('session');
    renderSmartSessionItem();
}

function pauseSmartSession() {
    if (smartSession && smartSession.index < smartSession.items.length) appSettings.pausedSession = smartSession;
    switchTab('dashboard');
    showToast('Đã tạm dừng buổi học.');
}

function renderSmartSessionItem() {
    if (!smartSession || smartSession.index >= smartSession.items.length) return finishSmartSession();
    const item = smartSession.items[smartSession.index];
    const total = smartSession.items.length;
    $('session-step').textContent = `${smartSession.index + 1}/${total}`;
    $('session-score').textContent = `Đúng ${smartSession.correct}`;
    $('session-progress').style.width = `${Math.round(smartSession.index / total * 100)}%`;
    const w = item.word;
    if (item.type === 'flashcard') {
        $('session-title').textContent = 'Ôn theo SRS';
        $('session-card').innerHTML = `<span class="mini-badge">FLASHCARD</span><h2>${escapeHtml(w.hanzi)}</h2><p class="session-meaning">${escapeHtml(w.pinyin)}</p><p>${escapeHtml(w.meaning)}</p><div class="session-actions session-rating"><button class="danger" onclick="answerSmartFlashcard(0)">Quên</button><button class="warning" onclick="answerSmartFlashcard(2)">Khó</button><button onclick="answerSmartFlashcard(4)">Nhớ</button><button class="success" onclick="answerSmartFlashcard(5)">Rất dễ</button></div>`;
    } else if (item.type === 'typing') {
        $('session-title').textContent = 'Luyện gõ';
        $('session-card').innerHTML = `<span class="mini-badge">GÕ CHỮ HÁN</span><p class="muted">Nhập từ có nghĩa</p><h3>${escapeHtml(w.meaning)}</h3><p>${escapeHtml(w.pinyin)}</p><input id="session-input" type="text" autocomplete="off" placeholder="Nhập chữ Hán…"><div class="session-actions"><button onclick="checkSmartTyping()">Kiểm tra</button><button class="secondary" onclick="skipSmartItem()">Bỏ qua</button></div><p id="session-feedback" class="result"></p>`;
        setTimeout(() => $('session-input')?.focus(), 80);
    } else {
        $('session-title').textContent = 'Trắc nghiệm';
        const choices = shuffle([w, ...shuffle(vocabulary.filter(x => x.id !== w.id)).slice(0,3)]);
        $('session-card').innerHTML = `<span class="mini-badge">CHỌN NGHĨA</span><h2>${escapeHtml(w.hanzi)}</h2><div class="option-grid">${choices.map(x => `<button class="option-btn" onclick="answerSmartQuiz(this,'${escapeAttribute(x.id)}','${escapeAttribute(w.id)}')">${escapeHtml(x.meaning)}</button>`).join('')}</div><p id="session-feedback" class="result"></p>`;
    }
}

async function answerSmartFlashcard(quality) {
    const w = smartSession.items[smartSession.index].word;
    const next = calculateSRS(getProgress(w.id), quality);
    await saveProgress(next);
    if (quality >= 3) smartSession.correct++;
    await logActivity(quality >= 3 ? 'flashcard-correct' : 'flashcard-wrong', w.hanzi);
    smartSession.index++; renderSmartSessionItem();
}

async function checkSmartTyping() {
    const w = smartSession.items[smartSession.index].word;
    const answer = $('session-input').value.trim();
    const ok = answer === w.hanzi;
    setResult('session-feedback', ok ? 'Chính xác!' : `Đáp án: ${w.hanzi}`, ok ? 'ok' : 'error');
    const p = getProgress(w.id); p[ok ? 'correct' : 'incorrect'] += 1; p.lastStudied = Date.now(); await saveProgress(p);
    await logActivity(ok ? 'writing-correct' : 'writing-wrong', w.hanzi);
    if (ok) smartSession.correct++;
    setTimeout(() => { smartSession.index++; renderSmartSessionItem(); }, 600);
}

async function answerSmartQuiz(button, selectedId, correctId) {
    document.querySelectorAll('#session-card .option-btn').forEach(b => b.disabled = true);
    const ok = selectedId === correctId;
    button.classList.add(ok ? 'correct' : 'wrong');
    const w = smartSession.items[smartSession.index].word;
    const p = getProgress(w.id); p[ok ? 'correct' : 'incorrect'] += 1; p.lastStudied = Date.now(); await saveProgress(p);
    await logActivity(ok ? 'quiz-correct' : 'quiz-wrong', w.hanzi);
    if (ok) smartSession.correct++;
    setTimeout(() => { smartSession.index++; renderSmartSessionItem(); }, 650);
}

function skipSmartItem() { smartSession.index++; renderSmartSessionItem(); }

async function finishSmartSession() {
    const total = smartSession?.items.length || 0;
    const correct = smartSession?.correct || 0;
    await logActivity('session-complete', `${correct}/${total} nội dung đúng`);
    $('session-progress').style.width = '100%';
    $('session-card').innerHTML = `<span class="mini-badge">HOÀN THÀNH</span><h2>🎉</h2><h3>${correct}/${total} nội dung tốt</h3><p class="muted">Tiến độ và lịch ôn đã được lưu tự động.</p><button class="primary-action full-btn" onclick="switchTab('dashboard')">Về trang Hôm nay</button>`;
    refreshAllUI();
}

function renderVocabularyManager() {
    const target = $('vocab-list'); if (!target) return;
    const term = ($('vocab-search')?.value || '').trim().toLowerCase();
    const filter = $('vocab-filter')?.value || 'all';
    let words = vocabulary.filter(w => `${w.hanzi} ${w.pinyin} ${w.meaning} ${w.topic}`.toLowerCase().includes(term));
    if (filter === 'favorite') words = words.filter(w => getProgress(w.id).favorite);
    if (filter === 'weak') words = words.filter(w => getProgress(w.id).incorrect > getProgress(w.id).correct);
    if (filter === 'due') words = words.filter(w => getProgress(w.id).dueAt <= Date.now());
    target.innerHTML = words.length ? words.slice(0,500).map(w => `<article class="vocab-item"><div class="vocab-main"><h3>${escapeHtml(w.hanzi)} <small>${escapeHtml(w.pinyin)}</small></h3><p>${escapeHtml(w.meaning)}</p>${w.example ? `<p class="muted">${escapeHtml(w.example)}</p>`:''}<div class="vocab-meta">${w.level?`<span class="chip">${escapeHtml(w.level)}</span>`:''}${w.topic?`<span class="chip">${escapeHtml(w.topic)}</span>`:''}<span class="chip">Sai ${getProgress(w.id).incorrect}</span></div></div><div class="vocab-actions"><button class="secondary" onclick="openWordEditor('${escapeAttribute(w.id)}')">Sửa</button><button class="danger ghost" onclick="deleteVocabularyWord('${escapeAttribute(w.id)}')">Xóa</button></div></article>`).join('') : '<div class="panel empty-state">Không tìm thấy từ phù hợp.</div>';
}

function openWordEditor(id='') {
    const w = vocabulary.find(x => x.id === id);
    $('word-editor-title').textContent = w ? 'Sửa từ vựng' : 'Thêm từ';
    $('edit-word-id').value = w?.id || '';
    $('edit-hanzi').value = w?.hanzi || ''; $('edit-pinyin').value = w?.pinyin || ''; $('edit-meaning').value = w?.meaning || '';
    $('edit-example').value = w?.example || ''; $('edit-example-meaning').value = w?.exampleMeaning || ''; $('edit-level').value = w?.level || ''; $('edit-topic').value = w?.topic || ''; $('edit-note').value = w?.note || '';
    $('word-editor-overlay').classList.add('open'); setTimeout(()=>$('edit-hanzi').focus(),80);
}
function closeWordEditor(event) { const o=$('word-editor-overlay'); if(event && event.target!==o)return; o?.classList.remove('open'); }

async function saveWordFromEditor() {
    const id = $('edit-word-id').value || uid('word');
    const word = normalizeWord({ id, hanzi:$('edit-hanzi').value, pinyin:$('edit-pinyin').value, meaning:$('edit-meaning').value, example:$('edit-example').value, exampleMeaning:$('edit-example-meaning').value, level:$('edit-level').value, topic:$('edit-topic').value, note:$('edit-note').value });
    if (!word.hanzi || !word.meaning) return showToast('Chữ Hán và nghĩa là bắt buộc.');
    const duplicate = vocabulary.find(w => w.id !== id && w.hanzi === word.hanzi && w.pinyin === word.pinyin);
    if (duplicate) return showToast('Từ này đã tồn tại trong kho.');
    const index = vocabulary.findIndex(w => w.id === id);
    if (index >= 0) vocabulary[index] = word; else vocabulary.unshift(word);
    await putOne(STORES.vocabulary, word); closeWordEditor(); renderVocabularyManager(); resetFlashcardSession(); refreshAllUI(); showToast('Đã lưu từ vựng.');
}

async function deleteVocabularyWord(id) {
    const w = vocabulary.find(x => x.id === id); if (!w) return;
    if (!confirm(`Xóa từ ${w.hanzi}?`)) return;
    vocabulary = vocabulary.filter(x => x.id !== id); progressMap.delete(id);
    await deleteOne(STORES.vocabulary,id); await deleteOne(STORES.progress,id);
    renderVocabularyManager(); resetFlashcardSession(); refreshAllUI(); showToast('Đã xóa từ.');
}

const originalSwitchTabV3 = switchTab;
switchTab = function(tabId, button) {
    originalSwitchTabV3(tabId, button);
    if (tabId === 'vocabulary-manager') renderVocabularyManager();
};

const originalNewQuizQuestionV3 = newQuizQuestion;
newQuizQuestion = function() {
    const mode = $('quiz-mode')?.value;
    if (!['hanzi-pinyin','listen-hanzi'].includes(mode)) return originalNewQuizQuestionV3();
    if (!vocabulary.length) return;
    quizWord = pick(vocabulary);
    $('quiz-label').textContent = mode === 'listen-hanzi' ? 'Nghe và chọn chữ Hán đúng' : 'Chọn pinyin đúng';
    $('quiz-prompt').textContent = mode === 'listen-hanzi' ? '🔊 Chạm để nghe' : quizWord.hanzi;
    if (mode === 'listen-hanzi') { $('quiz-prompt').onclick = () => speakText(quizWord.hanzi); setTimeout(()=>speakText(quizWord.hanzi),120); }
    else $('quiz-prompt').onclick = null;
    const choices = shuffle([quizWord, ...shuffle(vocabulary.filter(w=>w.id!==quizWord.id)).slice(0,3)]);
    $('quiz-options').innerHTML = choices.map(w => `<button class="option-btn" onclick="checkQuizOption(this,'${escapeAttribute(w.id)}')">${escapeHtml(mode==='hanzi-pinyin'?w.pinyin:w.hanzi)}</button>`).join('');
    setResult('quiz-result','','');
};

const originalActivityLabelV3 = activityLabel;
activityLabel = function(type) { if(type==='session-complete') return 'Hoàn thành buổi học'; return originalActivityLabelV3(type); };

// Make V3 widgets available immediately after existing initialization.
document.addEventListener('DOMContentLoaded', () => setTimeout(() => { renderV3Today(); renderVocabularyManager(); }, 250));
