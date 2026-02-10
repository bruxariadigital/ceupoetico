// Strudel loader (ESM)
// - Evita colisão com Hydra (NUNCA expõe window.hush)
// - Fornece uma API mínima via window.CEU_STRUDEL

import * as Web from 'https://esm.sh/@strudel/web@1.0.3';

let _ready = false;
let _api = null;

function pickFn(name) {
  const v = Web?.[name];
  if (typeof v === 'function') return v;
  const g = globalThis?.[name];
  if (typeof g === 'function') return g;
  return null;
}

async function init() {
  if (_ready) return true;
  if (typeof Web?.initStrudel !== 'function') return false;
  await Web.initStrudel();

  // Funções que usamos no app. Dependendo do bundle, elas podem estar nos exports
  // ou terem sido registradas em globalThis pelo Strudel.
  const s = pickFn('s');
  const n = pickFn('n');
  const setcps = pickFn('setcps');

  if (!s) console.warn('[CEU_STRUDEL] Função s() não encontrada após initStrudel()');
  if (!n) console.warn('[CEU_STRUDEL] Função n() não encontrada após initStrudel()');

  _api = { s, n, setcps };
  _ready = true;
  return true;
}

// Namespace controlado (sem hush/note/globals)
window.CEU_STRUDEL = {
  init,
  get ready() { return _ready; },
  get api() { return _api; },
};
