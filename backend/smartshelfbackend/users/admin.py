import json

from django.contrib import admin, messages
from django.contrib.auth.admin import UserAdmin as DjangoUserAdmin
from django.http import HttpResponse
from django.utils import timezone

from .models import (
    AuditLog,
    Book,
    Category,
    DataRequest,
    Organization,
    ParentalConsent,
    ParentInvite,
    PublisherProfile,
    ReadingProgress,
    RetentionPolicy,
    UserProfile,
)


@admin.register(Organization)
class OrganizationAdmin(admin.ModelAdmin):
    list_display = (
        "id", "name", "slug", "governs_student_data", "has_dpa", "data_storage_region", "created_at",
    )
    list_filter = ("governs_student_data",)
    search_fields = ("name", "slug", "privacy_contact_email")
    readonly_fields = ("id", "created_at")
    fieldsets = (
        (None, {"fields": ("id", "name", "slug", "address", "created_at")}),
        (
            "School / Institutional Governance",
            {
                "fields": (
                    "governs_student_data",
                    "privacy_contact_email",
                    "data_storage_region",
                    "dpa_accepted_at",
                    "dpa_accepted_by",
                ),
                "description": (
                    "Set governs_student_data=True once the school/org administrator has "
                    "signed a Data Processing Agreement. New student accounts under this org "
                    "will automatically be flagged as school-managed."
                ),
            },
        ),
    )

    @admin.display(boolean=True, description="DPA on file")
    def has_dpa(self, obj):
        return obj.has_dpa


@admin.register(UserProfile)
class UserProfileAdmin(DjangoUserAdmin):
    model = UserProfile
    list_display = (
        "id", "username", "email", "role", "organization",
        "is_staff", "is_locked_display", "failed_login_count", "scheduled_deletion_at",
    )
    list_filter = ("role", "organization", "is_staff", "is_superuser", "is_active", "school_managed")
    search_fields = ("username", "email", "full_name")
    readonly_fields = ("id", "last_login", "date_joined", "last_failed_login_at")
    filter_horizontal = ("managed_students", "groups", "user_permissions")
    actions = ["unlock_accounts", "schedule_deletion"]

    fieldsets = DjangoUserAdmin.fieldsets + (
        (
            "SmartShelf — Profile",
            {
                "fields": (
                    "organization",
                    "role",
                    "full_name",
                    "date_of_birth",
                    "avatar_url",
                    "staff_role",
                    "staff_department",
                    "managed_students",
                    "school_managed",
                )
            },
        ),
        (
            "SmartShelf — Compliance & Consent",
            {
                "fields": (
                    "terms_accepted_at",
                    "terms_version",
                    "privacy_accepted_at",
                    "privacy_version",
                    "analytics_consent",
                    "analytics_consent_at",
                )
            },
        ),
        (
            "SmartShelf — Security",
            {
                "fields": (
                    "failed_login_count",
                    "last_failed_login_at",
                    "locked_until",
                ),
                "description": (
                    "Accounts are temporarily locked after 5 consecutive failed logins. "
                    "Use 'Unlock accounts' action or clear locked_until manually."
                ),
            },
        ),
        (
            "SmartShelf — Retention",
            {
                "fields": ("scheduled_deletion_at",),
                "description": (
                    "When set, apply_retention_policy will anonymize this account after the "
                    "given timestamp."
                ),
            },
        ),
    )

    @admin.display(boolean=True, description="Locked?")
    def is_locked_display(self, obj):
        return obj.is_locked

    @admin.action(description="Unlock selected accounts (clear login lockout)")
    def unlock_accounts(self, request, queryset):
        locked_qs = queryset.filter(locked_until__isnull=False)
        actually_locked = list(locked_qs)
        updated = locked_qs.update(locked_until=None, failed_login_count=0)
        for user in actually_locked:
            AuditLog.log(
                AuditLog.Action.ADMIN_ACTION,
                actor=request.user,
                target=user,
                notes="Account lockout cleared by admin.",
            )
        self.message_user(request, f"{updated} account(s) unlocked.", messages.SUCCESS)

    @admin.action(description="Schedule selected accounts for deletion (set deletion date to now)")
    def schedule_deletion(self, request, queryset):
        updated = queryset.update(scheduled_deletion_at=timezone.now())
        for user in queryset:
            AuditLog.log(
                AuditLog.Action.ACCOUNT_DELETE_REQUEST,
                actor=request.user,
                target=user,
                notes="Account scheduled for deletion by admin via bulk action.",
            )
        self.message_user(
            request,
            f"{updated} account(s) scheduled for deletion. Run apply_retention_policy to anonymize.",
            messages.WARNING,
        )


@admin.register(Category)
class CategoryAdmin(admin.ModelAdmin):
    list_display = ("id", "name", "slug", "organization")
    list_filter = ("organization",)
    search_fields = ("name", "slug")


