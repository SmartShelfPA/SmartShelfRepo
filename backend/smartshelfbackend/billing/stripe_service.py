import logging
import os
from datetime import timedelta

import stripe
from django.conf import settings
from django.utils import timezone

from billing.plans import BillingPlan, get_plan
from users.models import UserProfile

logger = logging.getLogger(__name__)


def stripe_configured() -> bool:
    return bool(getattr(settings, "STRIPE_SECRET_KEY", ""))


def init_stripe() -> None:
    stripe.api_key = settings.STRIPE_SECRET_KEY


def plan_access_until(plan: BillingPlan) -> timezone.datetime:
    now = timezone.now()
    if plan.id == "student_monthly":
        return now + timedelta(days=31)
    if plan.id == "student_termly" or plan.id.startswith("diaspora_"):
        return now + timedelta(days=120)
    if plan.id == "student_annual":
        return now + timedelta(days=366)
    if plan.id == "micro_chapter":
        return now + timedelta(days=30)
    return now + timedelta(days=90)


def serialize_plan(plan: BillingPlan) -> dict:
    return {
        "id": plan.id,
        "tier": plan.tier,
        "name": plan.name,
        "description": plan.description,
        "price_display": plan.price_display,
        "interval_label": plan.interval_label,
        "currency": plan.currency,
        "mode": plan.mode,
        "purchasable": plan.purchasable,
    }


def get_or_create_customer(user: UserProfile) -> str:
    init_stripe()
    if user.stripe_customer_id:
        return user.stripe_customer_id
    customer = stripe.Customer.create(
        email=user.email or None,
        name=user.full_name or user.username,
        metadata={"user_id": str(user.id), "username": user.username},
    )
    user.stripe_customer_id = customer.id
    user.save(update_fields=["stripe_customer_id"])
    return customer.id


def create_checkout_session(*, user: UserProfile, plan: BillingPlan) -> stripe.checkout.Session:
    init_stripe()
    customer_id = get_or_create_customer(user)
    success_url = settings.STRIPE_CHECKOUT_SUCCESS_URL.format(
        CHECKOUT_SESSION_ID="{CHECKOUT_SESSION_ID}"
    )
    cancel_url = settings.STRIPE_CHECKOUT_CANCEL_URL

    params: dict = {
        "mode": plan.mode,
        "customer": customer_id,
        "client_reference_id": str(user.id),
        "line_items": [{"price": plan.stripe_price_id, "quantity": 1}],
        "success_url": success_url,
        "cancel_url": cancel_url,
        "metadata": {
            "user_id": str(user.id),
            "plan_id": plan.id,
            "tier": plan.tier,
        },
    }
    if plan.mode == "subscription":
        params["subscription_data"] = {
            "metadata": {"user_id": str(user.id), "plan_id": plan.id, "tier": plan.tier},
        }
    else:
        params["payment_intent_data"] = {
            "metadata": {"user_id": str(user.id), "plan_id": plan.id, "tier": plan.tier},
        }

    return stripe.checkout.Session.create(**params)


def apply_subscription_from_plan(
    user: UserProfile,
    *,
    plan: BillingPlan,
    stripe_subscription_id: str = "",
    stripe_customer_id: str = "",
) -> None:
    user.subscription_tier = plan.tier
    user.subscription_plan_id = plan.id
    user.subscription_status = UserProfile.SubscriptionStatus.ACTIVE
    user.subscription_active_until = plan_access_until(plan)
    if stripe_subscription_id:
        user.stripe_subscription_id = stripe_subscription_id
    if stripe_customer_id:
        user.stripe_customer_id = stripe_customer_id
    user.save(
        update_fields=[
            "subscription_tier",
            "subscription_plan_id",
            "subscription_status",
            "subscription_active_until",
            "stripe_subscription_id",
            "stripe_customer_id",
        ]
    )


def handle_checkout_completed(session: dict) -> None:
    metadata = session.get("metadata") or {}
    plan_id = metadata.get("plan_id")
    user_id = metadata.get("user_id") or session.get("client_reference_id")
    if not user_id or not plan_id:
        logger.warning("checkout.session.completed missing user/plan metadata")
        return

    plan = get_plan(str(plan_id))
    if not plan:
        logger.warning("Unknown plan_id in checkout session: %s", plan_id)
        return

    try:
        user = UserProfile.objects.get(pk=user_id)
    except UserProfile.DoesNotExist:
        logger.warning("Checkout for unknown user %s", user_id)
        return

    apply_subscription_from_plan(
        user,
        plan=plan,
        stripe_subscription_id=session.get("subscription") or "",
        stripe_customer_id=session.get("customer") or "",
    )


def handle_subscription_updated(subscription: dict) -> None:
    metadata = subscription.get("metadata") or {}
    user_id = metadata.get("user_id")
    plan_id = metadata.get("plan_id")
    if not user_id:
        return
    try:
        user = UserProfile.objects.get(pk=user_id)
    except UserProfile.DoesNotExist:
        return

    status = subscription.get("status", "")
    if status in {"active", "trialing"}:
        user.subscription_status = UserProfile.SubscriptionStatus.ACTIVE
    elif status in {"canceled", "unpaid"}:
        user.subscription_status = UserProfile.SubscriptionStatus.CANCELED
    elif status == "past_due":
        user.subscription_status = UserProfile.SubscriptionStatus.PAST_DUE
    else:
        user.subscription_status = UserProfile.SubscriptionStatus.NONE

    if plan_id:
        plan = get_plan(plan_id)
        if plan:
            user.subscription_tier = plan.tier
            user.subscription_plan_id = plan.id

    period_end = subscription.get("current_period_end")
    if period_end:
        user.subscription_active_until = timezone.datetime.fromtimestamp(
            int(period_end), tz=timezone.utc
        )

    user.stripe_subscription_id = subscription.get("id") or user.stripe_subscription_id
    user.save(
        update_fields=[
            "subscription_tier",
            "subscription_plan_id",
            "subscription_status",
            "subscription_active_until",
            "stripe_subscription_id",
        ]
    )
