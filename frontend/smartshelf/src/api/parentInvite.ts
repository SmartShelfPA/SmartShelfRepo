import { apiRequest, setStoredProfile, setToken, type UserProfile } from '@/services/api';

export type ParentInvitePreview = {
  valid: boolean;
  status?: string;
  child_display_name: string;
  school_name: string;
  expires_at: string;
  invite_email_hint?: string;
  error?: string;
};

export type ParentInviteRedeemPayload = {
  code: string;
  username: string;
  password: string;
  email: string;
  full_name: string;
  terms_accepted: boolean;
  analytics_consent?: boolean;
};

export async function verifyParentInviteCode(code: string): Promise<ParentInvitePreview> {
  const res = await apiRequest('/auth/parent-invite/verify/', {
    method: 'POST',
    body: JSON.stringify({ code: code.trim().toUpperCase() }),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'Invalid invite code');
  }
  return data;
}

export async function redeemParentInvite(
  payload: ParentInviteRedeemPayload
): Promise<{ token: string; user: UserProfile }> {
  const res = await apiRequest('/auth/parent-invite/redeem/', {
    method: 'POST',
    body: JSON.stringify({
      ...payload,
      code: payload.code.trim().toUpperCase(),
      terms_accepted: true,
    }),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'Could not create parent account');
  }
  await setToken(data.token, { persist: true });
  if (data.user) {
    await setStoredProfile(data.user, { persist: true });
  }
  return { token: data.token, user: data.user };
}

export async function createParentInvite(payload: {
  student_id: string;
  guardian_email?: string;
}): Promise<{ code: string; expires_at: string; student_name: string }> {
  const res = await apiRequest('/v1/staff/parent-invites/', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'Failed to create invite');
  }
  return data;
}
