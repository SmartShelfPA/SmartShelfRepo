# Sign-in, stay logged in, and real email

## Stay logged in (mobile app)

- On **Login**, toggle **Stay logged in** (default: on).
- When on, the auth token and profile are saved with AsyncStorage and restored on app restart.
- The app validates the token with `GET /api/auth/validate/` on startup.
- **Sign out** (Profile tab) clears the saved session.
- Turn **Stay logged in** off for shared devices — you will need to sign in again after closing the app.

## Sign up with a real email address

Registration already requires a valid **email** (`POST /api/auth/register/`). That email is stored on your account and used for password reset.

1. Open the app → **Sign Up** / **Register**.
2. Use a real email you can access (not a fake `@test.com` if you want reset emails).
3. Complete the form (student/parent, school, date of birth, etc.).

There is no separate “verify email” step yet; the address is used for account identity and password reset.

## Send real password-reset emails

By default, Docker uses the **console** email backend (codes appear in `docker compose logs backend`).

### Gmail (typical dev setup)

1. Copy `.env.example` → `.env` in `SmartShelfRepo/`.
2. Enable 2-Step Verification on the Google account.
3. Create an **App Password** (Google Account → Security → App passwords).
4. Set in `.env`:

```env
EMAIL_BACKEND=django.core.mail.backends.smtp.EmailBackend
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_HOST_USER=you@gmail.com
EMAIL_HOST_PASSWORD=your-16-char-app-password
EMAIL_USE_TLS=true
DEFAULT_FROM_EMAIL=you@gmail.com
```

5. Restart backend:

```bash
docker compose up -d --force-recreate backend
```

6. In the app: **Forgot password?** → enter the **same email as sign-up** → check inbox (and spam).

### Other providers

Use your provider’s SMTP host/port (SendGrid, Amazon SES, Microsoft 365, etc.) and set `EMAIL_BACKEND`, `EMAIL_HOST`, `EMAIL_PORT`, `EMAIL_HOST_USER`, `EMAIL_HOST_PASSWORD`, `EMAIL_USE_TLS`, `DEFAULT_FROM_EMAIL` accordingly.

## Quick test without SMTP

With console backend, request a reset in the app and read the 6-digit code from:

```bash
docker compose logs backend --tail 50
```

Then complete reset on the **Forgot password** screen.
