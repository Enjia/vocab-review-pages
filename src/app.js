import {
  buildModules,
  getDueEntries,
  getNewEntries,
  getWeakEntries,
  nextReviewDate,
} from "./scheduler.js?v=20260614-modules";
import {
  buildPracticePayload,
  SpeakingCoachClient,
} from "./speaking-coach.js?v=20260614-speaking-coach";

const DAILY_NEW_LIMIT = 20;
const DAILY_DUE_LIMIT = 80;

const state = {
  data: null,
  entries: [],
  modules: [],
  filtered: [],
  current: null,
  revealed: false,
  mode: "today",
  selectedModuleIndex: 0,
  selectedPackIndex: -1,
  progress: loadProgress(),
  speakingCoach: null,
};

const els = {
  search: document.querySelector("#searchInput"),
  type: document.querySelector("#typeFilter"),
  pos: document.querySelector("#posFilter"),
  theme: document.querySelector("#themeFilter"),
  module: document.querySelector("#moduleFilter"),
  pack: document.querySelector("#packFilter"),
  total: document.querySelector("#totalCount"),
  known: document.querySelector("#knownCount"),
  again: document.querySelector("#againCount"),
  due: document.querySelector("#dueCount"),
  new: document.querySelector("#newCount"),
  moduleProgress: document.querySelector("#moduleProgress"),
  filtered: document.querySelector("#filteredCount"),
  deckTitle: document.querySelector("#deckTitle"),
  list: document.querySelector("#wordList"),
  cardType: document.querySelector("#cardType"),
  cardTheme: document.querySelector("#cardTheme"),
  cardTerm: document.querySelector("#cardTerm"),
  answer: document.querySelector("#answerPanel"),
  definition: document.querySelector("#definitionText"),
  examples: document.querySelector("#exampleBlock"),
  links: document.querySelector("#linkBlock"),
  show: document.querySelector("#showAnswerButton"),
  againButton: document.querySelector("#againButton"),
  knownButton: document.querySelector("#knownButton"),
  shuffle: document.querySelector("#shuffleButton"),
  reset: document.querySelector("#resetProgressButton"),
  modeGroup: document.querySelector("#modeGroup"),
  coachStatus: document.querySelector("#coachStatus"),
  coachWords: document.querySelector("#coachWords"),
  coachTranscript: document.querySelector("#coachTranscript"),
  coachStart: document.querySelector("#coachStartButton"),
  coachStop: document.querySelector("#coachStopButton"),
  coachLevel: document.querySelector("#coachLevel"),
  coachEndpoint: document.querySelector("#coachEndpoint"),
  coachAudio: document.querySelector("#coachAudio"),
};

init();

async function init() {
  const response = await fetch("./data/words.json");
  state.data = await response.json();
  state.entries = state.data.entries;
  state.modules = buildModules(state.entries);
  populateFilters();
  populateModules();
  bindEvents();
  applyFilters();
  pickRandom();
}

function populateFilters() {
  fillSelect(els.type, "All types", state.data.facets.expressionTypes);
  fillSelect(els.pos, "All parts", state.data.facets.partsOfSpeech);
  fillSelect(els.theme, "All themes", state.data.facets.themes);
}

function populateModules() {
  els.module.innerHTML = "";
  for (const [index, module] of state.modules.entries()) {
    const label = `${module.title} (${module.entries.length})${module.subtitle ? ` · ${module.subtitle}` : ""}`;
    els.module.append(new Option(label, String(index)));
  }
  renderPackOptions();
}

function renderPackOptions() {
  const module = getSelectedModule();
  els.pack.innerHTML = "";
  els.pack.append(new Option("All packs", "-1"));
  if (!module) return;
  for (const [index, pack] of module.packs.entries()) {
    els.pack.append(new Option(`${pack.title} (${pack.entries.length})`, String(index)));
  }
  els.pack.value = String(state.selectedPackIndex);
}

