# Contributing to JornAI

Thanks for your interest! JornAI is a small, focused project and contributions of every size are welcome — bug reports, docs, translations, new language packs, and code.

## Ground rules

- **Code, comments, logs and commit messages are in English.** Product copy for the interface lives in the dictionaries under `src/lib/i18n/dictionaries/` (one entry per language).
- **The AI only writes text.** No image generation, no auto-picking photos, no publishing without a human approval — these are deliberate product decisions (see [`SPEC.md`](SPEC.md)).
- **Keep the fact-accuracy pipeline honest.** Any change to prompts, redaction or the validator should come with the real-world failure it fixes.

## Getting set up

```bash
npm install
cp .env.example .env      # AI_PROVIDER="mock" runs everything without API keys
npm run db:migrate
npm run db:seed
npm run dev
```

You need a PostgreSQL database (`docker compose up -d` starts one that matches `.env.example`).

Before opening a pull request, run what CI runs:

```bash
npm run db:generate
npm run typecheck
npm run lint
npm run build      # also applies the Prisma migrations, so it needs the database
```

## Adding a language

The language JornAI works in (sources and generated posts) is chosen with `APP_LANGUAGE`. Everything that depends on it lives in a language pack:

1. Copy `src/lib/language/en/` to `src/lib/language/<code>/` and translate the examples and rules (prompt examples, forbidden phrases, weekday names, date formats, personal-data patterns).
2. Register the pack in `src/lib/language/index.ts` and add the code to `LANGUAGES` in `src/lib/language/types.ts`.
3. Add the interface copy for the new language to the dictionaries in `src/lib/i18n/dictionaries/` if you also want it in the UI.

## Pull requests

- Keep them focused; one topic per PR.
- Describe *why*, and how you tested it.
- Never commit secrets — `.env` is ignored on purpose.

## Reporting security issues

Please do not open a public issue for a vulnerability — see [`SECURITY.md`](SECURITY.md).
