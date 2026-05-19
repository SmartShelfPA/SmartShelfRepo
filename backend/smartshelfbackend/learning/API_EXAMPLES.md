# Learning API — example responses

Base URL prefix (with default Django routing): `/api/v1/…`  
Auth: `Authorization: Bearer <token>` (same token issued by `/api/auth/login/`).

## GET `/api/v1/igcse/books/`

Returns an array of IGCSE EPUB catalog items. Progress fields are filled when the user has reading state.

```json
[
  {
    "id": "b2f6…",
    "title": "Cambridge IGCSE Mathematics",
    "subject": "Mathematics",
    "author": "…",
    "description": "…",
    "cover_image_url": "https://…",
    "epub_url": "https://…/book.epub",
    "toc_json": [],
    "extra_metadata": {},
    "progress_percent": 37.5,
    "last_read_at": "2026-05-02T12:00:00Z"
  }
]
```

## GET `/api/v1/igcse/books/<uuid>/`

Same fields as list, plus `updated_at` on the book record.

## PUT/PATCH `/api/v1/igcse/books/<uuid>/progress/`

Request body:

```json
{
  "fraction": 0.42,
  "start_cfi": "epubcfi(/6/4[chap]!/4/…)",
  "updated_at": "2026-05-02T12:00:00Z"
}
```

Response:

```json
{
  "book_id": "b2f6…",
  "fraction": 0.42,
  "start_cfi": "epubcfi(…)",
  "updated_at": "2026-05-02T12:00:05Z",
  "progress_percent": 42.0
}
```

## GET `/api/v1/practice/waec/questions/?subject=chemistry&year=2010`

Returns a JSON **array** of normalized questions (same schema for WAEC/JAMB):

```json
[
  {
    "id": "aloc-…",
    "exam_type": "WAEC",
    "subject": "chemistry",
    "year": 2010,
    "prompt_html": "<p>…</p>",
    "options": [
      { "id": "A", "label_html": "<p>…</p>" },
      { "id": "B", "label_html": "<p>…</p>" }
    ],
    "correct_option_id": "B",
    "explanation_html": "<p>…</p>",
    "order_index": 0,
    "source": { "provider": "aloc", "raw_keys": ["question", "option"] }
  }
]
```

## GET `/api/v1/dashboard/`

```json
{
  "current_igcse_book": {
    "id": "…",
    "title": "…",
    "subject": "…",
    "epub_url": "https://…",
    "progress_percent": 12.0,
    "last_read_at": "2026-05-02T11:00:00Z"
  },
  "books": [
    {
      "book": { "id": "…", "title": "…", "epub_url": "https://…" },
      "progress_percent": 12.0,
      "last_read_at": "2026-05-02T11:00:00Z"
    }
  ],
  "recent_sessions": [
    {
      "id": "…",
      "exam_type": "WAEC",
      "subject": "chemistry",
      "year": 2010,
      "status": "completed",
      "score_percent": 72.0,
      "correct_count": 29,
      "answered_count": 40,
      "duration_seconds": 1200,
      "started_at": "…",
      "ended_at": "…"
    }
  ],
  "averages_by_exam": [
    { "exam_type": "WAEC", "average_percent": 68.5, "session_count": 4 },
    { "exam_type": "JAMB", "average_percent": 74.0, "session_count": 2 }
  ],
  "completed_sessions": 6,
  "in_progress_sessions": 1,
  "last_activity_at": "2026-05-02T12:30:00Z"
}
```
