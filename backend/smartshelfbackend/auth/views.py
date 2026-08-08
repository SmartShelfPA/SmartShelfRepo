from django.contrib.auth import authenticate
from django.contrib.auth.password_validation import validate_password
from django.core.cache import cache
from django.core.mail import send_mail
from django.conf import settings
from django.utils import timezone
import logging
import os
from rest_framework import serializers, status
from rest_framework.authtoken.models import Token
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
import secrets
import string

from users.models import AuditLog, Organization, ParentalConsent, PublisherProfile, UserProfile
from users.serializers import OrganizationSerializer, UserProfileSerializer
from .throttles import LoginRateThrottle, PasswordResetRateThrottle, RegisterRateThrottle

RESET_CODE_TTL_SECONDS = 15 * 60
RESET_CODE_MAX_ATTEMPTS = 5
logger = logging.getLogger(__name__)


def _password_reset_cache_key(email: str) -> str:
    return f"password-reset:{email.lower().strip()}"


def _generate_reset_code() -> str:
    return "".join(secrets.choice(string.digits) for _ in range(6))


# Version tags embedded in the app / backend — bump these when policy text changes.
CURRENT_TERMS_VERSION = "2024-06"
CURRENT_PRIVACY_VERSION = "2026-08"


class RegisterSerializer(serializers.Serializer):
    organization_slug = serializers.SlugField(required=False, allow_blank=True)
    username = serializers.CharField(max_length=150)
    password = serializers.CharField(min_length=8, write_only=True)
    email = serializers.EmailField()
    role = serializers.ChoiceField(choices=UserProfile.Role.choices)
    full_name = serializers.CharField(max_length=255)
    date_of_birth = serializers.DateField(required=False, allow_null=True)
    student_class = serializers.CharField(required=False, allow_blank=True, max_length=120)
    linked_student_username = serializers.CharField(
        required=False, allow_blank=True, max_length=150
    )
    avatar_url = serializers.URLField(required=False, allow_blank=True)
    staff_role = serializers.CharField(required=False, allow_blank=True, max_length=120)
    staff_department = serializers.CharField(
        required=False, allow_blank=True, max_length=120
    )
    company_name = serializers.CharField(required=False, allow_blank=True, max_length=255)
    contact_email = serializers.EmailField(required=False, allow_blank=True)

    # Consent fields — terms_accepted is required for new accounts.
    terms_accepted = serializers.BooleanField(
        required=True,
        error_messages={"required": "You must accept the Terms of Use to create an account."},
    )
    analytics_consent = serializers.BooleanField(required=False, default=False)

    def validate_terms_accepted(self, value):
        if not value:
            raise serializers.ValidationError(
                "You must accept the Terms of Use and Privacy Policy to create an account."
            )
        return value

    def validate(self, attrs):
        role = attrs["role"]
        if role == UserProfile.Role.STAFF:
            if not attrs.get("staff_role"):
                raise serializers.ValidationError("staff_role is required for staff users.")
            if not attrs.get("staff_department"):
                raise serializers.ValidationError(
                    "staff_department is required for staff users."
                )
        if role == UserProfile.Role.STUDENT and not attrs.get("student_class"):
            raise serializers.ValidationError("student_class is required for students.")
        if role == UserProfile.Role.PARENT:
            raise serializers.ValidationError(
                {
                    "role": (
                        "Parent accounts require an invitation code. "
                        "Open the app, tap Parent Access, and enter the code from your school."
                    )
                }
            )
        if role == UserProfile.Role.PUBLISHER:
            if not attrs.get("company_name"):
                raise serializers.ValidationError("company_name is required for publishers.")
            if not attrs.get("contact_email"):
                raise serializers.ValidationError("contact_email is required for publishers.")
        if role != UserProfile.Role.PUBLISHER and not attrs.get("organization_slug"):
            raise serializers.ValidationError(
                "organization_slug is required for non-publisher users."
            )
        return attrs


class OrganizationListPublicView(APIView):
    """List schools for the registration form (unauthenticated)."""

    authentication_classes = []
    permission_classes = []

    def get(self, request):
        organizations = Organization.objects.all().order_by("name")
        return Response(OrganizationSerializer(organizations, many=True).data)