function fillSelect(select, label, items) {
  select.innerHTML = "";
  select.append(new Option(label, ""));
  for (const item of items) {
    select.append(new Option(`${item.name} (${item.count})`, item.name));
  }
}

function bindEvents() {
  for (const input of [els.search, els.type, els.pos, els.theme]) {
    input.addEventListener("input", () => {
      applyFilters();
      pickRandom();
    });
  }

  els.module.addEventListener("input", () => {
    state.selectedModuleIndex = Number(els.module.value);
    state.selectedPackIndex = -1;
    renderPackOptions();
    setMode("module");
  });

  els.pack.addEventListener("input", () => {
    state.selectedPackIndex = Number(els.pack.value);
    setMode("module");
  });

  els.modeGroup.addEventListener("click", (event) => {
    const button = event.target.closest("button[data-mode]");
    if (!button) return;
    setMode(button.dataset.mode);
  });

  els.show.addEventListener("click", () => {
    if (!state.current) return;
    state.revealed = !state.revealed;
    renderCard();
  });
  document.querySelector("#termButton").addEventListener("click", reveal);
  els.shuffle.addEventListener("click", pickRandom);
  els.knownButton.addEventListener("click", () => markCurrent("known"));
  els.againButton.addEventListener("click", () => markCurrent("again"));
  els.reset.addEventListener("click", () => {
    state.progress = {};
    saveProgress();
    applyFilters();
    pickRandom();
  });

  els.coachEndpoint.value = loadCoachEndpoint();
  els.coachEndpoint.addEventListener("change", () => saveCoachEndpoint(els.coachEndpoint.value));
  els.coachStart.addEventListener("click", startSpeakingCoach);
  els.coachStop.addEventListener("click", stopSpeakingCoach);
}

function setMode(mode) {
  state.mode = mode;
  for (const item of els.modeGroup.querySelectorAll("button")) {
    item.classList.toggle("is-active", item.dataset.mode === mode);
  }
  applyFilters();
  pickRandom();
}

function applyFilters() {
  const base = applyFacetFilters(state.entries);
  const now = new Date();

  if (state.mode === "today") {
    const due = getDueEntries(base, state.progress, now).slice(0, DAILY_DUE_LIMIT);
    const weak = getWeakEntries(base, state.progress, 30);
    const fresh = getNewEntries(base, state.progress, DAILY_NEW_LIMIT);
    state.filtered = uniqueEntries([...due, ...weak, ...fresh]);
    els.deckTitle.textContent = "Today";
  } else if (state.mode === "module") {
    state.filtered = applyFacetFilters(getSelectedEntries());
    els.deckTitle.textContent = getSelectedModule()?.title || "Module";
  } else {
    state.filtered = getWeakEntries(base, state.progress, 120);
    els.deckTitle.textContent = "Weak";
  }

  updateStats(base);
  renderList();
}

function applyFacetFilters(entries) {
  const query = normalize(els.search.value);
  return entries.filter((entry) => {
    if (els.type.value && entry.expressionType !== els.type.value) return false;
    if (els.pos.value && entry.partOfSpeech !== els.pos.value) return false;
    if (els.theme.value && entry.theme !== els.theme.value) return false;

    if (!query) return true;
    return normalize(
      `${entry.term} ${entry.definition} ${entry.theme} ${entry.examples
        .map((example) => example.en)
        .join(" ")}`,
    ).includes(query);
  });
}

function getSelectedEntries() {
  const module = getSelectedModule();
  if (!module) return [];
  if (state.selectedPackIndex === -1) return module.entries;
  return module.packs[state.selectedPackIndex]?.entries || [];
}

function getSelectedModule() {
  return state.modules[state.selectedModuleIndex];
}

function pickRandom() {
  if (!state.filtered.length) {
    renderEmptyCard();
    return;
  }

  const index = Math.floor(Math.random() * state.filtered.length);
  setCurrent(state.filtered[index]);
}

