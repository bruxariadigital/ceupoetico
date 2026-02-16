// Strudel loader isolado (ESM)
// Evita poluir globals que conflitam com Hydra (ex.: src)

import * as Web from "https://unpkg.com/@strudel/web@1.0.3?module";

const { initStrudel, note, n, s, hush, setcps } = Web;

let inited = false;

window.CEU_STRUDEL = {
  async init() {
    if (inited) return true;
    await initStrudel();
    inited = true;
    return true;
  },
  // builders
  note,
  n,
  s,
  // transport
  setcps: (v) => (typeof setcps === "function" ? setcps(v) : null),
  // stop
  hush: () => {
    try { if (typeof hush === "function") hush(); } catch {}
  },
  _raw: Web,
};
