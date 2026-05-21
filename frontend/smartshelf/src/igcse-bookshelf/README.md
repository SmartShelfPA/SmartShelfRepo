# IGCSE bookshelf

Domain layout for the IGCSE hub (EPUB reader, revision, and course-aligned content).

```
igcse-bookshelf/
├── docs/                   # Upstream / API reference notes (not bundled into the app)
├── public/                 # Static scripts and stylesheets (WebView / web assets)
│   ├── scripts/
│   └── stylesheets/
├── views/                  # Templates & UI widgets (React components, HTML string builders)
└── courses/                # Subjects and course-specific content
    ├── biology/
    ├── chemistry/
    ├── computer_science/
    ├── mathematics/
    └── physics/
```

- **Upstream API reference:** see `docs/open-igcse-api-features.md` (questions `/api/questions`, revision notes status).

Expo Router screens stay under `app/igcse/`; shared IGCSE library code lives here.
