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
const CONTACT_EMAIL = 'legal@smartshelf.ng';
const COMPANY = 'SmartShelf Technologies';

export default function TermsOfUseScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const backgroundColor = useThemeColor({}, 'background');
  const textColor = useThemeColor({}, 'text');
  const mutedColor = useThemeColor({ light: '#687076', dark: '#9BA1A6' }, 'text');

  return (
    <ThemedView style={[styles.container, { backgroundColor }]}>
      <View style={[styles.header, { paddingTop: Math.max(insets.top, 16) }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} activeOpacity={0.7}>
          <MaterialIcons name="arrow-back" size={22} color={textColor} />
        </TouchableOpacity>
        <ThemedText type="defaultSemiBold" style={styles.headerTitle}>
          Terms of Use
        </ThemedText>
        <View style={styles.backBtn} />
      </View>

      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 40 }]}
        showsVerticalScrollIndicator={false}>

        <ThemedText style={[styles.meta, { color: mutedColor }]}>
          Last updated: {LAST_UPDATED} · Version 2024-06
        </ThemedText>

        <Section title="1. About These Terms">
          <ThemedText style={styles.body}>
            These Terms of Use ("Terms") govern your access to and use of the SmartShelf mobile
            application and services provided by {COMPANY} ("SmartShelf", "we", "us"). By creating
            an account you agree to these Terms.
          </ThemedText>
        </Section>

        <Section title="2. Who May Use SmartShelf">
          <BulletList items={[
            'Students, parents/guardians, school staff, and publishers who have registered with a valid account.',
            'Users under 13 must be registered by a parent/guardian or school with appropriate consent.',
            'Users between 13 and 18 are considered minors; parental or school oversight is recommended.',
            'You must provide accurate information when creating your account.',
          ]} />
        </Section>

        <Section title="3. Your Account">
          <ThemedText style={styles.body}>
            You are responsible for keeping your login credentials secure. Notify us immediately
            at {CONTACT_EMAIL} if you suspect unauthorised access. You may not share your account
            or create accounts on behalf of others without authorisation.
          </ThemedText>
        </Section>

        <Section title="4. Acceptable Use">
          <ThemedText style={styles.body}>You must not:</ThemedText>
          <BulletList items={[
            'Use SmartShelf for any unlawful purpose.',
            'Attempt to access other users\' accounts or data.',
            'Reverse-engineer, copy, or redistribute the app or its content without permission.',
            'Upload content that infringes copyright, is defamatory, obscene, or harmful.',
            'Use automated tools to scrape or extract content.',
            'Impersonate another person or institution.',
          ]} />
        </Section>

        <Section title="5. Educational Content">
          <ThemedText style={styles.body}>
            Content on SmartShelf is provided for educational purposes only. Some content is
            published by schools or publishers who are responsible for its accuracy and licensing.
            {COMPANY} is not responsible for the accuracy of third-party educational content.
          </ThemedText>
          <ThemedText style={[styles.body, { marginTop: 8 }]}>
            Content that is labelled "public domain" is sourced from open repositories (e.g.
            Project Gutenberg). Commercially licensed content is used only under appropriate
            agreements with the rights holders.
          </ThemedText>
        </Section>

        <Section title="6. Intellectual Property">
          <ThemedText style={styles.body}>
            All SmartShelf branding, interface design, and original content remains the property
            of {COMPANY}. You may not reproduce or redistribute these without written permission.
          </ThemedText>
        </Section>

        <Section title="7. Privacy">
          <ThemedText style={styles.body}>
            Your use of SmartShelf is also governed by our Privacy Policy, which explains what
            data we collect, why, and your rights. The Privacy Policy is incorporated into these
            Terms by reference.
          </ThemedText>
        </Section>

        <Section title="8. School and Institutional Accounts">
          <ThemedText style={styles.body}>
            Schools and institutions that register students or staff accept responsibility for
            ensuring appropriate consent is obtained from students and parents where required.
            Schools must notify {COMPANY} if they cease operating or wish to transfer accounts.
          </ThemedText>
        </Section>

        <Section title="9. Publisher Accounts">
          <ThemedText style={styles.body}>
            Publishers who upload content warrant that they own or hold appropriate rights to
            distribute that content via SmartShelf. {COMPANY} may remove content that appears
            to infringe third-party rights without notice.
          </ThemedText>
        </Section>

        <Section title="10. Termination">
          <ThemedText style={styles.body}>
            We may suspend or terminate your account if you breach these Terms, if required by
            law, or if your account poses a risk to other users. You may request account deletion
            at any time in Settings → Privacy & Data.
          </ThemedText>
        </Section>

        <Section title="11. Disclaimer and Limitation of Liability">
          <ThemedText style={styles.body}>
            SmartShelf is provided "as is" without warranties of any kind. We do not guarantee
            uninterrupted service. To the maximum extent permitted by law, {COMPANY} is not liable
            for indirect, incidental, or consequential damages arising from your use of the platform.
          </ThemedText>
        </Section>

        <Section title="12. Governing Law">
          <ThemedText style={styles.body}>
            These Terms are governed by the laws of the Federal Republic of Nigeria. For users in
            other jurisdictions, additional or different local laws may apply.
          </ThemedText>
        </Section>

        <Section title="13. Changes">
          <ThemedText style={styles.body}>
            We will notify you in-app when these Terms are materially updated. Continued use after
            notification constitutes acceptance of the updated Terms.
          </ThemedText>
        </Section>

        <Section title="14. Contact">
          <ThemedText style={styles.body}>
            {COMPANY}{'\n'}
            Email: {CONTACT_EMAIL}
          </ThemedText>
        </Section>

        <ThemedText style={[styles.meta, { color: mutedColor, textAlign: 'center', marginTop: 24 }]}>
          These terms are a compliance foundation. Consult a qualified lawyer for
          jurisdiction-specific requirements.
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
});
