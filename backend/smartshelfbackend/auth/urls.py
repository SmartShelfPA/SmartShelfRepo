from django.urls import path
from . import views

urlpatterns = [
    path("organizations/", views.OrganizationListPublicView.as_view(), name="organizations-public"),
    path("register/", views.RegisterView.as_view(), name="register"),
    path("login/", views.LoginView.as_view(), name="login"),
    path("validate/", views.ValidateTokenView.as_view(), name="validate"),
    path("password-reset/request/", views.PasswordResetRequestView.as_view(), name="password-reset-request"),
    path("password-reset/confirm/", views.PasswordResetConfirmView.as_view(), name="password-reset-confirm"),
]
