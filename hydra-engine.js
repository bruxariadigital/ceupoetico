(() => {
  "use strict";

  /**
   * CEU_HYDRA — Módulo mínimo para “encaixotar” Hydra.
   * - mantém DPR fit (corrige pixelado)
   * - init único
   * - hush seguro
   * - eval seguro (executa preset)
   *
   * Observação:
   * Hydra usa makeGlobal:true (osc/src/render/o0..o3 globais).
   * O isolamento aqui é: só este módulo toca na instância e no resize.
   */

  let hydraReady = false;
  let hydraInstance = null;
  let currentCanvasId = "hydra-canvas";

  function getCanvas() {
    return document.getElementById(currentCanvasId);
  }

  function fit() {
    const canvas = getCanvas();
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
    } catch {
      // ignorar
    }
  }

  function init({ canvasId = "hydra-canvas" } = {}) {
    if (hydraReady) return;
    if (typeof window.Hydra === "undefined") return;

    currentCanvasId = canvasId;
    const canvas = getCanvas();
    if (!canvas) return;

    // eslint-disable-next-line no-undef
    hydraInstance = new Hydra({
      canvas,
      detectAudio: true,
      makeGlobal: true
    });

    hydraReady = true;

    fit();
    window.addEventListener("resize", fit);
    window.addEventListener("orientationchange", () => setTimeout(fit, 60));
  }

  function hush() {
    try {
      if (typeof window.hush === "function") window.hush();
    } catch {
      // ignorar
    }
  }

  // Mantém o mesmo comportamento do seu app: eval “global”
  function evalCode(code) {
    (0, eval)(code);
  }

  // API pública
  window.CEU_HYDRA = {
    init,
    fit,
    hush,
    eval: evalCode,
    getInstance: () => hydraInstance,
    isReady: () => hydraReady
  };
})();
