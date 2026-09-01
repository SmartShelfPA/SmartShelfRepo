"""
Catalog of purchasable SmartShelf plans.

Stripe Price IDs come from environment variables so you can create products
in the Stripe Dashboard and paste price_... IDs into Render without code changes.
"""
from __future__ import annotations

import os
from dataclasses import dataclass
from typing import Iterator


@dataclass(frozen=True)
class BillingPlan:
    id: str
    tier: str
    name: str
    description: str
    price_display: str
    interval_label: str
    currency: str
    mode: str  # payment | subscription
    env_price_key: str

    @property
    def stripe_price_id(self) -> str:
        return os.getenv(self.env_price_key, "").strip()

    @property
    def purchasable(self) -> bool:
        return bool(self.stripe_price_id)


def _plans() -> list[BillingPlan]:
    return [
        BillingPlan(
            id="student_monthly",
            tier="student",
            name="Student — Monthly",
            description="Full SmartShelf access billed monthly.",
            price_display="₦2,000",
            interval_label="per month",
            currency="ngn",
            mode="subscription",
            env_price_key="STRIPE_PRICE_STUDENT_MONTHLY",
        ),
        BillingPlan(
            id="student_termly",
            tier="student",
            name="Student — Per term",
            description="Full access for one school term.",
            price_display="₦5,000",
            interval_label="per term",
            currency="ngn",
            mode="payment",
            env_price_key="STRIPE_PRICE_STUDENT_TERMLY",
        ),
        BillingPlan(
            id="student_annual",
            tier="student",
            name="Student — Annual",
            description="Best value — full year of SmartShelf.",
            price_display="₦8,000",
            interval_label="per year",
            currency="ngn",
            mode="payment",
            env_price_key="STRIPE_PRICE_STUDENT_ANNUAL",
        ),
        BillingPlan(
            id="micro_chapter",
            tier="micro",
            name="Rent-a-Chapter",
            description="Pay for a single chapter or short exam-prep window.",
            price_display="From ₦500",
            interval_label="one-time",
            currency="ngn",
            mode="payment",
            env_price_key="STRIPE_PRICE_MICRO_CHAPTER",
        ),
        BillingPlan(
            id="diaspora_usd",
            tier="diaspora",
            name="Diaspora — USD",
            description="Support a student in Nigeria; billed in US dollars.",
            price_display="$9.99",
            interval_label="per term",
            currency="usd",
            mode="payment",
            env_price_key="STRIPE_PRICE_DIASPORA_USD",
        ),
        BillingPlan(
            id="diaspora_gbp",
            tier="diaspora",
            name="Diaspora — GBP",
            description="Support a student in Nigeria; billed in pounds.",
            price_display="£7.99",
            interval_label="per term",
            currency="gbp",
            mode="payment",
            env_price_key="STRIPE_PRICE_DIASPORA_GBP",
        ),
        BillingPlan(
            id="diaspora_cad",
            tier="diaspora",
            name="Diaspora — CAD",
            description="Support a student in Nigeria; billed in Canadian dollars.",
            price_display="CA$12.99",
            interval_label="per term",
            currency="cad",
            mode="payment",
            env_price_key="STRIPE_PRICE_DIASPORA_CAD",
        ),
    ]


PLANS_BY_ID = {plan.id: plan for plan in _plans()}


def iter_plans(*, tier: str | None = None) -> Iterator[BillingPlan]:
    for plan in _plans():
        if tier and plan.tier != tier:
            continue
        yield plan


def get_plan(plan_id: str) -> BillingPlan | None:
    return PLANS_BY_ID.get(plan_id)
