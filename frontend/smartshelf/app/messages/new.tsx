import { useEffect, useState } from 'react';
import { StyleSheet, TouchableOpacity, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';

import { ThemedText } from '@/components/themed-text';
import {
  MAX_MESSAGE_LENGTH,
  fetchMessageContacts,
  startMessageThread,
  type MessageContactChild,
} from '@/src/api/messages';
import {
  Button,
  Card,
  CenteredState,
  Chip,
  Field,
  Muted,
  Screen,
  SectionLabel,
  useKitTheme,
} from '@/src/components/ui/kit';
import { useRequireRole } from '@/src/hooks/useRequireRole';

export default function NewMessageScreen() {
  const allowed = useRequireRole(['parent']);
  const { studentId } = useLocalSearchParams<{ studentId?: string }>();
  const router = useRouter();
  const t = useKitTheme();

  const [children, setChildren] = useState<MessageContactChild[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [childId, setChildId] = useState<string | null>(null);
  const [teacherId, setTeacherId] = useState<string | null>(null);
  const [body, setBody] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!allowed) return;
    fetchMessageContacts()
      .then((list) => {
        setChildren(list);
        const initial = list.find((c) => c.id === studentId) ?? list[0];
        if (initial) {
          setChildId(initial.id);
          if (initial.teachers.length === 1) setTeacherId(initial.teachers[0].id);
        }
      })
      .catch((e) => setLoadError(e instanceof Error ? e.message : 'Could not load teachers.'));
  }, [allowed, studentId]);

  if (!allowed || (!children && !loadError)) {
    return (
      <Screen title="New message" scroll={false}>
        <CenteredState loading />
      </Screen>
    );
  }
  if (loadError || !children) {
    return (
      <Screen title="New message" scroll={false}>
        <CenteredState message={loadError ?? 'Could not load teachers.'} />
      </Screen>
    );
  }
  if (children.length === 0) {
    return (
      <Screen title="New message" scroll={false}>
        <CenteredState message="Link your account to your child first, using the parent invite code from their school." />
      </Screen>
    );
  }

  const child = children.find((c) => c.id === childId) ?? children[0];
  const teacher = child.teachers.find((x) => x.id === teacherId) ?? null;

  const pickChild = (id: string) => {
    setChildId(id);
    const next = children.find((c) => c.id === id);
    setTeacherId(next && next.teachers.length === 1 ? next.teachers[0].id : null);
    setError(null);
  };

  const send = async () => {
    if (!teacher) {
      setError('Choose a teacher.');
      return;
    }
    if (!body.trim()) {
      setError('Write a message first.');
      return;
    }
    setSending(true);
    setError(null);
    try {
      const thread = await startMessageThread({
        teacher_id: teacher.id,
        student_id: child.id,
        body: body.trim(),
      });
      router.replace({ pathname: '/messages/[id]', params: { id: thread.id } });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not send your message.');
      setSending(false);
    }
  };

  return (
    <Screen title="New message" subtitle="To your child's teacher">
      {children.length > 1 ? (
        <>
          <SectionLabel>ABOUT</SectionLabel>
          <View style={styles.chips}>
            {children.map((c) => (
              <Chip key={c.id} label={c.name} selected={c.id === child.id} onPress={() => pickChild(c.id)} />
            ))}
          </View>
        </>
      ) : null}

      <SectionLabel>TEACHER</SectionLabel>
      {child.teachers.length === 0 ? (
        <Card>
          <Muted>
            {child.school
              ? `No teachers at ${child.school} are set up on SmartShelf yet. Please contact the school directly for now.`
              : `${child.name} isn't linked to a school on SmartShelf, so there are no teachers to message.`}
          </Muted>
        </Card>
      ) : (
        child.teachers.map((x) => {
          const selected = x.id === teacher?.id;
          return (
            <TouchableOpacity key={x.id} activeOpacity={0.8} onPress={() => setTeacherId(x.id)}>
              <Card style={[styles.teacherRow, selected && { borderColor: t.accent }]}>
                <MaterialIcons
                  name={selected ? 'radio-button-checked' : 'radio-button-unchecked'}
                  size={22}
                  color={selected ? t.accent : t.muted}
                />
                <View style={styles.flex}>
                  <ThemedText style={styles.teacherName}>{x.name}</ThemedText>
                  <Muted style={styles.small}>
                    {x.subtitle}
                    {x.thread_id ? ' · continues your conversation' : ''}
                  </Muted>
                </View>
              </Card>
            </TouchableOpacity>
          );
        })
      )}

      {child.teachers.length > 0 ? (
        <>
          <Field
            label="Message"
            placeholder={`Write to ${teacher?.name ?? 'the teacher'} about ${child.name}…`}
            value={body}
            onChangeText={setBody}
            multiline
            maxLength={MAX_MESSAGE_LENGTH}
            hint="Teachers usually reply within school days. For anything urgent, call the school."
          />
          {error ? <ThemedText style={{ color: t.danger }}>{error}</ThemedText> : null}
          <Button label="Send" icon="send" onPress={send} loading={sending} disabled={!teacher || !body.trim()} />
        </>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  chips: { flexDirection: 'row', flexWrap: 'wrap' },
  teacherRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  teacherName: { fontSize: 16, fontWeight: '600' },
  small: { fontSize: 13 },
});
