from django.urls import path

from billing.views import (
    BillingCheckoutView,
    BillingPlansView,
    BillingRefreshView,
    BillingStatusView,
    StripeWebhookView,
)

urlpatterns = [
    path("plans/", BillingPlansView.as_view(), name="billing-plans"),
    path("status/", BillingStatusView.as_view(), name="billing-status"),
    path("checkout/", BillingCheckoutView.as_view(), name="billing-checkout"),
    path("refresh/", BillingRefreshView.as_view(), name="billing-refresh"),
    path("webhook/", StripeWebhookView.as_view(), name="billing-webhook"),
]
