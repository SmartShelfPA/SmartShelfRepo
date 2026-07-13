from django.urls import path

from .views import (
    BookListView,
    BookshelfView,
    ConsentUpdateView,
    DataRequestView,
    ProfileView,
    PublisherBookCreateView,
    PublisherBookUpdateView,
    PublisherCatalogView,
    StaffBookCreateView,
)
from .dashboard_views import ParentDashboardView, StaffDashboardView, StaffNoteCreateView
from auth.parent_invite_views import ParentInviteCreateView

urlpatterns = [
    path("profile/", ProfileView.as_view(), name="profile"),
    path("books/", BookListView.as_view(), name="books"),
    path("bookshelf/", BookshelfView.as_view(), name="bookshelf"),
    path("parent/dashboard/", ParentDashboardView.as_view(), name="parent-dashboard"),
    path("staff/dashboard/", StaffDashboardView.as_view(), name="staff-dashboard"),
    path("staff/notes/", StaffNoteCreateView.as_view(), name="staff-notes-create"),
    path("staff/parent-invites/", ParentInviteCreateView.as_view(), name="staff-parent-invites"),
    path("staff/books/", StaffBookCreateView.as_view(), name="staff-books-create"),
    path("publisher/books", PublisherBookCreateView.as_view(), name="publisher-books-create"),
    path("publisher/books/<uuid:id>", PublisherBookUpdateView.as_view(), name="publisher-books-update"),
    path("publisher/catalog", PublisherCatalogView.as_view(), name="publisher-catalog"),
    # ── Privacy / compliance ────────────────────────────────────────────────
    path("privacy/data-request/", DataRequestView.as_view(), name="data-request"),
    path("privacy/consent/", ConsentUpdateView.as_view(), name="consent-update"),
]
