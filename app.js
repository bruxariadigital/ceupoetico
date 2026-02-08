(() => {
  "use strict";

  // =====================================================
  // HYDRA BACKGROUND (cam + parâmetros vivos + hover)
  // =====================================================
  let hydraReady = false;
  let hoverBoost = 0;

  const params = {
    blend: 0.3,
    scale: 0.5,
    mod: 0.2,
    luma: 1.0,
    hue: 2.0,
    contrast: 1.0,
    colorama: 0.7,
    kaleid: 1.0,
    sat: 1.0,
    bright: 0.0
  };

  function clamp(v, min, max) {
    return Math.max(min, Math.min(max, v));
  }

  function hash01(str) {
    let h = 2166136261;
    for (let i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return (h >>> 0) / 4294967296;
  }

  function applySeedToHydra(seedText, mediaType) {
    const t = (seedText || "").trim();
    const r = hash01(t || (crypto?.randomUUID?.() || String(Date.now())));

    const pick = Math.floor(r * 7);

    if (pick === 0) params.colorama = clamp(params.colorama + 0.15, 0, 4);
    if (pick === 1) params.hue      = clamp(params.hue + 0.12, 0, 6);
    if (pick === 2) params.blend    = clamp(params.blend + 0.04, 0, 1);
    if (pick === 3) params.scale    = clamp(params.scale + 0.06, 0, 2);
    if (pick === 4) params.mod      = clamp(params.mod + 0.05, 0, 2);
    if (pick === 5) params.contrast = clamp(params.contrast + 0.08, 0, 3);
    if (pick === 6) params.kaleid   = clamp(params.kaleid + 0.10, 0, 4);

    if ((mediaType || "").startsWith("image/")) {
      params.sat = clamp(params.sat + 0.08, 0, 3);
    }
    if ((mediaType || "").startsWith("video/")) {
      params.bright = clamp(params.bright + 0.02, -0.3, 0.6);
    }
  }

  function initHydraBackground() {
    if (hydraReady) return;
    if (typeof window.Hydra === "undefined") return;

    const canvas = document.getElementById("hydra-canvas");
    if (!canvas) return;

    // ✅ mantemos detectAudio true porque você usa a.fft / a.show()
    // Observação: isso gera o warning do ScriptProcessorNode (explico abaixo).
    // eslint-disable-next-line no-undef
    new Hydra({ canvas, detectAudio: true, makeGlobal: true });

    // patch base com params reativos
    s0.initCam();
    speed = 0.1;

    src(s0)
      .blend(src(o0), () => params.blend)
      .modulateScale(src(s0), () => params.scale)
      .modulate(src(s0).color(() => a.fft[1]), () => params.mod)
      .luma(() => params.luma)
      .modulate(noise(() => a.fft[1], 2, 2))
      .hue(() => params.hue, 2)
      .contrast(() => params.contrast + hoverBoost * 0.45)
      .blend(src(s0).colorama(() => params.colorama + hoverBoost * 0.7))
      .modulateKaleid(noise(0.5, 1), () => params.kaleid)
      .saturate(() => params.sat + hoverBoost * 0.9)
      .brightness(() => params.bright + hoverBoost * 0.18)
      .out(o0);

    src(o0).diff(src(o0, 0.5).scrollX(0.2, 0.1)).out(o1);
    render(o1);

    a.setBins(9);
    a.setCutoff(8);
    a.show();

    hydraReady = true;
  }

  // =====================================================
  // SUPABASE
  // =====================================================
  const SUPABASE_URL = "https://nroguehkffzgerirbdcn.supabase.co";
  const SUPABASE_ANON_KEY = "sb_publishable_87bQ1cjlVd6gw1Ugh45eYg_P8mTW2ZJ";
  const MAX_BYTES = 2 * 1024 * 1024; // 2MB

  let sb = null;

  function supabaseReady() {
    if (typeof window.supabase === "undefined") return false;
    if (!SUPABASE_URL || !SUPABASE_ANON_KEY) return false;
    if (!sb) sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    return true;
  }

  // =====================================================
  // HELPERS
  // =====================================================
  function setStatus(el, msg) {
    if (!el) return;
    el.textContent = msg || "";
  }

  function closeDialogSafe(dlg) {
    try { dlg.close(); } catch {}
    try { dlg.removeAttribute("open"); } catch {}
  }

  function validateFile(file) {
    if (!file) return null;
    if (file.size > MAX_BYTES) return "Arquivo acima de 2MB. Envie um arquivo menor.";
    return null;
  }

  function formatDate(iso) {
    try {
      const d = new Date(iso);
      return d.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
    } catch {
      return "";
    }
  }

  // =====================================================
  // SEEDED RNG + GLYPHS
  // =====================================================
  function hashString(str) {
    let h = 2166136261;
    for (let i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  }

  function seeded01(seed) {
    let x = seed || 123456789;
    x ^= x << 13; x >>>= 0;
    x ^= x >> 17; x >>>= 0;
    x ^= x << 5;  x >>>= 0;
    return (x >>> 0) / 4294967296;
  }

  function pickGlyph(id) {
    const options = ["✶", "✦", "✺", "✹", "❋", "✷", "☼", "☾", "⟡", "✧", "✩", "✪"];
    return options[hashString(id) % options.length];
  }

  // =====================================================
  // SUPABASE: storage + db
  // =====================================================
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
      .insert([{
        text: text || null,
        image_url: mediaUrl || null,
        media_type: mediaType || null
      }]);

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
  // VIEWER
  // =====================================================
  function openViewer(viewer, viewerImg, viewerText, viewerMeta, post) {
    const mediaType = post.media_type || "";
    const isImage = mediaType.startsWith("image/");
    const isVideo = mediaType.startsWith("video/");
    const isAudio = mediaType.startsWith("audio/");

    if (viewerImg) {
      viewerImg.style.display = "none";
      viewerImg.removeAttribute("src");
      viewerImg.alt = "";
    }

    let bodyText = post.text || "";

    if (post.image_url && isImage && viewerImg) {
      viewerImg.src = post.image_url;
      viewerImg.style.display = "block";
      viewerImg.alt = "Imagem enviada ao mural";
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

  // =====================================================
  // GARDEN
  // =====================================================
  function createSeedEl(post, idx, openFn) {
    const el = document.createElement("button");
    el.className = "seed";
    el.type = "button";
    el.setAttribute("aria-label", "Abrir postagem do mural");

    const base = hashString(post.id);
    const s1 = base ^ (idx * 2654435761);
    const s2 = (base + 1013904223) ^ (idx * 1597334677);

    const x = 6 + seeded01(s1) * 88;
    const y = 12 + seeded01(s2) * 76;

    el.style.left = x.toFixed(2) + "%";
    el.style.top = y.toFixed(2) + "%";

    const phaseSeed = (base ^ 0x9e3779b9) >>> 0;
    const dur = 4.8 + seeded01(phaseSeed) * 4.5;
    el.style.animationDuration = dur.toFixed(2) + "s";
    el.style.animationDelay = (-seeded01(phaseSeed ^ 12345) * dur).toFixed(2) + "s";

    const mediaType = post.media_type || "";
    const isImage = mediaType.startsWith("image/");

    if (post.image_url && isImage) {
      const img = document.createElement("img");
      img.className = "seedThumb";
      img.src = post.image_url;
      img.alt = "";
      el.appendChild(img);
    } else {
      const span = document.createElement("span");
      span.className = "emoji";
      span.textContent = pickGlyph(post.id);
      el.appendChild(span);
    }

    // bubble preview
    const bubble = document.createElement("div");
    bubble.className = "bubble";

    if (post.image_url && isImage) {
      const bImg = document.createElement("img");
      bImg.src = post.image_url;
      bImg.alt = "";
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
    hint.textContent = "clique para abrir";
    bubble.appendChild(hint);

    el.appendChild(bubble);

    // click abre viewer
    el.addEventListener("click", openFn);

    // ✅ hover no hydra com aleatoriedade por hover (pequena variação)
    el.addEventListener("mouseenter", () => {
      hoverBoost = 0.65 + Math.random() * 0.7;
    });
    el.addEventListener("mouseleave", () => {
      hoverBoost = 0;
    });

    return el;
  }

  async function renderGarden(garden, viewerEls) {
    if (!garden) return;
    if (!supabaseReady()) return;

    try {
      const posts = await fetchPosts();
      const ordered = (posts || []).reverse();

      garden.innerHTML = "";
      ordered.forEach((p, idx) => {
        const openFn = () => openViewer(
          viewerEls.viewer,
          viewerEls.viewerImg,
          viewerEls.viewerText,
          viewerEls.viewerMeta,
          p
        );
        garden.appendChild(createSeedEl(p, idx, openFn));
      });
    } catch (err) {
      console.error("renderGarden falhou:", err);
    }
  }

  // =====================================================
  // HYDRA MINI EDITOR (open/close/run + drag/resize)
  // =====================================================
  const DEFAULT_PATCH = `
///bruxariadigital@gmail.com

// olá, mundo.
speed=.2

osc(.33,3.3,5.3)
.blend(shape(3, .2,.3).mult(
(osc(2.3,3.3,3.3).modulateRotate(osc(3.3,3.3,3.3).hue(3).shift(2))).rotate(-.003,-.00004).color(1,1,8)
))
.mult(osc(.33,.33,3.3)).modulateScale(noise(3.3,3.3,3.3)).diff(osc(5.33,.3,4))
.mult(shape(3,.3,.2)).color(1)
.out(o1)

src(o0).modulateHue(src(o0).scale(1.2))
.layer(src(o1).luma(0.3, 2e-6),.9).color(1)
.modulateRotate(src(o1).rotate(-.003,.00004).modulate(osc(.2,.5,4))).shift(8).rotate(.003,[.00004, -.00004]).hue(5).modulateScrollX(osc(3,.5,3.))
.modulateScale(src(o0),[.4,.9])
.out()
`;

  function setupHydraMini() {
    const openBtn = document.getElementById("openHydraMini");
    const panel = document.getElementById("hydraMini");
    const closeBtn = document.getElementById("closeHydraMini");
    const codeEl = document.getElementById("hydraCode");
    const runBtn = document.getElementById("runHydra");

    if (!panel) return;

    // começa fechado
    panel.hidden = true;

    // preenche só se estiver vazio
    if (codeEl && !codeEl.value.trim()) codeEl.value = DEFAULT_PATCH;

    function positionNearButton() {
      if (!openBtn) return;
      const r = openBtn.getBoundingClientRect();
      const margin = 10;

      panel.hidden = false; // precisa aparecer pra medir

      const left = clamp(r.left, margin, window.innerWidth - panel.offsetWidth - margin);
      const top = clamp(r.top - panel.offsetHeight - 10, margin, window.innerHeight - panel.offsetHeight - margin);

      panel.style.left = `${left}px`;
      panel.style.top = `${top}px`;
    }

    function openPanel(ev) {
      ev?.preventDefault?.();
      ev?.stopPropagation?.();
      initHydraBackground();
      if (panel.hidden) positionNearButton();
      else panel.hidden = true;
    }

    function closePanel(ev) {
      ev?.preventDefault?.();
      ev?.stopPropagation?.();
      panel.hidden = true;
    }

    openBtn?.addEventListener("click", openPanel);
    closeBtn?.addEventListener("click", closePanel);

    // ESC fecha
    window.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && !panel.hidden) closePanel(e);
    });

    // Rodar
    runBtn?.addEventListener("click", (ev) => {
      ev.preventDefault();
      ev.stopPropagation();

      initHydraBackground();

      const code = (codeEl?.value || "").trim();
      if (!code) {
        alert("O editor está vazio.");
        return;
      }
      try {
        (0, eval)(code);
      } catch (e) {
        console.error(e);
        alert("Erro no código Hydra. (Veja o console.)");
      }
    });

    // reposiciona se mudar tamanho da janela (só se estiver perto do botão)
    window.addEventListener("resize", () => {
      if (!panel.hidden) {
        // apenas clampa pra dentro da viewport
        const r = panel.getBoundingClientRect();
        const margin = 8;
        const left = clamp(r.left, margin, window.innerWidth - r.width - margin);
        const top  = clamp(r.top,  margin, window.innerHeight - r.height - margin);
        panel.style.left = `${left}px`;
        panel.style.top  = `${top}px`;
      }
    });

    enableFloatDragResize(panel);
  }

  function enableFloatDragResize(panel) {
    const topbar = panel.querySelector(".hydra-mini__top");
    if (!topbar) return;

    // evita duplicar se o JS for carregado duas vezes
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

    // DRAG
    let drag = null;

    topbar.addEventListener("pointerdown", (e) => {
      if (panel.hidden) return;

      // ✅ esse é o FIX do desktop: clicar no ✕ NÃO vira drag
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
      const maxTop  = window.innerHeight - panel.offsetHeight - margin;

      panel.style.left = `${clamp(drag.left + dx, margin, maxLeft)}px`;
      panel.style.top  = `${clamp(drag.top  + dy, margin, maxTop)}px`;
    });

    const stopDrag = () => { drag = null; };
    topbar.addEventListener("pointerup", stopDrag);
    topbar.addEventListener("pointercancel", stopDrag);

    // RESIZE
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
      top  = clamp(top,  margin, window.innerHeight - height - margin);

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
  // START
  // =====================================================
  window.addEventListener("DOMContentLoaded", () => {
    // refs
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

    // Hydra
    initHydraBackground();

    // Hydra mini editor
    setupHydraMini();

    // abrir modal composer
    openComposer?.addEventListener("click", () => {
      if (composer?.showModal) composer.showModal();
      else composer?.setAttribute("open", "");
    });

    closeComposer?.addEventListener("click", () => closeDialogSafe(composer));
    closeViewer?.addEventListener("click", () => closeDialogSafe(viewer));

    // fechar clicando fora do card
    composer?.addEventListener("click", (e) => {
      const formEl = composer.querySelector("form");
      if (!formEl) return;
      const r = formEl.getBoundingClientRect();
      const inside =
        e.clientX >= r.left && e.clientX <= r.right &&
        e.clientY >= r.top && e.clientY <= r.bottom;
      if (!inside) closeDialogSafe(composer);
    });

    // submit
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

        initHydraBackground();
        applySeedToHydra(text, mediaType);

        if (textEl) textEl.value = "";
        if (mediaEl) mediaEl.value = "";

        setStatus(statusEl, "Recebido ✶ Sua marca já está no céu.");

        await renderGarden(garden, viewerEls);
        setTimeout(() => closeDialogSafe(composer), 450);
      } catch (err) {
        console.error(err);
        setStatus(statusEl, "Não consegui enviar agora. Tente novamente.");
      } finally {
        if (sendBtn) sendBtn.disabled = false;
      }
    });

    // render inicial
    renderGarden(garden, viewerEls);
  });

})();
