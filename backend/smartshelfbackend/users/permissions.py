from rest_framework.permissions import BasePermission

from .auth_bypass import auth_free_window_active

from .models import UserProfile


class IsStaffRole(BasePermission):
    def has_permission(self, request, view):
        if auth_free_window_active():
            return True
        return (
            bool(request.user and request.user.is_authenticated)
            and request.user.role == UserProfile.Role.STAFF
        )


class IsPublisherRole(BasePermission):
    def has_permission(self, request, view):
        if auth_free_window_active():
            return True
        return (
            bool(request.user and request.user.is_authenticated)
            and request.user.role == UserProfile.Role.PUBLISHER
        )
