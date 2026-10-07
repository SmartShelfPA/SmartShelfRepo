from rest_framework.permissions import BasePermission

from .auth_bypass import auth_free_window_active

from .models import UserProfile


def _has_role(request, role: str) -> bool:
    user = request.user
    return bool(user and user.is_authenticated) and user.role == role


class IsStaffRole(BasePermission):
    def has_permission(self, request, view):
        if auth_free_window_active():
            return True
        return _has_role(request, UserProfile.Role.STAFF)


class IsPublisherRole(BasePermission):
    def has_permission(self, request, view):
        if auth_free_window_active():
            return True
        return _has_role(request, UserProfile.Role.PUBLISHER)


class IsParentRole(BasePermission):
    message = "Parent access only."

    def has_permission(self, request, view):
        return _has_role(request, UserProfile.Role.PARENT)


class IsStudentRole(BasePermission):
    message = "Student access only."

    def has_permission(self, request, view):
        return _has_role(request, UserProfile.Role.STUDENT)


class IsSchoolAdmin(BasePermission):
    message = "School administrator access only."

    def has_permission(self, request, view):
        return (
            _has_role(request, UserProfile.Role.STAFF)
            and bool(request.user.is_school_admin)
            and request.user.organization_id is not None
        )
