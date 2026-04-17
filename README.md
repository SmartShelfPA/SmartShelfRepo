# SmartShelfRepo

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