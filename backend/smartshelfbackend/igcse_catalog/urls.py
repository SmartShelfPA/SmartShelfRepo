"""
Canonical SmartShelf IGCSE routes — study-agent catalog (``/api/igcse/*``).
"""

from django.urls import path

from igcse_catalog import views

urlpatterns = [
    path("subjects/", views.CatalogSubjectsView.as_view(), name="igcse-subjects"),
    path("chapters/", views.CatalogChaptersView.as_view(), name="igcse-chapters"),
    path("sets/", views.CatalogSetsListView.as_view(), name="igcse-sets-list"),
    path("sets/<uuid:set_id>/", views.CatalogSetDetailView.as_view(), name="igcse-sets-detail"),
    path("ingest/", views.CatalogIngestView.as_view(), name="igcse-ingest"),
    # Temporary: retired live-proxy aliases (HTTP 410 + Deprecation header)
    path("topics/", views.DeprecatedTopicsView.as_view(), name="igcse-topics-deprecated"),
    path("questions/", views.DeprecatedQuestionsView.as_view(), name="igcse-questions-deprecated"),
    path("search/", views.DeprecatedSearchView.as_view(), name="igcse-search-deprecated"),
]
