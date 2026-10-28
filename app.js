const TODAY = todayInTimeZone("Asia/Tokyo");
const LIST_RETURN_KEY = "aso:listUrl";
const googlePhotoCache = new Map();

const state = {
  data: null,
  mode: "events",
  query: "",
  prefecture: "all",
  municipality: "all",
  category: "all",
  age: "all",
  status: "all",
  dateScope: "upcoming",
  sort: "date",
  filtersOpen: false,
  motenashiOnly: false,
  freeOnly: false,
  indoorOnly: false,
  outdoorOnly: false,
  decision: "none",
  visiblePlaceCount: 12,
  resultSetKey: "",
};

const KANTO_PREFECTURES = ["東京都", "神奈川県", "埼玉県", "千葉県", "茨城県", "栃木県", "群馬県"];

let googlePlacesServicePromise = null;
let searchRenderTimer = 0;
const imageHintCache = new Map();

const categoryLabels = {
  contest: "コンテスト",
  craft: "クラフト",
  entertainment: "エンタメ",
  esports: "eスポーツ",
  exhibition: "展示",
  experience: "体験",
  festival: "祭り",
  fireworks: "花火",
  flower: "花・自然",
  food: "食",
  food_festival: "食フェス",
  illumination: "ライトアップ",
  international_exchange: "国際交流",
  kids: "子ども",
  lecture: "講演",
  market: "マルシェ",
  nature: "自然",
  performance: "公演",
  seasonal_display: "季節展示",
  seminar: "セミナー",
  shopping: "買い物",
  sports: "スポーツ",
  stamp_rally: "スタンプラリー",
  tour: "ツアー",
  traditional_performance: "伝統芸能",
  transport: "交通",
  workshop: "講習",
};

const placeTypeLabels = {
  amusement_park: "遊園地",
  animal_cafe: "動物ふれあい",
  animal_indoor_play: "動物・屋内遊び",
  childcare_support: "子育て支援",
  child_center: "児童館",
  craft_workshop: "ものづくり",
  dinosaur_museum: "恐竜・博物館",
  indoor_play: "屋内遊び場",
  indoor_sports: "屋内スポーツ",
  museum: "博物館",
  museum_workshop: "博物館・体験",
  nature_museum: "自然・資料館",
  park: "公園",
  park_indoor_play: "公園・屋内遊び",
  park_science: "公園・科学",
  playground: "遊具広場",
  pool: "プール",
  railway_museum: "鉄道・博物館",
  safari_park: "サファリ",
  science_museum: "科学館",
  theme_park: "テーマパーク",
  water_play_park: "水遊び公園",
};

const eventCategoryGroups = [
  { id: "festival", label: "祭り・花火", members: ["festival", "fireworks", "illumination", "seasonal_display"] },
  { id: "food", label: "食・マルシェ", members: ["market", "food", "food_festival"] },
  { id: "sports", label: "スポーツ", members: ["sports", "esports"] },
  { id: "nature", label: "自然・花", members: ["nature", "flower", "tour"] },
  { id: "experience", label: "体験・子ども", members: ["experience", "workshop", "craft", "kids", "stamp_rally", "contest"] },
  { id: "culture", label: "公演・展示", members: ["performance", "exhibition", "lecture", "seminar", "entertainment", "international_exchange", "traditional_performance", "transport", "shopping"] },
];

const placeTypeGroups = [
  { id: "indoor", label: "屋内遊び", members: ["indoor_play", "park_indoor_play", "animal_indoor_play", "indoor_sports"] },
  { id: "childcare", label: "児童館・子育て", members: ["child_center", "childcare_support"] },
  { id: "park", label: "公園・プール", members: ["park", "playground", "water_play_park", "pool"] },
  { id: "amusement", label: "遊園地", members: ["amusement_park", "theme_park", "safari_park"] },
  { id: "museum", label: "博物館・体験", members: ["museum", "science_museum", "nature_museum", "dinosaur_museum", "railway_museum", "museum_workshop", "park_science", "craft_workshop", "animal_cafe"] },
];

const ageGroups = [
  { id: "infant", label: "乳幼児の記載あり" },
  { id: "preschool", label: "未就学" },
  { id: "elementary", label: "小学生" },
  { id: "general", label: "中高生・一般" },
];

const agePatterns = {
  infant: /乳児|乳幼児|0歳|1歳|2歳|6か月|生後|未就園|よちよち|ベビー|赤ちゃん/,
  preschool: /未就学|就園前|就学前|幼児|保育園|幼稚園|園児|小学校入学前|入学前/,
  elementary: /小学生|小学\d|小学校|児童(?!館)|低学年|高学年|キッズ/,
  general: /中学生|高校生?|中高生|18歳|大学生|大人|一般|小中学生/,
};

const openAgePattern = /年齢制限なし|だれでも|どなたでも|自由利用/;

const els = {};

document.addEventListener("DOMContentLoaded", async () => {
  bindElements();
  bindEvents();

  try {
    await loadOptionalConfig();
    state.data = await loadData();
    prepareAllRecordImages(state.data);
    applyInitialSearchQuery();
    populateFilters();
    render();
    scrollToInitialAnchor();
  } catch (error) {
    renderLoadError(error);
  }
});

function scrollToInitialAnchor() {
  const hash = window.location.hash;
  if (!hash) return;
  const target = document.querySelector(hash);
  if (!target) return;
  requestAnimationFrame(() => {
    target.scrollIntoView({ behavior: "smooth", block: "start" });
  });
}

async function loadOptionalConfig() {
  window.APP_CONFIG = window.APP_CONFIG || {};
}

function applyInitialSearchQuery() {
  const params = new URLSearchParams(window.location.search);

  const decision = params.get("decision");
  if (decision && decision !== "none") {
    applyDecision(decision, { toggle: false, scroll: false, skipRender: true });
  }

  const mode = params.get("mode");
  if (mode === "events" || mode === "places") {
    state.mode = mode;
  }

  const query = params.get("q");
  if (query) {
    state.query = query.trim().toLowerCase();
    els.searchInput.value = query.trim();
  }

  const municipality = params.get("municipality");
  if (municipality) {
    state.municipality = municipality;
  }

  const prefecture = params.get("prefecture");
  if (prefecture) {
    state.prefecture = prefecture;
  }

  const category = params.get("category");
  if (category) {
    state.category = category;
  }

  const age = params.get("age");
  if (age) {
    state.age = age;
  }

  const status = params.get("status");
  if (status) {
    state.status = status;
  }

  const date = params.get("date");
  if (date) {
    state.dateScope = date;
  }

  if (params.has("motenashi")) {
    state.motenashiOnly = params.get("motenashi") === "1";
  }
  if (params.has("free")) {
    state.freeOnly = params.get("free") === "1";
  }
  if (params.has("indoor")) {
    state.indoorOnly = params.get("indoor") === "1";
  }
  if (params.has("outdoor")) {
    state.outdoorOnly = params.get("outdoor") === "1";
  }
  const sort = params.get("sort");
  if (sort === "area" || sort === "type" || sort === "date") state.sort = sort;
  if (state.mode === "places" && !sort) state.sort = "type";
}