@admin.register(Book)
class BookAdmin(admin.ModelAdmin):
    list_display = (
        "id", "title", "author", "isbn", "rights_status", "license_type",
        "publisher", "organization",
    )
    list_filter = ("organization", "published_year", "rights_status", "license_type")
    search_fields = ("title", "author", "isbn", "content_source")
    filter_horizontal = ("category",)
    fieldsets = (
        (None, {"fields": ("isbn", "title", "author", "organization", "publisher", "published_year")}),
        ("Content Files", {"fields": ("cover_image_url", "cover_image_file", "content_file", "description", "page_count", "category")}),
        ("Rights & Licensing", {"fields": ("license_type", "rights_status", "content_source", "rights_notes")}),
    )


@admin.register(PublisherProfile)
class PublisherProfileAdmin(admin.ModelAdmin):
    list_display = ("id", "company_name", "contact_email", "is_verified", "created_at")
    list_filter = ("is_verified",)
    search_fields = ("company_name", "contact_email", "user__username")


@admin.register(ReadingProgress)
class ReadingProgressAdmin(admin.ModelAdmin):
    list_display = ("id", "user", "book", "status", "current_page", "rating", "last_read_at")
    list_filter = ("status", "organization")
    search_fields = ("user__username", "book__title", "book__isbn")


def _build_user_export(user: UserProfile) -> dict:
    """Gather all data held on a user into a serialisable dict (for GDPR/NDPA export)."""
    reading_progress = list(
        user.reading_progress.select_related("book").values(
            "book__title", "book__isbn", "status", "current_page", "last_read_at"
        )
    )
    data_requests = list(
        user.data_requests.values("request_type", "status", "submitted_at", "resolved_at")
    )
    managed_students = list(
        user.managed_students.values_list("username", flat=True)
    )
    parental_consents_given = list(
        user.given_parental_consents.values(
            "minor__username", "status", "consent_method", "granted_at"
        )
    )
    parental_consents_received = list(
        user.parental_consents.values(
            "guardian__username", "guardian_name", "guardian_email",
            "status", "consent_method", "granted_at",
        )
    )

    return {
        "export_generated_at": timezone.now().isoformat(),
        "profile": {
            "username": user.username,
            "email": user.email,
            "full_name": user.full_name,
            "role": user.role,
            "date_of_birth": str(user.date_of_birth) if user.date_of_birth else None,
            "organization": str(user.organization) if user.organization else None,
            "date_joined": user.date_joined.isoformat(),
        },
        "consent": {
            "terms_accepted_at": user.terms_accepted_at.isoformat() if user.terms_accepted_at else None,
            "terms_version": user.terms_version,
            "privacy_accepted_at": user.privacy_accepted_at.isoformat() if user.privacy_accepted_at else None,
            "privacy_version": user.privacy_version,
            "analytics_consent": user.analytics_consent,
        },
        "reading_progress": reading_progress,
        "data_requests": data_requests,
        "managed_students": managed_students,
        "parental_consents_as_guardian": parental_consents_given,
        "parental_consents_as_minor": parental_consents_received,
    }


@admin.register(DataRequest)
class DataRequestAdmin(admin.ModelAdmin):
    list_display = ("id", "user", "request_type", "status", "submitted_at", "resolved_at")
    list_filter = ("request_type", "status")
    search_fields = ("user__username", "user__email", "notes")
    readonly_fields = ("id", "user", "request_type", "notes", "submitted_at")
    actions = ["mark_in_progress", "mark_resolved", "export_user_data", "anonymize_user"]
    fieldsets = (
        ("Request Details", {"fields": ("id", "user", "request_type", "notes", "submitted_at")}),
        ("Resolution", {"fields": ("status", "admin_notes", "resolved_at")}),
    )

    @admin.action(description="Mark selected requests as In Progress")
    def mark_in_progress(self, request, queryset):
        updated = queryset.exclude(
            status=DataRequest.RequestStatus.COMPLETED
        ).update(status=DataRequest.RequestStatus.IN_PROGRESS)
        self.message_user(request, f"{updated} request(s) marked as In Progress.", messages.SUCCESS)

    @admin.action(description="Mark selected requests as Resolved / Completed")
    def mark_resolved(self, request, queryset):
        updated = queryset.update(
            status=DataRequest.RequestStatus.COMPLETED, resolved_at=timezone.now()
        )
        self.message_user(request, f"{updated} request(s) marked as Completed.", messages.SUCCESS)

    @admin.action(description="Export user data (JSON) for selected requests")
    def export_user_data(self, request, queryset):
        export_payload = []
        for dr in queryset.select_related("user"):
            export_payload.append(_build_user_export(dr.user))
            AuditLog.log(
                AuditLog.Action.DATA_ACCESS,
                actor=request.user,
                target=dr.user,
                notes=f"Admin exported user data in response to DataRequest #{dr.id} ({dr.request_type}).",
            )
        response = HttpResponse(
            json.dumps(export_payload, default=str, indent=2),
            content_type="application/json",
        )
        timestamp = timezone.now().strftime("%Y%m%d_%H%M%S")
        response["Content-Disposition"] = f'attachment; filename="user_export_{timestamp}.json"'
        return response

    @admin.action(description="Anonymize / soft-delete user accounts for selected requests")
    def anonymize_user(self, request, queryset):
        anonymized = 0
        for dr in queryset.filter(
            request_type__in=[DataRequest.RequestType.DELETE, DataRequest.RequestType.WITHDRAW_ANALYTICS],
            status__in=[DataRequest.RequestStatus.PENDING, DataRequest.RequestStatus.IN_PROGRESS],
        ).select_related("user"):
            user = dr.user
            uid = str(user.id)[:8]
            user.email = f"deleted_{uid}@anonymized.invalid"
            user.full_name = "Deleted User"
            user.username = f"deleted_{uid}"
            user.date_of_birth = None
            user.avatar_url = ""
            user.analytics_consent = False
            user.is_active = False
            user.save()
            dr.status = DataRequest.RequestStatus.COMPLETED
            dr.resolved_at = timezone.now()
            dr.admin_notes = f"Account anonymized by {request.user.username} on {timezone.now().date()}."
            dr.save()
            AuditLog.log(
                AuditLog.Action.DATA_DELETE,
                actor=request.user,
                target=user,
                notes=f"Account anonymized in response to DataRequest #{dr.id}.",
            )
            anonymized += 1
        self.message_user(
            request,
            f"{anonymized} account(s) anonymized and request(s) resolved.",
            messages.SUCCESS,
        )


