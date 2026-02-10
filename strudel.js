// Strudel loader (ESM)
// Mantém Hydra isolado e expõe uma API mínima em window.CEU_STRUDEL.
//
// Nota importante:
// Em algumas versões/empacotadores, @strudel/web pode não exportar `note`/`s`
// como named exports. Porém, após `initStrudel()`, o Strudel costuma
// disponibilizar helpers no escopo global (globalThis).

import { initStrudel } from 'https://esm.sh/@strudel/web@1.0.3';

function pickGlobal(name) {
  try {
    const g = (typeof globalThis !== 'undefined') ? globalThis : window;
    return g && g[name];
  } catch {
    return undefined;
  }
}

function refreshApiFromGlobals() {
  // Helpers mais usados no app:
  const note = pickGlobal('note');
  const s = pickGlobal('s');
  const setcps = pickGlobal('setcps');
  const hush = pickGlobal('hush');

  // Em alguns builds, os helpers podem estar dentro de `Strudel` global.
  const StrudelGlobal = pickGlobal('Strudel') || pickGlobal('strudel') || null;

  return {
    note: note || StrudelGlobal?.note,
    s: s || StrudelGlobal?.s,
    setcps: setcps || StrudelGlobal?.setcps,
    hush: hush || StrudelGlobal?.hush,
  };
}

window.CEU_STRUDEL = {
  initStrudel: async (...args) => {
    const res = await initStrudel(...args);
    // após init, atualiza o snapshot dos globals
    Object.assign(window.CEU_STRUDEL, refreshApiFromGlobals());
    window.CEU_STRUDEL.ready = true;
    return res;
  },
  ready: false,
  ...refreshApiFromGlobals(),
};
