"""Parent ↔ teacher messaging about a child."""

from __future__ import annotations

import logging
from datetime import datetime, timezone as dt_timezone

from django.conf import settings
from django.core.mail import send_mail
from django.db import transaction
from django.db.models import Count, F, Q, Value
from django.db.models.functions import Coalesce
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import status
from rest_framework.permissions import BasePermission, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from users.models import UserProfile
from users.permissions import IsParentRole

from .models import Message, MessageThread

logger = logging.getLogger(__name__)

MAX_MESSAGE_LENGTH = 4000
THREAD_MESSAGE_LIMIT = 300
_EPOCH = datetime(1970, 1, 1, tzinfo=dt_timezone.utc)


class IsParentOrStaff(BasePermission):
    message = "Messages are for parents and teachers."

    def has_permission(self, request, view):
        user = request.user
        return bool(user and user.is_authenticated) and user.role in (
            UserProfile.Role.PARENT,
            UserProfile.Role.STAFF,
        )


def _name(user) -> str:
    return (user.full_name or user.username) if user else ""


def child_teachers(student: UserProfile) -> list[tuple[UserProfile, str]]:
    """Staff a parent may contact about this child, with why they are listed.

    Teachers who have set work for the child (or the child's class) come first;
    school admins are always included so there is someone to contact before any
    work has been set.
    """
    if not student.organization_id:
        return []
    staff = UserProfile.objects.filter(
        organization_id=student.organization_id, role=UserProfile.Role.STAFF, is_active=True
    )
    set_work = Q(assignments_created__submissions__student=student)
    klass = (student.student_class or "").strip()
    if klass:
        set_work |= Q(assignments_created__target_class__iexact=klass)
    result: dict = {}
    for t in staff.filter(set_work).distinct().order_by("full_name", "username"):
        result[t.pk] = (t, t.staff_role or "Sets work for this child")
    for t in staff.filter(is_school_admin=True).order_by("full_name", "username"):
        result.setdefault(t.pk, (t, t.staff_role or "School admin"))
    return list(result.values())


def _threads_for(user):
    if user.role == UserProfile.Role.PARENT:
        mine, last_read = Q(parent=user), "parent_last_read_at"
    else:
        mine, last_read = Q(teacher=user), "teacher_last_read_at"
    return (
        MessageThread.objects.filter(mine)
        .select_related("parent", "teacher", "student", "organization")
        .annotate(
            unread=Count(
                "messages",
                filter=Q(messages__created_at__gt=Coalesce(F(last_read), Value(_EPOCH)))
                & ~Q(messages__sender=user),
            )
        )
    )


def _thread_payload(thread: MessageThread, viewer) -> dict:
    is_parent = viewer.pk == thread.parent_id
    other = thread.teacher if is_parent else thread.parent
    last = thread.messages.order_by("-created_at").first()
    return {
        "id": str(thread.id),
        "student": {
            "id": str(thread.student_id),
            "name": _name(thread.student),
            "class": thread.student.student_class,
        },
        "other": {
            "id": str(other.id),
            "name": _name(other),
            "role": "teacher" if is_parent else "parent",
            "subtitle": (other.staff_role or "Teacher") if is_parent else f"Parent of {_name(thread.student)}",
            "active": other.is_active,
        },
        "school": thread.organization.name,
        "unread": getattr(thread, "unread", 0),
        "last_message": (
            {
                "body": last.body[:160],
                "created_at": last.created_at.isoformat(),
                "from_me": last.sender_id == viewer.pk,
            }
            if last
            else None
        ),
        "last_message_at": thread.last_message_at.isoformat() if thread.last_message_at else None,
    }


def _message_payload(m: Message, viewer) -> dict:
    return {
        "id": str(m.id),
        "body": m.body,
        "created_at": m.created_at.isoformat(),
        "from_me": m.sender_id == viewer.pk,
        "sender_name": _name(m.sender),
    }


def _clean_body(raw) -> tuple[str, Response | None]:
    body = str(raw or "").strip()
    if not body:
        return "", Response({"error": "Write a message first."}, status=status.HTTP_400_BAD_REQUEST)
    if len(body) > MAX_MESSAGE_LENGTH:
        return "", Response(
            {"error": f"Messages can be up to {MAX_MESSAGE_LENGTH} characters."},
            status=status.HTTP_400_BAD_REQUEST,
        )
    return body, None


def _can_post(thread: MessageThread, user) -> str | None:
    """Return an error message if the user may no longer post in this thread."""
    if user.pk == thread.parent_id:
        if not thread.teacher.is_active:
            return "This teacher's account is no longer active."
        if not user.managed_students.filter(pk=thread.student_id).exists():
            return "You are no longer linked to this child."
    elif not thread.parent.is_active:
        return "This parent's account is no longer active."
    if thread.teacher.organization_id != thread.organization_id:
        return "This teacher is no longer at the school."
    return None


def _notify(thread: MessageThread, sender, had_unread: bool) -> None:
    """Email the recipient that a message is waiting, once per unread batch.

    The email never contains the message itself, only who wrote and about which child.
    """
    if had_unread:
        return
    recipient = thread.teacher if sender.pk == thread.parent_id else thread.parent
    from_email = getattr(settings, "DEFAULT_FROM_EMAIL", None)
    if not recipient.email or not from_email:
        return
    child = _name(thread.student)
    subject = f"New SmartShelf message about {child}"
    message = (
        f"{_name(sender)} sent you a message about {child} on SmartShelf.\n\n"
        "Open the SmartShelf app and go to Messages to read and reply.\n"
    )
    try:
        send_mail(subject, message, from_email, [recipient.email], fail_silently=False)
    except Exception:
        logger.exception("Failed to send message notification for thread %s", thread.id)


