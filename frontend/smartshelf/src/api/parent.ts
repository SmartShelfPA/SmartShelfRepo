import { ParentDashboardData } from '../types/parent';
import { apiRequest } from '@/services/api';

const FALLBACK_DASHBOARD: ParentDashboardData = {
  parentName: 'Parent',
  totalChildren: 3,
  totalItemsTracked: 35,
  children: [
    { id: '1', name: 'Child 1', currentTasks: 3, completedTasks: 12, shelfId: 'shelf-1' },
    { id: '2', name: 'Child 2', currentTasks: 2, completedTasks: 8, shelfId: 'shelf-2' },
    { id: '3', name: 'Child 3', currentTasks: 5, completedTasks: 15, shelfId: 'shelf-3' },
  ],
  itemsByChild: {
    '1': [
      { id: 'i1', name: 'Math Textbook', quantity: 2, status: 'ok' },
      { id: 'i2', name: 'Notebooks', quantity: 1, status: 'low' },
    ],
    '2': [
      { id: 'i3', name: 'Pens', quantity: 0, status: 'out' },
      { id: 'i4', name: 'Highlighters', quantity: 5, status: 'ok' },
    ],
    '3': [
      { id: 'i5', name: 'Sticky Notes', quantity: 3, status: 'ok' },
    ],
  },
};

export async function fetchParentDashboard(): Promise<ParentDashboardData> {
  try {
    const res = await apiRequest('/parent/dashboard');
    if (!res.ok) throw new Error('Failed to load parent dashboard');
    return res.json();
  } catch {
    return FALLBACK_DASHBOARD;
  }
}
