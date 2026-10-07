"""School administration: join code, member accounts and school-only resources."""

from __future__ import annotations

import json

from django.conf import settings
from django.db import transaction
from django.shortcuts import get_object_or_404
from rest_framework import serializers, status
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from auth.views import CURRENT_PRIVACY_VERSION, CURRENT_TERMS_VERSION
from learning.models import ProtectedPdfAsset
from learning.serializers import ProtectedPdfAssetSerializer
from users.models import AuditLog, UserProfile
from users.permissions import IsSchoolAdmin, IsStaffRole

from .accounts import generate_join_code, set_temp_password, unique_username


def _member_payload(u: UserProfile) -> dict:
    return {
        "id": str(u.id),
        "username": u.username,
        "full_name": u.full_name,
        "email": u.email,
        "role": u.role,
        "student_class": u.student_class,
        "staff_role": u.staff_role,
        "is_school_admin": u.is_school_admin,
        "is_active": u.is_active,
        "linked_children": [
            {"id": str(c.id), "name": c.full_name or c.username} for c in u.managed_students.all()
        ]
        if u.role == UserProfile.Role.PARENT
        else [],
        "last_login": u.last_login.isoformat() if u.last_login else None,
    }


class SchoolOverviewView(APIView):
    """GET (any staff) / PATCH (school admin) /api/v1/school/"""

    permission_classes = [IsAuthenticated, IsStaffRole]

    def get(self, request):
        org = request.user.organization
        if org is None:
            return Response({"error": "Your account is not linked to a school."}, status=400)
        members = UserProfile.objects.filter(organization=org, is_active=True)
        payload = {
            "id": str(org.id),
            "name": org.name,
            "slug": org.slug,
            "requires_join_code": bool(org.join_code),
            "is_school_admin": request.user.is_school_admin,
            "counts": {
                "students": members.filter(role=UserProfile.Role.STUDENT).count(),
                "teachers": members.filter(role=UserProfile.Role.STAFF).count(),
                "parents": members.filter(role=UserProfile.Role.PARENT).count(),
                "resources": ProtectedPdfAsset.objects.filter(organization=org).count(),
            },
        }
        if request.user.is_school_admin:
            payload["join_code"] = org.join_code
        return Response(payload)

    def patch(self, request):
        if not IsSchoolAdmin().has_permission(request, self):
            return Response({"error": IsSchoolAdmin.message}, status=status.HTTP_403_FORBIDDEN)
        org = request.user.organization
        if request.data.get("regenerate_join_code"):
            org.join_code = generate_join_code()
        elif "join_code" in request.data:
            code = str(request.data.get("join_code") or "").strip().upper()
            if code and (len(code) < 4 or not code.isalnum()):
                return Response(
                    {"error": "School codes must be at least 4 letters or numbers."}, status=400
                )
            org.join_code = code
        org.save(update_fields=["join_code"])
        AuditLog.log(
            AuditLog.Action.ADMIN_ACTION,
            actor=request.user,
            target=request.user,
            notes=f"School join code updated for {org.slug}.",
        )
        return Response({"join_code": org.join_code, "requires_join_code": bool(org.join_code)})


class MemberCreateSerializer(serializers.Serializer):
    role = serializers.ChoiceField(choices=[UserProfile.Role.STUDENT, UserProfile.Role.STAFF])
    full_name = serializers.CharField(max_length=255)
    email = serializers.EmailField()
    username = serializers.CharField(required=False, allow_blank=True, max_length=150)
    student_class = serializers.CharField(required=False, allow_blank=True, max_length=120)
    staff_role = serializers.CharField(required=False, allow_blank=True, max_length=120)
    is_school_admin = serializers.BooleanField(required=False, default=False)

    def validate(self, attrs):
        if attrs["role"] == UserProfile.Role.STUDENT and not (attrs.get("student_class") or "").strip():
            raise serializers.ValidationError("Students need a class (e.g. SS2A).")
        if UserProfile.objects.filter(email__iexact=attrs["email"]).exists():
            raise serializers.ValidationError("An account with that email already exists.")
        username = (attrs.get("username") or "").strip()
        if username and UserProfile.objects.filter(username=username).exists():
            raise serializers.ValidationError("That username is taken.")
        return attrs


