import { useCallback, useRef, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';

import { ThemedText } from '@/components/themed-text';
import {
  MAX_MESSAGE_LENGTH,
  fetchMessageThread,
  sendMessage,
  type MessageThreadDetail,
} from '@/src/api/messages';
import { CenteredState, Muted, Screen, useKitTheme } from '@/src/components/ui/kit';
import { useRequireRole } from '@/src/hooks/useRequireRole';
import { formatMessageTime } from '@/src/lib/dates';

const POLL_MS = 15000;

export default function MessageThreadScreen() {
  const allowed = useRequireRole(['parent', 'staff']);
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const t = useKitTheme();
  const scrollRef = useRef<ScrollView>(null);

  const [thread, setThread] = useState<MessageThreadDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!id) return;
    try {
      setThread(await fetchMessageThread(String(id)));
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load this conversation.');
    }
  }, [id]);

  useFocusEffect(
    useCallback(() => {
      if (!allowed) return;
      void load();
      const timer = setInterval(() => void load(), POLL_MS);
      return () => clearInterval(timer);
    }, [allowed, load])
  );

  const send = async () => {
    const body = draft.trim();
    if (!body || !thread) return;
    setSending(true);
    setSendError(null);
    try {
      const msg = await sendMessage(thread.id, body);
      setDraft('');
      setThread((prev) => (prev ? { ...prev, messages: [...prev.messages, msg] } : prev));
    } catch (e) {
      setSendError(e instanceof Error ? e.message : 'Could not send your message.');
    } finally {
      setSending(false);
    }
  };

  if (!allowed || (!thread && !error)) {
    return (
      <Screen title="Messages" scroll={false}>
        <CenteredState loading />
      </Screen>
    );
  }
  if (!thread) {
    return (
      <Screen title="Messages" scroll={false}>
        <CenteredState message={error ?? 'Conversation not found.'} actionLabel="Try again" onAction={() => void load()} />
      </Screen>
    );
  }

  const isParent = thread.other.role === 'teacher';
  const subtitle = isParent
    ? `${thread.other.subtitle} · about ${thread.student.name}`
    : `Parent of ${thread.student.name}${thread.student.class ? ` (${thread.student.class})` : ''}`;

  return (
    <Screen title={thread.other.name} subtitle={subtitle} scroll={false}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={insets.top + 60}>
        <ScrollView
          ref={scrollRef}
          style={styles.flex}
          contentContainerStyle={styles.messages}
          onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: false })}
          keyboardShouldPersistTaps="handled">
          <Muted style={styles.notice}>
            Only you and {thread.other.name} can see these messages. SmartShelf may review them to keep
            children safe.
          </Muted>
          {thread.messages.map((m) => (
            <View
              key={m.id}
              style={[
                styles.bubble,
                m.from_me
                  ? [styles.mine, { backgroundColor: t.accent }]
                  : [styles.theirs, { backgroundColor: t.card, borderColor: t.border }],
              ]}>
              <ThemedText style={[styles.body, m.from_me && styles.mineText]} selectable>
                {m.body}
              </ThemedText>
              <ThemedText style={[styles.meta, { color: m.from_me ? '#00000099' : t.muted }]}>
                {formatMessageTime(m.created_at)}
              </ThemedText>
            </View>
          ))}
        </ScrollView>

        {thread.can_reply ? (
          <View style={[styles.composer, { borderTopColor: t.border, paddingBottom: Math.max(insets.bottom, 10) }]}>
            {sendError ? <ThemedText style={{ color: t.danger, fontSize: 13 }}>{sendError}</ThemedText> : null}
            <View style={styles.composerRow}>
              <TextInput
                value={draft}
                onChangeText={setDraft}
                placeholder="Write a message…"
                placeholderTextColor={t.muted}
                multiline
                maxLength={MAX_MESSAGE_LENGTH}
                style={[styles.input, { color: t.text, borderColor: t.border, backgroundColor: t.card }]}
              />
              <TouchableOpacity
                onPress={send}
                disabled={sending || !draft.trim()}
                style={[styles.sendBtn, { backgroundColor: t.accent }, (sending || !draft.trim()) && { opacity: 0.5 }]}
                accessibilityLabel="Send message">
                <MaterialIcons name="send" size={20} color="#000" />
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          <Muted style={[styles.blocked, { paddingBottom: Math.max(insets.bottom, 12) }]}>
            {thread.reply_blocked_reason ?? 'You can no longer reply to this conversation.'}
          </Muted>
        )}
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  messages: { gap: 8, paddingBottom: 16 },
  notice: { fontSize: 12, textAlign: 'center', marginBottom: 8 },
  bubble: { maxWidth: '82%', borderRadius: 14, paddingHorizontal: 12, paddingVertical: 8, gap: 2 },
  mine: { alignSelf: 'flex-end', borderBottomRightRadius: 4 },
  theirs: { alignSelf: 'flex-start', borderWidth: 1, borderBottomLeftRadius: 4 },
  body: { fontSize: 15, lineHeight: 21 },
  mineText: { color: '#000' },
  meta: { fontSize: 11, alignSelf: 'flex-end' },
  composer: { borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 10, gap: 6 },
  composerRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 8 },
  input: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingTop: 9,
    paddingBottom: 9,
    fontSize: 15,
    maxHeight: 140,
  },
  sendBtn: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center' },
  blocked: { textAlign: 'center', paddingTop: 12 },
});
