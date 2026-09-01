import { API_BASE_URL, apiRequest, getApiExtraHeaders } from '@/services/api';

export type BillingPlan = {
  id: string;
  tier: string;
  name: string;
  description: string;
  price_display: string;
  interval_label: string;
  currency: string;
  mode: 'payment' | 'subscription';
  purchasable: boolean;
};

export type BillingPlansResponse = {
  stripe_enabled: boolean;
  plans: BillingPlan[];
};

export type SubscriptionStatus = {
  tier: string | null;
  plan_id: string | null;
  status: string;
  active_until: string | null;
  has_active_subscription: boolean;
};

export async function fetchBillingPlans(tier?: string): Promise<BillingPlansResponse> {
  const query = tier ? `?tier=${encodeURIComponent(tier)}` : '';
  const response = await fetch(`${API_BASE_URL}/v1/billing/plans/${query}`, {
    headers: { ...getApiExtraHeaders() },
  });
  const text = await response.text();
  const data = text ? (JSON.parse(text) as Record<string, unknown>) : {};
  if (!response.ok) {
    throw new Error((data.detail as string) || 'Could not load plans.');
  }
  return data as BillingPlansResponse;
}

export async function startCheckout(planId: string): Promise<{ checkout_url: string }> {
  const response = await apiRequest('/v1/billing/checkout/', {
    method: 'POST',
    body: JSON.stringify({ plan_id: planId }),
  });
  const text = await response.text();
  const data = text ? (JSON.parse(text) as Record<string, unknown>) : {};
  if (!response.ok) {
    throw new Error((data.detail as string) || 'Checkout failed.');
  }
  return data as { checkout_url: string };
}

export async function refreshBilling(): Promise<void> {
  await apiRequest('/v1/billing/refresh/', { method: 'POST' });
}

export async function fetchSubscriptionStatus(): Promise<SubscriptionStatus> {
  const response = await apiRequest('/v1/billing/status/');
  const text = await response.text();
  const data = text ? (JSON.parse(text) as Record<string, unknown>) : {};
  if (!response.ok) {
    throw new Error((data.detail as string) || 'Could not load subscription.');
  }
  return data as SubscriptionStatus;
}