class RegisterView(APIView):
    authentication_classes = []
    permission_classes = []
    throttle_classes = [RegisterRateThrottle]

    def post(self, request):
        serializer = RegisterSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        organization = None
        if data.get("organization_slug"):
            organization = Organization.objects.filter(slug=data["organization_slug"]).first()
            if not organization:
                return Response(
                    {"error": "Organization not found for organization_slug."},
                    status=status.HTTP_400_BAD_REQUEST,
                )

        if UserProfile.objects.filter(username=data["username"]).exists():
            return Response({"error": "Username already exists."}, status=400)
        if UserProfile.objects.filter(email=data["email"]).exists():
            return Response({"error": "Email already exists."}, status=400)

        # School-managed flag: inherit from org governance setting.
        school_managed = bool(organization and organization.governs_student_data)

        user = UserProfile.objects.create_user(
            username=data["username"],
            password=data["password"],
            email=data["email"],
            role=data["role"],
            full_name=data["full_name"],
            date_of_birth=data.get("date_of_birth"),
            student_class=data.get("student_class", ""),
            avatar_url=data.get("avatar_url", ""),
            staff_role=data.get("staff_role", ""),
            staff_department=data.get("staff_department", ""),
            organization=organization,
            school_managed=school_managed,
        )

        # Stamp policy acceptance at account creation.
        user.record_policy_acceptance(
            terms_version=CURRENT_TERMS_VERSION,
            privacy_version=CURRENT_PRIVACY_VERSION,
            analytics=data.get("analytics_consent", False),
            save=True,
        )
        AuditLog.log(
            AuditLog.Action.POLICY_ACCEPT,
            actor=user,
            target=user,
            notes=f"Terms v{CURRENT_TERMS_VERSION} + Privacy v{CURRENT_PRIVACY_VERSION} accepted at registration.",
        )

        token, _ = Token.objects.get_or_create(user=user)

        if user.role == UserProfile.Role.PUBLISHER:
            PublisherProfile.objects.get_or_create(
                user=user,
                defaults={
                    "company_name": data["company_name"],
                    "contact_email": data["contact_email"],
                },
            )
        elif user.role == UserProfile.Role.PARENT:
            pass  # Parent-child link is created via invite redemption only.

        return Response(
            {
                "success": True,
                "message": "User registered successfully",
                "token": token.key,
                "user": UserProfileSerializer(user).data,
            },
            status=status.HTTP_201_CREATED,
        )


class LoginSerializer(serializers.Serializer):
    username = serializers.CharField()
    password = serializers.CharField()


MAX_FAILED_LOGINS = int(os.environ.get("AUTH_MAX_FAILED_LOGINS", "5"))
LOCKOUT_MINUTES = int(os.environ.get("AUTH_LOCKOUT_MINUTES", "30"))


class LoginView(APIView):
    authentication_classes = []
    permission_classes = []
    throttle_classes = [LoginRateThrottle]

    def post(self, request):
        serializer = LoginSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        # Pre-check: find the account to test for lockout before authenticating.
        candidate = UserProfile.objects.filter(username=data["username"]).first()
        if candidate and candidate.is_locked:
            AuditLog.log(
                AuditLog.Action.ADMIN_ACTION,
                actor=None,
                target=candidate,
                notes=f"Login blocked — account locked until {candidate.locked_until.isoformat()}.",
            )
            return Response(
                {
                    "error": "account_locked",
                    "message": (
                        f"Your account is temporarily locked due to too many failed login attempts. "
                        f"Try again after {candidate.locked_until.strftime('%H:%M UTC')}."
                    ),
                    "locked_until": candidate.locked_until.isoformat(),
                },
                status=403,
            )

        user = authenticate(username=data["username"], password=data["password"])

        if not user:
            # Record failed attempt if the account exists.
            if candidate:
                candidate.record_failed_login(
                    max_attempts=MAX_FAILED_LOGINS, lockout_minutes=LOCKOUT_MINUTES
                )
                AuditLog.log(
                    AuditLog.Action.ADMIN_ACTION,
                    actor=None,
                    target=candidate,
                    notes=(
                        f"Failed login attempt #{candidate.failed_login_count}. "
                        + (
                            f"Account locked until {candidate.locked_until.isoformat()}."
                            if candidate.locked_until
                            else ""
                        )
                    ),
                )
                if candidate.is_locked:
                    return Response(
                        {
                            "error": "account_locked",
                            "message": (
                                f"Too many failed attempts. Your account is locked for "
                                f"{LOCKOUT_MINUTES} minutes."
                            ),
                            "locked_until": candidate.locked_until.isoformat(),
                        },
                        status=403,
                    )
            return Response({"error": "Invalid username or password"}, status=401)

        # Successful authentication — clear any prior lockout.
        user.clear_failed_logins()

        token, _ = Token.objects.get_or_create(user=user)
        return Response(
            {
                "success": True,
                "message": "Login successful",
                "token": token.key,
                "user": UserProfileSerializer(user).data,
            }
        )


class ValidateTokenView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        return Response({"valid": True, "user_id": str(request.user.id)})


class PasswordResetRequestSerializer(serializers.Serializer):
    email = serializers.EmailField()


class PasswordResetConfirmSerializer(serializers.Serializer):
    email = serializers.EmailField()
    code = serializers.CharField(min_length=6, max_length=6)
    new_password = serializers.CharField(min_length=8, write_only=True)

    def validate_new_password(self, value):
        validate_password(value)
        return value


