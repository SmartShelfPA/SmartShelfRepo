export interface ParentChild {
  id: string;
  name: string;
  avatarUrl?: string;
  currentTasks: number;
  completedTasks: number;
  shelfId: string;
}

export type ShelfItemStatus = 'ok' | 'low' | 'out';

export interface ShelfItemSummary {
  id: string;
  name: string;
  quantity: number;
  status: ShelfItemStatus;
}

export interface ParentDashboardData {
  parentName: string;
  totalChildren: number;
  totalItemsTracked: number;
  children: ParentChild[];
  itemsByChild: Record<string, ShelfItemSummary[]>;
}
