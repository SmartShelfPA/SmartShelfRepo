import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  StyleSheet,
  ScrollView,
  View,
  TouchableOpacity,
  ActivityIndicator,
  Modal,
  TextInput,
  Switch,
  Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useThemeColor } from '@/hooks/use-theme-color';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { ParentHeader } from '@/src/components/parent';
import { TeacherClassOverviewCard, TeacherStudentCard } from '@/src/components/teacher';
import {
  createTeacherNote,
  fetchTeacherDashboard,
  type TeacherDashboardData,
  type TeacherStudent,
} from '@/src/api/teacher';
import { createParentInvite } from '@/src/api/parentInvite';
import { useRequireAuth } from '@/src/hooks/useRequireAuth';
import { useAuthStore } from '@/src/store/auth';

export default function TeacherView() {
  useRequireAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const signOut = useAuthStore((s) => s.signOut);
  const user = useAuthStore((s) => s.user);

  const colorScheme = useColorScheme();
  const backgroundColor = useThemeColor({}, 'background');
  const textColor = useThemeColor({}, 'text');
  const mutedTextColor = colorScheme === 'dark' ? '#9BA1A6' : '#687076';
  const tintColor = colorScheme === 'dark' ? '#fff' : '#00FF41';
  const cardBgColor = colorScheme === 'dark' ? '#1F1F1F' : '#FFFFFF';
  const borderColor = colorScheme === 'dark' ? '#2A2A2A' : '#E5E5E5';

  const [dashboard, setDashboard] = useState<TeacherDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedClassId, setSelectedClassId] = useState<string | 'all'>('all');
  const [noteModalOpen, setNoteModalOpen] = useState(false);
  const [noteStudent, setNoteStudent] = useState<TeacherStudent | null>(null);
  const [noteText, setNoteText] = useState('');
  const [shareWithParent, setShareWithParent] = useState(false);
  const [savingNote, setSavingNote] = useState(false);
  const [inviteModalOpen, setInviteModalOpen] = useState(false);
  const [inviteStudent, setInviteStudent] = useState<TeacherStudent | null>(null);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteCode, setInviteCode] = useState<string | null>(null);
  const [inviteLoading, setInviteLoading] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    fetchTeacherDashboard()
      .then(setDashboard)
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (user && user.role !== 'staff') {
      router.replace('/(tabs)');
      return;
    }
    load();
  }, [user, router, load]);

  const filteredStudents = useMemo(() => {
    if (!dashboard) return [];
    if (selectedClassId === 'all') return dashboard.students;
    return dashboard.students.filter((s) => s.classId === selectedClassId);
  }, [dashboard, selectedClassId]);

  const openNoteModal = (student: TeacherStudent) => {
    setNoteStudent(student);
    setNoteText('');
    setShareWithParent(false);
    setNoteModalOpen(true);
  };

  const openInviteModal = (student: TeacherStudent) => {
    setInviteStudent(student);
    setInviteEmail('');
    setInviteCode(null);
    setInviteModalOpen(true);
  };

  const sendParentInvite = async () => {
    if (!inviteStudent) return;
    setInviteLoading(true);
    try {
      const result = await createParentInvite({
        student_id: inviteStudent.id,
        guardian_email: inviteEmail.trim() || undefined,
      });
      setInviteCode(result.code);
    } catch (e: unknown) {
      Alert.alert('Invite failed', e instanceof Error ? e.message : 'Try again');
    } finally {
      setInviteLoading(false);
    }
  };

  const saveNote = async () => {
    if (!noteStudent || !noteText.trim()) return;
    setSavingNote(true);
    try {
      const created = await createTeacherNote({
        student_id: noteStudent.id,
        note: noteText.trim(),
        shared_with_parent: shareWithParent,
      });
      setDashboard((prev) =>
        prev ? { ...prev, notes: [created, ...prev.notes] } : prev
      );
      setNoteModalOpen(false);
    } catch (e: unknown) {
      Alert.alert('Could not save note', e instanceof Error ? e.message : 'Try again');
    } finally {
      setSavingNote(false);
    }
  };

  if (loading) {
    return (
      <ThemedView style={[styles.centered, { backgroundColor }]}>
        <ActivityIndicator size="large" color={tintColor} />
      </ThemedView>
    );
  }

  if (error || !dashboard) {
    return (
      <ThemedView style={[styles.centered, { backgroundColor }]}>
        <ThemedText>{error ?? 'No data'}</ThemedText>
        <TouchableOpacity onPress={load} style={[styles.retryBtn, { backgroundColor: tintColor }]}>
          <ThemedText style={styles.retryText}>Retry</ThemedText>
        </TouchableOpacity>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={[styles.container, { backgroundColor }]}>
      <ParentHeader
        parentName={`${dashboard.staffRole}: ${dashboard.teacherName}`}
        onProfilePress={async () => {
          await signOut();
          router.replace('/register');
        }}
      />

      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 32 }]}
        showsVerticalScrollIndicator={false}>
        <SectionTitle color={mutedTextColor}>CLASS OVERVIEW</SectionTitle>
        {dashboard.classes.map((cls) => (
          <TeacherClassOverviewCard key={cls.id} cls={cls} />
        ))}

        <SectionTitle color={mutedTextColor}>FILTER BY CLASS</SectionTitle>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipScroll}>
          <FilterChip
            label="All classes"
            selected={selectedClassId === 'all'}
            onPress={() => setSelectedClassId('all')}
            tint={tintColor}
            border={borderColor}
          />
          {dashboard.classes.map((c) => (
            <FilterChip
              key={c.id}
              label={c.name}
              selected={selectedClassId === c.id}
              onPress={() => setSelectedClassId(c.id)}
              tint={tintColor}
              border={borderColor}
            />
          ))}
        </ScrollView>

        <SectionTitle color={mutedTextColor}>STUDENTS</SectionTitle>
        {filteredStudents.length === 0 ? (
          <ThemedText style={{ color: mutedTextColor, marginBottom: 16 }}>
            No students in this class yet.
          </ThemedText>
        ) : (
          filteredStudents.map((s) => (
            <View key={s.id}>
              <TeacherStudentCard student={s} />
              <TouchableOpacity
                style={[styles.noteBtn, { borderColor }]}
                onPress={() => openNoteModal(s)}>
                <MaterialIcons name="edit-note" size={18} color={tintColor} />
                <ThemedText style={styles.noteBtnText}>Add teacher note</ThemedText>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.noteBtn, { borderColor }]}
                onPress={() => openInviteModal(s)}>
                <MaterialIcons name="family-restroom" size={18} color={tintColor} />
                <ThemedText style={styles.noteBtnText}>Invite parent</ThemedText>
              </TouchableOpacity>
            </View>
          ))
        )}

        <SectionTitle color={mutedTextColor}>ASSIGNMENTS & READING</SectionTitle>
        {dashboard.assignments.length === 0 ? (
          <ThemedText style={{ color: mutedTextColor }}>No active assignments tracked yet.</ThemedText>
        ) : (
          dashboard.assignments.map((a) => (
            <View key={a.id} style={[styles.rowCard, { backgroundColor: cardBgColor, borderColor }]}>
              <ThemedText style={styles.cardTitle}>{a.title}</ThemedText>
              <ThemedText style={[styles.cardMeta, { color: mutedTextColor }]}>
                {a.className} · {a.textbook}
              </ThemedText>
              <View style={styles.progressRow}>
                <ThemedText style={styles.progressText}>
                  Started {a.startedCount}/{a.totalStudents}
                </ThemedText>
                <ThemedText style={styles.progressText}>
                  Completed {a.completedCount}/{a.totalStudents}
                </ThemedText>
              </View>
            </View>
          ))
        )}

        <SectionTitle color={mutedTextColor}>INTERVENTION FLAGS</SectionTitle>
        {dashboard.interventions.length === 0 ? (
          <ThemedText style={{ color: mutedTextColor }}>No students flagged right now.</ThemedText>
        ) : (
          dashboard.interventions.map((flag) => (
            <View
              key={flag.id}
              style={[
                styles.flagCard,
                {
                  backgroundColor: cardBgColor,
                  borderColor:
                    flag.severity === 'high'
                      ? '#ff4444'
                      : flag.severity === 'medium'
                        ? '#d4a017'
                        : borderColor,
                },
              ]}>
              <ThemedText style={styles.flagTitle}>
                {flag.studentName} — {flag.flag}
              </ThemedText>
              <ThemedText style={[styles.flagReason, { color: mutedTextColor }]}>
                {flag.reason}
              </ThemedText>
            </View>
          ))
        )}

        <SectionTitle color={mutedTextColor}>WEEKLY PROGRESS TRENDS</SectionTitle>
        <View style={[styles.trendCard, { backgroundColor: cardBgColor, borderColor }]}>
          {dashboard.progressTrends.map((t) => (
            <View key={t.weekLabel} style={styles.trendRow}>
              <ThemedText style={styles.trendWeek}>{t.weekLabel}</ThemedText>
              <View style={styles.trendBars}>
                <TrendBar label="Score" value={t.classAvgScore} max={100} color={tintColor} />
                <TrendBar label="Study min" value={t.classAvgMinutes} max={200} color="#4a90d9" />
              </View>
            </View>
          ))}
        </View>

        <SectionTitle color={mutedTextColor}>TEACHER NOTES</SectionTitle>
        {dashboard.notes.length === 0 ? (
          <ThemedText style={{ color: mutedTextColor }}>
            No notes yet. Tap "Add teacher note" on a student card.
          </ThemedText>
        ) : (
          dashboard.notes.map((n) => (
            <View key={n.id} style={[styles.rowCard, { backgroundColor: cardBgColor, borderColor }]}>
              <ThemedText style={styles.cardTitle}>{n.studentName}</ThemedText>
              <ThemedText style={{ color: textColor }}>{n.note}</ThemedText>
              <ThemedText style={[styles.cardMeta, { color: mutedTextColor }]}>
                {n.sharedWithParent ? 'Shared with parent' : 'Private'} ·{' '}
                {new Date(n.createdAt).toLocaleDateString()}
              </ThemedText>
            </View>
          ))
        )}
      </ScrollView>

      <Modal visible={noteModalOpen} animationType="slide" transparent>
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalCard, { backgroundColor: cardBgColor }]}>
            <ThemedText type="subtitle">Note for {noteStudent?.name}</ThemedText>
            <TextInput
              style={[styles.noteInput, { color: textColor, borderColor }]}
              placeholder="e.g. Struggling with comprehension, improving in math reading"
              placeholderTextColor={mutedTextColor}
              value={noteText}
              onChangeText={setNoteText}
              multiline
              numberOfLines={4}
            />
            <View style={styles.shareRow}>
              <ThemedText style={{ flex: 1 }}>Share with parent</ThemedText>
              <Switch
                value={shareWithParent}
                onValueChange={setShareWithParent}
                trackColor={{ true: '#00FF41' }}
              />
            </View>
            <View style={styles.modalActions}>
              <TouchableOpacity onPress={() => setNoteModalOpen(false)}>
                <ThemedText>Cancel</ThemedText>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={saveNote}
                disabled={savingNote || !noteText.trim()}
                style={[styles.saveBtn, { backgroundColor: tintColor }]}>
                <ThemedText style={styles.saveBtnText}>
                  {savingNote ? 'Saving…' : 'Save note'}
                </ThemedText>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={inviteModalOpen} animationType="slide" transparent>
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalCard, { backgroundColor: cardBgColor }]}>
            <ThemedText type="subtitle">Invite parent for {inviteStudent?.name}</ThemedText>
            {inviteCode ? (
              <>
                <ThemedText style={{ marginTop: 8 }}>
                  Share this code with the parent (valid 7 days):
                </ThemedText>
                <ThemedText style={styles.inviteCode}>{inviteCode}</ThemedText>
                <ThemedText style={{ opacity: 0.7, fontSize: 13 }}>
                  Parent opens SmartShelf → Parent Access → enters this code.
                </ThemedText>
              </>
            ) : (
              <>
                <ThemedText style={styles.label}>Parent email (optional)</ThemedText>
                <TextInput
                  style={[styles.noteInput, { color: textColor, borderColor }]}
                  placeholder="parent@email.com"
                  placeholderTextColor={mutedTextColor}
                  value={inviteEmail}
                  onChangeText={setInviteEmail}
                  keyboardType="email-address"
                  autoCapitalize="none"
                />
                <TouchableOpacity
                  onPress={sendParentInvite}
                  disabled={inviteLoading}
                  style={[styles.saveBtn, { backgroundColor: tintColor }]}>
                  <ThemedText style={styles.saveBtnText}>
                    {inviteLoading ? 'Creating…' : 'Generate invite code'}
                  </ThemedText>
                </TouchableOpacity>
              </>
            )}
            <TouchableOpacity onPress={() => setInviteModalOpen(false)} style={{ marginTop: 12 }}>
              <ThemedText style={{ textAlign: 'center' }}>Close</ThemedText>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </ThemedView>
  );
}

