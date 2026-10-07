"""Per-student pen, highlighter and sticky-note annotations on protected PDFs."""

from __future__ import annotations

from django.shortcuts import get_object_or_404
from rest_framework import serializers, status
from rest_framework.exceptions import PermissionDenied
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from learning.models import PdfAnnotation, ProtectedPdfAsset

MAX_POINTS = 4000
MAX_ANNOTATIONS_PER_ASSET = 3000


class PdfAnnotationSerializer(serializers.ModelSerializer):
    class Meta:
        model = PdfAnnotation
        fields = ("id", "page", "kind", "color", "width", "points", "text", "created_at", "updated_at")
        read_only_fields = ("id", "created_at", "updated_at")

    def validate_page(self, value):
        if value < 1:
            raise serializers.ValidationError("Pages start at 1.")
        return value

    def validate_color(self, value):
        value = (value or "").strip()
        if not value.startswith("#") or len(value) not in (4, 7, 9):
            raise serializers.ValidationError("Use a hex colour like #FFEB3B.")
        return value

    def validate_width(self, value):
        return min(0.1, max(0.0005, float(value)))

    def validate_points(self, value):
        if not isinstance(value, list) or len(value) > MAX_POINTS:
            raise serializers.ValidationError(f"points must be a list of at most {MAX_POINTS} pairs.")
        cleaned = []
        for pair in value:
            if not isinstance(pair, (list, tuple)) or len(pair) != 2:
                raise serializers.ValidationError("Each point must be [x, y].")
            try:
                x, y = float(pair[0]), float(pair[1])
            except (TypeError, ValueError):
                raise serializers.ValidationError("Point coordinates must be numbers.")
            cleaned.append([round(min(1.0, max(0.0, x)), 4), round(min(1.0, max(0.0, y)), 4)])
        return cleaned

    def validate(self, attrs):
        kind = attrs.get("kind", getattr(self.instance, "kind", None))
        points = attrs.get("points", getattr(self.instance, "points", []))
        text = attrs.get("text", getattr(self.instance, "text", ""))
        if kind in (PdfAnnotation.Kind.PEN, PdfAnnotation.Kind.HIGHLIGHT) and len(points) < 2:
            raise serializers.ValidationError("Strokes need at least two points.")
        if kind == PdfAnnotation.Kind.NOTE:
            if len(points) != 1:
                raise serializers.ValidationError("Notes need exactly one anchor point.")
            if not (text or "").strip():
                raise serializers.ValidationError("Notes need some text.")
        return attrs


def _asset_for(request, asset_pk) -> ProtectedPdfAsset:
    asset = get_object_or_404(ProtectedPdfAsset, pk=asset_pk)
    if not asset.user_can_access(request.user):
        raise PermissionDenied("You do not have access to this resource.")
    return asset


class PdfAnnotationListCreateView(APIView):
    """GET/POST /api/v1/igcse/pdfs/<asset>/annotations/ — the caller's own annotations."""

    permission_classes = [IsAuthenticated]

    def get(self, request, asset_pk):
        asset = _asset_for(request, asset_pk)
        qs = PdfAnnotation.objects.filter(user=request.user, asset=asset)
        page = request.query_params.get("page")
        if page and page.isdigit():
            qs = qs.filter(page=int(page))
        return Response(PdfAnnotationSerializer(qs, many=True).data)

    def post(self, request, asset_pk):
        asset = _asset_for(request, asset_pk)
        if PdfAnnotation.objects.filter(user=request.user, asset=asset).count() >= MAX_ANNOTATIONS_PER_ASSET:
            return Response(
                {"error": "Annotation limit reached for this document. Delete some first."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        ser = PdfAnnotationSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        ann = ser.save(user=request.user, asset=asset)
        return Response(PdfAnnotationSerializer(ann).data, status=status.HTTP_201_CREATED)


class PdfAnnotationDetailView(APIView):
    permission_classes = [IsAuthenticated]

    def _get(self, request, asset_pk, pk):
        return get_object_or_404(PdfAnnotation, pk=pk, asset_id=asset_pk, user=request.user)

    def patch(self, request, asset_pk, pk):
        ann = self._get(request, asset_pk, pk)
        ser = PdfAnnotationSerializer(ann, data=request.data, partial=True)
        ser.is_valid(raise_exception=True)
        ser.save()
        return Response(ser.data)

    def delete(self, request, asset_pk, pk):
        self._get(request, asset_pk, pk).delete()
        return Response(status=status.HTTP_204_NO_CONTENT)
