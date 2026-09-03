/**
 * Human-readable labels for subscription plan IDs returned by the API.
 */

const PLAN_LABELS: Record<string, string> = {
  student_monthly: 'Student · Monthly',
  student_termly: 'Student · Termly',
  student_annual: 'Student · Annual',
  micro_chapter: 'Micro · Chapter',
  diaspora_usd: 'Diaspora · USD',
  diaspora_gbp: 'Diaspora · GBP',
  diaspora_cad: 'Diaspora · CAD',
};

const TIER_FALLBACK: Record<string, string> = {
  student: 'Student plan',
  micro: 'Micro plan',
  diaspora: 'Diaspora plan',
};

export function getSubscriptionPlanLabel(opts: {
  planId?: string | null;
  tier?: string | null;
  hasActive?: boolean;
}): string | null {
  if (!opts.hasActive) return null;
  if (opts.planId && PLAN_LABELS[opts.planId]) {
    return PLAN_LABELS[opts.planId];
  }
  if (opts.tier && TIER_FALLBACK[opts.tier]) {
    return TIER_FALLBACK[opts.tier];
  }
  if (opts.planId) {
    return opts.planId.replace(/_/g, ' ');
  }
  return 'Active plan';
}
