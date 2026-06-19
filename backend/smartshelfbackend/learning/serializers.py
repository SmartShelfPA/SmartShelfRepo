from rest_framework import serializers

from learning.models import (
    ExamShelf,
    IgcsBookmark,
    IgcsEpubBook,
    IgcsHighlight,
    IgcsNote,
    IgcsUserReading,
    PracticeResponse,
    PracticeSession,
    ProtectedPdfAsset,
)


class ProtectedPdfAssetSerializer(serializers.ModelSerializer):
    """Metadata only — never exposes the raw file path or a public URL."""

    file_size_bytes = serializers.IntegerField(read_only=True)
    is_downloadable = serializers.BooleanField(read_only=True)

    class Meta:
        model = ProtectedPdfAsset
        fields = (
            "id",
            "title",
            "subject",
            "chapter",
            "description",
            "cover_image_url",
            "file_size_bytes",
            "access_level",
            "rights_status",
            "rights_version",
            "is_downloadable",
            "created_at",
            "updated_at",
        )


class IgcsEpubBookSerializer(serializers.ModelSerializer):
    epub_url = serializers.SerializerMethodField()
    progress_percent = serializers.SerializerMethodField()
    last_read_at = serializers.SerializerMethodField()

    class Meta:
        model = IgcsEpubBook
        fields = (
            "id",
            "title",
            "subject",
            "author",
            "description",
            "cover_image_url",
            "epub_url",
            "toc_json",
            "extra_metadata",
            "progress_percent",
            "last_read_at",
        )

    def get_epub_url(self, obj: IgcsEpubBook) -> str:
        if obj.epub_url:
            return obj.epub_url
        request = self.context.get("request")
        if obj.epub_file and request:
            return request.build_absolute_uri(obj.epub_file.url)
        return ""

    def get_progress_percent(self, obj: IgcsEpubBook):
        reading = self.context.get("reading_map", {}).get(str(obj.id))
        if reading:
            return reading.progress_percent
        return None

    def get_last_read_at(self, obj: IgcsEpubBook):
        reading = self.context.get("reading_map", {}).get(str(obj.id))
        if reading:
            return reading.last_read_at
        return None


class IgcsEpubBookDetailSerializer(IgcsEpubBookSerializer):
    class Meta(IgcsEpubBookSerializer.Meta):
        fields = IgcsEpubBookSerializer.Meta.fields + ("updated_at",)


class IgcsReadingProgressSerializer(serializers.Serializer):
    fraction = serializers.FloatField(min_value=0.0, max_value=1.0)
    start_cfi = serializers.CharField(required=False, allow_blank=True)
    updated_at = serializers.DateTimeField(required=False)


class IgcsBookmarkSerializer(serializers.ModelSerializer):
    class Meta:
        model = IgcsBookmark
        fields = (
            "id",
            "book",
            "label",
            "start_cfi",
            "end_cfi",
            "chapter_href",
            "excerpt",
            "created_at",
        )
        read_only_fields = ("id", "created_at", "book")


class IgcsHighlightSerializer(serializers.ModelSerializer):
    class Meta:
        model = IgcsHighlight
        fields = (
            "id",
            "book",
            "color",
            "start_cfi",
            "end_cfi",
            "chapter_href",
            "excerpt",
            "fallback_note",
            "created_at",
        )
        read_only_fields = ("id", "created_at", "book")


class IgcsNoteSerializer(serializers.ModelSerializer):
    class Meta:
        model = IgcsNote
        fields = ("id", "book", "body", "start_cfi", "created_at", "updated_at")
        read_only_fields = ("id", "created_at", "updated_at", "book")


class PracticeResponseSerializer(serializers.ModelSerializer):
    class Meta:
        model = PracticeResponse
        fields = (
            "question_id",
            "selected_option_id",
            "correct_option_id",
            "is_correct",
            "order_index",
            "time_spent_ms",
        )


class PracticeSessionListSerializer(serializers.ModelSerializer):
    class Meta:
        model = PracticeSession
        fields = (
            "id",
            "exam_type",
            "subject",
            "year",
            "status",
            "score_percent",
            "correct_count",
            "answered_count",
            "duration_seconds",
            "started_at",
            "ended_at",
        )
        read_only_fields = ("id", "started_at")


class PracticeSessionSerializer(serializers.ModelSerializer):
    responses = PracticeResponseSerializer(many=True, required=False, read_only=True)

    class Meta:
        model = PracticeSession
        fields = (
            "id",
            "exam_type",
            "subject",
            "year",
            "status",
            "score_percent",
            "correct_count",
            "answered_count",
            "duration_seconds",
            "started_at",
            "ended_at",
            "responses",
        )
        read_only_fields = ("id", "started_at")


class PracticeSessionCreateSerializer(serializers.ModelSerializer):
    exam_type = serializers.ChoiceField(choices=ExamShelf.choices)

    class Meta:
        model = PracticeSession
        fields = ("exam_type", "subject", "year")


class NormalizedQuestionSerializer(serializers.Serializer):
    """Mirror of the mobile client's normalized question shape (snake_case)."""

    id = serializers.CharField()
    exam_type = serializers.CharField()
    subject = serializers.CharField()
    year = serializers.IntegerField()
    prompt_html = serializers.CharField()
    options = serializers.ListField(child=serializers.DictField())
    correct_option_id = serializers.CharField()
    explanation_html = serializers.CharField(required=False, allow_blank=True)
    order_index = serializers.IntegerField()
    source = serializers.DictField(required=False)
