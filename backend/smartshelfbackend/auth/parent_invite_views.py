"""Parent invite verification and redemption (invite-and-link flow)."""

from __future__ import annotations

import logging
import secrets
from datetime import timedelta

from django.conf import settings
from django.core.mail import send_mail
from django.db import transaction
from django.utils import timezone
from rest_framework import serializers, status
from rest_framework.authtoken.models import Token
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from users.models import AuditLog, ParentInvite, ParentalConsent, UserProfile
from users.permissions import IsStaffRole
from users.serializers import UserProfileSerializer

from .views import CURRENT_PRIVACY_VERSION, CURRENT_TERMS_VERSION, RegisterRateThrottle

logger = logging.getLogger(__name__)

INVITE_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
INVITE_TTL_DAYS = 7


def _generate_invite_code() -> str:
    return "".join(secrets.choice(INVITE_CODE_ALPHABET) for _ in range(8))


def _generate_invite_token() -> str:
    return secrets.token_urlsafe(24)


def _mask_child_name(full_name: str, username: str) -> str:
    name = (full_name or username).strip()
    parts = name.split()
    if len(parts) >= 2:
        return f"{parts[0]} {parts[-1][0]}."
    if len(name) > 1:
        return f"{name[0]}."
    return "Student"


def _mask_email(email: str) -> str:
    email = (email or "").strip()
    if "@" not in email:
        return ""
    local, domain = email.split("@", 1)
    if not local:
        return f"***@{domain}"
    return f"{local[0]}***@{domain}"


def _get_invite(*, code: str = "", token: str = "") -> ParentInvite | None:
    code = (code or "").strip().upper()
    token = (token or "").strip()
    invite = None
    if code:
        invite = ParentInvite.objects.select_related(
            "student", "organization", "student__organization"
        ).filter(code__iexact=code).first()
    elif token:
        invite = ParentInvite.objects.select_related(
            "student", "organization", "student__organization"
        ).filter(token=token).first()
    if invite:
        invite.mark_expired_if_needed()
    return invite


def _invite_preview(invite: ParentInvite) -> dict:
    student = invite.student
    return {
        "valid": invite.is_redeemable,
        "status": invite.status,
        "child_display_name": _mask_child_name(student.full_name, student.username),
        "school_name": invite.organization.name if invite.organization else "",
        "expires_at": invite.expires_at.isoformat(),
        "invite_email_hint": _mask_email(invite.invite_email),
    }


def create_parent_invite(
    *,
    student: UserProfile,
    created_by: UserProfile | None = None,
    invite_email: str = "",
) -> ParentInvite:
    if student.role != UserProfile.Role.STUDENT:
        raise ValueError("Invites can only be created for student accounts.")
    expires_at = timezone.now() + timedelta(days=INVITE_TTL_DAYS)
    for _ in range(10):
        code = _generate_invite_code()
        token = _generate_invite_token()
        if ParentInvite.objects.filter(code=code).exists():
            continue
        if ParentInvite.objects.filter(token=token).exists():
            continue
        invite = ParentInvite.objects.create(
            student=student,
            organization=student.organization,
            invite_email=(invite_email or "").strip(),
            code=code,
            token=token,
            created_by=created_by,
            expires_at=expires_at,
        )
        return invite
    raise RuntimeError("Could not generate a unique invite code.")


def _send_invite_email(invite: ParentInvite) -> None:
    if not invite.invite_email:
        return
    from_email = getattr(settings, "DEFAULT_FROM_EMAIL", None)
    if not from_email:
        logger.info("Skipping parent invite email — DEFAULT_FROM_EMAIL not configured.")
        return
    child = _mask_child_name(invite.student.full_name, invite.student.username)
    subject = f"SmartShelf parent invite for {child}"
    message = (
        f"You have been invited to link your SmartShelf parent account to {child}.\n\n"
        f"Your invite code: {invite.code}\n\n"
        "Open the SmartShelf app → tap Parent Access → enter this code to create your account.\n"
        f"This code expires on {invite.expires_at.strftime('%Y-%m-%d %H:%M UTC')}.\n"
    )
    try:
        send_mail(subject, message, from_email, [invite.invite_email], fail_silently=False)
    except Exception:
        logger.exception("Failed to send parent invite email to %s", invite.invite_email)


