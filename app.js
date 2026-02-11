(() => {
  "use strict";

  // =====================================================
  // HELPERS
  // =====================================================

  // hash determinístico (string -> [0,1))
  function hash01(str) {
    // FNV-1a 32-bit
    let h = 0x811c9dc5;
    for (let i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 0x01000193);
    }
    // >>>0 para unsigned; divide por 2^32
    return (h >>> 0) / 4294967296;
  }

  // Executa código Hydra no escopo global (para funcionar com osc(), shape(), etc.)
  function safeEvalHydra(code) {
    const src = String(code || "");
    // Indirect eval = escopo global
    (0, eval)(src);
  }


  // =====================================================
  // CONFIG / STATE (persistência por dispositivo)
  // =====================================================
  const STORAGE_KEY = "CEUPOETICO_STATE_V5";
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
  // PRESETS (A/B/C/D) + buffers
  // Reservamos o3 como DISPLAY final (pós-processamento)
  // =====================================================
  const DISPLAY_BUF = "o3";
  const PRESET_IDS = ["A", "B", "C", "D"];

  const PRESET_DEFAULTS = {
    // A: (novo) — PARA VOCÊ, O QUE É SER POTIGUAR?
    A: {
      name: "A",
      renderBuf: "o0",
      code: `// A — PARA VOCÊ, O QUE É SER POTIGUAR?

s0.initImage("https://image2url.com/r2/default/gifs/1770579272000-56a42137-bb31-4f81-a13e-1a2ab3e05e8b.gif")
s1.initCam()

src(s0)
  .mult(src(s1).add(src(s1).scale(1.006)))
  .modulate(s0, .4)
  .blend(s0, () => a.fft[1])
  .out(o0)

a.show()
`
    },

    // B: (antigo A) — espelho simples
    B: {
      name: "B",
      renderBuf: "o0",
      code: `// B — espelho (base)

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

    // C: (mantém) — olá, mundo
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
    },

    // D: (novo) — espelho (complexo)
    D: {
      name: "D",
      renderBuf: "o2",
      code: `// D — espelho

s1.initCam()

osc().kaleid(500).rotate(2, 0.5).mask(shape(3).rotate(0.2, -0.3)).out(o0)

src(o1, 0.5)
  .blend(o0, 0.05)
  .rotate(0.22)
  .repeat(5)
  .diff(gradient(5, -1.2, 0.5), 0.5)
  .color(12)
  .contrast(1)
  .blend(o0,0.5)
  .scale([15, 10, 5].fast(2).smooth(5))
  .modulate(noise(1, 0.5, 500))
  .rotate(0.1, 0.5)
  .hue(12)
  .modulate(osc(()=>a.fft[1]*3),0.2, 2)
  .rotate(2,0.5)
  .modulate(src(o1).scrollY(.5,.2), ()=>a.fft[1]*8)
  .out(o1)

src(o2)
  .blend(src(s1).scrollX(20,.04).modulateScrollX(osc(2,.3)))
  .blend(o2,0.5)
  .modulate(
    osc().kaleid(500).rotate(2, 0.5).mask(shape(3).rotate(0.2, -0.3))
  )
  .out(o2)

render(o2)
a.show()
`
    }
  };

  function defaultFx() {
    // “menos saturado” por padrão
    return { contrast: 1.0, saturate: 0.95, brightness: 0.0, colorama: 0.0 };
  }

  function defaultState() {
    const presets = {};
    PRESET_IDS.forEach((id) => { presets[id] = { code: PRESET_DEFAULTS[id].code, fx: defaultFx() }; });

    return {
      userKey: getUserKey(),
      activePreset: "A",
      presets,
      seedPowers: {}
    };
  }

  // migração suave (se existir estado antigo, tenta reaproveitar)
  function getOrInitState() {
    const legacy = (() => {
      try {
        const rawV4 = localStorage.getItem("CEUPOETICO_STATE_V4");
        if (!rawV4) return null;
        return JSON.parse(rawV4);
      } catch { return null; }
    })();

    const s = loadState();

    const baseState = s || legacy;
    if (baseState?.userKey && baseState?.presets) {
      const next = defaultState();
      next.userKey = baseState.userKey || next.userKey;
      next.seedPowers = baseState.seedPowers || {};

      // mantém código/fx se existir
      PRESET_IDS.forEach((id) => {
        if (baseState.presets?.[id]?.code) next.presets[id].code = baseState.presets[id].code;
        if (baseState.presets?.[id]?.fx) next.presets[id].fx = { ...defaultFx(), ...baseState.presets[id].fx };
      });

      // se no legado existia A/C (antigos), mapeia pro novo B/C
      if (baseState.presets?.A?.code && !baseState.presets?.B?.code) {
        next.presets.B.code = baseState.presets.A.code;
        next.presets.B.fx = { ...defaultFx(), ...baseState.presets.A.fx };
      }
      if (baseState.presets?.C?.code) {
        next.presets.C.code = baseState.presets.C.code;
        next.presets.C.fx = { ...defaultFx(), ...baseState.presets.C.fx };
      }

      const active = String(baseState.activePreset || "A").toUpperCase();
      next.activePreset = PRESET_IDS.includes(active) ? active : "A";

      saveState(next);
      return next;
    }

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

  function isHoverDesktop() {
    return window.matchMedia && window.matchMedia("(hover:hover) and (pointer:fine)").matches;
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

  // =====================================================
  // Hydra FX aleatório por bolha (hover/click)
  //   - hover aplica alteração randômica (preview)
  //   - click trava a alteração até clicar em outra bolha
  // =====================================================
  //   - hover aplica FX randômico
  //   - click trava FX até outra bolha ou clique fora
  // =====================================================
  function makeFxFromPower(powerKey, nonce) {
    const r = hash01(String(powerKey) + "::" + String(nonce) + "::fx");
    const pick = Math.floor(r * 8);
    const a = 0.15 + r * 0.55;
    const b = 1.0 + r * 5.0;
    return { pick, a, b, nonce };
  }

  // lock/preview (não persistem entre sessões)
  let LOCKED_SEED_ID = null;
  let LOCKED_FX = null;
  let PREVIEW_SEED_ID = null;
  let PREVIEW_FX = null;

  function setPreviewFx(seedId, fx, state) {
    PREVIEW_SEED_ID = seedId;
    PREVIEW_FX = fx;
    window.CEU_SEED_FX = fx;
    window.CEU_HOVER = 0;
    applyPresetFxToDisplay(state.activePreset, state);
  }

  function clearPreviewFx(state) {
    PREVIEW_SEED_ID = null;
    PREVIEW_FX = null;
    // se existir lock, mantém; senão limpa
    window.CEU_SEED_FX = LOCKED_FX || null;
    window.CEU_HOVER = 0;
    applyPresetFxToDisplay(state.activePreset, state);
  }

  function setLockedFx(seedId, fx, state) {
    LOCKED_SEED_ID = seedId;
    LOCKED_FX = fx;
    window.CEU_SEED_FX = fx;
    window.CEU_HOVER = 0;
    applyPresetFxToDisplay(state.activePreset, state);
  }

  function applyRandomSeedFx(node, fxObj) {
    if (!fxObj) return node;
    const p = fxObj.pick % 8;
    try {
      if (p === 0) return node.invert(fxObj.a);
      if (p === 1) return node.posterize(Math.floor(2 + fxObj.b), 0.6);
      if (p === 2) return node.kaleid(Math.floor(2 + fxObj.b)).rotate(() => fxObj.a * 0.35);
      if (p === 3) return node.pixelate(18 + Math.floor(fxObj.b * 12), 10 + Math.floor(fxObj.b * 6));
      if (p === 4) return node.scrollX(() => fxObj.a * 0.02, () => fxObj.a * 0.01).scrollY(() => -fxObj.a * 0.02, () => fxObj.a * 0.01);
      if (p === 5) return node.modulateRotate(node, () => fxObj.a * 0.35).contrast(1.0 + fxObj.a * 0.35);
      if (p === 6) return node.modulateScale(node, () => 0.8 + fxObj.a * 0.8, () => fxObj.a * 0.15);
      return node.luma(() => 0.25 + fxObj.a * 0.55, 0.15);
    } catch {
      return node;
    }
  }

  function applyPresetFxToDisplay(presetId, state) {
    const meta = PRESET_DEFAULTS[presetId] || PRESET_DEFAULTS.A;
    const srcName = meta.renderBuf || "o0";
    const srcBuf = globalThis[srcName] || globalThis.o0;
    const outBuf = globalThis[DISPLAY_BUF] || globalThis.o3;

    const fx = state.presets[presetId]?.fx || defaultFx();

    // suaviza “hover-hydra” (menos colorama / menos saturação)
    const h = window.CEU_HOVER || 0;

    const seedFx = window.CEU_SEED_FX || null; // {pick,a,b}

    try {
      let chain = src(srcBuf);
      chain = applyRandomSeedFx(chain, seedFx);

      chain
        .contrast(() => fx.contrast + h * 0.14)
        .saturate(() => fx.saturate + h * 0.22)
        .brightness(() => fx.brightness + h * 0.05)
        .colorama(() => fx.colorama + h * 0.16)
        .out(outBuf);

      if (typeof window.render === "function") window.render(outBuf);
    } catch (e) {
      console.warn("FX falhou (ignorado):", e);
    }
  }

  function runActivePreset(state) {
    initHydraBackground();
    hushIfPossible();

    const presetId = PRESET_IDS.includes(state.activePreset) ? state.activePreset : "A";
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
    document.querySelectorAll(".seed.is-open").forEach((s) => {
      s.classList.remove("is-open");
      s.style.zIndex = "";
    });
  }

  function openSeedBubble(seedEl) {
    closeAllSeedBubbles();
    seedEl.classList.add("is-open");
    seedEl.style.zIndex = "160";
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

  function enableSeedDrag(el, garden) {
    let drag = null;
    let moved = false;
    let movedAt = 0;

    const getGardenRect = () => (garden?.getBoundingClientRect?.() || { left: 0, top: 0, width: window.innerWidth, height: window.innerHeight });

    el.addEventListener("pointerdown", (e) => {
      // não inicia drag se clicou num elemento interativo dentro (bubble)
      if (e.target?.closest?.(".bubble")) return;

      moved = false;
      const r = el.getBoundingClientRect();
      drag = {
        id: e.pointerId,
        startX: e.clientX,
        startY: e.clientY,
        startLeft: r.left,
        startTop: r.top
      };

      el.setPointerCapture(e.pointerId);
      el.style.zIndex = "160";
      el.classList.add("is-dragging");
      el.style.animationPlayState = "paused";
    });

    el.addEventListener("pointermove", (e) => {
      if (!drag || e.pointerId !== drag.id) return;

      const dx = e.clientX - drag.startX;
      const dy = e.clientY - drag.startY;

      if (Math.abs(dx) + Math.abs(dy) > 6) moved = true;

      const g = getGardenRect();

      // posição do centro do seed (px -> %)
      const cx = (drag.startLeft + dx + (el.offsetWidth / 2) - g.left);
      const cy = (drag.startTop + dy + (el.offsetHeight / 2) - g.top);

      const px = clamp(cx / g.width, 0.02, 0.98) * 100;
      const py = clamp(cy / g.height, 0.05, 0.95) * 100;

      el.style.left = `${px.toFixed(2)}%`;
      el.style.top = `${py.toFixed(2)}%`;
    });

    const stop = (e) => {
      if (!drag || e.pointerId !== drag.id) return;
      drag = null;

      try { el.releasePointerCapture(e.pointerId); } catch {}
      el.classList.remove("is-dragging");
      el.style.animationPlayState = "";
      movedAt = Date.now();

      // se arrastou, não deixa o click “abrir/fechar” disparar
      el.dataset.justDragged = moved ? "1" : "0";
      setTimeout(() => { el.dataset.justDragged = "0"; }, 220);
    };

    el.addEventListener("pointerup", stop);
    el.addEventListener("pointercancel", stop);

    // helper usado no click handler
    el._wasJustDragged = () => {
      const v = el.dataset.justDragged === "1";
      if (v && Date.now() - movedAt < 400) return true;
      return false;
    };
  }

  function createSeedEl(post, viewerEls, state, garden) {
    const el = document.createElement("button");
    el.className = "seed";
    el.type = "button";

    // cada seed ganha um “poder” (chave) no momento em que é plantada
    // (persistimos por dispositivo para manter identidade/movimento)
    if (!state.seedPowers) state.seedPowers = {};
    if (!state.seedPowers[post.id]) {
      state.seedPowers[post.id] = (crypto?.randomUUID?.() || String(Date.now()) + Math.random()).toString();
      saveState(state);
    }

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
    hint.textContent = isHoverDesktop() ? "clique para fixar" : "toque para fixar";
    bubble.appendChild(hint);

    const viewBtn = document.createElement("button");
    viewBtn.type = "button";
    viewBtn.className = "btn btn--tiny";
    viewBtn.textContent = "ver";
    viewBtn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      openViewer(viewerEls, post);
    });
    bubble.appendChild(viewBtn);

    el.appendChild(bubble);

    // drag (desktop + mobile)
    enableSeedDrag(el, garden);

    // hover (desktop): abre/mostra bolha + aplica alteração randômica (preview)
    // Regras:
    // - hover só funciona quando NÃO existe lock ativo
    // - sair do hover desfaz preview (volta para lock, se existir)
    if (isHoverDesktop()) {
      el.addEventListener("pointerenter", () => {
        if (LOCKED_SEED_ID) return;
        openSeedBubble(el);

        // preview aleatório, mas "amarrado" ao poder dessa seed
        const power = (state.seedPowers?.[post.id]) || null;
        const baseKey = power || post.id;
        const nonce = (parseInt(el.dataset.fxNonce || "0", 10) || 0) + 1;
        el.dataset.fxNonce = String(nonce);
        const fx = makeFxFromPower(baseKey, nonce);

        setPreviewFx(post.id, fx, state);
      });

      el.addEventListener("pointerleave", () => {
        if (LOCKED_SEED_ID) return;
        closeAllSeedBubbles();
        clearPreviewFx(state);
      });
    }

    // touch (mobile): sem hover real — o preview só acontece no 1º toque (antes do lock)
    // - 1 toque (click) = trava
    // - 2 toques rápidos (dblclick) = abre viewer sem mexer no lock

    // click/tap:
    // - fixa (som + FX) nesta bolha
    // single click: fixa aquela alteração atual (lock)
    let clickT = null;
    el.addEventListener("click", (ev) => {
      ev.preventDefault();
      ev.stopPropagation();

      if (typeof el._wasJustDragged === "function" && el._wasJustDragged()) return;

      // espera um pouco para permitir dblclick
      clearTimeout(clickT);
      clickT = setTimeout(() => {
        openSeedBubble(el);

        // se já existe lock em outra bolha, trocar o lock para esta
        const power = (state.seedPowers?.[post.id]) || null;
        const baseKey = power || post.id;

        // se existe preview desta bolha, trava esse; senão gera um novo "agora"
        let fx = null;
        if (!LOCKED_SEED_ID && PREVIEW_SEED_ID === post.id && PREVIEW_FX) fx = PREVIEW_FX;
        if (LOCKED_SEED_ID === post.id && LOCKED_FX) fx = LOCKED_FX;

        if (!fx) {
          const nonce = (parseInt(el.dataset.fxNonce || "0", 10) || 0) + 1;
          el.dataset.fxNonce = String(nonce);
          fx = makeFxFromPower(baseKey, nonce);
        }

        setLockedFx(post.id, fx, state);
      }, 220);
    });

    // viewer (duplo clique): abre o conteúdo sem desfazer o lock
    // viewer só com gesto diferente (duplo clique)
    el.addEventListener("dblclick", (ev) => {
      clearTimeout(clickT);
      ev.preventDefault();
      ev.stopPropagation();
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
      ordered.forEach((p) => garden.appendChild(createSeedEl(p, viewerEls, state, garden)));
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

    const activeId = () => (PRESET_IDS.includes(state.activePreset) ? state.activePreset : "A");

    function syncEditorFromState() {
      const id = activeId();
      codeEl.value = state.presets[id]?.code || PRESET_DEFAULTS[id].code;
    }

    const saveEditorToStateDebounced = debounce(() => {
      const id = activeId();
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

      const id = activeId();
      state.presets[id].code = codeEl.value;
      saveState(state);

      runActivePreset(state);
    });

    resetLink?.addEventListener("click", (ev) => {
      ev.preventDefault();
      ev.stopPropagation();

      const id = activeId();
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

    function resetActiveToDefault(opts = {}) {
      const id = activeId();
      state.presets[id].code = PRESET_DEFAULTS[id].code;
      saveState(state);
      syncEditorFromState();
      if (opts.run) runActivePreset(state);
    }

    return { syncEditorFromState, resetActiveToDefault };
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
  // PRESET UI (triângulos A/B/C/D)
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

        const id = String(btn.getAttribute("data-preset") || "").toUpperCase();
        if (!PRESET_IDS.includes(id)) return;

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
  // SOBRE (popup)
  // =====================================================
  function setupAboutPopup() {
    const open = document.getElementById("openAbout");
    const dlg = document.getElementById("about");
    const close = document.getElementById("closeAbout");
    if (!open || !dlg) return;

    open.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      dlg?.showModal?.();
    });

    close?.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      closeDialogSafe(dlg);
    });

    // fecha clicando fora do card
    dlg?.addEventListener("click", (e) => {
      const card = dlg.querySelector(".card");
      if (!card) return;
      const r = card.getBoundingClientRect();
      const inside =
        e.clientX >= r.left && e.clientX <= r.right &&
        e.clientY >= r.top && e.clientY <= r.bottom;
      if (!inside) closeDialogSafe(dlg);
    });
  }

  // =====================================================
  // START
  // =====================================================
  window.addEventListener("DOMContentLoaded", () => {
    const state = getOrInitState();

    let miniApi = null;

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
      // se clicou dentro de uma seed, deixa os handlers da seed lidarem
      if (e.target.closest?.(".seed")) return;

      // fecha popups de bolha ao clicar fora (mantém lock)
      closeAllSeedBubbles();

      // desfaz preview (volta para lock, se existir)
      clearPreviewFx(state);

      // click no background => volta o código do mini editor para o padrão do preset ativo
      const clickedUI = e.target.closest?.(
        ".hydra-mini, #composer, #about, #viewer, .presetDock, .fabWrap, .topbar"
      );
      if (!clickedUI) {
        miniApi?.resetActiveToDefault?.({ run: true });
      }
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

    // Sobre (popup)
    setupAboutPopup();

    // Hydra
    initHydraBackground();
    runActivePreset(state);

    // Mini editor
    miniApi = setupMiniEditor(state);

    // Preset dock (A/B/C/D)
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
