import uuid

from django.contrib.auth.models import AbstractUser
from django.core.exceptions import ValidationError
from django.db import models
from django.utils import timezone

from .tenant import OrganizationScopedManager, OrganizationScopedUserManager


class Organization(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=255)
    slug = models.SlugField(unique=True)
    address = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    # ── School / institutional governance ──────────────────────────────────
    privacy_contact_email = models.EmailField(
        blank=True,
        help_text="School/org DPO or privacy contact email for data requests.",
    )
    dpa_accepted_at = models.DateTimeField(
        null=True, blank=True,
        help_text="When the school/org administrator accepted the Data Processing Agreement.",
    )
    dpa_accepted_by = models.CharField(
        max_length=255, blank=True,
        help_text="Name/title of person who accepted the DPA on behalf of the org.",
    )
    # Controls whether student accounts in this org are flagged school_managed=True on creation.
    governs_student_data = models.BooleanField(
        default=False,
        help_text=(
            "True = this org has accepted a DPA and governs student data processing. "
            "New student accounts registered under this org will be school_managed=True."
        ),
    )
    data_storage_region = models.CharField(
        max_length=100, blank=True,
        help_text="Region/country where this org's data is primarily stored (for disclosure purposes).",
    )

    class Meta:
        ordering = ["name"]

    def __str__(self) -> str:
        return self.name

    @property
    def has_dpa(self) -> bool:
        return bool(self.dpa_accepted_at)


