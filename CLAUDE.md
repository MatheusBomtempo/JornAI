# JornAI — instruções para o Claude

## Fluxo de branches

- **Todo trabalho novo vai na branch `production`** (é a que está no ar na Vercel; não escreva a URL pública em nenhum arquivo do repo). Trabalhe e faça commit/push nela por padrão.
- **Não suba nada para a `main` por conta própria.** A `main` é a vitrine do projeto no GitHub; só faça merge de `production` → `main` quando o usuário pedir explicitamente.
- Antes de qualquer push (em `production` ou `main`), rode localmente o que o CI roda (build + banco).

## Convenções

- Código em inglês; `APP_LANGUAGE` escolhe o idioma de trabalho da interface.
- Visual: paleta preto & branco no estilo Vercel (a cor de destaque é o branco; `brand-*` no Tailwind é tons de cinza). Logo: componente `src/components/Logo.tsx`.
