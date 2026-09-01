import {
  fetchBillingPlans,
  refreshBilling,
  startCheckout,
  type BillingPlan,
} from '@/src/api/billing';
import {
  Modal,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
  ActivityIndicator,
} from 'react-native';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';
import { useCallback, useEffect, useState } from 'react';
import { Platform } from 'react-native';
import { ThemedText } from '@/components/themed-text';
import type { PricingTierId } from '@/src/constants/pricingTiers';

type Props = {
  visible: boolean;
  tier: PricingTierId | null;
  onClose: () => void;
  onComplete: () => void;
  cardBgColor: string;
  borderColor: string;
  textColor: string;
  mutedColor: string;
  accentColor: string;
};

export function BillingPlanPickerModal({
  visible,
  tier,
  onClose,
  onComplete,
  cardBgColor,
  borderColor,
  textColor,
  mutedColor,
  accentColor,
}: Props) {
  const [plans, setPlans] = useState<BillingPlan[]>([]);
  const [loading, setLoading] = useState(false);
  const [checkingOut, setCheckingOut] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [stripeEnabled, setStripeEnabled] = useState(false);

  const loadPlans = useCallback(async () => {
    if (!tier || tier === 'institutional' || tier === 'publisher' || tier === 'analytics') {
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const data = await fetchBillingPlans(tier);
      setStripeEnabled(data.stripe_enabled);
      setPlans(data.plans.filter((plan) => plan.purchasable));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load plans.');
      setPlans([]);
    } finally {
      setLoading(false);
    }
  }, [tier]);

  useEffect(() => {
    if (!visible || !tier) return;
    void loadPlans();
  }, [visible, tier, loadPlans]);

  const handleSelectPlan = async (plan: BillingPlan) => {
    setCheckingOut(plan.id);
    setError(null);
    try {
      const { checkout_url } = await startCheckout(plan.id);
      const redirectUrl = Linking.createURL('/billing/success');

      if (Platform.OS === 'web') {
        window.open(checkout_url, '_blank', 'noopener,noreferrer');
        onClose();
        return;
      }

      const result = await WebBrowser.openAuthSessionAsync(checkout_url, redirectUrl);
      if (result.type === 'success' || result.type === 'dismiss') {
        await refreshBilling();
        onComplete();
      }
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Checkout failed.');
    } finally {
      setCheckingOut(null);
    }
  };

  const tierTitle =
    tier === 'student'
      ? 'Student plans'
      : tier === 'micro'
        ? 'Micro-transactions'
        : tier === 'diaspora'
          ? 'Diaspora plans'
          : 'Choose a plan';

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={[styles.sheet, { backgroundColor: cardBgColor, borderColor }]}>
          <View style={styles.header}>
            <ThemedText style={[styles.title, { color: textColor }]} type="defaultSemiBold">
              {tierTitle}
            </ThemedText>
            <TouchableOpacity onPress={onClose} hitSlop={12} activeOpacity={0.8}>
              <MaterialIcons name="close" size={24} color={textColor} />
            </TouchableOpacity>
          </View>

          {loading ? (
            <ActivityIndicator color={accentColor} style={styles.loader} />
          ) : null}

          {!loading && !stripeEnabled ? (
            <ThemedText style={[styles.message, { color: mutedColor }]}>
              Online payments are being enabled on the server. Try again after the next API
              deploy, or email hello@smartshelf.ng for help.
            </ThemedText>
          ) : null}

          {!loading && stripeEnabled && plans.length === 0 ? (
            <ThemedText style={[styles.message, { color: mutedColor }]}>
              No checkout plans are configured yet for this tier. Ask your admin to add Stripe
              Price IDs on Render.
            </ThemedText>
          ) : null}

          {error ? (
            <ThemedText style={[styles.error, { color: '#FF6B6B' }]}>{error}</ThemedText>
          ) : null}

          <ScrollView contentContainerStyle={styles.list} showsVerticalScrollIndicator={false}>
            {plans.map((plan) => (
              <TouchableOpacity
                key={plan.id}
                style={[styles.planCard, { borderColor }]}
                onPress={() => void handleSelectPlan(plan)}
                disabled={checkingOut !== null}
                activeOpacity={0.85}>
                <View style={styles.planTop}>
                  <ThemedText style={[styles.planName, { color: textColor }]}>{plan.name}</ThemedText>
                  <ThemedText style={[styles.planPrice, { color: accentColor }]}>
                    {plan.price_display}
                  </ThemedText>
                </View>
                <ThemedText style={[styles.planInterval, { color: mutedColor }]}>
                  {plan.interval_label}
                </ThemedText>
                <ThemedText style={[styles.planDescription, { color: mutedColor }]}>
                  {plan.description}
                </ThemedText>
                {checkingOut === plan.id ? (
                  <ActivityIndicator color={accentColor} style={styles.planLoader} />
                ) : (
                  <ThemedText style={[styles.planCta, { color: textColor }]}>Continue to checkout</ThemedText>
                )}
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'flex-end',
  },
  sheet: {
    maxHeight: '78%',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderWidth: StyleSheet.hairlineWidth,
    paddingTop: 16,
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  title: {
    fontSize: 18,
  },
  loader: {
    marginVertical: 24,
  },
  message: {
    fontSize: 13,
    lineHeight: 19,
    marginBottom: 12,
  },
  error: {
    fontSize: 13,
    marginBottom: 8,
  },
  list: {
    gap: 10,
    paddingBottom: 24,
  },
  planCard: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
    gap: 6,
  },
  planTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 12,
  },
  planName: {
    flex: 1,
    fontSize: 15,
    fontWeight: '700',
  },
  planPrice: {
    fontSize: 16,
    fontWeight: '800',
  },
  planInterval: {
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  planDescription: {
    fontSize: 13,
    lineHeight: 18,
  },
  planCta: {
    marginTop: 4,
    fontSize: 13,
    fontWeight: '700',
  },
  planLoader: {
    marginTop: 4,
  },
});
