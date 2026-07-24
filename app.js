const TODAY = todayInTimeZone("Asia/Tokyo");
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

let dialogScrollY = 0;

document.addEventListener("DOMContentLoaded", async () => {
  bindElements();
  bindEvents();

  try {
    await loadOptionalConfig();
    state.data = await loadData();
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
  const query = params.get("q");
  if (query) {
    state.query = query.trim().toLowerCase();
    els.searchInput.value = query.trim();
  }

  const municipality = params.get("municipality");
  if (municipality) {
    state.municipality = municipality;
  }

  const mode = params.get("mode");
  if (mode === "events" || mode === "places") {
    state.mode = mode;
  }

  const decision = params.get("decision");
  if (decision) {
    applyDecision(decision, { toggle: false, scroll: false });
  }
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
    "topMotenashiButton",
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
    "weekendHighlight",
    "eventList",
    "eventDialog",
    "closeDialog",
    "dialogBody",
  ].forEach((id) => {
    els[id] = document.getElementById(id);
  });
}

function bindEvents() {
  els.topMotenashiButton.addEventListener("click", () => {
    setMotenashiOnly(!state.motenashiOnly);
  });

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
      state.decision = "none";
      els.modeEventsButton.classList.toggle("is-active", state.mode === "events");
      els.modePlacesButton.classList.toggle("is-active", state.mode === "places");
      populateFilters();
      render();
    });
  });

  els.searchInput.addEventListener("input", (event) => {
    state.query = event.target.value.trim().toLowerCase();
    render();
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

  els.closeDialog.addEventListener("click", () => closeRecordDialog());
  els.eventDialog.addEventListener("click", (event) => {
    if (event.target === els.eventDialog) {
      closeRecordDialog();
    }
  });
  els.dialogBody.addEventListener("click", (event) => {
    const shareButton = event.target.closest("[data-share-id]");
    if (!shareButton) return;
    event.preventDefault();
    shareRecordById(shareButton.dataset.shareId, shareButton.dataset.shareKind);
  });
  els.eventDialog.addEventListener("close", () => {
    unlockDialogScroll();
  });
  els.eventDialog.addEventListener("cancel", (event) => {
    event.preventDefault();
    closeRecordDialog();
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

function setMotenashiOnly(value) {
  state.mode = "events";
  state.motenashiOnly = value;
  state.municipality = "all";
  els.modeEventsButton.classList.add("is-active");
  els.modePlacesButton.classList.remove("is-active");
  populateFilters();
  render();
}

function setDateScope(scope) {
  state.dateScope = scope || "upcoming";
  render();
}

function updateFilterVisibility() {
  els.filterBody.classList.toggle("is-open", state.filtersOpen);
  els.filterToggleButton.setAttribute("aria-expanded", String(state.filtersOpen));
  els.filterToggleButton.textContent = state.filtersOpen ? "閉じる" : "条件";
}

function populateFilters() {
  const groups = currentCategoryGroups();
  els.categoryFieldLabel.textContent = state.mode === "events" ? "カテゴリ" : "種別";

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
  els.topMotenashiButton.classList.toggle("is-active", state.motenashiOnly);
  els.modeEventsButton.classList.toggle("is-active", state.mode === "events");
  els.modePlacesButton.classList.toggle("is-active", state.mode === "places");
  renderDecisionChips();
  renderDateChips();
  renderAgeChips();
  renderCategoryChips();
  renderCoverage();
  renderMapSelection();
  renderWeekendHighlight();
  renderList(sorted);
}

function applyDecision(decision, { toggle = true, scroll = true } = {}) {
  const next = toggle && state.decision === decision ? "none" : decision;
  state.decision = next;
  state.freeOnly = false;
  state.indoorOnly = false;
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
  } else if (next === "none") {
    if (state.dateScope === "weekend") state.dateScope = "upcoming";
  }

  if (els.modeEventsButton && els.modePlacesButton) {
    els.modeEventsButton.classList.toggle("is-active", state.mode === "events");
    els.modePlacesButton.classList.toggle("is-active", state.mode === "places");
  }
  if (els.ageSelect) els.ageSelect.value = state.age;
  if (els.categorySelect) els.categorySelect.value = state.category;
  if (state.data) {
    populateFilters();
    render();
  }
  if (scroll) {
    document.getElementById("eventList")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }
}

function renderDecisionChips() {
  if (!els.decisionChips) return;
  const chips = [
    ["weekend", "今週末"],
    ["rain", "雨の日屋内"],
    ["free", "無料"],
    ["infant", "乳幼児"],
    ["verified", "確認済み"],
  ];
  els.decisionChips.innerHTML = chips
    .map(
      ([value, label]) =>
        `<button type="button" class="chip decision-chip ${state.decision === value ? "is-active" : ""}" data-decision="${value}">${label}</button>`
    )
    .join("");
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
      if (state.municipality !== "all" && event.municipality !== state.municipality) return false;
      if (state.motenashiOnly && !isMotenashiEvent(event)) return false;
      return true;
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
        <p class="weekend-highlight__eyebrow">今週末のおでかけ</p>
        <h2>${escapeHtml(rangeLabel)}のピックアップ</h2>
      </div>
      <button type="button" class="ghost-button" data-decision="weekend">今週末をすべて見る</button>
    </div>
    <div class="weekend-highlight__grid">
      ${weekendEvents
        .map((event) => {
          const official = officialUrl(event);
          return `
            <article class="weekend-card" role="button" tabindex="0" data-card-id="${event.id}">
              <div class="weekend-card__media">
                ${event.primary_image_url ? `<img src="${escapeHtml(event.primary_image_url)}" alt="" loading="lazy" decoding="async" referrerpolicy="no-referrer">` : ""}
              </div>
              <div class="weekend-card__body">
                <p class="card-kicker">${escapeHtml(event.municipality || "群馬県")} / ${escapeHtml(formatMonthDay(event.start_date))}</p>
                <h3>${escapeHtml(event.title)}</h3>
                <div class="event-meta">
                  <span class="pill category">${escapeHtml(categoryLabel(event.category))}</span>
                  ${statusPill(event)}
                </div>
                ${official ? `<a class="text-link" href="${escapeHtml(official)}" target="_blank" rel="noreferrer" data-stop>公式</a>` : ""}
              </div>
            </article>
          `;
        })
        .join("")}
    </div>
  `;

  els.weekendHighlight.querySelectorAll("[data-card-id]").forEach((card) => {
    card.addEventListener("click", (event) => {
      if (event.target.closest("a, button, [data-stop]")) return;
      openRecordById(card.dataset.cardId);
    });
    card.addEventListener("keydown", (event) => {
      if (event.key !== "Enter" && event.key !== " ") return;
      event.preventDefault();
      openRecordById(card.dataset.cardId);
    });
  });
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
    ["all", "すべて"],
    ["upcoming", "開催予定"],
    ["weekend", "今週末"],
    ["month", "今月"],
    ["past", "過去"],
  ];
  els.dateChips.innerHTML = scopes
    .map(
      ([value, label]) =>
        `<button type="button" class="chip ${state.dateScope === value ? "is-active" : ""}" data-date-scope="${value}">${label}</button>`
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
    `<button type="button" class="chip ${state.age === "all" ? "is-active" : ""}" data-age="all">すべて</button>`,
  ].concat(
    ageGroups
      .filter((group) => state.age === group.id || (counts.get(group.id) || 0) > 0)
      .map((group) => {
        const count = counts.get(group.id) || 0;
        return `<button type="button" class="chip ${state.age === group.id ? "is-active" : ""}" data-age="${escapeHtml(group.id)}">${escapeHtml(group.label)}<em>${count}</em></button>`;
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
    `<button type="button" class="chip ${state.category === "all" ? "is-active" : ""}" data-category="all">すべて</button>`,
  ].concat(
    groups
      .filter((group) => (counts.get(group.id) || 0) > 0)
      .map((group) => {
        const count = counts.get(group.id) || 0;
        return `<button type="button" class="chip ${state.category === group.id ? "is-active" : ""}" data-category="${escapeHtml(group.id)}">${escapeHtml(group.label)}<em>${count}</em></button>`;
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
  const max = Math.max(...counts.values(), 1);
  const total = records.length;

  const items = [
    `<button type="button" class="coverage-item ${state.municipality === "all" ? "is-active" : ""}" data-municipality="all">
      <strong>すべて</strong>
      <span>${total}件</span>
      <div class="coverage-bar"><span style="width:100%"></span></div>
    </button>`,
  ].concat(
    Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "ja"))
      .slice(0, 12)
      .map(([name, count]) => {
        const width = Math.max(8, Math.round((count / max) * 100));
        const active = state.municipality === name ? "is-active" : "";
        return `
          <button type="button" class="coverage-item ${active}" data-municipality="${escapeHtml(name)}">
            <strong>${escapeHtml(name)}</strong>
            <span>${count}件</span>
            <div class="coverage-bar"><span style="width:${width}%"></span></div>
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
      .map(
        ([key, items]) =>
          `<h3 class="date-group-heading">${escapeHtml(monthHeading(key))}</h3>` + items.map(cardFn).join("")
      )
      .join("");
  } else {
    els.eventList.innerHTML = records.map(cardFn).join("");
  }

  els.eventList.querySelectorAll("[data-card-id]").forEach((card) => {
    card.addEventListener("click", (event) => {
      if (event.target.closest("a, button")) return;
      openRecordById(card.dataset.cardId);
    });
    card.addEventListener("keydown", (event) => {
      if (event.key !== "Enter" && event.key !== " ") return;
      event.preventDefault();
      openRecordById(card.dataset.cardId);
    });
  });
  els.eventList.querySelectorAll("[data-detail-id]").forEach((button) => {
    button.addEventListener("click", () => {
      openRecordById(button.dataset.detailId);
    });
  });
  hydrateGooglePhotoTargets(els.eventList);
}

function openRecordById(id) {
  const record = currentRecords().find((item) => String(item.id) === String(id));
  if (!record) return;
  if (state.mode === "events") {
    openEventDialog(record);
  } else {
    openPlaceDialog(record);
  }
}

function eventCard(event) {
  const dateRange = event.end_date && event.end_date !== event.start_date
    ? `${formatDate(event.start_date)} - ${formatDate(event.end_date)}`
    : formatDate(event.start_date);
  const time = [event.start_time, event.end_time].filter(Boolean).join(" - ");
  const image = mediaThumb(event.primary_image_url, event.title, categoryLabel(event.category), event.images, event);
  const venue = event.venue_name || event.area_label || event.address || "";
  const price = event.price_note || "";
  const dateLabel = formatDateRangeCompact(event) || dateRange;

  return `
    <article class="event-card has-image ${isCandidate(event) ? "is-candidate" : ""}" role="button" tabindex="0" data-card-id="${event.id}">
      ${image}
      <div class="date-box event-date-box">
        <strong>${escapeHtml(formatMonthDay(event.start_date))}</strong>
        <span>${escapeHtml(time || "時間は公式")}</span>
      </div>
      <div class="event-main">
        <p class="card-kicker">${escapeHtml(event.municipality || event.prefecture || "地域未設定")}</p>
        <h3 class="event-title">${escapeHtml(event.title)}</h3>
        <ul class="card-facts">
          <li><b>日程</b>${escapeHtml(dateLabel || "公式で確認")}</li>
          <li><b>時間</b>${escapeHtml(displayOrConfirm(time))}</li>
          <li><b>会場</b>${escapeHtml(displayOrConfirm(venue))}</li>
          <li><b>料金</b>${escapeHtml(displayOrConfirm(price))}</li>
        </ul>
        <div class="event-meta">
          <span class="pill category">${escapeHtml(categoryLabel(event.category))}</span>
          ${statusPill(event)}
        </div>
        <p class="summary">${escapeHtml(event.summary || "")}</p>
        <p class="card-trust">${escapeHtml(trustLine(event))}</p>
      </div>
    </article>
  `;
}

function placeCard(place) {
  const image = mediaThumb(place.primary_image_url, place.name, placeTypeLabel(place.place_type), place.images, place);
  const age = place.target_age_note || "";
  const price = place.price_note || "";
  const hours = place.hours_note || "";
  const indoorOutdoor = indoorOutdoorLabel(place.indoor_outdoor);
  return `
    <article class="event-card has-image ${isCandidate(place) ? "is-candidate" : ""}" role="button" tabindex="0" data-card-id="${place.id}">
      ${image}
      <div class="date-box place-box">
        <strong>${escapeHtml(indoorOutdoor)}</strong>
      </div>
      <div class="event-main">
        <p class="card-kicker">${escapeHtml(place.municipality || place.prefecture || "地域未設定")}</p>
        <h3 class="event-title">${escapeHtml(place.name)}</h3>
        <ul class="card-facts">
          <li><b>対象</b>${escapeHtml(displayOrConfirm(compactText(age, 36)))}</li>
          <li><b>時間</b>${escapeHtml(displayOrConfirm(compactText(hours, 36)))}</li>
          <li><b>料金</b>${escapeHtml(displayOrConfirm(compactText(price, 36)))}</li>
          <li><b>駐車場</b>${escapeHtml(displayOrConfirm(compactText(place.parking_note, 36)))}</li>
        </ul>
        <div class="event-meta">
          <span class="pill category">${escapeHtml(placeTypeLabel(place.place_type))}</span>
          ${statusPill(place)}
        </div>
        <p class="summary">${escapeHtml(place.features || "")}</p>
        <p class="card-trust">${escapeHtml(trustLine(place))}</p>
      </div>
    </article>
  `;
}

function openEventDialog(event) {
  const dateLong = formatDateRange(event);
  const dateShort = formatDateRangeCompact(event);
  const time = [event.start_time, event.end_time].filter(Boolean).join(" - ");
  const location = [event.prefecture, event.municipality].filter(Boolean).join(" / ");
  const ageLabels = displayAgeLabels(event);
  const facts = [
    detailFact("開催日", dateShort, { fallback: "公式で確認" }),
    detailFact("時間", time, { fallback: "公式で確認" }),
    detailFact("会場", event.venue_name, { fallback: "公式で確認" }),
    detailFact("料金", event.price_note, { fallback: "公式で確認" }),
    detailFact("駐車場", event.parking_note, { fallback: "公式で確認" }),
    detailFact("予約", event.reservation_note, { fallback: "公式で確認" }),
    detailFact("最終確認", formatVerifiedDate(event.last_verified_at), { fallback: "未設定" }),
  ].join("");
  const official = officialUrl(event);

  els.dialogBody.innerHTML = `
    <div class="dialog-content dialog-detail">
      ${dialogImage(event.primary_image_url, event.title, event)}
      <div class="dialog-main">
        <p class="dialog-kicker">${escapeHtml(location || "群馬県")} · ${escapeHtml(categoryLabel(event.category))}${event.area_label ? ` · ${escapeHtml(event.area_label)}` : ""}</p>
        <h2>${escapeHtml(event.title)}</h2>
        <div class="detail-fact-strip">${facts}</div>
        ${ageLabels.length ? `<div class="detail-tag-row">${ageLabels.map((label) => `<span class="pill">${escapeHtml(label)}</span>`).join("")}</div>` : ""}
        ${isCandidate(event) ? `<p class="trust-banner">情報は未確認の候補です。公式ページで最新をご確認ください。</p>` : ""}
        ${detailParagraph("概要", event.summary)}
        ${detailParagraph("補足", event.notes)}
        ${photoGallery(event.images, event.title)}
        ${detailSection("会場・アクセス", [
          ["住所", event.address || "公式で確認"],
          ["地域", location],
          ["エリア", event.area_label],
          ["駐車場", event.parking_note || "公式で確認"],
          ["予約", event.reservation_note || "公式で確認"],
        ])}
        ${detailSection("主催・情報元", [
          ["主催", event.organizer],
          ["カテゴリ", categoryLabel(event.category)],
          ["開催期間", dateLong !== dateShort ? dateLong : ""],
          ["ソース", event.source_names],
          ["最終確認", formatVerifiedDate(event.last_verified_at) || event.last_verified_at || "未設定"],
        ])}
      </div>
      <div class="dialog-actions">
        ${official ? `<a class="primary-button" href="${escapeHtml(official)}" target="_blank" rel="noreferrer">公式ページで最新を確認</a>` : `<span class="trust-banner">公式URL未登録のため、主催・会場へ直接ご確認ください。</span>`}
        <button class="secondary-button" type="button" data-share-id="${escapeHtml(String(event.id))}" data-share-kind="event">共有</button>
        ${mapsUrl(event) ? `<a class="secondary-button" href="${escapeHtml(mapsUrl(event))}" target="_blank" rel="noreferrer">${iconMapPin()}地図</a>` : ""}
        <a class="secondary-button" href="./events/${encodeURIComponent(event.id)}.html">詳細ページ</a>
      </div>
    </div>
  `;

  lockDialogScroll();
  els.eventDialog.showModal();
  hydrateGooglePhotoTargets(els.dialogBody);
}

function openPlaceDialog(place) {
  const location = [place.prefecture, place.municipality].filter(Boolean).join(" / ");
  const ageLabels = displayAgeLabels(place);
  const facts = [
    detailFact("対象", compactText(place.target_age_note, 42), { fallback: "公式で確認" }),
    detailFact("料金", compactText(place.price_note, 42), { fallback: "公式で確認" }),
    detailFact("時間", compactText(place.hours_note, 42), { fallback: "公式で確認" }),
    detailFact("屋内/屋外", indoorOutdoorLabel(place.indoor_outdoor), { fallback: "公式で確認" }),
    detailFact("駐車場", compactText(place.parking_note, 42), { fallback: "公式で確認" }),
    detailFact("予約", compactText(place.reservation_note, 42), { fallback: "公式で確認" }),
    detailFact("最終確認", formatVerifiedDate(place.last_verified_at), { fallback: "未設定" }),
  ].join("");
  const official = officialUrl(place);

  els.dialogBody.innerHTML = `
    <div class="dialog-content dialog-detail">
      ${dialogImage(place.primary_image_url, place.name, place)}
      <div class="dialog-main">
        <p class="dialog-kicker">${escapeHtml(location || "群馬県")} · ${escapeHtml(placeTypeLabel(place.place_type))} · ${escapeHtml(indoorOutdoorLabel(place.indoor_outdoor))}</p>
        <h2>${escapeHtml(place.name)}</h2>
        <div class="detail-fact-strip">${facts}</div>
        ${ageLabels.length ? `<div class="detail-tag-row">${ageLabels.map((label) => `<span class="pill">${escapeHtml(label)}</span>`).join("")}</div>` : ""}
        ${isCandidate(place) ? `<p class="trust-banner">情報は未確認の候補です。公式ページで最新をご確認ください。</p>` : ""}
        ${detailParagraph("特徴", place.features)}
        ${detailParagraph("補足", place.notes)}
        ${photoGallery(place.images, place.name)}
        ${detailSection("利用案内", [
          ["対象", place.target_age_note || "公式で確認"],
          ["料金", place.price_note || "公式で確認"],
          ["利用時間", place.hours_note || "公式で確認"],
          ["休み", place.closed_note || "公式で確認"],
          ["予約", place.reservation_note || "公式で確認"],
          ["種類", placeTypeLabel(place.place_type)],
        ])}
        ${detailSection("アクセス・設備", [
          ["住所", place.address || "公式で確認"],
          ["地域", location],
          ["エリア", place.area_label],
          ["駐車場", place.parking_note || "公式で確認"],
          ["食事", place.food_note],
          ["授乳等", place.nursing_note],
          ["ベビーカー", place.stroller_note],
        ])}
        ${detailSection("情報元", [
          ["ソース", place.source_names],
          ["最終確認", formatVerifiedDate(place.last_verified_at) || place.last_verified_at || "未設定"],
        ])}
      </div>
      <div class="dialog-actions">
        ${official ? `<a class="primary-button" href="${escapeHtml(official)}" target="_blank" rel="noreferrer">公式ページで最新を確認</a>` : `<span class="trust-banner">公式URL未登録のため、施設へ直接ご確認ください。</span>`}
        <button class="secondary-button" type="button" data-share-id="${escapeHtml(String(place.id))}" data-share-kind="place">共有</button>
        ${mapsUrl(place) ? `<a class="secondary-button" href="${escapeHtml(mapsUrl(place))}" target="_blank" rel="noreferrer">${iconMapPin()}地図</a>` : ""}
        <a class="secondary-button" href="./places/${encodeURIComponent(place.id)}.html">詳細ページ</a>
      </div>
    </div>
  `;

  lockDialogScroll();
  els.eventDialog.showModal();
  hydrateGooglePhotoTargets(els.dialogBody);
}

function closeRecordDialog() {
  if (!els.eventDialog.open) return;
  els.eventDialog.close();
}

function lockDialogScroll() {
  if (!document.body.classList.contains("dialog-open")) {
    dialogScrollY = window.scrollY || window.pageYOffset || 0;
  }
  document.documentElement.style.setProperty("--dialog-scroll-y", `-${dialogScrollY}px`);
  document.body.classList.add("dialog-open");
}

function unlockDialogScroll() {
  if (!document.body.classList.contains("dialog-open")) return;
  document.body.classList.remove("dialog-open");
  document.documentElement.style.removeProperty("--dialog-scroll-y");
  window.scrollTo(0, dialogScrollY);
}

function detailFact(label, value, { fallback = "" } = {}) {
  const raw = String(value || "").trim();
  const text = raw || fallback;
  if (!text) return "";
  const missing = !raw;
  return `<span class="${missing ? "is-missing" : ""}"><b>${escapeHtml(label)}</b>${escapeHtml(text)}</span>`;
}

function displayOrConfirm(value) {
  const text = String(value || "").trim();
  return text || "公式で確認";
}

function detailParagraph(title, text) {
  if (!text) return "";
  return `
    <section class="detail-section">
      <h3>${escapeHtml(title)}</h3>
      <p class="detail-copy">${escapeHtml(text)}</p>
    </section>
  `;
}

function detailSection(title, rows) {
  const filled = rows.filter(([, value]) => value);
  if (!filled.length) return "";
  return `
    <section class="detail-section">
      <h3>${escapeHtml(title)}</h3>
      <dl class="detail-grid">
        ${filled.map(([label, value]) => `<dt>${escapeHtml(label)}</dt><dd>${escapeHtml(value)}</dd>`).join("")}
      </dl>
    </section>
  `;
}

function compactText(value, limit = 40) {
  const text = String(value || "").replace(/\s+/g, " ").trim();
  if (!text) return "";
  if (text.length <= limit) return text;
  return `${text.slice(0, limit - 1).trim()}…`;
}

function formatDateRange(event) {
  const start = formatDateLong(event.start_date);
  if (!start) return "";
  if (event.end_date && event.end_date !== event.start_date) {
    return `${start} 〜 ${formatDateLong(event.end_date)}`;
  }
  return start;
}

function formatDateRangeCompact(event) {
  const start = formatDateCompact(event.start_date);
  if (!start) return "";
  if (event.end_date && event.end_date !== event.start_date) {
    const sameYear = String(event.start_date).slice(0, 4) === String(event.end_date).slice(0, 4);
    return `${start} 〜 ${formatDateCompact(event.end_date, { includeYear: !sameYear })}`;
  }
  return start;
}

function formatDateLong(value) {
  if (!value) return "";
  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) return formatDate(value);
  const week = ["日", "月", "火", "水", "木", "金", "土"][new Date(Date.UTC(year, month - 1, day)).getUTCDay()];
  return `${year}年${month}月${day}日（${week}）`;
}

function formatDateCompact(value, { includeYear = true } = {}) {
  if (!value) return "";
  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) return formatDate(value);
  const week = ["日", "月", "火", "水", "木", "金", "土"][new Date(Date.UTC(year, month - 1, day)).getUTCDay()];
  if (!includeYear) return `${month}/${day}（${week}）`;
  return `${year}/${month}/${day}（${week}）`;
}

