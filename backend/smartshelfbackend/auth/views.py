from django.contrib.auth import authenticate
from django.contrib.auth.password_validation import validate_password
from django.core.cache import cache
from django.core.mail import send_mail
from django.conf import settings
import logging
from rest_framework import serializers, status
from rest_framework.authtoken.models import Token
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
import secrets
import string

from users.models import Organization, PublisherProfile, UserProfile
from users.serializers import OrganizationSerializer, UserProfileSerializer

RESET_CODE_TTL_SECONDS = 15 * 60
RESET_CODE_MAX_ATTEMPTS = 5
logger = logging.getLogger(__name__)


def _password_reset_cache_key(email: str) -> str:
    return f"password-reset:{email.lower().strip()}"


def _generate_reset_code() -> str:
    return "".join(secrets.choice(string.digits) for _ in range(6))


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
            linked_student_username = attrs.get("linked_student_username", "").strip()
            if not linked_student_username:
                raise serializers.ValidationError(
                    "linked_student_username is required for parent users."
                )
            child = UserProfile.objects.filter(username=linked_student_username).first()
            if not child or child.role != UserProfile.Role.STUDENT:
                raise serializers.ValidationError(
                    "linked_student_username must belong to an existing student user."
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
            linked_student_username = data.get("linked_student_username", "").strip()
            child = UserProfile.objects.filter(username=linked_student_username).first()
            if child and child.role == UserProfile.Role.STUDENT:
                user.managed_students.add(child)

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


class LoginView(APIView):
    authentication_classes = []
    permission_classes = []

    def post(self, request):
        serializer = LoginSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        user = authenticate(username=data["username"], password=data["password"])
        if not user:
            return Response({"error": "Invalid username or password"}, status=401)
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