function SectionTitle({ children, color }: { children: string; color: string }) {
  return (
    <ThemedText style={[styles.sectionTitle, { color, marginTop: 20, marginBottom: 10 }]}>
      {children}
    </ThemedText>
  );
}

function FilterChip({
  label,
  selected,
  onPress,
  tint,
  border,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
  tint: string;
  border: string;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      style={[
        styles.chip,
        {
          borderColor: selected ? tint : border,
          backgroundColor: selected ? 'rgba(0,255,65,0.12)' : 'transparent',
        },
      ]}>
      <ThemedText style={{ fontWeight: selected ? '700' : '400', fontSize: 13 }}>{label}</ThemedText>
    </TouchableOpacity>
  );
}

function TrendBar({ label, value, max, color }: { label: string; value: number; max: number; color: string }) {
  const pct = Math.min(100, Math.round((value / max) * 100));
  return (
    <View style={{ flex: 1, gap: 4 }}>
      <ThemedText style={styles.trendLabel}>
        {label}: {value}
      </ThemedText>
      <View style={styles.barTrack}>
        <View style={[styles.barFill, { width: `${pct}%`, backgroundColor: color }]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12 },
  scroll: { paddingHorizontal: 16, maxWidth: 640, alignSelf: 'center', width: '100%' },
  sectionTitle: { fontSize: 12, fontWeight: '600', letterSpacing: 1 },
  chipScroll: { marginBottom: 12 },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    marginRight: 8,
  },
  noteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: -4,
    marginBottom: 12,
    paddingVertical: 8,
    paddingHorizontal: 4,
    alignSelf: 'flex-start',
    borderBottomWidth: 1,
  },
  noteBtnText: { fontSize: 13, fontWeight: '600' },
  rowCard: { borderRadius: 12, borderWidth: 1, padding: 14, gap: 6, marginBottom: 10 },
  cardTitle: { fontSize: 15, fontWeight: '700' },
  cardMeta: { fontSize: 12 },
  progressRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 },
  progressText: { fontSize: 12, fontWeight: '600' },
  flagCard: { borderRadius: 12, borderWidth: 1, padding: 14, gap: 4, marginBottom: 10 },
  flagTitle: { fontWeight: '700', fontSize: 14 },
  flagReason: { fontSize: 13 },
  trendCard: { borderRadius: 12, borderWidth: 1, padding: 14, gap: 14, marginBottom: 8 },
  trendRow: { gap: 8 },
  trendWeek: { fontWeight: '700', fontSize: 13 },
  trendBars: { flexDirection: 'row', gap: 12 },
  trendLabel: { fontSize: 11, opacity: 0.8 },
  barTrack: { height: 8, backgroundColor: 'rgba(128,128,128,0.2)', borderRadius: 4, overflow: 'hidden' },
  barFill: { height: 8, borderRadius: 4 },
  retryBtn: { paddingHorizontal: 20, paddingVertical: 10, borderRadius: 8 },
  retryText: { fontWeight: '600', color: '#000' },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalCard: { padding: 20, borderTopLeftRadius: 16, borderTopRightRadius: 16, gap: 14 },
  noteInput: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    minHeight: 100,
    textAlignVertical: 'top',
  },
  shareRow: { flexDirection: 'row', alignItems: 'center' },
  modalActions: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  saveBtn: { paddingHorizontal: 20, paddingVertical: 10, borderRadius: 8 },
  saveBtnText: { fontWeight: '700', color: '#000' },
  inviteCode: {
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: 4,
    textAlign: 'center',
    marginVertical: 12,
  },
  label: { fontSize: 14, fontWeight: '600' },
});
