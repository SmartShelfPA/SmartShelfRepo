import { universalStorage } from '@/src/lib/universalStorage';

export type PortalChoice = 'student' | 'parent';

const PORTAL_KEY = '@smartshelf:portal_choice';

export async function getPortalChoice(): Promise<PortalChoice | null> {
  const raw = await universalStorage.getItem(PORTAL_KEY);
  if (raw === 'student' || raw === 'parent') return raw;
  return null;
}

export async function setPortalChoice(choice: PortalChoice): Promise<void> {
  await universalStorage.setItem(PORTAL_KEY, choice);
}

export async function clearPortalChoice(): Promise<void> {
  await universalStorage.removeItem(PORTAL_KEY);
}
