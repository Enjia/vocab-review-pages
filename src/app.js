import {
  buildModules,
  getDueEntries,
  getNewEntries,
  getWeakEntries,
  nextReviewDate,
} from "./scheduler.js?v=20260614-modules";
import {
  buildNightPracticePrompt,
  getNightPracticePack,
  loadNightPracticeProgress,
  saveNightPracticeProgress,
} from "./night-practice.js?v=20260614-night-practice";

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
  nightPractice: null,
  selectedNightPackId: "",
  nightPracticeProgress: loadNightPracticeProgress(),
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
  nightPack: document.querySelector("#nightPackSelect"),
  nightStatus: document.querySelector("#nightStatus"),
  nightTitle: document.querySelector("#nightTitle"),
  nightScene: document.querySelector("#nightScene"),
  nightWords: document.querySelector("#nightWords"),
  nightDialogue: document.querySelector("#nightDialogue"),
  nightPrompt: document.querySelector("#nightPrompt"),
  nightCopy: document.querySelector("#nightCopyButton"),
  nightPracticed: document.querySelector("#nightPracticedButton"),
};

init();

async function init() {
  const [wordsResponse, nightPracticeResponse] = await Promise.all([
    fetch("./data/words.json"),
    fetch("./data/night-practice.json"),
  ]);
  state.data = await wordsResponse.json();
  state.nightPractice = await nightPracticeResponse.json();
  state.selectedNightPackId = state.nightPractice.packs[0]?.id || "";
  state.entries = state.data.entries;
  state.modules = buildModules(state.entries);
  populateFilters();
  populateModules();
  populateNightPractice();
  bindEvents();
  applyFilters();
  pickRandom();
  renderNightPractice();
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

function populateNightPractice() {
  els.nightPack.innerHTML = "";
  for (const pack of state.nightPractice.packs) {
    els.nightPack.append(new Option(pack.title, pack.id));
  }
  els.nightPack.value = state.selectedNightPackId;
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

  els.nightPack.addEventListener("input", () => {
    state.selectedNightPackId = els.nightPack.value;
    renderNightPractice();
  });
  els.nightCopy.addEventListener("click", copyNightPracticePrompt);
  els.nightPracticed.addEventListener("click", markNightPracticeDone);
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

function renderNightPractice() {
  const pack = getNightPracticePack(state.nightPractice.packs, state.selectedNightPackId);
  if (!pack) return;
  state.selectedNightPackId = pack.id;
  els.nightPack.value = pack.id;
  els.nightTitle.textContent = pack.title;
  els.nightScene.textContent = pack.scene;
  els.nightWords.innerHTML = pack.targetWords
    .map((word) => `<span>${escapeHtml(word.term)}</span>`)
    .join("");
  els.nightDialogue.innerHTML = pack.turns
    .map(
      (turn, index) => `
        <div class="night-turn">
          <strong>${index + 1}</strong>
          <p><b>User</b>${escapeHtml(turn.user)}</p>
          <p><b>ChatGPT</b>${escapeHtml(turn.chatgpt)}</p>
        </div>
      `,
    )
    .join("");
  els.nightPrompt.value = buildNightPracticePrompt(pack);
  updateNightPracticeStatus(pack);
}

async function copyNightPracticePrompt() {
  const pack = getNightPracticePack(state.nightPractice.packs, state.selectedNightPackId);
  if (!pack) return;
  const prompt = buildNightPracticePrompt(pack);
  els.nightPrompt.value = prompt;
  try {
    await navigator.clipboard.writeText(prompt);
    els.nightStatus.textContent = "Prompt copied";
  } catch {
    els.nightPrompt.select();
    els.nightStatus.textContent = "Select and copy manually";
  }
}

function markNightPracticeDone() {
  const pack = getNightPracticePack(state.nightPractice.packs, state.selectedNightPackId);
  if (!pack) return;
  state.nightPracticeProgress[pack.id] = {
    practicedAt: new Date().toISOString(),
    targetWords: pack.targetWords.map((word) => word.entryId),
  };
  saveNightPracticeProgress(state.nightPracticeProgress);
  updateNightPracticeStatus(pack);
}

function updateNightPracticeStatus(pack) {
  const progress = state.nightPracticeProgress[pack.id];
  els.nightStatus.textContent = progress?.practicedAt ? `Practiced ${formatDate(progress.practicedAt)}` : "Ready for tonight";
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
