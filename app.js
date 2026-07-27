const TODAY = todayInTimeZone("Asia/Tokyo");
const LIST_RETURN_KEY = "aso:listUrl";
const googlePhotoCache = new Map();

const state = {
  data: null,
  mode: "events",
  query: "",
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
  decision: "none",
};

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
  { id: "infant", label: "乳幼児" },
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
const familyAgePattern = /子ども|子供|親子/;

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
}

function buildListSearchParams() {
  const params = new URLSearchParams();
  if (state.mode !== "events") params.set("mode", state.mode);
  const queryText = els.searchInput?.value?.trim() || "";
  if (queryText) params.set("q", queryText);
  if (state.municipality !== "all") params.set("municipality", state.municipality);
  if (state.category !== "all") params.set("category", state.category);
  if (state.age !== "all") params.set("age", state.age);
  if (state.status !== "all") params.set("status", state.status);
  if (state.mode === "events" && state.dateScope !== "upcoming") params.set("date", state.dateScope);
  if (state.motenashiOnly) params.set("motenashi", "1");
  if (state.freeOnly) params.set("free", "1");
  if (state.indoorOnly) params.set("indoor", "1");
  if (state.decision !== "none") params.set("decision", state.decision);
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
    "municipalitySelect",
    "ageSelect",
    "categoryFieldLabel",
    "categorySelect",
    "resetButton",
    "coverageList",
    "gunmaMap",
    "clearMapSelection",
    "dateChips",
    "decisionChips",
    "ageChips",
    "categoryChips",
    "listContext",
    "weekendHighlight",
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
      state.municipality = "all";
      state.indoorOnly = false;
      state.freeOnly = false;
      state.motenashiOnly = false;
      state.decision = "none";
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

  els.municipalitySelect.addEventListener("change", (event) => {
    setMunicipality(event.target.value, { scroll: false });
  });

  els.ageSelect.addEventListener("change", (event) => {
    state.age = event.target.value;
    render();
  });

  els.categorySelect.addEventListener("change", (event) => {
    state.category = event.target.value;
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

  els.coverageList.addEventListener("click", (event) => {
    const item = event.target.closest("[data-municipality]");
    if (!item) return;
    const name = item.dataset.municipality;
    setMunicipality(state.municipality === name ? "all" : name, { scroll: true });
  });

  els.gunmaMap.addEventListener("click", (event) => {
    const region = event.target.closest("[data-municipality]");
    if (!region) return;
    const name = region.dataset.municipality;
    setMunicipality(state.municipality === name ? "all" : name, { scroll: true });
  });

  els.clearMapSelection.addEventListener("click", () => {
    setMunicipality("all", { scroll: false });
  });

  els.resetButton.addEventListener("click", () => {
    state.query = "";
    state.municipality = "all";
    state.category = "all";
    state.age = "all";
    state.status = "all";
    state.dateScope = "upcoming";
    state.sort = "date";
    state.motenashiOnly = false;
    state.freeOnly = false;
    state.indoorOnly = false;
    state.decision = "none";
    els.searchInput.value = "";
    els.categorySelect.value = "all";
    els.ageSelect.value = "all";
    populateMunicipalities();
    render();
  });
}

function setMunicipality(name, { scroll = false } = {}) {
  state.municipality = name || "all";
  if (els.municipalitySelect) {
    els.municipalitySelect.value = state.municipality;
  }
  render();
  if (scroll && state.municipality !== "all") {
    document.getElementById("eventList")?.scrollIntoView({ behavior: "smooth", block: "start" });
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
    ? `${uiIcon("sliders")}閉じる`
    : `${uiIcon("sliders")}条件`;
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
  populateMunicipalities();
}

function populateMunicipalities() {
  const municipalities = unique(currentRecords().map((record) => record.municipality).filter(Boolean));
  if (state.municipality !== "all" && !municipalities.includes(state.municipality)) {
    municipalities.push(state.municipality);
  }
  fillSelect(
    els.municipalitySelect,
    [["all", "すべて"]].concat(municipalities.map((item) => [item, item]))
  );
  els.municipalitySelect.value = state.municipality;
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
  els.modeEventsButton.classList.toggle("is-active", state.mode === "events");
  els.modePlacesButton.classList.toggle("is-active", state.mode === "places");
  renderDecisionChips();
  renderDateChips();
  renderAgeChips();
  renderCategoryChips();
  renderCoverage();
  renderMapSelection();
  renderListContext();
  renderWeekendHighlight();
  renderList(sorted);
  syncStateToUrl();
}

function applyDecision(decision, { toggle = true, scroll = true, skipRender = false } = {}) {
  const next = toggle && state.decision === decision ? "none" : decision;
  state.decision = next;
  state.freeOnly = false;
  state.indoorOnly = false;
  state.motenashiOnly = false;
  state.status = "all";

  if (next === "weekend") {
    state.mode = "events";
    state.dateScope = "weekend";
    state.age = "all";
    state.category = "all";
  } else if (next === "rain") {
    state.mode = "places";
    state.indoorOnly = true;
    state.age = "all";
    state.category = "all";
  } else if (next === "free") {
    state.freeOnly = true;
  } else if (next === "infant") {
    state.age = "infant";
  } else if (next === "verified") {
    state.status = "verified";
  } else if (next === "motenashi") {
    state.mode = "events";
    state.motenashiOnly = true;
    state.municipality = "all";
    state.age = "all";
    state.category = "all";
  } else if (next === "none") {
    if (state.dateScope === "weekend") state.dateScope = "upcoming";
  }

  if (els.modeEventsButton && els.modePlacesButton) {
    els.modeEventsButton.classList.toggle("is-active", state.mode === "events");
    els.modePlacesButton.classList.toggle("is-active", state.mode === "places");
  }
  if (els.ageSelect) els.ageSelect.value = state.age;
  if (els.categorySelect) els.categorySelect.value = state.category;
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
  const chips = [
    ["weekend", "今週末", "calendar"],
    ["rain", "雨の日屋内（遊び場）", "rain"],
    ["free", "無料", "yen"],
    ["infant", "乳幼児", "baby"],
    ["motenashi", "もてなし広場", "building"],
    ["verified", "確認済み", "check"],
  ];
  els.decisionChips.innerHTML = chips
    .map(
      ([value, label, icon]) =>
        `<button type="button" class="chip decision-chip ${state.decision === value ? "is-active" : ""}" data-decision="${value}">${uiIcon(icon)}${label}</button>`
    )
    .join("");
}

function renderListContext() {
  if (!els.listContext) return;
  const parts = [];
  parts.push(state.mode === "events" ? "イベント" : "遊び場");

  if (state.decision === "rain") {
    parts.push("雨の日屋内に切り替えました");
  } else if (state.decision === "weekend") {
    parts.push("今週末");
  } else if (state.decision === "free") {
    parts.push("無料");
  } else if (state.decision === "infant") {
    parts.push("乳幼児向け");
  } else if (state.decision === "motenashi") {
    parts.push("もてなし広場");
  } else if (state.decision === "verified") {
    parts.push("確認済み");
  }

  if (state.municipality !== "all") parts.push(state.municipality);
  if (state.decision !== "motenashi" && state.motenashiOnly) parts.push("もてなし広場");
  if (state.decision !== "free" && state.freeOnly) parts.push("無料");
  if (state.decision !== "rain" && state.indoorOnly) parts.push("屋内");
  if (state.mode === "events" && state.dateScope !== "upcoming" && state.decision !== "weekend") {
    const dateLabels = { all: "すべて", weekend: "今週末", month: "今月", past: "過去" };
    parts.push(dateLabels[state.dateScope] || state.dateScope);
  }
  if (state.age !== "all" && state.decision !== "infant") {
    const age = ageGroups.find((group) => group.id === state.age);
    if (age) parts.push(age.label);
  }
  if (state.category !== "all") {
    const group = currentCategoryGroups().find((item) => item.id === state.category);
    if (group) parts.push(group.label);
  }
  if (state.query) parts.push(`「${els.searchInput?.value?.trim() || state.query}」`);

  const hasFilter =
    state.decision !== "none" ||
    state.municipality !== "all" ||
    state.motenashiOnly ||
    state.freeOnly ||
    state.indoorOnly ||
    state.age !== "all" ||
    state.category !== "all" ||
    Boolean(state.query) ||
    (state.mode === "events" && state.dateScope !== "upcoming");

  if (!hasFilter) {
    els.listContext.hidden = true;
    els.listContext.textContent = "";
    return;
  }

  els.listContext.hidden = false;
  els.listContext.textContent = parts.join(" · ");
}

function renderWeekendHighlight() {
  if (!els.weekendHighlight) return;
  if (state.mode !== "events" || state.dateScope === "past") {
    els.weekendHighlight.hidden = true;
    els.weekendHighlight.innerHTML = "";
    return;
  }

  const weekendEvents = sortRecords(
    state.data.events.filter((event) => {
      if (!matchesWeekend(event)) return false;
      if (state.motenashiOnly && !isMotenashiEvent(event)) return false;
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
    })
  ).slice(0, 4);

  if (!weekendEvents.length) {
    els.weekendHighlight.hidden = true;
    els.weekendHighlight.innerHTML = "";
    return;
  }

  const { start, end } = weekendRange();
  const rangeLabel = start === end ? formatDateCompact(start) : `${formatDateCompact(start, { includeYear: false })}〜${formatDateCompact(end, { includeYear: false })}`;

  els.weekendHighlight.hidden = false;
  els.weekendHighlight.innerHTML = `
    <div class="weekend-highlight__head">
      <div>
        <p class="weekend-highlight__eyebrow">${uiIcon("calendar")}今週末のおでかけ</p>
        <h2>${escapeHtml(rangeLabel)}のピックアップ</h2>
      </div>
      <button type="button" class="ghost-button" data-decision="weekend">${uiIcon("calendar")}今週末をすべて見る</button>
    </div>
    <div class="weekend-highlight__grid">
      ${weekendEvents
        .map((event) => {
          const imageUrl = bestThumbImage(event);
          return `
            <a class="weekend-card" href="${escapeHtml(recordPageHref(event, "event"))}">
              <div class="weekend-card__media">
                ${imageUrl ? `<img src="${escapeHtml(imageUrl)}" alt="" loading="lazy" decoding="async" referrerpolicy="no-referrer">` : ""}
              </div>
              <div class="weekend-card__body">
                <p class="card-kicker">
                  <span class="meta-item">${uiIcon("pin")}${escapeHtml(event.municipality || "群馬県")}</span>
                  <span class="meta-item">${uiIcon("calendar")}${escapeHtml(formatMonthDay(event.start_date))}</span>
                </p>
                <h3>${escapeHtml(event.title)}</h3>
                <div class="event-meta">
                  <span class="pill category">${uiIcon("tag")}${escapeHtml(categoryLabel(event.category))}</span>
                  ${statusPill(event)}
                </div>
              </div>
            </a>
          `;
        })
        .join("")}
    </div>
  `;

  els.weekendHighlight.querySelectorAll("[data-decision]").forEach((button) => {
    button.addEventListener("click", () => applyDecision(button.dataset.decision, { toggle: false }));
  });
}

function renderMapSelection() {
  if (!els.gunmaMap) return;
  const selected = state.municipality;
  els.gunmaMap.querySelectorAll(".gunma-region").forEach((region) => {
    region.classList.toggle("is-active", region.dataset.municipality === selected);
  });
  els.gunmaMap.querySelectorAll(".gunma-label").forEach((label) => {
    label.classList.toggle("is-active", label.dataset.municipality === selected);
  });
  if (els.clearMapSelection) {
    els.clearMapSelection.hidden = selected === "all";
  }
}

function renderDateChips() {
  if (state.mode !== "events") {
    els.dateChips.innerHTML = "";
    els.dateChips.hidden = true;
    return;
  }
  els.dateChips.hidden = false;
  const scopes = [
    ["all", "すべて", "list"],
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

  if (!tags.size && familyAgePattern.test(text)) {
    return ["infant", "preschool", "elementary"];
  }

  if (!tags.size) {
    // イベントは年齢記載が少ないため、明示がないものは中高生・一般扱い
    if (record.start_date || record.title) return ["general"];
    return ageGroups.map((group) => group.id);
  }

  return Array.from(tags);
}

function matchesAgeGroup(record) {
  if (state.age === "all") return true;
  return detectAgeTags(record).includes(state.age);
}

function renderCoverage() {
  const records = currentRecords();
  const counts = new Map();
  records.forEach((record) => counts.set(record.municipality || "未設定", (counts.get(record.municipality || "未設定") || 0) + 1));
  const total = records.length;

  const items = [
    `<button type="button" class="coverage-item ${state.municipality === "all" ? "is-active" : ""}" data-municipality="all">
      <strong>${uiIcon("map")}すべて</strong>
      <span>${total}件</span>
    </button>`,
  ].concat(
    Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "ja"))
      .slice(0, 12)
      .map(([name, count]) => {
        const active = state.municipality === name ? "is-active" : "";
        return `
          <button type="button" class="coverage-item ${active}" data-municipality="${escapeHtml(name)}">
            <strong>${uiIcon("pin")}${escapeHtml(name)}</strong>
            <span>${count}件</span>
          </button>
        `;
      })
  );

  els.coverageList.innerHTML = items.join("");
}

function renderList(records) {
  if (records.length === 0) {
    els.eventList.innerHTML = `<div class="empty-state">条件に一致するデータがありません。</div>`;
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
    els.eventList.innerHTML = Array.from(groups.entries())
      .map(([key, items]) => renderDateGroup(key, items, cardFn))
      .join("");
  } else {
    els.eventList.innerHTML = records.map(cardFn).join("");
  }

  hydrateGooglePhotoTargets(els.eventList);
}

function renderDateGroup(key, items, cardFn) {
  const cards = items.map(cardFn).join("");
  const count = items.length;
  const collapseByDefault = key === "開催中";

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
  const image = mediaThumb(displayImage, event.title, categoryLabel(event.category), event.images, event);
  const venue = event.venue_name || event.area_label || "";
  const placeLine = [event.municipality || event.prefecture, venue].filter(Boolean).join(" / ");
  const dateLabel = formatMonthDay(event.start_date);
  const price = event.price_note || "";
  const whenParts = [];
  if (dateLabel !== "-") whenParts.push(`<span class="meta-item">${uiIcon("calendar")}${escapeHtml(dateLabel)}</span>`);
  if (time) whenParts.push(`<span class="meta-item">${uiIcon("clock")}${escapeHtml(time)}</span>`);

  return `
    <a class="event-card has-image ${isCandidate(event) ? "is-candidate" : ""}" href="${escapeHtml(recordPageHref(event, "event"))}">
      ${image}
      <div class="event-main">
        <h3 class="event-title">${escapeHtml(event.title)}</h3>
        ${whenParts.length ? `<p class="card-kicker card-kicker--when">${whenParts.join("")}</p>` : ""}
        <p class="card-kicker card-kicker--where">
          <span class="meta-item">${uiIcon("pin")}${escapeHtml(placeLine || "地域未設定")}</span>
          <span class="meta-item">${uiIcon("yen")}${escapeHtml(displayOrConfirm(compactText(price, 28)))}</span>
          ${statusPill(event)}
        </p>
      </div>
    </a>
  `;
}

function placeCard(place) {
  const displayImage = bestThumbImage(place);
  const image = mediaThumb(displayImage, place.name, placeTypeLabel(place.place_type), place.images, place);
  const indoorOutdoor = indoorOutdoorLabel(place.indoor_outdoor);
  const price = place.price_note || "";
  const indoorIcon = place.indoor_outdoor === "outdoor" ? "sun" : "home";
  return `
    <a class="event-card has-image ${isCandidate(place) ? "is-candidate" : ""}" href="${escapeHtml(recordPageHref(place, "place"))}">
      ${image}
      <div class="event-main">
        <h3 class="event-title">${escapeHtml(place.name)}</h3>
        <p class="card-kicker card-kicker--when">
          <span class="meta-item">${uiIcon("pin")}${escapeHtml(place.municipality || place.prefecture || "地域未設定")}</span>
          ${indoorOutdoor ? `<span class="meta-item">${uiIcon(indoorIcon)}${escapeHtml(indoorOutdoor)}</span>` : ""}
        </p>
        <p class="card-kicker card-kicker--where">
          <span class="meta-item">${uiIcon("yen")}${escapeHtml(displayOrConfirm(compactText(price, 28)))}</span>
          ${statusPill(place)}
        </p>
      </div>
    </a>
  `;
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
  const googlePlaceId = googlePhotoCandidate(record) ? record.google_place_id : "";
  const extraCount = Math.max(0, (images || []).length - 1);
  return `
    <div class="media-thumb ${url ? "" : googlePlaceId ? "is-google-pending" : "is-empty"}" ${googlePlaceId ? `data-google-place-id="${escapeHtml(googlePlaceId)}" data-google-photo-alt="${escapeHtml(alt)}"` : ""}>
      <span>${escapeHtml(fallbackLabel || "画像")}</span>
      ${extraCount ? `<em class="photo-count">+${extraCount}</em>` : ""}
      ${url ? `<img src="${escapeHtml(url)}" alt="${escapeHtml(alt)}" loading="lazy" decoding="async" referrerpolicy="no-referrer" onload="this.closest('.media-thumb').classList.add('is-loaded');if(this.naturalWidth<180)this.closest('.media-thumb').classList.add('is-lowres')" onerror="this.closest('.media-thumb').classList.add('is-failed')">` : ""}
    </div>
  `;
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
  if (isLongRunningEvent(event)) return false;
  const { start, end } = weekendRange();
  return startDate <= end && endDate >= start;
}

function isLongRunningEvent(event) {
  return eventSpanDays(event) >= 14;
}

function eventSpanDays(event) {
  const startDate = event.start_date;
  const endDate = event.end_date || event.start_date;
  if (!startDate || !endDate) return 0;
  const start = Date.parse(`${startDate}T00:00:00Z`);
  const end = Date.parse(`${endDate}T00:00:00Z`);
  if (Number.isNaN(start) || Number.isNaN(end) || end < start) return 0;
  return Math.round((end - start) / 86400000) + 1;
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
    if (state.municipality !== "all" && place.municipality !== state.municipality) return false;
    if (state.category !== "all" && !matchesSelectedCategory(place.place_type)) return false;
    if (state.status !== "all" && place.status !== state.status) return false;
    if (state.freeOnly && !isFreeRecord(place)) return false;
    if (state.indoorOnly && !isIndoorFriendly(place)) return false;
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
  if (state.dateScope !== "past" && start < TODAY) return "開催中";
  return start.slice(0, 7);
}

function monthHeading(key) {
  if (key === "未定") return "日程未定";
  if (key === "開催中") return "開催中・通年";
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
