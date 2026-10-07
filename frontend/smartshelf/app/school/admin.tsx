import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Platform, StyleSheet, Switch, TouchableOpacity, View } from 'react-native';
import { useRouter } from 'expo-router';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';

import { ThemedText } from '@/components/themed-text';
import {
  createMember,
  fetchMembers,
  fetchSchool,
  resetMemberPassword,
  updateJoinCode,
  updateMember,
  type SchoolMember,
  type SchoolOverview,
} from '@/src/api/school';
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
import { useAuthStore } from '@/src/store/auth';
import { formatLastActive } from '@/src/lib/dates';

type RoleFilter = 'student' | 'staff' | 'parent';
type Credential = { name: string; username: string; password: string };

function notify(title: string, message: string) {
  if (Platform.OS === 'web') window.alert(`${title}\n\n${message}`);
  else Alert.alert(title, message);
}

function askConfirm(title: string, message: string, action: string): Promise<boolean> {
  if (Platform.OS === 'web') return Promise.resolve(window.confirm(`${title}\n\n${message}`));
  return new Promise((resolve) =>
    Alert.alert(title, message, [
      { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
      { text: action, onPress: () => resolve(true) },
    ])
  );
}

export default function SchoolAdminScreen() {
  const allowed = useRequireRole(['staff']);
  const router = useRouter();
  const t = useKitTheme();
  const user = useAuthStore((s) => s.user);

  const [school, setSchool] = useState<SchoolOverview | null>(null);
  const [members, setMembers] = useState<SchoolMember[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<RoleFilter>('student');
  const [codeDraft, setCodeDraft] = useState('');
  const [savingCode, setSavingCode] = useState(false);
  const [credential, setCredential] = useState<Credential | null>(null);

  const [formOpen, setFormOpen] = useState(false);
  const [newRole, setNewRole] = useState<'student' | 'staff'>('student');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [studentClass, setStudentClass] = useState('');
  const [makeAdmin, setMakeAdmin] = useState(false);
  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    try {
      const s = await fetchSchool();
      setSchool(s);
      setCodeDraft(s.join_code ?? '');
      if (s.is_school_admin) setMembers(await fetchMembers());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load your school.');
    }
  }, []);

  useEffect(() => {
    if (allowed) void load();
  }, [allowed, load]);

  const filtered = useMemo(() => members.filter((m) => m.role === filter), [members, filter]);
  const classNames = useMemo(
    () => Array.from(new Set(members.map((m) => m.student_class).filter(Boolean))).sort(),
    [members]
  );

  const saveCode = async (payload: { join_code: string } | { regenerate_join_code: true }) => {
    setSavingCode(true);
    try {
      const res = await updateJoinCode(payload);
      setCodeDraft(res.join_code);
      setSchool((prev) => (prev ? { ...prev, join_code: res.join_code, requires_join_code: res.requires_join_code } : prev));
    } catch (e) {
      notify('Could not save', e instanceof Error ? e.message : 'Try again.');
    } finally {
      setSavingCode(false);
    }
  };

  const create = async () => {
    if (!fullName.trim() || !email.trim()) return notify('Missing details', 'Enter a full name and email.');
    if (newRole === 'student' && !studentClass.trim()) return notify('Missing class', 'Enter the class, e.g. SS2A.');
    setCreating(true);
    try {
      const created = await createMember({
        role: newRole,
        full_name: fullName.trim(),
        email: email.trim(),
        student_class: newRole === 'student' ? studentClass.trim() : undefined,
        is_school_admin: newRole === 'staff' ? makeAdmin : undefined,
      });
      setMembers((prev) => [...prev, created]);
      setCredential({ name: created.full_name, username: created.username, password: created.temporary_password });
      setFullName('');
      setEmail('');
      setMakeAdmin(false);
      setFormOpen(false);
      setFilter(newRole);
    } catch (e) {
      notify('Could not create account', e instanceof Error ? e.message : 'Try again.');
    } finally {
      setCreating(false);
    }
  };

  const resetPassword = async (m: SchoolMember) => {
    const ok = await askConfirm(
      'Reset password?',
      `${m.full_name || m.username} will be signed out everywhere and need the new temporary password.`,
      'Reset'
    );
    if (!ok) return;
    try {
      const res = await resetMemberPassword(m.id);
      setCredential({ name: m.full_name || m.username, username: res.username, password: res.temporary_password });
    } catch (e) {
      notify('Could not reset', e instanceof Error ? e.message : 'Try again.');
    }
  };

  const toggleActive = async (m: SchoolMember) => {
    const ok = await askConfirm(
      m.is_active ? 'Deactivate account?' : 'Reactivate account?',
      m.is_active ? `${m.full_name || m.username} will no longer be able to sign in.` : 'They will be able to sign in again.',
      m.is_active ? 'Deactivate' : 'Reactivate'
    );
    if (!ok) return;
    try {
      const updated = await updateMember(m.id, { is_active: !m.is_active });
      setMembers((prev) => prev.map((x) => (x.id === m.id ? updated : x)));
    } catch (e) {
      notify('Could not update', e instanceof Error ? e.message : 'Try again.');
    }
  };

  if (!allowed || (!school && !error)) {
    return (
      <Screen title="School admin">
        <CenteredState loading />
      </Screen>
    );
  }
  if (error || !school) {
    return (
      <Screen title="School admin">
        <CenteredState message={error ?? 'Not found'} actionLabel="Retry" onAction={() => void load()} />
      </Screen>
    );
  }
  if (!school.is_school_admin) {
    return (
      <Screen title="School admin">
        <CenteredState
          message="Only school administrators can manage accounts. Ask your school's SmartShelf admin for access."
          actionLabel="Back"
          onAction={() => router.back()}
        />
      </Screen>
    );
  }

  return (
    <Screen title={school.name} subtitle="School admin">
      <View style={styles.stats}>
        {(
          [
            ['Students', school.counts.students],
            ['Teachers', school.counts.teachers],
            ['Parents', school.counts.parents],
            ['Resources', school.counts.resources],
          ] as const
        ).map(([label, value]) => (
          <Card key={label} style={styles.stat}>
            <ThemedText style={styles.statValue}>{value}</ThemedText>
            <Muted style={{ fontSize: 12 }}>{label}</Muted>
          </Card>
        ))}
      </View>

      {credential ? (
        <Card style={{ borderColor: t.accent }}>
          <ThemedText style={styles.title}>Sign-in details for {credential.name}</ThemedText>
          <ThemedText selectable>Username: {credential.username}</ThemedText>
          <ThemedText selectable style={styles.mono}>
            Temporary password: {credential.password}
          </ThemedText>
          <Muted style={{ fontSize: 12 }}>
            Share these privately. This password is shown only once; they can change it from Forgot password.
          </Muted>
          <Button label="Done" variant="secondary" onPress={() => setCredential(null)} />
        </Card>
      ) : null}

      <SectionLabel>SCHOOL CODE</SectionLabel>
      <Card>
        <Muted>
          Students who sign up themselves must enter this code to join {school.name}. Leave it empty to let anyone pick
          the school.
        </Muted>
        <Field
          value={codeDraft}
          onChangeText={(v) => setCodeDraft(v.toUpperCase().replace(/[^A-Z0-9]/g, ''))}
          placeholder="No code set"
          autoCapitalize="characters"
        />
        <View style={styles.row}>
          <Button
            label="Save"
            onPress={() => void saveCode({ join_code: codeDraft })}
            loading={savingCode}
            disabled={codeDraft === (school.join_code ?? '')}
            style={{ flex: 1 }}
          />
          <Button
            label="New code"
            icon="autorenew"
            variant="secondary"
            onPress={() => void saveCode({ regenerate_join_code: true })}
            style={{ flex: 1 }}
          />
        </View>
      </Card>

      <SectionLabel>ACCOUNTS</SectionLabel>
      {formOpen ? (
        <Card>
          <ThemedText style={styles.title}>Add an account</ThemedText>
          <View style={styles.wrap}>
            <Chip label="Student" selected={newRole === 'student'} onPress={() => setNewRole('student')} />
            <Chip label="Teacher" selected={newRole === 'staff'} onPress={() => setNewRole('staff')} />
          </View>
          <Field label="Full name" value={fullName} onChangeText={setFullName} />
          <Field
            label="Email"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
          />
          {newRole === 'student' ? (
            <>
              <Field label="Class" value={studentClass} onChangeText={setStudentClass} placeholder="e.g. SS2A" />
              {classNames.length ? (
                <View style={styles.wrap}>
                  {classNames.map((c) => (
                    <Chip key={c} label={c} selected={studentClass === c} onPress={() => setStudentClass(c)} />
                  ))}
                </View>
              ) : null}
            </>
          ) : (
            <View style={styles.row}>
              <Switch value={makeAdmin} onValueChange={setMakeAdmin} trackColor={{ true: t.accent }} />
              <ThemedText style={{ flex: 1 }}>Also a school admin</ThemedText>
            </View>
          )}
          <Muted style={{ fontSize: 12 }}>
            Parents join with an invite code from their child&apos;s teacher, so they are not added here.
          </Muted>
          <View style={styles.row}>
            <Button label="Create" onPress={create} loading={creating} style={{ flex: 1 }} />
            <Button label="Cancel" variant="secondary" onPress={() => setFormOpen(false)} style={{ flex: 1 }} />
          </View>
        </Card>
      ) : (
        <Button label="Add student or teacher" icon="person-add" onPress={() => setFormOpen(true)} />
      )}

      <View style={styles.wrap}>
        {(
          [
            ['student', 'Students'],
            ['staff', 'Teachers'],
            ['parent', 'Parents'],
          ] as const
        ).map(([role, label]) => (
          <Chip
            key={role}
            label={`${label} · ${members.filter((m) => m.role === role).length}`}
            selected={filter === role}
            onPress={() => setFilter(role)}
          />
        ))}
      </View>

      {filtered.length === 0 ? (
        <Muted>No accounts here yet.</Muted>
      ) : (
        filtered.map((m) => (
          <Card key={m.id} style={!m.is_active ? { opacity: 0.55 } : undefined}>
            <View style={styles.row}>
              <View style={{ flex: 1 }}>
                <ThemedText style={styles.name}>
                  {m.full_name || m.username}
                  {m.is_school_admin ? '  · admin' : ''}
                  {!m.is_active ? '  · inactive' : ''}
                </ThemedText>
                <Muted style={{ fontSize: 13 }}>
                  @{m.username}
                  {m.student_class ? ` · ${m.student_class}` : ''}
                  {m.staff_role ? ` · ${m.staff_role}` : ''}
                </Muted>
                {m.linked_children.length ? (
                  <Muted style={{ fontSize: 13 }}>Parent of {m.linked_children.map((c) => c.name).join(', ')}</Muted>
                ) : null}
                <Muted style={{ fontSize: 12 }}>Last sign-in: {formatLastActive(m.last_login)}</Muted>
              </View>
              {m.id !== user?.id ? (
                <View style={styles.actions}>
                  <TouchableOpacity onPress={() => void resetPassword(m)} accessibilityLabel="Reset password">
                    <MaterialIcons name="lock-reset" size={22} color={t.tint} />
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => void toggleActive(m)}
                    accessibilityLabel={m.is_active ? 'Deactivate' : 'Reactivate'}>
                    <MaterialIcons
                      name={m.is_active ? 'person-off' : 'person'}
                      size={22}
                      color={m.is_active ? t.danger : t.tint}
                    />
                  </TouchableOpacity>
                </View>
              ) : null}
            </View>
          </Card>
        ))
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  stats: { flexDirection: 'row', gap: 8 },
  stat: { flex: 1, alignItems: 'center', padding: 10, gap: 2 },
  statValue: { fontSize: 20, fontWeight: '800' },
  title: { fontSize: 16, fontWeight: '700' },
  name: { fontSize: 15, fontWeight: '700' },
  mono: { fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace', default: 'monospace' }), fontWeight: '700' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  wrap: { flexDirection: 'row', flexWrap: 'wrap' },
  actions: { flexDirection: 'row', gap: 14 },
});
