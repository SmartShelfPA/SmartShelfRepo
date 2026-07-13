# Mobile app API URL (schools, sign-up, login)

Release builds (EAS / APK) **bake in** `EXPO_PUBLIC_API_BASE_URL` at build time.  
If that points to `http://192.168.x.x:8000` or `localhost`, phones on other networks will see:

> Could not reach SmartShelf API … Network request failed

Schools load from `GET /api/auth/organizations/` (includes **Default School** after migrations). The data is fine — the phone cannot reach your PC.

---

## Do you need to rebuild?

**Yes — one new Android build** after you set a **public** API URL. You do not need to rewrite the app; run `eas build` again (or convert the new AAB to APK).

---

## Option A — ngrok (fastest for testing)

### 1. Start backend

```powershell
cd SmartShelfRepo
docker compose up -d
docker compose exec backend python manage.py migrate
```

### 2. Start ngrok tunnel

Add `NGROK_AUTHTOKEN` to `SmartShelfRepo\.env`, then:

```powershell
docker compose --profile tunnel up -d
```

Open http://localhost:4040 and copy the **HTTPS** URL, e.g.  
`https://abc123.ngrok-free.app`

### 3. Verify schools in a browser

```
https://abc123.ngrok-free.app/api/auth/organizations/
```

You should see JSON including `"slug": "default-school"`.

### 4. Set EAS secret and rebuild

```powershell
cd frontend\smartshelf
eas secret:create --name EXPO_PUBLIC_API_BASE_URL --value "https://abc123.ngrok-free.app/api" --force

eas build --platform android --profile preview
```

Use `preview` with `buildType: apk` in `eas.json` if you want an APK directly.

### 5. Install the new build

Uninstall the old APK first if install fails (different signature).

**Note:** ngrok free URLs change when you restart the tunnel → you must update the secret and rebuild, or use a paid static domain.

---

## Option B — Same WiFi only (no rebuild, maybe)

If your APK was built with `EXPO_PUBLIC_API_BASE_URL=http://192.168.1.72:8000/api`:

1. Phone and PC on the **same Wi‑Fi**
2. Backend running on the PC
3. Windows firewall allows port **8000**

Then schools may load **without** a new build. This does **not** work on mobile data or other networks.

---

## Option C — Real production host

Deploy Django (Railway, Render, VPS, etc.) and set:

```powershell
eas secret:create --name EXPO_PUBLIC_API_BASE_URL --value "https://api.smartshelf.ng/api" --force
eas build --platform android --profile production
```

---

## Default school in the database

Migration `users.0004_default_organization` creates:

- **Name:** Default School  
- **Slug:** `default-school`

Registration auto-selects this when the API responds. No extra admin setup required.

---

## Checklist

| Step | Done? |
|------|--------|
| `docker compose up -d` | |
| `migrate` run | |
| `/api/auth/organizations/` works in browser | |
| `EXPO_PUBLIC_API_BASE_URL` set in EAS secrets (HTTPS public URL) | |
| New `eas build` installed on phone | |