class RetentionPolicy(models.Model):
    """
    Platform-level or org-level data retention rules.

    A matching row is found by `scope='platform'` (applies to all users) or
    `scope='org'` with a matching `organization`.  Org-level policies take
    precedence over the platform default when both exist.
    """

    class Scope(models.TextChoices):
        PLATFORM = "platform", "Platform-wide default"
        ORG = "org", "Organization-specific override"

    class DataCategory(models.TextChoices):
        ACCOUNT = "account", "User account & profile data"
        READING = "reading", "Reading progress & history"
        AUDIT = "audit", "Audit log entries"
        CONSENT = "consent", "Consent records"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    scope = models.CharField(max_length=10, choices=Scope.choices, default=Scope.PLATFORM)
    organization = models.ForeignKey(
        "Organization",
        on_delete=models.CASCADE,
        null=True, blank=True,
        related_name="retention_policies",
        help_text="Required when scope=org; ignored when scope=platform.",
    )
    data_category = models.CharField(max_length=20, choices=DataCategory.choices)
    retention_days = models.PositiveIntegerField(
        help_text=(
            "Number of days after account deletion/deactivation before data is permanently "
            "anonymized. Use 0 for immediate deletion."
        ),
    )
    notes = models.TextField(
        blank=True,
        help_text="Legal basis / justification for this retention period.",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "Retention Policy"
        verbose_name_plural = "Retention Policies"
        unique_together = [("scope", "organization", "data_category")]
        ordering = ["scope", "data_category"]

    def __str__(self) -> str:
        org = f" ({self.organization})" if self.organization else ""
        return f"{self.get_data_category_display()}{org} — {self.retention_days}d"


class UserProfile(AbstractUser):
    class Role(models.TextChoices):
        STUDENT = "student", "Student"
        PARENT = "parent", "Parent"
        STAFF = "staff", "School Staff"
        PUBLISHER = "publisher", "Publisher"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    organization = models.ForeignKey(
        Organization,
        on_delete=models.CASCADE,
        related_name="users",
        null=True,
        blank=True,
    )
    role = models.CharField(max_length=20, choices=Role.choices)
    full_name = models.CharField(max_length=255)
    date_of_birth = models.DateField(null=True, blank=True)
    student_class = models.CharField(max_length=120, blank=True)
    avatar_url = models.URLField(blank=True)

    # Staff-specific fields
    staff_role = models.CharField(max_length=120, blank=True)
    staff_department = models.CharField(max_length=120, blank=True)

    # Parent-specific relation
    managed_students = models.ManyToManyField(
        "self",
        related_name="managed_by_parents",
        symmetrical=False,
        blank=True,
    )

    # ── Compliance / consent fields ─────────────────────────────────────────
    # Timestamps are stored in UTC; null = not yet accepted.
    terms_accepted_at = models.DateTimeField(
        null=True, blank=True,
        help_text="UTC timestamp when user accepted the current Terms of Use.",
    )
    privacy_accepted_at = models.DateTimeField(
        null=True, blank=True,
        help_text="UTC timestamp when user accepted the Privacy Policy.",
    )
    terms_version = models.CharField(
        max_length=20, blank=True, default="",
        help_text="Version tag of the Terms accepted (e.g. '2024-06').",
    )
    privacy_version = models.CharField(
        max_length=20, blank=True, default="",
        help_text="Version tag of the Privacy Policy accepted.",
    )
    analytics_consent = models.BooleanField(
        default=False,
        help_text="User opted in to optional analytics/improvement data collection.",
    )
    analytics_consent_at = models.DateTimeField(
        null=True, blank=True,
        help_text="UTC timestamp when analytics consent was last changed.",
    )
    # school_managed=True means the account is governed by the linked school/org,
    # which may have additional data-processing agreements.
    school_managed = models.BooleanField(
        default=False,
        help_text="Account is managed by the linked school/org (Phase 2 governance).",
    )

    # ── Data retention ──────────────────────────────────────────────────────
    scheduled_deletion_at = models.DateTimeField(
        null=True, blank=True,
        help_text=(
            "When set, the account is queued for anonymization. "
            "The apply_retention_policy management command will delete/anonymize it after this date."
        ),
    )

    # ── Security / account-lockout ───────────────────────────────────────────
    failed_login_count = models.PositiveSmallIntegerField(
        default=0,
        help_text="Consecutive failed login attempts since last successful login.",
    )
    last_failed_login_at = models.DateTimeField(
        null=True, blank=True,
        help_text="Timestamp of most recent failed login attempt.",
    )
    locked_until = models.DateTimeField(
        null=True, blank=True,
        help_text=(
            "Account is temporarily locked for login until this timestamp. "
            "Null means not locked."
        ),
    )

    objects = OrganizationScopedUserManager()

    @property
    def is_locked(self) -> bool:
        """True when the account is currently in a temporary lockout window."""
        if not self.locked_until:
            return False
        return timezone.now() < self.locked_until

    def record_failed_login(self, max_attempts: int = 5, lockout_minutes: int = 30) -> None:
        """Increment failure counter and lock the account if threshold is exceeded."""
        self.failed_login_count += 1
        self.last_failed_login_at = timezone.now()
        if self.failed_login_count >= max_attempts:
            self.locked_until = timezone.now() + timezone.timedelta(minutes=lockout_minutes)
        self.save(update_fields=["failed_login_count", "last_failed_login_at", "locked_until"])

    def clear_failed_logins(self) -> None:
        """Reset failure counter and any lockout after a successful authentication."""
        if self.failed_login_count > 0 or self.locked_until is not None:
            self.failed_login_count = 0
            self.locked_until = None
            self.save(update_fields=["failed_login_count", "locked_until"])

    @property
    def is_minor_account(self) -> bool:
        """True when date_of_birth indicates the user is under 18."""
        if not self.date_of_birth:
            return False
        today = timezone.now().date()
        age = (today - self.date_of_birth).days // 365
        return age < 18

    @property
    def has_accepted_policies(self) -> bool:
        return bool(self.terms_accepted_at and self.privacy_accepted_at)

    def record_policy_acceptance(
        self,
        *,
        terms_version: str = "",
        privacy_version: str = "",
        analytics: bool | None = None,
        save: bool = True,
    ) -> None:
        """Stamp policy acceptance. Call from RegisterView / ConsentUpdateView."""
        now = timezone.now()
        if not self.terms_accepted_at:
            self.terms_accepted_at = now
        if terms_version:
            self.terms_version = terms_version
        if not self.privacy_accepted_at:
            self.privacy_accepted_at = now
        if privacy_version:
            self.privacy_version = privacy_version
        if analytics is not None:
            self.analytics_consent = analytics
            self.analytics_consent_at = now
        if save:
            self.save(
                update_fields=[
                    "terms_accepted_at", "terms_version",
                    "privacy_accepted_at", "privacy_version",
                    "analytics_consent", "analytics_consent_at",
                ]
            )

    def clean(self) -> None:
        super().clean()
        if self.role == self.Role.STAFF:
            return
        if self.staff_role or self.staff_department:
            raise ValidationError(
                "staff_role and staff_department can only be set for staff users."
            )

    def __str__(self) -> str:
        return self.username


class Category(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    organization = models.ForeignKey(
        Organization, on_delete=models.CASCADE, related_name="categories", null=True, blank=True
    )
    name = models.CharField(max_length=120)
    slug = models.SlugField()

    class Meta:
        unique_together = ("organization", "slug")
        ordering = ["name"]

    def __str__(self) -> str:
        return self.name


class Book(models.Model):

    class LicenseType(models.TextChoices):
        PUBLIC_DOMAIN = "public_domain", "Public Domain"
        LICENSED = "licensed", "Licensed (permission granted)"
        RESTRICTED = "restricted", "Restricted (do not distribute)"
        UNKNOWN = "unknown", "Unknown — needs review"

    class RightsStatus(models.TextChoices):
        APPROVED = "approved", "Approved for distribution"
        DRAFT = "draft", "Draft — not yet approved"
        EXPIRED = "expired", "License expired"
        RESTRICTED = "restricted", "Restricted — internal use only"
        UNKNOWN = "unknown", "Unknown — needs review"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    organization = models.ForeignKey(
        Organization, on_delete=models.CASCADE, related_name="books", null=True, blank=True
    )
    publisher = models.ForeignKey(
        UserProfile,
        on_delete=models.SET_NULL,
        related_name="published_books",
        null=True,
        blank=True,
    )
    isbn = models.CharField(max_length=20)
    title = models.CharField(max_length=255)
    author = models.CharField(max_length=255)
    cover_image_url = models.URLField(blank=True)
    cover_image_file = models.FileField(upload_to="book-covers/", blank=True)
    description = models.TextField(blank=True)
    page_count = models.PositiveIntegerField()
    published_year = models.PositiveIntegerField(null=True, blank=True)
    category = models.ManyToManyField(Category, related_name="books", blank=True)
    content_file = models.FileField(upload_to="book-content/", blank=True)

    # ── Content rights / licensing ──────────────────────────────────────────
    license_type = models.CharField(
        max_length=20,
        choices=LicenseType.choices,
        default=LicenseType.UNKNOWN,
    )
    rights_status = models.CharField(
        max_length=20,
        choices=RightsStatus.choices,
        default=RightsStatus.DRAFT,
        help_text="Only 'approved' books should be production-visible.",
    )
    content_source = models.CharField(
        max_length=512, blank=True,
        help_text="Source or publisher attribution for rights tracking.",
    )
    rights_notes = models.TextField(blank=True)

    objects = OrganizationScopedManager()

    class Meta:
        unique_together = ("organization", "isbn")
        ordering = ["title"]

    def __str__(self) -> str:
        return f"{self.title} ({self.isbn})"


class PublisherProfile(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.OneToOneField(
        UserProfile, on_delete=models.CASCADE, related_name="publisher_profile"
    )
    company_name = models.CharField(max_length=255)
    contact_email = models.EmailField()
    is_verified = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["company_name"]

    @property
    def catalog_size(self) -> int:
        return self.user.published_books.count()

    def __str__(self) -> str:
        return self.company_name


class DataRequest(models.Model):
    """
    Tracks user-submitted data rights requests (access, deletion, correction).
    Admins handle these manually; this model creates a visible audit trail.
    """

    class RequestType(models.TextChoices):
        EXPORT = "export", "Export my data"
        DELETE = "delete", "Delete my account"
        CORRECT = "correct", "Correct my information"
        WITHDRAW_ANALYTICS = "withdraw_analytics", "Withdraw analytics consent"
        OTHER = "other", "Other"

    class RequestStatus(models.TextChoices):
        PENDING = "pending", "Pending"
        IN_PROGRESS = "in_progress", "In Progress"
        COMPLETED = "completed", "Completed"
        REJECTED = "rejected", "Rejected"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(
        UserProfile,
        on_delete=models.SET_NULL,
        null=True,
        related_name="data_requests",
    )
    request_type = models.CharField(max_length=30, choices=RequestType.choices)
    status = models.CharField(
        max_length=20, choices=RequestStatus.choices, default=RequestStatus.PENDING
    )
    notes = models.TextField(
        blank=True, help_text="User-provided details or admin resolution notes."
    )
    admin_notes = models.TextField(
        blank=True, help_text="Internal notes (not shown to user)."
    )
    submitted_at = models.DateTimeField(auto_now_add=True)
    resolved_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["-submitted_at"]

    def __str__(self) -> str:
        return f"{self.get_request_type_display()} — {self.user} [{self.status}]"


class AuditLog(models.Model):
    """
    Lightweight audit trail for compliance-sensitive admin actions.
    Not a substitute for full-system logging; covers key events only.
    """

    class Action(models.TextChoices):
        CONTENT_PUBLISH = "content_publish", "Content published"
        CONTENT_UNPUBLISH = "content_unpublish", "Content unpublished"
        ACCOUNT_DELETE_REQUEST = "account_delete_request", "Account deletion requested"
        ACCOUNT_DELETED = "account_deleted", "Account deleted"
        CONSENT_CHANGE = "consent_change", "Consent updated"
        POLICY_ACCEPT = "policy_accept", "Policy accepted"
        DATA_EXPORT = "data_export", "Data export generated"
        DATA_ACCESS = "data_access", "User data accessed by admin"
        DATA_DELETE = "data_delete", "User data deleted / anonymized"
        ADMIN_ACTION = "admin_action", "Admin action"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    actor = models.ForeignKey(
        UserProfile,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="audit_actions",
        help_text="The user who performed the action (null for system events).",
    )
    action = models.CharField(max_length=40, choices=Action.choices)
    target_type = models.CharField(
        max_length=80, blank=True,
        help_text="Django content type label of the affected object, e.g. 'users.userprofile'.",
    )
    target_id = models.CharField(
        max_length=80, blank=True,
        help_text="String PK of the affected object.",
    )
    notes = models.TextField(blank=True, help_text="Human-readable event summary.")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self) -> str:
        return f"{self.get_action_display()} by {self.actor} at {self.created_at:%Y-%m-%d %H:%M}"

    @classmethod
    def log(
        cls,
        action: str,
        *,
        actor=None,
        target=None,
        notes: str = "",
    ) -> "AuditLog":
        """Convenience helper: AuditLog.log(AuditLog.Action.CONSENT_CHANGE, actor=user, target=user)."""
        target_type = ""
        target_id = ""
        if target is not None:
            target_type = f"{target._meta.app_label}.{target._meta.model_name}"
            target_id = str(target.pk)
        return cls.objects.create(
            actor=actor,
            action=action,
            target_type=target_type,
            target_id=target_id,
            notes=notes,
        )


class ParentalConsent(models.Model):
    """
    Records explicit parental/guardian consent for a minor (under-18) user account.

    This is *in addition* to the parent's managed_students link — it captures the
    formal consent act with timestamp and method, required for COPPA/NDPA compliance
    when a child account is created or linked.
    """

    class ConsentMethod(models.TextChoices):
        IN_APP = "in_app", "Parent completed in-app consent flow"
        SCHOOL = "school", "School provided parental consent documentation"
        EMAIL = "email", "Parental consent received by email"
        PAPER = "paper", "Signed paper consent on file"

    class ConsentStatus(models.TextChoices):
        PENDING = "pending", "Pending — awaiting guardian confirmation"
        GRANTED = "granted", "Consent granted"
        REVOKED = "revoked", "Consent revoked"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    minor = models.ForeignKey(
        UserProfile,
        on_delete=models.CASCADE,
        related_name="parental_consents",
        help_text="The under-18 student account this consent covers.",
    )
    guardian = models.ForeignKey(
        UserProfile,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="given_parental_consents",
        help_text="The parent/guardian UserProfile, if they have an account. "
                  "Null if consent was provided by a school or off-platform.",
    )
    guardian_name = models.CharField(
        max_length=255, blank=True,
        help_text="Name of guardian (required when guardian account is not linked).",
    )
    guardian_email = models.EmailField(
        blank=True,
        help_text="Email address used for consent confirmation.",
    )
    status = models.CharField(
        max_length=20, choices=ConsentStatus.choices, default=ConsentStatus.PENDING
    )
    consent_method = models.CharField(
        max_length=20, choices=ConsentMethod.choices, default=ConsentMethod.IN_APP
    )
    granted_at = models.DateTimeField(null=True, blank=True)
    revoked_at = models.DateTimeField(null=True, blank=True)
    notes = models.TextField(
        blank=True, help_text="Admin notes or reference to paper consent document."
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]
        verbose_name = "Parental Consent"
        verbose_name_plural = "Parental Consents"

    def __str__(self) -> str:
        return f"Consent for {self.minor} [{self.status}]"

    def grant(self, method: str = ConsentMethod.IN_APP, save: bool = True) -> None:
        self.status = self.ConsentStatus.GRANTED
        self.consent_method = method
        self.granted_at = timezone.now()
        if save:
            self.save(update_fields=["status", "consent_method", "granted_at"])

    def revoke(self, save: bool = True) -> None:
        self.status = self.ConsentStatus.REVOKED
        self.revoked_at = timezone.now()
        if save:
            self.save(update_fields=["status", "revoked_at"])


class ReadingProgress(models.Model):
    class Status(models.TextChoices):
        TO_READ = "to-read", "To Read"
        READING = "reading", "Reading"
        COMPLETED = "completed", "Completed"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    organization = models.ForeignKey(
        Organization, on_delete=models.CASCADE, related_name="reading_progress"
    )
    user = models.ForeignKey(
        UserProfile, on_delete=models.CASCADE, related_name="reading_progress"
    )
    book = models.ForeignKey(Book, on_delete=models.CASCADE, related_name="reading_progress")
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.TO_READ)
    current_page = models.PositiveIntegerField(default=0)
    last_read_at = models.DateTimeField(auto_now=True)
    rating = models.PositiveSmallIntegerField(null=True, blank=True)

    objects = OrganizationScopedManager()

    class Meta:
        unique_together = ("user", "book")
        ordering = ["-last_read_at"]

    @property
    def percent_complete(self) -> float:
        if self.book.page_count <= 0:
            return 0.0
        return round((self.current_page / self.book.page_count) * 100, 2)

    def clean(self) -> None:
        super().clean()
        if self.user.organization_id != self.book.organization_id:
            raise ValidationError("User and book must belong to the same organization.")

    def save(self, *args, **kwargs):
        if self.user_id and self.book_id:
            self.organization_id = self.user.organization_id
        super().save(*args, **kwargs)
