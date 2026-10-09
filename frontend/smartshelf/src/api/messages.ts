import { apiRequest } from '@/services/api';
import { readApiError } from '@/src/lib/apiError';

export type MessageContactTeacher = {
  id: string;
  name: string;
  subtitle: string;
  thread_id: string | null;
};

export type MessageContactChild = {
  id: string;
  name: string;
  class: string;
  school: string;
  teachers: MessageContactTeacher[];
};

export type MessageThreadSummary = {
  id: string;
  student: { id: string; name: string; class: string };
  other: { id: string; name: string; role: 'teacher' | 'parent'; subtitle: string; active: boolean };
  school: string;
  unread: number;
  last_message: { body: string; created_at: string; from_me: boolean } | null;
  last_message_at: string | null;
};

export type ChatMessage = {
  id: string;
  body: string;
  created_at: string;
  from_me: boolean;
  sender_name: string;
};

export type MessageThreadDetail = MessageThreadSummary & {
  can_reply: boolean;
  reply_blocked_reason: string | null;
  messages: ChatMessage[];
};

export const MAX_MESSAGE_LENGTH = 4000;

export async function fetchMessageContacts(): Promise<MessageContactChild[]> {
  const res = await apiRequest('/v1/messages/contacts/');
  if (!res.ok) throw new Error(await readApiError(res, "Could not load your children's teachers."));
  return (await res.json()).children ?? [];
}

export async function fetchMessageThreads(): Promise<MessageThreadSummary[]> {
  const res = await apiRequest('/v1/messages/threads/');
  if (!res.ok) throw new Error(await readApiError(res, 'Could not load messages.'));
  return res.json();
}

export async function fetchUnreadMessageCount(): Promise<number> {
  const res = await apiRequest('/v1/messages/unread/');
  if (!res.ok) return 0;
  return (await res.json()).unread ?? 0;
}

export async function startMessageThread(payload: {
  teacher_id: string;
  student_id: string;
  body: string;
}): Promise<MessageThreadSummary> {
  const res = await apiRequest('/v1/messages/threads/', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(await readApiError(res, 'Could not send your message.'));
  return res.json();
}

export async function fetchMessageThread(id: string): Promise<MessageThreadDetail> {
  const res = await apiRequest(`/v1/messages/threads/${id}/`);
  if (!res.ok) throw new Error(await readApiError(res, 'Could not load this conversation.'));
  return res.json();
}

export async function sendMessage(threadId: string, body: string): Promise<ChatMessage> {
  const res = await apiRequest(`/v1/messages/threads/${threadId}/messages/`, {
    method: 'POST',
    body: JSON.stringify({ body }),
  });
  if (!res.ok) throw new Error(await readApiError(res, 'Could not send your message.'));
  return res.json();
}
