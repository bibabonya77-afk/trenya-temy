"use strict";

(function () {
  // Защита от кликджекинга: GitHub Pages не даёт поставить заголовок
  // frame-ancestors, поэтому не показываем сайт внутри чужого фрейма.
  if (window.top !== window.self) {
    document.documentElement.hidden = true;
    try { window.top.location.replace(window.self.location.href); } catch (e) { /* чужой домен */ }
    return;
  }

  const DATA = window.TRENYA_DATA;
  if (!DATA) return;

  // ================= данные и утилиты =================
  const ID_RE = /^[a-z0-9-]{1,60}$/;
  const byId = new Map(DATA.exercises.map((ex) => [ex.id, ex]));
  const groupName = new Map(DATA.groups.map((g) => [g.id, g.name]));
  const equipName = new Map(DATA.equip.map((e) => [e.id, e.name]));
  const muscleName = new Map(DATA.muscles.map((m) => [m.id, m.name]));
  const groupOrder = DATA.groups.map((g) => g.id);

  const $ = (id) => document.getElementById(id);
  const ALLOWED_ATTR = /^(data-[a-z-]+|aria-[a-z]+|type|alt|loading|width|height|decoding|role|tabindex|scope|id)$/;
  const el = (tag, props, children) => {
    const node = document.createElement(tag);
    if (props) {
      for (const [k, v] of Object.entries(props)) {
        if (v === null || v === undefined || v === false) continue;
        if (k === "text") node.textContent = v;
        else if (k === "class") node.className = v;
        else if (ALLOWED_ATTR.test(k)) node.setAttribute(k, String(v));
      }
    }
    if (children) for (const c of children) if (c) node.append(c);
    return node;
  };
  const imgSrc = (id, suffix) => (ID_RE.test(id) ? "img/" + id + suffix + ".svg" : "");
  const norm = (s) => s.toLowerCase().replace(/ё/g, "е");
  const fmt = (sec) => {
    sec = Math.max(0, Math.round(sec));
    return Math.floor(sec / 60) + ":" + String(sec % 60).padStart(2, "0");
  };
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const canHover = window.matchMedia("(hover: hover) and (pointer: fine)");

  // Хранилище только на устройстве; читаем с проверкой, чужие данные отбрасываем
  const store = {
    get(key, def) {
      try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : def; } catch (e) { return def; }
    },
    set(key, value) {
      try { localStorage.setItem(key, JSON.stringify(value)); } catch (e) { /* приватный режим */ }
    },
  };
  const savedFav = store.get("trenya:fav", []);
  const favs = new Set(Array.isArray(savedFav)
    ? savedFav.filter((id) => typeof id === "string" && byId.has(id)) : []);
  const saveFavs = () => store.set("trenya:fav", Array.from(favs));
  function toggleFav(id) {
    if (favs.has(id)) favs.delete(id); else favs.add(id);
    saveFavs();
  }

  // ================= звук, вибрация, экран =================
  let audioCtx = null;
  function unlockAudio() {
    try {
      if (!audioCtx) {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (AC) audioCtx = new AC();
      }
      if (audioCtx && audioCtx.state === "suspended") audioCtx.resume();
    } catch (e) { audioCtx = null; }
    unlockSpeech();
  }
  // Три разных сигнала:
  //  stop — подход или упражнение закончено, начинается отдых (два тона вниз)
  //  go   — отдых окончен, пора делать подход (три писка, последний выше)
  //  done — тренировка завершена (короткая мелодия вверх)
  const SOUNDS = {
    stop: { notes: [[784, 0, .32], [523, .36, .42]], vibrate: [400, 150, 400] },
    go:   { notes: [[880, 0, .16], [880, .26, .16], [1320, .52, .3]], vibrate: [200, 100, 200, 100, 300] },
    done: { notes: [[523, 0, .16], [659, .18, .16], [784, .36, .16], [1047, .54, .45]], vibrate: [150, 80, 150, 80, 500] },
  };
  // ---- голосовые подсказки (встроенный синтез речи устройства, без интернета и серверов)
  const speech = "speechSynthesis" in window ? window.speechSynthesis : null;
  let voiceOn = store.get("trenya:voice", true) !== false;
  let ruVoice = null;
  function pickVoice() {
    if (!speech) return;
    const ru = speech.getVoices().filter((v) => /^ru/i.test(v.lang));
    ruVoice = ru.find((v) => v.localService) || ru[0] || null;
  }
  if (speech) {
    pickVoice();
    if ("onvoiceschanged" in speech) speech.addEventListener("voiceschanged", pickVoice);
  }
  let speechUnlocked = false;
  function unlockSpeech() {
    // iOS разрешает речь только после нажатия: «проговариваем» пустую фразу
    if (!speech || speechUnlocked) return;
    speechUnlocked = true;
    try { const u = new SpeechSynthesisUtterance(" "); u.volume = 0; speech.speak(u); } catch (e) { /* нет речи */ }
  }
  function say(text) {
    if (!speech || !voiceOn || !text) return;
    try {
      speech.cancel();
      const u = new SpeechSynthesisUtterance(String(text).slice(0, 160));
      u.lang = "ru-RU";
      if (ruVoice) u.voice = ruVoice;
      u.rate = 1; u.volume = 1;
      speech.speak(u);
    } catch (e) { /* нет речи */ }
  }
  const secText = (n) => n + " " + plural(n, "секунда", "секунды", "секунд");

  function sound(kind, phrase) {
    const snd = SOUNDS[kind] || SOUNDS.go;
    if (phrase) setTimeout(() => say(phrase), kind === "done" ? 1100 : 850);
    if (navigator.vibrate) navigator.vibrate(snd.vibrate);
    if (!audioCtx) return;
    try {
      if (audioCtx.state === "suspended") audioCtx.resume();
      const t0 = audioCtx.currentTime + 0.02;
      for (const [freq, at, len] of snd.notes) {
        const o = audioCtx.createOscillator();
        const g = audioCtx.createGain();
        const t = t0 + at;
        o.type = "sine";
        o.frequency.value = freq;
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(0.4, t + 0.02);
        g.gain.setValueAtTime(0.4, t + len * 0.6);
        g.gain.exponentialRampToValueAtTime(0.0001, t + len);
        o.connect(g).connect(audioCtx.destination);
        o.start(t); o.stop(t + len + 0.02);
      }
    } catch (e) { /* звук недоступен */ }
  }
  let wakeLock = null;
  async function keepAwake(on) {
    try {
      if (on && "wakeLock" in navigator) wakeLock = await navigator.wakeLock.request("screen");
      else if (!on && wakeLock) { await wakeLock.release(); wakeLock = null; }
    } catch (e) { wakeLock = null; }
  }

  // Таймер считает от реального времени, поэтому не «плывёт» в фоне
  class Timer {
    constructor(onTick) { this.onTick = onTick; this.id = null; this.mode = "idle"; }
    countdown(sec, onDone) {
      this.stop(); this.mode = "down"; this.end = Date.now() + sec * 1000; this.onDone = onDone; this.run();
    }
    stopwatch() { this.stop(); this.mode = "up"; this.start = Date.now(); this.run(); }
    add(sec) { if (this.mode === "down") { this.end += sec * 1000; this.tick(); } }
    elapsed() { return this.mode === "up" ? (Date.now() - this.start) / 1000 : 0; }
    stop() { clearInterval(this.id); this.id = null; this.mode = "idle"; }
    run() { this.tick(); this.id = setInterval(() => this.tick(), 250); }
    tick() {
      if (this.mode === "down") {
        const left = (this.end - Date.now()) / 1000;
        if (left <= 0) {
          const cb = this.onDone;
          this.stop(); this.onTick(0, "down");
          if (cb) cb();
          return;
        }
        this.onTick(Math.ceil(left), "down");
      } else if (this.mode === "up") {
        this.onTick(this.elapsed(), "up");
      }
    }
  }

  // ================= состояние и вкладки =================
  const state = { view: "list", muscles: new Set(), equip: "all", fav: false, q: "" };
  const list = $("list");
  const bar = $("bar");
  const mapWrap = $("map-wrap");
  const programsBox = $("programs");
  const tabList = $("tab-list");
  const tabProg = $("tab-programs");
  const tabHer = $("tab-her");
  const herBox = $("her");

  function setView(view) {
    state.view = view;
    tabList.setAttribute("aria-pressed", String(view === "list"));
    tabProg.setAttribute("aria-pressed", String(view === "programs"));
    tabHer.setAttribute("aria-pressed", String(view === "her"));
    const isList = view === "list";
    list.hidden = !isList; bar.hidden = !isList; mapWrap.hidden = !isList;
    programsBox.hidden = view !== "programs";
    herBox.hidden = view !== "her";
    store.set("trenya:view", view);
  }
  tabList.addEventListener("click", () => setView("list"));
  tabProg.addEventListener("click", () => setView("programs"));
  tabHer.addEventListener("click", () => setView("her"));

  // ================= карта тела =================
  const mapParts = Array.from(document.querySelectorAll("#bodymap .m"));
  // Можно выбрать сразу несколько мышц: показываем упражнения хотя бы на одну из них
  const chipsBox = $("muscle-chips");
  const mapSel = $("map-sel");
  const mapHint = $("map-hint");
  const scrollToList = () => bar.scrollIntoView({ behavior: reduceMotion.matches ? "auto" : "smooth", block: "start" });
  function toggleMuscle(m) {
    if (state.muscles.has(m)) state.muscles.delete(m); else state.muscles.add(m);
    render();
  }
  function clearMuscles() { state.muscles.clear(); render(); }
  for (const part of mapParts) {
    const m = part.getAttribute("data-m");
    if (!muscleName.has(m)) continue;
    part.addEventListener("click", () => toggleMuscle(m));
    part.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") { e.preventDefault(); toggleMuscle(m); }
    });
  }
  $("map-show").addEventListener("click", scrollToList);
  $("map-clear").addEventListener("click", clearMuscles);

  // ================= фильтры =================
  const equipBox = $("equip");
  const equipBtns = [];
  for (const e of [{ id: "all", name: "Всё" }].concat(DATA.equip)) {
    const b = el("button", { type: "button", class: "seg-btn", "data-equip": e.id, "aria-pressed": e.id === "all", text: e.name });
    b.addEventListener("click", () => { state.equip = e.id; render(); });
    equipBtns.push(b);
    equipBox.append(b);
  }
  const favToggle = $("fav-toggle");
  favToggle.addEventListener("click", () => { state.fav = !state.fav; render(); });
  const q = $("q");
  q.addEventListener("input", () => { state.q = norm(q.value.slice(0, 40).trim()); render(); });

  // тень у панели, когда она прилипла
  const sentinel = el("div", { "aria-hidden": "true" });
  bar.before(sentinel);
  if ("IntersectionObserver" in window) {
    new IntersectionObserver(([en]) => bar.classList.toggle("stuck", !en.isIntersecting)).observe(sentinel);
  }

  // ================= список =================
  let visibleIds = [];

  function matches(ex) {
    if (state.muscles.size && !ex.hl.some((m) => state.muscles.has(m))) return false;
    if (state.equip !== "all" && ex.equip !== state.equip) return false;
    if (state.fav && !favs.has(ex.id)) return false;
    if (state.q) {
      const hay = norm(ex.name + " " + ex.muscles + " " + (groupName.get(ex.group) || ""));
      if (!hay.includes(state.q)) return false;
    }
    return true;
  }

  function syncStars(id) {
    const on = favs.has(id);
    for (const b of document.querySelectorAll('.card-star[data-id="' + id + '"]')) {
      b.setAttribute("aria-pressed", String(on));
      b.setAttribute("aria-label", (on ? "Убрать из избранного: " : "В избранное: ") + byId.get(id).name);
    }
  }
  function starBtn(ex, cls) {
    const on = favs.has(ex.id);
    const b = el("button", {
      type: "button", class: cls, "aria-pressed": on, "data-id": ex.id,
      "aria-label": (on ? "Убрать из избранного: " : "В избранное: ") + ex.name, text: "★",
    });
    b.addEventListener("click", () => {
      toggleFav(ex.id);
      syncStars(ex.id);
      if (state.fav) render();
    });
    return b;
  }

  function card(ex, ctx, getIds) {
    const img = el("img", { alt: ex.name + " — рисунок", width: 200, height: 218, loading: "lazy", decoding: "async" });
    img.src = imgSrc(ex.id, "");
    const btn = el("button", { type: "button", class: "item", "data-id": ex.id }, [
      el("div", { class: "item-img" }, [img]),
      el("div", { class: "item-body" }, [
        el("span", { class: "item-name", text: ex.name }),
        el("span", { class: "item-muscles", text: ex.muscles }),
        el("span", { class: "item-eq", text: ex.time ? ex.time + " сек" : (equipName.get(ex.equip) || "") }),
      ]),
    ]);
    btn.addEventListener("click", () => openDetail(ex.id, getIds ? getIds() : visibleIds, ctx));
    // на ПК фигурка двигается при наведении
    btn.addEventListener("pointerenter", () => {
      if (canHover.matches && !reduceMotion.matches) img.src = imgSrc(ex.id, "-anim");
    });
    btn.addEventListener("pointerleave", () => { img.src = imgSrc(ex.id, ""); });
    return el("li", { class: "card", "data-group": ex.group }, [btn, starBtn(ex, "card-star")]);
  }

  function render() {
    for (const b of equipBtns) b.setAttribute("aria-pressed", String(b.dataset.equip === state.equip));
    favToggle.setAttribute("aria-pressed", String(state.fav));
    for (const p of mapParts) p.setAttribute("aria-pressed", String(state.muscles.has(p.getAttribute("data-m"))));
    const chips = [];
    for (const m of state.muscles) {
      const b = el("button", {
        type: "button", class: "chip-muscle", "data-m": m,
        "aria-label": "Убрать мышцу: " + muscleName.get(m), text: muscleName.get(m) + " ×",
      });
      b.addEventListener("click", () => toggleMuscle(m));
      chips.push(b);
    }
    if (state.muscles.size > 1) {
      const all = el("button", { type: "button", class: "pill", text: "Сбросить" });
      all.addEventListener("click", clearMuscles);
      chips.push(all);
    }
    chipsBox.replaceChildren(...chips);

    const shown = DATA.exercises.filter(matches);
    visibleIds = [];
    const frag = document.createDocumentFragment();
    if (!shown.length) {
      frag.append(el("p", {
        class: "empty",
        text: state.fav && !favs.size
          ? "В избранном пока пусто. Нажми ★ на карточке, чтобы добавить упражнение."
          : "Ничего не нашлось. Попробуй другое слово или сбрось фильтры.",
      }));
    }
    for (const gid of groupOrder) {
      const items = shown.filter((ex) => ex.group === gid);
      if (!items.length) continue;
      for (const ex of items) visibleIds.push(ex.id);
      frag.append(el("section", { class: "section", "data-group": gid, "aria-label": groupName.get(gid) }, [
        el("h2", { class: "section-head" }, [
          document.createTextNode(groupName.get(gid) + " "), el("small", { text: String(items.length) }),
        ]),
        el("ul", { class: "grid" }, items.map((ex) => card(ex))),
      ]));
    }
    list.replaceChildren(frag);

    if (state.muscles.size) {
      const names = Array.from(state.muscles, (m) => muscleName.get(m)).join(", ");
      $("map-sel-text").textContent = names + ": " + shown.length + " " + plural(shown.length, "упражнение", "упражнения", "упражнений");
      mapSel.hidden = false; mapHint.hidden = true;
    } else {
      mapSel.hidden = true; mapHint.hidden = false;
    }
  }
  function plural(n, one, few, many) {
    const d = n % 10, h = n % 100;
    if (d === 1 && h !== 11) return one;
    if (d >= 2 && d <= 4 && (h < 12 || h > 14)) return few;
    return many;
  }

  // ================= карточка упражнения =================
  const dlg = $("detail");
  const animImg = $("d-anim");
  const toggle = $("d-toggle");
  const dStar = $("d-star");
  const tDisplay = $("t-display");
  const tLabel = $("t-label");
  const tWork = $("t-work");
  const tTimerBox = dlg.querySelector(".d-timer");
  let current = null;
  let currentCtx = "";
  let navIds = [];
  let returnId = null;

  function setAnim(playing) {
    if (!current) return;
    animImg.src = imgSrc(current.id, playing ? "-anim" : "");
    animImg.alt = current.name + (playing ? ": анимация выполнения" : ": конечное положение");
    toggle.setAttribute("aria-pressed", String(playing));
    toggle.textContent = playing ? "Пауза" : "Показать движение";
  }
  animImg.addEventListener("error", () => {
    if (current && animImg.src.endsWith("-anim.svg")) setAnim(false);
  });
  toggle.addEventListener("click", () => setAnim(toggle.getAttribute("aria-pressed") !== "true"));

  // ----- таймер в карточке
  const dTimer = new Timer((s) => { tDisplay.textContent = fmt(s); });
  function timerReset() {
    dTimer.stop();
    tTimerBox.classList.remove("resting");
    tDisplay.textContent = current && current.time ? fmt(current.time) : "0:00";
    tLabel.textContent = current && current.time ? "Таймер упражнения" : "Таймер подхода и отдыха";
    tWork.textContent = current && current.time ? "Старт · " + current.time + " сек" : "Старт подхода";
  }
  // Отдых по умолчанию — последний выбранный (запоминается на устройстве)
  const REST_OPTIONS = [60, 90, 120];
  let restSec = store.get("trenya:rest", 90);
  if (!REST_OPTIONS.includes(restSec)) restSec = 90;
  const restBtns = [];

  function startRest(sec) {
    restSec = sec;
    store.set("trenya:rest", sec);
    for (const b of restBtns) b.setAttribute("aria-pressed", String(Number(b.dataset.sec) === sec));
    tTimerBox.classList.add("resting");
    tLabel.textContent = "Отдых " + sec + " сек";
    tWork.textContent = current.time ? "Старт · " + current.time + " сек" : "Старт подхода";
    dTimer.countdown(sec, () => {
      sound("go", "Отдых окончен. Следующий подход");
      tTimerBox.classList.remove("resting");
      tLabel.textContent = "Отдых окончен — следующий подход";
    });
  }

  tWork.addEventListener("click", () => {
    unlockAudio();
    tTimerBox.classList.remove("resting");
    if (current.time) {
      if (dTimer.mode === "down") { timerReset(); return; }
      dTimer.countdown(current.time, () => {
        sound("stop", "Время вышло");
        tLabel.textContent = "Готово";
        tWork.textContent = "Ещё раз";
      });
      tLabel.textContent = "Выполняй";
      tWork.textContent = "Стоп";
      return;
    }
    if (dTimer.mode === "up") {
      // подход закончен: сигнал и сразу отсчёт отдыха
      sound("stop", "Подход окончен. Отдых " + secText(restSec));
      startRest(restSec);
    } else {
      dTimer.stopwatch();
      tLabel.textContent = "Подход идёт";
      tWork.textContent = "Подход сделан";
    }
  });
  function soundTestBtn() {
    const b = el("button", { type: "button", class: "pill sound-test", text: "🔊 Проверить звук" });
    b.addEventListener("click", () => {
      unlockAudio();
      sound("go", voiceOn ? (ruVoice || !speech ? "Отдых окончен. Следующий подход" : "Отдых окончен") : "");
    });
    return b;
  }
  const voiceBtns = [];
  function syncVoiceBtns() {
    for (const b of voiceBtns) {
      b.setAttribute("aria-pressed", String(voiceOn));
      b.textContent = voiceOn ? "🗣 Голос: вкл" : "🗣 Голос: выкл";
    }
  }
  function voiceBtn() {
    const b = el("button", { type: "button", class: "pill sound-test voice-btn" });
    if (!speech) { b.disabled = true; b.textContent = "🗣 Голос недоступен"; return b; }
    b.addEventListener("click", () => {
      voiceOn = !voiceOn;
      store.set("trenya:voice", voiceOn);
      syncVoiceBtns();
      if (voiceOn) { unlockAudio(); say("Голосовые подсказки включены"); } else speech.cancel();
    });
    voiceBtns.push(b);
    syncVoiceBtns();
    return b;
  }
  const restBox = $("t-rest");
  for (const sec of REST_OPTIONS) {
    const b = el("button", { type: "button", class: "pill", "data-sec": sec, "aria-pressed": sec === restSec, text: "Отдых " + sec });
    b.addEventListener("click", () => { unlockAudio(); startRest(sec); });
    restBtns.push(b);
    restBox.append(b);
  }
  restBox.after(soundTestBtn(), voiceBtn());

  function fillList(node, items) { node.replaceChildren(...items.map((t) => el("li", { text: t }))); }

  function openDetail(id, ids, ctx) {
    const ex = byId.get(id);
    if (!ex) return;
    current = ex;
    currentCtx = ctx === "her" && ex.her ? "her" : "";
    const her = currentCtx ? ex.her : null;
    const load = her ? her.load : ex.load;
    const note = $("d-note");
    note.hidden = !(her && her.note);
    note.textContent = her && her.note ? "При дисплазии: " + her.note : "";
    navIds = Array.isArray(ids) && ids.includes(id) ? ids : [id];
    if (!dlg.open) returnId = id;
    dlg.dataset.group = ex.group;
    $("d-meta").textContent = (groupName.get(ex.group) || "") + ", " + (equipName.get(ex.equip) || "").toLowerCase();
    $("d-title").textContent = ex.name;
    $("d-muscles").textContent = "Работают: " + ex.muscles;
    setAnim(!reduceMotion.matches);
    const img = $("d-img");
    img.alt = ex.name + ": исходное и конечное положение";
    img.src = imgSrc(ex.id, "-how");
    $("d-load").replaceChildren(...load.map((r) => el("tr", null, [
      el("td", { text: r.goal }), el("td", { text: r.sets }), el("td", { text: r.reps }), el("td", { text: r.rest }),
    ])));
    $("d-explain").textContent = ex.time
      ? "Делай упражнение без остановки " + ex.time + " секунд, потом переходи к следующему."
      : "Подход — это несколько повторов подряд без отдыха. Например, 3 подхода по 10 раз: "
        + "сделал 10 раз, отдохнул, ещё 10 раз, отдохнул, ещё 10 раз. "
        + (load.length > 1 ? "Цель выбирай одну — для начала подойдёт «" + load[load.length > 2 ? 1 : 0].goal + "»." : "");
    const tip = her ? her.tip : ex.tip;
    $("d-tip").textContent = "Какой вес взять: " + tip.charAt(0).toLowerCase() + tip.slice(1);
    fillList($("d-steps"), ex.steps);
    fillList($("d-mistakes"), ex.mistakes);
    const on = favs.has(ex.id);
    dStar.setAttribute("aria-pressed", String(on));
    dStar.setAttribute("aria-label", on ? "Убрать из избранного" : "В избранное");
    const i = navIds.indexOf(id);
    $("d-prev").disabled = i <= 0;
    $("d-next").disabled = i < 0 || i >= navIds.length - 1;
    timerReset();
    if (!dlg.open) dlg.showModal();
    dlg.scrollTop = 0;
    if (!player.open && location.hash !== "#" + id) history.replaceState(null, "", "#" + id);
  }
  function step(dir) {
    if (!current) return;
    const i = navIds.indexOf(current.id) + dir;
    if (i >= 0 && i < navIds.length) openDetail(navIds[i], navIds, currentCtx);
  }
  function closeDetail() { if (dlg.open) dlg.close(); }

  $("d-prev").addEventListener("click", () => step(-1));
  $("d-next").addEventListener("click", () => step(1));
  $("d-close").addEventListener("click", closeDetail);
  dStar.addEventListener("click", () => {
    toggleFav(current.id);
    const on = favs.has(current.id);
    dStar.setAttribute("aria-pressed", String(on));
    dStar.setAttribute("aria-label", on ? "Убрать из избранного" : "В избранное");
    render();
  });
  dlg.addEventListener("click", (e) => { if (e.target === dlg) closeDetail(); });
  dlg.addEventListener("keydown", (e) => {
    if (e.target instanceof HTMLInputElement) return;
    if (e.key === "ArrowLeft") step(-1);
    if (e.key === "ArrowRight") step(1);
  });
  dlg.addEventListener("close", () => {
    dTimer.stop();
    animImg.removeAttribute("src");
    dlg.style.transform = "";
    if (!player.open) {
      history.replaceState(null, "", location.pathname + location.search);
      const back = returnId && list.querySelector('.item[data-id="' + returnId + '"]');
      if (back) back.focus();
    }
  });

  // ----- шторка: свайп вниз закрывает, влево/вправо листает
  let sx = 0, sy = 0, dragMode = null;
  dlg.addEventListener("touchstart", (e) => {
    if (e.touches.length !== 1) return;
    sx = e.touches[0].clientX; sy = e.touches[0].clientY; dragMode = null;
    dlg.style.transition = "";
  }, { passive: true });
  dlg.addEventListener("touchmove", (e) => {
    if (e.touches.length !== 1) return;
    const dx = e.touches[0].clientX - sx;
    const dy = e.touches[0].clientY - sy;
    if (!dragMode) {
      if (Math.abs(dx) > 14 && Math.abs(dx) > Math.abs(dy) * 1.4) dragMode = "h";
      else if (dy > 12 && dlg.scrollTop <= 0 && Math.abs(dy) > Math.abs(dx)) dragMode = "v";
      else if (Math.abs(dy) > 12) dragMode = "scroll";
    }
    if (dragMode === "v") { e.preventDefault(); dlg.style.transform = "translateY(" + Math.max(0, dy) + "px)"; }
    else if (dragMode === "h") { dlg.style.transform = "translateX(" + dx * 0.35 + "px)"; }
  }, { passive: false });
  dlg.addEventListener("touchend", (e) => {
    const t = e.changedTouches[0];
    const dx = t.clientX - sx;
    const dy = t.clientY - sy;
    dlg.style.transition = "transform .2s ease";
    if (dragMode === "v" && dy > 110) {
      dlg.style.transform = "translateY(100%)";
      setTimeout(closeDetail, 180);
    } else {
      dlg.style.transform = "";
      if (dragMode === "h" && Math.abs(dx) > 70) step(dx < 0 ? 1 : -1);
    }
    dragMode = null;
  });

  // ================= программы =================
  // «10–12» → «10–12 раз», «10 на ногу» → «10 раз на ногу»
  function repsText(r) { return / на /.test(r) ? r.replace(" на ", " раз на ") : r + " раз"; }
  function itemDose(it) {
    return it.time ? it.time + " сек" : it.sets + " " + plural(it.sets, "подход", "подхода", "подходов") + " по " + repsText(it.reps);
  }
  function estimateMin(p) {
    let s = 0;
    for (const it of p.items) s += it.time ? it.time + 10 : it.sets * (40 + it.rest);
    return Math.round(s / 60 / 5) * 5;
  }
  function programCards(programs, ctx) {
    return programs.map((p) => {
      const start = el("button", { type: "button", class: "btn-primary", text: "Начать тренировку" });
      start.addEventListener("click", () => startProgram(p.id));
      const ids = p.items.map((x) => x.id);
      const items = p.items.map((it) => {
        const ex = byId.get(it.id);
        const name = el("button", { type: "button", class: "linkish", text: ex.name });
        name.addEventListener("click", () => openDetail(ex.id, ids, ctx));
        return el("li", { "data-group": ex.group }, [name, el("span", { class: "dose", text: itemDose(it) })]);
      });
      return el("article", { class: "prog", "aria-label": p.name }, [
        el("h2", { text: p.name }),
        el("p", { class: "prog-meta", text: p.freq + ", около " + estimateMin(p) + " минут" }),
        el("p", { class: "prog-desc", text: p.desc }),
        el("ul", { class: "prog-list" }, items),
        start,
      ]);
    });
  }
  function renderPrograms() {
    programsBox.replaceChildren(...programCards(DATA.programs, ""));
  }

  // ================= раздел «Для неё» =================
  function renderHer() {
    const H = DATA.her;
    const info = H.info;
    const herIds = H.ids.filter((id) => byId.has(id));
    const frag = document.createDocumentFragment();
    frag.append(el("div", { class: "her-intro" }, [
      el("h2", { class: "her-title", id: "her-title", text: info.title }),
      el("p", { class: "her-lead", text: info.lead }),
    ]));
    frag.append(el("aside", { class: "her-card her-doctor", "aria-label": "Важно" }, [
      el("p", { class: "her-card-title", text: "Сначала — к врачу" }),
      el("p", { text: info.doctor }),
    ]));
    frag.append(el("aside", { class: "her-card", "aria-label": "Правила" }, [
      el("p", { class: "her-card-title", text: "Правила безопасности" }),
      el("ul", { class: "her-rules" }, info.rules.map((r) => el("li", { text: r }))),
      el("p", { class: "her-avoid", text: info.avoid }),
      el("p", { class: "her-avoid-list", text: "Из общего списка не подходят: "
        + info.avoid_ids.filter((id) => byId.has(id)).map((id) => byId.get(id).name).join(", ") + "." }),
    ]));
    frag.append(el("h2", { class: "her-h", text: "Программы для неё" }));
    frag.append(el("div", { class: "programs-list" }, programCards(H.programs, "her")));
    frag.append(el("h2", { class: "her-h", text: "Упражнения для неё" }));
    for (const gid of groupOrder) {
      const items = herIds.map((id) => byId.get(id)).filter((ex) => ex.group === gid);
      if (!items.length) continue;
      frag.append(el("section", { class: "section", "data-group": gid, "aria-label": groupName.get(gid) }, [
        el("h3", { class: "section-head" }, [
          document.createTextNode(groupName.get(gid) + " "), el("small", { text: String(items.length) }),
        ]),
        el("ul", { class: "grid" }, items.map((ex) => card(ex, "her", () => herIds))),
      ]));
    }
    herBox.replaceChildren(frag);
  }

  // ================= проигрыватель =================
  const player = $("player");
  const P = {
    prog: null, idx: 0, set: 1, phase: "ready", started: 0,
    img: $("p-img"), name: $("p-name"), target: $("p-target"), timer: $("p-timer"),
    phaseEl: $("p-phase"), main: $("p-main"), plus: $("p-plus"), step: $("p-step"),
    progress: $("p-progress"),
  };
  const pTimer = new Timer((s) => { P.timer.textContent = fmt(s); });
  document.querySelector(".p-nav").append(soundTestBtn(), voiceBtn());

  function pItem() { return P.prog.items[P.idx]; }

  function showItem() {
    const it = pItem();
    const ex = byId.get(it.id);
    player.dataset.group = ex.group;
    P.step.textContent = "Упражнение " + (P.idx + 1) + " из " + P.prog.items.length;
    P.progress.value = P.idx / P.prog.items.length;
    P.img.src = imgSrc(ex.id, reduceMotion.matches ? "" : "-anim");
    P.img.alt = ex.name;
    P.name.textContent = ex.name;
    $("p-prev").disabled = P.idx === 0;
    $("p-next").disabled = P.idx >= P.prog.items.length - 1;
    setPhase("ready");
  }

  function setPhase(phase) {
    const it = pItem();
    P.phase = phase;
    P.timer.classList.toggle("resting", phase === "rest");
    P.plus.hidden = phase !== "rest";
    if (it.time) {
      P.target.textContent = it.time + " секунд";
      if (phase === "ready") {
        pTimer.stop(); P.timer.textContent = fmt(it.time);
        P.phaseEl.textContent = "Нажми старт, когда будешь готов";
        P.main.textContent = "Старт";
      } else if (phase === "work") {
        P.phaseEl.textContent = "Выполняй";
        P.main.textContent = "Пропустить";
        pTimer.countdown(it.time, () => {
          if (P.idx >= P.prog.items.length - 1) { finish(); return; }
          const nx = byId.get(P.prog.items[P.idx + 1].id);
          sound("stop", "Время вышло. Дальше: " + nx.name);
          nextItem();
        });
      }
      return;
    }
    P.target.textContent = "Подход " + P.set + " из " + it.sets + ": сделай " + repsText(it.reps);
    if (phase === "ready") {
      pTimer.stop(); P.timer.textContent = "0:00";
      P.phaseEl.textContent = P.set > 1 ? "Отдых окончен — начинай подход" : "Начинай, когда будешь готов";
      P.main.textContent = "Начать подход";
    } else if (phase === "work") {
      pTimer.stopwatch();
      P.phaseEl.textContent = "Подход идёт";
      P.main.textContent = "Подход сделан";
    } else if (phase === "rest") {
      const last = P.set >= it.sets;
      const nextEx = last && P.prog.items[P.idx + 1] ? byId.get(P.prog.items[P.idx + 1].id) : null;
      P.phaseEl.textContent = last ? (nextEx ? "Отдых. Дальше: " + nextEx.name : "Отдых") : "Отдых";
      P.main.textContent = "Пропустить отдых";
      pTimer.countdown(it.rest, () => {
        if (last) {
          const nx = P.prog.items[P.idx + 1] ? byId.get(P.prog.items[P.idx + 1].id) : null;
          sound("go", nx ? "Отдых окончен. Следующее упражнение: " + nx.name : "Отдых окончен");
        } else {
          sound("go", "Отдых окончен. Подход " + (P.set + 1) + " из " + it.sets);
        }
        afterRest();
      });
    }
  }

  function afterRest() {
    const it = pItem();
    if (P.set >= it.sets) { nextItem(); return; }
    P.set += 1;
    setPhase("ready");
  }

  function nextItem() {
    pTimer.stop();
    if (P.idx >= P.prog.items.length - 1) { finish(); return; }
    P.idx += 1; P.set = 1;
    showItem();
  }

  P.main.addEventListener("click", () => {
    unlockAudio();
    const it = pItem();
    if (P.phase === "ready") setPhase("work");
    else if (P.phase === "work") {
      if (it.time) nextItem();
      else if (P.set >= it.sets && P.idx >= P.prog.items.length - 1) finish();
      else {
        const lastSet = P.set >= it.sets;
        sound("stop", (lastSet ? "Упражнение закончено. Отдых " : "Подход окончен. Отдых ") + secText(it.rest));
        setPhase("rest");
      }
    } else if (P.phase === "rest") { pTimer.stop(); afterRest(); }
  });
  P.plus.addEventListener("click", () => pTimer.add(15));
  $("p-prev").addEventListener("click", () => { if (P.idx > 0) { pTimer.stop(); P.idx -= 1; P.set = 1; showItem(); } });
  $("p-next").addEventListener("click", () => nextItem());
  $("p-how").addEventListener("click", () => openDetail(pItem().id, [pItem().id], P.ctx));

  function startProgram(id) {
    const prog = DATA.programs.find((p) => p.id === id) || DATA.her.programs.find((p) => p.id === id);
    if (!prog) return;
    P.ctx = DATA.her.programs.includes(prog) ? "her" : "";
    unlockAudio();
    P.prog = prog; P.idx = 0; P.set = 1; P.started = Date.now();
    $("p-prog").textContent = prog.name;
    $("p-work").hidden = false; $("p-done").hidden = true;
    showItem();
    player.showModal();
    keepAwake(true);
  }
  function finish() {
    pTimer.stop();
    P.progress.value = 1;
    $("p-work").hidden = true; $("p-done").hidden = false;
    const min = Math.max(1, Math.round((Date.now() - P.started) / 60000));
    $("p-summary").textContent = "Время: " + min + " мин. Упражнений: " + P.prog.items.length + ".";
    sound("done", "Тренировка завершена. Отличная работа!");
  }
  function closePlayer(ask) {
    const inProgress = !$("p-work").hidden && (P.idx > 0 || P.phase !== "ready");
    if (ask && inProgress && !window.confirm("Закончить тренировку? Прогресс не сохранится.")) return;
    pTimer.stop();
    player.close();
  }
  $("p-close").addEventListener("click", () => closePlayer(true));
  $("p-finish").addEventListener("click", () => closePlayer(false));
  player.addEventListener("cancel", (e) => { e.preventDefault(); closePlayer(true); });
  player.addEventListener("close", () => { pTimer.stop(); keepAwake(false); P.img.removeAttribute("src"); });
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible" && player.open) keepAwake(true);
  });

  // ================= прямые ссылки =================
  function fromHash() {
    let h = "";
    try { h = decodeURIComponent(location.hash.slice(1, 80)); } catch (e) { return; }
    if (ID_RE.test(h) && byId.has(h)) openDetail(h, visibleIds);
  }
  window.addEventListener("hashchange", fromHash);

  // ================= офлайн-режим и обновления =================
  const toast = $("toast");
  function showToast(text, onClick) {
    $("toast-text").textContent = text;
    toast.hidden = false;
    $("toast-btn").onclick = () => { toast.hidden = true; onClick(); };
  }
  const secure = location.protocol === "https:" || location.hostname === "localhost";
  if ("serviceWorker" in navigator && secure) {
    let policy = null;
    try {
      if (window.trustedTypes) {
        policy = window.trustedTypes.createPolicy("sw-url", {
          createScriptURL: (u) => { if (u === "./sw.js") return u; throw new TypeError("Запрещённый адрес"); },
        });
      }
    } catch (e) { policy = null; }
    const swUrl = policy ? policy.createScriptURL("./sw.js") : "./sw.js";
    let updating = false;
    const offer = (worker) => showToast("Есть новая версия сайта", () => { updating = true; worker.postMessage("skipWaiting"); });
    navigator.serviceWorker.register(swUrl, { scope: "./", updateViaCache: "none" }).then((reg) => {
      if (reg.waiting && navigator.serviceWorker.controller) offer(reg.waiting);
      reg.addEventListener("updatefound", () => {
        const w = reg.installing;
        if (!w) return;
        w.addEventListener("statechange", () => {
          if (w.state === "installed" && navigator.serviceWorker.controller) offer(w);
        });
      });
    }).catch(() => { /* офлайн-режим недоступен — сайт работает как обычно */ });
    navigator.serviceWorker.addEventListener("controllerchange", () => { if (updating) location.reload(); });
  }

  render();
  renderPrograms();
  renderHer();
  const savedView = store.get("trenya:view", "list");
  if (savedView === "programs" || savedView === "her") setView(savedView);
  fromHash();
})();
