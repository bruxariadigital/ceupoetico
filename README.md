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

Em termos práticos: se você disponibiliza este site na web e ele depende do Hydra, pode haver obrigação de disponibilizar o código-fonte correspondente (incluindo modificações) para os usuários que acessam o serviço. Como este repositório já fica público no GitHub Pages, isso normalmente atende ao requisito — mas confirme com o texto da licença.

Links:
- Hydra: https://hydra.ojack.xyz/
- Hydra (repo): https://github.com/hydra-synth/hydra

## Controles

- **Triângulos (A/B/C/D)**: muda preset Hydra.
- **Bolhas/sementes**:
  - **hover (desktop)** = abre/mostra a bolha e aplica uma alteração aleatória (preview, temporária) no Hydra.
  - **1 clique** = fixa a alteração atual (lock), que permanece mesmo fechando a bolha.
  - **2 cliques** = abre o conteúdo (viewer) sem desfazer o lock.
  - **Clique fora** = fecha a bolha/conteúdo, mas mantém a alteração fixada.
  - O hover só atua quando não existe lock.
- **Reset códigos** no mini editor: reseta o código do preset ativo (local) para o padrão.
