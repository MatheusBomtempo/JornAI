# Fast Instagram publishing platform with AI — Technical specification

## Overview

A web tool for a newspaper newsroom to publish urgent posts to the Instagram feed with as
little friction as possible: a reporter sends the source (photo, text or link), the AI
generates the text (title, short news, caption, art text suggestion), the reporter
adjusts the photo and the text inside a fixed brand template, an editor/manager reviews
(approves, rejects, asks for a redo with AI, or edits manually) and only after that does
the post go to Instagram.

It is **not** a scheduling tool — publishing is immediate, on demand, at any hour. There is
**no** AI image generation — the final art is always a real photo (adjusted manually)
composed over a fixed template. There is **no**, for now, support for Stories, video or
multiple social networks — only the Instagram feed. Multi-network/video/Stories are left
for a v2.0.

The language the product works in (the language of the sources and of the generated
posts) is chosen per deployment with the `APP_LANGUAGE` environment variable (`pt` or `en`).
See `src/lib/language`.

## Recommended stack

- **Frontend:** Next.js (React), responsive web — mobile-first but with no native app requirement.
- **Art editor:** Fabric.js (interactive canvas, open source, MIT) — a photo that can be
  dragged/zoomed inside a fixed area, a locked template overlay, text editable only in its content.
- **Backend:** own API (Next.js API routes or a separate Node service).
- **Database:** PostgreSQL.
- **Final art render:** Sharp (Node), server-side, from the same parameters saved by the
  editor (not from the browser canvas — it guarantees quality and reproducibility).
- **AI:** a text model (GPT-4o/Gemini/Claude) — text only, no vision or image generation.
- **Publishing:** Instagram Graph API (Meta), directly, with no third-party library.
- **Media storage:** S3/R2/Supabase Storage (the final art has to be at a public HTTPS URL
  before publishing).

## Flow (state machine)

```
CAPTURE (reporter) → text/photo/link
   ↓
PROCESSING_AI (text only: title, short news, caption, art text suggestion)
   ↓
ART EDITOR (Fabric.js) — the reporter adjusts the photo (position/zoom) and the suggested text
   ↓
IN_REVIEW (editor/manager sees an Instagram-style preview)
   │
   ├── Approve  → publishes to Instagram
   ├── Reject   → archives with a reason
   ├── Redo     → new AI cycle (new version)
   └── Edit     → manual edit → goes back to review
```

Each cycle (AI or manual edit) generates a **new version**, never overwrites — that gives
history/audit for free, with no extra work.

## Database schema (PostgreSQL)

```sql
CREATE TYPE user_role AS ENUM ('admin', 'manager', 'staff');

CREATE TABLE users (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name       TEXT NOT NULL,
  email      TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role       user_role NOT NULL DEFAULT 'staff',
  active     BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE api_keys (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name         TEXT NOT NULL,
  key_hash     TEXT NOT NULL,
  scopes       TEXT[],
  created_by   UUID REFERENCES users(id),
  last_used_at TIMESTAMPTZ,
  revoked_at   TIMESTAMPTZ,
  created_at   TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE posts (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_by      UUID NOT NULL REFERENCES users(id),
  region          TEXT,
  source_type     TEXT NOT NULL,        -- 'photo' | 'text' | 'link'
  source_text     TEXT,
  source_url      TEXT,
  scraped_content TEXT,                 -- text extracted when source_type = 'link'
  status          TEXT NOT NULL DEFAULT 'processing_ai',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE post_photos (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id     UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  storage_url TEXT NOT NULL,            -- original photo, unedited
  order_index INT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE art_templates (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name              TEXT NOT NULL,
  canvas_width      INT NOT NULL DEFAULT 1080,
  canvas_height     INT NOT NULL DEFAULT 1080,   -- or 1350 for the 4:5 format
  overlay_asset_url TEXT NOT NULL,       -- PNG of the frame/watermark, transparent where the photo goes
  photo_slot        JSONB NOT NULL,      -- { x, y, width, height }
  text_slot         JSONB NOT NULL,      -- { x, y, width, height, font, fontSize, color, align }
  is_active         BOOLEAN DEFAULT TRUE,
  created_at        TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE style_reference (
  id                 INT PRIMARY KEY DEFAULT 1,   -- single row
  example_title      TEXT,
  example_short_news TEXT,
  example_caption    TEXT,
  example_art_text   TEXT,
  updated_by         UUID REFERENCES users(id),
  updated_at         TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE post_versions (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id           UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  version_number    INT NOT NULL,
  origin            TEXT NOT NULL,      -- 'ai_generated' | 'manual_edit' | 'ai_regenerated'
  title             TEXT,
  short_news        TEXT,
  instagram_caption TEXT,
  art_text          TEXT,
  selected_photo_id UUID REFERENCES post_photos(id),
  photo_transform   JSONB,              -- { offsetX, offsetY, scale } from the Fabric.js editor
  art_template_id   UUID REFERENCES art_templates(id),
  rendered_art_url  TEXT,               -- result of the final render (Sharp)
  edited_by         UUID REFERENCES users(id),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE review_decisions (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_version_id  UUID NOT NULL REFERENCES post_versions(id),
  reviewer_id      UUID NOT NULL REFERENCES users(id),
  decision         TEXT NOT NULL,       -- 'approved' | 'rejected' | 'regenerate' | 'manual_edit'
  reason           TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE publications (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_version_id     UUID NOT NULL REFERENCES post_versions(id),
  instagram_media_id  TEXT,
  instagram_post_url  TEXT,
  status              TEXT NOT NULL,    -- 'pending' | 'container_created' | 'published' | 'failed'
  error_message       TEXT,
  published_at        TIMESTAMPTZ,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

## API endpoints

```
POST   /posts                          → { source_type, source_text?, source_url?, photos[] }
                                          (triggers the AI: text only — title, short_news, caption, suggested art_text)