class SchoolMemberListCreateView(APIView):
    permission_classes = [IsAuthenticated, IsSchoolAdmin]

    def get(self, request):
        qs = UserProfile.objects.filter(organization_id=request.user.organization_id).prefetch_related(
            "managed_students"
        ).order_by("role", "student_class", "full_name")
        role = request.query_params.get("role")
        if role:
            qs = qs.filter(role=role)
        return Response([_member_payload(u) for u in qs])

    @transaction.atomic
    def post(self, request):
        ser = MemberCreateSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        data = ser.validated_data
        org = request.user.organization
        is_staff = data["role"] == UserProfile.Role.STAFF
        user = UserProfile.objects.create_user(
            username=unique_username(data["full_name"], data.get("username", "")),
            email=data["email"].strip(),
            password=None,
            role=data["role"],
            full_name=data["full_name"].strip(),
            organization=org,
            student_class=(data.get("student_class") or "").strip() if not is_staff else "",
            staff_role=((data.get("staff_role") or "Teacher").strip()) if is_staff else "",
            is_school_admin=bool(data.get("is_school_admin")) and is_staff,
            school_managed=bool(org.governs_student_data),
        )
        user.record_policy_acceptance(
            terms_version=CURRENT_TERMS_VERSION, privacy_version=CURRENT_PRIVACY_VERSION, save=True
        )
        password = set_temp_password(user)
        AuditLog.log(
            AuditLog.Action.ADMIN_ACTION,
            actor=request.user,
            target=user,
            notes=f"School admin created {user.role} account.",
        )
        return Response(
            {**_member_payload(user), "temporary_password": password},
            status=status.HTTP_201_CREATED,
        )


class SchoolMemberDetailView(APIView):
    permission_classes = [IsAuthenticated, IsSchoolAdmin]

    def _get(self, request, pk):
        return get_object_or_404(
            UserProfile.objects.prefetch_related("managed_students"),
            pk=pk,
            organization_id=request.user.organization_id,
        )

    def patch(self, request, pk):
        member = self._get(request, pk)
        if member.pk == request.user.pk and request.data.get("is_active") is False:
            return Response({"error": "You cannot deactivate your own account."}, status=400)
        fields = []
        for field in ("full_name", "student_class", "staff_role"):
            if field in request.data:
                setattr(member, field, str(request.data.get(field) or "").strip()[:255])
                fields.append(field)
        if "is_active" in request.data:
            member.is_active = bool(request.data.get("is_active"))
            fields.append("is_active")
        if "is_school_admin" in request.data and member.role == UserProfile.Role.STAFF:
            member.is_school_admin = bool(request.data.get("is_school_admin"))
            fields.append("is_school_admin")
        if fields:
            member.save(update_fields=fields)
            AuditLog.log(
                AuditLog.Action.ADMIN_ACTION,
                actor=request.user,
                target=member,
                notes=f"School admin updated {', '.join(fields)}.",
            )
        return Response(_member_payload(member))


class SchoolMemberResetPasswordView(APIView):
    permission_classes = [IsAuthenticated, IsSchoolAdmin]

    def post(self, request, pk):
        member = get_object_or_404(
            UserProfile, pk=pk, organization_id=request.user.organization_id
        )
        password = set_temp_password(member)
        AuditLog.log(
            AuditLog.Action.ADMIN_ACTION,
            actor=request.user,
            target=member,
            notes="School admin reset password.",
        )
        return Response({"id": str(member.id), "username": member.username, "temporary_password": password})


def _parse_classes(raw) -> list[str]:
    if raw is None or raw == "":
        return []
    if isinstance(raw, str):
        try:
            parsed = json.loads(raw)
        except ValueError:
            parsed = raw.split(",")
    else:
        parsed = raw
    if not isinstance(parsed, list):
        parsed = [parsed]
    return [str(c).strip()[:120] for c in parsed if str(c).strip()][:50]


def _resource_payload(asset: ProtectedPdfAsset) -> dict:
    return {
        **ProtectedPdfAssetSerializer(asset).data,
        "id": str(asset.id),
        "audience_classes": asset.audience_classes or [],
        "uploaded_by_id": str(asset.uploaded_by_id) if asset.uploaded_by_id else None,
        "uploaded_by_name": (asset.uploaded_by.full_name or asset.uploaded_by.username)
        if asset.uploaded_by
        else "",
    }


