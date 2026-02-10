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
