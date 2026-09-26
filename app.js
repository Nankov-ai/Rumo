/* Rumo — lógica da aplicação.
   Sem framework, sem build. Estado em localStorage, só neste dispositivo. */
(() => {
  "use strict";

  const K_FOLHA = "rumo.folha";
  const K_CONFIG = "rumo.config";
  const K_LANG = "rumo.lang";
  const K_TAB = "rumo.tab";
  const K_PROJETO = "rumo.projeto";
  const K_ARCHIVE = "rumo.projeto.archive";
  const K_PENDENTES = "rumo.pendentes";

  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const uid = () => Math.random().toString(36).slice(2, 9);

  // ---- estado ----
  let lang = localStorage.getItem(K_LANG)
    || ((navigator.language || "pt").toLowerCase().startsWith("pt") ? "pt" : "en");
  if (!window.I18N[lang]) lang = "pt";
  let config = load(K_CONFIG) || { reviewDay: 22 };
  let folha = load(K_FOLHA); // null até ser traçada
  let emergencyOpen = false;  // dura só a sessão
  let projeto = load(K_PROJETO); // semana corrente, null se nunca usada
  let pendentes = load(K_PENDENTES) || []; // referências à espera da próxima coleta
  let archive = load(K_ARCHIVE) || []; // semanas passadas (até 12)
  let activeTab = localStorage.getItem(K_TAB) === "projeto" ? "projeto" : "norte";

  function load(k) { try { return JSON.parse(localStorage.getItem(k)); } catch { return null; } }
  function save(k, v) { localStorage.setItem(k, JSON.stringify(v)); }
  function t(key) { return window.I18N[lang][key] ?? window.I18N.pt[key] ?? key; }

  // ---- blindagem ----
  function isReviewDay() { return new Date().getDate() === Number(config.reviewDay); }
  function isOpen() { return folha == null || isReviewDay() || emergencyOpen; }

  function daysUntilReview() {
    const now = new Date();
    const d = Number(config.reviewDay);
    let target = new Date(now.getFullYear(), now.getMonth(), d);
    if (now.getDate() >= d) target = new Date(now.getFullYear(), now.getMonth() + 1, d);
    return Math.round((target - new Date(now.getFullYear(), now.getMonth(), now.getDate())) / 864e5);
  }

  // ---- horizonte da projeção ----
  const UNITS = ["day", "week", "month", "year"];

  function populateUnitSelects() {
    $$("select[data-units]").forEach(sel => {
      const cur = sel.value || "year";
      sel.innerHTML = UNITS.map(u => `<option value="${u}">${(window.I18N[lang].units[u] || window.I18N.pt.units[u])[1]}</option>`).join("");
      sel.value = cur;
    });
  }

  function addHorizon(fromISO, n, unit) {
    const d = new Date(fromISO); n = Number(n) || 1;
    if (unit === "day") d.setDate(d.getDate() + n);
    else if (unit === "week") d.setDate(d.getDate() + n * 7);
    else if (unit === "month") d.setMonth(d.getMonth() + n);
    else d.setFullYear(d.getFullYear() + n);
    return d.toISOString();
  }

  function horizonText(fromISO, h) {
    return `${t("horizonReached")} ${fmtDate(addHorizon(fromISO, h.n, h.unit))}`;
  }

  function refreshSetupHorizon() {
    if (!$("#setup-horizon-n")) return;
    const n = Number($("#setup-horizon-n").value) || 1;
    const u = $("#setup-horizon-unit").value || "year";
    $("#setup-horizon-date").textContent = horizonText(new Date().toISOString(), { n, unit: u });
  }

  // ---- i18n ----
  function applyI18n() {
    document.documentElement.lang = lang === "pt" ? "pt-PT" : "en";
    $$("[data-i18n]").forEach(el => { el.textContent = t(el.dataset.i18n); });
    $$("[data-i18n-ph]").forEach(el => { el.placeholder = t(el.dataset.i18nPh); });
    $("#lang").value = lang;
    populateUnitSelects();
    refreshSetupHorizon();
    if (folha) render();
    if (projeto) renderProjeto();
  }

  // ---- render ----
  function fmtDate(iso) {
    const d = new Date(iso);
    return d.toLocaleDateString(lang === "pt" ? "pt-PT" : "en-GB", { day: "2-digit", month: "long", year: "numeric" });
  }

  function render() {
    $("#view-empty").hidden = true;
    $("#view-folha").hidden = false;

    $("#created-at").textContent = fmtDate(folha.createdAt);

    populateUnitSelects();
    const h = folha.horizon || { n: 1, unit: "year" };
    $("#f-horizon-n").value = h.n;
    $("#f-horizon-unit").value = h.unit;
    $("#horizon-date").textContent = horizonText(folha.createdAt, h);

    $("#f-projecao").value = folha.projecao || "";
    $("#f-atual").value = folha.atual || "";
    $("#f-commit").checked = !!folha.commit;
    $("#f-nome").value = folha.nome || "";
    $("#cfg-review-day").value = config.reviewDay;

    renderNeeds();
    renderHistory();
    renderLock();
  }

  function renderLock() {
    const open = isOpen();
    const banner = $("#lock-banner");
    banner.className = "banner " + (open ? "banner-open" : "banner-closed");

    if (isReviewDay()) banner.textContent = t("lockOpenReview");
    else if (emergencyOpen) banner.textContent = t("lockOpenEmergency");
    else {
      const n = daysUntilReview();
      banner.textContent = n === 1
        ? t("lockClosedTomorrow")
        : t("lockClosed").replace("{day}", config.reviewDay).replace("{days}", n);
    }

    $("#meridian-lock").textContent = open ? "" : "🔒";
    document.body.classList.toggle("is-locked", !open);

    // trava os campos do plano
    ["#f-projecao", "#f-atual", "#f-commit", "#f-nome", "#f-horizon-n", "#f-horizon-unit", "#need-desc", "#need-type", "#btn-add-need", "#btn-save", "#cfg-review-day"]
      .forEach(s => { const el = $(s); if (el) el.disabled = !open; });
    $$("#needs-list input, #needs-list button").forEach(el => { el.disabled = !open; });

    $("#between-reviews").hidden = open;
  }

  function renderNeeds() {
    const ul = $("#needs-list");
    ul.innerHTML = "";
    (folha.needs || []).forEach(n => {
      const li = document.createElement("li");
      li.className = "need" + (n.done ? " need-done" : "");
      li.innerHTML = `
        <label class="need-check">
          <input type="checkbox" ${n.done ? "checked" : ""} />
          <span class="need-type">${t("type" + ({ informacao: "Info", conteudo: "Content", conhecimento: "Know" }[n.type]))}</span>
          <span class="need-desc"></span>
        </label>
        <button type="button" class="need-remove" aria-label="${t("removeNeed")}">×</button>`;
      li.querySelector(".need-desc").textContent = n.desc;
      li.querySelector("input").addEventListener("change", e => { n.done = e.target.checked; save(K_FOLHA, folha); renderNeeds(); });
      li.querySelector(".need-remove").addEventListener("click", () => {
        folha.needs = folha.needs.filter(x => x.id !== n.id); save(K_FOLHA, folha); renderNeeds();
      });
      ul.appendChild(li);
    });
  }

  function renderHistory() {
    const ol = $("#history-list");
    ol.innerHTML = "";
    const labels = { created: "histCreated", review: "histReview", reflection: "histReflection", emergency: "histEmergency" };
    [...(folha.history || [])].reverse().forEach(h => {
      const li = document.createElement("li");
      li.className = "hist hist-" + h.type;
      const meta = document.createElement("p");
      meta.className = "hist-meta mono";
      meta.textContent = `${fmtDate(h.at)} · ${t(labels[h.type] || h.type)}`;
      li.appendChild(meta);
      if (h.text) { const p = document.createElement("p"); p.className = "hist-text"; p.textContent = h.text; li.appendChild(p); }
      ol.appendChild(li);
    });
  }

  function addHistory(type, text) {
    folha.history = folha.history || [];
    folha.history.push({ at: new Date().toISOString(), type, text: text || "" });
  }

  // ---- ações ----
  function createFolha() {
    const d = Math.min(28, Math.max(1, Number($("#setup-review-day").value) || 22));
    config = { reviewDay: d };
    save(K_CONFIG, config);
    const hn = Math.min(999, Math.max(1, Number($("#setup-horizon-n").value) || 1));
    const hu = $("#setup-horizon-unit").value || "year";
    folha = { createdAt: new Date().toISOString(), horizon: { n: hn, unit: hu }, projecao: "", atual: "", needs: [], commit: false, nome: "", history: [] };
    addHistory("created");
    save(K_FOLHA, folha);
    render();
    $("#f-atual").focus();
  }

  function collectPlan() {
    folha.horizon = {
      n: Math.min(999, Math.max(1, Number($("#f-horizon-n").value) || 1)),
      unit: $("#f-horizon-unit").value || "year"
    };
    folha.projecao = $("#f-projecao").value.trim();
    folha.atual = $("#f-atual").value.trim();
    folha.commit = $("#f-commit").checked;
    folha.nome = $("#f-nome").value.trim();
    const cd = Math.min(28, Math.max(1, Number($("#cfg-review-day").value) || config.reviewDay));
    config.reviewDay = cd; save(K_CONFIG, config);
  }

  function doSave(reviewText) {
    if (!isOpen()) { flashSave(t("lockedSave"), true); return; }
    collectPlan();
    if (isReviewDay() && reviewText) addHistory("review", reviewText);
    save(K_FOLHA, folha);
    emergencyOpen = false; // fecha de novo após guardar
    render();
    flashSave(t("savedAt") + " · " + new Date().toLocaleTimeString(lang === "pt" ? "pt-PT" : "en-GB", { hour: "2-digit", minute: "2-digit" }));
  }

  function flashSave(msg, warn) {
    const el = $("#save-note");
    el.textContent = msg;
    el.classList.toggle("warn", !!warn);
  }

  function onSaveClick() {
    if (isReviewDay()) { $("#review-notes").value = ""; $("#dlg-review").showModal(); }
    else doSave();
  }

  function addNeed() {
    const desc = $("#need-desc").value.trim();
    if (!desc) return;
    folha.needs = folha.needs || [];
    folha.needs.push({ id: uid(), type: $("#need-type").value, desc, done: false });
    $("#need-desc").value = "";
    save(K_FOLHA, folha);
    renderNeeds();
    $("#need-desc").focus();
  }

  function logReflection() {
    const txt = $("#reflect-text").value.trim();
    if (!txt) return;
    addHistory("reflection", txt);
    save(K_FOLHA, folha);
    $("#reflect-text").value = "";
    renderHistory();
  }

  function exportCopy() {
    const blob = new Blob([JSON.stringify({ _app: "rumo", v: 3, config, folha, projeto, pendentes, archive }, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `rumo-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  function importCopy(file) {
    const r = new FileReader();
    r.onload = () => {
      try {
        const data = JSON.parse(r.result);
        // aceita também exportações antigas ("folha-norte", antes do rename)
        if ((data._app !== "rumo" && data._app !== "folha-norte") || !data.folha || !data.folha.createdAt) throw 0;
        config = data.config || { reviewDay: 22 };
        folha = data.folha;
        projeto = data.projeto || null;
        pendentes = data.pendentes || [];
        archive = data.archive || [];
        save(K_CONFIG, config); save(K_FOLHA, folha);
        save(K_PENDENTES, pendentes); save(K_ARCHIVE, archive);
        if (projeto) save(K_PROJETO, projeto); else localStorage.removeItem(K_PROJETO);
        render();
        if (activeTab === "projeto") renderProjeto();
        flashSave(t("importOk"));
      } catch { alert(t("importBad")); }
    };
    r.readAsText(file);
  }

  function resetAll() {
    if (!confirm(t("resetConfirm"))) return;
    localStorage.removeItem(K_FOLHA); localStorage.removeItem(K_CONFIG);
    folha = null; config = { reviewDay: 22 }; emergencyOpen = false;
    $("#view-folha").hidden = true;
    $("#view-empty").hidden = false;
    $("#setup-review-day").value = 22;
  }

  // ---- Foco (semanal) ----
  function mondayOf(d) {
    const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    const day = x.getDay(); // 0 dom .. 6 sáb
    x.setDate(x.getDate() + (day === 0 ? -6 : 1 - day));
    return x;
  }
  function weekKeyOf(d) { return mondayOf(d).toISOString().slice(0, 10); }
  function weekEndOf(mondayISO) { const d = new Date(mondayISO); d.setDate(d.getDate() + 6); return d.toISOString(); }

  function ensureCurrentWeek() {
    const wk = weekKeyOf(new Date());
    if (projeto && projeto.weekStart === wk) return;
    if (projeto) {
      archive.unshift(projeto);
      archive = archive.slice(0, 12);
      save(K_ARCHIVE, archive);
    }
    projeto = {
      weekStart: wk,
      createdAt: new Date().toISOString(),
      assuntos: [],
      collected: false,
      collectedAt: null,
      informacoes: [],
      history: [{ at: new Date().toISOString(), type: "created", text: "" }]
    };
    save(K_PROJETO, projeto);
  }

  function addProjetoHistory(type, text) {
    projeto.history = projeto.history || [];
    projeto.history.push({ at: new Date().toISOString(), type, text: text || "" });
  }

  function renderProjeto() {
    ensureCurrentWeek();
    $("#projeto-kicker").textContent = t("projKicker")
      .replace("{start}", fmtDate(projeto.weekStart))
      .replace("{end}", fmtDate(weekEndOf(projeto.weekStart)));
    renderTopics();
    renderInfo();
    renderQueue();
    renderProjetoHistory();
  }

  function renderTopics() {
    const ul = $("#topics-list");
    ul.innerHTML = "";
    (projeto.assuntos || []).forEach(a => {
      const li = document.createElement("li");
      li.className = "need" + (a.done ? " need-done" : "");
      li.innerHTML = `
        <label class="need-check">
          <input type="checkbox" ${a.done ? "checked" : ""} />
          <span class="need-desc"></span>
        </label>
        <button type="button" class="need-remove" aria-label="${t("projTopicRemove")}">×</button>`;
      li.querySelector(".need-desc").textContent = a.desc;
      li.querySelector("input").addEventListener("change", e => { a.done = e.target.checked; save(K_PROJETO, projeto); renderTopics(); });
      li.querySelector(".need-remove").addEventListener("click", () => {
        projeto.assuntos = projeto.assuntos.filter(x => x.id !== a.id); save(K_PROJETO, projeto); renderTopics();
      });
      ul.appendChild(li);
    });
  }

  function addTopic() {
    const desc = $("#topic-desc").value.trim();
    if (!desc) return;
    projeto.assuntos = projeto.assuntos || [];
    projeto.assuntos.push({ id: uid(), desc, done: false });
    $("#topic-desc").value = "";
    save(K_PROJETO, projeto);
    renderTopics();
    $("#topic-desc").focus();
  }

  function renderInfo() {
    const banner = $("#collect-banner");
    const btn = $("#btn-collect");
    banner.className = "banner " + (projeto.collected ? "banner-closed" : "banner-open");
    banner.textContent = projeto.collected
      ? t("projInfoBodyDone").replace("{date}", fmtDate(projeto.collectedAt))
      : t("projInfoBodyPending");
    btn.hidden = !!projeto.collected;

    const ul = $("#info-list");
    ul.innerHTML = "";
    if (!projeto.informacoes || !projeto.informacoes.length) {
      const li = document.createElement("li");
      li.className = "need-empty prose";
      li.textContent = t("projInfoEmpty");
      ul.appendChild(li);
      return;
    }
    projeto.informacoes.forEach(info => {
      const li = document.createElement("li");
      li.className = "need" + (info.consumida ? " need-done" : "");
      li.innerHTML = `
        <label class="need-check">
          <input type="checkbox" ${info.consumida ? "checked" : ""} />
          <span class="need-desc"></span>
        </label>
        <button type="button" class="need-remove" aria-label="${t("removeNeed")}">×</button>`;
      li.querySelector(".need-desc").textContent = info.desc;
      li.querySelector("input").addEventListener("change", e => { info.consumida = e.target.checked; save(K_PROJETO, projeto); renderInfo(); });
      li.querySelector(".need-remove").addEventListener("click", () => {
        projeto.informacoes = projeto.informacoes.filter(x => x.id !== info.id); save(K_PROJETO, projeto); renderInfo();
      });
      ul.appendChild(li);
    });
  }

  function openCollectDialog() {
    $("#collect-notes").value = "";
    const box = $("#dlg-collect-pending");
    box.innerHTML = "";
    if (pendentes.length) {
      const label = document.createElement("p");
      label.className = "hint"; label.textContent = t("dlgCollectPendingLabel");
      box.appendChild(label);
      const ul = document.createElement("ul");
      ul.className = "needs";
      pendentes.forEach(p => {
        const li = document.createElement("li");
        li.className = "need";
        li.innerHTML = `<label class="need-check"><input type="checkbox" checked data-pid="${p.id}" /><span class="need-desc"></span></label>`;
        li.querySelector(".need-desc").textContent = p.desc;
        ul.appendChild(li);
      });
      box.appendChild(ul);
    }
    $("#dlg-collect").showModal();
  }

  function onCollectConfirm() {
    const lines = $("#collect-notes").value.split("\n").map(s => s.trim()).filter(Boolean);
    const checked = new Set($$("#dlg-collect-pending input[data-pid]:checked").map(el => el.dataset.pid));
    const fromPending = pendentes.filter(p => checked.has(p.id));

    projeto.informacoes = projeto.informacoes || [];
    lines.forEach(desc => projeto.informacoes.push({ id: uid(), desc, consumida: false }));
    fromPending.forEach(p => projeto.informacoes.push({ id: uid(), desc: p.desc, consumida: false }));

    pendentes = pendentes.filter(p => !checked.has(p.id));
    save(K_PENDENTES, pendentes);

    projeto.collected = true;
    projeto.collectedAt = new Date().toISOString();
    addProjetoHistory("collected");
    save(K_PROJETO, projeto);
    renderProjeto();
  }

  function renderQueue() {
    const ul = $("#queue-list");
    ul.innerHTML = "";
    if (!pendentes.length) {
      const li = document.createElement("li");
      li.className = "need-empty prose";
      li.textContent = t("projQueueEmpty");
      ul.appendChild(li);
      return;
    }
    pendentes.forEach(p => {
      const li = document.createElement("li");
      li.className = "need";
      li.innerHTML = `<span class="need-desc"></span><button type="button" class="need-remove" aria-label="${t("removeNeed")}">×</button>`;
      li.querySelector(".need-desc").textContent = p.desc;
      li.querySelector(".need-remove").addEventListener("click", () => {
        pendentes = pendentes.filter(x => x.id !== p.id); save(K_PENDENTES, pendentes); renderQueue();
      });
      ul.appendChild(li);
    });
  }

  function addQueueItem() {
    const desc = $("#queue-desc").value.trim();
    if (!desc) return;
    pendentes.push({ id: uid(), desc, addedAt: new Date().toISOString() });
    save(K_PENDENTES, pendentes);
    $("#queue-desc").value = "";
    renderQueue();
    $("#queue-desc").focus();
  }

  function renderProjetoHistory() {
    const ol = $("#projeto-history-list");
    ol.innerHTML = "";
    const labels = { created: "projHistCreated", collected: "projHistCollected" };
    [...(projeto.history || [])].reverse().forEach(h => {
      const li = document.createElement("li");
      li.className = "hist hist-" + h.type;
      const meta = document.createElement("p");
      meta.className = "hist-meta mono";
      meta.textContent = `${fmtDate(h.at)} · ${t(labels[h.type] || h.type)}`;
      li.appendChild(meta);
      if (h.text) { const p = document.createElement("p"); p.className = "hist-text"; p.textContent = h.text; li.appendChild(p); }
      ol.appendChild(li);
    });
  }

  function switchTab(name) {
    activeTab = name;
    localStorage.setItem(K_TAB, name);
    $("#pane-norte").hidden = name !== "norte";
    $("#pane-projeto").hidden = name !== "projeto";
    $("#tab-norte").classList.toggle("is-active", name === "norte");
    $("#tab-projeto").classList.toggle("is-active", name === "projeto");
    $("#tab-norte").setAttribute("aria-selected", String(name === "norte"));
    $("#tab-projeto").setAttribute("aria-selected", String(name === "projeto"));
    if (name === "projeto") renderProjeto();
  }

  // ---- compass ----
  function buildCompass() {
    const g = $(".ticks");
    for (let i = 0; i < 24; i++) {
      const major = i % 6 === 0;
      const a = (i / 24) * Math.PI * 2;
      const r1 = 44, r2 = major ? 34 : 39;
      const x1 = 60 + Math.sin(a) * r1, y1 = 60 - Math.cos(a) * r1;
      const x2 = 60 + Math.sin(a) * r2, y2 = 60 - Math.cos(a) * r2;
      const l = document.createElementNS("http://www.w3.org/2000/svg", "line");
      l.setAttribute("x1", x1); l.setAttribute("y1", y1);
      l.setAttribute("x2", x2); l.setAttribute("y2", y2);
      l.setAttribute("class", major ? "tick tick-major" : "tick");
      g.appendChild(l);
    }
    if (!matchMedia("(prefers-reduced-motion: reduce)").matches) {
      const needle = $(".needle");
      needle.style.transform = "rotate(-42deg)";
      requestAnimationFrame(() => {
        needle.style.transition = "transform 1.6s cubic-bezier(.2,.9,.2,1)";
        needle.style.transform = "rotate(0deg)";
      });
    }
  }

  // ---- arranque ----
  function init() {
    buildCompass();

    $("#lang").addEventListener("change", e => {
      lang = e.target.value; localStorage.setItem(K_LANG, lang); applyI18n();
    });

    ["#setup-horizon-n", "#setup-horizon-unit"].forEach(s => $(s).addEventListener("input", refreshSetupHorizon));
    ["#f-horizon-n", "#f-horizon-unit"].forEach(s => $(s).addEventListener("input", () => {
      if (!folha) return;
      $("#horizon-date").textContent = horizonText(folha.createdAt, {
        n: Number($("#f-horizon-n").value) || 1, unit: $("#f-horizon-unit").value
      });
    }));

    $("#btn-create").addEventListener("click", createFolha);
    $("#btn-save").addEventListener("click", onSaveClick);
    $("#btn-add-need").addEventListener("click", addNeed);
    $("#need-desc").addEventListener("keydown", e => { if (e.key === "Enter") addNeed(); });
    $("#btn-reflect").addEventListener("click", logReflection);
    $("#btn-emergency").addEventListener("click", () => { $("#em-reason").value = ""; $("#dlg-emergency").showModal(); });
    $("#btn-export").addEventListener("click", exportCopy);
    $("#import-file").addEventListener("change", e => { if (e.target.files[0]) importCopy(e.target.files[0]); });
    $("#btn-print").addEventListener("click", () => window.print());
    $("#btn-reset").addEventListener("click", resetAll);

    $("#tab-norte").addEventListener("click", () => switchTab("norte"));
    $("#tab-projeto").addEventListener("click", () => switchTab("projeto"));
    $("#btn-add-topic").addEventListener("click", addTopic);
    $("#topic-desc").addEventListener("keydown", e => { if (e.key === "Enter") addTopic(); });
    $("#btn-collect").addEventListener("click", openCollectDialog);
    $("#btn-add-queue").addEventListener("click", addQueueItem);
    $("#queue-desc").addEventListener("keydown", e => { if (e.key === "Enter") addQueueItem(); });
    $("#btn-print-projeto").addEventListener("click", () => window.print());
    $("#dlg-collect").addEventListener("close", () => {
      if ($("#dlg-collect").returnValue === "ok") onCollectConfirm();
    });

    $("#dlg-review").addEventListener("close", e => {
      if ($("#dlg-review").returnValue === "ok") doSave($("#review-notes").value.trim());
    });
    $("#dlg-emergency").addEventListener("close", () => {
      if ($("#dlg-emergency").returnValue !== "ok") return;
      const reason = $("#em-reason").value.trim();
      if (reason.length < 40) return;
      emergencyOpen = true;
      addHistory("emergency", reason);
      save(K_FOLHA, folha);
      render();
    });

    if (folha) { $("#view-empty").hidden = true; $("#view-folha").hidden = false; }
    else { $("#view-empty").hidden = false; }

    applyI18n();
    switchTab(activeTab);
  }

  init();
})();
