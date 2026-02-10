// Strudel loader (ESM) — expõe API mínima sem poluir globals do Hydra.
// Documentação: https://strudel.cc/technical-manual/project-start/  (seção @strudel/web)

import { initStrudel, note, s, setcps, hush } from 'https://esm.sh/@strudel/web@1.0.3';

// Guardamos em um namespace próprio (não cria window.hush, window.note, etc.)
window.CEU_STRUDEL = {
  initStrudel,
  note,
  s,
  setcps,
  hush,
  ready: false,
};
