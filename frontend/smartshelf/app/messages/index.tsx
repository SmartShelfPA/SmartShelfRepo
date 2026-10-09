import { useCallback, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';

import { ThemedText } from '@/components/themed-text';
import { fetchMessageThreads, type MessageThreadSummary } from '@/src/api/messages';
import { Button, Card, CenteredState, Muted, Screen, useKitTheme } from '@/src/components/ui/kit';
import { useRequireRole } from '@/src/hooks/useRequireRole';
import { formatMessageTime } from '@/src/lib/dates';
import { useAuthStore } from '@/src/store/auth';

export default function MessagesScreen() {
  const allowed = useRequireRole(['parent', 'staff']);
  const isParent = useAuthStore((s) => s.user?.role === 'parent');
  const router = useRouter();
  const t = useKitTheme();

  const [threads, setThreads] = useState<MessageThreadSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      setThreads(await fetchMessageThreads());
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load messages.');
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      if (allowed) void load();
    }, [allowed, load])
  );

  const refresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const newButton = isParent ? (
    <TouchableOpacity
      onPress={() => router.push('/messages/new')}
      style={styles.headerBtn}
      accessibilityLabel="New message">
      <MaterialIcons name="edit" size={22} color={t.tint} />
    </TouchableOpacity>
  ) : null;

  if (!allowed || (!threads && !error)) {
    return (
      <Screen title="Messages" right={newButton} scroll={false}>
        <CenteredState loading />
      </Screen>
    );
  }

  if (error && !threads) {
    return (
      <Screen title="Messages" right={newButton} scroll={false}>
        <CenteredState message={error} actionLabel="Try again" onAction={() => void load()} />
      </Screen>
    );
  }

  const list = threads ?? [];

  return (
    <Screen
      title="Messages"
      subtitle={isParent ? "Talk to your child's teachers" : 'Messages from parents'}
      right={newButton}
      scroll={false}>
      <ScrollView
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />}>
        {list.length === 0 ? (
          <Card>
            <ThemedText style={styles.emptyTitle}>No messages yet</ThemedText>
            <Muted>
              {isParent
                ? "Send a message to your child's teacher. They'll get an email letting them know, and their reply will appear here."
                : "When a parent messages you about their child, it appears here and you'll get an email. You can reply from this screen."}
            </Muted>
            {isParent ? (
              <Button label="Message a teacher" icon="edit" onPress={() => router.push('/messages/new')} />
            ) : null}
          </Card>
        ) : (
          list.map((thread) => (
            <TouchableOpacity
              key={thread.id}
              activeOpacity={0.8}
              onPress={() => router.push({ pathname: '/messages/[id]', params: { id: thread.id } })}>
              <Card style={styles.row}>
                <View style={[styles.avatar, { backgroundColor: t.border }]}>
                  <MaterialIcons
                    name={thread.other.role === 'teacher' ? 'school' : 'family-restroom'}
                    size={22}
                    color={t.tint}
                  />
                </View>
                <View style={styles.rowBody}>
                  <View style={styles.rowTop}>
                    <ThemedText
                      style={[styles.name, thread.unread > 0 && styles.unreadText]}
                      numberOfLines={1}>
                      {thread.other.name}
                    </ThemedText>
                    <ThemedText style={[styles.time, { color: t.muted }]}>
                      {formatMessageTime(thread.last_message_at)}
                    </ThemedText>
                  </View>
                  <Muted style={styles.about}>
                    {isParent
                      ? `${thread.other.subtitle} · about ${thread.student.name}`
                      : `Parent of ${thread.student.name}${thread.student.class ? ` (${thread.student.class})` : ''}`}
                  </Muted>
                  <View style={styles.rowTop}>
                    <ThemedText
                      style={[styles.preview, { color: thread.unread > 0 ? t.text : t.muted }]}
                      numberOfLines={1}>
                      {thread.last_message
                        ? `${thread.last_message.from_me ? 'You: ' : ''}${thread.last_message.body}`
                        : ''}
                    </ThemedText>
                    {thread.unread > 0 ? (
                      <View style={[styles.badge, { backgroundColor: t.accent }]}>
                        <ThemedText style={styles.badgeText}>{thread.unread}</ThemedText>
                      </View>
                    ) : null}
                  </View>
                </View>
              </Card>
            </TouchableOpacity>
          ))
        )}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  headerBtn: { padding: 6 },
  list: { gap: 10, paddingBottom: 40 },
  emptyTitle: { fontSize: 16, fontWeight: '700' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatar: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  rowBody: { flex: 1, gap: 2 },
  rowTop: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  name: { flex: 1, fontSize: 16, fontWeight: '600' },
  unreadText: { fontWeight: '800' },
  time: { fontSize: 12 },
  about: { fontSize: 12, lineHeight: 16 },
  preview: { flex: 1, fontSize: 14 },
  badge: { minWidth: 22, height: 22, borderRadius: 11, paddingHorizontal: 6, alignItems: 'center', justifyContent: 'center' },
  badgeText: { color: '#000', fontSize: 12, fontWeight: '800' },
});