function displayAgeLabels(record) {
  const text = ageSearchText(record);
  const explicit = ageGroups.some((group) => agePatterns[group.id].test(text));
  const hasCue =
    explicit ||
    openAgePattern.test(text) ||
    familyAgePattern.test(text) ||
    record.category === "kids";
  if (!hasCue) return [];
  return detectAgeTags(record)
    .map((id) => ageGroups.find((group) => group.id === id)?.label)
    .filter(Boolean);
}

function mediaThumb(url, alt, fallbackLabel, images = [], record = {}) {
  const googlePlaceId = googlePhotoCandidate(record) ? record.google_place_id : "";
  const extraCount = Math.max(0, (images || []).length - 1);
  return `
    <div class="media-thumb ${url ? "" : googlePlaceId ? "is-google-pending" : "is-empty"}" ${googlePlaceId ? `data-google-place-id="${escapeHtml(googlePlaceId)}" data-google-photo-alt="${escapeHtml(alt)}"` : ""}>
      <span>${escapeHtml(fallbackLabel || "画像")}</span>
      ${extraCount ? `<em class="photo-count">+${extraCount}</em>` : ""}
      ${url ? `<img src="${escapeHtml(url)}" alt="${escapeHtml(alt)}" loading="lazy" decoding="async" referrerpolicy="no-referrer" onload="this.closest('.media-thumb').classList.add('is-loaded')" onerror="this.closest('.media-thumb').classList.add('is-failed')">` : ""}
    </div>
  `;
}

