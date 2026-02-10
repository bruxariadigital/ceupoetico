/*
  Strudel bridge (no ESM):
  - Uses the UMD build loaded via:
      <script src="https://unpkg.com/@strudel/web@1.0.3"></script>
  - Captures Strudel globals (note, s, setcps, hush, etc.) into window.CEU_STRUDEL
  - IMPORTANT: Never rely on window.hush at call sites, to avoid collisions with Hydra's hush.
*/

(function () {
  'use strict';

  function pickGlobal(name) {
    try {
      const g = (typeof globalThis !== 'undefined') ? globalThis : window;
      return g && g[name];
    } catch {
      return undefined;
    }
  }

  function snapshotStrudelGlobals() {
    // With @strudel/web UMD, these live on globalThis after initStrudel
    return {
      initStrudel: pickGlobal('initStrudel'),
      note: pickGlobal('note'),
      n: pickGlobal('n'),
      s: pickGlobal('s'),
      stack: pickGlobal('stack'),
      setcps: pickGlobal('setcps'),
      setcpm: pickGlobal('setcpm'),
      hush: pickGlobal('hush'),
    };
  }

  window.CEU_STRUDEL = {
    ready: false,
    _api: snapshotStrudelGlobals(),

    async init() {
      const api0 = snapshotStrudelGlobals();
      if (typeof api0.initStrudel !== 'function') {
        console.warn('[CEU_STRUDEL] initStrudel não encontrado. Verifique se @strudel/web carregou.');
        return false;
      }

      // initStrudel must run after a user gesture
      await api0.initStrudel();

      // refresh snapshot after init
      const api = snapshotStrudelGlobals();
      window.CEU_STRUDEL._api = api;
      window.CEU_STRUDEL.ready = true;

      // safe default tempo
      try { if (typeof api.setcps === 'function') api.setcps(1); } catch {}
      return true;
    },

    // Accessors
    get note() { return window.CEU_STRUDEL._api.note || window.CEU_STRUDEL._api.n; },
    get s() { return window.CEU_STRUDEL._api.s; },
    get stack() { return window.CEU_STRUDEL._api.stack; },
    get setcps() { return window.CEU_STRUDEL._api.setcps; },
    get setcpm() { return window.CEU_STRUDEL._api.setcpm; },

    // Stop all patterns — uses captured Strudel hush (never call window.hush elsewhere)
    stopAll() {
      try {
        const h = window.CEU_STRUDEL._api.hush;
        if (typeof h === 'function') h();
      } catch {}
    },
  };
})();