@admin.register(AuditLog)
class AuditLogAdmin(admin.ModelAdmin):
    list_display = ("id", "action", "actor", "target_type", "target_id", "created_at")
    list_filter = ("action",)
    search_fields = ("actor__username", "actor__email", "target_id", "notes")
    readonly_fields = ("id", "actor", "action", "target_type", "target_id", "notes", "created_at")

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False


@admin.register(ParentalConsent)
class ParentalConsentAdmin(admin.ModelAdmin):
    list_display = (
        "id", "minor", "guardian_display", "status", "consent_method", "granted_at", "created_at",
    )
    list_filter = ("status", "consent_method")
    search_fields = (
        "minor__username", "minor__email",
        "guardian__username", "guardian_email", "guardian_name",
    )
    readonly_fields = ("id", "created_at")
    autocomplete_fields = ["minor", "guardian"]
    fieldsets = (
        (
            "Minor Account",
            {"fields": ("id", "minor", "created_at")},
        ),
        (
            "Guardian",
            {"fields": ("guardian", "guardian_name", "guardian_email")},
        ),
        (
            "Consent Status",
            {"fields": ("status", "consent_method", "granted_at", "revoked_at", "notes")},
        ),
    )
    actions = ["grant_consent", "revoke_consent"]

    @admin.display(description="Guardian")
    def guardian_display(self, obj):
        if obj.guardian:
            return str(obj.guardian)
        return obj.guardian_name or obj.guardian_email or "—"

    @admin.action(description="Grant consent for selected records")
    def grant_consent(self, request, queryset):
        updated = 0
        for consent in queryset.exclude(status=ParentalConsent.ConsentStatus.GRANTED):
            consent.grant(method=ParentalConsent.ConsentMethod.PAPER)
            AuditLog.log(
                AuditLog.Action.CONSENT_CHANGE,
                actor=request.user,
                target=consent.minor,
                notes=f"Parental consent #{consent.id} manually granted by admin.",
            )
            updated += 1
        self.message_user(request, f"{updated} consent record(s) granted.", messages.SUCCESS)

    @admin.action(description="Revoke consent for selected records")
    def revoke_consent(self, request, queryset):
        updated = 0
        for consent in queryset.exclude(status=ParentalConsent.ConsentStatus.REVOKED):
            consent.revoke()
            AuditLog.log(
                AuditLog.Action.CONSENT_CHANGE,
                actor=request.user,
                target=consent.minor,
                notes=f"Parental consent #{consent.id} revoked by admin.",
            )
            updated += 1
        self.message_user(request, f"{updated} consent record(s) revoked.", messages.SUCCESS)


@admin.register(RetentionPolicy)
class RetentionPolicyAdmin(admin.ModelAdmin):
    list_display = ("data_category", "scope", "organization", "retention_days", "updated_at")
    list_filter = ("scope", "data_category")
    search_fields = ("organization__name", "notes")
    readonly_fields = ("id", "created_at", "updated_at")
    fieldsets = (
        (None, {"fields": ("id", "scope", "organization", "data_category", "retention_days")}),
        ("Documentation", {"fields": ("notes", "created_at", "updated_at")}),
    )


@admin.register(ParentInvite)
class ParentInviteAdmin(admin.ModelAdmin):
    list_display = ("code", "student", "invite_email", "status", "expires_at", "created_at")
    list_filter = ("status", "organization")
    search_fields = ("code", "student__username", "invite_email")
    readonly_fields = ("id", "code", "token", "created_at", "accepted_at", "accepted_by")
    raw_id_fields = ("student", "created_by", "accepted_by")
