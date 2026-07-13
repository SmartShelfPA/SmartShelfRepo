from django.urls import path
from . import views
from .parent_invite_views import (
    ParentInviteCreateView,
    ParentInviteRedeemView,
    ParentInviteVerifyView,
)

urlpatterns = [
    path("organizations/", views.OrganizationListPublicView.as_view(), name="organizations-public"),
    path("register/", views.RegisterView.as_view(), name="register"),
    path("parent-invite/verify/", ParentInviteVerifyView.as_view(), name="parent-invite-verify"),
    path("parent-invite/redeem/", ParentInviteRedeemView.as_view(), name="parent-invite-redeem"),
    path("login/", views.LoginView.as_view(), name="login"),
    path("validate/", views.ValidateTokenView.as_view(), name="validate"),
    path("password-reset/request/", views.PasswordResetRequestView.as_view(), name="password-reset-request"),
    path("password-reset/confirm/", views.PasswordResetConfirmView.as_view(), name="password-reset-confirm"),
    path("policy-info/", views.PolicyInfoView.as_view(), name="policy-info"),
    path("google/", views.GoogleSignInView.as_view(), name="google-signin"),
]