function buildListSearchParams() {
  const params = new URLSearchParams();
  if (state.mode !== "events") params.set("mode", state.mode);
  const queryText = els.searchInput?.value?.trim() || "";
  if (queryText) params.set("q", queryText);
  if (state.prefecture !== "all") params.set("prefecture", state.prefecture);
  if (state.municipality !== "all") params.set("municipality", state.municipality);
  if (state.category !== "all") params.set("category", state.category);
  if (state.age !== "all") params.set("age", state.age);
  if (state.status !== "all") params.set("status", state.status);
  if (state.mode === "events" && state.dateScope !== "upcoming") params.set("date", state.dateScope);
  if (state.motenashiOnly) params.set("motenashi", "1");
  if (state.freeOnly) params.set("free", "1");
  if (state.indoorOnly) params.set("indoor", "1");
  if (state.outdoorOnly) params.set("outdoor", "1");
  if (state.sort !== (state.mode === "places" ? "type" : "date")) params.set("sort", state.sort);
  return params;
}

function listReturnPath() {
  const search = buildListSearchParams().toString();
  return `/${search ? `?${search}` : ""}#eventList`;
}

function rememberListReturnUrl() {
  try {
    sessionStorage.setItem(LIST_RETURN_KEY, listReturnPath());
  } catch (_error) {
    // ignore quota / private mode
  }
}

function syncStateToUrl() {
  const params = buildListSearchParams();
  const search = params.toString();
  const next = `${window.location.pathname}${search ? `?${search}` : ""}${window.location.hash}`;
  const current = `${window.location.pathname}${window.location.search}${window.location.hash}`;
  if (next !== current) {
    history.replaceState(null, "", next);
  }
  rememberListReturnUrl();
}

async function loadData() {
  if (window.EVENT_DATA) {
    return window.EVENT_DATA;
  }
  const response = await fetch("./data/events.json");
  if (!response.ok) {
    throw new Error(`データを読み込めませんでした: ${response.status}`);
  }
  return response.json();
}

function renderLoadError(error) {
  console.error(error);
  els.eventList.innerHTML = `
    <div class="empty-state">
      データを読み込めませんでした。ローカルで開く場合は同梱の data/events.js を確認してください。
    </div>
  `;
}

function bindElements() {
  [
    "modeEventsButton",
    "modePlacesButton",
    "filterToggleButton",
    "filterBody",
    "searchInput",
    "prefectureSelect",
    "municipalitySelect",
    "ageSelect",
    "categoryFieldLabel",
    "categorySelect",
    "decisionLabel",
    "resultsTitle",
    "resultCount",
    "dataUpdated",
    "sortSelect",
    "resetButton",
    "dateChips",
    "decisionChips",
    "ageChips",
    "categoryChips",
    "listContext",
    "eventList",
  ].forEach((id) => {
    els[id] = document.getElementById(id);
  });
}

function bindEvents() {
  els.filterToggleButton.addEventListener("click", () => {
    state.filtersOpen = !state.filtersOpen;
    updateFilterVisibility();
  });

  [els.modeEventsButton, els.modePlacesButton].forEach((button) => {
    button.addEventListener("click", () => {
      state.mode = button.dataset.mode;
      state.category = "all";
      state.age = "all";
      state.prefecture = "all";
      state.municipality = "all";
      state.indoorOnly = false;
      state.outdoorOnly = false;
      state.freeOnly = false;
      state.status = "all";
      state.motenashiOnly = false;
      state.decision = "none";
      state.dateScope = "upcoming";
      state.sort = state.mode === "places" ? "type" : "date";
      els.modeEventsButton.classList.toggle("is-active", state.mode === "events");
      els.modePlacesButton.classList.toggle("is-active", state.mode === "places");
      populateFilters();
      render();
    });
  });

  els.searchInput.addEventListener("input", (event) => {
    state.query = event.target.value.trim().toLowerCase();
    window.clearTimeout(searchRenderTimer);
    searchRenderTimer = window.setTimeout(() => {
      render();
    }, 120);
  });

  els.prefectureSelect.addEventListener("change", (event) => {
    setPrefecture(event.target.value, { scroll: false });
  });

  els.municipalitySelect.addEventListener("change", (event) => {
    const value = event.target.value;
    if (value === "all") {
      setMunicipality("all", { scroll: false });
      return;
    }
    const [prefecture, municipality] = value.split("::");
    setLocationFilter(prefecture, municipality, { scroll: false });
  });

  els.ageSelect.addEventListener("change", (event) => {
    state.age = event.target.value;
    render();
  });

  els.categorySelect.addEventListener("change", (event) => {
    state.category = event.target.value;
    render();
  });

  els.sortSelect.addEventListener("change", (event) => {
    state.sort = event.target.value;
    render();
  });

  els.dateChips.addEventListener("click", (event) => {
    const button = event.target.closest("[data-date-scope]");
    if (!button) return;
    state.decision = "none";
    setDateScope(button.dataset.dateScope);
  });

  els.decisionChips.addEventListener("click", (event) => {
    const button = event.target.closest("[data-decision]");
    if (!button) return;
    applyDecision(button.dataset.decision);
  });

  els.ageChips.addEventListener("click", (event) => {
    const button = event.target.closest("[data-age]");
    if (!button) return;
    state.decision = "none";
    state.age = button.dataset.age;
    els.ageSelect.value = state.age;
    render();
  });

  els.categoryChips.addEventListener("click", (event) => {
    const button = event.target.closest("[data-category]");
    if (!button) return;
    state.decision = "none";
    state.category = button.dataset.category;
    els.categorySelect.value = state.category;
    render();
  });

  els.resetButton.addEventListener("click", resetFilters);

  els.listContext.addEventListener("click", (event) => {
    if (event.target.closest("[data-clear-all]")) {
      resetFilters();
      return;
    }
    const chip = event.target.closest("[data-clear-filter]");
    if (chip) clearFilter(chip.dataset.clearFilter);
  });

  els.eventList.addEventListener("click", (event) => {
    if (event.target.closest("[data-show-more-places]")) {
      state.visiblePlaceCount += 12;
      render();
      return;
    }
    const action = event.target.closest("[data-empty-action]")?.dataset.emptyAction;
    if (action === "reset") resetFilters();
    if (action === "all-dates") {
      state.dateScope = "all";
      state.decision = "none";
      render();
    }
    if (action === "expand-area") {
      state.prefecture = "all";
      state.municipality = "all";
      populateMunicipalities();
      render();
    }
  });
}

function resetFilters() {
  state.query = "";
  state.prefecture = "all";
  state.municipality = "all";
  state.category = "all";
  state.age = "all";
  state.status = "all";
  state.dateScope = "upcoming";
  state.sort = state.mode === "places" ? "type" : "date";
  state.motenashiOnly = false;
  state.freeOnly = false;
  state.indoorOnly = false;
  state.outdoorOnly = false;
  state.decision = "none";
  state.visiblePlaceCount = 12;
  els.searchInput.value = "";
  populateFilters();
  render();
}

function clearFilter(filter) {
  const clearers = {
    query: () => { state.query = ""; els.searchInput.value = ""; },
    prefecture: () => { state.prefecture = "all"; state.municipality = "all"; },
    municipality: () => { state.municipality = "all"; },
    date: () => { state.dateScope = "upcoming"; },
    category: () => { state.category = "all"; },
    age: () => { state.age = "all"; },
    status: () => { state.status = "all"; },
    free: () => { state.freeOnly = false; },
    indoor: () => { state.indoorOnly = false; },
    outdoor: () => { state.outdoorOnly = false; },
    motenashi: () => { state.motenashiOnly = false; },
  };
  clearers[filter]?.();
  state.decision = "none";
  populateFilters();
  render();
}

function setMunicipality(name, { scroll = false } = {}) {
  state.municipality = name || "all";
  populateMunicipalities();
  render();
  if (scroll && state.municipality !== "all") {
    document.getElementById("eventList")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }
}

