import { Platform } from 'react-native';
import { API_BASE_URL, apiRequest, getApiExtraHeaders, getToken } from '@/services/api';
import type { ProtectedPdfAsset } from '@/src/api/protectedPdfs';
import { readApiError } from '@/src/lib/apiError';

export type SchoolOverview = {
  id: string;
  name: string;
  slug: string;
  requires_join_code: boolean;
  is_school_admin: boolean;
  join_code?: string;
  counts: { students: number; teachers: number; parents: number; resources: number };
};

export type SchoolMember = {
  id: string;
  username: string;
  full_name: string;
  email: string;
  role: 'student' | 'parent' | 'staff' | 'publisher';
  student_class: string;
  staff_role: string;
  is_school_admin: boolean;
  is_active: boolean;
  linked_children: { id: string; name: string }[];
  last_login: string | null;
};

export type CreatedMember = SchoolMember & { temporary_password: string };

export type SchoolResource = ProtectedPdfAsset & {
  audience_classes: string[];
  uploaded_by_id: string | null;
  uploaded_by_name: string;
};

export type PickedPdf = {
  uri: string;
  name: string;
  mimeType?: string | null;
  size?: number | null;
  /** Present on web: the browser File object. */
  file?: File | null;
};

async function json<T>(res: Response, fallback: string): Promise<T> {
  if (!res.ok) throw new Error(await readApiError(res, fallback));
  return res.json() as Promise<T>;
}

export async function fetchSchool(): Promise<SchoolOverview> {
  return json(await apiRequest('/v1/school/'), 'Could not load your school.');
}

export async function updateJoinCode(
  payload: { join_code: string } | { regenerate_join_code: true }
): Promise<{ join_code: string; requires_join_code: boolean }> {
  return json(
    await apiRequest('/v1/school/', { method: 'PATCH', body: JSON.stringify(payload) }),
    'Could not update the school code.'
  );
}

export async function fetchMembers(role?: SchoolMember['role']): Promise<SchoolMember[]> {
  const query = role ? `?role=${role}` : '';
  return json(await apiRequest(`/v1/school/members/${query}`), 'Could not load members.');
}

export async function createMember(payload: {
  role: 'student' | 'staff';
  full_name: string;
  email: string;
  username?: string;
  student_class?: string;
  staff_role?: string;
  is_school_admin?: boolean;
}): Promise<CreatedMember> {
  return json(
    await apiRequest('/v1/school/members/', { method: 'POST', body: JSON.stringify(payload) }),
    'Could not create the account.'
  );
}

export async function updateMember(
  id: string,
  payload: Partial<Pick<SchoolMember, 'full_name' | 'student_class' | 'staff_role' | 'is_active' | 'is_school_admin'>>
): Promise<SchoolMember> {
  return json(
    await apiRequest(`/v1/school/members/${id}/`, { method: 'PATCH', body: JSON.stringify(payload) }),
    'Could not update the account.'
  );
}

export async function resetMemberPassword(
  id: string
): Promise<{ id: string; username: string; temporary_password: string }> {
  return json(
    await apiRequest(`/v1/school/members/${id}/reset-password/`, { method: 'POST' }),
    'Could not reset the password.'
  );
}

export async function fetchSchoolResources(): Promise<SchoolResource[]> {
  return json(await apiRequest('/v1/school/resources/'), 'Could not load school resources.');
}

export async function uploadSchoolResource(input: {
  file: PickedPdf;
  title: string;
  subject?: string;
  description?: string;
  audienceClasses: string[];
}): Promise<SchoolResource> {
  const form = new FormData();
  form.append('title', input.title);
  form.append('subject', input.subject ?? '');
  form.append('description', input.description ?? '');
  form.append('audience_classes', JSON.stringify(input.audienceClasses));
  form.append('rights_confirmed', 'true');
  if (Platform.OS === 'web' && input.file.file) {
    form.append('file', input.file.file, input.file.name);
  } else {
    // React Native's FormData accepts {uri, name, type} file descriptors.
    form.append('file', {
      uri: input.file.uri,
      name: input.file.name || 'resource.pdf',
      type: input.file.mimeType || 'application/pdf',
    } as unknown as Blob);
  }
  const token = await getToken();
  const res = await fetch(`${API_BASE_URL}/v1/school/resources/`, {
    method: 'POST',
    headers: {
      ...getApiExtraHeaders(),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: form,
  });
  return json(res, 'Upload failed.');
}

export async function updateSchoolResource(
  id: string,
  payload: { title?: string; subject?: string; description?: string; audience_classes?: string[] }
): Promise<SchoolResource> {
  return json(
    await apiRequest(`/v1/school/resources/${id}/`, { method: 'PATCH', body: JSON.stringify(payload) }),
    'Could not update the resource.'
  );
}

export async function deleteSchoolResource(id: string): Promise<void> {
  const res = await apiRequest(`/v1/school/resources/${id}/`, { method: 'DELETE' });
  if (!res.ok && res.status !== 204) throw new Error(await readApiError(res, 'Could not delete.'));
}
