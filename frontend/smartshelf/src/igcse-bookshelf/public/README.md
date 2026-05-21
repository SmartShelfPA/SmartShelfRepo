# public

Static assets for the IGCSE reader and any web-backed surfaces:

- **scripts/** — extracted or vendor JS (when not loaded from CDN inline).
- **stylesheets/** — shared CSS for reader themes / layouts.

The EPUB WebView currently inlines script and style via `views/buildEpubReaderHtml.ts`; move pieces here when you split them out.
