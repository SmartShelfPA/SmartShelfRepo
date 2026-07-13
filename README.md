# SmartShelfRepo

## Run backend with Docker Compose

From the repository root:

```bash
docker compose up --build
```

Backend API: `http://localhost:8000`  
PostgreSQL: `localhost:5432` (`postgres` / `postgres`, db `smartshelf`)

### Mobile APK / schools not loading on sign-up

Release builds need a **public** API URL (not `192.168.x.x`). See [docs/MOBILE_API_SETUP.md](docs/MOBILE_API_SETUP.md).

### IGCSE exam simulator (study agent pipeline)

Windows setup for [igcse-study-agent](https://github.com/deepakp1308/igcse-study-agent) (past papers → practice PDFs → static simulator):

- Full guide: [docs/IGCSE_STUDY_AGENT_WINDOWS.md](docs/IGCSE_STUDY_AGENT_WINDOWS.md)
- One-shot bootstrap: `.\scripts\windows\setup-igcse-study-agent.ps1`
- App env (`frontend/smartshelf/.env`): `EXPO_PUBLIC_IGCSE_SIMULATOR_BASE_URL`, optional `EXPO_PUBLIC_IGCSE_SIMULATOR_DEFAULT_SET`

To stop:

```bash
docker compose down
```

To stop and remove database volume:

```bash
docker compose down -v
```

from SmartShelfRepo folder (in terminal)
    for the backend:
        create a virtual environment (if you havent already). 
            navigate to the backend folder (cd backend in terminal)
            enter the command : (python -m venv venv) in terminal
            enter the command : venv/Scripts/activate in terminal

        install necessary packages using command: (pip install -r requirements.txt)
        
        navigate to the smartshelfbackend folder command: (cd smartshelfbackend or cd backend/smartshelfbackend) in terminal

        enter the command: (python manage.py runserver) in terminal

    for the frontend:
        navigate to the smartshelf folder
            command: (cd frontend/smartshelf) in terminal
        
        enter the command (npm install) to download any necessary packages

        enter the command (npx expo start) to run the frontend

        enter w in terminal to access the web ui

### Android SDK (for native builds)

Set the Android SDK path so Gradle can find it.

**Option 1 – Environment variable (recommended)**

In PowerShell (run as Administrator or for current user):

```powershell
[System.Environment]::SetEnvironmentVariable("ANDROID_HOME", "C:\Users\theso\AppData\Local\Android\Sdk", "User")
```

Replace `theso` with your Windows username if different. Restart the terminal after setting.

**Option 2 – local.properties (after prebuild)**

After running `npx expo prebuild`, create `frontend/smartshelf/android/local.properties`:

```
sdk.dir=C\:\\Users\\theso\\AppData\\Local\\Android\\Sdk
```

Replace `theso` with your Windows username. Use double backslashes (`\\`) in the path. You can copy `frontend/smartshelf/local.properties.example` and edit the path.