function setPrefecture(name, { scroll = false } = {}) {
  state.prefecture = name || "all";
  state.municipality = "all";
  populateMunicipalities();
  render();
  if (scroll && state.prefecture !== "all") {
    document.getElementById("eventList")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }
}

function setLocationFilter(prefecture, municipality, { scroll = false } = {}) {
  state.prefecture = prefecture || "all";
  state.municipality = municipality || "all";
  if (els.prefectureSelect) els.prefectureSelect.value = state.prefecture;
  populateMunicipalities();
  render();
  if (scroll && (state.prefecture !== "all" || state.municipality !== "all")) {
    document.getElementById("eventList")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }
}

function syncLocationSelects() {
  if (els.prefectureSelect) els.prefectureSelect.value = state.prefecture;
  if (els.municipalitySelect) {
    els.municipalitySelect.value = state.municipality === "all"
      ? "all"
      : `${state.prefecture}::${state.municipality}`;
  }
}

function setDateScope(scope) {
  state.dateScope = scope || "upcoming";
  render();
}

function updateFilterVisibility() {
  els.filterBody.classList.toggle("is-open", state.filtersOpen);
  els.filterToggleButton.setAttribute("aria-expanded", String(state.filtersOpen));
  els.filterToggleButton.innerHTML = state.filtersOpen
    ? `${uiIcon("sliders")}条件を閉じる`
    : `${uiIcon("sliders")}詳しい条件`;
}

function populateFilters() {
  const groups = currentCategoryGroups();
  els.categoryFieldLabel.innerHTML =
    state.mode === "events"
      ? `${uiIcon("tag")}カテゴリ`
      : `${uiIcon("tag")}種別`;

  const options = [["all", "すべて"]].concat(groups.map((group) => [group.id, group.label]));
  if (state.category !== "all" && !options.some(([value]) => value === state.category)) {
    state.category = "all";
  }
  fillSelect(els.categorySelect, options);
  els.categorySelect.value = state.category;

  fillSelect(
    els.ageSelect,
    [["all", "すべて"]].concat(ageGroups.map((group) => [group.id, group.label]))
  );
  els.ageSelect.value = state.age;
  populatePrefectures();
  populateMunicipalities();
}

function populatePrefectures() {
  const available = new Set(allRecords().map((record) => record.prefecture).filter(Boolean));
  const prefectures = KANTO_PREFECTURES.filter((name) => available.has(name));
  available.forEach((name) => {
    if (!prefectures.includes(name)) prefectures.push(name);
  });
  if (state.prefecture !== "all" && !prefectures.includes(state.prefecture)) {
    prefectures.push(state.prefecture);
  }
  fillSelect(
    els.prefectureSelect,
    [["all", "掲載エリアすべて"]].concat(prefectures.map((name) => [name, name]))
  );
  els.prefectureSelect.value = state.prefecture;
}

function populateMunicipalities() {
  const pairs = currentRecords()
    .filter((record) => state.prefecture === "all" || record.prefecture === state.prefecture)
    .filter((record) => record.prefecture && record.municipality)
    .map((record) => ({ prefecture: record.prefecture, municipality: record.municipality }));
  const uniquePairs = Array.from(
    new Map(pairs.map((item) => [`${item.prefecture}::${item.municipality}`, item])).values()
  ).sort((a, b) =>
    (KANTO_PREFECTURES.indexOf(a.prefecture) - KANTO_PREFECTURES.indexOf(b.prefecture)) ||
    a.prefecture.localeCompare(b.prefecture, "ja") ||
    a.municipality.localeCompare(b.municipality, "ja")
  );
  if (state.municipality !== "all") {
    const matching = uniquePairs.filter((item) => item.municipality === state.municipality);
    if (state.prefecture === "all" && matching.length) {
      const legacyMatch = matching.find((item) => item.prefecture === "群馬県") || matching[0];
      state.prefecture = legacyMatch.prefecture;
    }
    const selectedKey = `${state.prefecture}::${state.municipality}`;
    if (!uniquePairs.some((item) => `${item.prefecture}::${item.municipality}` === selectedKey)) {
      uniquePairs.push({ prefecture: state.prefecture, municipality: state.municipality });
    }
  }
  fillSelect(
    els.municipalitySelect,
    [["all", "すべて"]].concat(uniquePairs.map((item) => [
      `${item.prefecture}::${item.municipality}`,
      state.prefecture === "all" ? `${item.prefecture} ${item.municipality}` : item.municipality,
    ]))
  );
  syncLocationSelects();
}

function fillSelect(select, options) {
  select.innerHTML = options
    .map(([value, label]) => `<option value="${escapeHtml(value)}">${escapeHtml(label)}</option>`)
    .join("");
}

function render() {
  const records = filteredRecords();
  const sorted = sortRecords(records);

  document.body.dataset.mode = state.mode;
  document.body.dataset.prefecture = state.prefecture;
  if (els.searchInput) {
    els.searchInput.placeholder = state.mode === "events"
      ? "イベント名・会場・地域"
      : "施設名・地域・特徴";
  }
  if (els.resultsTitle) {
    const scopeLabels = { upcoming: "開催予定", all: "全期間", weekend: "今週末", month: "今月", past: "過去のイベント" };
    els.resultsTitle.textContent = state.mode === "events" ? (scopeLabels[state.dateScope] || "イベント") : "遊び場";
  }
  if (els.resultCount) {
    const noun = state.mode === "events" ? "件" : "施設";
    els.resultCount.textContent = `${sorted.length.toLocaleString("ja-JP")}${noun}`;
  }
  if (state.mode === "places" && state.sort !== "area" && state.sort !== "type") state.sort = "type";
  if (state.mode === "events" && state.sort !== "area" && state.sort !== "date") state.sort = "date";
  if (els.dataUpdated) {
    const updatedAt = state.data?.meta?.generated_at;
    const dateLabel = updatedAt ? updatedAt.replaceAll("-", "/") : "未設定";
    els.dataUpdated.textContent = `データ更新 ${dateLabel} · 営業・開催状況は詳細ページの公式情報をご確認ください`;
  }
  renderSortControl();
  if (els.decisionLabel) els.decisionLabel.textContent = state.mode === "events" ? "こだわり" : "遊び場の特徴";
  els.modeEventsButton.classList.toggle("is-active", state.mode === "events");
  els.modePlacesButton.classList.toggle("is-active", state.mode === "places");
  renderDecisionChips();
  renderDateChips();
  renderAgeChips();
  renderCategoryChips();
  renderListContext();
  renderList(sorted);
  syncStateToUrl();
}

function applyDecision(decision, { toggle = true, scroll = true, skipRender = false } = {}) {
  const nextValue = (current) => toggle ? !current : true;
  if (decision === "weekend") {
    state.mode = "events";
    state.dateScope = toggle && state.dateScope === "weekend" ? "upcoming" : "weekend";
  } else if (decision === "rain" || decision === "outdoor") {
    state.mode = "places";
    state.sort = "type";
    const key = decision === "rain" ? "indoorOnly" : "outdoorOnly";
    state[key] = nextValue(state[key]);
  } else if (decision === "free") {
    state.freeOnly = nextValue(state.freeOnly);
  } else if (decision === "infant") {
    state.age = toggle && state.age === "infant" ? "all" : "infant";
  } else if (decision === "verified") {
    state.status = toggle && state.status === "verified" ? "all" : "verified";
  } else if (decision === "motenashi") {
    state.mode = "events";
    state.prefecture = "群馬県";
    state.motenashiOnly = nextValue(state.motenashiOnly);
    state.municipality = "all";
  }
  if (!skipRender && state.data) {
    populateFilters();
    render();
  }
  if (!skipRender && scroll) {
    document.getElementById("eventList")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }
}

