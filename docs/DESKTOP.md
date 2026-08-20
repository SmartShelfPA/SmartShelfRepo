# SmartShelf Desktop (Windows + Mac)

SmartShelf desktop is the Expo web app inside an **Electron** shell, with a SoundCloud-style layout: sidebar, search, My Shelf, and a persistent **Now Reading** bar. It uses the same Django API as the mobile app:

`https://smartshelf-api.onrender.com/api`

This is an evolved shell, not a second React app. If Expo web cannot carry a real desktop layout later, the chrome and download bridge can move into a standalone Vite client that still talks to the same API.

## Prerequisites

- Node.js 20+
- From `frontend/smartshelf`: `npm install`
- **Windows builds:** run on Windows (or CI Windows runner)
- **Mac builds / signing:** run on macOS (Apple Developer ID required for Gatekeeper)

## Development

```powershell
cd frontend\smartshelf
npm run desktop:dev
```

This starts Expo web on port `8081` and opens a wide Electron window pointed at it.

You can also use the browser only (wide windows get the same chrome at 960px+):

```powershell
npm run web
```

## Desktop UX

| Control | Action |
|---------|--------|
| Sidebar | Home, My Shelf, Downloads, IGCSE, Practice, Profile |
| `Ctrl/Cmd + K` | Search textbooks and destinations |
| `Ctrl/Cmd + B` | Collapse / expand sidebar |
| `Ctrl/Cmd + R` | Resume Now Reading |
| Now Reading bar | Book title, progress, Resume — hidden in the focused reader |

Home shows **Continue Reading** and **Recently opened**. Downloaded PDFs are stored in Electron's app data directory (`userData/protected_pdfs`), not IndexedDB, and not in the user's public Downloads folder.

## Production installers

### Windows (`.exe` NSIS)

```powershell
cd frontend\smartshelf
npm run desktop:build
```

Output: `frontend/smartshelf/desktop-release/SmartShelf-Setup.exe`

The filename stays the same every release so WordPress can use a permanent link.

### Mac (`.dmg`)

On a Mac:

```bash
cd frontend/smartshelf
npm run desktop:build:mac
```

Output: `frontend/smartshelf/desktop-release/SmartShelf.dmg`

## Permanent website download (WordPress)

Do **not** upload the `.exe` into WordPress (file-type blocks, size limits, malware scanners). Put a Download button on the site that points at these URLs:

| Button | Permanent URL |
|--------|----------------|
| Windows | `https://smartshelf-api.onrender.com/download/windows` |
| Mac | `https://smartshelf-api.onrender.com/download/macos` |
| Chooser page | `https://smartshelf-api.onrender.com/download/` |

Those URLs never change. They redirect to the latest GitHub Release asset:

- `https://github.com/SmartShelfPA/SmartShelfRepo/releases/latest/download/SmartShelf-Setup.exe`
- `https://github.com/SmartShelfPA/SmartShelfRepo/releases/latest/download/SmartShelf.dmg`

**The GitHub repo must be public** (or the release assets public) for visitors to download. If the repo stays private, host the two files on Cloudflare R2 / S3 and set Render env vars:

```env
DESKTOP_DOWNLOAD_WINDOWS_URL=https://downloads.smartshelflearn.com/SmartShelf-Setup.exe
DESKTOP_DOWNLOAD_MACOS_URL=https://downloads.smartshelflearn.com/SmartShelf.dmg
```

WordPress still uses `/download/windows` — only the redirect target changes.

### Publish a new Windows build

```powershell
cd frontend\smartshelf
npm run desktop:build
gh release create v1.0.1 "desktop-release/SmartShelf-Setup.exe" --title "SmartShelf 1.0.1" --notes "Desktop installer"
```

Use the same asset names every time (`SmartShelf-Setup.exe`, `SmartShelf.dmg`). GitHub `/releases/latest/download/...` only stays stable if the filename does not include a version number.`

### Unpackaged smoke test

```powershell
npm run desktop:build:dir
```

## macOS signing & notarization

Unsigned `.dmg` files are blocked by Gatekeeper. For distribution:

1. Enroll in the Apple Developer Program.
2. Create a **Developer ID Application** certificate.
3. Set electron-builder env vars before `desktop:build:mac`, for example:

```bash
export CSC_LINK=/path/to/certs.p12
export CSC_KEY_PASSWORD=...
export APPLE_ID=you@example.com
export APPLE_APP_SPECIFIC_PASSWORD=...
export APPLE_TEAM_ID=W92HNG95F7
```

4. Run `npm run desktop:build:mac` — electron-builder will sign and (when configured) notarize.

See [electron-builder code signing](https://www.electron.build/code-signing.html).

## What works vs mobile

| Area | Desktop |
|------|---------|
| Login / signup / API | Same Render backend |
| Navigation | Sidebar + shortcuts (tab bar hidden) |
| PDF (IGCSE + viewer) | PDF.js in iframe |
| EPUB / simulator | iframe adapters (`.web.tsx`) |
| Protected downloads | Electron `userData/protected_pdfs` (browser web still uses IndexedDB) |
| Profile avatar | data URL in storage |
| Haptics / orientation | no-op on web |

## Troubleshooting

- **Blank Electron window in dev:** wait for Expo web to finish bundling; confirm `http://127.0.0.1:8081` loads in a browser.
- **API errors:** desktop export bakes in `EXPO_PUBLIC_API_BASE_URL`; rebuild after changing it.
- **Mac “app is damaged”:** unsigned build — right-click Open once, or sign/notarize for users.
