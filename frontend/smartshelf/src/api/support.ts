import { apiRequest } from '@/services/api';
import { readApiError } from '@/src/lib/apiError';

export type FeedbackCategory = 'bug' | 'idea' | 'content' | 'question' | 'praise' | 'other';

export const FEEDBACK_CATEGORY_LABELS: Record<FeedbackCategory, string> = {
  bug: 'Something is broken',
  idea: 'Feature idea',
  content: 'Missing or wrong content',
  question: 'Question',
  praise: 'Something I like',
  other: 'Other',
};

export type FeedbackStatus = 'new' | 'triaged' | 'planned' | 'in_progress' | 'done' | 'wont_do';

export const FEEDBACK_STATUS_LABELS: Record<FeedbackStatus, string> = {
  new: 'Received',
  triaged: 'Reviewed',
  planned: 'Planned',
  in_progress: 'In progress',
  done: 'Done',
  wont_do: 'Not planned',
};

export type FeedbackItem = {
  id: string;
  category: FeedbackCategory;
  message: string;
  rating: number | null;
  screen: string;
  app_version: string;
  platform: string;
  contact_ok: boolean;
  status: FeedbackStatus;
  created_at: string;
};

export type SupportInfo = {
  whatsapp_number: string;
  whatsapp_url: string;
  email: string;
  hours: string;
};

export async function fetchSupportInfo(): Promise<SupportInfo> {
  const res = await apiRequest('/v1/support/info/');
  if (!res.ok) throw new Error(await readApiError(res, 'Could not load support details.'));
  return res.json();
}

export async function fetchMyFeedback(): Promise<FeedbackItem[]> {
  const res = await apiRequest('/v1/support/feedback/');
  if (!res.ok) throw new Error(await readApiError(res, 'Could not load your feedback.'));
  return res.json();
}

export async function sendFeedback(payload: {
  category: FeedbackCategory;
  message: string;
  rating?: number | null;
  screen?: string;
  app_version?: string;
  platform?: string;
  contact_ok?: boolean;
}): Promise<FeedbackItem> {
  const res = await apiRequest('/v1/support/feedback/', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(await readApiError(res, 'Could not send feedback.'));
  return res.json();
}