function renderDecisionChips() {
  if (!els.decisionChips) return;
  const chips = state.mode === "events"
    ? [
        ["free", "無料の記載あり", "yen"],
        ["infant", "乳幼児の記載あり", "baby"],
        ["verified", "公式確認済み", "check"],
      ]
    : [
        ["rain", "屋内", "home"],
        ["outdoor", "屋外", "sun"],
        ["free", "無料の記載あり", "yen"],
        ["infant", "乳幼児の記載あり", "baby"],
        ["verified", "公式確認済み", "check"],
      ];
  const active = {
    free: state.freeOnly, infant: state.age === "infant", verified: state.status === "verified",
    rain: state.indoorOnly, outdoor: state.outdoorOnly,
  };
  els.decisionChips.innerHTML = chips
    .map(
      ([value, label, icon]) =>
        `<button type="button" class="chip decision-chip ${active[value] ? "is-active" : ""}" data-decision="${value}" aria-pressed="${Boolean(active[value])}">${uiIcon(icon)}${label}</button>`
    )
    .join("");
}

function renderSortControl() {
  const options = state.mode === "events"
    ? [["date", "開催日順"], ["area", "地域順"]]
    : [["type", "種別順"], ["area", "地域順"]];
  if (!options.some(([value]) => value === state.sort)) state.sort = options[0][0];
  els.sortSelect.innerHTML = options
    .map(([value, label]) => `<option value="${value}">${label}</option>`)
    .join("");
  els.sortSelect.value = state.sort;
}

function weekendDateLabel() {
  const { start, end } = weekendRange();
  return start === end
    ? `今週末 ${formatDateCompact(start, { includeYear: false })}`
    : `今週末 ${formatDateCompact(start, { includeYear: false })}〜${formatDateCompact(end, { includeYear: false })}`;
}

function renderListContext() {
  if (!els.listContext) return;
  const filters = [];
  const add = (key, label) => filters.push(`<button type="button" class="active-filter" data-clear-filter="${key}">${escapeHtml(label)}<span aria-hidden="true">×</span><span class="sr-only">を解除</span></button>`);
  if (state.query) add("query", `検索: ${els.searchInput?.value?.trim() || state.query}`);
  if (state.prefecture !== "all") add("prefecture", state.prefecture);
  if (state.municipality !== "all") add("municipality", state.municipality);
  if (state.mode === "events" && state.dateScope !== "upcoming") {
    const labels = { all: "全期間", weekend: weekendDateLabel(), month: "今月", past: "過去" };
    add("date", labels[state.dateScope] || state.dateScope);
  }
  if (state.age !== "all") {
    const age = ageGroups.find((group) => group.id === state.age);
    if (age) add("age", age.label);
  }
  if (state.category !== "all") {
    const group = currentCategoryGroups().find((item) => item.id === state.category);
    if (group) add("category", group.label);
  }
  if (state.status !== "all") add("status", "公式確認済み");
  if (state.freeOnly) add("free", "無料の記載あり");
  if (state.indoorOnly) add("indoor", "屋内");
  if (state.outdoorOnly) add("outdoor", "屋外");
  if (state.motenashiOnly) add("motenashi", "もてなし広場");

  if (!filters.length) {
    els.listContext.hidden = true;
    els.listContext.innerHTML = "";
    return;
  }
  els.listContext.hidden = false;
  els.listContext.innerHTML = `<span class="active-filter-label">絞り込み中</span>${filters.join("")}<button type="button" class="clear-filters" data-clear-all>すべて解除</button>`;
}

function renderDateChips() {
  if (state.mode !== "events") {
    els.dateChips.innerHTML = "";
    els.dateChips.hidden = true;
    return;
  }
  els.dateChips.hidden = false;
  const scopes = [
    ["all", "全期間", "list"],
    ["upcoming", "開催予定", "ticket"],
    ["weekend", "今週末", "calendar"],
    ["month", "今月", "calendar"],
    ["past", "過去", "clock"],
  ];
  els.dateChips.innerHTML = scopes
    .map(
      ([value, label, icon]) =>
        `<button type="button" class="chip ${state.dateScope === value ? "is-active" : ""}" data-date-scope="${value}">${uiIcon(icon)}${label}</button>`
    )
    .join("");
}

function renderAgeChips() {
  const counts = new Map(ageGroups.map((group) => [group.id, 0]));
  recordsExceptAge().forEach((record) => {
    detectAgeTags(record).forEach((tag) => {
      counts.set(tag, (counts.get(tag) || 0) + 1);
    });
  });

  const chips = [
    `<button type="button" class="chip ${state.age === "all" ? "is-active" : ""}" data-age="all">${uiIcon("users")}すべて</button>`,
  ].concat(
    ageGroups
      .filter((group) => state.age === group.id || (counts.get(group.id) || 0) > 0)
      .map((group) => {
        const count = counts.get(group.id) || 0;
        const icon = group.id === "infant" || group.id === "baby" ? "baby" : "users";
        return `<button type="button" class="chip ${state.age === group.id ? "is-active" : ""}" data-age="${escapeHtml(group.id)}">${uiIcon(icon)}${escapeHtml(group.label)}<em>${count}</em></button>`;
      })
  );
  els.ageChips.innerHTML = chips.join("");
}

function renderCategoryChips() {
  const groups = currentCategoryGroups();
  const key = state.mode === "events" ? "category" : "place_type";
  const counts = new Map(groups.map((group) => [group.id, 0]));

  recordsExceptCategory().forEach((record) => {
    const value = record[key];
    if (!value) return;
    const group = groups.find((item) => item.members.includes(value));
    if (!group) return;
    counts.set(group.id, (counts.get(group.id) || 0) + 1);
  });

  const chips = [
    `<button type="button" class="chip ${state.category === "all" ? "is-active" : ""}" data-category="all">${uiIcon("tag")}すべて</button>`,
  ].concat(
    groups
      .filter((group) => (counts.get(group.id) || 0) > 0)
      .map((group) => {
        const count = counts.get(group.id) || 0;
        return `<button type="button" class="chip ${state.category === group.id ? "is-active" : ""}" data-category="${escapeHtml(group.id)}">${uiIcon("tag")}${escapeHtml(group.label)}<em>${count}</em></button>`;
      })
  );
  els.categoryChips.innerHTML = chips.join("");
}

function currentCategoryGroups() {
  return state.mode === "events" ? eventCategoryGroups : placeTypeGroups;
}

function matchesSelectedCategory(value) {
  if (state.category === "all") return true;
  const group = currentCategoryGroups().find((item) => item.id === state.category);
  if (group) return group.members.includes(value);
  return value === state.category;
}

function recordsExceptCategory() {
  const saved = state.category;
  state.category = "all";
  const records = filteredRecords();
  state.category = saved;
  return records;
}

function recordsExceptAge() {
  const saved = state.age;
  state.age = "all";
  const records = filteredRecords();
  state.age = saved;
  return records;
}

function ageSearchText(record) {
  if (record.place_type != null || record.target_age_note != null) {
    return [
      record.target_age_note,
      record.features,
      record.name,
      record.place_type,
    ]
      .filter(Boolean)
      .join(" ");
  }
  return [
    record.title,
    record.summary,
    record.notes,
    record.category,
    categoryLabels[record.category] || "",
  ]
    .filter(Boolean)
    .join(" ");
}

