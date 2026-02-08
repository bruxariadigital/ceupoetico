(() => {
  "use strict";

  // =====================================================
  // CONFIG / STATE (persistência por dispositivo)
  // =====================================================
  const STORAGE_KEY = "CEUPOETICO_STATE_V4";
  const USERKEY_KEY = "CEUPOETICO_USERKEY_V1";

  function getUserKey() {
    let key = localStorage.getItem(USERKEY_KEY);
    if (!key) {
      key = (crypto?.randomUUID?.() || String(Date.now()) + Math.random()).toString();
      localStorage.setItem(USERKEY_KEY, key);
    }
    return key;
  }

  function loadState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }

  function saveState(state) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (e) {
      console.warn("Não consegui salvar (localStorage cheio?)", e);
    }
  }

  // =====================================================
  // PRESETS (A/C) + buffers
  // Reservamos o3 como DISPLAY final (pós-processamento)
  // =====================================================
  const DISPLAY_BUF = "o3";

  const PRESET_DEFAULTS = {
    A: {
      name: "A",
      renderBuf: "o0",
      code: `// A — espelho

s0.initCam()
speed=.1

src(s0)
  .blend(src(o0), 0.7)
  .modulateScale(src(s0), .1)
  .diff(src(s0).color(1,5,-1), ()=>a.fft[1]*2)
  .luma()
  .out(o0)

a.show()
`
    },

    C: {
      name: "C",
      renderBuf: "o0",
      code: `// C — olá, mundo
speed=.3

osc(.33,3.3,3.3)
  .blend(
    shape(3, .2,.3).mult(
      (osc(2.3,3.3,3.3)
        .modulateRotate(osc(3.3,3.3,3.3).hue(3).shift(2)))
        .color(0,0,8)
    )
  )
  .mult(osc(.33,.33,3.3))
  .modulateScale(noise(3.3,3.3,3.3))
  .diff(osc(5.33,.3,4))
  .mult(shape(3,.3,.2))
  .out(o1)

src(o0)
  .modulateHue(src(o0).scale(1.02))
  .layer(src(o1).luma(0.5, 1e-6), .5)
  .modulateRotate(src(o1).modulate(osc(.2,.5,4)))
  .shift(5)
  .mult(shape(3,.3,.2).scale(1.006))
  .modulateRotate(osc(-3,-3,3).rotate(-2-.3))
  .layer(src(o1).luma(0.25, 1e-5), .5)
  .modulateRotate(src(o1).modulate(osc(.2,.5,4)))
  .shift(5)
  .out(o2)

src(o2)
  .repeat(4,4)
  .modulateScale(osc(5,.5,.5))
  .rotate(.5,.02)
  .out(o0)
`
    }
  };

  function defaultFx() {
    return { contrast: 1.0, saturate: 1.0, brightness: 0.0, colorama: 0.0 };
  }

  function defaultState() {
    return {
      userKey: getUserKey(),
      activePreset: "A",
      presets: {
        A: { code: PRESET_DEFAULTS.A.code, fx: defaultFx() },
        C: { code: PRESET_DEFAULTS.C.code, fx: defaultFx() }
      }
    };
  }

  function getOrInitState() {
    const s = loadState();
    if (
      s?.userKey &&
      (s?.activePreset === "A" || s?.activePreset === "C") &&
      s?.presets?.A &&
      s?.presets?.C
    ) return s;

    const fresh = defaultState();
    saveState(fresh);
    return fresh;
  }

  // =====================================================
  // UTILS
  // =====================================================
  function clamp(v, min, max) {
    return Math.max(min, Math.min(max, v));
  }

  function debounce(fn, ms) {
    let t = null;
    return (...args) => {
      clearTimeout(t);
      t = setTimeout(() => fn(...args), ms);
    };
  }

  // =====================================================
  // HYDRA (real) + DPR fit (corrige pixelado)
  // =====================================================
  let hydraReady = false;
  let hydraInstance = null;

  window.CEU_HOVER = 0;

  function fitHydraCanvasToScreen() {
    const canvas = document.getElementById("hydra-canvas");
    if (!canvas) return;

    const dpr = Math.max(1, Math.min(3, window.devicePixelRatio || 1));
    const w = Math.floor(window.innerWidth * dpr);
    const h = Math.floor(window.innerHeight * dpr);

    if (canvas.width !== w) canvas.width = w;
    if (canvas.height !== h) canvas.height = h;

    canvas.style.width = "100vw";
    canvas.style.height = "100vh";

    try {
      if (hydraInstance?.setResolution) hydraInstance.setResolution(w, h);
    } catch {}
  }

  function initHydraBackground() {
    if (hydraReady) return;
    if (typeof window.Hydra === "undefined") return;

    const canvas = document.getElementById("hydra-canvas");
    if (!canvas) return;

    // eslint-disable-next-line no-undef
    hydraInstance = new Hydra({ canvas, detectAudio: true, makeGlobal: true });

    hydraReady = true;

    fitHydraCanvasToScreen();
    window.addEventListener("resize", fitHydraCanvasToScreen);
    window.addEventListener("orientationchange", () => setTimeout(fitHydraCanvasToScreen, 60));
  }

  function hushIfPossible() {
    try { if (typeof window.hush === "function") window.hush(); } catch {}
  }

  function safeEvalHydra(code) {
    (0, eval)(code);
  }

  function applyPresetFxToDisplay(presetId, state) {
    const meta = PRESET_DEFAULTS[presetId] || PRESET_DEFAULTS.A;
    const srcName = meta.renderBuf || "o0";
    const srcBuf = globalThis[srcName] || globalThis.o0;
    const outBuf = globalThis[DISPLAY_BUF] || globalThis.o3;

    const fx = state.presets[presetId]?.fx || defaultFx();

    try {
      src(srcBuf)
        .contrast(() => fx.contrast + window.CEU_HOVER * 0.35)
        .saturate(() => fx.saturate + window.CEU_HOVER * 0.9)
        .brightness(() => fx.brightness + window.CEU_HOVER * 0.12)
        .colorama(() => fx.colorama + window.CEU_HOVER * 0.6)
        .out(outBuf);

      if (typeof window.render === "function") window.render(outBuf);
    } catch (e) {
      console.warn("FX falhou (ignorado):", e);
    }
  }

  function runActivePreset(state) {
    initHydraBackground();
    hushIfPossible();

    const presetId = (state.activePreset === "C") ? "C" : "A";
    const code = (state.presets[presetId]?.code || PRESET_DEFAULTS[presetId]?.code || "").trim();
    if (!code) return;

    try {
      safeEvalHydra(code);
    } catch (e) {
      console.error(e);
      alert("Erro no código Hydra do preset ativo. Veja o console.");
      return;
    }

    applyPresetFxToDisplay(presetId, state);
  }

  // =====================================================
  // SEEDS: plantar altera FX aleatório do preset ativo
  // =====================================================
  function mutateFxOnPlant(state) {
    const id = (state.activePreset === "C") ? "C" : "A";
    const fx = state.presets[id]?.fx || defaultFx();

    const pick = Math.floor(Math.random() * 4);

    if (pick === 0) fx.contrast   = clamp(fx.contrast + (Math.random() * 0.35), 0.7, 2.8);
    if (pick === 1) fx.saturate   = clamp(fx.saturate + (Math.random() * 0.55), 0.6, 3.2);
    if (pick === 2) fx.brightness = clamp(fx.brightness + (Math.random() * 0.06 - 0.01), -0.25, 0.35);
    if (pick === 3) fx.colorama   = clamp(fx.colorama + (Math.random() * 0.35), 0, 2.5);

    state.presets[id].fx = fx;
    saveState(state);

    applyPresetFxToDisplay(id, state);
  }

  // =====================================================
  // SUPABASE (mural)
  // =====================================================
  const SUPABASE_URL = "https://nroguehkffzgerirbdcn.supabase.co";
  const SUPABASE_ANON_KEY = "sb_publishable_87bQ1cjlVd6gw1Ugh45eYg_P8mTW2ZJ";
  const MAX_BYTES = 2 * 1024 * 1024;

  let sb = null;

  function supabaseReady() {
    if (typeof window.supabase === "undefined") return false;
    if (!sb) sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    return true;
  }

  function validateFile(file) {
    if (!file) return null;
    if (file.size > MAX_BYTES) return "Arquivo acima de 2MB. Envie um arquivo menor.";
    return null;
  }

  function setStatus(el, msg) {
    if (!el) return;
    el.textContent = msg || "";
  }

  function closeDialogSafe(dlg) {
    try { dlg.close(); } catch {}
    try { dlg.removeAttribute("open"); } catch {}
  }

  function formatDate(iso) {
    try {
      const d = new Date(iso);
      return d.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
    } catch {
      return "";
    }
  }

  async function uploadMediaIfAny(file) {
    if (!file) return null;

    const ext = (file.name.split(".").pop() || "bin").toLowerCase();
    const path = `${crypto.randomUUID()}.${ext}`;

    const { error: upErr } = await sb
      .storage
      .from("mural")
      .upload(path, file, { contentType: file.type, upsert: false });

    if (upErr) throw upErr;

    const { data } = sb.storage.from("mural").getPublicUrl(path);
    return data?.publicUrl || null;
  }

  async function insertPost(text, mediaUrl, mediaType) {
    const { error } = await sb
      .from("mural_posts")
      .insert([{ text: text || null, image_url: mediaUrl || null, media_type: mediaType || null }]);

    if (error) throw error;
  }

  async function fetchPosts() {
    const { data, error } = await sb
      .from("mural_posts")
      .select("id, created_at, text, image_url, media_type")
      .order("created_at", { ascending: false })
      .limit(220);

    if (error) throw error;
    return data || [];
  }

  // =====================================================
  // BOLHAS: abre/fecha controlado (fecha ao clicar fora)
  // =====================================================
  function closeAllSeedBubbles() {
    document.querySelectorAll(".seed.is-open").forEach((s) => s.classList.remove("is-open"));
  }

  // =====================================================
  // VIEWER + GARDEN
  // =====================================================
  function pickGlyph(id) {
    const options = ["✶", "✦", "✺", "✹", "❋", "✷", "☼", "☾", "⟡", "✧", "✩", "✪"];
    let h = 2166136261;
    for (let i = 0; i < id.length; i++) {
      h ^= id.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return options[(h >>> 0) % options.length];
  }

  function openViewer(viewerEls, post) {
    const { viewer, viewerImg, viewerText, viewerMeta } = viewerEls;
    const mediaType = post.media_type || "";
    const isImage = mediaType.startsWith("image/");
    const isVideo = mediaType.startsWith("video/");
    const isAudio = mediaType.startsWith("audio/");

    if (viewerImg) {
      viewerImg.style.display = "none";
      viewerImg.removeAttribute("src");
      viewerImg.alt = "";
      viewerImg.draggable = false;
    }

    let bodyText = post.text || "";

    if (post.image_url && isImage && viewerImg) {
      viewerImg.src = post.image_url;
      viewerImg.style.display = "block";
      viewerImg.alt = "Imagem enviada ao mural";
      viewerImg.draggable = false;
    }

    if (post.image_url && (isVideo || isAudio)) {
      bodyText += (bodyText ? "\n\n" : "") + `Arquivo: ${post.image_url}`;
    } else if (post.image_url && !isImage) {
      bodyText += (bodyText ? "\n\n" : "") + `Arquivo: ${post.image_url}`;
    }

    if (viewerText) viewerText.textContent = bodyText;
    if (viewerMeta) viewerMeta.textContent = post.created_at ? `Enviado em ${formatDate(post.created_at)}` : "";

    viewer?.showModal?.();
  }

  function createSeedEl(post, viewerEls, state) {
    const el = document.createElement("button");
    el.className = "seed";
    el.type = "button";

    const x = 6 + Math.random() * 88;
    const y = 12 + Math.random() * 76;
    el.style.left = x.toFixed(2) + "%";
    el.style.top = y.toFixed(2) + "%";

    const dur = 4.8 + Math.random() * 4.5;
    el.style.animationDuration = dur.toFixed(2) + "s";
    el.style.animationDelay = (-Math.random() * dur).toFixed(2) + "s";

    const mediaType = post.media_type || "";
    const isImage = mediaType.startsWith("image/");

    if (post.image_url && isImage) {
      const img = document.createElement("img");
      img.className = "seedThumb";
      img.src = post.image_url;
      img.alt = "";
      img.draggable = false;
      el.appendChild(img);
    } else {
      const span = document.createElement("span");
      span.className = "emoji";
      span.textContent = pickGlyph(post.id);
      el.appendChild(span);
    }

    const bubble = document.createElement("div");
    bubble.className = "bubble";

    if (post.image_url && isImage) {
      const bImg = document.createElement("img");
      bImg.src = post.image_url;
      bImg.alt = "";
      bImg.draggable = false;
      bubble.appendChild(bImg);
    }

    if (post.text) {
      const bText = document.createElement("div");
      bText.className = "bubbleText";
      bText.textContent = post.text;
      bubble.appendChild(bText);
    }

    const hint = document.createElement("div");
    hint.className = "bubbleHint";
    hint.textContent = "toque de novo para abrir";
    bubble.appendChild(hint);

    el.appendChild(bubble);

    // hover aleatório (desktop)
    el.addEventListener("mouseenter", () => {
      window.CEU_HOVER = 0.45 + Math.random() * 1.05;
      applyPresetFxToDisplay(state.activePreset, state);
    });
    el.addEventListener("mouseleave", () => {
      window.CEU_HOVER = 0;
      applyPresetFxToDisplay(state.activePreset, state);
    });

    // click/tap: 1º abre bolha, 2º abre viewer
    el.addEventListener("click", (ev) => {
      ev.preventDefault();
      ev.stopPropagation();

      const isOpen = el.classList.contains("is-open");
      if (!isOpen) {
        closeAllSeedBubbles();
        el.classList.add("is-open");
        return;
      }

      el.classList.remove("is-open");
      openViewer(viewerEls, post);
    });

    return el;
  }

  async function renderGarden(garden, viewerEls, state) {
    if (!garden) return;
    if (!supabaseReady()) return;

    try {
      const posts = await fetchPosts();
      const ordered = (posts || []).reverse();

      garden.innerHTML = "";
      ordered.forEach((p) => garden.appendChild(createSeedEl(p, viewerEls, state)));
    } catch (err) {
      console.error("renderGarden falhou:", err);
    }
  }

  // =====================================================
  // MINI EDITOR (edita preset ativo + reset link)
  // =====================================================
  function setupMiniEditor(state) {
    const openBtn = document.getElementById("openHydraMini");
    const panel = document.getElementById("hydraMini");
    const closeBtn = document.getElementById("closeHydraMini");
    const codeEl = document.getElementById("hydraCode");
    const runBtn = document.getElementById("runHydra");
    const resetLink = document.getElementById("resetHydra");

    if (!panel || !codeEl) return null;

    function syncEditorFromState() {
      const id = (state.activePreset === "C") ? "C" : "A";
      codeEl.value = state.presets[id]?.code || PRESET_DEFAULTS[id].code;
    }

    const saveEditorToStateDebounced = debounce(() => {
      const id = (state.activePreset === "C") ? "C" : "A";
      state.presets[id].code = codeEl.value;
      saveState(state);
    }, 200);

    codeEl.addEventListener("input", saveEditorToStateDebounced);

    function openPanel(ev) {
      ev?.preventDefault?.();
      ev?.stopPropagation?.();
      initHydraBackground();

      if (panel.hidden) {
        const r = openBtn?.getBoundingClientRect?.();
        panel.hidden = false;
        if (r) {
          const margin = 10;
          const left = clamp(r.left, margin, window.innerWidth - panel.offsetWidth - margin);
          const top = clamp(r.top - panel.offsetHeight - 10, margin, window.innerHeight - panel.offsetHeight - margin);
          panel.style.left = `${left}px`;
          panel.style.top = `${top}px`;
        } else {
          panel.style.left = "80px";
          panel.style.top = "120px";
        }
      } else {
        panel.hidden = true;
      }
    }

    function closePanel(ev) {
      ev?.preventDefault?.();
      ev?.stopPropagation?.();
      panel.hidden = true;
    }

    openBtn?.addEventListener("click", openPanel);
    closeBtn?.addEventListener("click", closePanel);

    window.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && panel && !panel.hidden) closePanel(e);
    });

    runBtn?.addEventListener("click", (ev) => {
      ev.preventDefault();
      ev.stopPropagation();

      const id = (state.activePreset === "C") ? "C" : "A";
      state.presets[id].code = codeEl.value;
      saveState(state);

      runActivePreset(state);
    });

    resetLink?.addEventListener("click", (ev) => {
      ev.preventDefault();
      ev.stopPropagation();

      const id = (state.activePreset === "C") ? "C" : "A";
      const ok = confirm(`Resetar o preset ${id} para o código padrão? Você vai perder as alterações desse preset.`);
      if (!ok) return;

      state.presets[id].code = PRESET_DEFAULTS[id].code;
      state.presets[id].fx = defaultFx();
      saveState(state);

      syncEditorFromState();
      runActivePreset(state);
    });

    syncEditorFromState();
    enableFloatDragResize(panel);

    return { syncEditorFromState };
  }

  function enableFloatDragResize(panel) {
    const topbar = panel.querySelector(".hydra-mini__top");
    if (!topbar) return;

    if (panel.dataset.floatReady === "1") return;
    panel.dataset.floatReady = "1";

    const dirs = ["n","s","e","w","ne","nw","se","sw"];
    dirs.forEach((d) => {
      const h = document.createElement("div");
      h.className = `resize-handle resize-handle--${d}`;
      h.dataset.dir = d;
      panel.appendChild(h);
    });

    const isInteractive = (el) => !!el?.closest?.("button, a, input, textarea, select, label");

    let drag = null;

    topbar.addEventListener("pointerdown", (e) => {
      if (panel.hidden) return;
      if (isInteractive(e.target)) return;

      e.preventDefault();

      const r = panel.getBoundingClientRect();
      drag = { startX: e.clientX, startY: e.clientY, left: r.left, top: r.top };
      topbar.setPointerCapture(e.pointerId);
    });

    topbar.addEventListener("pointermove", (e) => {
      if (!drag) return;

      const dx = e.clientX - drag.startX;
      const dy = e.clientY - drag.startY;

      const margin = 8;
      const maxLeft = window.innerWidth - panel.offsetWidth - margin;
      const maxTop = window.innerHeight - panel.offsetHeight - margin;

      panel.style.left = `${clamp(drag.left + dx, margin, maxLeft)}px`;
      panel.style.top = `${clamp(drag.top + dy, margin, maxTop)}px`;
    });

    const stopDrag = () => { drag = null; };
    topbar.addEventListener("pointerup", stopDrag);
    topbar.addEventListener("pointercancel", stopDrag);

    let resize = null;

    panel.addEventListener("pointerdown", (e) => {
      const handle = e.target.closest(".resize-handle");
      if (!handle || panel.hidden) return;

      e.preventDefault();
      e.stopPropagation();

      const r = panel.getBoundingClientRect();
      resize = {
        dir: handle.dataset.dir,
        startX: e.clientX,
        startY: e.clientY,
        left: r.left,
        top: r.top,
        width: r.width,
        height: r.height
      };

      panel.setPointerCapture(e.pointerId);
    });

    panel.addEventListener("pointermove", (e) => {
      if (!resize) return;

      const dx = e.clientX - resize.startX;
      const dy = e.clientY - resize.startY;

      const minW = 280;
      const minH = 200;

      let left = resize.left;
      let top = resize.top;
      let width = resize.width;
      let height = resize.height;

      const dir = resize.dir;

      if (dir.includes("e")) width = resize.width + dx;
      if (dir.includes("w")) { width = resize.width - dx; left = resize.left + dx; }

      if (dir.includes("s")) height = resize.height + dy;
      if (dir.includes("n")) { height = resize.height - dy; top = resize.top + dy; }

      width = Math.max(minW, width);
      height = Math.max(minH, height);

      const margin = 8;
      left = clamp(left, margin, window.innerWidth - width - margin);
      top = clamp(top, margin, window.innerHeight - height - margin);

      panel.style.left = `${left}px`;
      panel.style.top = `${top}px`;
      panel.style.width = `${width}px`;
      panel.style.height = `${height}px`;
    });

    const stopResize = () => { resize = null; };
    panel.addEventListener("pointerup", stopResize);
    panel.addEventListener("pointercancel", stopResize);
  }

  // =====================================================
  // PRESET UI (triângulos A/C)
  // =====================================================
  function setupPresetDock(state, miniApi) {
    const dock = document.getElementById("presetDock");
    if (!dock) return;

    const buttons = Array.from(dock.querySelectorAll("[data-preset]"));

    function setActiveUI() {
      buttons.forEach((b) => {
        const id = b.getAttribute("data-preset");
        b.classList.toggle("is-active", id === state.activePreset);
      });
    }

    buttons.forEach((btn) => {
      btn.addEventListener("click", (ev) => {
        ev.preventDefault();
        ev.stopPropagation();

        const id = btn.getAttribute("data-preset");
        if (id !== "A" && id !== "C") return;

        state.activePreset = id;
        saveState(state);

        miniApi?.syncEditorFromState?.();
        runActivePreset(state);
        setActiveUI();
      });
    });

    setActiveUI();
  }

  // =====================================================
  // START
  // =====================================================
  window.addEventListener("DOMContentLoaded", () => {
    const state = getOrInitState();

    // refs mural
    const garden = document.getElementById("garden");

    const composer = document.getElementById("composer");
    const openComposer = document.getElementById("openComposer");
    const closeComposer = document.getElementById("closeComposer");

    const form = document.getElementById("muralForm");
    const textEl = document.getElementById("text");
    const mediaEl = document.getElementById("media");
    const statusEl = document.getElementById("status");
    const sendBtn = document.getElementById("sendBtn");

    const viewer = document.getElementById("viewer");
    const closeViewer = document.getElementById("closeViewer");
    const viewerImg = document.getElementById("viewerImg");
    const viewerText = document.getElementById("viewerText");
    const viewerMeta = document.getElementById("viewerMeta");
    const viewerEls = { viewer, viewerImg, viewerText, viewerMeta };

    // Fecha bolhas ao clicar em qualquer lugar fora
    document.addEventListener("pointerdown", (e) => {
      if (e.target.closest?.(".seed")) return;
      closeAllSeedBubbles();
    });

    // Desencorajar “download fácil” (não impede 100%)
    document.addEventListener("contextmenu", (e) => {
      if (e.target.closest?.(".viewerImg, .seed, #garden")) e.preventDefault();
    });

    // Viewer fecha clicando fora do card
    viewer?.addEventListener("click", (e) => {
      const box = viewer.querySelector(".viewer");
      if (!box) return;
      const r = box.getBoundingClientRect();
      const inside =
        e.clientX >= r.left && e.clientX <= r.right &&
        e.clientY >= r.top && e.clientY <= r.bottom;
      if (!inside) closeDialogSafe(viewer);
    });

    // Hydra
    initHydraBackground();
    runActivePreset(state);

    // Mini editor
    const miniApi = setupMiniEditor(state);

    // Preset dock (A/C)
    setupPresetDock(state, miniApi);

    // abrir composer
    openComposer?.addEventListener("click", () => {
      if (composer?.showModal) composer.showModal();
      else composer?.setAttribute("open", "");
    });

    closeComposer?.addEventListener("click", () => closeDialogSafe(composer));
    closeViewer?.addEventListener("click", () => closeDialogSafe(viewer));

    // fechar composer clicando fora
    composer?.addEventListener("click", (e) => {
      const formEl = composer.querySelector("form");
      if (!formEl) return;
      const r = formEl.getBoundingClientRect();
      const inside =
        e.clientX >= r.left && e.clientX <= r.right &&
        e.clientY >= r.top && e.clientY <= r.bottom;
      if (!inside) closeDialogSafe(composer);
    });

    // submit mural
    form?.addEventListener("submit", async (e) => {
      e.preventDefault();

      const text = (textEl?.value || "").trim();
      const file = mediaEl?.files?.[0] || null;

      const fileError = validateFile(file);
      if (fileError) {
        setStatus(statusEl, fileError);
        return;
      }
      if (!text && !file) {
        setStatus(statusEl, "Escreva um texto e/ou envie uma mídia ✨");
        return;
      }
      if (!supabaseReady()) {
        setStatus(statusEl, "Supabase não carregou. Confira os <script> no index.html.");
        return;
      }

      try {
        if (sendBtn) sendBtn.disabled = true;
        setStatus(statusEl, "Enviando…");

        const mediaUrl = await uploadMediaIfAny(file);
        const mediaType = file?.type || null;

        await insertPost(text, mediaUrl, mediaType);

        // plantar => muda FX do preset ativo
        mutateFxOnPlant(state);

        if (textEl) textEl.value = "";
        if (mediaEl) mediaEl.value = "";

        setStatus(statusEl, "Recebido ✶ Sua marca já está no céu.");

        await renderGarden(garden, viewerEls, state);
        setTimeout(() => closeDialogSafe(composer), 450);
      } catch (err) {
        console.error(err);
        setStatus(statusEl, "Não consegui enviar agora. Tente novamente.");
      } finally {
        if (sendBtn) sendBtn.disabled = false;
      }
    });

    // render inicial
    renderGarden(garden, viewerEls, state);
  });

})();
