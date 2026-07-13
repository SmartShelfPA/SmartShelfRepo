import { useState } from 'react';
import {
  Modal,
  StyleSheet,
  TouchableOpacity,
  View,
  FlatList,
} from 'react-native';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { ThemedText } from '@/components/themed-text';
import { ThemedTextInput } from '@/components/themed-text-input';
import { useCollectionsStore } from '@/src/store/collections';

type Props = {
  visible: boolean;
  onClose: () => void;
  bookIds: string[];
  title?: string;
  cardBg: string;
  tagBg: string;
  textColor: string;
  mutedColor: string;
  tintColor: string;
};

export function CollectionPickerModal({
  visible,
  onClose,
  bookIds,
  title = 'Add to collection',
  cardBg,
  tagBg,
  textColor,
  mutedColor,
  tintColor,
}: Props) {
  const collections = useCollectionsStore((s) => s.collections);
  const createCollection = useCollectionsStore((s) => s.createCollection);
  const addBooksToCollection = useCollectionsStore((s) => s.addBooksToCollection);

  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');

  const handleSelect = (collectionId: string) => {
    addBooksToCollection(collectionId, bookIds);
    onClose();
  };

  const handleCreate = () => {
    const name = newName.trim();
    if (!name) return;
    const created = createCollection(name);
    addBooksToCollection(created.id, bookIds);
    setNewName('');
    setCreating(false);
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={[styles.card, { backgroundColor: cardBg, borderColor: tagBg }]}>
          <View style={styles.header}>
            <ThemedText style={[styles.title, { color: textColor }]}>{title}</ThemedText>
            <TouchableOpacity onPress={onClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <MaterialIcons name="close" size={22} color={mutedColor} />
            </TouchableOpacity>
          </View>

          {creating ? (
            <View style={styles.createBlock}>
              <ThemedTextInput
                placeholder="Collection name"
                value={newName}
                onChangeText={setNewName}
                autoFocus
              />
              <View style={styles.createActions}>
                <TouchableOpacity
                  style={[styles.btn, { borderColor: tagBg }]}
                  onPress={() => setCreating(false)}>
                  <ThemedText style={{ color: mutedColor }}>Cancel</ThemedText>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.btn, { backgroundColor: tintColor }]}
                  onPress={handleCreate}>
                  <ThemedText style={{ color: '#000', fontWeight: '600' }}>Create</ThemedText>
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <>
              <TouchableOpacity
                style={[styles.newRow, { borderColor: tagBg }]}
                onPress={() => setCreating(true)}>
                <MaterialIcons name="add" size={20} color={tintColor} />
                <ThemedText style={{ color: tintColor, fontWeight: '600' }}>
                  New collection
                </ThemedText>
              </TouchableOpacity>

              {collections.length === 0 ? (
                <ThemedText style={[styles.empty, { color: mutedColor }]}>
                  Create a collection to save this book.
                </ThemedText>
              ) : (
                <FlatList
                  data={collections}
                  keyExtractor={(c) => c.id}
                  style={styles.list}
                  renderItem={({ item }) => (
                    <TouchableOpacity
                      style={[styles.row, { borderColor: tagBg }]}
                      onPress={() => handleSelect(item.id)}>
                      <MaterialIcons name="collections-bookmark" size={20} color={tintColor} />
                      <View style={styles.rowText}>
                        <ThemedText style={{ color: textColor, fontWeight: '600' }}>
                          {item.name}
                        </ThemedText>
                        <ThemedText style={{ color: mutedColor, fontSize: 12 }}>
                          {item.bookIds.length} book{item.bookIds.length === 1 ? '' : 's'}
                        </ThemedText>
                      </View>
                    </TouchableOpacity>
                  )}
                />
              )}
            </>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    padding: 20,
  },
  card: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    maxHeight: '70%',
    gap: 12,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  title: { fontSize: 17, fontWeight: '700' },
  newRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  list: { maxHeight: 280 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  rowText: { flex: 1, gap: 2 },
  empty: { fontSize: 13, textAlign: 'center', paddingVertical: 16 },
  createBlock: { gap: 12 },
  createActions: { flexDirection: 'row', gap: 10 },
  btn: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
  },
});
