# SmartShelf billing (Stripe)

Student, micro-transaction, and diaspora tiers checkout through **Stripe Checkout**. The mobile app, desktop shell, and web client all call the same Django API.

## One-time setup (≈10 minutes)

### 1. Stripe account

1. Sign in at [dashboard.stripe.com](https://dashboard.stripe.com).
2. Turn on **Test mode** (toggle top-right) for your first run.
3. Go to **Developers → API keys** and copy the **Secret key** (`sk_test_...` or `sk_live_...`).

### 2. Create catalog + webhook automatically

From the repo root (Docker backend or local venv with `stripe` installed):

```bash
cd backend/smartshelfbackend
export STRIPE_SECRET_KEY=sk_test_xxxxxxxx
python manage.py setup_stripe
```

This creates all SmartShelf products/prices and registers the production webhook. It prints env vars — copy the whole block.

Re-running is safe; existing products/prices are reused.

Dry run (no API calls):

```bash
python manage.py setup_stripe --dry-run
```

### 3. Render (production API)

1. Open [Render Dashboard](https://dashboard.render.com) → **smartshelf-api** → **Environment**.
2. Paste the variables from step 2:
   - `STRIPE_SECRET_KEY`
   - `STRIPE_WEBHOOK_SECRET`
   - `STRIPE_CHECKOUT_SUCCESS_URL` / `STRIPE_CHECKOUT_CANCEL_URL`
   - All `STRIPE_PRICE_*` IDs
3. **Save** and wait for redeploy (migrations include `users.0011_userprofile_stripe_subscription`).

### 4. Verify

```bash
curl https://smartshelf-api.onrender.com/api/v1/billing/plans/
```

Expect `"stripe_enabled": true` and `"purchasable": true` on plans once price IDs are set.

Test checkout: sign in on the app → Profile → Prices → Student → pick a plan.

### 5. Go live

When test payments work:

1. Repeat step 2 with **live** keys (`sk_live_...`) in Stripe **live mode**.
2. Replace Render env vars with live values.
3. Redeploy.

---

## Manual webhook (if setup_stripe could not print `whsec_...`)

Stripe Dashboard → **Developers → Webhooks → Add endpoint**

| Field | Value |
|-------|--------|
| URL | `https://smartshelf-api.onrender.com/api/v1/billing/webhook/` |
| Events | `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted` |

Copy the **Signing secret** → `STRIPE_WEBHOOK_SECRET` on Render.

---

## App flow

1. Profile → **Prices** → Student / Micro / Diaspora.
2. App loads `/api/v1/billing/plans/?tier=…`.
3. `POST /api/v1/billing/checkout/` returns a Stripe Checkout URL.
4. After payment, Stripe redirects to `smartshelf://billing/success` and the webhook activates the subscription.

## Plans

| Plan ID | Tier | Mode | Amount |
|---------|------|------|--------|
| `student_monthly` | student | subscription | ₦2,000/mo |
| `student_termly` | student | payment | ₦5,000 |
| `student_annual` | student | payment | ₦8,000 |
| `micro_chapter` | micro | payment | ₦500 |
| `diaspora_usd` | diaspora | payment | $9.99 |
| `diaspora_gbp` | diaspora | payment | £7.99 |
| `diaspora_cad` | diaspora | payment | CA$12.99 |

## Desktop

Same Profile → Prices flow after the API is deployed with Stripe keys. Ship a new desktop build so users get the billing UI.
