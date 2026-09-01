import logging

from django.conf import settings
from django.http import HttpResponse
from django.utils.decorators import method_decorator
from django.views.decorators.csrf import csrf_exempt
from rest_framework import serializers, status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
import stripe

from billing.plans import get_plan, iter_plans
from billing.stripe_service import (
    create_checkout_session,
    handle_checkout_completed,
    handle_subscription_updated,
    init_stripe,
    serialize_plan,
    stripe_configured,
)
from users.models import UserProfile
from users.serializers import UserProfileSerializer

logger = logging.getLogger(__name__)


class CheckoutSerializer(serializers.Serializer):
    plan_id = serializers.CharField(max_length=64)


class BillingPlansView(APIView):
    """Public catalog — shows which plans are purchasable (Stripe price configured)."""

    def get(self, request):
        tier = request.query_params.get("tier")
        plans = [serialize_plan(plan) for plan in iter_plans(tier=tier)]
        return Response(
            {
                "stripe_enabled": stripe_configured(),
                "plans": plans,
            }
        )


class BillingStatusView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        user: UserProfile = request.user
        return Response(
            {
                "tier": user.subscription_tier or None,
                "plan_id": user.subscription_plan_id or None,
                "status": user.subscription_status,
                "active_until": user.subscription_active_until,
                "has_active_subscription": user.has_active_subscription,
            }
        )


class BillingCheckoutView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        if not stripe_configured():
            return Response(
                {
                    "detail": (
                        "Online payments are not configured yet. "
                        "Set STRIPE_SECRET_KEY and Stripe Price IDs on the server."
                    )
                },
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )

        serializer = CheckoutSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        plan = get_plan(serializer.validated_data["plan_id"])
        if not plan:
            return Response({"detail": "Unknown plan."}, status=status.HTTP_400_BAD_REQUEST)
        if not plan.purchasable:
            return Response(
                {"detail": f"{plan.name} is not available for checkout yet."},
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )

        try:
            session = create_checkout_session(user=request.user, plan=plan)
        except Exception as exc:
            logger.exception("Stripe checkout failed")
            return Response(
                {"detail": "Could not start checkout. Please try again."},
                status=status.HTTP_502_BAD_GATEWAY,
            )

        return Response({"checkout_url": session.url, "session_id": session.id})


class BillingRefreshView(APIView):
    """After returning from Stripe Checkout, client can refresh profile/subscription."""

    permission_classes = [IsAuthenticated]

    def post(self, request):
        return Response(
            {
                "subscription": BillingStatusView().get(request).data,
                "profile": UserProfileSerializer(request.user).data,
            }
        )


@method_decorator(csrf_exempt, name="dispatch")
class StripeWebhookView(APIView):
    authentication_classes = []
    permission_classes = []

    def post(self, request):
        payload = request.body
        sig_header = request.META.get("HTTP_STRIPE_SIGNATURE", "")
        webhook_secret = getattr(settings, "STRIPE_WEBHOOK_SECRET", "")

        if not webhook_secret:
            logger.error("STRIPE_WEBHOOK_SECRET is not configured")
            return HttpResponse(status=500)

        init_stripe()
        try:
            event = stripe.Webhook.construct_event(payload, sig_header, webhook_secret)
        except ValueError:
            return HttpResponse(status=400)
        except stripe.error.SignatureVerificationError:
            return HttpResponse(status=400)

        event_type = event["type"]
        data_object = event["data"]["object"]

        if event_type == "checkout.session.completed":
            handle_checkout_completed(data_object)
        elif event_type in {"customer.subscription.updated", "customer.subscription.deleted"}:
            handle_subscription_updated(data_object)

        return HttpResponse(status=200)
