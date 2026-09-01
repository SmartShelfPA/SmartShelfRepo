"""
Create SmartShelf products/prices in Stripe and register the production webhook.

Usage (test mode recommended first):

    export STRIPE_SECRET_KEY=sk_test_...
    python manage.py setup_stripe

    python manage.py setup_stripe --webhook-url https://smartshelf-api.onrender.com/api/v1/billing/webhook/

Prints env vars to paste into Render. Re-running is safe — existing catalog items are reused.
"""

from __future__ import annotations

from dataclasses import dataclass

import stripe
from django.conf import settings
from django.core.management.base import BaseCommand, CommandError

from billing.plans import iter_plans

DEFAULT_WEBHOOK_URL = "https://smartshelf-api.onrender.com/api/v1/billing/webhook/"

WEBHOOK_EVENTS = [
    "checkout.session.completed",
    "customer.subscription.updated",
    "customer.subscription.deleted",
]

# Stripe amounts in the smallest currency unit (kobo, cents, pence, etc.)
PLAN_AMOUNTS: dict[str, int] = {
    "student_monthly": 200_000,   # ₦2,000 / month
    "student_termly": 500_000,    # ₦5,000
    "student_annual": 800_000,    # ₦8,000
    "micro_chapter": 50_000,      # ₦500
    "diaspora_usd": 999,          # $9.99
    "diaspora_gbp": 799,          # £7.99
    "diaspora_cad": 1299,         # CA$12.99
}


@dataclass(frozen=True)
class CatalogSpec:
    plan_id: str
    env_key: str
    currency: str
    mode: str
    amount: int
    name: str
    description: str

    def price_label(self) -> str:
        return f"{self.currency.upper()} {self.amount} ({self.mode})"


def _catalog_specs() -> list[CatalogSpec]:
    specs: list[CatalogSpec] = []
    for plan in iter_plans():
        amount = PLAN_AMOUNTS.get(plan.id)
        if amount is None:
            continue
        specs.append(
            CatalogSpec(
                plan_id=plan.id,
                env_key=plan.env_price_key,
                currency=plan.currency,
                mode=plan.mode,
                amount=amount,
                name=plan.name,
                description=plan.description,
            )
        )
    return specs


def _find_product(plan_id: str) -> stripe.Product | None:
    products = stripe.Product.list(limit=100, active=True)
    for product in products.auto_paging_iter():
        metadata = product.get("metadata") or {}
        if metadata.get("smartshelf_plan_id") == plan_id:
            return product
    return None


def _find_price(product_id: str, *, currency: str, amount: int, recurring: bool) -> stripe.Price | None:
    prices = stripe.Price.list(product=product_id, limit=100, active=True)
    for price in prices.auto_paging_iter():
        if price.get("currency") != currency:
            continue
        if price.get("unit_amount") != amount:
            continue
        is_recurring = bool(price.get("recurring"))
        if is_recurring != recurring:
            continue
        return price
    return None


def _ensure_product(spec: CatalogSpec) -> stripe.Product:
    existing = _find_product(spec.plan_id)
    if existing:
        return existing
    return stripe.Product.create(
        name=spec.name,
        description=spec.description,
        metadata={"smartshelf_plan_id": spec.plan_id, "smartshelf_tier": spec.plan_id.split("_")[0]},
    )


def _ensure_price(product: stripe.Product, spec: CatalogSpec) -> stripe.Price:
    recurring = spec.mode == "subscription"
    existing = _find_price(product.id, currency=spec.currency, amount=spec.amount, recurring=recurring)
    if existing:
        return existing

    params: dict = {
        "product": product.id,
        "currency": spec.currency,
        "unit_amount": spec.amount,
        "metadata": {"smartshelf_plan_id": spec.plan_id},
    }
    if recurring:
        params["recurring"] = {"interval": "month"}
    return stripe.Price.create(**params)


def _ensure_webhook(url: str) -> stripe.WebhookEndpoint:
    endpoints = stripe.WebhookEndpoint.list(limit=100)
    for endpoint in endpoints.auto_paging_iter():
        if endpoint.get("url") == url:
            return endpoint
    return stripe.WebhookEndpoint.create(url=url, enabled_events=WEBHOOK_EVENTS)


class Command(BaseCommand):
    help = "Create SmartShelf Stripe catalog + webhook and print Render env vars."

    def add_arguments(self, parser):
        parser.add_argument(
            "--webhook-url",
            default=DEFAULT_WEBHOOK_URL,
            help=f"Webhook URL (default: {DEFAULT_WEBHOOK_URL})",
        )
        parser.add_argument(
            "--dry-run",
            action="store_true",
            help="Show what would be created without calling Stripe.",
        )
        parser.add_argument(
            "--skip-webhook",
            action="store_true",
            help="Only create products/prices; skip webhook registration.",
        )

    def handle(self, *args, **options):
        secret = getattr(settings, "STRIPE_SECRET_KEY", "") or ""
        if not secret and not options["dry_run"]:
            raise CommandError(
                "Set STRIPE_SECRET_KEY in the environment or Django settings before running this command."
            )

        webhook_url: str = options["webhook_url"]
        dry_run: bool = options["dry_run"]

        if dry_run:
            self.stdout.write(self.style.WARNING("DRY RUN — no Stripe API calls will be made.\n"))

        if not dry_run:
            stripe.api_key = secret

        price_env: dict[str, str] = {}
        for spec in _catalog_specs():
            self.stdout.write(f"Plan {spec.plan_id}: {spec.name} ({spec.price_label()})")
            if dry_run:
                price_env[spec.env_key] = "price_..."
                continue

            product = _ensure_product(spec)
            price = _ensure_price(product, spec)
            price_env[spec.env_key] = price.id
            self.stdout.write(self.style.SUCCESS(f"  -> {price.id}"))

        webhook_secret = ""
        if not options["skip_webhook"]:
            self.stdout.write(f"\nWebhook: {webhook_url}")
            if dry_run:
                webhook_secret = "whsec_..."
            else:
                endpoint = _ensure_webhook(webhook_url)
                webhook_secret = endpoint.secret or ""
                if webhook_secret:
                    self.stdout.write(self.style.SUCCESS("  -> webhook created (secret below)"))
                else:
                    self.stdout.write(
                        self.style.WARNING(
                            "  -> webhook already existed; secret is only shown once at creation. "
                            "Copy it from Stripe Dashboard -> Developers -> Webhooks, or delete and re-run."
                        )
                    )

        self.stdout.write("\n" + "=" * 60)
        self.stdout.write("Paste into Render -> smartshelf-api -> Environment:\n")
        if not dry_run:
            mode = "test" if secret.startswith("sk_test_") else "live"
            self.stdout.write(self.style.NOTICE(f"# Stripe mode: {mode}"))
        self.stdout.write(f"STRIPE_SECRET_KEY={secret or 'sk_test_...'}")
        if webhook_secret:
            self.stdout.write(f"STRIPE_WEBHOOK_SECRET={webhook_secret}")
        elif not options["skip_webhook"]:
            self.stdout.write("STRIPE_WEBHOOK_SECRET=whsec_...")
        self.stdout.write(
            "STRIPE_CHECKOUT_SUCCESS_URL=smartshelf://billing/success?session_id={CHECKOUT_SESSION_ID}"
        )
        self.stdout.write("STRIPE_CHECKOUT_CANCEL_URL=smartshelf://billing/cancel")
        for key, value in sorted(price_env.items()):
            self.stdout.write(f"{key}={value}")
        self.stdout.write("=" * 60)
