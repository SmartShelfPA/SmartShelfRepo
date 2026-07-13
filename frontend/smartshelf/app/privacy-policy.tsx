import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { TouchableOpacity } from 'react-native';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useThemeColor } from '@/hooks/use-theme-color';

/** Last updated: June 2024 — version 2024-06 */
const LAST_UPDATED = 'June 2024';
const CONTACT_EMAIL = 'info@smartshelflearn.com';
const DATA_CONTROLLER = 'SmartShelf Technologies';

export default function PrivacyPolicyScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const backgroundColor = useThemeColor({}, 'background');
  const textColor = useThemeColor({}, 'text');
  const mutedColor = useThemeColor({ light: '#687076', dark: '#9BA1A6' }, 'text');
  const accentColor = '#00FF41';

  return (
    <ThemedView style={[styles.container, { backgroundColor }]}>
      <View style={[styles.header, { paddingTop: Math.max(insets.top, 16) }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} activeOpacity={0.7}>
          <MaterialIcons name="arrow-back" size={22} color={textColor} />
        </TouchableOpacity>
        <ThemedText type="defaultSemiBold" style={styles.headerTitle}>
          Privacy Policy
        </ThemedText>
        <View style={styles.backBtn} />
      </View>

      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 40 }]}
        showsVerticalScrollIndicator={false}>

        <ThemedText style={[styles.meta, { color: mutedColor }]}>
          Last updated: {LAST_UPDATED} · Version 2024-06
        </ThemedText>

        <Section title="1. Who We Are">
          <ThemedText style={styles.body}>
            {DATA_CONTROLLER} ("SmartShelf", "we", "us") operates the SmartShelf mobile application
            and associated services. We are the data controller for personal data collected through
            this platform.
          </ThemedText>
          <ThemedText style={[styles.body, { marginTop: 8 }]}>
            Contact us for privacy matters: {CONTACT_EMAIL}
          </ThemedText>
        </Section>

        <Section title="2. What Data We Collect and Why">
          <ThemedText style={styles.body}>
            We collect only what is necessary to operate the platform:
          </ThemedText>
          <BulletList items={[
            'Account information: full name, username, email address, and password (hashed).',
            'Profile information: date of birth (for age-appropriate content), role (student/parent/teacher/publisher), and school/organisation.',
            'Reading and learning activity: progress through textbooks, practice exam responses, bookmarks, highlights, and notes.',
            'Device information: app version and OS type (for troubleshooting only).',
            'Optional: profile avatar image (stored on your device or our server).',
          ]} />
          <ThemedText style={[styles.body, { marginTop: 8 }]}>
            We do not sell your personal data. We do not run advertising. We do not use third-party
            ad-tracking SDKs.
          </ThemedText>
        </Section>

        <Section title="3. How We Use Your Data">
          <BulletList items={[
            'To create and manage your account.',
            'To deliver curriculum content and track your learning progress.',
            'To allow your school or parent/guardian to monitor learning progress (where applicable).',
            'To send password reset emails.',
            'To improve the platform (only if you have opted in to analytics — see Section 7).',
          ]} />
        </Section>

        <Section title="4. Who We Share Data With">
          <ThemedText style={styles.body}>
            We share data only as necessary:
          </ThemedText>
          <BulletList items={[
            'School administrators: can view reading and learning activity for students registered under their school.',
            'Parents/guardians: can view learning activity for students they are linked to.',
            'Service providers: hosting and infrastructure providers who process data on our behalf under appropriate agreements.',
            'Legal authorities: only when required by law or to protect safety.',
          ]} />
          <ThemedText style={[styles.body, { marginTop: 8 }]}>
            We do not share data with third-party marketers or advertisers.
          </ThemedText>
        </Section>

        <Section title="5. Children's Data">
          <ThemedText style={styles.body}>
            SmartShelf is designed for students, including minors. If you are under 18 (or the
            applicable age in your country), you should register through your school or with a
            parent/guardian who links their account to yours.
          </ThemedText>
          <ThemedText style={[styles.body, { marginTop: 8 }]}>
            We do not knowingly collect data from children under 13 without verifiable parental
            or school consent. If you believe we have done so in error, contact us at {CONTACT_EMAIL}{' '}
            and we will delete the account promptly.
          </ThemedText>
          <ThemedText style={[styles.body, { marginTop: 8 }]}>
            For students under 18: we collect only the minimum data needed for educational use,
            and we do not use it for profiling, advertising, or sale.
          </ThemedText>
        </Section>

        <Section title="6. Where Your Data Is Stored">
          <ThemedText style={styles.body}>
            Your data is stored on servers operated by or on behalf of SmartShelf. The primary
            data storage location is configured by your school or organisation administrator.
            If you are a school or institutional client, your data processing agreement specifies
            the storage region.
          </ThemedText>
          <ThemedText style={[styles.body, { marginTop: 8 }]}>
            If your account is accessed from outside the country where data is stored, that
            constitutes a cross-border data transfer. By using this app, you consent to this
            where required by law.
          </ThemedText>
        </Section>

        <Section title="7. Optional Analytics Consent">
          <ThemedText style={styles.body}>
            We ask for your separate, optional consent to collect anonymised usage data (e.g.
            which subjects are most used) to improve the platform. This is not required to use
            SmartShelf and you can withdraw it at any time in Settings → Privacy & Data.
          </ThemedText>
        </Section>

        <Section title="8. Your Rights">
          <ThemedText style={styles.body}>
            Depending on your location, you may have the right to:
          </ThemedText>
          <BulletList items={[
            'Access a copy of the data we hold about you.',
            'Correct inaccurate data.',
            'Delete your account and associated personal data.',
            'Withdraw optional consent (analytics) at any time.',
            'Complain to a data protection authority.',
          ]} />
          <ThemedText style={[styles.body, { marginTop: 8 }]}>
            To exercise these rights, use Settings → Privacy & Data in the app, or email{' '}
            {CONTACT_EMAIL}.
          </ThemedText>
        </Section>

        <Section title="9. Data Retention">
          <ThemedText style={styles.body}>
            We keep your account data for as long as your account is active or as required to
            deliver the service. Retention periods by category:
          </ThemedText>
          <BulletList items={[
            'Account & profile data: retained while your account is active. Anonymized within 30 days of a verified deletion request.',
            'Reading and learning progress: retained for the duration of your account. You may request deletion at any time.',
            'Audit logs: retained for 2 years for security and compliance purposes.',
            'Consent records: retained for the life of the account plus 5 years to evidence compliance.',
          ]} />
          <ThemedText style={[styles.body, { marginTop: 8 }]}>
            After deletion, your data is anonymized (PII replaced with non-identifiable
            placeholders) rather than fully erased from backups, unless you request complete
            erasure and there is no legal obligation to retain it.
          </ThemedText>
        </Section>

        <Section title="10. Security">
          <ThemedText style={styles.body}>
            We use industry-standard security measures including encrypted communication (HTTPS),
            hashed passwords, token-based authentication, and automatic account lockout after
            repeated failed login attempts. No system is perfectly secure. Contact us immediately
            at {CONTACT_EMAIL} if you suspect unauthorised access.
          </ThemedText>
        </Section>

        <Section title="11. Changes to This Policy">
          <ThemedText style={styles.body}>
            We will notify you in-app when this policy is materially updated. Continued use
            after notification constitutes acceptance of the new version.
          </ThemedText>
        </Section>

        {/* ── Jurisdiction-specific addenda ──────────────────────────── */}
        <JurisdictionBadge code="NDPA" label="Nigeria — NDPA 2023" />
        <Section title="A. Nigeria — Data Protection Act (NDPA) 2023">
          <ThemedText style={styles.body}>
            SmartShelf processes personal data in compliance with the Nigeria Data Protection
            Act 2023 (NDPA). As a data controller operating in Nigeria, we:
          </ThemedText>
          <BulletList items={[
            'Have a lawful basis for every processing activity (contract performance, legitimate interest, or explicit consent).',
            'Limit data collection to what is strictly necessary for the educational service.',
            'Implement technical and organisational security measures as required under Part VI of the NDPA.',
            'Will notify the Nigeria Data Protection Commission (NDPC) of reportable data breaches within 72 hours.',
            'Appoint a Data Protection Officer (DPO) reachable at ' + CONTACT_EMAIL + '.',
          ]} />
          <ThemedText style={[styles.body, { marginTop: 8 }]}>
            You may lodge a complaint with the NDPC at ndpc.gov.ng if you believe your rights
            under the NDPA have been violated.
          </ThemedText>
        </Section>

        <JurisdictionBadge code="COPPA" label="United States — COPPA" />
        <Section title="B. United States — Children's Online Privacy Protection Act (COPPA)">
          <ThemedText style={styles.body}>
            If you are based in the United States and are under 13, we require verifiable
            parental consent before collecting your personal information. SmartShelf:
          </ThemedText>
          <BulletList items={[
            'Does not knowingly collect personal information from children under 13 without parental consent.',
            'Allows parents/guardians to review, correct, and request deletion of their child\'s information.',
            'Does not condition participation in the educational service on a child providing more data than is reasonably necessary.',
            'Does not display targeted advertising to children.',
          ]} />
          <ThemedText style={[styles.body, { marginTop: 8 }]}>
            Parents may exercise these rights by emailing {CONTACT_EMAIL} or using Privacy &
            Data Settings in the app. For complaints, contact the U.S. Federal Trade Commission
            at ftc.gov.
          </ThemedText>
        </Section>

        <JurisdictionBadge code="PIPEDA" label="Canada — PIPEDA" />
        <Section title="C. Canada — Personal Information Protection and Electronic Documents Act (PIPEDA)">
          <ThemedText style={styles.body}>
            If you are based in Canada, the following applies in addition to our general policy:
          </ThemedText>
          <BulletList items={[
            'We collect, use, and disclose personal information only with your knowledge and meaningful consent.',
            'You may withdraw consent at any time, subject to legal or contractual restrictions, by emailing ' + CONTACT_EMAIL + '.',
            'We will explain the consequences of withdrawing consent before you do so.',
            'You have the right to access your personal information and challenge its accuracy.',
            'Transfers of your data outside Canada are subject to the laws of the receiving country. We take steps to ensure comparable protection applies.',
          ]} />
          <ThemedText style={[styles.body, { marginTop: 8 }]}>
            To file a complaint, contact the Office of the Privacy Commissioner of Canada at
            priv.gc.ca.
          </ThemedText>
        </Section>

        <Section title="12. Contact">
          <ThemedText style={styles.body}>
            {DATA_CONTROLLER}{'\n'}
            Email: {CONTACT_EMAIL}
          </ThemedText>
        </Section>

        <ThemedText style={[styles.meta, { color: mutedColor, textAlign: 'center', marginTop: 24 }]}>
          This policy is a compliance foundation. It does not constitute legal advice.
          Consult a qualified lawyer for jurisdiction-specific requirements.
        </ThemedText>
      </ScrollView>
    </ThemedView>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  const textColor = useThemeColor({}, 'text');
  return (
    <View style={styles.section}>
      <ThemedText style={[styles.sectionTitle, { color: textColor }]}>{title}</ThemedText>
      {children}
    </View>
  );
}