def _post_message(thread: MessageThread, sender, body: str) -> Message:
    recipient_last_read = (
        thread.teacher_last_read_at if sender.pk == thread.parent_id else thread.parent_last_read_at
    )
    had_unread = thread.messages.filter(
        sender=sender, created_at__gt=recipient_last_read or _EPOCH
    ).exists()
    msg = Message.objects.create(thread=thread, sender=sender, body=body)
    thread.last_message_at = msg.created_at
    if sender.pk == thread.parent_id:
        thread.parent_last_read_at = msg.created_at
    else:
        thread.teacher_last_read_at = msg.created_at
    thread.save(update_fields=["last_message_at", "parent_last_read_at", "teacher_last_read_at"])
    transaction.on_commit(lambda: _notify(thread, sender, had_unread))
    return msg


class MessageContactsView(APIView):
    """GET /api/v1/messages/contacts/ — each linked child and the teachers a parent can message."""

    permission_classes = [IsAuthenticated, IsParentRole]

    def get(self, request):
        existing = {
            (str(t.student_id), str(t.teacher_id)): str(t.id)
            for t in MessageThread.objects.filter(parent=request.user)
        }
        children = []
        for child in request.user.managed_students.filter(is_active=True).select_related("organization"):
            children.append(
                {
                    "id": str(child.id),
                    "name": _name(child),
                    "class": child.student_class,
                    "school": child.organization.name if child.organization else "",
                    "teachers": [
                        {
                            "id": str(t.id),
                            "name": _name(t),
                            "subtitle": why,
                            "thread_id": existing.get((str(child.id), str(t.id))),
                        }
                        for t, why in child_teachers(child)
                    ],
                }
            )
        return Response({"children": children})


class MessageThreadListCreateView(APIView):
    """GET: my conversations. POST (parents): message a child's teacher."""

    permission_classes = [IsAuthenticated, IsParentOrStaff]

    def get(self, request):
        return Response([_thread_payload(t, request.user) for t in _threads_for(request.user)])

    @transaction.atomic
    def post(self, request):
        if request.user.role != UserProfile.Role.PARENT:
            return Response(
                {"error": "Teachers can reply to parents from an existing conversation."},
                status=status.HTTP_403_FORBIDDEN,
            )
        body, err = _clean_body(request.data.get("body"))
        if err:
            return err
        student = request.user.managed_students.filter(
            pk=request.data.get("student_id"), is_active=True
        ).first() if request.data.get("student_id") else None
        if student is None or not student.organization_id:
            return Response({"error": "Choose one of your children."}, status=status.HTTP_400_BAD_REQUEST)
        teacher_id = str(request.data.get("teacher_id") or "")
        teacher = next((t for t, _ in child_teachers(student) if str(t.id) == teacher_id), None)
        if teacher is None:
            return Response(
                {"error": "That teacher isn't available for this child."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        thread, _ = MessageThread.objects.get_or_create(
            parent=request.user,
            teacher=teacher,
            student=student,
            defaults={"organization_id": student.organization_id},
        )
        _post_message(thread, request.user, body)
        thread = _threads_for(request.user).get(pk=thread.pk)
        return Response(_thread_payload(thread, request.user), status=status.HTTP_201_CREATED)


class MessageThreadDetailView(APIView):
    """GET /api/v1/messages/threads/<id>/ — messages in a conversation; marks it read."""

    permission_classes = [IsAuthenticated, IsParentOrStaff]

    def get(self, request, pk):
        thread = get_object_or_404(_threads_for(request.user), pk=pk)
        messages = list(thread.messages.select_related("sender").order_by("-created_at")[:THREAD_MESSAGE_LIMIT])
        messages.reverse()
        now = timezone.now()
        field = "parent_last_read_at" if request.user.pk == thread.parent_id else "teacher_last_read_at"
        MessageThread.objects.filter(pk=thread.pk).update(**{field: now})
        thread.unread = 0
        return Response(
            {
                **_thread_payload(thread, request.user),
                "can_reply": _can_post(thread, request.user) is None,
                "reply_blocked_reason": _can_post(thread, request.user),
                "messages": [_message_payload(m, request.user) for m in messages],
            }
        )


class MessageReplyView(APIView):
    """POST /api/v1/messages/threads/<id>/messages/ — add a message to a conversation."""

    permission_classes = [IsAuthenticated, IsParentOrStaff]

    @transaction.atomic
    def post(self, request, pk):
        thread = get_object_or_404(_threads_for(request.user), pk=pk)
        blocked = _can_post(thread, request.user)
        if blocked:
            return Response({"error": blocked}, status=status.HTTP_403_FORBIDDEN)
        body, err = _clean_body(request.data.get("body"))
        if err:
            return err
        msg = _post_message(thread, request.user, body)
        return Response(_message_payload(msg, request.user), status=status.HTTP_201_CREATED)


class MessageUnreadCountView(APIView):
    """GET /api/v1/messages/unread/ — total unread messages, for badges."""

    permission_classes = [IsAuthenticated, IsParentOrStaff]

    def get(self, request):
        total = sum(t.unread for t in _threads_for(request.user))
        return Response({"unread": total})
