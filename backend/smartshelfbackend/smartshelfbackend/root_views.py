from django.http import HttpResponse


def api_root(_request):
    """Public landing page for the API host (avoids a bare 404 on `/`)."""
    return HttpResponse(
        """<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>SmartShelf API</title>
  <style>
    body { font-family: system-ui, -apple-system, Segoe UI, Roboto, sans-serif; line-height: 1.5; color: #1a1a1a; max-width: 560px; margin: 48px auto; padding: 0 20px; }
    h1 { font-size: 1.5rem; margin-bottom: 0.25rem; }
    .status { color: #0a7a2f; font-weight: 600; margin-bottom: 1.5rem; }
    a { color: #0a7a2f; }
    ul { padding-left: 1.25rem; }
    li { margin: 0.35rem 0; }
  </style>
</head>
<body>
  <h1>SmartShelf API</h1>
  <p class="status">Service is live</p>
  <p>This host serves the SmartShelf backend. Useful links:</p>
  <ul>
    <li><a href="/admin/">Admin</a></li>
    <li><a href="/privacy/">Privacy Policy</a></li>
    <li><a href="/terms/">Terms of Use</a></li>
    <li><a href="/api/v1/">API (v1)</a></li>
  </ul>
</body>
</html>
""",
        content_type="text/html; charset=utf-8",
    )
