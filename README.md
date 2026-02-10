# Céu Poético (Potiguarias Visuais)

Laboratório experimental de webart com **Hydra** (vídeo ao vivo) e um mural de "sementes".

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

Em termos práticos: se você disponibiliza este site na web e ele depende de Hydra/hydra-synth, pode haver obrigação de disponibilizar o código-fonte correspondente (incluindo modificações) para os usuários que acessam o serviço. Como este repositório já fica público no GitHub Pages, isso normalmente atende ao requisito — mas confirme com o texto da licença.

Links:
- Hydra: https://hydra.ojack.xyz/
- Hydra (repo): https://github.com/hydra-synth/hydra

## Controles

- **Triângulos (A/B/C/D)**: muda preset Hydra.
- **Bolhas/sementes**:
  - hover (desktop) ou press (mobile) = prévia de FX no Hydra (temporário, só quando não há lock).
  - 1 clique/toque = trava o FX atual (lock) até clicar em outra bolha.
  - abrir viewer: **duplo clique** no seed ou botão **"ver"** na bolha.
- **Reset códigos** no mini editor: reseta **apenas o código local do seu dispositivo** para o padrão do preset.

## Admin

A página `admin.html` tem um **gate básico por senha** (via `prompt`).
Troque a constante `BASIC_ADMIN_PASSWORD` no `admin.js` antes de publicar.

## Licenças / atribuições (importante)

Este projeto usa **Hydra / hydra-synth** com licença **AGPL-3.0**.

Se você publicar um site que disponibiliza essa biblioteca ao público (ex.: GitHub Pages), a AGPL geralmente requer que o **código-fonte correspondente do serviço** esteja disponível aos usuários.
Manter este repositório público (com o código completo) costuma ser a forma mais simples de atender a isso.

Link:

- Hydra: https://hydra.ojack.xyz/
