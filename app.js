(() => {
  "use strict";

  // ===== HYDRA LAYER (background vivo) =====
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

function clamp(v, min, max){ return Math.max(min, Math.min(max, v)); }

function hash01(str){
  let h = 2166136261;
  for (let i=0;i<str.length;i++){
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0) / 4294967296;
}

function applySeedToHydra(seedText, mediaType){
  const t = (seedText || "").trim();
  const r = hash01(t || crypto.randomUUID());

  // escolhe 1 parâmetro “principal” por semente
  const pick = Math.floor(r * 7);

  if (pick === 0) params.colorama = clamp(params.colorama + 0.15, 0, 4);
  if (pick === 1) params.hue      = clamp(params.hue + 0.12, 0, 6);
  if (pick === 2) params.blend    = clamp(params.blend + 0.04, 0, 1);
  if (pick === 3) params.scale    = clamp(params.scale + 0.06, 0, 2);
  if (pick === 4) params.mod      = clamp(params.mod + 0.05, 0, 2);
  if (pick === 5) params.contrast = clamp(params.contrast + 0.08, 0, 3);
  if (pick === 6) params.kaleid   = clamp(params.kaleid + 0.10, 0, 4);

  // se tiver mídia, dá um “tint” extra
  if ((mediaType || "").startsWith("image/")) params.sat = clamp(params.sat + 0.08, 0, 3);
  if ((mediaType || "").startsWith("video/")) params.bright = clamp(params.bright + 0.02, -0.3, 0.6);
}

function initHydraBackground(){
  if (hydraReady) return;
  if (typeof window.Hydra === "undefined") return; // hydra-synth ainda não carregou

  const canvas = document.getElementById("hydra-canvas");
  if (!canvas) return;

  // cria Hydra
  // makeGlobal=true para permitir eval no mini-editor (rodar código)
  // detectAudio=true pra usar a.fft
  // eslint-disable-next-line no-undef
  new Hydra({ canvas, detectAudio: true, makeGlobal: true });

  // patch base (o seu), só que com parâmetros reativos + hoverBoost
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


  // ====== CONFIG ======
  const SUPABASE_URL = "https://nroguehkffzgerirbdcn.supabase.co";
  const SUPABASE_ANON_KEY = "sb_publishable_87bQ1cjlVd6gw1Ugh45eYg_P8mTW2ZJ";

  // ====== LIMITES ======
  const MAX_BYTES = 2 * 1024 * 1024; // 2MB

  // ====== Supabase (dentro do escopo local) ======
  let sb = null;
  function supabaseReady() {
    if (typeof window.supabase === "undefined") return false;
    if (!SUPABASE_URL || !SUPABASE_ANON_KEY) return false;
    if (!sb) sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    return true;
  }

  // ====== Helpers ======
  function setStatus(statusEl, msg) {
    if (!statusEl) return;
    statusEl.textContent = msg || "";
  }

  function closeDialogSafe(dlg) {
    try { dlg.close(); } catch {}
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

  // ====== Garden RNG ======
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

  // ====== Supabase: storage + db ======
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

  // ====== UI ======
  function clearGarden(garden) {
    if (garden) garden.innerHTML = "";
  }

  function openViewer(viewer, viewerImg, viewerText, viewerMeta, post) {
    const mediaType = post.media_type || "";
    const isImage = mediaType.startsWith("image/");
    const isVideo = mediaType.startsWith("video/");
    const isAudio = mediaType.startsWith("audio/");

    // reset
    if (viewerImg) {
      viewerImg.style.display = "none";
      viewerImg.removeAttribute("src");
      viewerImg.alt = "";
    }

    let bodyText = post.text || "";

    // imagem inline
    if (post.image_url && isImage && viewerImg) {
      viewerImg.src = post.image_url;
      viewerImg.style.display = "block";
      viewerImg.alt = "Imagem enviada ao mural";
    }

    // vídeo/áudio: link (simples)
    if (post.image_url && (isVideo || isAudio)) {
      bodyText += (bodyText ? "\n\n" : "") + `Arquivo: ${post.image_url}`;
    } else if (post.image_url && !isImage) {
      bodyText += (bodyText ? "\n\n" : "") + `Arquivo: ${post.image_url}`;
    }

    if (viewerText) viewerText.textContent = bodyText;
    if (viewerMeta) viewerMeta.textContent = post.created_at ? `Enviado em ${formatDate(post.created_at)}` : "";

    viewer?.showModal?.();
  }

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
  el.style.animationDelay =
    (-seeded01(phaseSeed ^ 12345) * dur).toFixed(2) + "s";

  const mediaType = post.media_type || "";
  const isImage = mediaType.startsWith("image/");

  // ===== conteúdo visível da seed =====
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

  // ===== BUBBLE (HOVER PREVIEW) =====
  const bubble = document.createElement("div");
  bubble.className = "bubble";

  // imagem na bolha (se existir)
  if (post.image_url && isImage) {
    const bImg = document.createElement("img");
    bImg.src = post.image_url;
    bImg.alt = "";
    bubble.appendChild(bImg);
  }

  // texto da bolha
  if (post.text) {
    const bText = document.createElement("div");
    bText.className = "bubbleText";
    bText.textContent = post.text;
    bubble.appendChild(bText);
  }

  // hint
  const hint = document.createElement("div");
  hint.className = "bubbleHint";
  hint.textContent = "clique para abrir";
  bubble.appendChild(hint);

  el.appendChild(bubble);

  // clique abre viewer completo
  el.addEventListener("click", openFn);
  // hover da seed intensifica o Hydra
el.addEventListener("mouseenter", () => { hoverBoost = 1; });
el.addEventListener("mouseleave", () => { hoverBoost = 0; });


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


  // ====== START ======
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

    // Hydra: inicia (se a lib já carregou)
initHydraBackground();

// Mini editor popup
const openHydraMini = document.getElementById("openHydraMini");
const hydraMini = document.getElementById("hydraMini");
const closeHydraMini = document.getElementById("closeHydraMini");
const hydraCode = document.getElementById("hydraCode");
const runHydra = document.getElementById("runHydra");

const DEFAULT_PATCH = `
///bruxariadigital@gmail.com



//olá, mundo.

speed=.2 // intensidade
									//sinto que estou saindo de um casulo
                   // para algumas pessoas, viver é um manifesto de si mesmo

osc(.33,3.3,5.3)//.modulateHue(-3.3,-3.3,-3.3)
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


//.mult(shape(3,.3,.2).scale(1.006))


.out(
`;

if (hydraCode) hydraCode.value = DEFAULT_PATCH;

function positionMiniNearButton(){
  if (!openHydraMini || !hydraMini) return;
  const r = openHydraMini.getBoundingClientRect();
  const margin = 10;

  hydraMini.hidden = false;

  const left = clamp(r.left, margin, window.innerWidth - hydraMini.offsetWidth - margin);
  const top  = clamp(r.top - hydraMini.offsetHeight - 10, margin, window.innerHeight - hydraMini.offsetHeight - margin);

  hydraMini.style.left = `${left}px`;
  hydraMini.style.top  = `${top}px`;
}

openHydraMini?.addEventListener("click", () => {
  initHydraBackground();
  if (hydraMini?.hidden) positionMiniNearButton();
  else hydraMini.hidden = true;
});

closeHydraMini?.addEventListener("click", () => { if (hydraMini) hydraMini.hidden = true; });

runHydra?.addEventListener("click", (ev) => {
  ev.preventDefault();
  ev.stopPropagation();

  initHydraBackground();

  const code = (hydraCode?.value || "").trim();

  if (!code) {
    alert("O editor está vazio.");
    return;
  }

  try {
    // executa no contexto global do Hydra
    (0, eval)(code);
  } catch (e) {
    console.error(e);
    alert("Erro no código Hydra. (Veja o console.)");
  }
});

	  closeHydraMini?.addEventListener("click", (ev) => {
  ev.preventDefault();
  ev.stopPropagation();
  if (hydraMini) hydraMini.hidden = true;
});



window.addEventListener("resize", () => {
  if (hydraMini && !hydraMini.hidden) positionMiniNearButton();
});

    
    // abrir modal SEM depender de supabase
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
        initHydraBackground();          // garante que o Hydra está vivo
        applySeedToHydra(text, mediaType); // “plantar” mexe nos parâmetros

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
