import { useState } from 'react';
import {
  ScrollView,
  StyleSheet,
  View,
  Switch,
  Alert,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useThemeColor } from '@/hooks/use-theme-color';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { apiRequest } from '@/services/api';
import { useAuthStore } from '@/src/store/auth';

const CONTACT_EMAIL = 'info@smartshelflearn.com';

/** Age below which the account is considered a minor for consent display purposes. */
const MINOR_AGE = 18;

function getAge(dob: string | null | undefined): number | null {
  if (!dob) return null;
  const birth = new Date(dob);
  if (isNaN(birth.getTime())) return null;
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const monthDiff = today.getMonth() - birth.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) age--;
  return age;
}

export default function PrivacyDataScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const backgroundColor = useThemeColor({}, 'background');
  const textColor = useThemeColor({}, 'text');
  const colorScheme = useColorScheme();
  const cardBgColor = colorScheme === 'dark' ? '#1F1F1F' : '#FFFFFF';
  const borderColor = colorScheme === 'dark' ? '#2A2A2A' : '#E5E5E5';
  const mutedColor = colorScheme === 'dark' ? '#9BA1A6' : '#687076';
  const accentColor = '#00FF41';

  const user = useAuthStore((s) => s.user);
  const isMinor =
    user?.date_of_birth != null && (getAge(user.date_of_birth) ?? MINOR_AGE) < MINOR_AGE;
  const isSchoolManaged = user?.school_managed === true;
  const isParent = user?.role === 'parent';

  const [analyticsEnabled, setAnalyticsEnabled] = useState(
    user?.analytics_consent ?? false
  );
  const [analyticsLoading, setAnalyticsLoading] = useState(false);
  const [requestLoading, setRequestLoading] = useState(false);

  const handleAnalyticsToggle = async (value: boolean) => {
    setAnalyticsLoading(true);
    try {
      const response = await apiRequest('/v1/privacy/consent/', {
        method: 'PATCH',
        body: JSON.stringify({ analytics_consent: value }),
      });
      if (response.ok) {
        setAnalyticsEnabled(value);
      } else {
        Alert.alert('Error', 'Could not update preference. Please try again.');
      }
    } catch {
      Alert.alert('Error', 'Could not reach the server. Please check your connection.');
    } finally {
      setAnalyticsLoading(false);
    }
  };

  const submitDataRequest = async (type: string, label: string) => {
    Alert.alert(
      label,
      type === 'delete'
        ? 'This will request permanent deletion of your account and all associated data. Are you sure?'
        : `This will submit a "${label}" request to the SmartShelf team. Continue?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Submit request',
          style: type === 'delete' ? 'destructive' : 'default',
          onPress: async () => {
            setRequestLoading(true);
            try {
              const response = await apiRequest('/v1/privacy/data-request/', {
                method: 'POST',
                body: JSON.stringify({ request_type: type }),
              });
              if (response.ok) {
                Alert.alert(
                  'Request submitted',
                  `Your "${label}" request has been received. We'll follow up at your registered email within 30 days.`
                );
              } else {
                const data = await response.json().catch(() => ({}));
                Alert.alert('Error', (data as Record<string, string>).error ?? 'Request failed. Please try again.');
              }
            } catch {
              Alert.alert('Error', 'Could not reach the server. Please try again later.');
            } finally {
              setRequestLoading(false);
            }
          },
        },
      ]
    );
  };

  return (
    <ThemedView style={[styles.container, { backgroundColor }]}>
      <View style={[styles.header, { paddingTop: Math.max(insets.top, 16) }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} activeOpacity={0.7}>
          <MaterialIcons name="arrow-back" size={22} color={textColor} />
        </TouchableOpacity>
        <ThemedText type="defaultSemiBold" style={styles.headerTitle}>
          Privacy & Data
        </ThemedText>
        <View style={styles.backBtn} />
      </View>

      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 40 }]}
        showsVerticalScrollIndicator={false}>

        {/* Minor account banner */}
        {isMinor && (
          <View style={styles.noticeBanner}>
            <MaterialIcons name="child-care" size={16} color="#b38600" style={styles.noticeIcon} />
            <View style={{ flex: 1 }}>
              <ThemedText style={styles.noticeBannerTitle}>Minor account</ThemedText>
              <ThemedText style={styles.noticeBannerBody}>
                Your account is flagged as belonging to a minor (under {MINOR_AGE}). Optional
                analytics collection is disabled. A parent or guardian must consent before
                analytics data can be enabled for your account.
              </ThemedText>
            </View>
          </View>
        )}

        {/* School-managed account banner */}
        {isSchoolManaged && (
          <View style={[styles.noticeBanner, styles.schoolBanner]}>
            <MaterialIcons name="school" size={16} color="#1a6fc4" style={styles.noticeIcon} />
            <View style={{ flex: 1 }}>
              <ThemedText style={[styles.noticeBannerTitle, { color: '#1a6fc4' }]}>
                School-managed account
              </ThemedText>
              <ThemedText style={styles.noticeBannerBody}>
                This account is governed by your school's Data Processing Agreement with
                SmartShelf. Data handling follows the agreement your school has signed. Contact
                your school's privacy officer with questions.
              </ThemedText>
            </View>
          </View>
        )}

        {/* Parent — linked students notice */}
        {isParent && (
          <View style={[styles.noticeBanner, styles.parentBanner]}>
            <MaterialIcons name="family-restroom" size={16} color="#4a8c4a" style={styles.noticeIcon} />
            <View style={{ flex: 1 }}>
              <ThemedText style={[styles.noticeBannerTitle, { color: '#3a7a3a' }]}>
                Parent / Guardian account
              </ThemedText>
              <ThemedText style={styles.noticeBannerBody}>
                You have parental consent on record for linked student accounts. To revoke
                consent or request deletion of a linked student's data, submit a data request
                below or email us at {CONTACT_EMAIL}.
              </ThemedText>
            </View>
          </View>
        )}

        {/* Analytics consent */}
        <ThemedText style={[styles.sectionLabel, { color: mutedColor }]}>
          OPTIONAL DATA COLLECTION
        </ThemedText>
        <View style={[styles.card, { backgroundColor: cardBgColor, borderColor }]}>
          <View style={styles.toggleRow}>
            <View style={styles.toggleText}>
              <ThemedText style={styles.itemTitle}>Usage analytics</ThemedText>
              <ThemedText style={[styles.itemDesc, { color: mutedColor }]}>
                Anonymised data about which features you use, to help improve SmartShelf. We do not
                sell this data or use it for advertising.
                {isMinor ? ' Disabled for minor accounts.' : ''}
              </ThemedText>
            </View>
            {analyticsLoading ? (
              <ActivityIndicator color={accentColor} />
            ) : (
              <Switch
                value={analyticsEnabled && !isMinor}
                onValueChange={isMinor ? undefined : handleAnalyticsToggle}
                disabled={isMinor}
                thumbColor={analyticsEnabled && !isMinor ? accentColor : '#ccc'}
                trackColor={{ false: '#555', true: 'rgba(0,255,65,0.35)' }}
              />
            )}
          </View>
        </View>

        {/* Policy links */}
        <ThemedText style={[styles.sectionLabel, { color: mutedColor }]}>
          LEGAL DOCUMENTS
        </ThemedText>
        <View style={[styles.card, { backgroundColor: cardBgColor, borderColor }]}>
          {[
            { label: 'Privacy Policy', route: '/privacy-policy', icon: 'privacy-tip' as const },
            { label: 'Terms of Use', route: '/terms-of-use', icon: 'description' as const },
          ].map((item) => (
            <TouchableOpacity
              key={item.label}
              style={styles.linkRow}
              onPress={() => router.push(item.route)}
              activeOpacity={0.8}>
              <MaterialIcons name={item.icon} size={18} color={mutedColor} />
              <ThemedText style={[styles.linkLabel, { color: textColor }]}>{item.label}</ThemedText>
              <MaterialIcons name="chevron-right" size={18} color={mutedColor} />
            </TouchableOpacity>
          ))}
        </View>

        {/* Data rights requests */}
        <ThemedText style={[styles.sectionLabel, { color: mutedColor }]}>
          YOUR DATA RIGHTS
        </ThemedText>
        <ThemedText style={[styles.rightsIntro, { color: mutedColor }]}>
          You have the right to access, correct, or delete your data. Requests are handled manually
          within 30 days. You will receive confirmation at your registered email.
        </ThemedText>

        {requestLoading ? (
          <ActivityIndicator color={accentColor} style={{ marginTop: 20 }} />
        ) : (
          <View style={[styles.card, { backgroundColor: cardBgColor, borderColor }]}>
            {[
              { label: 'Request a copy of my data', type: 'export', icon: 'download' as const },
              { label: 'Correct my information', type: 'correct', icon: 'edit' as const },
              { label: 'Delete my account', type: 'delete', icon: 'delete-forever' as const, danger: true },
            ].map((item) => (
              <TouchableOpacity
                key={item.type}
                style={styles.linkRow}
                onPress={() => submitDataRequest(item.type, item.label)}
                activeOpacity={0.8}>
                <MaterialIcons
                  name={item.icon}
                  size={18}
                  color={item.danger ? '#ff4444' : mutedColor}
                />
                <ThemedText
                  style={[
                    styles.linkLabel,
                    { color: item.danger ? '#ff4444' : textColor },
                  ]}>
                  {item.label}
                </ThemedText>
                <MaterialIcons name="chevron-right" size={18} color={item.danger ? '#ff4444' : mutedColor} />
              </TouchableOpacity>
            ))}
          </View>
        )}

        <ThemedText style={[styles.contactNote, { color: mutedColor }]}>
          You can also email us directly: {CONTACT_EMAIL}
        </ThemedText>
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  backBtn: { width: 36 },
  headerTitle: { flex: 1, textAlign: 'center', fontSize: 17 },
  content: { paddingHorizontal: 20, paddingTop: 8 },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1,
    marginTop: 24,
    marginBottom: 10,
  },
  card: {
    borderRadius: 12,
    borderWidth: 1,
    overflow: 'hidden',
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    gap: 12,
  },
  toggleText: { flex: 1, gap: 4 },
  itemTitle: { fontSize: 14, fontWeight: '600' },
  itemDesc: { fontSize: 12, lineHeight: 18 },
  linkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    gap: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#2A2A2A',
  },
  linkLabel: { flex: 1, fontSize: 14 },
  rightsIntro: { fontSize: 13, lineHeight: 20, marginBottom: 10 },
  contactNote: { fontSize: 12, textAlign: 'center', marginTop: 24 },
  noticeBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#d4a017',
    backgroundColor: 'rgba(212,160,23,0.08)',
    padding: 12,
    marginTop: 16,
    gap: 10,
  },
  schoolBanner: {
    borderColor: '#1a6fc4',
    backgroundColor: 'rgba(26,111,196,0.07)',
  },
  parentBanner: {
    borderColor: '#4a8c4a',
    backgroundColor: 'rgba(74,140,74,0.07)',
  },
  noticeIcon: { marginTop: 2, flexShrink: 0 },
  noticeBannerTitle: { fontSize: 13, fontWeight: '700', color: '#b38600', marginBottom: 4 },
  noticeBannerBody: { fontSize: 12, lineHeight: 18, opacity: 0.85 },
});
