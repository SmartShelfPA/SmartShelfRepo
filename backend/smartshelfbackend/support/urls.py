from django.urls import path

from .views import FeedbackView, SupportInfoView

urlpatterns = [
    path("feedback/", FeedbackView.as_view(), name="support-feedback"),
    path("info/", SupportInfoView.as_view(), name="support-info"),
]
