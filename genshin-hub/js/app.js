/* 提瓦特纪行 · 前端逻辑 */
(function () {
  "use strict";

  const REGIONS = [
    { key: "蒙德", en: "Mondstadt", color: "#4bbf9e" },
    { key: "璃月", en: "Liyue", color: "#c9a24a" },
    { key: "稻妻", en: "Inazuma", color: "#8f6cf0" },
    { key: "须弥", en: "Sumeru", color: "#54a94b" },
    { key: "枫丹", en: "Fontaine", color: "#3f8ef0" },
    { key: "纳塔", en: "Natlan", color: "#ef6a4c" },
    { key: "至冬", en: "Snezhnaya", color: "#6fd2e0" }
  ];

  const regionColor = (name) => (REGIONS.find(r => r.key === name) || {}).color || "#d9b877";

  const state = {
    version: null,
    news: [],
    events: [],
    characters: [],
    reviews: null,
    story: null,
    currentView: "home",
    newsFilter: "all",
    regionFilter: "all",
    live: false
  };

  const $ = (sel, root) => (root || document).querySelector(sel);
  const $$ = (sel, root) => Array.from((root || document).querySelectorAll(sel));

  async function loadJSON(url) {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) throw new Error("load failed " + url);
    return res.json();
  }

  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }

  function imgTag(src, cls, alt) {
    const clean = esc(src || "");
    if (!clean) {
      return '<div class="ph ' + cls + '"></div>';
    }
    return '<img class="' + cls + '" src="' + clean + '" alt="' + esc(alt || "") +
      '" loading="lazy" referrerpolicy="no-referrer" onerror="this.parentElement.classList.add(\'no-img\');this.remove();" />';
  }

  async function bootstrap() {
    try {
      const [version, characters, news, events, reviews, story] = await Promise.all([
        loadJSON("data/version.json"),
        loadJSON("data/characters.json"),
        loadJSON("data/news.json"),
        loadJSON("data/events.json"),
        loadJSON("data/reviews.json"),
        loadJSON("data/story.json")
      ]);
      Object.assign(state, { version, characters, news, events, reviews, story });
      setLive(false, "快照模式");
      renderAll();
    } catch (e) {
      console.error(e);
      setLive(false, "加载失败");
    }
    bindEvents();
    tryLive();
  }

  function setLive(live, text) {
    state.live = live;
    const pill = $("#live-pill");
    pill.classList.toggle("off", !live);
    pill.classList.toggle("stale", !live);
    $("#live-text").textContent = text;
  }

  async function tryLive() {
    try {
      const res = await fetch("api/live", { cache: "no-store" });
      if (!res.ok) throw new Error("live unavailable");
      const data = await res.json();
      if (data && data.characters && data.characters.length) {
        Object.assign(state, {
          characters: data.characters,
          news: data.news,
          events: data.events,
          version: Object.assign({}, state.version, data.version || {})
        });
        const t = data.updated ? new Date(data.updated).toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" }) : "刚刚";
        setLive(true, "已同步 · " + t);
        renderAll();
      }
    } catch (e) {
      setLive(false, "快照模式");
    }
  }

  /* ---------------- rendering ---------------- */
  function renderAll() {
    renderHome();
    renderNews();
    renderChars();
    renderReviews();
    renderStory();
    updateFooter();
    observeReveals();
    buildIndex();
  }

  function renderHome() {
    const v = state.version || {};
    $("#hero-bg").style.backgroundImage = 'url("' + (v.hero || "assets/img/hero-7.0.jpg") + '")';
    requestAnimationFrame(() => setTimeout(() => $("#hero-bg").classList.add("zoom"), 120));
    $("#hero-tag").textContent = v.tagline || "";
    $("#hero-version").innerHTML = '当前版本 <b>' + esc(v.version) + '</b> · ' + esc(v.title || "") +
      '<span class="badge" style="margin-left:6px">' + esc((v.updated || "")) + ' 更新</span>';

    // stats
    const chars = state.characters.length;
    const regions = REGIONS.length;
    const newsCount = state.news.length;
    const eventsCount = state.events.length;
    $("#stat-strip").innerHTML = [
      ["角色", chars, "位可玩角色"],
      ["国度", regions, "片元素国度"],
      ["资讯", newsCount, "条官方动态"],
      ["活动", eventsCount, "场版本活动"]
    ].map(s => '<div class="stat"><div class="stat-num">' + s[1] + '</div><div class="stat-label">' + s[0] + ' · ' + s[2] + '</div></div>').join("");

    // home news (latest 6)
    $("#home-news").innerHTML = state.news.slice(0, 6).map(newsCard).join("");

    // featured characters (spread across regions)
    const featured = [];
    const perRegion = Math.ceil(8 / REGIONS.length);
    REGIONS.forEach(r => {
      state.characters.filter(c => c.region === r.key).slice(0, perRegion).forEach(c => featured.push(c));
    });
    $("#featured-chars").innerHTML = featured.slice(0, 8).map(c => {
      const src = c.portrait || c.avatar;
      return '<div class="feature-char" data-char="' + esc(c.name) + '">' +
        imgTag(src, "", c.name) +
        '<div class="fc-name"><div class="fc-region">' + esc(c.region) + ' · ' + esc(c.region_en) + '</div>' + esc(c.name) + '</div></div>';
    }).join("");

    // events preview
    $("#event-strip").innerHTML = state.events.slice(0, 6).map(ev =>
      '<div class="event-item" data-open="event" data-title="' + esc(ev.title) + '" data-cover="' + esc(ev.cover) + '">' +
      imgTag(ev.cover, "", ev.title) + '<div class="ev-title">' + esc(ev.title) + '</div></div>'
    ).join("");
  }

  function newsCard(n) {
    return '<article class="news-card" data-open="news" data-id="' + n.id + '">' +
      '<div class="news-thumb">' + imgTag(n.cover, "", n.title) + '</div>' +
      '<div class="news-body">' +
      '<div class="news-meta"><span class="badge ' + (n.kind === "公告" ? "alt" : "") + '">' + esc(n.kind) + '</span><span>' + esc(n.date) + '</span></div>' +
      '<h3 class="news-title">' + esc(n.title) + '</h3>' +
      '<p class="news-intro">' + esc(n.intro) + '</p>' +
      '</div></article>';
  }

  function renderNews() {
    const list = state.newsFilter === "all" ? state.news : state.news.filter(n => n.kind === state.newsFilter);
    $("#news-grid").innerHTML = list.map(newsCard).join("");
    $("#news-empty").hidden = list.length > 0;
  }

  function renderChars() {
    const list = state.regionFilter === "all" ? state.characters : state.characters.filter(c => c.region === state.regionFilter);
    $("#char-grid").innerHTML = list.map(c => {
      const src = c.portrait || c.avatar;
      return '<div class="char-card" data-char="' + esc(c.name) + '">' +
        imgTag(src, "cc-portrait", c.name) +
        '<div class="cc-veil"></div>' +
        '<div class="cc-info"><div class="cc-name">' + esc(c.name) + '</div>' +
        '<div class="cc-region"><i style="background:' + regionColor(c.region) + '"></i>' + esc(c.region) + ' · ' + esc(c.region_en) + '</div></div></div>';
    }).join("");

    // region tabs (built once)
    if (!$("#region-tabs").dataset.built) {
      $("#region-tabs").dataset.built = "1";
      const all = '<button class="region-tab is-active" data-region="all">全部</button>';
      const tabs = REGIONS.map(r => '<button class="region-tab" data-region="' + r.key + '"><span class="rt-dot" style="background:' + r.color + '"></span>' + r.key + '</button>').join("");
      $("#region-tabs").innerHTML = all + tabs;
    }
  }

  function starRow(n) {
    let s = "";
    for (let i = 0; i < 5; i++) s += i < n ? "★" : "☆";
    return '<div class="review-stars">' + s + '</div>';
  }

  function renderReviews() {
    const r = state.reviews;
    if (!r) return;
    const sum = r.summary || {};
    $("#review-summary").innerHTML =
      '<div><div class="rs-score"><span class="big">' + esc(sum.score) + '</span><span class="of">/ ' + (sum.scoreMax || 10) + '</span></div>' +
      '<div class="rs-label">' + esc(sum.label) + '</div>' +
      '<div class="rs-platforms">' + (r.platforms || []).map(p =>
        '<div class="rs-platform"><span>' + esc(p.name) + '</span><span class="bar"><i style="width:' + (p.score / p.max * 100) + '%"></i></span><span>' + esc(p.score) + '</span></div>'
      ).join("") + '</div></div>' +
      '<div><p class="rs-blurb">' + esc(sum.blurb) + '</p>' +
      '<div class="rs-tags">' + (sum.highlights || []).map(t => '<span class="rs-tag good">' + esc(t) + '</span>').join("") +
      (sum.concerns || []).map(t => '<span class="rs-tag bad">' + esc(t) + '</span>').join("") + '</div></div>';

    $("#review-grid").innerHTML = (r.reviews || []).map(rv =>
      '<div class="review-card">' + starRow(rv.rating) +
      '<div class="review-theme">' + esc(rv.theme) + '</div>' +
      '<div class="review-title">' + esc(rv.title) + '</div>' +
      '<div class="review-text">' + esc(rv.text) + '</div></div>'
    ).join("");

    renderLocalReviews();
    buildStarInput();
  }

  function renderStory() {
    const s = state.story;
    if (!s) return;
    const wv = s.worldview || {};
    $("#worldview").innerHTML =
      '<div class="wv-title">' + esc(wv.title) + '</div>' +
      '<div class="wv-sub">' + esc(wv.subtitle) + '</div>' +
      '<p class="wv-text">' + esc(wv.text) + '</p>' +
      '<div class="element-row">' + (wv.elements || []).map(e =>
        '<span class="element-chip"><i style="background:' + e.color + '"></i>' + esc(e.name) + ' ' + esc(e.en) + '</span>').join("") + '</div>';

    $("#nations").innerHTML = (s.nations || []).map(n =>
      '<div class="nation reveal" data-story="n_' + n.name + '"><div class="nt-head" style="--nc:' + n.color + '">' +
      '<div class="nt-name">' + esc(n.name) + '</div>' +
      '<div class="nt-en">' + esc(n.en) + '</div>' +
      '<div class="nt-element">' + esc(n.element) + ' · ' + esc(n.archon) + '</div></div>' +
      '<div class="nt-body"><div class="nt-quest">' + esc(n.quest) + '</div>' +
      '<p class="nt-summary">' + esc(n.summary) + '</p>' +
      '<div class="nt-archon">神明别名：' + esc(n.archonAlias) + '</div></div></div>'
    ).join("");

    $("#factions").innerHTML = (s.factions || []).map(f =>
      '<div class="faction reveal" data-story="f_' + f.name + '"><div class="fc-name">' + esc(f.name) + '</div>' +
      '<p class="fc-text">' + esc(f.text) + '</p></div>'
    ).join("");
  }

  function updateFooter() {
    const v = state.version || {};
    $("#footer-updated").textContent = "数据同步 · " + (v.updated || "—");
  }

  /* ---------------- local reviews ---------------- */
  function buildStarInput() {
    const box = $("#star-input");
    if (!box || box.dataset.built) return;
    box.dataset.built = "1";
    box.dataset.value = "5";
    box.innerHTML = [1, 2, 3, 4, 5].map(i => '<span class="si on" data-v="' + i + '">★</span>').join("");
    box.addEventListener("click", (e) => {
      const el = e.target.closest(".si");
      if (!el) return;
      const v = +el.dataset.v;
      box.dataset.value = v;
      $$(".si", box).forEach(x => x.classList.toggle("on", +x.dataset.v <= v));
    });
  }

  function renderLocalReviews() {
    const list = getLocalReviews();
    $("#local-reviews").innerHTML = list.length
      ? '<div class="section-head"><div class="eyebrow">MY NOTES</div><h3 class="section-title" style="font-size:22px">我的评价</h3></div>' +
        list.map(r => '<div class="local-review"><div class="lr-head"><span class="lr-nick">' + esc(r.nick || "旅行者") + '</span>' + starRow(r.rating) + '</div><p class="lr-text">' + esc(r.text) + '</p></div>').join("")
      : "";
  }

  function getLocalReviews() {
    try { return JSON.parse(localStorage.getItem("teyvat_reviews") || "[]"); } catch (e) { return []; }
  }
  function saveLocalReview(r) {
    const list = getLocalReviews();
    list.unshift(r);
    localStorage.setItem("teyvat_reviews", JSON.stringify(list.slice(0, 20)));
  }

  /* ---------------- modal ---------------- */
  function openNewsModal(id) {

    const n = state.news.find(x => String(x.id) === String(id));
    if (!n) return;
    const panel = $("#modal-panel");
    panel.innerHTML =
      '<button class="modal-close" data-close aria-label="关闭">✕</button>' +
      '<div class="modal-hero">' + imgTag(n.cover, "", n.title) + '</div>' +
      '<div class="modal-body"><div class="modal-kind">' + esc(n.kind) + ' · ' + esc(n.date) + '</div>' +
      '<h2 class="modal-title">' + esc(n.title) + '</h2>' +
      '<div class="modal-content">' + (n.content || '<p>' + esc(n.intro) + '</p>') + '</div></div>';
    openModal();
  }

  /* ---------------- search ---------------- */
  let searchIndex = [];

  function buildIndex() {
    searchIndex = [];
    state.news.forEach(n => searchIndex.push({ type: "新闻", title: n.title, snippet: n.intro || n.kind, cover: n.cover, id: n.id, text: (n.title + " " + (n.intro || "") + " " + n.kind + " " + n.date).toLowerCase() }));
    state.events.forEach(e => searchIndex.push({ type: "活动", title: e.title, snippet: e.date, cover: e.cover, id: e.id, text: (e.title + " 活动 " + e.date).toLowerCase() }));
    state.characters.forEach(c => searchIndex.push({ type: "角色", title: c.name, snippet: c.region + " · " + c.region_en + " · " + (c.cv_cn || c.cv_jp || ""), cover: c.portrait || c.avatar, id: c.name, text: (c.name + " " + c.region + " " + c.region_en + " " + (c.cv_cn || "") + " " + (c.cv_jp || "") + " " + (c.desc || "")).toLowerCase() }));
    if (state.story) {
      (state.story.nations || []).forEach(n => searchIndex.push({ type: "故事", title: n.name, snippet: n.en + " · " + n.element + " · " + n.archon, cover: "", target: "n_" + n.name, text: (n.name + " " + n.en + " " + n.element + " " + n.archon + " " + n.archonAlias + " " + (n.summary || "")).toLowerCase() }));
      (state.story.factions || []).forEach(f => searchIndex.push({ type: "故事", title: f.name, snippet: f.text, cover: "", target: "f_" + f.name, text: (f.name + " " + (f.text || "")).toLowerCase() }));
    }
    (state.reviews && state.reviews.reviews || []).forEach(r => searchIndex.push({ type: "评价", title: r.title, snippet: r.theme + " · " + r.text, cover: "", id: r.title, text: (r.title + " " + r.theme + " " + (r.text || "")).toLowerCase() }));
  }

  function doSearch(q) {
    q = (q || "").trim().toLowerCase();
    if (!q) return [];
    const terms = q.split(/\s+/).filter(Boolean);
    return searchIndex.filter(it => terms.every(t => it.text.indexOf(t) !== -1));
  }

  function liveSearch(q, cb) {
    fetch("api/search?q=" + encodeURIComponent(q), { cache: "no-store" })
      .then(r => r.json())
      .then(data => {
        if (data && Array.isArray(data.results)) {
          const storyReviews = doSearch(q).filter(r => r.type === "故事" || r.type === "评价");
          cb(data.results.concat(storyReviews));
        }
      })
      .catch(() => {});
  }

  function highlight(text, q) {
    if (!q || !text) return esc(text);
    const idx = String(text).toLowerCase().indexOf(String(q).toLowerCase());
    if (idx < 0) return esc(text);
    const t = String(text);
    return esc(t.slice(0, idx)) + '<span class="hl">' + esc(t.slice(idx, idx + q.length)) + '</span>' + esc(t.slice(idx + q.length));
  }

  function renderSearchDrop(results, q) {
    const drop = $("#search-drop");
    if (!results.length) {
      drop.innerHTML = '<div class="sd-empty">没有找到与「' + esc(q) + '」相关的内容</div>';
      drop.hidden = false; return;
    }
    const groups = {}; results.forEach(r => (groups[r.type] = groups[r.type] || []).push(r));
    drop.innerHTML = Object.keys(groups).map(type =>
      '<div class="sd-group"><div class="sd-label">' + esc(type) + '</div>' +
      groups[type].slice(0, 5).map(r =>
        '<div class="sd-item" data-type="' + esc(r.type) + '" data-id="' + esc(r.id || "") + '" data-target="' + esc(r.target || "") + '">' +
        (r.cover ? '<div class="sd-thumb"><img src="' + esc(r.cover) + '" alt="" referrerpolicy="no-referrer" loading="lazy"></div>' : '<div class="sd-thumb"></div>') +
        '<div class="sd-main"><div class="sd-title">' + highlight(r.title, q) + '</div>' +
        '<div class="sd-snippet">' + highlight((r.snippet || "").slice(0, 60), q) + '</div></div>' +
        '<span class="sd-tag">' + esc(type) + '</span></div>').join("") + '</div>').join("");
    drop.hidden = false;
  }

  function renderSearchResults(q, results) {
    $("#search-query-desc").textContent = '关键词「' + q + '」共找到 ' + results.length + ' 条相关内容';
    const box = $("#search-results");
    if (!results.length) { box.innerHTML = '<div class="empty-state">没有找到相关内容，换个关键词试试。</div>'; return; }
    const groups = {}; results.forEach(r => (groups[r.type] = groups[r.type] || []).push(r));
    box.innerHTML = Object.keys(groups).map(type =>
      '<div class="sr-group"><div class="sr-head">' + esc(type) + '<span class="sr-count">' + groups[type].length + ' 条</span></div>' +
      '<div class="sr-list">' + groups[type].map(r =>
        '<div class="sr-item" data-type="' + esc(r.type) + '" data-id="' + esc(r.id || "") + '" data-target="' + esc(r.target || "") + '">' +
        '<div class="sr-thumb">' + (r.cover ? '<img src="' + esc(r.cover) + '" alt="" referrerpolicy="no-referrer" loading="lazy">' : '') + '</div>' +
        '<div class="sr-main"><div class="sr-title">' + highlight(r.title, q) + '</div>' +
        '<div class="sr-snippet">' + highlight((r.snippet || "").slice(0, 100), q) + '</div></div></div>').join("") + '</div></div>').join("");
  }

  function renderSearchResultsView(q) {
    renderSearchResults(q, doSearch(q));
    liveSearch(q, (liveResults) => renderSearchResults(q, liveResults));
  }

  function openEventModal(title, cover) {
    $("#modal-panel").innerHTML =
      '<button class="modal-close" data-close>✕</button>' +
      '<div class="modal-hero">' + imgTag(cover, "", title) + '</div>' +
      '<div class="modal-body"><div class="modal-kind">版本活动</div><h2 class="modal-title">' + esc(title) + '</h2></div>';
    openModal();
  }

  function openSearchResult(type, id, target) {
    closeSearchDrop();
    if (type === "新闻") { switchView("news"); openNewsModal(id); }
    else if (type === "活动") { const ev = state.events.find(x => String(x.id) === String(id)); if (ev) openEventModal(ev.title, ev.cover); }
    else if (type === "角色") { switchView("chars"); openCharModal(id); }
    else if (type === "评价") { switchView("reviews"); }
    else if (type === "故事") { switchView("story"); scrollToStory(target); }
  }

  function scrollToStory(target) {
    requestAnimationFrame(() => {
      const el = document.querySelector('[data-story="' + target + '"]');
      if (el) { el.scrollIntoView({ behavior: "smooth", block: "center" }); el.classList.remove("flash"); void el.offsetWidth; el.classList.add("flash"); }
    });
  }

  function closeSearchDrop() { $("#search-drop").hidden = true; }

  function openCharModal(name) {
    const c = state.characters.find(x => x.name === name);
    if (!c) return;
    const src = c.portrait || c.avatar;
    const panel = $("#modal-panel");
    panel.innerHTML =
      '<button class="modal-close" data-close aria-label="关闭">✕</button>' +
      '<div class="char-modal"><div class="cm-left">' + imgTag(src, "", c.name) + '</div>' +
      '<div class="cm-right"><div class="cm-region">' + esc(c.region) + ' · ' + esc(c.region_en) + '</div>' +
      '<div class="cm-name">' + esc(c.name) + '</div>' +
      '<div class="cm-cv"><div>中配：<b>' + esc(c.cv_cn || "—") + '</b></div><div>日配：<b>' + esc(c.cv_jp || "—") + '</b></div></div>' +
      '<div class="cm-desc">' + esc(c.desc || "这位角色暂时还没有公开的介绍。") + '</div></div></div>';
    openModal();
  }

  function openModal() {
    const m = $("#modal");
    m.classList.add("open");
    m.setAttribute("aria-hidden", "false");
    document.body.style.overflow = "hidden";
  }
  function closeModal() {
    const m = $("#modal");
    m.classList.remove("open");
    m.setAttribute("aria-hidden", "true");
    document.body.style.overflow = "";
  }

  /* ---------------- navigation ---------------- */
  function switchView(view) {
    state.currentView = view;
    $$(".view").forEach(v => v.classList.toggle("is-active", v.id === "view-" + view));
    $$(".nav-link").forEach(a => a.classList.toggle("is-active", a.dataset.view === view));
    window.scrollTo({ top: 0, behavior: "smooth" });
    if (view === "news") renderNews();
    if (view === "chars") renderChars();
  }

  /* ---------------- reveal ---------------- */
  function observeReveals() {
    const io = new IntersectionObserver((entries) => {
      entries.forEach(e => { if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); } });
    }, { threshold: 0.12 });
    $$(".reveal, .news-card, .feature-char, .char-card, .event-item, .review-card, .stat").forEach(el => {
      if (!el.classList.contains("in")) io.observe(el);
    });
  }

  /* ---------------- events ---------------- */
  function bindEvents() {
    // nav + buttons with data-view
    document.addEventListener("click", (e) => {
      const viewEl = e.target.closest("[data-view]");
      if (viewEl) { switchView(viewEl.dataset.view); return; }

      const closeEl = e.target.closest("[data-close]");
      if (closeEl) { closeModal(); return; }

      const newsEl = e.target.closest('[data-open="news"]');
      if (newsEl) { openNewsModal(newsEl.dataset.id); return; }

      const eventEl = e.target.closest('[data-open="event"]');
      if (eventEl) { openEventModal(eventEl.dataset.title, eventEl.dataset.cover); return; }

      const charEl = e.target.closest("[data-char]");
      if (charEl) { openCharModal(charEl.dataset.char); return; }
    });

    // news filter
    $("#news-tabs").addEventListener("click", (e) => {
      const t = e.target.closest(".filter-tab");
      if (!t) return;
      state.newsFilter = t.dataset.filter;
      $$(".filter-tab", "#news-tabs").forEach(x => x.classList.toggle("is-active", x === t));
      renderNews();
    });

    // region filter
    $("#region-tabs").addEventListener("click", (e) => {
      const t = e.target.closest(".region-tab");
      if (!t) return;
      state.regionFilter = t.dataset.region;
      $$(".region-tab", "#region-tabs").forEach(x => x.classList.toggle("is-active", x === t));
      renderChars();
    });

    // refresh
    $("#refresh-btn").addEventListener("click", () => {
      const btn = $("#refresh-btn");
      btn.classList.add("spin");
      setLive(false, "更新中…");
      tryLive().finally(() => setTimeout(() => btn.classList.remove("spin"), 400));
    });

    // modal close on ESC + backdrop
    document.addEventListener("keydown", (e) => { if (e.key === "Escape") closeModal(); });

    // review form
    $("#review-form").addEventListener("submit", (e) => {
      e.preventDefault();
      const nick = $("#review-nick").value.trim();
      const text = $("#review-text").value.trim();
      if (!text) { $("#review-text").focus(); return; }
      saveLocalReview({ nick, text, rating: +($("#star-input").dataset.value || 5), at: Date.now() });
      $("#review-form").reset();
      $("#review-nick").value = "";
      buildStarInput();
      renderLocalReviews();
    });

    // topbar scroll state
    window.addEventListener("scroll", () => {
      $("#topbar").classList.toggle("scrolled", window.scrollY > 24);
    });

    // search
    const searchInput = $("#search-input");
    let searchTimer = null;
    searchInput.addEventListener("input", () => {
      clearTimeout(searchTimer);
      const q = searchInput.value.trim();
      searchTimer = setTimeout(() => {
        renderSearchDrop(doSearch(q), q);
        liveSearch(q, (liveResults) => renderSearchDrop(liveResults, q));
      }, 120);
    });
    searchInput.addEventListener("keydown", (e) => {
      if (e.key === "Escape") { closeSearchDrop(); searchInput.blur(); }
      else if (e.key === "Enter") { e.preventDefault(); const q = searchInput.value.trim(); if (!q) return; closeSearchDrop(); switchView("search"); renderSearchResultsView(q); }
    });
    searchInput.addEventListener("focus", () => { const q = searchInput.value.trim(); if (q) renderSearchDrop(doSearch(q), q); });

    const onResultClick = (e) => { const el = e.target.closest("[data-type]"); if (el) openSearchResult(el.dataset.type, el.dataset.id, el.dataset.target); };
    $("#search-drop").addEventListener("click", onResultClick);
    $("#search-results").addEventListener("click", onResultClick);

    document.addEventListener("click", (e) => { if (!e.target.closest("#search")) closeSearchDrop(); });
    document.addEventListener("keydown", (e) => {
      if (e.key === "/" && document.activeElement !== searchInput && !e.target.closest("input, textarea")) { e.preventDefault(); searchInput.focus(); }
    });
  }

  bootstrap();
})();
