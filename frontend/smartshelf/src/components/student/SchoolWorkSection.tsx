import { useCallback, useState } from 'react';
import { StyleSheet, TouchableOpacity, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';

import { ThemedText } from '@/components/themed-text';
import { fetchStudentAssignments, type StudentAssignment } from '@/src/api/assignments';
import { useKitTheme } from '@/src/components/ui/kit';
import { formatDue } from '@/src/lib/dates';

/** Student home: teacher-set work and school resources. */
export function SchoolWorkSection({ schoolName }: { schoolName?: string }) {
  const router = useRouter();
  const t = useKitTheme();
  const [todo, setTodo] = useState<StudentAssignment[] | null>(null);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      fetchStudentAssignments()
        .then((items) => {
          if (!active) return;
          const open = items
            .filter((a) => a.submission.status === 'assigned')
            .sort((a, b) => (a.due_at ?? '9999').localeCompare(b.due_at ?? '9999'));
          setTodo(open);
        })
        .catch(() => active && setTodo([]));
      return () => {
        active = false;
      };
    }, [])
  );

  return (
    <View style={styles.section}>
      <ThemedText style={styles.sectionTitle} type="defaultSemiBold">
        {schoolName ? schoolName.toUpperCase() : 'MY SCHOOL'}
      </ThemedText>

      <TouchableOpacity
        activeOpacity={0.8}
        onPress={() => router.push('/assignments')}
        style={[styles.card, { borderColor: '#00FF41', backgroundColor: t.card }]}>
        <View style={styles.cardHeader}>
          <MaterialIcons name="assignment" size={22} color={t.tint} />
          <ThemedText style={styles.cardTitle}>Assignments</ThemedText>
          {todo && todo.length > 0 ? (
            <View style={[styles.badge, { backgroundColor: '#00FF41' }]}>
              <ThemedText style={styles.badgeText}>{todo.length}</ThemedText>
            </View>
          ) : null}
          <MaterialIcons name="chevron-right" size={20} color={t.muted} />
        </View>
        {todo === null ? null : todo.length === 0 ? (
          <ThemedText style={[styles.line, { color: t.muted }]}>Nothing due. Nice work!</ThemedText>
        ) : (
          todo.slice(0, 3).map((a) => {
            const overdue = !!a.due_at && new Date(a.due_at) < new Date();
            return (
              <ThemedText key={a.id} style={styles.line} numberOfLines={1}>
                {a.title}
                <ThemedText style={{ color: overdue ? t.danger : t.muted, fontSize: 13 }}>
                  {'  '}
                  {formatDue(a.due_at)}
                </ThemedText>
              </ThemedText>
            );
          })
        )}
      </TouchableOpacity>

      <TouchableOpacity
        activeOpacity={0.8}
        onPress={() => router.push('/school/resources')}
        style={[styles.card, { borderColor: '#00FF41', backgroundColor: t.card }]}>
        <View style={styles.cardHeader}>
          <MaterialIcons name="folder-shared" size={22} color={t.tint} />
          <ThemedText style={styles.cardTitle}>School resources</ThemedText>
          <MaterialIcons name="chevron-right" size={20} color={t.muted} />
        </View>
        <ThemedText style={[styles.line, { color: t.muted }]}>Notes and PDFs shared by your teachers</ThemedText>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  section: { marginTop: 4, marginBottom: 12, gap: 12 },
  sectionTitle: { fontSize: 18, fontWeight: '600', paddingHorizontal: 16 },
  card: { borderWidth: 1, borderRadius: 12, padding: 14, gap: 6, marginHorizontal: 16 },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  cardTitle: { flex: 1, fontSize: 16, fontWeight: '700' },
  badge: { minWidth: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6 },
  badgeText: { color: '#000', fontWeight: '800', fontSize: 12 },
  line: { fontSize: 14 },
});