class PasswordResetRequestView(APIView):
    authentication_classes = []
    permission_classes = []
    throttle_classes = [PasswordResetRateThrottle]

    def post(self, request):
        serializer = PasswordResetRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        email = serializer.validated_data["email"].lower().strip()

        user = UserProfile.objects.filter(email__iexact=email).first()
        if user:
            code = _generate_reset_code()
            cache.set(
                _password_reset_cache_key(email),
                {
                    "code": code,
                    "user_id": str(user.id),
                    "attempts": 0,
                },
                timeout=RESET_CODE_TTL_SECONDS,
            )
            try:
                send_mail(
                    subject="SmartShelf password reset code",
                    message=(
                        f"Your SmartShelf password reset code is {code}.\n\n"
                        "This code expires in 15 minutes."
                    ),
                    from_email=settings.DEFAULT_FROM_EMAIL,
                    recipient_list=[email],
                    fail_silently=False,
                )
            except Exception as exc:
                logger.exception("Failed to send password reset email to %s", email)
                if settings.DEBUG:
                    return Response(
                        {
                            "success": True,
                            "message": "Email delivery failed in debug mode. Use the code below.",
                            "debug_reset_code": code,
                            "delivery_failed": True,
                            "error": str(exc),
                        }
                    )
                return Response(
                    {"error": "Could not send reset email. Please try again."},
                    status=status.HTTP_500_INTERNAL_SERVER_ERROR,
                )

        # Always return a generic success response to prevent account enumeration.
        return Response(
            {
                "success": True,
                "message": "If that email exists, a reset code has been sent.",
                **({"debug_reset_code": code} if settings.DEBUG and user else {}),
            }
        )


class PasswordResetConfirmView(APIView):
    authentication_classes = []
    permission_classes = []

    def post(self, request):
        serializer = PasswordResetConfirmSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        email = data["email"].lower().strip()
        code = data["code"].strip()
        cache_key = _password_reset_cache_key(email)
        stored = cache.get(cache_key)

        if not stored:
            return Response(
                {"error": "Code is invalid or expired."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        attempts = int(stored.get("attempts", 0))
        if attempts >= RESET_CODE_MAX_ATTEMPTS:
            cache.delete(cache_key)
            return Response(
                {"error": "Too many attempts. Request a new code."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if stored.get("code") != code:
            stored["attempts"] = attempts + 1
            cache.set(cache_key, stored, timeout=RESET_CODE_TTL_SECONDS)
            return Response(
                {"error": "Code is invalid or expired."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        user = UserProfile.objects.filter(
            id=stored.get("user_id"),
            email__iexact=email,
        ).first()
        if not user:
            cache.delete(cache_key)
            return Response(
                {"error": "Code is invalid or expired."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        user.set_password(data["new_password"])
        user.save(update_fields=["password"])
        Token.objects.filter(user=user).delete()
        cache.delete(cache_key)

        return Response({"success": True, "message": "Password reset successful."})


class PolicyInfoView(APIView):
    """
    GET /api/v1/auth/policy-info/

    Returns the current policy versions, privacy contact, data storage location,
    and active jurisdiction flags.  No authentication required — used by the app
    at startup and on the registration/consent screens.
    """

    authentication_classes = []
    permission_classes = []

    def get(self, request):
        jurisdictions = []
        if getattr(settings, "COMPLIANCE_NDPA", True):
            jurisdictions.append({
                "code": "NDPA",
                "label": "Nigeria Data Protection Act (NDPA) 2023",
                "summary": (
                    "SmartShelf processes your personal data in compliance with the Nigerian "
                    "Data Protection Act 2023. You have the right to access, correct, and "
                    "request deletion of your data."
                ),
            })
        if getattr(settings, "COMPLIANCE_COPPA", True):
            jurisdictions.append({
                "code": "COPPA",
                "label": "U.S. Children's Online Privacy Protection Act (COPPA)",
                "summary": (
                    "We do not knowingly collect personal information from children under 13 "
                    "without verified parental consent. If you believe we have inadvertently "
                    "collected such data, contact us to have it removed."
                ),
            })
        if getattr(settings, "COMPLIANCE_PIPEDA", True):
            jurisdictions.append({
                "code": "PIPEDA",
                "label": "Canada — PIPEDA / Law 25",
                "summary": (
                    "If you are in Canada, your personal data is handled in accordance with "
                    "the Personal Information Protection and Electronic Documents Act (PIPEDA). "
                    "You may withdraw consent at any time from Privacy & Data Settings."
                ),
            })

        return Response({
            "terms_version": CURRENT_TERMS_VERSION,
            "privacy_version": CURRENT_PRIVACY_VERSION,
            "privacy_contact": getattr(settings, "PRIVACY_CONTACT_EMAIL", "privacy@smartshelf.ng"),
            "data_storage_country": getattr(settings, "DATA_STORAGE_COUNTRY", "Nigeria"),
            "data_storage_region": getattr(settings, "DATA_STORAGE_REGION", "West Africa"),
            "jurisdictions": jurisdictions,
        })
