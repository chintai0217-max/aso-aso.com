const TODAY = todayInTimeZone("Asia/Tokyo");
const googlePhotoCache = new Map();

const state = {
  data: null,
  mode: "events",
  query: "",
  prefecture: "all",
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
  els.metricEvents.textContent = "0";
  els.metricSources.textContent = "0";
  els.metricVerified.textContent = "0";
  els.resultCount.textContent = "0件";
  els.eventList.innerHTML = `
    <div class="empty-state">
      データを読み込めませんでした。ローカルで開く場合は同梱の data/events.js を確認してください。
    </div>
  `;
}

function bindElements() {
  [
    "metricEvents",
    "metricSources",
    "metricVerified",
    "topMotenashiButton",
    "modeEventsButton",
    "modePlacesButton",
    "filterToggleButton",
    "filterBody",
    "searchInput",
    "prefectureSelect",
    "municipalitySelect",
    "categoryFieldLabel",
    "categorySelect",
    "resetButton",
    "coverageList",
    "resultCount",
    "dateChips",
    "categoryChips",
    "sortDateButton",
    "sortAreaButton",
    "insights",
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

  els.prefectureSelect.addEventListener("change", (event) => {
    state.prefecture = event.target.value;
    state.municipality = "all";
    populateMunicipalities();
    render();
  });

  els.municipalitySelect.addEventListener("change", (event) => {
    state.municipality = event.target.value;
    render();
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
    state.prefecture = "群馬県";
    state.municipality = item.dataset.municipality;
    els.prefectureSelect.value = "群馬県";
    populateMunicipalities();
    render();
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
    state.prefecture = "all";
    state.municipality = "all";
    state.category = "all";
    state.status = "all";
    state.dateScope = "upcoming";
    state.sort = "date";
    state.motenashiOnly = false;
    els.searchInput.value = "";
    els.prefectureSelect.value = "all";
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

function setMotenashiOnly(value) {
  state.mode = "events";
  state.motenashiOnly = value;
  state.prefecture = "all";
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
  const records = currentRecords();
  const prefectures = unique(records.map((record) => record.prefecture).filter(Boolean));
  const categoryKey = state.mode === "events" ? "category" : "place_type";
  const categories = unique(records.map((record) => record[categoryKey]).filter(Boolean));
  els.categoryFieldLabel.textContent = state.mode === "events" ? "カテゴリ" : "種別";

  fillSelect(els.prefectureSelect, [["all", "すべて"]].concat(prefectures.map((item) => [item, item])));
  fillSelect(
    els.categorySelect,
    [["all", "すべて"]].concat(categories.map((item) => [item, state.mode === "events" ? categoryLabel(item) : placeTypeLabel(item)]))
  );
  populateMunicipalities();
}

function populateMunicipalities() {
  const records = currentRecords().filter((record) => {
    return state.prefecture === "all" || record.prefecture === state.prefecture;
  });
  const municipalities = unique(records.map((record) => record.municipality).filter(Boolean));
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
  renderMetrics();
  renderDateChips();
  renderCategoryChips();
  renderCoverage();
  renderInsights(sorted);
  renderList(sorted);
}

function renderMetrics() {
  els.metricEvents.textContent = state.data.events.length;
  els.metricSources.textContent = state.data.child_play_places.length;
  const municipalities = new Set(
    [...state.data.events, ...state.data.child_play_places]
      .map((record) => record.municipality)
      .filter(Boolean)
  );
  els.metricVerified.textContent = municipalities.size;
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
  const key = state.mode === "events" ? "category" : "place_type";
  const labelFn = state.mode === "events" ? categoryLabel : placeTypeLabel;
  const counts = new Map();
  recordsExceptCategory().forEach((record) => {
    const value = record[key];
    if (value) counts.set(value, (counts.get(value) || 0) + 1);
  });
  const entries = Array.from(counts.entries()).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "ja"));
  const chips = [
    `<button type="button" class="chip ${state.category === "all" ? "is-active" : ""}" data-category="all">すべて</button>`,
  ].concat(
    entries.map(
      ([value, count]) =>
        `<button type="button" class="chip ${state.category === value ? "is-active" : ""}" data-category="${escapeHtml(value)}">${escapeHtml(labelFn(value))}<em>${count}</em></button>`
    )
  );
  els.categoryChips.innerHTML = chips.join("");
}

function recordsExceptCategory() {
  const saved = state.category;
  state.category = "all";
  const records = filteredRecords();
  state.category = saved;
  return records;
}

function renderCoverage() {
  const gunma = currentRecords().filter((record) => record.prefecture === "群馬県");
  const counts = new Map();
  gunma.forEach((record) => counts.set(record.municipality || "未設定", (counts.get(record.municipality || "未設定") || 0) + 1));
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

function renderInsights(records) {
  const next = records[0];
  const municipalities = new Set(records.map((record) => record.municipality).filter(Boolean)).size;

  if (state.mode === "places") {
    const indoor = records.filter((place) => place.indoor_outdoor === "indoor" || place.indoor_outdoor === "both").length;
    const free = records.filter((place) => /無料/.test(place.price_note || "")).length;
    els.insights.innerHTML = [
      {
        title: "表示中の遊び場",
        text: `${records.length}件。小学生以下が楽しめる場所を集めました。`,
      },
      {
        title: "雨の日OK（屋内）",
        text: `${indoor}件。天気を気にせず行ける場所です。`,
      },
      {
        title: "無料で遊べる",
        text: `${free}件。お財布にやさしいスポット。`,
      },
    ]
      .map(insightCard)
      .join("");
    return;
  }

  const weekendCount = records.filter((event) => matchesWeekend(event)).length;
  const freeCount = records.filter((event) => /無料/.test(event.price_note || "")).length;
  const upcomingNext = state.dateScope === "past"
    ? next
    : records.find((event) => (event.start_date || "") >= TODAY) || next;
  els.insights.innerHTML = [
    {
      title: state.dateScope === "past" ? "直近の開催" : "次の開催",
      text: upcomingNext ? `${formatDate(upcomingNext.start_date)}／${upcomingNext.title}` : "該当なし",
    },
    {
      title: "今週末のイベント",
      text: `${weekendCount}件。${municipalities}市町村で開催予定。`,
    },
    {
      title: "入場無料",
      text: `${freeCount}件。気軽に立ち寄れます。`,
    },
  ]
    .map(insightCard)
    .join("");
}

function insightCard(item) {
  return `
    <article class="insight-card">
      <strong>${escapeHtml(item.title)}</strong>
      <span>${escapeHtml(item.text)}</span>
    </article>
  `;
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
        ${event.canonical_url ? `<a class="secondary-button" href="${escapeHtml(event.canonical_url)}" target="_blank" rel="noreferrer">公式</a>` : ""}
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
        ${place.official_url ? `<a class="secondary-button" href="${escapeHtml(place.official_url)}" target="_blank" rel="noreferrer">公式</a>` : ""}
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
        ${mapsUrl(event) ? `<a class="secondary-button" href="${escapeHtml(mapsUrl(event))}" target="_blank" rel="noreferrer">📍 地図で見る</a>` : ""}
        ${event.start_date ? `<button class="secondary-button" type="button" data-ics-id="${event.id}">📅 カレンダーに追加</button>` : ""}
        ${event.canonical_url ? `<a class="primary-button" href="${escapeHtml(event.canonical_url)}" target="_blank" rel="noreferrer">公式ページ</a>` : ""}
      </div>
    </div>
  `;

  els.eventDialog.showModal();
  const icsButton = els.dialogBody.querySelector("[data-ics-id]");
  if (icsButton) icsButton.addEventListener("click", () => downloadEventIcs(event));
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
        ${mapsUrl(place) ? `<a class="secondary-button" href="${escapeHtml(mapsUrl(place))}" target="_blank" rel="noreferrer">📍 地図で見る</a>` : ""}
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
    if (state.prefecture !== "all" && event.prefecture !== state.prefecture) return false;
    if (state.municipality !== "all" && event.municipality !== state.municipality) return false;
    if (state.category !== "all" && event.category !== state.category) return false;
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
    if (state.prefecture !== "all" && place.prefecture !== state.prefecture) return false;
    if (state.municipality !== "all" && place.municipality !== state.municipality) return false;
    if (state.category !== "all" && place.place_type !== state.category) return false;
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

function downloadEventIcs(event) {
  const ics = buildEventIcs(event);
  const blob = new Blob([ics], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${(event.title || "event").replace(/[\\/:*?"<>|]/g, "_")}.ics`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function buildEventIcs(event) {
  const start = event.start_date;
  const end = event.end_date || event.start_date;
  let dateLines;
  if (event.start_time) {
    const startLocal = icsLocalDateTime(start, event.start_time);
    const endLocal = icsLocalDateTime(end, event.end_time || event.start_time);
    dateLines = `DTSTART;TZID=Asia/Tokyo:${startLocal}\r\nDTEND;TZID=Asia/Tokyo:${endLocal}`;
  } else {
    dateLines = `DTSTART;VALUE=DATE:${start.replaceAll("-", "")}\r\nDTEND;VALUE=DATE:${icsDatePlus(end, 1)}`;
  }
  const location = [event.venue_name, event.address].filter(Boolean).join(" ");
  const description = [event.summary, event.canonical_url].filter(Boolean).join("\\n");
  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//gunma-event-navi//JP",
    "CALSCALE:GREGORIAN",
    "BEGIN:VEVENT",
    `UID:gunma-event-${event.id}@gunma-event-navi`,
    `DTSTAMP:${icsStamp()}`,
    dateLines,
    `SUMMARY:${icsEscape(event.title)}`,
    location ? `LOCATION:${icsEscape(location)}` : "",
    description ? `DESCRIPTION:${description}` : "",
    event.canonical_url ? `URL:${event.canonical_url}` : "",
    "END:VEVENT",
    "END:VCALENDAR",
  ]
    .filter(Boolean)
    .join("\r\n");
}

function icsStamp() {
  return new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
}

function icsLocalDateTime(date, time) {
  const [hour = "00", minute = "00"] = (time || "00:00").split(":");
  return `${date.replaceAll("-", "")}T${hour.padStart(2, "0")}${minute.padStart(2, "0")}00`;
}

function icsDatePlus(date, days) {
  const [year, month, day] = date.split("-").map(Number);
  const dt = new Date(Date.UTC(year, month - 1, day + days));
  return `${dt.getUTCFullYear()}${String(dt.getUTCMonth() + 1).padStart(2, "0")}${String(dt.getUTCDate()).padStart(2, "0")}`;
}

function icsEscape(value) {
  return String(value || "")
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r?\n/g, "\\n");
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
