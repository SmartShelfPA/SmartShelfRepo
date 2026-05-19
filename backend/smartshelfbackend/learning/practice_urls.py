from django.urls import path

from learning import views

urlpatterns = [
    path("sessions/", views.PracticeSessionListCreateView.as_view(), name="practice-sessions"),
    path(
        "sessions/<uuid:pk>/",
        views.PracticeSessionDetailView.as_view(),
        name="practice-sessions-detail",
    ),
    path(
        "<str:exam_kind>/subjects/",
        views.PracticeSubjectsView.as_view(),
        name="practice-subjects",
    ),
    path(
        "<str:exam_kind>/years/",
        views.PracticeYearsView.as_view(),
        name="practice-years",
    ),
    path(
        "<str:exam_kind>/questions/",
        views.PracticeQuestionsView.as_view(),
        name="practice-questions",
    ),
]