function JurisdictionBadge({ code, label }: { code: string; label: string }) {
  return (
    <View style={styles.jurisdictionBadge}>
      <ThemedText style={styles.jurisdictionCode}>{code}</ThemedText>
      <ThemedText style={styles.jurisdictionLabel}>{label}</ThemedText>
    </View>
  );
}

function BulletList({ items }: { items: string[] }) {
  const mutedColor = useThemeColor({ light: '#444', dark: '#ccc' }, 'text');
  return (
    <View style={styles.bulletList}>
      {items.map((item, i) => (
        <View key={i} style={styles.bulletRow}>
          <ThemedText style={[styles.bullet, { color: mutedColor }]}>•</ThemedText>
          <ThemedText style={[styles.bulletText, { color: mutedColor }]}>{item}</ThemedText>
        </View>
      ))}
    </View>
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
  meta: { fontSize: 12, marginBottom: 20, textAlign: 'center' },
  section: { marginBottom: 24 },
  sectionTitle: { fontSize: 15, fontWeight: '700', marginBottom: 8 },
  body: { fontSize: 14, lineHeight: 22, opacity: 0.85 },
  bulletList: { marginTop: 6, gap: 6 },
  bulletRow: { flexDirection: 'row', gap: 8 },
  bullet: { fontSize: 14, lineHeight: 22, width: 12 },
  bulletText: { flex: 1, fontSize: 14, lineHeight: 22 },
  jurisdictionBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 28,
    marginBottom: 4,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#444',
    paddingTop: 16,
  },
  jurisdictionCode: {
    fontSize: 11,
    fontWeight: '800',
    color: '#00FF41',
    backgroundColor: 'rgba(0,255,65,0.12)',
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 4,
    letterSpacing: 1,
    overflow: 'hidden',
  },
  jurisdictionLabel: {
    fontSize: 12,
    fontWeight: '700',
    opacity: 0.7,
    letterSpacing: 0.3,
  },
});