class SchoolResourceListCreateView(APIView):
    """GET (any school member) / POST (staff) /api/v1/school/resources/"""

    permission_classes = [IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    def get(self, request):
        user = request.user
        if not user.organization_id:
            return Response([])
        qs = ProtectedPdfAsset.objects.filter(
            organization_id=user.organization_id,
            uploaded_by__isnull=False,
            published=True,
            rights_status=ProtectedPdfAsset.RightsStatus.APPROVED,
        ).select_related("uploaded_by").order_by("-created_at")
        items = [a for a in qs if a.user_can_access(user)]
        return Response([_resource_payload(a) for a in items])

    def post(self, request):
        user = request.user
        if user.role != UserProfile.Role.STAFF or not user.organization_id:
            return Response({"error": "Only teachers can upload school resources."}, status=403)
        upload = request.FILES.get("file")
        title = str(request.data.get("title") or "").strip()
        if not upload or not title:
            return Response({"error": "A title and a PDF file are required."}, status=400)
        max_bytes = settings.SCHOOL_RESOURCE_MAX_MB * 1024 * 1024
        if upload.size > max_bytes:
            return Response(
                {"error": f"PDFs must be {settings.SCHOOL_RESOURCE_MAX_MB} MB or smaller."}, status=400
            )
        head = upload.read(5)
        upload.seek(0)
        if head != b"%PDF-":
            return Response({"error": "Only PDF files can be uploaded."}, status=400)
        if str(request.data.get("rights_confirmed") or "").lower() not in ("true", "1", "yes", "on"):
            return Response(
                {"error": "Confirm your school owns or is licensed to share this material."},
                status=400,
            )

        asset = ProtectedPdfAsset(
            organization_id=user.organization_id,
            title=title[:255],
            subject=str(request.data.get("subject") or "").strip()[:120],
            description=str(request.data.get("description") or "").strip()[:2000],
            published=True,
            rights_status=ProtectedPdfAsset.RightsStatus.APPROVED,
            access_level=ProtectedPdfAsset.AccessLevel.ORGANIZATION,
            audience_classes=_parse_classes(request.data.get("audience_classes")),
            uploaded_by=user,
        )
        asset.pdf_file.save("upload.pdf", upload, save=False)
        asset.save()
        AuditLog.log(
            AuditLog.Action.CONTENT_PUBLISH,
            actor=user,
            target=user,
            notes=f"School resource uploaded: {asset.title} ({asset.id}).",
        )
        return Response(_resource_payload(asset), status=status.HTTP_201_CREATED)


class SchoolResourceDetailView(APIView):
    permission_classes = [IsAuthenticated, IsStaffRole]

    def _get(self, request, pk):
        asset = get_object_or_404(
            ProtectedPdfAsset.objects.select_related("uploaded_by"),
            pk=pk,
            organization_id=request.user.organization_id,
            uploaded_by__isnull=False,
        )
        if not (request.user.is_school_admin or asset.uploaded_by_id == request.user.pk):
            return None
        return asset

    def patch(self, request, pk):
        asset = self._get(request, pk)
        if asset is None:
            return Response({"error": "Only the uploader or a school admin can edit this."}, status=403)
        for field, limit in (("title", 255), ("subject", 120), ("description", 2000)):
            if field in request.data:
                setattr(asset, field, str(request.data.get(field) or "").strip()[:limit])
        if "audience_classes" in request.data:
            asset.audience_classes = _parse_classes(request.data.get("audience_classes"))
            asset.rights_version += 1
        if not asset.title:
            return Response({"error": "Title cannot be empty."}, status=400)
        asset.save()
        return Response(_resource_payload(asset))

    def delete(self, request, pk):
        asset = self._get(request, pk)
        if asset is None:
            return Response({"error": "Only the uploader or a school admin can delete this."}, status=403)
        title = asset.title
        if asset.pdf_file:
            asset.pdf_file.delete(save=False)
        asset.delete()
        AuditLog.log(
            AuditLog.Action.CONTENT_UNPUBLISH,
            actor=request.user,
            target=request.user,
            notes=f"School resource deleted: {title}.",
        )
        return Response(status=status.HTTP_204_NO_CONTENT)