function dialogImage(url, alt, record = {}) {
  const googlePlaceId = googlePhotoCandidate(record) ? record.google_place_id : "";
  if (!url && !googlePlaceId) return "";
  return `
    <div class="dialog-image ${url ? "" : "is-google-pending"}" ${googlePlaceId ? `data-google-place-id="${escapeHtml(googlePlaceId)}" data-google-photo-alt="${escapeHtml(alt)}"` : ""}>
      ${url ? `<img src="${escapeHtml(url)}" alt="${escapeHtml(alt)}" referrerpolicy="no-referrer" onerror="this.closest('.dialog-image').hidden=true">` : `<span>${escapeHtml(alt)}</span>`}
    </div>
  `;
}

function googlePhotoCandidate(record = {}) {
  if (!record.google_place_id || !googleMapsApiKey()) return false;
  const images = record.images || [];
  return !record.primary_image_url || images.length < 2 || isLikelyLowQualityImage(record.primary_image_url);
}

function isLikelyLowQualityImage(url = "") {
  return /(?:[-_](?:150|176|225|250|300)x|s100x100|capture\.jpg|ogp|noimage|header|logo|qr)/i.test(url);
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

function photoGallery(images = [], alt) {
  const uniqueImages = filterRelevantImages(uniqueImagesByVisual(images), alt);
  if (uniqueImages.length <= 1) return "";
  return `
    <div class="photo-gallery" aria-label="写真ギャラリー">
      ${uniqueImages
        .slice(1, 5)
        .map((image) => `
          <a href="${escapeHtml(image.source_page_url || image.image_url)}" target="_blank" rel="noreferrer" class="gallery-thumb">
            <img src="${escapeHtml(image.image_url)}" alt="${escapeHtml(image.alt_text || alt)}" loading="lazy" decoding="async" referrerpolicy="no-referrer">
          </a>
        `)
        .join("")}
    </div>
  `;
}

function filterRelevantImages(images = [], title = "") {
  if (images.length <= 1) return images;
  const key = String(title || "")
    .replace(/[\s\u3000]/g, "")
    .replace(/[！？!?\d０-９]+/g, "");
  if (key.length < 4) return images.slice(0, 2);

  const needle = key.slice(0, Math.min(10, key.length));
  const matched = images.filter((image, index) => {
    if (index === 0) return true;
    const alt = String(image.alt_text || "").replace(/[\s\u3000]/g, "");
    if (!alt) return false;
    return alt.includes(needle) || needle.includes(alt.slice(0, Math.min(6, alt.length)));
  });

  // 関連画像がヒーロー以外にない場合は誤関連サムネを出さない
  return matched.length > 1 ? matched : images.slice(0, 1);
}

function uniqueImagesByVisual(images = []) {
  const seen = new Set();
  return images.filter((image) => {
    if (!image || !image.image_url) return false;
    const key = imageVisualKey(image);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function imageVisualKey(image) {
  const url = image.image_url || "";
  const path = decodeURIComponent(url.split("?")[0]).split("/").pop() || url;
  const filenameKey = path
    .toLowerCase()
    .replace(/\.(jpe?g|png|webp|gif|svg)$/i, "")
    .replace(/(-|_)(scaled|thumb|thumbnail|small|medium|large)/gi, "")
    .replace(/[-_]\d{2,5}x(\d{2,5}|auto)([-_]\d+)?/gi, "")
    .replace(/@\dx|_pc|_sp|_webp|s-\d+x\d+_v-fs_webp/gi, "")
    .replace(/[^a-z0-9]+/gi, "-")
    .replace(/^-|-$/g, "");
  if (filenameKey) return `file:${filenameKey}`;

  const altKey = (image.alt_text || image.title || "")
    .toLowerCase()
    .replace(/\.(jpe?g|png|webp|gif|svg)$/i, "")
    .replace(/[\s\u3000]+/g, "")
    .replace(/[^\w\u3040-\u30ff\u3400-\u9fff]+/g, "");
  return altKey.length >= 10 ? `alt:${altKey}` : `url:${url}`;
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

function officialUrl(record) {
  return record.canonical_url || record.official_url || "";
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

function formatVerifiedDate(value) {
  if (!value) return "";
  const raw = String(value).slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) return String(value);
  const [, month, day] = raw.split("-");
  return `${Number(month)}/${Number(day)}確認`;
}

function trustLine(record) {
  const parts = [];
  const verified = formatVerifiedDate(record.last_verified_at);
  if (verified) parts.push(verified);
  if (isCandidate(record)) parts.push("要確認");
  else if (record.status === "verified") parts.push("確認済み");
  return parts.join(" · ") || "確認日未設定";
}

function statusPill(record) {
  if (!isCandidate(record)) return "";
  return `<span class="pill warn">要確認</span>`;
}

function siteOrigin() {
  if (typeof location !== "undefined" && location.origin && location.origin !== "null") {
    return location.origin;
  }
  return "https://aso-aso.com";
}

function recordPermalink(record, kind) {
  const type = kind || (record.place_type != null || record.target_age_note != null ? "place" : "event");
  const folder = type === "place" ? "places" : "events";
  return `${siteOrigin()}/${folder}/${encodeURIComponent(record.id)}.html`;
}

function shareText(record, kind) {
  const type = kind || (record.place_type != null || record.target_age_note != null ? "place" : "event");
  const title = type === "place" ? record.name : record.title;
  const where = record.municipality || record.prefecture || "群馬県";
  const when =
    type === "event" && record.start_date
      ? formatDateCompact(record.start_date)
      : indoorOutdoorLabel(record.indoor_outdoor);
  const url = recordPermalink(record, type);
  return `${title}（${where} / ${when}）\n${url}\n#群馬イベントナビ`;
}

async function shareRecordById(id, kind) {
  const record =
    kind === "place"
      ? state.data.child_play_places.find((item) => String(item.id) === String(id))
      : state.data.events.find((item) => String(item.id) === String(id)) ||
        state.data.child_play_places.find((item) => String(item.id) === String(id));
  if (!record) return;

  const text = shareText(record, kind);
  const url = recordPermalink(record, kind);
  try {
    if (navigator.share) {
      await navigator.share({ title: record.title || record.name, text, url });
      return;
    }
  } catch (error) {
    if (error && error.name === "AbortError") return;
  }

  try {
    await navigator.clipboard.writeText(text);
    const button = els.dialogBody.querySelector(`[data-share-id="${String(id).replace(/"/g, "")}"]`);
    if (button) {
      const original = button.textContent;
      button.textContent = "コピー済み";
      setTimeout(() => {
        button.textContent = original;
      }, 1600);
    }
  } catch (_error) {
    window.prompt("共有用テキストをコピーしてください", text);
  }
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

function mapsUrl(record) {
  const name = record.venue_name || record.name || "";
  const query = record.address || [name, record.municipality, record.prefecture].filter(Boolean).join(" ");
  if (!query) return "";
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}

function iconMapPin() {
  return `<svg class="btn-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path fill="currentColor" d="M12 2c-3.9 0-7 3.1-7 7 0 5.3 7 13 7 13s7-7.7 7-13c0-3.9-3.1-7-7-7zm0 9.5A2.5 2.5 0 1 1 12 6.5a2.5 2.5 0 0 1 0 5z"/></svg>`;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
