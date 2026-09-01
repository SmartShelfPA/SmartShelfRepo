# SmartShelf billing (Stripe)

Student, micro-transaction, and diaspora tiers checkout through **Stripe Checkout**. The mobile app, desktop shell, and web client all call the same Django API.

## Server setup (Render)

1. Add env vars from `.env.example` (`STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, and each `STRIPE_PRICE_*`).
2. Redeploy the API so migrations run (`users.0011_userprofile_stripe_subscription`).
3. In Stripe Dashboard → **Developers → Webhooks**, add:
   - URL: `https://smartshelf-api.onrender.com/api/v1/billing/webhook/`
   - Events: `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`

## App flow

1. Profile → **Prices** → choose Student / Micro / Diaspora.
2. App loads `/api/v1/billing/plans/?tier=…` and shows purchasable plans.
3. `POST /api/v1/billing/checkout/` returns a Stripe Checkout URL.
4. After payment, Stripe redirects to `smartshelf://billing/success` and the webhook activates the subscription on the user profile.

## Plans

| Plan ID | Tier | Mode |
|---------|------|------|
| `student_monthly` | student | subscription |
| `student_termly` | student | payment |
| `student_annual` | student | payment |
| `micro_chapter` | micro | payment |
| `diaspora_usd/gbp/cad` | diaspora | payment |

## Desktop

The desktop app uses the same Profile → Prices flow. After the API is deployed with Stripe keys, ship a new desktop build (same frontend bundle as mobile). Checkout opens in the system browser; subscription status syncs when the user returns to the app.
