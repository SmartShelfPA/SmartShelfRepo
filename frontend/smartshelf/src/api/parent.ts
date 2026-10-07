import { ParentDashboardData } from '../types/parent';
import { apiRequest } from '@/services/api';

export async function fetchParentDashboard(): Promise<ParentDashboardData> {
  const res = await apiRequest('/v1/parent/dashboard/');
  if (res.status === 403) {
    throw new Error('This dashboard is only available to parent accounts.');
  }
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to load parent dashboard');
  }
  return res.json();
}
