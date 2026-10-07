import { useCallback, useEffect, useState } from 'react';
import { Linking, Platform, StyleSheet, Switch, TouchableOpacity, View } from 'react-native';
import Constants from 'expo-constants';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';

import { ThemedText } from '@/components/themed-text';
import {
  FEEDBACK_CATEGORY_LABELS,
  FEEDBACK_STATUS_LABELS,
  fetchMyFeedback,
  fetchSupportInfo,
  sendFeedback,
  type FeedbackCategory,
  type FeedbackItem,
  type SupportInfo,
} from '@/src/api/support';
import { Button, Card, Chip, Field, Muted, Screen, SectionLabel, useKitTheme } from '@/src/components/ui/kit';
import { useAuthStore } from '@/src/store/auth';
import { formatShortDate } from '@/src/lib/dates';

const FALLBACK_EMAIL = 'info@smartshelflearn.com';

export default function FeedbackScreen() {
  const t = useKitTheme();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  const [info, setInfo] = useState<SupportInfo | null>(null);
  const [history, setHistory] = useState<FeedbackItem[]>([]);
  const [category, setCategory] = useState<FeedbackCategory>('idea');
  const [message, setMessage] = useState('');
  const [rating, setRating] = useState<number | null>(null);
  const [contactOk, setContactOk] = useState(true);
  const [sending, setSending] = useState(false);
  const [status, setStatus] = useState<{ ok: boolean; text: string } | null>(null);

  const loadHistory = useCallback(() => {
    if (!isAuthenticated) return;
    fetchMyFeedback().then(setHistory).catch(() => setHistory([]));
  }, [isAuthenticated]);

  useEffect(() => {
    fetchSupportInfo().then(setInfo).catch(() => setInfo(null));
    loadHistory();
  }, [loadHistory]);

  const email = info?.email || FALLBACK_EMAIL;
  const appVersion = Constants.expoConfig?.version ?? '';

  const submit = async () => {
    if (message.trim().length < 3) {
      setStatus({ ok: false, text: 'Tell us a little more first.' });
      return;
    }
    setSending(true);
    setStatus(null);
    try {
      await sendFeedback({
        category,
        message: message.trim(),
        rating,
        app_version: appVersion,
        platform: Platform.OS,
        contact_ok: contactOk,
      });
      setMessage('');
      setRating(null);
      setStatus({ ok: true, text: 'Thank you! The SmartShelf team reads every message.' });
      loadHistory();
    } catch (e) {
      setStatus({ ok: false, text: e instanceof Error ? e.message : 'Could not send. Try again.' });
    } finally {
      setSending(false);
    }
  };

  return (
    <Screen title="Help & feedback" subtitle="Beta support">
      <Card>
        <ThemedText style={styles.title}>Talk to the SmartShelf team</ThemedText>
        {info?.hours ? <Muted>{info.hours}</Muted> : null}
        {info?.whatsapp_url ? (
          <Button
            label={`WhatsApp ${info.whatsapp_number}`}
            icon="chat"
            onPress={() => void Linking.openURL(info.whatsapp_url)}
          />
        ) : null}
        <Button
          label={`Email ${email}`}
          icon="email"
          variant="secondary"
          onPress={() => void Linking.openURL(`mailto:${email}?subject=${encodeURIComponent('SmartShelf beta')}`)}
        />
      </Card>

      {isAuthenticated ? (
        <>
          <SectionLabel>SEND FEEDBACK</SectionLabel>
          <Card>
            <View style={styles.wrap}>
              {(Object.keys(FEEDBACK_CATEGORY_LABELS) as FeedbackCategory[]).map((c) => (
                <Chip
                  key={c}
                  label={FEEDBACK_CATEGORY_LABELS[c]}
                  selected={category === c}
                  onPress={() => setCategory(c)}
                />
              ))}
            </View>
            <Field
              value={message}
              onChangeText={setMessage}
              multiline
              placeholder={
                category === 'bug'
                  ? 'What happened, and what did you expect? Which screen were you on?'
                  : 'Tell us what you think'
              }
            />
            <ThemedText style={styles.label}>How is SmartShelf working for you? (optional)</ThemedText>
            <View style={styles.stars}>
              {[1, 2, 3, 4, 5].map((n) => (
                <TouchableOpacity
                  key={n}
                  onPress={() => setRating(rating === n ? null : n)}
                  accessibilityLabel={`${n} star${n === 1 ? '' : 's'}`}>
                  <MaterialIcons
                    name={rating != null && n <= rating ? 'star' : 'star-border'}
                    size={30}
                    color={rating != null && n <= rating ? '#f5b301' : t.muted}
                  />
                </TouchableOpacity>
              ))}
            </View>
            <View style={styles.row}>
              <Switch value={contactOk} onValueChange={setContactOk} trackColor={{ true: t.accent }} />
              <ThemedText style={{ flex: 1, fontSize: 13 }}>The team may contact me about this</ThemedText>
            </View>
            {status ? (
              <ThemedText style={{ color: status.ok ? '#00C832' : t.danger }}>{status.text}</ThemedText>
            ) : null}
            <Button label="Send" icon="send" onPress={submit} loading={sending} />
          </Card>

          {history.length > 0 ? (
            <>
              <SectionLabel>YOUR FEEDBACK</SectionLabel>
              {history.map((f) => (
                <Card key={f.id}>
                  <View style={styles.row}>
                    <Muted style={{ flex: 1, fontSize: 12 }}>
                      {FEEDBACK_CATEGORY_LABELS[f.category]} · {formatShortDate(f.created_at)}
                    </Muted>
                    <ThemedText style={styles.status}>{FEEDBACK_STATUS_LABELS[f.status]}</ThemedText>
                  </View>
                  <ThemedText numberOfLines={4}>{f.message}</ThemedText>
                </Card>
              ))}
            </>
          ) : null}
        </>
      ) : (
        <Muted>Sign in to send feedback from the app.</Muted>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 16, fontWeight: '700' },
  label: { fontSize: 14, fontWeight: '600' },
  wrap: { flexDirection: 'row', flexWrap: 'wrap' },
  stars: { flexDirection: 'row', gap: 4 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  status: { fontSize: 12, fontWeight: '700' },
});
