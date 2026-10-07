import { useCallback, useState } from 'react';
import { Alert, Platform, StyleSheet, Switch, TouchableOpacity, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import * as DocumentPicker from 'expo-document-picker';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';

import { ThemedText } from '@/components/themed-text';
import { fetchRoster } from '@/src/api/assignments';
import {
  deleteSchoolResource,
  fetchSchoolResources,
  uploadSchoolResource,
  type PickedPdf,
  type SchoolResource,
} from '@/src/api/school';
import { ProtectedResourceItem } from '@/src/components/igcse/ProtectedResourceItem';
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

const MAX_MB = 40;

function notify(title: string, message: string) {
  if (Platform.OS === 'web') window.alert(`${title}\n\n${message}`);
  else Alert.alert(title, message);
}

export default function SchoolResourcesScreen() {
  const allowed = useRequireRole(['student', 'staff']);
  const t = useKitTheme();
  const user = useAuthStore((s) => s.user);
  const isStaff = user?.role === 'staff';

  const [items, setItems] = useState<SchoolResource[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [classes, setClasses] = useState<string[]>([]);

  const [showForm, setShowForm] = useState(false);
  const [file, setFile] = useState<PickedPdf | null>(null);
  const [title, setTitle] = useState('');
  const [subject, setSubject] = useState('');
  const [description, setDescription] = useState('');
  const [audience, setAudience] = useState<string[]>([]);
  const [rightsOk, setRightsOk] = useState(false);
  const [uploading, setUploading] = useState(false);

  const load = useCallback(() => {
    setError(null);
    fetchSchoolResources()
      .then(setItems)
      .catch((e) => setError(e instanceof Error ? e.message : 'Could not load resources.'));
    if (isStaff) {
      fetchRoster()
        .then((r) => setClasses(r.map((c) => c.name).filter((n) => n !== 'Unassigned')))
        .catch(() => setClasses([]));
    }
  }, [isStaff]);

  useFocusEffect(
    useCallback(() => {
      if (allowed) load();
    }, [allowed, load])
  );

  const pickFile = async () => {
    const result = await DocumentPicker.getDocumentAsync({
      type: 'application/pdf',
      copyToCacheDirectory: true,
      multiple: false,
    });
    if (result.canceled || !result.assets?.[0]) return;
    const asset = result.assets[0];
    if (asset.size && asset.size > MAX_MB * 1024 * 1024) {
      notify('File too large', `PDFs must be ${MAX_MB} MB or smaller.`);
      return;
    }
    setFile({
      uri: asset.uri,
      name: asset.name,
      mimeType: asset.mimeType,
      size: asset.size,
      file: (asset as { file?: File }).file ?? null,
    });
    if (!title.trim()) setTitle(asset.name.replace(/\.pdf$/i, ''));
  };

  const resetForm = () => {
    setFile(null);
    setTitle('');
    setSubject('');
    setDescription('');
    setAudience([]);
    setRightsOk(false);
    setShowForm(false);
  };

  const upload = async () => {
    if (!file) return notify('Choose a PDF', 'Pick the PDF you want to share.');
    if (!title.trim()) return notify('Add a title', 'Give the resource a title students will recognise.');
    if (!rightsOk) {
      return notify('Confirm rights', 'Confirm your school owns or is licensed to share this material.');
    }
    setUploading(true);
    try {
      const created = await uploadSchoolResource({
        file,
        title: title.trim(),
        subject: subject.trim(),
        description: description.trim(),
        audienceClasses: audience,
      });
      setItems((prev) => [created, ...(prev ?? [])]);
      resetForm();
    } catch (e) {
      notify('Upload failed', e instanceof Error ? e.message : 'Try again.');
    } finally {
      setUploading(false);
    }
  };

  const remove = async (r: SchoolResource) => {
    const go = async () => {
      try {
        await deleteSchoolResource(r.id);
        setItems((prev) => (prev ?? []).filter((x) => x.id !== r.id));
      } catch (e) {
        notify('Could not delete', e instanceof Error ? e.message : 'Try again.');
      }
    };
    if (Platform.OS === 'web') {
      if (window.confirm(`Delete "${r.title}"? Students will lose access.`)) await go();
      return;
    }
    Alert.alert('Delete resource?', `"${r.title}" will be removed for everyone.`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => void go() },
    ]);
  };

  return (
    <Screen
      title="School resources"
      subtitle={isStaff ? 'PDFs only your school can see' : 'Shared by your teachers'}>
      {isStaff ? (
        showForm ? (
          <Card>
            <ThemedText style={styles.title}>Upload a PDF</ThemedText>
            <Button
              label={file ? file.name : 'Choose PDF'}
              icon="attach-file"
              variant="secondary"
              onPress={pickFile}
            />
            <Field label="Title" value={title} onChangeText={setTitle} placeholder="e.g. SS2 Chemistry notes, term 1" />
            <Field label="Subject (optional)" value={subject} onChangeText={setSubject} placeholder="e.g. Chemistry" />
            <Field
              label="Description (optional)"
              value={description}
              onChangeText={setDescription}
              multiline
            />
            <ThemedText style={styles.label}>Who can see it?</ThemedText>
            <View style={styles.wrap}>
              <Chip label="Whole school" selected={audience.length === 0} onPress={() => setAudience([])} />
              {classes.map((c) => (
                <Chip
                  key={c}
                  label={c}
                  selected={audience.includes(c)}
                  onPress={() =>
                    setAudience((prev) => (prev.includes(c) ? prev.filter((x) => x !== c) : [...prev, c]))
                  }
                />
              ))}
            </View>
            <Muted style={{ fontSize: 12 }}>
              Teachers always see every school resource. Students only see resources for their class.
            </Muted>
            <View style={styles.switchRow}>
              <Switch value={rightsOk} onValueChange={setRightsOk} trackColor={{ true: t.accent }} />
              <ThemedText style={{ flex: 1, fontSize: 13 }}>
                My school owns this material or is licensed to share it with students.
              </ThemedText>
            </View>
            <View style={styles.wrap}>
              <Button label="Upload" icon="cloud-upload" onPress={upload} loading={uploading} style={{ flex: 1, marginRight: 8 }} />
              <Button label="Cancel" variant="secondary" onPress={resetForm} style={{ flex: 1 }} />
            </View>
          </Card>
        ) : (
          <Button label="Upload a PDF" icon="cloud-upload" onPress={() => setShowForm(true)} />
        )
      ) : null}

      {!allowed || (!items && !error) ? (
        <CenteredState loading />
      ) : error ? (
        <CenteredState message={error} actionLabel="Retry" onAction={load} />
      ) : items && items.length === 0 ? (
        <CenteredState
          message={
            isStaff
              ? 'No school resources yet. Upload notes, worksheets or past papers for your students.'
              : 'Your teachers have not shared any resources with your class yet.'
          }
        />
      ) : (
        <>
          <SectionLabel>{items?.length} RESOURCE{items?.length === 1 ? '' : 'S'}</SectionLabel>
          {items?.map((r) => (
            <View key={r.id} style={styles.item}>
              <ProtectedResourceItem asset={r} />
              <View style={styles.meta}>
                <Muted style={{ fontSize: 12, flex: 1 }}>
                  {r.audience_classes.length ? r.audience_classes.join(', ') : 'Whole school'}
                  {r.uploaded_by_name ? ` · by ${r.uploaded_by_name}` : ''}
                </Muted>
                {isStaff && (user?.is_school_admin || r.uploaded_by_id === user?.id) ? (
                  <TouchableOpacity onPress={() => void remove(r)} accessibilityLabel={`Delete ${r.title}`}>
                    <MaterialIcons name="delete-outline" size={20} color={t.danger} />
                  </TouchableOpacity>
                ) : null}
              </View>
            </View>
          ))}
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 16, fontWeight: '700' },
  label: { fontSize: 14, fontWeight: '600' },
  wrap: { flexDirection: 'row', flexWrap: 'wrap' },
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  item: { gap: 4 },
  meta: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 4, gap: 8 },
});
