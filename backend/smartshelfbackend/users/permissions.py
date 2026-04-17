from rest_framework.permissions import BasePermission

from .models import UserProfile


class IsStaffRole(BasePermission):
    def has_permission(self, request, view):
        return (
            bool(request.user and request.user.is_authenticated)
            and request.user.role == UserProfile.Role.STAFF
        )
