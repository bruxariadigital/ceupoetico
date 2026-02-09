# ceupoetico
laboratório experimental


## Admin (curadoria do mural)

Abra `admin.html` no navegador (ex.: `https://SEU-USUARIO.github.io/SEU-REPO/admin.html`).

- Login por e-mail/senha via Supabase Auth.
- Lista as entradas (`mural_posts`) e permite apagar individualmente.

### Segurança (recomendado)

Para que **só você** consiga listar/apagar, você precisa configurar **RLS** (Row Level Security) no Supabase.

Ideia de policy: permitir SELECT/DELETE somente para um e-mail específico (substitua pelo seu).

> Exemplo (SQL) — ajuste conforme seu projeto:
> - Ative RLS em `mural_posts`
> - Crie policy de SELECT/DELETE para usuários autenticados cujo e-mail corresponda.

Se você não ativar policies, o admin pode falhar (ou pior: ficar aberto demais).  

## Som (Strudel)

O site carrega `@strudel/web` e inclui um botão 🔇/🔈 para ligar/desligar o som.
Os triângulos A/B/C/D disparam patterns diferentes quando o som está ligado.