function detectAgeTags(record) {
  const text = ageSearchText(record);
  const tags = new Set(
    ageGroups.map((group) => group.id).filter((id) => agePatterns[id].test(text))
  );

  if (openAgePattern.test(text)) {
    return ageGroups.map((group) => group.id);
  }

  if (record.category === "kids") {
    tags.add("preschool");
    tags.add("elementary");
  }

  if (!tags.size) {
    // イベントは年齢記載が少ないため、明示がないものは中高生・一般扱い
    if (record.start_date || record.title) return ["general"];
    return [];
  }

  return Array.from(tags);
}

function matchesAgeGroup(record) {
  if (state.age === "all") return true;
  return detectAgeTags(record).includes(state.age);
}

function renderList(records) {
  const resultSetKey = `${state.mode}:${records.map((record) => record.id).join("|")}`;
  if (resultSetKey !== state.resultSetKey) {
    state.resultSetKey = resultSetKey;
    state.visiblePlaceCount = 12;
  }

  if (records.length === 0) {
    const hasCustomFilter = state.query || state.prefecture !== "all" || state.municipality !== "all" ||
      state.category !== "all" || state.age !== "all" || state.status !== "all" || state.freeOnly ||
      state.indoorOnly || state.outdoorOnly || state.motenashiOnly || (state.mode === "events" && state.dateScope !== "upcoming");
    const actions = [];
    if (state.mode === "events" && state.dateScope === "upcoming") {
      actions.push(`<button class="empty-action" type="button" data-empty-action="all-dates">全期間で見る</button>`);
    }
    if (state.prefecture !== "all" || state.municipality !== "all") {
      actions.push(`<button class="empty-action" type="button" data-empty-action="expand-area">地域を広げる</button>`);
    }
    if (hasCustomFilter) actions.push(`<button class="empty-action" type="button" data-empty-action="reset">条件をすべて解除</button>`);
    els.eventList.innerHTML = `
      <div class="empty-state">
        <strong>条件に合う${state.mode === "events" ? "イベント" : "遊び場"}が見つかりません</strong>
        <p>地域や日程、キーワードを変えると見つかる場合があります。</p>
        ${actions.length ? `<div class="empty-state__actions">${actions.join("")}</div>` : ""}
      </div>`;
    return;
  }

  const cardFn = state.mode === "events" ? eventCard : placeCard;
  if (state.mode === "events" && state.sort === "date") {
    const groups = new Map();
    records.forEach((record) => {
      const key = groupKey(record);
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(record);
    });
    const firstUpcoming = Array.from(groups.keys()).find((key) => key !== "開催中") || "開催中";
    const entries = Array.from(groups.entries());
    if (state.dateScope === "weekend") {
      entries.sort(([a], [b]) => Number(a === "開催期間が長いイベント") - Number(b === "開催期間が長いイベント"));
    }
    els.eventList.innerHTML = entries
      .map(([key, items]) => renderDateGroup(key, items, cardFn, key === firstUpcoming))
      .join("");
  } else {
    const visibleRecords = state.mode === "places" ? records.slice(0, state.visiblePlaceCount) : records;
    const remaining = records.length - visibleRecords.length;
    els.eventList.innerHTML = visibleRecords.map(cardFn).join("");
    if (remaining > 0) {
      els.eventList.insertAdjacentHTML("beforeend", `
        <div class="more-results">
          <p>${visibleRecords.length.toLocaleString("ja-JP")} / ${records.length.toLocaleString("ja-JP")}施設を表示中</p>
          <button type="button" class="load-more-button" data-show-more-places>さらに12施設を見る（残り${remaining.toLocaleString("ja-JP")}施設）</button>
        </div>
      `);
    }
  }

  hydrateGooglePhotoTargets(els.eventList);
}

function renderDateGroup(key, items, cardFn, isFirstUpcoming = false) {
  const cards = items.map(cardFn).join("");
  const count = items.length;
  const isMonth = /^\d{4}-\d{2}$/.test(key);
  const collapseByDefault = state.dateScope !== "weekend" && !isFirstUpcoming && (key === "開催中" || isMonth);

  if (!collapseByDefault) {
    return `${dateGroupHeadingHtml(key, count)}${cards}`;
  }

  return `
    <details class="date-group">
      <summary class="date-group-heading date-group-toggle">
        <span class="date-group-toggle__label">${uiIcon("calendar")}${escapeHtml(monthHeading(key))}</span>
        <span class="date-group-toggle__meta"><em>${count}件</em><i class="ui-icon ui-icon--chevron" aria-hidden="true"></i></span>
      </summary>
      <div class="date-group-body">${cards}</div>
    </details>
  `;
}

function dateGroupHeadingHtml(key, count) {
  if (/^\d{4}-\d{2}$/.test(key)) {
    const [year, month] = key.split("-");
    return `
      <h3 class="date-group-heading date-group-heading--month">
        <span class="date-group-heading__main">
          ${uiIcon("calendar")}
          <span class="date-group-heading__year">${escapeHtml(year)}</span>
          <span class="date-group-heading__month">${Number(month)}<small>月</small></span>
        </span>
        <span class="date-group-heading__count">${count}件</span>
      </h3>
    `;
  }

  return `
    <h3 class="date-group-heading date-group-heading--label">
      <span class="date-group-heading__main">${uiIcon("calendar")}${escapeHtml(monthHeading(key))}</span>
      <span class="date-group-heading__count">${count}件</span>
    </h3>
  `;
}

function eventCard(event) {
  const time = [event.start_time, event.end_time].filter(Boolean).join(" - ");
  const displayImage = bestThumbImage(event);
  const thumbnail = (event.images || []).find((item) => item && item.image_url === displayImage);
  const image = mediaThumb(
    displayImage,
    thumbnail?.alt_text || event.title,
    displayImage ? categoryLabel(event.category) : "公式写真未掲載",
    event.images,
    event
  );
  const venue = event.venue_name || event.area_label || "";
  const placeLine = [formatRecordLocation(event), venue].filter(Boolean).join(" / ");
  const dateLabel = eventDateRangeLabel(event);

  return `
    <a class="event-card event-card--event has-image ${isCandidate(event) ? "is-candidate" : ""}" href="${escapeHtml(recordPageHref(event, "event"))}">
      ${image}
      <div class="event-main">
        <div class="event-card__topline">
          <span class="pill category">${uiIcon("tag")}${escapeHtml(categoryLabel(event.category))}</span>
          ${statusPill(event)}
        </div>
        <h3 class="event-title">${escapeHtml(event.title)}</h3>
        <p class="event-card__facts">
          <span class="meta-item">${uiIcon("calendar")}${escapeHtml(dateLabel)}</span>
          ${time ? `<span class="meta-item">${uiIcon("clock")}${escapeHtml(time)}</span>` : ""}
          <span class="meta-item event-card__location">${uiIcon("pin")}${escapeHtml(placeLine || "地域未設定")}</span>
        </p>
        ${event.summary ? `<p class="event-card__summary">${escapeHtml(compactText(event.summary, 100))}</p>` : ""}
        ${event.reservation_note ? `<p class="record-note"><strong>予約：</strong>${escapeHtml(compactText(event.reservation_note, 68))}</p>` : ""}
        <div class="event-card__bottom"><span class="event-card__fee">${uiIcon("yen")}${escapeHtml(displayOrConfirm(compactText(event.price_note, 52)))}</span></div>
        ${cardImageCredit(event, displayImage)}
      </div>
    </a>
  `;
}

