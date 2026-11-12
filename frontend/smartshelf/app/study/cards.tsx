import { useCallback, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';

import { ThemedText } from '@/components/themed-text';
import {
  createCard,
  deleteCard,
  fetchCards,
  reviewCard,
  type RevisionCard,
} from '@/src/api/study';
import { Button, Card, CenteredState, Field, Muted, Screen, useKitTheme } from '@/src/components/ui/kit';
import { prepareProtectedOpen } from '@/src/lib/protectedPdfAccess';
import { useRequireRole } from '@/src/hooks/useRequireRole';

export default function RevisionCardsScreen() {
  const allowed = useRequireRole(['student']);
  const router = useRouter();
  const t = useKitTheme();
  const params = useLocalSearchParams<{ assetId?: string; page?: string; title?: string }>();
  const [cards, setCards] = useState<RevisionCard[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [front, setFront] = useState('');
  const [back, setBack] = useState('');
  const [page, setPage] = useState(params.page ?? '1');
  const [revealed, setRevealed] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(() => {
    setError(null);
    fetchCards()
      .then(setCards)
      .catch((e) => setError(e instanceof Error ? e.message : 'Could not load cards.'));
  }, []);

  useFocusEffect(
    useCallback(() => {
      if (allowed) load();
    }, [allowed, load])
  );

  const save = async () => {
    if (!params.assetId) return;
    if (!front.trim() || !back.trim()) return;
    setSaving(true);
    try {
      await createCard({
        asset_id: params.assetId,
        page: Math.max(1, Number(page) || 1),
        front: front.trim(),
        back: back.trim(),
      });
      setFront('');
      setBack('');
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save the card.');
    } finally {
      setSaving(false);
    }
  };

  const mark = async (card: RevisionCard, knew: boolean) => {
    await reviewCard(card.id, knew);
    setRevealed(null);
    load();
  };

  return (
    <Screen title="Revision cards" subtitle="Passages and notes pinned to a textbook page">
      {params.assetId ? (
        <Card>
          <ThemedText style={styles.heading}>New card{params.title ? ` · ${params.title}` : ''}</ThemedText>
          <Field label="Page" value={page} onChangeText={setPage} keyboardType="number-pad" />
          <Field label="Passage or prompt" value={front} onChangeText={setFront} multiline placeholder="Text from the page" />
          <Field label="Your note" value={back} onChangeText={setBack} multiline placeholder="What you want to remember" />
          <Button label="Save card" onPress={() => void save()} loading={saving} />
        </Card>
      ) : null}

      {!allowed || (!cards && !error) ? (
        <CenteredState loading />
      ) : error ? (
        <CenteredState message={error} actionLabel="Retry" onAction={load} />
      ) : cards && cards.length === 0 ? (
        <CenteredState message="No cards yet. Save one after a chapter quiz, or from a book page." />
      ) : (
        cards?.map((card) => {
          const open = revealed === card.id;
          return (
            <Card key={card.id}>
              <Muted>
                {card.asset_title} · page {card.page}
                {card.due ? ' · due' : ''}
              </Muted>
              <ThemedText style={styles.heading}>{open ? card.back : card.front}</ThemedText>
              <View style={styles.row}>
                <Button label={open ? 'Hide note' : 'Show note'} variant="secondary" onPress={() => setRevealed(open ? null : card.id)} style={{ flex: 1 }} />
                <Button
                  label="Open page"
                  variant="secondary"
                  onPress={() => {
                    void prepareProtectedOpen(card.asset_id).then((opened) => {
                      if (!opened.ok) {
                        router.push('/school/resources');
                        return;
                      }
                      router.push({
                        pathname: '/igcse/pdf-reader',
                        params: {
                          localUri: opened.localUri,
                          bookId: card.asset_id,
                          title: card.asset_title,
                          page: String(card.page),
                        },
                      });
                    });
                  }}
                  style={{ flex: 1 }}
                />
              </View>
              {card.due ? (
                <View style={styles.row}>
                  <Button label="Again" variant="secondary" onPress={() => void mark(card, false)} style={{ flex: 1 }} />
                  <Button label="Knew it" onPress={() => void mark(card, true)} style={{ flex: 1 }} />
                </View>
              ) : null}
              <Button label="Delete" variant="secondary" onPress={() => void deleteCard(card.id).then(load)} />
            </Card>
          );
        })
      )}
      <Muted style={{ color: t.muted }}>
        Cards stay on your account, so the same set is there on a phone and on a computer.
      </Muted>
    </Screen>
  );
}

const styles = StyleSheet.create({
  heading: { fontSize: 16, fontWeight: '700' },
  row: { flexDirection: 'row', gap: 8 },
});
