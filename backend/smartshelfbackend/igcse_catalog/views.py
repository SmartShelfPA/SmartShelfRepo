from __future__ import annotations

from rest_framework.permissions import AllowAny, IsAdminUser
from rest_framework.views import APIView

from igcse_catalog import handlers as catalog_handlers
from igcse_catalog import legacy as legacy_handlers


class CatalogSubjectsView(APIView):
    """Published subjects from the study-agent catalog."""

    permission_classes = [AllowAny]

    def get(self, request):
        return catalog_handlers.catalog_subjects_response(request)


class CatalogChaptersView(APIView):
    """Published chapters for a subject (?subject=slug)."""

    permission_classes = [AllowAny]

    def get(self, request):
        return catalog_handlers.catalog_chapters_response(request)


class CatalogSetsListView(APIView):
    """Published generated sets (?subject=&chapter=)."""

    permission_classes = [AllowAny]

    def get(self, request):
        return catalog_handlers.catalog_sets_list_response(request)


class CatalogSetDetailView(APIView):
    """Single published generated set by UUID."""

    permission_classes = [AllowAny]

    def get(self, request, set_id):
        return catalog_handlers.catalog_set_detail_response(request, set_id=set_id)


class CatalogIngestView(APIView):
    """Admin-only ingest for study-agent pipeline output."""

    permission_classes = [IsAdminUser]

    def post(self, request):
        return catalog_handlers.catalog_ingest_response(request)


class DeprecatedTopicsView(APIView):
    """TEMPORARY — retired live Open IGCSE ``/topics/`` proxy (410)."""

    permission_classes = [AllowAny]

    def get(self, request):
        return legacy_handlers.deprecated_topics_response(request)


class DeprecatedQuestionsView(APIView):
    """TEMPORARY — retired live Open IGCSE ``/questions/`` proxy (410)."""

    permission_classes = [AllowAny]

    def get(self, request):
        return legacy_handlers.deprecated_questions_response(request)


class DeprecatedSearchView(APIView):
    """TEMPORARY — retired live Open IGCSE ``/search/`` proxy (410)."""

    permission_classes = [AllowAny]

    def get(self, request):
        return legacy_handlers.deprecated_search_response(request)
