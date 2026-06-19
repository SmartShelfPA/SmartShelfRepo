"""
Import EPUBs for Django admin using vendored epub_downloader (MIT, mcombeau/epub_downloader).

Supports epub.pub, readanybook.com, and remote exploded EPUB archive URLs — see:
https://github.com/mcombeau/epub_downloader
"""

from __future__ import annotations

import sys
from pathlib import Path
from tempfile import TemporaryDirectory

VENDOR_ROOT = Path(__file__).resolve().parents[3] / "vendor" / "epub_downloader"
if str(VENDOR_ROOT) not in sys.path:
    sys.path.insert(0, str(VENDOR_ROOT))


class EpubImportError(Exception):
    """Raised when the vendored downloader cannot build an EPUB."""


def fetch_epub_bytes(source_url: str) -> tuple[bytes, str]:
    """
    Download and assemble an EPUB from a supported source page or archive URL.

    Returns (file_bytes, suggested_filename).
    """
    url = (source_url or "").strip().rstrip("/")
    if not url:
        raise EpubImportError("Import URL is empty.")
    if not url.startswith(("http://", "https://")):
        raise EpubImportError("Import URL must start with http:// or https://")

    import src.file_manager.file_manager as fm_module
    from src.epub_file_downloader.epub_file_downloader import EpubFileDownloader
    from src.epub_locator.epub_locator import EpubLocator
    from src.logster.logster import Logster

    previous_output_dir = fm_module.OUTPUT_DIR

    try:
        with TemporaryDirectory(prefix="smartshelf-epub-import-") as tmp:
            fm_module.OUTPUT_DIR = tmp
            logger = Logster(verbose=False)
            locator = EpubLocator(logger, url)
            base_url = locator.get_epub_base_url()
            ebook_name = locator.get_ebook_name()
            if not ebook_name:
                raise EpubImportError("Could not determine ebook name from the source URL.")

            downloader = EpubFileDownloader(logger, base_url, ebook_name)
            downloader.download_epub_files()

            epub_path = Path(tmp) / f"{ebook_name}.epub"
            if not epub_path.is_file():
                raise EpubImportError(
                    "Download finished but no .epub file was created. "
                    "Check that the URL is a supported epub.pub / readanybook page or "
                    "a direct remote EPUB archive base URL."
                )

            safe_name = "".join(c if c.isalnum() or c in "-_" else "_" for c in ebook_name)
            filename = f"{safe_name or 'imported'}.epub"
            return epub_path.read_bytes(), filename
    except EpubImportError:
        raise
    except Exception as exc:
        raise EpubImportError(f"EPUB import failed: {exc}") from exc
    finally:
        fm_module.OUTPUT_DIR = previous_output_dir
