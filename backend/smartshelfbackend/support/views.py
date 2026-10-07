from __future__ import annotations

import re

from django.conf import settings
from rest_framework import serializers, status
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.throttling import UserRateThrottle
from rest_framework.views import APIView

from .models import Feedback


class FeedbackThrottle(UserRateThrottle):
    rate = "30/hour"


class FeedbackSerializer(serializers.ModelSerializer):
    class Meta:
        model = Feedback
        fields = (
            "id", "category", "message", "rating", "screen", "app_version", "platform",
            "contact_ok", "status", "created_at",
        )
        read_only_fields = ("id", "status", "created_at")

    def validate_message(self, value):
        value = (value or "").strip()
        if len(value) < 3:
            raise serializers.ValidationError("Tell us a little more.")
        return value[:5000]

    def validate_rating(self, value):
        if value is not None and not 1 <= value <= 5:
            raise serializers.ValidationError("Rating must be between 1 and 5.")
        return value


class FeedbackView(APIView):
    """GET (own history) / POST /api/v1/support/feedback/"""

    permission_classes = [IsAuthenticated]
    throttle_classes = [FeedbackThrottle]

    def get(self, request):
        qs = Feedback.objects.filter(user=request.user)[:50]
        return Response(FeedbackSerializer(qs, many=True).data)

    def post(self, request):
        ser = FeedbackSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        fb = ser.save(
            user=request.user,
            organization_id=request.user.organization_id,
            role=request.user.role,
        )
        return Response(FeedbackSerializer(fb).data, status=status.HTTP_201_CREATED)


class SupportInfoView(APIView):
    """GET /api/v1/support/info/ — beta support channel details (public)."""

    authentication_classes = []
    permission_classes = [AllowAny]

    def get(self, request):
        number = re.sub(r"\D", "", getattr(settings, "SUPPORT_WHATSAPP_NUMBER", "") or "")
        return Response(
            {
                "whatsapp_number": f"+{number}" if number else "",
                "whatsapp_url": f"https://wa.me/{number}" if number else "",
                "email": getattr(settings, "SUPPORT_EMAIL", ""),
                "hours": getattr(settings, "SUPPORT_HOURS", ""),
            }
        )