function placeCard(place) {
  const displayImage = bestThumbImage(place);
  const image = mediaThumb(displayImage, place.name, placeTypeLabel(place.place_type), place.images, place);
  const indoorOutdoor = indoorOutdoorLabel(place.indoor_outdoor);
  return `
    <a class="event-card event-card--place has-image ${isCandidate(place) ? "is-candidate" : ""}" href="${escapeHtml(recordPageHref(place, "place"))}">
      ${image}
      <div class="event-main">
        <div class="event-card__topline">
          <span class="pill category">${uiIcon("tag")}${escapeHtml(placeTypeLabel(place.place_type))}</span>
          ${indoorOutdoor ? `<span class="pill neutral">${escapeHtml(indoorOutdoor)}</span>` : ""}
          ${statusPill(place)}
        </div>
        <h3 class="event-title">${escapeHtml(place.name)}</h3>
        <p class="event-card__facts">
          <span class="meta-item">${uiIcon("pin")}${escapeHtml(formatRecordLocation(place) || "地域未設定")}</span>
          ${place.target_age_note ? `<span class="meta-item event-card__place-target">対象：${escapeHtml(compactText(place.target_age_note, 72))}</span>` : ""}
        </p>
        <p class="event-card__place-hours">${uiIcon("clock")}<span>${escapeHtml(compactText(place.hours_note || "利用時間は公式案内をご確認ください", 90))}</span></p>
        ${place.closed_note ? `<p class="event-card__place-closed"><strong>休館：</strong>${escapeHtml(compactText(place.closed_note, 76))}</p>` : ""}
        <p class="event-card__summary">${escapeHtml(compactText(place.features || "施設の設備や利用条件は詳細をご確認ください", 100))}</p>
        ${place.reservation_note ? `<p class="record-note"><strong>予約：</strong>${escapeHtml(compactText(place.reservation_note, 68))}</p>` : ""}
        <div class="event-card__bottom"><span class="event-card__fee">${uiIcon("yen")}${escapeHtml(displayOrConfirm(compactText(place.price_note, 52)))}</span></div>
        ${cardImageCredit(place, displayImage)}
      </div>
    </a>
  `;
}

function cardImageCredit(record, url) {
  const image = (record.images || []).find((item) => item.image_url === url && item.reference_photo);
  if (!image) return "";
  const attribution = [image.title, image.credit, image.license_note].filter(Boolean).join(" / ");
  return `<p class="card-image-credit">会場・施設の参考写真（トリミングあり）：${escapeHtml(attribution)}。出典・ライセンスは詳細へ</p>`;
}

function eventDateRangeLabel(event) {
  const start = event.start_date;
  const end = event.end_date || start;
  if (!start) return "日程未定";
  if (!end || end === start) return formatMonthDay(start);
  return `${formatMonthDay(start)}〜${formatMonthDay(end)}`;
}

function recordPageHref(record, kind) {
  const folder = kind === "place" ? "places" : "events";
  return `./${folder}/${encodeURIComponent(record.id)}.html`;
}

function displayOrConfirm(value) {
  const text = String(value || "").trim();
  return text || "公式で確認";
}

function compactText(value, limit = 40) {
  const text = String(value || "").replace(/\s+/g, " ").trim();
  if (!text) return "";
  if (text.length <= limit) return text;
  return `${text.slice(0, limit - 1).trim()}…`;
}

function formatDateCompact(value, { includeYear = true } = {}) {
  if (!value) return "";
  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) return formatDate(value);
  const week = ["日", "月", "火", "水", "木", "金", "土"][new Date(Date.UTC(year, month - 1, day)).getUTCDay()];
  if (!includeYear) return `${month}/${day}（${week}）`;
  return `${year}/${month}/${day}（${week}）`;
}

function mediaThumb(url, alt, fallbackLabel, images = [], record = {}) {
  const googlePlaceId = !url && googlePhotoCandidate(record) ? record.google_place_id : "";
  const candidates = url
    ? [url, ...collectImageCandidates(record).map((item) => item.url).filter((candidate) => candidate !== url)].slice(0, 5)
    : [];
  return `
    <div class="media-thumb ${url ? "" : googlePlaceId ? "is-google-pending" : "is-empty"}" ${googlePlaceId ? `data-google-place-id="${escapeHtml(googlePlaceId)}" data-google-photo-alt="${escapeHtml(alt)}"` : ""}>
      <span>写真準備中</span>
      ${url ? `<img src="${escapeHtml(url)}" alt="" loading="lazy" decoding="async" referrerpolicy="no-referrer" data-image-candidates="${escapeHtml(JSON.stringify(candidates))}" data-image-index="0" onload="this.closest('.media-thumb').classList.add('is-loaded');if(this.naturalWidth<180)this.closest('.media-thumb').classList.add('is-lowres')" onerror="retryCardImage(this)">` : ""}
    </div>
  `;
}

function retryCardImage(image) {
  const target = image.closest(".media-thumb");
  const candidates = JSON.parse(image.dataset.imageCandidates || "[]");
  const next = Number(image.dataset.imageIndex || 0) + 1;
  if (next < candidates.length) {
    image.dataset.imageIndex = String(next);
    image.src = candidates[next];
    return;
  }
  target.classList.remove("is-loaded");
  target.classList.add("is-failed");
  const label = target.querySelector("span");
  if (label) label.textContent = "画像を表示できません";
}

function upgradeImageUrl(url = "") {
  if (!url) return "";
  const match = url.match(/-(\d{2,4})x(\d{2,4})(?=\.(?:jpe?g|png|webp|gif)(?:\?|$))/i);
  if (!match) return url;
  if (Math.max(Number(match[1]), Number(match[2])) >= 800) return url;
  return url.replace(/-(\d{2,4})x(\d{2,4})(?=\.(?:jpe?g|png|webp|gif)(?:\?|$))/i, "");
}