function setCurrent(entry) {
  state.current = entry;
  state.revealed = false;
  renderCard();
  renderList();
}

function reveal() {
  state.revealed = true;
  renderCard();
}

function markCurrent(status) {
  if (!state.current) return;
  const previous = state.progress[state.current.id] || {};
  const reviewCount = status === "known" ? (previous.reviewCount || 0) + 1 : previous.reviewCount || 0;
  state.progress[state.current.id] = {
    status,
    reviewCount,
    updatedAt: new Date().toISOString(),
    dueAt: nextReviewDate(status, reviewCount, new Date()).toISOString(),
  };
  saveProgress();
  applyFilters();
  pickRandom();
}

function renderCard() {
  const entry = state.current;
  if (!entry) {
    renderEmptyCard();
    return;
  }

  const progress = state.progress[entry.id];
  els.cardType.textContent = [entry.expressionType, entry.partOfSpeech].filter(Boolean).join(" / ");
  els.cardTheme.textContent = progress?.dueAt ? `Due ${formatDate(progress.dueAt)}` : entry.theme || "Unseen";
  els.cardTerm.textContent = entry.term;
  els.answer.hidden = !state.revealed;
  els.show.textContent = state.revealed ? "Hide answer" : "Show answer";

  els.definition.textContent = entry.definition || "No definition yet.";
  els.examples.innerHTML = entry.examples
    .slice(0, 3)
    .map(
      (example) => `
        <div class="example">
          <strong>${escapeHtml(example.en)}</strong>
        </div>
      `,
    )
    .join("");
  els.links.textContent = [entry.sourcePath, entry.relatedTerms.length ? `Related: ${entry.relatedTerms.slice(0, 8).join(", ")}` : ""]
    .filter(Boolean)
    .join(" · ");
  renderCoachWords();
}

function renderEmptyCard() {
  state.current = null;
  els.cardType.textContent = "No cards";
  els.cardTheme.textContent = "Adjust filters";
  els.cardTerm.textContent = "No matching entries";
  els.definition.textContent = "";
  els.examples.innerHTML = "";
  els.links.textContent = "";
  els.answer.hidden = true;
  renderCoachWords();
}

function renderList() {
  els.filtered.textContent = `${state.filtered.length.toLocaleString()} cards`;
  const items = state.filtered.slice(0, 120);
  els.list.innerHTML = items
    .map((entry) => {
      const active = state.current?.id === entry.id;
      const progress = state.progress[entry.id];
      return `
        <button class="word-item ${active ? "is-active" : ""}" data-id="${escapeHtml(entry.id)}">
          <strong>${escapeHtml(entry.term)}</strong>
          <span>${escapeHtml(entry.definition || entry.theme || "")}</span>
          <span>${progress ? progressLabel(progress) : "new"}</span>
        </button>
      `;
    })
    .join("");

  for (const button of els.list.querySelectorAll(".word-item")) {
    button.addEventListener("click", () => {
      const entry = state.entries.find((item) => item.id === button.dataset.id);
      if (entry) setCurrent(entry);
    });
  }
}

function updateStats(baseEntries) {
  const values = Object.values(state.progress);
  const selectedEntries = getSelectedEntries();
  const selectedDone = selectedEntries.filter((entry) => state.progress[entry.id]?.status === "known").length;
  const selectedTotal = selectedEntries.length || 0;
  els.total.textContent = state.entries.length.toLocaleString();
  els.known.textContent = values.filter((item) => item.status === "known").length.toLocaleString();
  els.again.textContent = values.filter((item) => item.status === "again").length.toLocaleString();
  els.due.textContent = getDueEntries(baseEntries, state.progress, new Date()).length.toLocaleString();
  els.new.textContent = getNewEntries(baseEntries, state.progress, DAILY_NEW_LIMIT).length.toLocaleString();
  els.moduleProgress.textContent = `${selectedDone}/${selectedTotal}`;
}

