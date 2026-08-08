import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { TouchableOpacity } from 'react-native';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useThemeColor } from '@/hooks/use-theme-color';

/** Last updated: 4 August 2026 — version 2026-08 */
const LAST_UPDATED = '4 August 2026';
const CONTACT_EMAIL = 'info@smartshelflearn.com';

export default function PrivacyPolicyScreen() {
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
          Privacy Policy
        </ThemedText>
        <View style={styles.backBtn} />
      </View>

      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 40 }]}
        showsVerticalScrollIndicator={false}>

        <ThemedText style={[styles.meta, { color: mutedColor }]}>
          Last updated: {LAST_UPDATED} · Version 2026-08
        </ThemedText>

        <Section title="1. Who we are">
          <ThemedText style={styles.body}>
            SmartShelf is a mobile learning app that helps students access and read digital
            textbooks for WAEC, IGCSE, and JAMB exams. We operate in Nigeria and process personal
            data of students, parents, and teachers in line with the Nigeria Data Protection
            Regulation (NDPR) and the Nigeria Data Protection Act.
          </ThemedText>
        </Section>

        <Section title="2. What this policy covers">
          <ThemedText style={styles.body}>This Privacy Policy explains:</ThemedText>
          <BulletList
            items={[
              'What personal information we collect',
              'How and why we use it',
              'Who we share it with',
              'How we keep it safe',
              'Your rights and how to contact us',
            ]}
          />
          <ThemedText style={[styles.body, { marginTop: 8 }]}>
            By using SmartShelf, you agree that we may collect and use your information as
            described here, unless you withdraw your consent.
          </ThemedText>
        </Section>

        <Section title="3. The data we collect">
          <ThemedText style={styles.body}>
            We may collect the following types of personal data:
          </ThemedText>
          <BulletList
            items={[
              'Account details: name, email address, password, school, class, role (student, parent, teacher).',
              'Usage data: textbooks opened, pages read, reading time, search terms, app settings.',
              'Device data: device model, operating system version, anonymized identifiers, crash logs.',
              'Support data: messages you send to us, feedback submitted in the app.',
            ]}
          />
          <ThemedText style={[styles.body, { marginTop: 8 }]}>
            We do not intentionally collect sensitive data (such as health information, religion,
            or biometric data) through SmartShelf.
          </ThemedText>
        </Section>

        <Section title="4. How we collect data">
          <ThemedText style={styles.body}>We collect data:</ThemedText>
          <BulletList
            items={[
              'Directly from you when you create an account, log in, or contact support.',
              'Automatically when you use the app (for example, which books you open and how long you read).',
              'From your school or teacher, where they create accounts or link you to a class.',
            ]}
          />
          <ThemedText style={[styles.body, { marginTop: 8 }]}>
            We may use technical methods such as cookies, local storage, tokens, and analytics
            SDKs to collect and store data securely.
          </ThemedText>
        </Section>

        <Section title="5. Why we use your data (our purposes)">
          <ThemedText style={styles.body}>
            We process personal data only for clear, lawful purposes, including:
          </ThemedText>
          <BulletList
            items={[
              'To create and manage your SmartShelf account.',
              'To provide access to textbooks and track reading progress.',
              'To show teachers and parents high-level learning progress, where your school has enabled these features.',
              'To improve app performance, fix bugs, and understand how students use SmartShelf.',
              'To send important service messages (for example, changes to terms, security alerts).',
            ]}
          />
          <ThemedText style={[styles.body, { marginTop: 8 }]}>
            We do not sell your personal data.
          </ThemedText>
        </Section>

        <Section title="6. Legal basis and consent">
          <ThemedText style={styles.body}>
            We rely on one or more of the following lawful bases when we process your data:
          </ThemedText>
          <BulletList
            items={[
              'Your consent, which you can withdraw at any time.',
              'Performance of a contract, for example providing the app to you or your school.',
              'Legitimate interests, such as improving SmartShelf and preventing abuse, where these do not override your rights.',
            ]}
          />
          <ThemedText style={[styles.body, { marginTop: 8 }]}>
            Before we collect your data, we ask you to agree to this Privacy Policy and the
            SmartShelf Terms of Use.
          </ThemedText>
        </Section>

        <Section title="7. Who we share data with">
          <ThemedText style={styles.body}>
            We may share limited personal data with:
          </ThemedText>
          <BulletList
            items={[
              'Your school or teacher, to show learning progress, assignments, and usage summaries.',
              'Service providers, such as cloud hosting, analytics, or email delivery tools that help us run the app.',
              'Regulators or law-enforcement, if required by law.',
            ]}
          />
          <ThemedText style={[styles.body, { marginTop: 8 }]}>
            These third parties only process data on our instructions and must keep it secure and
            confidential. We do not give them permission to use your data for their own marketing.
          </ThemedText>
          <ThemedText style={[styles.body, { marginTop: 8 }]}>
            If we transfer data outside Nigeria, we will only do so where there is adequate
            protection and as allowed by NDPR and the Nigeria Data Protection Act.
          </ThemedText>
        </Section>

        <Section title="8. How we protect your data">
          <ThemedText style={styles.body}>
            We use technical and organizational measures to keep your data safe, such as:
          </ThemedText>
          <BulletList
            items={[
              'Encryption in transit and at rest where applicable',
              'Access controls and authentication',
              'Regular updates and security monitoring',
            ]}
          />
          <ThemedText style={[styles.body, { marginTop: 8 }]}>
            However, no system is 100% secure. If we become aware of a data breach that affects
            you, we will notify you and the relevant authorities as required by law.
          </ThemedText>
        </Section>

        <Section title="9. How long we keep your data">
          <ThemedText style={styles.body}>
            We keep your personal data only for as long as we need it to:
          </ThemedText>
          <BulletList
            items={[
              'Provide the SmartShelf service',
              'Comply with legal, accounting, or reporting requirements',
            ]}
          />
          <ThemedText style={[styles.body, { marginTop: 8 }]}>
            When we no longer need your data, we will delete it or anonymize it.
          </ThemedText>
        </Section>

        <Section title="10. Your rights">
          <ThemedText style={styles.body}>
            Under Nigerian data protection laws, you have rights including:
          </ThemedText>
          <BulletList
            items={[
              'Access: request a copy of the personal data we hold about you.',
              'Correction: ask us to fix inaccurate or incomplete data.',
              'Deletion: ask us to delete your data where we have no lawful reason to keep it.',
              'Restriction: limit how we use your data in certain situations.',
              'Objection: object to certain types of processing, especially for direct marketing.',
              'Data portability: request your data in a portable format, where applicable.',
            ]}
          />
          <ThemedText style={[styles.body, { marginTop: 8 }]}>
            To exercise these rights, contact us using the details below. We may need to confirm
            your identity before responding.
          </ThemedText>
        </Section>

        <Section title="11. Children and minors">
          <ThemedText style={styles.body}>
            SmartShelf is designed for senior secondary students. Where local law requires parental
            or school consent, we rely on the school or parents to authorize student use of the
            app. If we learn that we collected personal data from a child without proper consent,
            we will delete it as soon as reasonably possible.
          </ThemedText>
        </Section>

        <Section title="12. Data Protection Officer / contact details">
          <ThemedText style={styles.body}>
            If you have any questions, complaints, or requests about this Privacy Policy, please
            contact:
          </ThemedText>
          <ThemedText style={[styles.body, { marginTop: 8 }]}>
            SmartShelf Data Protection Contact{'\n'}
            Email: {CONTACT_EMAIL}
          </ThemedText>
          <ThemedText style={[styles.body, { marginTop: 8 }]}>
            You may also lodge a complaint with the Nigeria Data Protection Commission if you are
            not satisfied with our response.
          </ThemedText>
        </Section>

        <Section title="13. Changes to this policy">
          <ThemedText style={styles.body}>
            We may update this Privacy Policy from time to time. When we do, we will change the
            "Last updated" date at the top and, where appropriate, notify you in the app or by
            email. Your continued use of SmartShelf after changes means you accept the updated
            policy.
          </ThemedText>
        </Section>
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