POST   /posts/:id/art                  → saves photo_transform + art_text adjusted in the editor
                                          → triggers the final render on the server (Sharp) → rendered_art_url

POST   /posts/:id/regenerate           → new AI cycle (new version, same photos)
PATCH  /posts/:id/versions/:vid        → manual text edit

POST   /posts/:id/versions/:vid/approve → triggers publishing to Instagram
POST   /posts/:id/versions/:vid/reject  → decision = rejected + mandatory reason

GET    /posts / /posts/:id             → listing and detail (with versions and decisions)

GET/PUT  /style-reference              → the default text example used as a reference by the AI
GET/POST /art-templates                → registration of the fixed template(s)

GET/POST/PATCH /users                  → admin manages users and roles
GET/POST/DELETE /api-keys              → admin only
```

## Roles

| Role | Permissions |
|---|---|
| **admin** | Everything — users, API keys, templates, style reference, approve/publish |
| **manager** | Approve/reject/redo/edit/publish; edit style reference and templates |
| **staff** (reporter) | Submits sources, edits their own submissions before approval; does not approve or publish alone |

## Publishing to Instagram

- API: Instagram Graph API (Meta), in a 2-step flow:
  1. `POST /{ig-user-id}/media` with `image_url` (the final art, publicly hosted) + `caption` → returns `creation_id`.
  2. `POST /{ig-user-id}/media_publish` with `creation_id` → returns the `id` of the published post.
- Requirements: an Instagram Business/Creator account linked to a Facebook Page, an app created at developers.facebook.com, the account added as an **Instagram Tester** inside the app.
- **Important:** since publishing is only to the company's own account (not to third-party accounts), the app can run in **development mode** — it does not need to go through Meta's App Review, which is only mandatory when the app publishes to other companies'/clients' accounts.
- Required permission: `instagram_business_content_publish` (current name; old documentation uses `instagram_content_publish`).
- Limit: up to 100 posts published via the API per rolling 24h period per account.

## Decisions already validated (do not reopen without a strong reason)

- No scheduling — publishing is always immediate, on demand.
- No AI image generation — the AI only generates text.
- No automatic "best photo" selection — the reporter chooses and adjusts manually.
- Image suggestions are only search terms (Google Images / free stock library) generated
  by the AI along with the text — they never choose, download or publish a photo on their own.
  Priority: 1) photo uploaded by the reporter, 2) photo from the original source, 3) found via
  Google, 4) found in a free library, 5) no photo. Upload accepts drag & drop of an image OR
  a PDF anywhere on the capture screen, with the type detected automatically.
- No Canva — the template is reproduced in code (fixed PNG overlay) and composed via Fabric.js (editing) + Sharp (final render).
- Simplified style guide — a single reference example, not a library of examples.
- Three source types: photo, ready-made text, link (which needs scraping before going to the AI).
- Three roles: admin, manager, staff, with a separation between who creates and who approves.

## Suggested first steps for Claude Code

1. Initialize the Next.js + TypeScript + Prisma (or Drizzle) + PostgreSQL project.
2. Run the migrations with the schema above.
3. Implement simple authentication with roles (NextAuth or a custom solution).
4. `POST /posts` endpoint with the AI pipeline (text only).
5. Art editor component with Fabric.js (photo + fixed overlay + editable text).
6. Final render endpoint with Sharp.
7. Review screen (Instagram post mockup + approve/reject/redo/edit buttons).
8. Instagram Graph API integration (2-step publish).
9. Admin panel (users, roles, API keys, templates, style reference).
