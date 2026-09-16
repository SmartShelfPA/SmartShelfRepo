"""Permanent desktop download endpoints.

Windows downloads are streamed from this host (HTTP 200, no client redirect)
so Microsoft Partner Center and other validators can use a stable package URL.
The upstream GitHub release URL is fetched server-side (redirects allowed there)
and optionally cached on disk.
"""

from __future__ import annotations

import hashlib
import logging
import os
import tempfile
import time
import urllib.error
import urllib.request
from pathlib import Path

from django.conf import settings
from django.http import FileResponse, HttpResponse, HttpResponseNotAllowed

logger = logging.getLogger(__name__)

# Re-fetch cached installers periodically so /latest/ picks up new releases.
_CACHE_TTL_SECONDS = int(os.getenv("DESKTOP_INSTALLER_CACHE_TTL_SECONDS", str(12 * 60 * 60)))
_CACHE_DIR = Path(
    os.getenv(
        "DESKTOP_INSTALLER_CACHE_DIR",
        str(Path(tempfile.gettempdir()) / "smartshelf-installers"),
    )
)

_WINDOWS_FILENAME = "SmartShelf-Setup.exe"
_MACOS_FILENAME = "SmartShelf.dmg"


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


def _cache_path(source_url: str, filename: str) -> Path:
    digest = hashlib.sha256(source_url.encode("utf-8")).hexdigest()[:20]
    return _CACHE_DIR / f"{digest}-{filename}"


def _ensure_cached(source_url: str, filename: str) -> Path:
    """Download upstream (following redirects) into a local cache file."""
    _CACHE_DIR.mkdir(parents=True, exist_ok=True)
    dest = _cache_path(source_url, filename)
    stale = True
    if dest.is_file() and dest.stat().st_size > 0:
        age = time.time() - dest.stat().st_mtime
        stale = age > _CACHE_TTL_SECONDS

    if not stale:
        return dest

    tmp = dest.with_suffix(dest.suffix + ".partial")
    try:
        logger.info("Caching desktop installer from %s -> %s", source_url, dest)
        # urlretrieve follows redirects; client never sees a 302.
        urllib.request.urlretrieve(source_url, tmp)  # nosec B310 — URL from trusted settings
        if not tmp.is_file() or tmp.stat().st_size < 1_000:
            raise RuntimeError("Downloaded installer is missing or too small")
        tmp.replace(dest)
    except Exception:
        if tmp.exists():
            try:
                tmp.unlink()
            except OSError:
                pass
        if dest.is_file() and dest.stat().st_size > 0:
            logger.exception("Installer refresh failed; serving previous cache")
            return dest
        raise
    return dest


def _file_download_response(request, *, source_url: str, filename: str):
    if request.method not in {"GET", "HEAD"}:
        return HttpResponseNotAllowed(["GET", "HEAD"])

    try:
        path = _ensure_cached(source_url, filename)
    except (urllib.error.URLError, OSError, RuntimeError) as exc:
        logger.exception("Failed to prepare installer %s", filename)
        return HttpResponse(
            f"Installer temporarily unavailable: {exc}",
            status=502,
            content_type="text/plain; charset=utf-8",
        )

    if request.method == "HEAD":
        response = HttpResponse(status=200)
        response["Content-Type"] = "application/octet-stream"
        response["Content-Length"] = str(path.stat().st_size)
        response["Content-Disposition"] = f'attachment; filename="{filename}"'
        response["Cache-Control"] = "public, max-age=3600"
        return response

    # FileResponse closes the file handle when the response finishes.
    handle = path.open("rb")
    response = FileResponse(handle, as_attachment=True, filename=filename)
    response["Content-Type"] = "application/octet-stream"
    response["Content-Length"] = str(path.stat().st_size)
    response["Cache-Control"] = "public, max-age=3600"
    return response


def download_windows(request):
    """Direct Windows installer — no HTTP redirect to the client."""
    return _file_download_response(
        request,
        source_url=_windows_url(),
        filename=_WINDOWS_FILENAME,
    )


def download_macos(request):
    """Direct macOS installer — no HTTP redirect to the client."""
    return _file_download_response(
        request,
        source_url=_macos_url(),
        filename=_MACOS_FILENAME,
    )


def download_page(_request):
    return HttpResponse(
        """<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Download SmartShelf</title>
  <style>
    body {
      font-family: system-ui, -apple-system, Segoe UI, Roboto, sans-serif;
      background: #000;
      color: #f2f2f2;
      margin: 0;
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 32px 16px;
    }
    .card {
      width: 100%;
      max-width: 420px;
      background: #161616;
      border: 1px solid #2a2a2a;
      border-radius: 16px;
      padding: 28px;
    }
    h1 { margin: 0 0 8px; font-size: 1.6rem; }
    p { color: #bdbdbd; line-height: 1.5; }
    a.btn {
      display: block;
      text-align: center;
      text-decoration: none;
      background: #00FF41;
      color: #111;
      font-weight: 800;
      border-radius: 999px;
      padding: 14px 16px;
      margin-top: 12px;
    }
    a.secondary { background: #2a2a2a; color: #f2f2f2; }
    .note { font-size: 0.85rem; color: #8d8d8d; margin-top: 16px; }
  </style>
</head>
<body>
  <div class="card">
    <h1>Download SmartShelf</h1>
    <p>Windows and Mac desktop app for textbooks, offline reading, and practice.</p>
    <a class="btn" href="/download/windows">Download for Windows</a>
    <a class="btn secondary" href="/download/macos">Download for Mac</a>
    <p class="note">These links serve the installer directly (no redirects).</p>
  </div>
</body>
</html>
""",
        content_type="text/html; charset=utf-8",
    )
