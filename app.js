(() => {
  "use strict";

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

  const DRAFT_KEY = "CEUPOETICO_COMPOSER_DRAFT_V1";

  function draftStorageKey() {
    return `${DRAFT_KEY}::${getUserKey()}`;
  }

  function loadComposerDraft() {
    try { return localStorage.getItem(draftStorageKey()) || ""; } catch { return ""; }
  }

  function saveComposerDraft(text) {
    try {
      const v = (text ?? "").toString();
      if (!v.trim()) localStorage.removeItem(draftStorageKey());
      else localStorage.setItem(draftStorageKey(), v);
    } catch {}
  }

  function clearComposerDraft() {
    try { localStorage.removeItem(draftStorageKey()); } catch {}
  }

  // =====================================================
  // PRESETS (A/B/C/D) + buffers
  // Reservamos o3 como DISPLAY final (pós-processamento)
  // =====================================================
  const DISPLAY_BUF = "o3";
  const PRESET_IDS = ["A", "B", "C", "D"];

  const PRESET_DEFAULTS = {
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
    return { contrast: 1.0, saturate: 0.95, brightness: 0.0, colorama: 0.0 };
  }

  function defaultState() {
    const presets = {};
    PRESET_IDS.forEach((id) => { presets[id] = { code: PRESET_DEFAULTS[id].code, fx: defaultFx() }; });

    return {
      userKey: getUserKey(),
      activePreset: "A",
      presets
    };
  }

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

      PRESET_IDS.forEach((id) => {
        if (baseState.presets?.[id]?.code) next.presets[id].code = baseState.presets[id].code;
        if (baseState.presets?.[id]?.fx) next.presets[id].fx = { ...defaultFx(), ...baseState.presets[id].fx };
      });

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
  window.CEU_SEED_FX = null;
  window.CEU_LOCKED_SEED_ID = null;
  window.CEU_LOCKED_FX = null;
  window.CEU_PREVIEW_SEED_ID = null;
  window.CEU_PREVIEW_FX = null;

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

  // =====================================================
  // STRUDEL (áudio) — integração A (sem cruzar Hydra)
  //
  // Requer no index.html:
  // <script src="https://unpkg.com/@strudel/web@1.0.3"></script>
  //
  // Disponibiliza globals: initStrudel(), note(), n(), s(), hush(), setcps()...
  // =====================================================
  const STRUDEL = {
    ready: false,
    enabled: false,
    triangleId: "A",
    lockedSeedId: null,
    previewSeedId: null,
    basePattern: null,
    overlayPattern: null,
    overlayPreview: null,
  };

  function strudelAvailable() {
    return typeof window.initStrudel === "function" && typeof window.note === "function";
  }

  function ensureStrudelReady() {
    if (STRUDEL.ready) return Promise.resolve(true);
    if (!strudelAvailable()) return Promise.resolve(false);

    try {
      // initStrudel cria engine + scheduler
      window.initStrudel();
      STRUDEL.ready = true;
      return Promise.resolve(true);
    } catch (e) {
      console.warn("Strudel init falhou:", e);
      return Promise.resolve(false);
    }
  }

  function hash01(str) {
    let h = 2166136261;
    for (let i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return ((h >>> 0) % 10000) / 10000;
  }

  function buildTrianglePattern(triId) {
    // melodias base (curtas, e “aero” no room)
    if (triId === "A") return window.note("<c4 eb4 g4 bb4>(3,8)").s("sine").dec(.25).room(.35).gain(.85);
    if (triId === "B") return window.note("<d4 f4 a4 c5>(3,8)").s("saw").dec(.22).room(.38).gain(.78);
    if (triId === "C") return window.note("<e4 g4 b4 d5>(3,8)").s("gm_lead_1_square").dec(.20).room(.32).gain(.80);
    return window.note("<a3 c4 e4 g4>(3,8)").s("gm_electric_piano_1").dec(.24).room(.36).gain(.75);
  }

  function buildSeedLayer(seedId, mode) {
    const r = hash01(seedId);
    const scale = r < 0.33 ? "C:minor" : (r < 0.66 ? "D:minor" : "A:minor");
    const inst = r < 0.25 ? "hh" : (r < 0.5 ? "gm_pad_1_new_age" : (r < 0.75 ? "gm_bass_2_finger" : "bd"));
    const dense = r < 0.5 ? 8 : 16;
    const g = mode === "preview" ? 0.55 : 0.70;
    const rm = mode === "preview" ? 0.55 : 0.70;

    if (inst === "hh" || inst === "bd") {
      return window.s(`${inst}*${dense}`).gain(g).room(rm);
    }

    return window.n("<0 2 4 7>*4")
      .scale(scale)
      .s(inst)
      .dec(.18)
      .gain(g)
      .room(rm);
  }

  function stopStrudelAll() {
    try { if (typeof window.hush === "function") window.hush(); } catch {}
    STRUDEL.basePattern = null;
    STRUDEL.overlayPattern = null;
    STRUDEL.overlayPreview = null;
  }

  function playStrudelMix(opts) {
    const triId = opts?.triId || STRUDEL.triangleId;
    const lockedSeedId = opts?.lockedSeedId || null;

    if (!STRUDEL.enabled) return;
    if (!STRUDEL.ready) return;

    stopStrudelAll();

    STRUDEL.triangleId = triId;
    STRUDEL.lockedSeedId = lockedSeedId;

    try {
      const base = buildTrianglePattern(triId);
      STRUDEL.basePattern = base;
      base.play();

      if (lockedSeedId) {
        const layer = buildSeedLayer(lockedSeedId, "lock");
        STRUDEL.overlayPattern = layer;
        layer.play();
      }
    } catch (e) {
      console.warn("Strudel play falhou:", e);
    }
  }

  function previewSeedLayer(seedId) {
    if (!STRUDEL.enabled || !STRUDEL.ready) return;
    if (!seedId) return;
    if (seedId === STRUDEL.lockedSeedId) return;
    if (seedId === STRUDEL.previewSeedId) return;

    // refaz base + lock e toca preview por cima
    try {
      stopStrudelAll();
      const base = buildTrianglePattern(STRUDEL.triangleId);
      base.play();
      if (STRUDEL.lockedSeedId) buildSeedLayer(STRUDEL.lockedSeedId, "lock").play();
    } catch {}

    STRUDEL.previewSeedId = seedId;
    try {
      STRUDEL.overlayPreview = buildSeedLayer(seedId, "preview");
      STRUDEL.overlayPreview.play();
    } catch {}
  }

  function clearPreviewSeedLayer() {
    if (!STRUDEL.enabled || !STRUDEL.ready) return;
    if (!STRUDEL.previewSeedId) return;
    STRUDEL.previewSeedId = null;
    playStrudelMix({ triId: STRUDEL.triangleId, lockedSeedId: STRUDEL.lockedSeedId });
  }

  function setSoundEnabled(on) {
    return ensureStrudelReady().then((ok) => {
      if (!ok) return;

      const FADE_MS = 120;

      if (on) {
        STRUDEL.enabled = true;

        // “primeiro sopro” baixinho + rebuild normal
        try {
          stopStrudelAll();
          const base = buildTrianglePattern(STRUDEL.triangleId).gain(0.0001);
          base.play();
          if (STRUDEL.lockedSeedId) buildSeedLayer(STRUDEL.lockedSeedId, "lock").gain(0.0001).play();
        } catch {}

        setTimeout(() => {
          playStrudelMix({ triId: STRUDEL.triangleId, lockedSeedId: STRUDEL.lockedSeedId });
        }, FADE_MS);
      } else {
        // fade out: corta com hush depois de um “micro” (evita clique seco)
        setTimeout(() => {
          stopStrudelAll();
          STRUDEL.enabled = false;
        }, FADE_MS);
      }
    });
  }

  // =====================================================
  // Hydra eval (seguro)
  // =====================================================
  function safeEvalHydra(code) {
    (0, eval)(code);
  }

  // =====================================================
  // Hydra FX aleatório por bolha (hover/click)
  // =====================================================
  function randomFxFromSeed(seedKey) {
    const s = String(seedKey);
    const r1 = hash01(s + "::fx1");
    const r2 = hash01(s + "::fx2");
    const r3 = hash01(s + "::fx3");

    const pick = Math.floor(r1 * 16);
    const a = 0.18 + r2 * 0.82;
    const b = 0.65 + r3 * 1.75;
    const c = r1;
    const d = r2;

    return { pick, a, b, c, d };
  }

  function applyRandomSeedFx(node, fxObj) {
    if (!fxObj) return node;

    const p = (fxObj.pick ?? 0) % 16;
    const a = fxObj.a ?? 0.6;
    const b = fxObj.b ?? 1.0;
    const c = fxObj.c ?? 0.5;
    const d = fxObj.d ?? 0.5;

    const mOsc = osc(6 + b * 10, 0.02 + a * 0.12, 0.8 + c * 1.2);
    const mNoise = noise(1.2 + b * 2.5, 0.15 + a * 0.35);

    try {
      if (p === 0) return node.invert(a * 0.85);
      if (p === 1) return node.posterize(2 + Math.floor(b * 6), 0.55 + d * 0.35);
      if (p === 2) return node.kaleid(2 + Math.floor(b * 10)).rotate(() => a * 0.45);
      if (p === 3) return node.pixelate(10 + Math.floor(b * 40), 8 + Math.floor(a * 26));
      if (p === 4) return node.thresh(0.25 + a * 0.35, 0.06 + d * 0.2);
      if (p === 5) return node.luma(() => 0.22 + a * 0.55, 0.12 + d * 0.25);
      if (p === 6) return node.color(0.6 + a * 0.8, 0.55 + d * 0.9, 0.8 + c * 0.7).saturate(0.9 + a * 1.4);
      if (p === 7) return node.hue(() => (c - 0.5) * 1.2).contrast(1.0 + a * 0.5);

      if (p === 8) return node.scrollX(() => (a - 0.5) * 0.06, () => (d - 0.5) * 0.03)
        .scrollY(() => (d - 0.5) * 0.06, () => (a - 0.5) * 0.03);

      if (p === 9) return node.repeat(1 + Math.floor(b * 3), 1 + Math.floor(d * 3), 0.0, 0.0).rotate(() => a * 0.15);

      if (p === 10) return node.modulateRotate(mOsc, () => a * 0.65).contrast(1.0 + a * 0.35);
      if (p === 11) return node.modulateScale(mNoise, () => 0.8 + a * 1.0, () => a * 0.22);
      if (p === 12) return node.modulate(mOsc, () => a * 0.25).brightness(() => 0.02 + d * 0.08);
      if (p === 13) return node.modulateKaleid(mOsc, 2 + Math.floor(b * 8));
      if (p === 14) return node.add(mNoise, 0.12 + a * 0.22).contrast(1.05 + d * 0.35);
      return node.diff(mOsc, 0.18 + a * 0.28).saturate(1.0 + a * 0.9);
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
    const h = window.CEU_HOVER || 0;

    const lockedFx = window.CEU_LOCKED_FX || null;
    const previewFx = window.CEU_PREVIEW_FX || null;

    const LOCK_MIX = 0.55;
    const PREVIEW_MIX = 0.40;

    try {
      let base = src(srcBuf);
      let affected = src(srcBuf);

      affected = applyRandomSeedFx(affected, lockedFx);
      affected = applyRandomSeedFx(affected, previewFx);

      let chain = base;
      if (lockedFx) chain = chain.blend(affected, LOCK_MIX);
      if (previewFx) chain = chain.blend(affected, PREVIEW_MIX);

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
  // SEEDS: plantar altera FX aleatório do preset ativo
  // =====================================================
  function mutateFxOnPlant(state) {
    const id = PRESET_IDS.includes(state.activePreset) ? state.activePreset : "A";
    const fx = state.presets[id]?.fx || defaultFx();

    const pick = Math.floor(Math.random() * 4);

    if (pick === 0) fx.contrast   = clamp(fx.contrast + (Math.random() * 0.22), 0.75, 2.1);
    if (pick === 1) fx.saturate   = clamp(fx.saturate + (Math.random() * 0.28), 0.70, 2.20);
    if (pick === 2) fx.brightness = clamp(fx.brightness + (Math.random() * 0.06 - 0.02), -0.22, 0.28);
    if (pick === 3) fx.colorama   = clamp(fx.colorama + (Math.random() * 0.18), 0, 1.20);

    state.presets[id].fx = fx;
    saveState(state);

    applyPresetFxToDisplay(id, state);
  }

  // =====================================================
  // SUPABASE (mural) — SEM async/await
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

  function uploadMediaIfAny(file) {
    if (!file) return Promise.resolve(null);

    const ext = (file.name.split(".").pop() || "bin").toLowerCase();
    const path = `${crypto.randomUUID()}.${ext}`;

    return sb
      .storage
      .from("mural")
      .upload(path, file, { contentType: file.type, upsert: false })
      .then(({ error: upErr }) => {
        if (upErr) throw upErr;
        const { data } = sb.storage.from("mural").getPublicUrl(path);
        return data?.publicUrl || null;
      });
  }

  function insertPost(text, mediaUrl, mediaType) {
    return sb
      .from("mural_posts")
      .insert([{ text: text || null, image_url: mediaUrl || null, media_type: mediaType || null }])
      .then(({ error }) => {
        if (error) throw error;
        return true;
      });
  }

  function fetchPosts() {
    return sb
      .from("mural_posts")
      .select("id, created_at, text, image_url, media_type")
      .order("created_at", { ascending: false })
      .limit(220)
      .then(({ data, error }) => {
        if (error) throw error;
        return data || [];
      });
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
  // LOCK (bolha selecionada) + UI
  // =====================================================
  let CEU_LOCKED_SEED_EL = null;

  function markLockedSeed(seedEl) {
    if (CEU_LOCKED_SEED_EL && CEU_LOCKED_SEED_EL !== seedEl) {
      CEU_LOCKED_SEED_EL.classList.remove("is-locked");
    }
    CEU_LOCKED_SEED_EL = seedEl || null;
    if (seedEl) seedEl.classList.add("is-locked");
  }

  function clearSeedLock(state) {
    window.CEU_LOCKED_SEED_ID = null;
    window.CEU_LOCKED_FX = null;
    window.CEU_PREVIEW_SEED_ID = null;
    window.CEU_PREVIEW_FX = null;
    window.CEU_SEED_FX = null;
    window.CEU_HOVER = 0;
    markLockedSeed(null);
    applyPresetFxToDisplay(state.activePreset, state);

    // Strudel: limpa overlay lock e volta só para base do triângulo
    STRUDEL.lockedSeedId = null;
    if (STRUDEL.enabled) playStrudelMix({ triId: STRUDEL.triangleId, lockedSeedId: null });
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

      el.dataset.justDragged = moved ? "1" : "0";
      setTimeout(() => { el.dataset.justDragged = "0"; }, 220);
    };

    el.addEventListener("pointerup", stop);
    el.addEventListener("pointercancel", stop);

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

    enableSeedDrag(el, garden);

    // hover (desktop): abre bolha + preview FX Hydra + preview camada Strudel
    if (isHoverDesktop()) {
      let closeT = null;

      el.addEventListener("pointerenter", () => {
        clearTimeout(closeT);
        openSeedBubble(el);

        const fx = randomFxFromSeed(post.id + "::hover::" + Date.now() + "::" + Math.random());
        window.CEU_PREVIEW_SEED_ID = post.id;
        window.CEU_PREVIEW_FX = fx;

        window.CEU_HOVER = 0.22 + Math.random() * 0.35;
        applyPresetFxToDisplay(state.activePreset, state);

        // Strudel preview (sem fixar)
        previewSeedLayer(post.id);
      });

      el.addEventListener("pointerleave", () => {
        window.CEU_PREVIEW_SEED_ID = null;
        window.CEU_PREVIEW_FX = null;

        window.CEU_HOVER = 0;
        applyPresetFxToDisplay(state.activePreset, state);

        // Strudel: remove preview e volta para base+lock
        clearPreviewSeedLayer();

        closeT = setTimeout(() => {
          el.classList.remove("is-open");
          el.style.zIndex = "";
        }, 180);
      });
    } else {
      // mobile: evita callout
      el.addEventListener("contextmenu", (e) => e.preventDefault());
    }

    // click/tap: fixa lock (Hydra FX + Strudel camada)
    el.addEventListener("click", (ev) => {
      ev.preventDefault();
      ev.stopPropagation();

      if (typeof el._wasJustDragged === "function" && el._wasJustDragged()) return;

      openSeedBubble(el);

      const fx =
        (window.CEU_PREVIEW_SEED_ID === post.id && window.CEU_PREVIEW_FX)
          ? window.CEU_PREVIEW_FX
          : randomFxFromSeed(post.id + "::lock::" + Date.now() + "::" + Math.random());

      window.CEU_LOCKED_SEED_ID = post.id;
      window.CEU_LOCKED_FX = fx;

      markLockedSeed(el);

      window.CEU_HOVER = 0;
      applyPresetFxToDisplay(state.activePreset, state);

      // Strudel: fixa camada do seed (overlay)
      STRUDEL.lockedSeedId = post.id;
      if (STRUDEL.enabled) playStrudelMix({ triId: STRUDEL.triangleId, lockedSeedId: post.id });
    });

    // desktop: dblclick abre viewer (sem mexer no lock)
    el.addEventListener("dblclick", (ev) => {
      ev.preventDefault();
      ev.stopPropagation();
      openViewer(viewerEls, post);
    });

    return el;
  }

  function renderGarden(garden, viewerEls, state) {
    if (!garden) return Promise.resolve();
    if (!supabaseReady()) return Promise.resolve();

    return fetchPosts()
      .then((posts) => {
        const ordered = (posts || []).reverse();
        garden.innerHTML = "";
        ordered.forEach((p) => garden.appendChild(createSeedEl(p, viewerEls, state, garden)));
      })
      .catch((err) => {
        console.error("renderGarden falhou:", err);
      });
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

    // swap visual: "Reset códigos" antes do "clique-me..."
    try {
      const actions = panel.querySelector(".hydra-mini__actions");
      if (actions && runBtn && resetLink) {
        actions.insertBefore(resetLink, runBtn);
      }
    } catch {}

    const activeId = () => (PRESET_IDS.includes(state.activePreset) ? state.activePreset : "A");

    function syncEditorFromState() {
      const id = activeId();
      codeEl.value = state.presets[id]?.code || PRESET_DEFAULTS[id].code;
    }

    const saveEditorToStateDebounced = debounce(() => {
      const id = activeId();
      state.presets[id].code = codeEl.value;
      saveState(state);
      if (typeof window.CEU_updateCodeOverlay === "function") window.CEU_updateCodeOverlay();
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
      if (typeof window.CEU_updateCodeOverlay === "function") window.CEU_updateCodeOverlay();
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
      if (typeof window.CEU_updateCodeOverlay === "function") window.CEU_updateCodeOverlay();
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

        closeAllSeedBubbles();
        clearSeedLock(state);

        miniApi?.syncEditorFromState?.();
        runActivePreset(state);
        setActiveUI();

        // Strudel: triângulo muda melodia base (mantém “Som: on/off” como está)
        STRUDEL.triangleId = id;
        if (STRUDEL.enabled) playStrudelMix({ triId: id, lockedSeedId: STRUDEL.lockedSeedId });
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

    // ===== Rascunho do composer =====
    if (textEl) {
      const draft = loadComposerDraft();
      if (draft && !textEl.value) textEl.value = draft;

      const saveDraftDebounced = debounce(() => saveComposerDraft(textEl.value), 220);
      textEl.addEventListener("input", saveDraftDebounced);
      textEl.addEventListener("change", () => saveComposerDraft(textEl.value));
    }

    // Fecha bolhas ao clicar fora
    document.addEventListener("pointerdown", (e) => {
      if (e.target.closest?.(".seed")) return;

      closeAllSeedBubbles();

      window.CEU_PREVIEW_SEED_ID = null;
      window.CEU_PREVIEW_FX = null;
      window.CEU_HOVER = 0;
      applyPresetFxToDisplay(state.activePreset, state);

      // Strudel preview off
      clearPreviewSeedLayer();
    });

    // dblclick no background: remove lock
    document.addEventListener("dblclick", (e) => {
      if (e.target.closest?.(".seed")) return;
      e.preventDefault();
      e.stopPropagation();
      closeAllSeedBubbles();
      clearSeedLock(state);
    });

    document.addEventListener("contextmenu", (e) => {
      if (e.target.closest?.(".viewerImg, .seed, #garden")) e.preventDefault();
    });

    viewer?.addEventListener("click", (e) => {
      const box = viewer.querySelector(".viewer");
      if (!box) return;
      const r = box.getBoundingClientRect();
      const inside =
        e.clientX >= r.left && e.clientX <= r.right &&
        e.clientY >= r.top && e.clientY <= r.bottom;
      if (!inside) closeDialogSafe(viewer);
    });

    setupAboutPopup();

    initHydraBackground();
    runActivePreset(state);

    const miniApi = setupMiniEditor(state);

    // ===== Overlay de código (Y) =====
    const codeOverlay = document.getElementById("codeOverlay");
    let overlayOn = localStorage.getItem("ceu_code_overlay") === "1";

    function getActiveHydraCode() {
      const id = PRESET_IDS.includes(state.activePreset) ? state.activePreset : "A";
      return (state.presets[id]?.code || PRESET_DEFAULTS[id]?.code || "").trim();
    }

    function updateCodeOverlay() {
      if (!codeOverlay) return;
      codeOverlay.textContent = getActiveHydraCode();
    }

    function setOverlay(on) {
      overlayOn = !!on;
      localStorage.setItem("ceu_code_overlay", overlayOn ? "1" : "0");
      if (!codeOverlay) return;
      codeOverlay.classList.toggle("is-on", overlayOn);
      if (overlayOn) updateCodeOverlay();
    }

    window.CEU_updateCodeOverlay = updateCodeOverlay;

    setOverlay(overlayOn);

    window.addEventListener("keydown", (e) => {
      const tag = (document.activeElement?.tagName || "").toLowerCase();
      const typing = tag === "textarea" || tag === "input";
      const isHydraCode = document.activeElement?.id === "hydraCode";
      if (typing && !isHydraCode) return;

      if (e.key === "y" || e.key === "Y") {
        e.preventDefault();
        e.stopPropagation();
        setOverlay(!overlayOn);
      }
    });

    // Ctrl+Enter: rodar preset ativo
    window.addEventListener("keydown", (e) => {
      const isMac = /Mac|iPhone|iPad|iPod/.test(navigator.platform);
      const mod = isMac ? e.metaKey : e.ctrlKey;

      if (mod && e.key === "Enter") {
        e.preventDefault();
        e.stopPropagation();
        runActivePreset(state);
        updateCodeOverlay();
      }
    });

    setupPresetDock(state, miniApi);

    // ===== Som (Strudel) =====
    const soundBtn = document.getElementById("toggleSound");
    const savedSound = localStorage.getItem("ceu_sound_enabled") === "1";

    STRUDEL.triangleId = state.activePreset;

    if (savedSound && soundBtn) {
      // não auto-start; UI fica off até gesto
      soundBtn.textContent = "Som: off";
      soundBtn.setAttribute("aria-pressed", "false");
    }

    soundBtn?.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();

      const turningOn = !STRUDEL.enabled;

      setSoundEnabled(turningOn).then(() => {
        localStorage.setItem("ceu_sound_enabled", turningOn ? "1" : "0");
        soundBtn.textContent = turningOn ? "Som: on" : "Som: off";
        soundBtn.setAttribute("aria-pressed", turningOn ? "true" : "false");

        // se ligou, toca base do triângulo atual
        if (turningOn) {
          playStrudelMix({ triId: STRUDEL.triangleId, lockedSeedId: STRUDEL.lockedSeedId });
        }
      });
    });

    // abrir composer
    openComposer?.addEventListener("click", () => {
      if (composer?.showModal) composer.showModal();
      else composer?.setAttribute("open", "");
    });

    closeComposer?.addEventListener("click", () => closeDialogSafe(composer));
    closeViewer?.addEventListener("click", () => closeDialogSafe(viewer));

    composer?.addEventListener("click", (e) => {
      const formEl = composer.querySelector("form");
      if (!formEl) return;
      const r = formEl.getBoundingClientRect();
      const inside =
        e.clientX >= r.left && e.clientX <= r.right &&
        e.clientY >= r.top && e.clientY <= r.bottom;
      if (!inside) closeDialogSafe(composer);
    });

    // submit mural (SEM async/await)
    form?.addEventListener("submit", (e) => {
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

      if (sendBtn) sendBtn.disabled = true;
      setStatus(statusEl, "Enviando…");

      uploadMediaIfAny(file)
        .then((mediaUrl) => {
          const mediaType = file?.type || null;
          return insertPost(text, mediaUrl, mediaType);
        })
        .then(() => {
          clearComposerDraft();

          mutateFxOnPlant(state);

          if (textEl) textEl.value = "";
          if (mediaEl) mediaEl.value = "";

          setStatus(statusEl, "Recebido ✶ Sua marca já está no céu.");

          return renderGarden(garden, viewerEls, state);
        })
        .then(() => {
          setTimeout(() => closeDialogSafe(composer), 450);
        })
        .catch((err) => {
          console.error(err);
          setStatus(statusEl, "Não consegui enviar agora. Tente novamente.");
        })
        .finally(() => {
          if (sendBtn) sendBtn.disabled = false;
        });
    });
    // render inicial
    renderGarden(garden, viewerEls, state);
  });

})();
