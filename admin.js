(() => {
  "use strict";

  const SUPABASE_URL = "https://nroguehkffzgerirbdcn.supabase.co";
  const SUPABASE_ANON_KEY = "sb_publishable_87bQ1cjlVd6gw1Ugh45eYg_P8mTW2ZJ";

  const sb = window.supabase?.createClient?.(SUPABASE_URL, SUPABASE_ANON_KEY);
  const $ = (id) => document.getElementById(id);

  const email = $("email");
  const password = $("password");
  const loginBtn = $("loginBtn");
  const signupBtn = $("signupBtn");
  const resetBtn = $("resetBtn");
  const logoutBtn = $("logoutBtn");
  const authStatus = $("authStatus");
  const authBox = $("authBox");
  const listBox = $("listBox");
  const postsEl = $("posts");
  const countEl = $("count");
  const refreshBtn = $("refreshBtn");

  function setStatus(msg) {
    if (authStatus) authStatus.textContent = msg || "";
  }

  function fmtDate(iso) {
    try {
      const d = new Date(iso);
      return d.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
    } catch {
      return "";
    }
  }

  function extractStoragePath(publicUrl) {
    // Ex: https://<proj>.supabase.co/storage/v1/object/public/mural/<path>
    try {
      const marker = "/storage/v1/object/public/mural/";
      const i = publicUrl.indexOf(marker);
      if (i === -1) return null;
      return publicUrl.slice(i + marker.length);
    } catch {
      return null;
    }
  }

  async function getUser() {
    const { data } = await sb.auth.getUser();
    return data?.user || null;
  }

  async function refreshUI() {
    const user = await getUser();
    const logged = !!user;

    authBox.hidden = logged;
    listBox.hidden = !logged;
    logoutBtn.hidden = !logged;

    if (logged) {
      setStatus("");
      await loadPosts();
    } else {
      postsEl.innerHTML = "";
      countEl.textContent = "—";
    }
  }

  async function loadPosts() {
    if (!sb) return;

    postsEl.innerHTML = "<div class=\"adminHint\">Carregando…</div>";
    const { data, error } = await sb
      .from("mural_posts")
      .select("id, created_at, text, image_url, media_type")
      .order("created_at", { ascending: false })
      .limit(400);

    if (error) {
      postsEl.innerHTML = "";
      countEl.textContent = "Erro";
      setStatus("Não consegui carregar os posts. Verifique permissões/RLS.");
      console.error(error);
      return;
    }

    const items = data || [];
    countEl.textContent = String(items.length);
    postsEl.innerHTML = "";

    items.forEach((p) => {
      const row = document.createElement("div");
      row.className = "adminItem";

      const meta = document.createElement("div");
      meta.className = "adminMeta";
      meta.textContent = `${fmtDate(p.created_at)}  •  id: ${p.id}`;

      const body = document.createElement("div");
      body.className = "adminBody";
      body.textContent = (p.text || "").slice(0, 900) || "(sem texto)";

      const media = document.createElement("div");
      media.className = "adminMedia";
      if (p.image_url) {
        const a = document.createElement("a");
        a.href = p.image_url;
        a.target = "_blank";
        a.rel = "noopener";
        a.textContent = `mídia: ${p.media_type || "arquivo"}`;
        media.appendChild(a);
      }

      const actions = document.createElement("div");
      actions.className = "adminActions";

      const delBtn = document.createElement("button");
      delBtn.type = "button";
      delBtn.className = "btn adminDanger";
      delBtn.textContent = "Apagar";

      delBtn.addEventListener("click", async () => {
        const ok = confirm("Apagar este post do mural? Isso não pode ser desfeito.");
        if (!ok) return;

        delBtn.disabled = true;
        delBtn.textContent = "Apagando…";

        try {
          // 1) apaga linha
          const { error: delErr } = await sb.from("mural_posts").delete().eq("id", p.id);
          if (delErr) throw delErr;

          // 2) tenta apagar arquivo no storage (se for do bucket mural)
          if (p.image_url) {
            const path = extractStoragePath(p.image_url);
            if (path) {
              const { error: stErr } = await sb.storage.from("mural").remove([path]);
              if (stErr) console.warn("Não consegui remover arquivo do storage:", stErr);
            }
          }

          row.remove();
          const now = Math.max(0, (parseInt(countEl.textContent || "0", 10) || 0) - 1);
          countEl.textContent = String(now);
        } catch (e) {
          console.error(e);
          alert("Não consegui apagar. Verifique as permissões (RLS) do Supabase.");
          delBtn.disabled = false;
          delBtn.textContent = "Apagar";
        }
      });

      actions.appendChild(delBtn);
      row.appendChild(meta);
      row.appendChild(body);
      if (p.image_url) row.appendChild(media);
      row.appendChild(actions);
      postsEl.appendChild(row);
    });
  }

  // ---- Auth ----
  async function login() {
    if (!sb) return;
    const e = (email?.value || "").trim();
    const p = password?.value || "";
    if (!e || !p) {
      setStatus("Preencha e-mail e senha.");
      return;
    }
    setStatus("Entrando…");
    const { error } = await sb.auth.signInWithPassword({ email: e, password: p });
    if (error) {
      console.error(error);
      setStatus(error.message || "Falha no login.");
      return;
    }
    await refreshUI();
  }

  async function signup() {
    if (!sb) return;
    const e = (email?.value || "").trim();
    const p = password?.value || "";
    if (!e || !p) {
      setStatus("Preencha e-mail e senha.");
      return;
    }
    setStatus("Criando conta…");
    const { error } = await sb.auth.signUp({ email: e, password: p });
    if (error) {
      console.error(error);
      setStatus(error.message || "Falha ao criar conta.");
      return;
    }
    setStatus("Conta criada. Se o Supabase exigir confirmação, verifique o e-mail.");
  }

  async function resetPass() {
    if (!sb) return;
    const e = (email?.value || "").trim();
    if (!e) {
      setStatus("Digite seu e-mail para receber o link.");
      return;
    }
    setStatus("Enviando link…");
    const { error } = await sb.auth.resetPasswordForEmail(e);
    if (error) {
      console.error(error);
      setStatus(error.message || "Não consegui enviar o e-mail.");
      return;
    }
    setStatus("Link enviado. Verifique sua caixa de entrada.");
  }

  async function logout() {
    if (!sb) return;
    await sb.auth.signOut();
    await refreshUI();
  }

  window.addEventListener("DOMContentLoaded", async () => {
    if (!sb) {
      setStatus("Supabase não carregou. Confira o <script> no admin.html.");
      return;
    }

    loginBtn?.addEventListener("click", login);
    signupBtn?.addEventListener("click", signup);
    resetBtn?.addEventListener("click", resetPass);
    logoutBtn?.addEventListener("click", logout);
    refreshBtn?.addEventListener("click", loadPosts);

    sb.auth.onAuthStateChange(() => {
      refreshUI();
    });

    await refreshUI();
  });
})();
