const TODAY = todayInTimeZone("Asia/Tokyo");
const googlePhotoCache = new Map();

const state = {
  data: null,
  mode: "events",
  query: "",
  municipality: "all",
  category: "all",
  status: "all",
  dateScope: "upcoming",
  sort: "date",
  filtersOpen: false,
  motenashiOnly: false,
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

const els = {};

document.addEventListener("DOMContentLoaded", async () => {
  bindElements();
  bindEvents();

  try {
    await loadOptionalConfig();
    state.data = await loadData();
    applyInitialSearchQuery();
    populateFilters();
    render();
  } catch (error) {
    renderLoadError(error);
  }
});

async function loadOptionalConfig() {
  window.APP_CONFIG = window.APP_CONFIG || {};
}

function applyInitialSearchQuery() {
  const query = new URLSearchParams(window.location.search).get("q");
  if (!query) return;
  state.query = query.trim().toLowerCase();
  els.searchInput.value = query.trim();
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
  els.resultCount.textContent = "0件";
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
    "categoryFieldLabel",
    "categorySelect",
    "resetButton",
    "coverageList",
    "gunmaMap",
    "clearMapSelection",
    "resultCount",
    "dateChips",
    "categoryChips",
    "sortDateButton",
    "sortAreaButton",
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
      state.municipality = "all";
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

  els.categorySelect.addEventListener("change", (event) => {
    state.category = event.target.value;
    render();
  });

  els.dateChips.addEventListener("click", (event) => {
    const button = event.target.closest("[data-date-scope]");
    if (!button) return;
    setDateScope(button.dataset.dateScope);
  });

  els.categoryChips.addEventListener("click", (event) => {
    const button = event.target.closest("[data-category]");
    if (!button) return;
    state.category = button.dataset.category;
    els.categorySelect.value = state.category;
    render();
  });

  els.coverageList.addEventListener("click", (event) => {
    const item = event.target.closest("[data-municipality]");
    if (!item) return;
    setMunicipality(item.dataset.municipality, { scroll: true });
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

  els.sortDateButton.addEventListener("click", () => {
    state.sort = "date";
    els.sortDateButton.classList.add("is-active");
    els.sortAreaButton.classList.remove("is-active");
    render();
  });

  els.sortAreaButton.addEventListener("click", () => {
    state.sort = "area";
    els.sortAreaButton.classList.add("is-active");
    els.sortDateButton.classList.remove("is-active");
    render();
  });

  els.resetButton.addEventListener("click", () => {
    state.query = "";
    state.municipality = "all";
    state.category = "all";
    state.status = "all";
    state.dateScope = "upcoming";
    state.sort = "date";
    state.motenashiOnly = false;
    els.searchInput.value = "";
    els.categorySelect.value = "all";
    els.sortDateButton.classList.add("is-active");
    els.sortAreaButton.classList.remove("is-active");
    populateMunicipalities();
    render();
  });

  els.closeDialog.addEventListener("click", () => els.eventDialog.close());
  els.eventDialog.addEventListener("click", (event) => {
    if (event.target === els.eventDialog) {
      els.eventDialog.close();
    }
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
  renderDateChips();
  renderCategoryChips();
  renderCoverage();
  renderMapSelection();
  renderList(sorted);
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

function renderCoverage() {
  const records = currentRecords();
  const counts = new Map();
  records.forEach((record) => counts.set(record.municipality || "未設定", (counts.get(record.municipality || "未設定") || 0) + 1));
  const max = Math.max(...counts.values(), 1);

  els.coverageList.innerHTML = Array.from(counts.entries())
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
    .join("");
}

function renderList(records) {
  els.resultCount.textContent = `${records.length}件`;

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
  const venue = event.venue_name || event.area_label || event.address || "会場未設定";
  const price = event.price_note || "料金未設定";

  return `
    <article class="event-card ${event.primary_image_url ? "has-image" : ""}" role="button" tabindex="0" data-card-id="${event.id}">
      ${image}
      <div class="date-box event-date-box">
        <strong>${escapeHtml(formatMonthDay(event.start_date))}</strong>
        <span>${escapeHtml(time || dateRange)}</span>
      </div>
      <div class="event-main">
        <p class="card-kicker">${escapeHtml(event.municipality || event.prefecture || "地域未設定")} / ${escapeHtml(venue)}</p>
        <h3 class="event-title">${escapeHtml(event.title)}</h3>
        <div class="event-meta">
          <span class="pill category">${escapeHtml(categoryLabel(event.category))}</span>
          <span class="pill neutral">${escapeHtml(price)}</span>
        </div>
        <p class="summary">${escapeHtml(event.summary || event.venue_name || "")}</p>
      </div>
      <div class="event-actions">
        <a class="primary-button detail-icon-button" href="./events/${encodeURIComponent(event.id)}.html" aria-label="${escapeHtml(event.title)}の詳細ページを見る">詳細</a>
      </div>
    </article>
  `;
}

function placeCard(place) {
  const image = mediaThumb(place.primary_image_url, place.name, placeTypeLabel(place.place_type), place.images, place);
  const age = place.target_age_note || "対象年齢は公式確認";
  const price = place.price_note || "料金未設定";
  return `
    <article class="event-card ${place.primary_image_url ? "has-image" : ""}" role="button" tabindex="0" data-card-id="${place.id}">
      ${image}
      <div class="date-box place-box">
        <strong>${escapeHtml(indoorOutdoorLabel(place.indoor_outdoor))}</strong>
        <span>${escapeHtml(price)}</span>
      </div>
      <div class="event-main">
        <p class="card-kicker">${escapeHtml(place.municipality || place.prefecture || "地域未設定")} / ${escapeHtml(age)}</p>
        <h3 class="event-title">${escapeHtml(place.name)}</h3>
        <div class="event-meta">
          <span class="pill category">${escapeHtml(placeTypeLabel(place.place_type))}</span>
          <span class="pill neutral">${escapeHtml(price)}</span>
        </div>
        <p class="summary">${escapeHtml(place.features || place.target_age_note || "")}</p>
      </div>
      <div class="event-actions">
        <a class="primary-button detail-icon-button" href="./places/${encodeURIComponent(place.id)}.html" aria-label="${escapeHtml(place.name)}の詳細ページを見る">詳細</a>
      </div>
    </article>
  `;
}

function openEventDialog(event) {
  const date = event.end_date && event.end_date !== event.start_date
    ? `${formatDate(event.start_date)} - ${formatDate(event.end_date)}`
    : formatDate(event.start_date);
  const time = [event.start_time, event.end_time].filter(Boolean).join(" - ") || "未設定";

  els.dialogBody.innerHTML = `
    <div class="dialog-content">
      ${dialogImage(event.primary_image_url, event.title, event)}
      ${photoGallery(event.images, event.title)}
      <h2>${escapeHtml(event.title)}</h2>
      <div class="event-meta">
        <span class="pill">${escapeHtml(event.prefecture)} / ${escapeHtml(event.municipality || "未設定")}</span>
        <span class="pill category">${escapeHtml(categoryLabel(event.category))}</span>
      </div>
      <div class="detail-quick-facts">
        <span><b>日付</b>${escapeHtml(date)}</span>
        <span><b>時間</b>${escapeHtml(time)}</span>
        <span><b>会場</b>${escapeHtml(event.venue_name || "未設定")}</span>
        <span><b>料金</b>${escapeHtml(event.price_note || "未設定")}</span>
      </div>
      <p class="summary">${escapeHtml(event.summary || "")}</p>
      <dl class="detail-grid">
        <dt>会場</dt><dd>${escapeHtml(event.venue_name || "未設定")}</dd>
        <dt>住所</dt><dd>${escapeHtml(event.address || "未設定")}</dd>
        <dt>料金</dt><dd>${escapeHtml(event.price_note || "未設定")}</dd>
        <dt>主催</dt><dd>${escapeHtml(event.organizer || "未設定")}</dd>
        <dt>ソース</dt><dd>${escapeHtml(event.source_names || "未設定")}</dd>
      </dl>
      <div class="dialog-actions">
        ${mapsUrl(event) ? `<a class="secondary-button" href="${escapeHtml(mapsUrl(event))}" target="_blank" rel="noreferrer">${iconMapPin()}地図で見る</a>` : ""}
        ${event.canonical_url ? `<a class="primary-button" href="${escapeHtml(event.canonical_url)}" target="_blank" rel="noreferrer">公式ページ</a>` : ""}
      </div>
    </div>
  `;

  els.eventDialog.showModal();
  hydrateGooglePhotoTargets(els.dialogBody);
}

function openPlaceDialog(place) {
  els.dialogBody.innerHTML = `
    <div class="dialog-content">
      ${dialogImage(place.primary_image_url, place.name, place)}
      ${photoGallery(place.images, place.name)}
      <h2>${escapeHtml(place.name)}</h2>
      <div class="event-meta">
        <span class="pill">${escapeHtml(place.prefecture)} / ${escapeHtml(place.municipality || "未設定")}</span>
        <span class="pill category">${escapeHtml(placeTypeLabel(place.place_type))}</span>
      </div>
      <div class="detail-quick-facts">
        <span><b>対象</b>${escapeHtml(place.target_age_note || "未設定")}</span>
        <span><b>屋内/屋外</b>${escapeHtml(indoorOutdoorLabel(place.indoor_outdoor))}</span>
        <span><b>料金</b>${escapeHtml(place.price_note || "未設定")}</span>
        <span><b>時間</b>${escapeHtml(place.hours_note || "未設定")}</span>
      </div>
      <p class="summary">${escapeHtml(place.features || "")}</p>
      <dl class="detail-grid">
        <dt>住所</dt><dd>${escapeHtml(place.address || "未設定")}</dd>
        <dt>休み</dt><dd>${escapeHtml(place.closed_note || "未設定")}</dd>
        <dt>授乳等</dt><dd>${escapeHtml(place.nursing_note || "未設定")}</dd>
        <dt>駐車場</dt><dd>${escapeHtml(place.parking_note || "未設定")}</dd>
        <dt>ソース</dt><dd>${escapeHtml(place.source_names || "未設定")}</dd>
      </dl>
      <div class="dialog-actions">
        ${mapsUrl(place) ? `<a class="secondary-button" href="${escapeHtml(mapsUrl(place))}" target="_blank" rel="noreferrer">${iconMapPin()}地図で見る</a>` : ""}
        ${place.official_url ? `<a class="primary-button" href="${escapeHtml(place.official_url)}" target="_blank" rel="noreferrer">公式ページ</a>` : ""}
      </div>
    </div>
  `;

  els.eventDialog.showModal();
  hydrateGooglePhotoTargets(els.dialogBody);
}

function mediaThumb(url, alt, fallbackLabel, images = [], record = {}) {
  const googlePlaceId = googlePhotoCandidate(record) ? record.google_place_id : "";
  if (!url && !googlePlaceId) return "";
  const extraCount = Math.max(0, (images || []).length - 1);
  return `
    <div class="media-thumb ${url ? "" : "is-google-pending"}" ${googlePlaceId ? `data-google-place-id="${escapeHtml(googlePlaceId)}" data-google-photo-alt="${escapeHtml(alt)}"` : ""}>
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
      ${url ? `<img src="${escapeHtml(url)}" alt="${escapeHtml(alt)}" referrerpolicy="no-referrer">` : `<span>${escapeHtml(alt)}</span>`}
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
  const uniqueImages = uniqueImagesByVisual(images).slice(0, 8);
  if (uniqueImages.length <= 1) return "";
  return `
    <div class="photo-gallery" aria-label="写真ギャラリー">
      ${uniqueImages
        .slice(1)
        .map((image) => `
          <a href="${escapeHtml(image.source_page_url || image.image_url)}" target="_blank" rel="noreferrer" class="gallery-thumb">
            <img src="${escapeHtml(image.image_url)}" alt="${escapeHtml(image.alt_text || alt)}" loading="lazy" decoding="async" referrerpolicy="no-referrer">
          </a>
        `)
        .join("")}
    </div>
  `;
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
