# Céu Poético (Potiguarias Visuais)

Laboratório experimental de webart com **Hydra** (vídeo ao vivo), **Strudel** (música ao vivo) e um mural de "sementes".

## Rodar localmente

- Abra `index.html` com um servidor estático (recomendado), por exemplo:

```bash
python -m http.server 8000
```

Depois acesse `http://localhost:8000`.

## Admin

- Página: `admin.html`
- Existe um **gate simples por senha** (prompt) antes de mostrar a UI.
  - Altere a constante `BASIC_ADMIN_PASSWORD` dentro de `admin.js` antes de publicar.
  - **Atenção:** isso não é uma proteção forte; para segurança real, use autenticação + RLS no Supabase.

## Licenças / atribuições

Este projeto usa bibliotecas externas. Antes de publicar, revise as licenças e exigências:

- **Hydra / hydra-synth**: licença **AGPL-3.0** (copyleft forte).
- **Strudel (@strudel/web / @strudel/core)**: licença **AGPL-3.0-or-later** (copyleft forte).

Em termos práticos: se você disponibiliza este site na web e ele depende dessas bibliotecas, pode haver obrigação de disponibilizar o código-fonte correspondente (incluindo modificações) para os usuários que acessam o serviço. Como este repositório já fica público no GitHub Pages, isso normalmente atende ao requisito — mas confirme com o texto das licenças.

Links:
- Hydra: https://hydra.ojack.xyz/
- Strudel: https://strudel.cc/

Este projeto usa bibliotecas externas:

- **Hydra / hydra-synth** — licença **AGPL-3.0** (upstream: hydra-synth).
- **Strudel** (`@strudel/web`, `@strudel/core`) — licença **AGPL-3.0-or-later** (upstream: tidalcycles/strudel / codeberg).

Como essas bibliotecas são AGPL, ao publicar um serviço web com elas, em geral você precisa disponibilizar o código-fonte correspondente para quem usa pela rede. Publicar este repositório no GitHub (junto do site) normalmente atende esse requisito, mas confirme com a sua necessidade.

Links:

- Hydra: https://hydra.ojack.xyz/
- Hydra (repo): https://github.com/hydra-synth/hydra
- Strudel: https://strudel.cc/
- Strudel (repo): https://github.com/tidalcycles/strudel

## Controles

- **Triângulos (A/B/C/D)**: muda preset Hydra e (se o som estiver ligado) muda a melodia base do Strudel.
- **Som: on/off**: liga/desliga o áudio do Strudel (com fade curto para evitar corte seco).
- **Bolhas/sementes**:
  - hover (desktop) ou press (mobile) = prévia de camada sonora + FX aleatório.
  - click/toque = trava a camada sonora + trava o FX aleatório.
  - abrir viewer: **duplo clique** no seed ou botão **"ver"** na bolha.
- **Reset códigos** no mini editor: reseta **apenas o código local do seu dispositivo** para o padrão do preset.

## Admin

A página `admin.html` tem um **gate básico por senha** (via `prompt`).
Troque a constante `BASIC_ADMIN_PASSWORD` no `admin.js` antes de publicar.

## Licenças / atribuições (importante)

Este projeto usa bibliotecas externas com licença **AGPL-3.0**:

- Hydra / hydra-synth (visual live coding)
- Strudel (pattern live coding)

Se você publicar um site que disponibiliza essas bibliotecas ao público (ex.: GitHub Pages), a AGPL geralmente requer que o **código-fonte correspondente do serviço** esteja disponível aos usuários.
Manter este repositório público (com o código completo) costuma ser a forma mais simples de atender a isso.

Links:

- Hydra: https://hydra.ojack.xyz/
- Strudel: https://strudel.cc/
