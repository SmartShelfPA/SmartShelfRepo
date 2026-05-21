/**
 * Inline EPUB reader document for `react-native-webview`.
 * Uses epub.js in the WebView (Expo-compatible; no native EPUB bindings).
 *
 * Expo Go: works with `react-native-webview` + remote epub.js CDN + epub.js fetching the EPUB URL.
 * A custom dev build is not required unless you switch to native Readium bindings later.
 *
 * Reliability:
 * - Master timeout always posts `ready` so the native "Preparing EPUB" overlay cannot hang forever.
 * - `ready` is sent only after first successful `display()` (or after error/timeout) so `rendition.next` is safe.
 */
export function buildEpubReaderHtml(epubUrl: string, initialStartCfi?: string | null): string {
  const urlJson = JSON.stringify(epubUrl);
  const cfiJson = JSON.stringify(initialStartCfi ?? '');

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no" />
  <script src="https://cdn.jsdelivr.net/npm/epubjs@0.3.93/dist/epub.min.js"></script>
  <style>
    html, body { margin: 0; padding: 0; height: 100%; width: 100%; overflow: hidden; }
    #viewer { height: 100%; width: 100%; min-height: 200px; }
  </style>
</head>
<body>
  <div id="viewer"></div>
  <script>
    (function () {
      var epubUrl = ${urlJson};
      var initialCfi = ${cfiJson};
      var readySent = false;
      var masterTimer = null;
      var book = null;
      var rendition = null;

      function send(payload) {
        try {
          if (window.ReactNativeWebView && window.ReactNativeWebView.postMessage) {
            window.ReactNativeWebView.postMessage(JSON.stringify(payload));
          }
        } catch (e) {}
      }

      function finishOpen(errMsg) {
        if (readySent) return;
        readySent = true;
        try {
          if (masterTimer) clearTimeout(masterTimer);
        } catch (e0) {}
        if (errMsg) {
          send({ type: 'error', message: String(errMsg) });
        }
        send({ type: 'ready' });
      }

      send({ type: 'debug', message: 'EPUB URL: ' + epubUrl });

      masterTimer = setTimeout(function () {
        finishOpen('EPUB engine timed out (50s). The file may be unreachable, blocked, or too heavy for this WebView.');
      }, 50000);

      try {
        if (!window.ePub) {
          finishOpen('epub.js failed to load from CDN.');
          return;
        }

        function viewerSize() {
          var w = Math.floor(window.innerWidth || document.documentElement.clientWidth || 360);
          var h = Math.floor(window.innerHeight || document.documentElement.clientHeight || 480);
          return { w: Math.max(w, 200), h: Math.max(h, 200) };
        }

        var sz = viewerSize();
        book = ePub(epubUrl);
        rendition = book.renderTo('viewer', {
          width: sz.w,
          height: sz.h,
          spread: 'none',
          flow: 'scrolled-doc'
        });

        rendition.on('relocated', function (location) {
          var pct = 0;
          var chapterHref = undefined;
          try {
            if (location && location.start && typeof location.start.percentage === 'number') {
              pct = Math.max(0, Math.min(1, location.start.percentage));
            }
          } catch (e) {}
          try {
            if (location && location.start && location.start.href) {
              chapterHref = String(location.start.href);
            }
          } catch (e2) {}
          send({
            type: 'relocated',
            fraction: pct,
            startCfi: location && location.start ? location.start.cfi : undefined,
            endCfi: location && location.end ? location.end.cfi : undefined,
            chapterHref: chapterHref
          });
        });

        function safeNext() {
          try {
            if (rendition && rendition.manager && typeof rendition.manager.next === 'function') {
              rendition.next();
            } else {
              send({ type: 'error', message: 'Reader is still opening — try again in a moment.' });
            }
          } catch (e) {
            send({ type: 'error', message: String(e && e.message ? e.message : e) });
          }
        }

        function safePrev() {
          try {
            if (rendition && rendition.manager && typeof rendition.manager.prev === 'function') {
              rendition.prev();
            } else {
              send({ type: 'error', message: 'Reader is still opening — try again in a moment.' });
            }
          } catch (e) {
            send({ type: 'error', message: String(e && e.message ? e.message : e) });
          }
        }

        function firstDisplay() {
          if (initialCfi && initialCfi.length > 0) {
            return rendition.display(initialCfi).catch(function () {
              send({ type: 'debug', message: 'Saved CFI failed; opening from start.' });
              return rendition.display();
            });
          }
          return rendition.display();
        }

        book.ready
          .then(function () {
            var toc = book.navigation && book.navigation.toc ? book.navigation.toc : [];
            send({ type: 'toc', toc: toc });
            return firstDisplay();
          })
          .then(function () {
            setTimeout(function () {
              try {
                var s2 = viewerSize();
                if (rendition && typeof rendition.resize === 'function') {
                  rendition.resize(s2.w, s2.h);
                }
              } catch (e4) {}
            }, 150);
            finishOpen(null);
          })
          .catch(function (err) {
            finishOpen(String(err && err.message ? err.message : err));
          });

        window.smartshelfReceive = function (msgJson) {
          try {
            if (!rendition) return;
            var msg = JSON.parse(msgJson);
            if (!msg || !msg.action) return;
            if (msg.action === 'next') safeNext();
            if (msg.action === 'prev') safePrev();
            if (msg.action === 'font' && msg.scale) {
              var pct = Math.round(Math.max(85, Math.min(160, msg.scale * 100)));
              rendition.themes.fontSize(pct + '%');
            }
            if (msg.action === 'theme') {
              if (msg.mode === 'dark') {
                rendition.themes.override({
                  body: { background: '#121212', color: '#ececec' },
                  p: { color: '#ececec' },
                  div: { color: '#ececec' }
                });
              } else {
                rendition.themes.override({
                  body: { background: '#ffffff', color: '#111111' },
                  p: { color: '#111111' },
                  div: { color: '#111111' }
                });
              }
            }
            if (msg.action === 'goto_cfi' && msg.cfi) {
              rendition.display(msg.cfi);
            }
            if (msg.action === 'goto_href' && msg.href) {
              rendition.display(msg.href);
            }
          } catch (e) {
            send({ type: 'error', message: String(e) });
          }
        };
      } catch (syncErr) {
        finishOpen(String(syncErr && syncErr.message ? syncErr.message : syncErr));
      }
    })();
  </script>
</body>
</html>`;
}
