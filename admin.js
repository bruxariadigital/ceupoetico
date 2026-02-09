(() => {
  "use strict";

  const SUPABASE_URL = "https://nroguehkffzgerirbdcn.supabase.co";
  const SUPABASE_ANON_KEY = "sb_publishable_87bQ1cjlVd6gw1Ugh45eYg_P8mTW2ZJ";

  let sb = null;
  function getClient() {
    if (sb) return sb;
    if (!window.supabase) throw new Error("supabase-js não carregou");
    sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    return sb;
  }

  const $ = (id) => document.getElementById(id);

  function fmt(iso) {
    try {
      return new Date(iso).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
    } catch {
      return iso || "";
    }
  }

  async function signIn(email, password) {
    const client = getClient();
    return client.auth.signInWithPassword({ email, password });
  }

  async function signUp(email, password) {
    const client = getClient();
    // por padrão, Supabase pode exigir confirmação de e-mail conforme configuração do projeto
    return client.auth.signUp({ email, password });
  }

  async function resetPassword(email) {
    const client = getClient();
    // precisa configurar "Site URL" / redirect no Supabase Auth settings
    return client.auth.resetPasswordForEmail(email);
  }

  async function signOut() {
    const client = getClient();
    return client.auth.signOut();
  }

  async function fetchPosts() {
    const client = getClient();
    const { data, error } = await client
      .from("mural_posts")
      .select("id, created_at, text, image_url, media_type")
      .order("created_at", { ascending: false })
      .limit(500);

    if (error) throw error;
    return data || [];
  }

  async function deletePost(id) {
    const client = getClient();
    const { error } = await client.from("mural_posts").delete().eq("id", id);
    if (error) throw error;
  }

  function renderList(items) {
    const list = $("list");
    if (!list) return;
    list.innerHTML = "";

    if (!items.length) {
      list.innerHTML = "<p class=\"subtitle\">Sem entradas.</p>";
      return;
    }

    items.forEach((p) => {
      const card = document.createElement("div");
      card.className = "adminItem";

      const top = document.createElement("div");
      top.className = "adminItemTop";

      const meta = document.createElement("div");
      meta.className = "adminMeta";
      meta.textContent = `${fmt(p.created_at)} • ${p.media_type || "sem mídia"} • id: ${p.id}`;

      const actions = document.createElement("div");
      actions.className = "adminActions";

      const del = document.createElement("button");
      del.className = "btn";
      del.type = "button";
      del.textContent = "Apagar";
      del.addEventListener("click", async () => {
        const ok = confirm("Apagar esta entrada do mural? Isso não pode ser desfeito.");
        if (!ok) return;
        try {
          del.disabled = true;
          await deletePost(p.id);
          card.remove();
        } catch (e) {
          console.error(e);
          alert("Não consegui apagar. Verifique RLS/policies no Supabase.");
        } finally {
          del.disabled = false;
        }
      });

      actions.appendChild(del);
      top.appendChild(meta);
      top.appendChild(actions);

      const body = document.createElement("div");
      body.className = "adminBody";

      if (p.image_url && (p.media_type || "").startsWith("image/")) {
        const img = document.createElement("img");
        img.src = p.image_url;
        img.alt = "";
        img.loading = "lazy";
        img.className = "adminImg";
        body.appendChild(img);
      } else if (p.image_url) {
        const a = document.createElement("a");
        a.href = p.image_url;
        a.target = "_blank";
        a.rel = "noreferrer";
        a.textContent = p.image_url;
        a.className = "adminLink";
        body.appendChild(a);
      }

      if (p.text) {
        const pre = document.createElement("pre");
        pre.className = "adminText";
        pre.textContent = p.text;
        body.appendChild(pre);
      }

      card.appendChild(top);
      card.appendChild(body);
      list.appendChild(card);
    });
  }

  function setAuthedUI(isAuthed) {
    $("authBox")?.toggleAttribute("hidden", isAuthed);
    $("adminBox")?.toggleAttribute("hidden", !isAuthed);
    $("logoutBtn")?.toggleAttribute("hidden", !isAuthed);
  }

  async function refresh() {
    $("listStatus").textContent = "Carregando…";
    try {
      const items = await fetchPosts();
      renderList(items);
      $("listStatus").textContent = `${items.length} entrada(s).`;
    } catch (e) {
      console.error(e);
      $("listStatus").textContent = "Erro ao carregar. Verifique RLS/policies e se você está logada.";
    }
  }

  window.addEventListener("DOMContentLoaded", async () => {
    const logoutBtn = $("logoutBtn");
    const loginForm = $("loginForm");
    const signupBtn = $("signupBtn");
    const resetBtn = $("resetBtn");
    const refreshBtn = $("refreshBtn");
    const status = $("authStatus");

    const client = getClient();

    // estado inicial
    const session = await client.auth.getSession();
    setAuthedUI(!!session.data.session);
    if (session.data.session) refresh();

    client.auth.onAuthStateChange((_event, sess) => {
      setAuthedUI(!!sess);
      if (sess) refresh();
    });

    loginForm?.addEventListener("submit", async (e) => {
      e.preventDefault();
      const email = $("email").value.trim();
      const password = $("password").value;
      status.textContent = "Entrando…";
      const { error } = await signIn(email, password);
      if (error) {
        status.textContent = "Erro: " + error.message;
      } else {
        status.textContent = "Ok.";
      }
    });

    signupBtn?.addEventListener("click", async () => {
      const email = $("email").value.trim();
      const password = $("password").value;
      if (!email || !password) {
        status.textContent = "Preencha e-mail e senha para criar conta.";
        return;
      }
      status.textContent = "Criando conta…";
      const { error } = await signUp(email, password);
      if (error) {
        status.textContent = "Erro: " + error.message;
      } else {
        status.textContent = "Conta criada. (Pode exigir confirmação por e-mail — depende da configuração do Supabase.)";
      }
    });

    resetBtn?.addEventListener("click", async () => {
      const email = $("email").value.trim();
      if (!email) {
        status.textContent = "Digite seu e-mail para recuperar a senha.";
        return;
      }
      status.textContent = "Enviando e-mail de recuperação…";
      const { error } = await resetPassword(email);
      if (error) {
        status.textContent = "Erro: " + error.message;
      } else {
        status.textContent = "Enviado! Confira seu e-mail.";
      }
    });

    logoutBtn?.addEventListener("click", async () => {
      await signOut();
    });

    refreshBtn?.addEventListener("click", refresh);
  });
})();
