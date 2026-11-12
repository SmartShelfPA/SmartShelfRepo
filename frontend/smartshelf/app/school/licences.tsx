import { useCallback, useState } from 'react';
import { Alert, Platform, StyleSheet, View } from 'react-native';
import { useFocusEffect } from 'expo-router';

import { ThemedText } from '@/components/themed-text';
import { fetchSchoolResources, type SchoolResource } from '@/src/api/school';
import { createLicence, deleteLicence, fetchLicences, type TextbookLicence } from '@/src/api/study';
import { Button, Card, CenteredState, Chip, Field, Muted, Screen } from '@/src/components/ui/kit';
import { useRequireRole } from '@/src/hooks/useRequireRole';

function notify(message: string) {
  if (Platform.OS === 'web') window.alert(message);
  else Alert.alert('Textbook licence', message);
}

export default function LicencesScreen() {
  const allowed = useRequireRole(['staff']);
  const [books, setBooks] = useState<SchoolResource[]>([]);
  const [rows, setRows] = useState<TextbookLicence[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [assetId, setAssetId] = useState<string | null>(null);
  const [targetClass, setTargetClass] = useState('');
  const [term, setTerm] = useState('');
  const [starts, setStarts] = useState('');
  const [ends, setEnds] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(() => {
    setError(null);
    Promise.all([fetchLicences(), fetchSchoolResources()])
      .then(([licences, resources]) => {
        setRows(licences);
        setBooks(resources);
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'Could not load licences.'));
  }, []);

  useFocusEffect(
    useCallback(() => {
      if (allowed) load();
    }, [allowed, load])
  );

  const save = async () => {
    if (!assetId || !term.trim() || !starts.trim() || !ends.trim()) {
      return notify('Choose a book, a term name, and start and end dates (YYYY-MM-DD).');
    }
    setSaving(true);
    try {
      await createLicence({
        asset_id: assetId,
        target_class: targetClass.trim(),
        term_label: term.trim(),
        starts_on: starts.trim(),
        ends_on: ends.trim(),
      });
      setTerm('');
      load();
    } catch (e) {
      notify(e instanceof Error ? e.message : 'Could not save.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Screen title="Term licences" subtitle="Which class can open a book, and until when">
      <Card>
        <ThemedText style={styles.heading}>Allocate access</ThemedText>
        <Muted>Leave the class blank to cover every class that can already see the book. Once a licence exists, students only see the book inside its dates.</Muted>
        <View style={styles.wrap}>
          {books.map((book) => (
            <Chip key={book.id} label={book.title} selected={assetId === book.id} onPress={() => setAssetId(book.id)} />
          ))}
        </View>
        <Field label="Class (optional)" value={targetClass} onChangeText={setTargetClass} placeholder="e.g. SS2A" />
        <Field label="Term" value={term} onChangeText={setTerm} placeholder="e.g. 2026/27 Term 1" />
        <Field label="Starts" value={starts} onChangeText={setStarts} placeholder="YYYY-MM-DD" />
        <Field label="Ends" value={ends} onChangeText={setEnds} placeholder="YYYY-MM-DD" />
        <Button label="Save licence" onPress={() => void save()} loading={saving} />
      </Card>

      {!allowed || (!rows && !error) ? (
        <CenteredState loading />
      ) : error ? (
        <CenteredState message={error} actionLabel="Retry" onAction={load} />
      ) : rows && rows.length === 0 ? (
        <CenteredState message="No term licences yet. Books stay available to their class until you add one." />
      ) : (
        rows?.map((row) => (
          <Card key={row.id}>
            <ThemedText style={styles.heading}>{row.title}</ThemedText>
            <Muted>
              {row.term_label} · {row.target_class || 'All classes'} · {row.starts_on} to {row.ends_on}
            </Muted>
            <Button label="Remove" variant="danger" onPress={() => void deleteLicence(row.id).then(load)} />
          </Card>
        ))
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  heading: { fontSize: 16, fontWeight: '700' },
  wrap: { flexDirection: 'row', flexWrap: 'wrap' },
});
