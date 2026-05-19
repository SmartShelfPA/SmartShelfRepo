# IGCSE API (`/api/igcse/*`)

Study-agent generated content is served from the `igcse_catalog` Django app. There is **no live outbound call** to the former Open IGCSE / intfract API.

## Canonical routes

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/igcse/subjects/` | Published subjects |
| GET | `/api/igcse/chapters/?subject=` | Chapters for a subject |
| GET | `/api/igcse/sets/?subject=&chapter=` | Published generated sets |
| GET | `/api/igcse/sets/<uuid>/` | Set detail |
| POST | `/api/igcse/ingest/` | Admin ingest (pipeline output) |

## Temporary deprecated routes (HTTP 410)

Remove after the Expo app migrates off `topics` / `questions` / `search`:

| Path | Successor |
|------|-----------|
| `/api/igcse/topics/` | `/api/igcse/chapters/` |
| `/api/igcse/questions/` | `/api/igcse/sets/` |
| `/api/igcse/search/` | Browse subjects/chapters/sets |

## EPUB reader (separate prefix)

Authenticated book/reader APIs remain under `/api/v1/igcse/books/*` (`learning` app).

## Ingest

```bash
python manage.py ingest_igcse_set manifest.json --source-dir ./pipeline/out --publish-latest
```
