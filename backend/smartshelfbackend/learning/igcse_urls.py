"""
IGCSE reader routes (``/api/v1/igcse/books/*``).

Study-agent catalog lives under ``/api/igcse/*`` (see ``igcse_catalog`` app).
"""

from django.urls import path

from learning import views

urlpatterns = [
    path("bundled/", views.IgcsBundledBookListView.as_view(), name="igcse-bundled-list"),
    path(
        "bundled/<str:book_id>/epub/",
        views.IgcsBundledEpubDownloadView.as_view(),
        name="igcse-bundled-epub",
    ),
    path(
        "bundled/<str:book_id>/pdf/",
        views.IgcsBundledPdfDownloadView.as_view(),
        name="igcse-bundled-pdf",
    ),
    # ── Protected PDF assets (signed-token download flow) ──────────────────
    path("pdfs/", views.ProtectedPdfListView.as_view(), name="protected-pdf-list"),
    path("pdfs/<uuid:pk>/", views.ProtectedPdfDetailView.as_view(), name="protected-pdf-detail"),
    path(
        "pdfs/<uuid:pk>/authorize-download/",
        views.ProtectedPdfAuthorizeDownloadView.as_view(),
        name="protected-pdf-authorize",
    ),
    path(
        "pdfs/<uuid:pk>/download/",
        views.ProtectedPdfDownloadView.as_view(),
        name="protected-pdf-download",
    ),
    path("books/", views.IgcsBookListView.as_view(), name="igcse-books-list"),
    path("books/<uuid:pk>/", views.IgcsBookDetailView.as_view(), name="igcse-books-detail"),
    path(
        "books/<uuid:pk>/epub/",
        views.IgcsBookEpubDownloadView.as_view(),
        name="igcse-books-epub",
    ),
    path(
        "books/<uuid:pk>/progress/",
        views.IgcsReadingProgressView.as_view(),
        name="igcse-books-progress",
    ),
    path(
        "books/<uuid:book_pk>/bookmarks/",
        views.IgcsBookmarkListCreateView.as_view(),
        name="igcse-bookmarks-list",
    ),
    path(
        "books/<uuid:book_pk>/bookmarks/<uuid:pk>/",
        views.IgcsBookmarkDetailView.as_view(),
        name="igcse-bookmarks-detail",
    ),
    path(
        "books/<uuid:book_pk>/highlights/",
        views.IgcsHighlightListCreateView.as_view(),
        name="igcse-highlights-list",
    ),
    path(
        "books/<uuid:book_pk>/highlights/<uuid:pk>/",
        views.IgcsHighlightDetailView.as_view(),
        name="igcse-highlights-detail",
    ),
    path(
        "books/<uuid:book_pk>/notes/",
        views.IgcsNoteListCreateView.as_view(),
        name="igcse-notes-list",
    ),
    path(
        "books/<uuid:book_pk>/notes/<uuid:pk>/",
        views.IgcsNoteDetailView.as_view(),
        name="igcse-notes-detail",
    ),
]