class ParentInviteVerifyView(APIView):
    """Verify an invite code or token before account creation."""

    authentication_classes = []
    permission_classes = []

    def post(self, request):
        code = (request.data.get("code") or "").strip()
        token = (request.data.get("token") or "").strip()
        if not code and not token:
            return Response(
                {"error": "Enter your invite code."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        invite = _get_invite(code=code, token=token)
        if not invite:
            return Response(
                {"valid": False, "error": "Invite code not found. Check the code and try again."},
                status=status.HTTP_404_NOT_FOUND,
            )
        preview = _invite_preview(invite)
        if not preview["valid"]:
            reason = "This invite has expired." if invite.status == ParentInvite.Status.EXPIRED else (
                "This invite has already been used." if invite.status == ParentInvite.Status.ACCEPTED
                else "This invite is no longer valid."
            )
            return Response({**preview, "error": reason}, status=status.HTTP_400_BAD_REQUEST)
        return Response(preview)


class ParentInviteRedeemSerializer(serializers.Serializer):
    code = serializers.CharField(required=False, allow_blank=True)
    token = serializers.CharField(required=False, allow_blank=True)
    username = serializers.CharField(max_length=150)
    password = serializers.CharField(min_length=8, write_only=True)
    email = serializers.EmailField()
    full_name = serializers.CharField(max_length=255)
    terms_accepted = serializers.BooleanField()
    analytics_consent = serializers.BooleanField(required=False, default=False)

    def validate_terms_accepted(self, value):
        if not value:
            raise serializers.ValidationError(
                "You must accept the Terms of Use and Privacy Policy."
            )
        return value

    def validate(self, attrs):
        if not (attrs.get("code") or "").strip() and not (attrs.get("token") or "").strip():
            raise serializers.ValidationError("Invite code is required.")
        return attrs


class ParentInviteRedeemView(APIView):
    """Create a parent account and link to the invited student."""

    authentication_classes = []
    permission_classes = []
    throttle_classes = [RegisterRateThrottle]

    @transaction.atomic
    def post(self, request):
        serializer = ParentInviteRedeemSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        invite = _get_invite(code=data.get("code", ""), token=data.get("token", ""))
        if not invite or not invite.is_redeemable:
            return Response(
                {"error": "Invite is invalid or expired. Ask your school for a new code."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if invite.invite_email and data["email"].strip().lower() != invite.invite_email.strip().lower():
            return Response(
                {
                    "error": (
                        "This invite was sent to a different email address. "
                        "Use the email that received the invitation."
                    )
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        if UserProfile.objects.filter(username=data["username"]).exists():
            return Response({"error": "Username already exists."}, status=400)
        if UserProfile.objects.filter(email=data["email"]).exists():
            return Response({"error": "Email already exists."}, status=400)

        student = invite.student
        organization = student.organization
        school_managed = bool(organization and organization.governs_student_data)

        user = UserProfile.objects.create_user(
            username=data["username"],
            password=data["password"],
            email=data["email"],
            role=UserProfile.Role.PARENT,
            full_name=data["full_name"],
            organization=organization,
            school_managed=school_managed,
        )
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
            notes="Parent invite redemption — policy accepted.",
        )

        user.managed_students.add(student)
        if student.is_minor_account:
            ParentalConsent.objects.get_or_create(
                minor=student,
                guardian=user,
                defaults={
                    "guardian_name": user.full_name,
                    "guardian_email": user.email,
                    "status": ParentalConsent.ConsentStatus.GRANTED,
                    "consent_method": ParentalConsent.ConsentMethod.IN_APP,
                    "granted_at": timezone.now(),
                    "notes": f"Parent redeemed invite {invite.code}.",
                },
            )

        invite.status = ParentInvite.Status.ACCEPTED
        invite.accepted_at = timezone.now()
        invite.accepted_by = user
        invite.save(update_fields=["status", "accepted_at", "accepted_by"])

        token, _ = Token.objects.get_or_create(user=user)
        return Response(
            {
                "success": True,
                "message": "Parent account created and linked to your child.",
                "token": token.key,
                "user": UserProfileSerializer(user).data,
            },
            status=status.HTTP_201_CREATED,
        )


class ParentInviteCreateSerializer(serializers.Serializer):
    student_id = serializers.UUIDField()
    guardian_email = serializers.EmailField(required=False, allow_blank=True)


class ParentInviteCreateView(APIView):
    """Staff creates a parent invite for a student in their organization."""

    permission_classes = [IsAuthenticated, IsStaffRole]

    def post(self, request):
        serializer = ParentInviteCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        student_id = serializer.validated_data["student_id"]
        guardian_email = (serializer.validated_data.get("guardian_email") or "").strip()

        try:
            student = UserProfile.objects.get(
                pk=student_id,
                organization=request.user.organization,
                role=UserProfile.Role.STUDENT,
            )
        except UserProfile.DoesNotExist:
            return Response({"error": "Student not found."}, status=status.HTTP_404_NOT_FOUND)

        invite = create_parent_invite(
            student=student,
            created_by=request.user,
            invite_email=guardian_email,
        )
        if guardian_email:
            _send_invite_email(invite)

        return Response(
            {
                "id": str(invite.id),
                "code": invite.code,
                "token": invite.token,
                "expires_at": invite.expires_at.isoformat(),
                "student_name": _mask_child_name(student.full_name, student.username),
                "invite_email": invite.invite_email,
            },
            status=status.HTTP_201_CREATED,
        )