function imageBasename(url = "") {
  const path = String(url).replace(/[?#].*$/, "");
  return path.split("/").pop()?.toLowerCase() || "";
}

function isJunkImageUrl(url = "") {
  if (!url) return true;
  const base = imageBasename(url);
  const stem = base.includes(".") ? base.slice(0, base.lastIndexOf(".")) : base;
  if (!stem || stem.length <= 2) return true;
  if (/^no\d{1,2}$/i.test(stem)) return true;
  const junkStems = new Set([
    "access", "koutuu", "koutsuu", "kotu", "traffic",
    "favicon", "spacer", "blank", "dummy", "pixel", "1x1", "arrow",
    "pagetop", "totop", "share", "sns", "facebook", "instagram", "twitter",
    "line", "line_btn", "qr", "qrcode", "logo", "icon", "badge", "medal",
    "ranking", "banner", "btn", "button", "nav", "menu", "header", "footer",
    "gnav", "gnav_img1", "gnav_img2", "gnav_img3",
    "netsunoyu01", "netsunoyu02", "netsunoyu",
    "main_visual_ttl", "skids-price",
  ]);
  if (junkStems.has(stem)) return true;
  if (/(?:^|[-_])(?:logo|icon|btn|button|banner|arrow|qr|sns|share|favicon|gnav|nav|header|footer|badge|medal|ranking|price|ttl)(?:[-_]|$)/i.test(stem)) {
    return true;
  }
  if (/(?:ogp|noimage|s100x100|capture\.jpg|rsrc\.php|main_visual_ttl|skids-price|page-\d+|\/common\/(?:img|images?)\/|\/themes?\/.*\/(?:common|assets)\/.*gnav|nav-(?:sight|ski|foods|spa)|skids-price)/i.test(url)) {
    return true;
  }
  return false;
}

function imagePixelHint(url = "") {
  if (!url) return 0;
  if (imageHintCache.has(url)) return imageHintCache.get(url);
  if (isJunkImageUrl(url)) {
    imageHintCache.set(url, -10000);
    return -10000;
  }

  let score = 0;
  const wp = url.match(/-(\d{2,4})x(\d{2,4})(?=\.(?:jpe?g|png|webp|gif)(?:\?|$))/i);
  if (wp) score = Math.max(Number(wp[1]), Number(wp[2]));
  const keep = url.match(/\/keep\/(\d+)/);
  if (keep) score = Math.max(score, Number(keep[1]));

  for (const seg of url.split("/")) {
    if (!seg.includes("eyJ")) continue;
    try {
      const raw = seg.split("--")[0];
      const padded = raw + "=".repeat((4 - (raw.length % 4)) % 4);
      const json = atob(padded.replace(/-/g, "+").replace(/_/g, "/"));
      const resize = json.match(/resize_to_fit[^0-9]*(\d+)/);
      if (resize) score = Math.max(score, Number(resize[1]));
      if (json.includes('"format":"webp"') || json.includes('"format":"png"')) score += 40;
      if (json.includes('"format":"jpeg"') || json.includes('"format":"jpg"')) score -= 20;
    } catch (_error) {
      // ignore malformed signed blobs
    }
  }

  if (!score) score = 700;
  if (/(?:[-_](?:150|176|225|250|300)x|s100x100|capture\.jpg|ogp|noimage|header|logo|qr)/i.test(url)) {
    score -= 250;
  }
  if (/(?:livecamera|webcam)/i.test(url)) score -= 320;
  if (/\.(?:jpe?g)(?:\?|$)/i.test(url)) score += 40;
  else if (/\.(?:webp)(?:\?|$)/i.test(url)) score += 20;
  imageHintCache.set(url, score);
  return score;
}

function collectImageCandidates(record = {}) {
  const urls = [];
  if (record.primary_image_url) urls.push(record.primary_image_url);
  for (const image of record.images || []) {
    if (image && image.image_url) urls.push(image.image_url);
  }

  const scored = [];
  const seen = new Set();
  for (const url of urls) {
    const upgraded = upgradeImageUrl(url);
    for (const candidate of upgraded && upgraded !== url ? [upgraded, url] : [url]) {
      if (!candidate || seen.has(candidate) || isJunkImageUrl(candidate)) continue;
      seen.add(candidate);
      scored.push({ url: candidate, score: imagePixelHint(candidate) });
    }
  }
  scored.sort((a, b) => b.score - a.score);
  return scored;
}

function prepareRecordImage(record = {}) {
  if (!record || record._displayImage != null) return record;
  const scored = collectImageCandidates(record);
  const primary = upgradeImageUrl(record.primary_image_url || "") || record.primary_image_url || "";
  let display = "";
  if (primary && !isJunkImageUrl(primary)) {
    display = primary;
  } else {
    display = scored[0]?.url || "";
  }
  let thumb = display;
  if (scored.length) {
    const ideal = 480;
    const usable = scored.filter((item) => item.score >= 280);
    const pool = usable.length ? usable : scored;
    thumb = pool.reduce((best, cur) =>
      Math.abs(cur.score - ideal) < Math.abs(best.score - ideal) ? cur : best
    ).url;
  }
  record._displayImage = display;
  record._thumbImage = thumb;
  return record;
}

function prepareAllRecordImages(data) {
  if (!data) return;
  for (const record of data.events || []) prepareRecordImage(record);
  for (const record of data.child_play_places || []) prepareRecordImage(record);
}

function bestDisplayImage(record = {}) {
  prepareRecordImage(record);
  return record._displayImage || "";
}

function bestThumbImage(record = {}) {
  prepareRecordImage(record);
  return record._thumbImage || record._displayImage || "";
}

function googlePhotoCandidate(record = {}) {
  if (!record.google_place_id || !googleMapsApiKey()) return false;
  prepareRecordImage(record);
  const display = record._displayImage || "";
  const images = record.images || [];
  return !display || images.length < 2 || isLikelyLowQualityImage(display) || imagePixelHint(display) < 500;
}

function isLikelyLowQualityImage(url = "") {
  return isJunkImageUrl(url) || /(?:[-_](?:150|176|225|250|300)x|s100x100|capture\.jpg|ogp|noimage|header|logo|qr|livecamera|webcam)/i.test(url);
}

function googleMapsApiKey() {
  return window.GOOGLE_MAPS_API_KEY || (window.APP_CONFIG && window.APP_CONFIG.googleMapsApiKey) || "";
}

async function hydrateGooglePhotoTargets(root) {
  const targets = Array.from(root.querySelectorAll("[data-google-place-id]:not([data-google-photo-loaded])"));
  if (!targets.length || !googleMapsApiKey()) return;

  for (const target of targets.slice(0, 24)) {
    target.dataset.googlePhotoLoaded = "true";
    try {
      const photo = await getGooglePlacePhoto(target.dataset.googlePlaceId);
      if (!photo || !photo.url) {
        target.classList.add("is-failed");
        continue;
      }
      applyGooglePhoto(target, photo, target.dataset.googlePhotoAlt || "Google Maps photo");
    } catch (error) {
      target.classList.add("is-failed");
    }
  }
}

async function getGooglePlacePhoto(placeId) {
  if (googlePhotoCache.has(placeId)) return googlePhotoCache.get(placeId);
  const service = await googlePlacesService();
  const photoPromise = new Promise((resolve) => {
    service.getDetails({ placeId, fields: ["photos"] }, (place, status) => {
      if (status !== google.maps.places.PlacesServiceStatus.OK || !place || !place.photos || !place.photos.length) {
        resolve(null);
        return;
      }
      const photo = place.photos[0];
      resolve({
        url: photo.getUrl({ maxWidth: 1200, maxHeight: 800 }),
        attributions: photo.html_attributions || [],
      });
    });
  });
  googlePhotoCache.set(placeId, photoPromise);
  return photoPromise;
}

function googlePlacesService() {
  if (googlePlacesServicePromise) return googlePlacesServicePromise;
  googlePlacesServicePromise = new Promise((resolve, reject) => {
    if (window.google && google.maps && google.maps.places) {
      resolve(new google.maps.places.PlacesService(document.createElement("div")));
      return;
    }
    const script = document.createElement("script");
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(googleMapsApiKey())}&libraries=places&v=weekly`;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve(new google.maps.places.PlacesService(document.createElement("div")));
    script.onerror = reject;
    document.head.appendChild(script);
  });
  return googlePlacesServicePromise;
}

function applyGooglePhoto(target, photo, alt) {
  target.querySelectorAll("img, .google-photo-badge, .google-photo-attribution").forEach((item) => item.remove());
  const image = document.createElement("img");
  image.src = photo.url;
  image.alt = alt;
  image.loading = "lazy";
  image.decoding = "async";
  image.onload = () => target.classList.add("is-loaded", "has-google-photo");
  image.onerror = () => target.classList.add("is-failed");
  target.appendChild(image);

  const badge = document.createElement("em");
  badge.className = "google-photo-badge";
  badge.textContent = "Google Maps";
  target.appendChild(badge);

  if (photo.attributions && photo.attributions.length) {
    const attribution = document.createElement("small");
    attribution.className = "google-photo-attribution";
    attribution.innerHTML = photo.attributions.join(" ");
    target.appendChild(attribution);
  }
}

function filteredRecords() {
  if (state.mode === "places") return filteredPlaces();
  return state.data.events.filter((event) => {
    if (!matchesDateScope(event)) return false;
    if (state.motenashiOnly && !isMotenashiEvent(event)) return false;
    if (state.prefecture !== "all" && event.prefecture !== state.prefecture) return false;
    if (state.municipality !== "all" && event.municipality !== state.municipality) return false;
    if (state.category !== "all" && !matchesSelectedCategory(event.category)) return false;
    if (state.status !== "all" && event.status !== state.status) return false;
    if (state.freeOnly && !isFreeRecord(event)) return false;
    if (!matchesAgeGroup(event)) return false;
    if (!state.query) return true;

    const haystack = [
      event.title,
      event.prefecture,
      event.municipality,
      event.area_label,
      event.venue_name,
      event.address,
      event.category,
      event.organizer,
      event.summary,
      event.source_names,
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();

    return haystack.includes(state.query);
  });
}

function matchesDateScope(event) {
  const endDate = event.end_date || event.start_date;
  if (state.dateScope === "past") return endDate < TODAY;
  if (state.dateScope === "all") return true;
  if (state.dateScope === "weekend") return matchesWeekend(event);
  if (state.dateScope === "month") return matchesThisMonth(event);
  return endDate >= TODAY;
}

function matchesWeekend(event) {
  const startDate = event.start_date;
  const endDate = event.end_date || event.start_date;
  if (!startDate || endDate < TODAY) return false;
  const { start, end } = weekendRange();
  return startDate <= end && endDate >= start;
}

function matchesThisMonth(event) {
  const startDate = event.start_date;
  const endDate = event.end_date || event.start_date;
  if (!startDate || endDate < TODAY) return false;
  return startDate <= monthEnd();
}

function weekendRange() {
  const [year, month, day] = TODAY.split("-").map(Number);
  const base = new Date(Date.UTC(year, month - 1, day));
  const dow = base.getUTCDay();
  let startOffset;
  let endOffset;
  if (dow === 6) {
    startOffset = 0;
    endOffset = 1;
  } else if (dow === 0) {
    startOffset = 0;
    endOffset = 0;
  } else {
    startOffset = 6 - dow;
    endOffset = 7 - dow;
  }
  return { start: isoOffset(base, startOffset), end: isoOffset(base, endOffset) };
}

function monthEnd() {
  const [year, month] = TODAY.split("-").map(Number);
  const dt = new Date(Date.UTC(year, month, 0));
  return isoOffset(dt, 0);
}

function isoOffset(base, offsetDays) {
  const dt = new Date(base.getTime() + offsetDays * 86400000);
  return `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, "0")}-${String(dt.getUTCDate()).padStart(2, "0")}`;
}

function isMotenashiEvent(event) {
  return [
    event.venue_name,
    event.area_label,
    event.address,
    event.summary,
    event.notes,
  ]
    .filter(Boolean)
    .some((value) => value.includes("もてなし広場") || value.includes("高松町1"));
}

function filteredPlaces() {
  return state.data.child_play_places.filter((place) => {
    if (state.prefecture !== "all" && place.prefecture !== state.prefecture) return false;
    if (state.municipality !== "all" && place.municipality !== state.municipality) return false;
    if (state.category !== "all" && !matchesSelectedCategory(place.place_type)) return false;
    if (state.status !== "all" && place.status !== state.status) return false;
    if (state.freeOnly && !isFreeRecord(place)) return false;
    if (state.indoorOnly && !isIndoorFriendly(place)) return false;
    if (state.outdoorOnly && !isOutdoorFriendly(place)) return false;
    if (!matchesAgeGroup(place)) return false;
    if (!state.query) return true;

    const haystack = [
      place.name,
      place.prefecture,
      place.municipality,
      place.area_label,
      place.address,
      place.place_type,
      place.target_age_note,
      place.features,
      place.price_note,
      place.hours_note,
      place.source_names,
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();

    return haystack.includes(state.query);
  });
}

function currentRecords() {
  return state.mode === "events" ? state.data.events : state.data.child_play_places;
}

function allRecords() {
  return [...state.data.events, ...state.data.child_play_places];
}

function formatRecordLocation(record) {
  return [record.prefecture, record.municipality].filter(Boolean).join(" ");
}

function sortRecords(records) {
  const sorted = [...records];
  sorted.sort((a, b) => {
    const trust = Number(isCandidate(a)) - Number(isCandidate(b));
    if (trust) return trust;

    if (state.sort === "area") {
      return (
        (a.prefecture || "").localeCompare(b.prefecture || "", "ja") ||
        (a.municipality || "").localeCompare(b.municipality || "", "ja") ||
        (a.start_date || "").localeCompare(b.start_date || "")
      );
    }
    if (state.mode === "places") {
      return (
        (a.place_type || "").localeCompare(b.place_type || "", "ja") ||
        (a.municipality || "").localeCompare(b.municipality || "", "ja") ||
        (a.name || "").localeCompare(b.name || "", "ja")
      );
    }
    if (state.dateScope === "past") {
      return (
        (b.end_date || b.start_date || "").localeCompare(a.end_date || a.start_date || "") ||
        (b.start_time || "").localeCompare(a.start_time || "") ||
        (a.municipality || "").localeCompare(b.municipality || "", "ja")
      );
    }
    return (
      (a.start_date || "").localeCompare(b.start_date || "") ||
      (a.start_time || "").localeCompare(b.start_time || "") ||
      (a.municipality || "").localeCompare(b.municipality || "", "ja")
    );
  });
  return sorted;
}

function todayInTimeZone(timeZone) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function unique(values) {
  return Array.from(new Set(values)).sort((a, b) => a.localeCompare(b, "ja"));
}

function categoryLabel(category) {
  return categoryLabels[category] || category || "未分類";
}

function placeTypeLabel(type) {
  return placeTypeLabels[type] || type || "未分類";
}

function indoorOutdoorLabel(value) {
  return {
    indoor: "屋内",
    outdoor: "屋外",
    both: "屋内外",
  }[value] || "未設定";
}

function isCandidate(record) {
  return record.status === "candidate" || record.confidence === "low";
}

function isFreeRecord(record) {
  return /無料/.test(String(record.price_note || ""));
}

function isIndoorFriendly(place) {
  return place.indoor_outdoor === "indoor" || place.indoor_outdoor === "both";
}

function isOutdoorFriendly(place) {
  return place.indoor_outdoor === "outdoor" || place.indoor_outdoor === "both";
}

function statusPill(record) {
  if (!isCandidate(record)) return "";
  return `<span class="pill warn">${uiIcon("alert")}要確認</span>`;
}

function uiIcon(name) {
  return `<i class="ui-icon ui-icon--${name}" aria-hidden="true"></i>`;
}

function formatDate(value) {
  if (!value) return "未設定";
  const [year, month, day] = value.split("-");
  return `${year}/${Number(month)}/${Number(day)}`;
}

function formatMonthDay(value) {
  if (!value) return "-";
  const [, month, day] = value.split("-");
  return `${Number(month)}/${Number(day)}`;
}

function groupKey(record) {
  const start = record.start_date || "";
  if (!start) return "未定";
  if (state.dateScope === "weekend") {
    const end = record.end_date || start;
    const duration = (Date.parse(`${end}T00:00:00Z`) - Date.parse(`${start}T00:00:00Z`)) / 86400000 + 1;
    return duration >= 14 ? "開催期間が長いイベント" : "今週末の短期イベント";
  }
  if (state.dateScope !== "past" && start < TODAY) return "開催中";
  return start.slice(0, 7);
}

function monthHeading(key) {
  if (key === "未定") return "日程未定";
  if (key === "開催中") return "開催中・通年";
  if (key === "開催期間が長いイベント" || key === "今週末の短期イベント") return key;
  const [year, month] = key.split("-");
  return `${year}年${Number(month)}月`;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
