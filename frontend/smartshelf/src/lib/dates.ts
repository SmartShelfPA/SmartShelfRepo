const DAY_MS = 24 * 3600 * 1000;

export function formatLastActive(iso: string | null | undefined): string {
  if (!iso) return 'No activity yet';
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / DAY_MS);
  if (days <= 0) return 'Today';
  if (days === 1) return 'Yesterday';
  return `${days} days ago`;
}

export function formatDue(iso: string | null | undefined): string {
  if (!iso) return 'No due date';
  const due = new Date(iso);
  const days = Math.ceil((due.getTime() - Date.now()) / DAY_MS);
  const label = due.toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
  if (days < 0) return `Overdue (was due ${label})`;
  if (days === 0) return 'Due today';
  if (days === 1) return 'Due tomorrow';
  return `Due ${label}`;
}

export function formatShortDate(iso: string | null | undefined): string {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}
