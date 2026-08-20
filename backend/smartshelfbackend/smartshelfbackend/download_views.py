from django.conf import settings
from django.http import HttpResponse, HttpResponseRedirect


def _windows_url() -> str:
    return getattr(
        settings,
        "DESKTOP_DOWNLOAD_WINDOWS_URL",
        "https://github.com/SmartShelfPA/SmartShelfRepo/releases/latest/download/SmartShelf-Setup.exe",
    )


def _macos_url() -> str:
    return getattr(
        settings,
        "DESKTOP_DOWNLOAD_MACOS_URL",
        "https://github.com/SmartShelfPA/SmartShelfRepo/releases/latest/download/SmartShelf.dmg",
    )


def download_windows(_request):
    """Permanent WordPress/button target — always the latest Windows installer."""
    return HttpResponseRedirect(_windows_url())


def download_macos(_request):
    """Permanent WordPress/button target — always the latest macOS installer."""
    return HttpResponseRedirect(_macos_url())


def download_page(_request):
    windows = _windows_url()
    macos = _macos_url()
    return HttpResponse(
        f"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Download SmartShelf</title>
  <style>
    body {{
      font-family: system-ui, -apple-system, Segoe UI, Roboto, sans-serif;
      background: #000;
      color: #f2f2f2;
      margin: 0;
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 32px 16px;
    }}
    .card {{
      width: 100%;
      max-width: 420px;
      background: #161616;
      border: 1px solid #2a2a2a;
      border-radius: 16px;
      padding: 28px;
    }}
    h1 {{ margin: 0 0 8px; font-size: 1.6rem; }}
    p {{ color: #bdbdbd; line-height: 1.5; }}
    a.btn {{
      display: block;
      text-align: center;
      text-decoration: none;
      background: #00FF41;
      color: #111;
      font-weight: 800;
      border-radius: 999px;
      padding: 14px 16px;
      margin-top: 12px;
    }}
    a.secondary {{ background: #2a2a2a; color: #f2f2f2; }}
    .note {{ font-size: 0.85rem; color: #8d8d8d; margin-top: 16px; }}
  </style>
</head>
<body>
  <div class="card">
    <h1>Download SmartShelf</h1>
    <p>Windows and Mac desktop app for textbooks, offline reading, and practice.</p>
    <a class="btn" href="/download/windows">Download for Windows</a>
    <a class="btn secondary" href="/download/macos">Download for Mac</a>
    <p class="note">WordPress can link these URLs permanently. Direct files:
      <a href="{windows}" style="color:#00FF41">Windows</a> ·
      <a href="{macos}" style="color:#00FF41">Mac</a>
    </p>
  </div>
</body>
</html>
""",
        content_type="text/html; charset=utf-8",
    )