function uniqueEntries(entries) {
  const seen = new Set();
  return entries.filter((entry) => {
    if (seen.has(entry.id)) return false;
    seen.add(entry.id);
    return true;
  });
}

async function startSpeakingCoach() {
  try {
    if (!state.speakingCoach) {
      state.speakingCoach = new SpeakingCoachClient({
        backendUrl: els.coachEndpoint.value.trim(),
        remoteAudio: els.coachAudio,
        getPayload: () =>
          buildPracticePayload({
            mode: state.mode,
            module: getSelectedModule(),
            pack: getSelectedPack(),
            current: state.current,
            entries: state.filtered,
            level: els.coachLevel.value,
          }),
        setStatus: setCoachStatus,
        renderTranscript,
      });
    }
    els.coachEndpoint.disabled = true;
    els.coachLevel.disabled = true;
    els.coachStart.disabled = true;
    els.coachStop.disabled = false;
    await state.speakingCoach.start();
  } catch (error) {
    state.speakingCoach?.stop();
    state.speakingCoach = null;
    setCoachStatus(error.message || "Speaking coach failed.");
    resetCoachControls();
  }
}

function stopSpeakingCoach() {
  state.speakingCoach?.stop();
  state.speakingCoach = null;
  resetCoachControls();
}

function resetCoachControls() {
  els.coachEndpoint.disabled = false;
  els.coachLevel.disabled = false;
  els.coachStart.disabled = false;
  els.coachStop.disabled = true;
}

function setCoachStatus(message) {
  els.coachStatus.textContent = message;
}

function renderTranscript(items) {
  els.coachTranscript.innerHTML = items
    .slice(-12)
    .map(
      (item) => `
        <div class="coach-turn">
          <strong>${escapeHtml(item.role)}</strong>
          <span>${escapeHtml(item.text)}</span>
        </div>
      `,
    )
    .join("");
}

function renderCoachWords() {
  const payload = buildPracticePayload({
    mode: state.mode,
    module: getSelectedModule(),
    pack: getSelectedPack(),
    current: state.current,
    entries: state.filtered,
    level: els.coachLevel?.value || "intermediate",
  });
  els.coachWords.innerHTML = payload.words
    .slice(0, 12)
    .map((word) => `<span>${escapeHtml(word.term)}</span>`)
    .join("");
}

function getSelectedPack() {
  const module = getSelectedModule();
  if (!module || state.selectedPackIndex === -1) return null;
  return module.packs[state.selectedPackIndex] || null;
}

function normalize(value) {
  return String(value).toLowerCase().trim();
}

function loadProgress() {
  try {
    return JSON.parse(getStorage()?.getItem("vocab-review-progress") || "{}");
  } catch {
    return {};
  }
}

function saveProgress() {
  try {
    getStorage()?.setItem("vocab-review-progress", JSON.stringify(state.progress));
  } catch {
    // Progress remains available in memory for storage-restricted browsers.
  }
}

function loadCoachEndpoint() {
  try {
    return localStorage.getItem("vocab-speaking-endpoint") || "https://vocab-review-pages.vercel.app/api/realtime-session";
  } catch {
    return "https://vocab-review-pages.vercel.app/api/realtime-session";
  }
}

function saveCoachEndpoint(value) {
  try {
    localStorage.setItem("vocab-speaking-endpoint", value.trim());
  } catch {
    // Endpoint configuration remains in the current input value.
  }
}

function progressLabel(progress) {
  if (progress.status === "again") return "again";
  if (progress.dueAt && new Date(progress.dueAt) <= new Date()) return "due";
  return "known";
}

function formatDate(value) {
  return new Intl.DateTimeFormat("en", { month: "short", day: "numeric" }).format(new Date(value));
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function getStorage() {
  try {
    if (typeof globalThis.localStorage === "undefined") return null;
    return globalThis.localStorage;
  } catch {
    return null;
  }
}
