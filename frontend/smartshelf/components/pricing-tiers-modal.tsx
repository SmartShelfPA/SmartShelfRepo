import {
  Modal,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { ThemedText } from '@/components/themed-text';
import {
  PRICING_HEADLINE,
  PRICING_SUBHEADLINE,
  PRICING_TIERS,
  type PricingTier,
} from '@/src/constants/pricingTiers';

type Props = {
  visible: boolean;
  onClose: () => void;
  cardBgColor: string;
  borderColor: string;
  textColor: string;
  mutedColor: string;
  accentColor: string;
  onTierPress?: (tier: PricingTier) => void;
};

function tierIcon(name: PricingTier['icon'], color: string) {
  return <MaterialIcons name={name} size={22} color={color} />;
}

export function PricingTiersModal({
  visible,
  onClose,
  cardBgColor,
  borderColor,
  textColor,
  mutedColor,
  accentColor,
  onTierPress,
}: Props) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={[styles.sheet, { backgroundColor: cardBgColor, borderColor }]}>
          <View style={styles.header}>
            <View style={{ flex: 1 }}>
              <ThemedText style={[styles.title, { color: textColor }]} type="defaultSemiBold">
                Prices
              </ThemedText>
              <ThemedText style={[styles.subtitle, { color: mutedColor }]}>
                {PRICING_HEADLINE}
              </ThemedText>
            </View>
            <TouchableOpacity onPress={onClose} hitSlop={12} activeOpacity={0.8}>
              <MaterialIcons name="close" size={24} color={textColor} />
            </TouchableOpacity>
          </View>

          <ThemedText style={[styles.intro, { color: mutedColor }]}>{PRICING_SUBHEADLINE}</ThemedText>

          <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}>
            {PRICING_TIERS.map((tier) => (
              <View
                key={tier.id}
                style={[
                  styles.tierCard,
                  { borderColor, backgroundColor: cardBgColor },
                  tier.highlighted && { borderColor: accentColor, borderWidth: 2 },
                ]}>
                {tier.highlighted ? (
                  <View style={[styles.badge, { backgroundColor: accentColor }]}>
                    <ThemedText style={styles.badgeText}>Most popular</ThemedText>
                  </View>
                ) : null}

                <View style={styles.tierTop}>
                  <View style={[styles.iconWrap, { borderColor }]}>
                    {tierIcon(tier.icon, accentColor)}
                  </View>
                  <View style={styles.tierTitles}>
                    <View style={[styles.audiencePill, { borderColor }]}>
                      <ThemedText style={[styles.audienceText, { color: mutedColor }]}>
                        {tier.audience}
                      </ThemedText>
                    </View>
                    <ThemedText style={[styles.tierTitle, { color: textColor }]}>
                      {tier.title}
                    </ThemedText>
                    <ThemedText style={[styles.tierTagline, { color: mutedColor }]}>
                      {tier.tagline}
                    </ThemedText>
                  </View>
                </View>

                <ThemedText style={[styles.price, { color: textColor }]}>{tier.price}</ThemedText>
                {tier.priceNote ? (
                  <ThemedText style={[styles.priceNote, { color: mutedColor }]}>
                    {tier.priceNote}
                  </ThemedText>
                ) : null}

                <View style={styles.featureList}>
                  {tier.features.map((feature) => (
                    <View key={feature} style={styles.featureRow}>
                      <MaterialIcons name="check-circle" size={16} color={accentColor} />
                      <ThemedText style={[styles.featureText, { color: textColor }]}>
                        {feature}
                      </ThemedText>
                    </View>
                  ))}
                </View>

                <TouchableOpacity
                  style={[
                    styles.cta,
                    tier.highlighted
                      ? { backgroundColor: accentColor }
                      : { borderColor, borderWidth: 1 },
                  ]}
                  onPress={() => onTierPress?.(tier)}
                  activeOpacity={0.85}>
                  <ThemedText
                    style={[
                      styles.ctaText,
                      { color: tier.highlighted ? '#000' : textColor },
                    ]}>
                    {tier.ctaLabel}
                  </ThemedText>
                </TouchableOpacity>
              </View>
            ))}

            <ThemedText style={[styles.footer, { color: mutedColor }]}>
              smartshelf.ng · Secure checkout powered by Stripe.
            </ThemedText>
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
    maxHeight: '92%',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderWidth: StyleSheet.hairlineWidth,
    paddingTop: 16,
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    marginBottom: 8,
  },
  title: {
    fontSize: 20,
  },
  subtitle: {
    fontSize: 13,
    marginTop: 4,
    lineHeight: 18,
  },
  intro: {
    fontSize: 13,
    lineHeight: 19,
    marginBottom: 12,
  },
  scroll: {
    flexGrow: 0,
  },
  scrollContent: {
    gap: 14,
    paddingBottom: 24,
  },
  tierCard: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
    gap: 10,
  },
  badge: {
    alignSelf: 'flex-start',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#000',
  },
  tierTop: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'flex-start',
  },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tierTitles: {
    flex: 1,
    gap: 4,
  },
  audiencePill: {
    alignSelf: 'flex-start',
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  audienceText: {
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  tierTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  tierTagline: {
    fontSize: 13,
    lineHeight: 18,
  },
  price: {
    fontSize: 22,
    fontWeight: '800',
  },
  priceNote: {
    fontSize: 12,
    marginTop: -4,
  },
  featureList: {
    gap: 8,
    marginTop: 4,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  featureText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
  },
  cta: {
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 4,
  },
  ctaText: {
    fontSize: 13,
    fontWeight: '700',
  },
  footer: {
    fontSize: 11,
    textAlign: 'center',
    lineHeight: 16,
    marginTop: 4,
  },
});
