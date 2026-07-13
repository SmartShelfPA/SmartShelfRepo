# IGCSE Study Agent — Windows quickstart (SmartShelf)

Pipeline repo: [deepakp1308/igcse-study-agent](https://github.com/deepakp1308/igcse-study-agent)  
Runs on your PC; only the built **static simulator** (+ PDFs you choose to publish) is loaded by the SmartShelf app.

---

## Prerequisites

| Tool | Install |
|------|---------|
| **Python 3.11 or 3.12** | [python.org](https://www.python.org/downloads/) — check **“Add python to PATH”** |
| **Node.js 20+** | [nodejs.org](https://nodejs.org/) |
| **Git** | [git-scm.com](https://git-scm.com/download/win) |
| **Cursor** (recommended) | For agent steps (`match`, `generate-paper`, etc.) per upstream [AGENT_SOP.md](https://github.com/deepakp1308/igcse-study-agent/blob/main/AGENT_SOP.md) |

> Python 3.13 can break the `lxml` dependency per upstream notes — prefer 3.11/3.12.

---

## 1. Clone and open the pipeline

**PowerShell:**

```powershell
cd $env:USERPROFILE\Desktop
git clone https://github.com/deepakp1308/igcse-study-agent.git
cd igcse-study-agent
```

Use any folder; avoid paths with spaces if you hit tooling issues.

---

## 2. Python virtual environment (Windows)

**PowerShell** (from `igcse-study-agent` root):

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install --upgrade pip
pip install -e ".[dev]"
```

If activation is blocked:

```powershell
Set-ExecutionPolicy -Scope CurrentUser RemoteSigned
```

**Command Prompt (cmd.exe)** alternative:

```cmd
python -m venv .venv
.venv\Scripts\activate.bat
pip install -e ".[dev]"
```

Verify:

```powershell
igcse --help
```

---

## 3. Simulator frontend (npm)

```powershell
cd simulator
npm install
cd ..
```

---

## 4. Folder layout for inputs

Use two folders anywhere on disk, e.g.:

```
C:\igcse-data\papers\
  chemistry\
    0620_12_2018.pdf
    0620_42_2019.pdf
  physics\
    ...

C:\igcse-data\chapters\
  chemistry\
    The Mole\
      01-slide1.png
      02-slide2.png
    Electrolysis\
      ...
  physics\
    ...
```

Subject folder names are free-form (`chemistry`, `physics`, …). Chapter folder names must match what you pass to CLI flags later (`"The Mole"`).

---

## 5. Ingest past papers (render + agent extraction)

```powershell
.\.venv\Scripts\Activate.ps1
igcse ingest-papers --papers-dir C:\igcse-data\papers
```

The CLI renders PDF pages to cache and prints **agent instructions**. In Cursor, complete per-page extraction (`igcse save-questions`, etc.) as described in upstream `AGENT_SOP.md`.

---

## 6. Ingest chapter slides (profiles)

```powershell
igcse ingest-chapters --chapters-dir C:\igcse-data\chapters
```

Same pattern: agent reads screenshots and saves profiles via `igcse save-chapter`.

---

## 7. Match, generate PDFs, build simulator

Example for **Chemistry / The Mole**:

```powershell
igcse match --subject chemistry --chapter "The Mole"
# Agent: MatchDecision per question → igcse save-match

igcse generate-paper --subject chemistry --chapter "The Mole"
# → output\practice_paper_chemistry_the-mole_<timestamp>.pdf

igcse generate-solutions --subject chemistry --chapter "The Mole"
# → output\solutions_chemistry_the-mole_<timestamp>.pdf

igcse build-simulator --subject chemistry --chapter "The Mole"
# → sets\chemistry-the-mole.json + npm run build in simulator/
```

Set slug for the URL is typically `chemistry-the-mole` (subject + chapter, normalized).

---

## 8. Deploy simulator (GitHub Pages)

1. Push your fork of `igcse-study-agent` to GitHub.
2. Enable **Pages** (source: GitHub Actions — see repo `.github/workflows/deploy-pages.yml`).
3. After deploy, the student URL is:

```
https://<your-github-user>.github.io/igcse-study-agent/?set=chemistry-the-mole
```

Test in a browser before opening in SmartShelf.

---

## 9. Connect to the SmartShelf app

### A. In-app WebView (exam simulator)

In `frontend/smartshelf/.env`:

```env
# Base URL of your deployed static simulator (trailing slash optional)
EXPO_PUBLIC_IGCSE_SIMULATOR_BASE_URL=https://YOUR-USER.github.io/igcse-study-agent/

# Optional: default set when opening “Exam simulator” from the IGCSE hub
EXPO_PUBLIC_IGCSE_SIMULATOR_DEFAULT_SET=chemistry-the-mole
```

Restart Expo after changing env:

```powershell
cd SmartShelfRepo\frontend\smartshelf
npx expo start --host lan
```

- **IGCSE → Study resources → chapter** uses the catalog `simulator_public_url` when published in Django.
- If only `simulator_set_id` is stored, the app builds  
  `{EXPO_PUBLIC_IGCSE_SIMULATOR_BASE_URL}?set={simulator_set_id}`.

### B. Practice PDFs + solutions in SmartShelf

Use Django **IGCSE catalog** admin (`igcse_catalog`) to ingest/publish generated sets (practice paper, worked solutions, simulator metadata). The revision flow serves PDFs from your backend media URLs.

---

## 10. Local simulator dev (optional)

Serve the built simulator on your LAN for phone testing:

```powershell
cd igcse-study-agent\simulator
npm run build
npx vite preview --host 0.0.0.0 --port 4173
```

Then set:

```env
EXPO_PUBLIC_IGCSE_SIMULATOR_BASE_URL=http://192.168.1.72:4173/
EXPO_PUBLIC_IGCSE_SIMULATOR_DEFAULT_SET=chemistry-the-mole
```

(Replace `192.168.1.72` with your PC’s LAN IP — same idea as `EXPO_PUBLIC_API_BASE_URL`.)

---

## Troubleshooting (Windows)

| Issue | Fix |
|-------|-----|
| `igcse` not found | Activate venv: `.\.venv\Scripts\Activate.ps1` |
| `pip install -e ".[dev]"` fails on lxml | Use Python 3.11/3.12; install [VS Build Tools](https://visualstudio.microsoft.com/visual-cpp-build-tools/) if needed |
| Long paths / spaces | Use short paths like `C:\igcse-data\` |
| Simulator blank in app | Open the full URL in mobile Safari; confirm `?set=` matches a file under `simulator/dist` / published Pages |
| CORS / LAN | WebView loads HTTPS GitHub Pages reliably; for LAN preview use `http://<PC-IP>:4173` |

---

## Privacy

Past papers and chapter screenshots stay on your machine during ingestion. Only what you publish (static simulator bundle + URLs you configure) is visible to students in the app.
