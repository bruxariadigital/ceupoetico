(() => {
  "use strict";

  /* ==============================
     STRUDEL AUDIO STATE
  ============================== */

  let soundEnabled = false;
  let strudelGain = null;

  function ensureStrudelGain() {
    if (!window.Strudel?.context) return;
    if (!strudelGain) {
      strudelGain = window.Strudel.context.createGain();
      strudelGain.gain.value = 0;
      strudelGain.connect(window.Strudel.context.destination);
    }
  }

  function fadeStrudelTo(value, duration = 0.15) {
    if (!strudelGain) return;
    const ctx = window.Strudel.context;
    const now = ctx.currentTime;
    strudelGain.gain.cancelScheduledValues(now);
    strudelGain.gain.linearRampToValueAtTime(value, now + duration);
  }

  /* ==============================
     STATE / STORAGE
  ============================== */

  const STORAGE_KEY = "CEUPOETICO_STATE_V5";
  const USERKEY_KEY = "CEUPOETICO_USERKEY_V1";

  function getUserKey() {
    let key = localStorage.getItem(USERKEY_KEY);
    if (!key) {
      key = crypto?.randomUUID?.() || String(Date.now() + Math.random());
      localStorage.setItem(USERKEY_KEY, key);
    }
    return key;
  }

  function loadState() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY));
    } catch {
      return null;
    }
  }

  function saveState(state) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {}
  }

  /* ==============================
     PRESETS
  ============================== */

  const PRESET_IDS = ["A", "B", "C", "D"];

  // =====================================================
// PRESET DEFAULTS (obrigatório para defaultState)
// =====================================================
const PRESET_DEFAULTS = {
  A: {
    name: "A",
    renderBuf: "o0",
    code: `
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
    code: `
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
    code: `
speed=.3

osc(.33,3.3,3.3)
  .blend(
    shape(3, .2,.3).mult(
      osc(2.3,3.3,3.3)
        .modulateRotate(osc(3.3,3.3,3.3).hue(3).shift(2))
        .color(0,0,8)
    )
  )
  .mult(osc(.33,.33,3.3))
  .modulateScale(noise(3.3))
  .diff(osc(5.33,.3,4))
  .mult(shape(3,.3,.2))
  .out(o0)

a.show()
`
  },

  D: {
    name: "D",
    renderBuf: "o0",
    code: `
s1.initCam()

osc().kaleid(500)
  .rotate(2, 0.5)
  .mask(shape(3).rotate(0.2, -0.3))
  .out(o0)

a.show()
`
  }
};

  const DISPLAY_BUF = "o3";

  function defaultFx() {
    return { contrast: 1, saturate: 0.95, brightness: 0, colorama: 0 };
  }

  function defaultState() {
    const presets = {};
    PRESET_IDS.forEach(id => {
      presets[id] = { code: PRESET_DEFAULTS[id].code, fx: defaultFx() };
    });
    return { userKey: getUserKey(), activePreset: "A", presets };
  }

  function getOrInitState() {
    const saved = loadState();
    if (saved?.presets) return saved;
    const fresh = defaultState();
    saveState(fresh);
    return fresh;
  }

  /* ==============================
     STRUDEL CORE
  ============================== */

  const STRUDEL = {
    enabled: false,
    triangleId: "A",
    lockedSeedId: null,
    hoverSeedId: null,
    gain: 0,
    gainTarget: 0,
    ready: false
  };

  function ensureStrudelReady() {
    if (STRUDEL.ready) return true;
    if (typeof window.initStrudel !== "function") return false;
    try {
      window.initStrudel();
      window.setcps?.(0.85);
      STRUDEL.ready = true;
      return true;
    } catch {
      return false;
    }
  }

  /* ==============================
     GARDEN (SEM ASYNC)
  ============================== */

  function renderGarden(garden, viewerEls, state) {
    if (!garden || !window.supabase) return;

    fetchPosts()
      .then(posts => {
        garden.innerHTML = "";
        (posts || []).reverse().forEach(p =>
          garden.appendChild(createSeedEl(p, viewerEls, state, garden))
        );
      })
      .catch(err => console.error("renderGarden:", err));
  }

  /* ==============================
     START
  ============================== */

  window.addEventListener("DOMContentLoaded", () => {
    const state = getOrInitState();

    const garden = document.getElementById("garden");
    const viewer = document.getElementById("viewer");

    /* ---- SOM ---- */

    const soundBtn = document.getElementById("soundToggle");

    soundBtn?.addEventListener("click", () => {
      if (!window.Strudel?.context) return;

      ensureStrudelGain();
      soundEnabled = !soundEnabled;
      soundBtn.textContent = soundEnabled ? "🔊" : "🔇";
      window.Strudel.context.resume();

      fadeStrudelTo(soundEnabled ? 1 : 0);
    });

    if (!STRUDEL.enabled && ensureStrudelReady()) {
      STRUDEL.enabled = true;
      STRUDEL.gain = 0;
      STRUDEL.gainTarget = 1;
    }

    /* ---- FECHAR BOLHAS ---- */

    document.addEventListener("pointerdown", (e) => {
      if (e.target.closest(".seed")) return;
      closeAllSeedBubbles();
      clearLockedSeed(state);
    });

    /* ---- HYDRA ---- */

    initHydraBackground();
    runActivePreset(state);

    /* ---- GARDEN INIT ---- */

    renderGarden(garden, { viewer }, state);
  });

})();
