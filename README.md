# Folio Backend

Backend API for the [Folio frontend](https://rawasialqurum.github.io/folio-frontend/). Node.js + Express, packaged with Docker for Fly.io (or Render/Railway).

**This backend's routes and JSON response shapes are matched exactly to the JavaScript already inside `folio-frontend/index.html`** — you only need to update one constant in that file (see "Connect the frontend" below), not rewrite any of its logic.

## Endpoints

All routes accept `multipart/form-data` and return JSON: `{ ok: true, ... }` on success, `{ ok: false, error: "..." }` on failure. File results come back as a public URL under `/files/...` — the frontend downloads them from there.

| Method | Path | Body fields | Response |
|---|---|---|---|
| POST | `/api/merge` | `files` (2+ PDFs) | `{ url }` |
| POST | `/api/split` | `file` | `{ urls: [...], pageCount }` — one PDF per page |
| POST | `/api/rotate` | `file`, `degrees` (90/180/270) | `{ url }` |
| POST | `/api/compress` | `file` | `{ url, originalSize, newSize }` |
| POST | `/api/watermark` | `file`, `text` | `{ url }` |
| POST | `/api/extract` | `file`, `ranges` (e.g. `1-3,5`) | `{ url }` |
| POST | `/api/delete-pages` | `file`, `pages` (e.g. `2,4`) | `{ url }` |
| POST | `/api/office-to-pdf` | `file` (docx/xlsx/pptx/odt) | `{ url }` |
| POST | `/api/pdf-to-office` | `file`, `format` (docx/odt/pptx/xlsx) | `{ url }` |
| POST | `/api/images-to-pdf` | `files` (jpg/png) | `{ url }` |
| POST | `/api/pdf-to-images` | `file`, optional `dpi` | `{ urls: [...], pageCount }` |
| POST | `/api/lock` | `file`, `password` | `{ url }` |
| POST | `/api/unlock` | `file`, `password` | `{ url }` |
| POST | `/api/ocr` | `file` (image or PDF), optional `lang` | `{ url }` — a `.txt` file |

Uploaded originals are deleted right after each request. Generated output files live in `public_files/` and are served statically — this is ephemeral storage, so files disappear if the container restarts. That's fine for on-demand downloads; don't rely on it as permanent storage.

## Why Docker

Several tools shell out to system binaries npm can't install: **LibreOffice** (Office⇄PDF), **Ghostscript**/`gs` (compression, PDF→image), **qpdf** (lock/unlock), **poppler-utils**/`pdftoppm` (PDF→image, OCR page rendering). The `Dockerfile` installs all of these via `apt-get`.

## Deploy to Fly.io (free tier)

```bash
fly launch     # answer prompts; say "no" to deploying immediately
fly secrets set ALLOWED_ORIGIN=https://rawasialqurum.github.io
fly deploy
fly status     # shows your live URL, e.g. https://your-app.fly.dev
```

If `fly launch` picks an oversized VM, edit the `[[vm]]` block in `fly.toml` to:
```toml
[[vm]]
  memory = '1gb'
  cpu_kind = 'shared'
  cpus = 1
```
then run `fly deploy` again. Also run `fly scale count 1` to avoid Fly spinning up 2 machines by default.

## Connect the frontend

In `folio-frontend/index.html`, find this line near the top of the `<script>` block:

```js
const BACKEND_URL = "https://steal-entry-favors-preference.trycloudflare.com";
```

Replace it with your deployed URL:

```js
const BACKEND_URL = "https://your-app.fly.dev";
```

Commit and push — every tool button in the workspace panel already calls the matching endpoint above, so no other frontend changes are needed.

## Local development

```bash
docker build -t folio-backend .
docker run -p 8080:8080 -e ALLOWED_ORIGIN=http://localhost:5500 folio-backend
```

Or without Docker (requires `libreoffice`, `ghostscript`, `qpdf`, `poppler-utils` installed locally):
```bash
npm install
npm run dev
```

## Limits & next steps

- Upload limit: 50MB/file, 20 files per request (`utils/upload.js`).
- OCR uses `tesseract.js` (pure JS) — fine for light use; swap in native `tesseract` CLI for heavier volume.
- No auth or rate-limiting yet — add before this is linked from a public, high-traffic page, since PDF/OCR/LibreOffice conversions are CPU-heavy.
- `pdf-to-office` quality depends on source complexity — scanned/complex-layout PDFs won't convert as cleanly as text-based ones.
- `public_files/` has no automatic cleanup job; on a long-running instance you may want a cron to delete files older than a few hours.
