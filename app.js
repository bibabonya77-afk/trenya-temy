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

  const ID_RE = /^[a-z0-9-]{1,60}$/;
  const byId = new Map(DATA.exercises.map((ex) => [ex.id, ex]));
  const groupName = new Map(DATA.groups.map((g) => [g.id, g.name]));
  const equipName = new Map(DATA.equip.map((e) => [e.id, e.name]));

  const state = { group: "all", equip: "all", q: "" };

  const $ = (id) => document.getElementById(id);
  const el = (tag, props, children) => {
    const node = document.createElement(tag);
    if (props) {
      for (const [k, v] of Object.entries(props)) {
        if (k === "text") node.textContent = v;
        else if (k === "class") node.className = v;
        else if (k.startsWith("data-") || k.startsWith("aria-") || k === "type" ||
                 k === "alt" || k === "loading" || k === "width" || k === "height" || k === "decoding") {
          node.setAttribute(k, String(v));
        }
      }
    }
    if (children) for (const c of children) if (c) node.append(c);
    return node;
  };
  const imgSrc = (id, suffix) => (ID_RE.test(id) ? "img/" + id + suffix + ".svg" : "");

  // ---------- фильтры ----------
  const groupsBox = $("groups");
  const groupBtns = [];
  const allGroups = [{ id: "all", name: "Все" }].concat(DATA.groups);
  for (const g of allGroups) {
    const n = g.id === "all" ? DATA.exercises.length
      : DATA.exercises.filter((ex) => ex.group === g.id).length;
    const b = el("button", { type: "button", class: "plate", "data-group": g.id, "aria-pressed": g.id === "all" }, [
      el("span", { class: "plate-disc", "aria-hidden": "true" }),
      el("span", { text: g.name }),
      el("span", { class: "plate-count", text: String(n) }),
    ]);
    b.addEventListener("click", () => { state.group = g.id; render(); });
    groupBtns.push(b);
    groupsBox.append(b);
  }

  const equipBox = $("equip");
  const equipBtns = [];
  for (const e of [{ id: "all", name: "Всё" }].concat(DATA.equip)) {
    const b = el("button", { type: "button", class: "seg-btn", "data-equip": e.id, "aria-pressed": e.id === "all", text: e.name });
    b.addEventListener("click", () => { state.equip = e.id; render(); });
    equipBtns.push(b);
    equipBox.append(b);
  }

  const q = $("q");
  q.addEventListener("input", () => {
    state.q = q.value.slice(0, 40).trim().toLowerCase().replace(/ё/g, "е");
    render();
  });

  // ---------- список ----------
  const list = $("list");
  const norm = (s) => s.toLowerCase().replace(/ё/g, "е");

  function matches(ex) {
    if (state.group !== "all" && ex.group !== state.group) return false;
    if (state.equip !== "all" && ex.equip !== state.equip) return false;
    if (state.q) {
      const hay = norm(ex.name + " " + ex.muscles + " " + (groupName.get(ex.group) || ""));
      if (!hay.includes(state.q)) return false;
    }
    return true;
  }

  function card(ex) {
    const btn = el("button", { type: "button", class: "item", "data-group": ex.group }, [
      el("div", { class: "item-img" }, [
        (() => {
          const img = el("img", { alt: ex.name + " — рисунок", width: 200, height: 218, loading: "lazy", decoding: "async" });
          img.src = imgSrc(ex.id, "");
          return img;
        })(),
      ]),
      el("div", { class: "item-body" }, [
        el("span", { class: "item-name", text: ex.name }),
        el("span", { class: "item-muscles", text: ex.muscles }),
        el("span", { class: "item-eq", text: equipName.get(ex.equip) || "" }),
      ]),
    ]);
    btn.addEventListener("click", () => openDetail(ex.id, btn));
    return el("li", null, [btn]);
  }

  function render() {
    groupsBox.dataset.active = state.group;
    for (const b of groupBtns) b.setAttribute("aria-pressed", String(b.dataset.group === state.group));
    for (const b of equipBtns) b.setAttribute("aria-pressed", String(b.dataset.equip === state.equip));

    const shown = DATA.exercises.filter(matches);
    const frag = document.createDocumentFragment();
    if (!shown.length) {
      frag.append(el("p", { class: "empty", text: "Ничего не нашлось. Попробуй другое слово или сбрось фильтры." }));
    }
    for (const g of DATA.groups) {
      const items = shown.filter((ex) => ex.group === g.id);
      if (!items.length) continue;
      frag.append(el("section", { class: "section", "data-group": g.id, "aria-label": g.name }, [
        el("h2", { class: "section-head" }, [document.createTextNode(g.name + " "), el("small", { text: String(items.length) })]),
        el("ul", { class: "grid" }, items.map(card)),
      ]));
    }
    list.replaceChildren(frag);
  }

  // ---------- карточка ----------
  const dlg = $("detail");
  let returnFocus = null;

  function fillList(node, items) {
    node.replaceChildren(...items.map((t) => el("li", { text: t })));
  }

  function openDetail(id, from) {
    const ex = byId.get(id);
    if (!ex) return;
    returnFocus = from || null;
    dlg.dataset.group = ex.group;
    $("d-meta").textContent = (groupName.get(ex.group) || "") + ", " + (equipName.get(ex.equip) || "").toLowerCase();
    $("d-title").textContent = ex.name;
    $("d-muscles").textContent = "Работают: " + ex.muscles;
    const img = $("d-img");
    img.alt = ex.name + ": исходное и конечное положение";
    img.src = imgSrc(ex.id, "-how");
    fillList($("d-steps"), ex.steps);
    fillList($("d-mistakes"), ex.mistakes);
    if (!dlg.open) dlg.showModal();
    dlg.scrollTop = 0;
    if (location.hash !== "#" + id) history.replaceState(null, "", "#" + id);
  }

  function closeDetail() { if (dlg.open) dlg.close(); }

  dlg.addEventListener("close", () => {
    history.replaceState(null, "", location.pathname + location.search);
    if (returnFocus) returnFocus.focus();
  });
  $("d-close").addEventListener("click", closeDetail);
  dlg.addEventListener("click", (e) => { if (e.target === dlg) closeDetail(); });

  // Прямые ссылки вида #zhim-gantelej-lezha — пускаем только известные id
  function fromHash() {
    let h = "";
    try { h = decodeURIComponent(location.hash.slice(1, 80)); } catch (e) { return; }
    if (ID_RE.test(h) && byId.has(h)) openDetail(h, null);
  }
  window.addEventListener("hashchange", fromHash);

  render();
  fromHash();
})();
