from django.urls import path

from . import messaging_views, school_views, views

urlpatterns = [
    # Teacher
    path("staff/roster/", views.StaffRosterView.as_view(), name="staff-roster"),
    path("staff/assignments/", views.StaffAssignmentListCreateView.as_view(), name="staff-assignments"),
    path(
        "staff/assignments/<uuid:pk>/",
        views.StaffAssignmentDetailView.as_view(),
        name="staff-assignment-detail",
    ),
    path(
        "staff/assignments/<uuid:pk>/export/",
        views.StaffAssignmentExportView.as_view(),
        name="staff-assignment-export",
    ),
    path(
        "staff/submissions/<uuid:pk>/",
        views.StaffSubmissionDetailView.as_view(),
        name="staff-submission-detail",
    ),
    # Student
    path("student/assignments/", views.StudentAssignmentListView.as_view(), name="student-assignments"),
    path(
        "student/assignments/<uuid:pk>/",
        views.StudentAssignmentDetailView.as_view(),
        name="student-assignment-detail",
    ),
    path(
        "student/assignments/<uuid:pk>/submit/",
        views.StudentAssignmentSubmitView.as_view(),
        name="student-assignment-submit",
    ),
    # School administration & school-only resources
    path("school/", school_views.SchoolOverviewView.as_view(), name="school-overview"),
    path("school/members/", school_views.SchoolMemberListCreateView.as_view(), name="school-members"),
    path(
        "school/members/<uuid:pk>/",
        school_views.SchoolMemberDetailView.as_view(),
        name="school-member-detail",
    ),
    path(
        "school/members/<uuid:pk>/reset-password/",
        school_views.SchoolMemberResetPasswordView.as_view(),
        name="school-member-reset-password",
    ),
    path("school/resources/", school_views.SchoolResourceListCreateView.as_view(), name="school-resources"),
    path(
        "school/resources/<uuid:pk>/",
        school_views.SchoolResourceDetailView.as_view(),
        name="school-resource-detail",
    ),
    # Parent ↔ teacher messages
    path("messages/contacts/", messaging_views.MessageContactsView.as_view(), name="message-contacts"),
    path("messages/unread/", messaging_views.MessageUnreadCountView.as_view(), name="message-unread"),
    path("messages/threads/", messaging_views.MessageThreadListCreateView.as_view(), name="message-threads"),
    path(
        "messages/threads/<uuid:pk>/",
        messaging_views.MessageThreadDetailView.as_view(),
        name="message-thread-detail",
    ),
    path(
        "messages/threads/<uuid:pk>/messages/",
        messaging_views.MessageReplyView.as_view(),
        name="message-reply",
    ),
]
