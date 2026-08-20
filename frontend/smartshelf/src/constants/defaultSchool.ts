import type { SchoolOrganization } from '@/services/api';

/** Seeded by Django migration `users.0004_default_organization`. */
export const DEFAULT_SCHOOL_SLUG = 'default-school';

/** Lets the registration picker show a school when the API is unreachable (sign-up still needs the API). */
export const FALLBACK_DEFAULT_SCHOOL: SchoolOrganization = {
  id: 'default-school',
  name: 'Independent / school not listed',
  slug: DEFAULT_SCHOOL_SLUG,
  address: '',
  created_at: '',
};

export function displaySchoolName(org: Pick<SchoolOrganization, 'name' | 'slug'>): string {
  if (org.slug === DEFAULT_SCHOOL_SLUG) {
    return 'Independent / school not listed';
  }
  return org.name;
}
