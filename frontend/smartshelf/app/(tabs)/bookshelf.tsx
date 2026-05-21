import { useEffect, useMemo, useState } from 'react';
import {
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  FlatList,
  View,
  Alert,
  Modal,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { ThemedTextInput } from '@/components/themed-text-input';
import { useThemeColor } from '@/hooks/use-theme-color';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { Book, getBooks, setBooks } from '@/src/store/books';
import { EXAM_SUBJECTS } from '@/constants/examSubjects';

export default function BookshelfScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const boardParam = Array.isArray(params.board)
    ? params.board[0]
    : typeof params.board === 'string'
    ? params.board
    : undefined;
  const sectionParam = Array.isArray(params.section)
    ? params.section[0]
    : typeof params.section === 'string'
    ? params.section
    : undefined;
  const subjectParam = Array.isArray(params.subject)
    ? params.subject[0]
    : typeof params.subject === 'string'
    ? params.subject
    : undefined;
  const [activeSection, setActiveSection] = useState<'Textbooks' | 'Collection'>(
    sectionParam === 'Collection' ? 'Collection' : 'Textbooks'
  );
  const [collections, setCollections] = useState<
    { id: string; name: string; bookIds: string[] }[]
  >([]);
  const [activeCollectionId, setActiveCollectionId] = useState<string | null>(null);
  const [isSelecting, setIsSelecting] = useState(false);
  const [selectedBookIds, setSelectedBookIds] = useState<string[]>([]);
  const [showCollectionModal, setShowCollectionModal] = useState(false);
  const [collectionModalMode, setCollectionModalMode] = useState<'create' | 'rename'>('create');
  const [collectionNameInput, setCollectionNameInput] = useState('');
  const [collectionTargetId, setCollectionTargetId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [books, setBooksState] = useState<Book[]>([]);

  const insets = useSafeAreaInsets();
  const colorScheme = useColorScheme();
  const textColor = useThemeColor({}, 'text');
  const backgroundColor = useThemeColor({}, 'background');
  const cardBgColor = colorScheme === 'dark' ? '#1F1F1F' : '#FFFFFF';
  const mutedTextColor = colorScheme === 'dark' ? '#9BA1A6' : '#687076';
  const tintColor = colorScheme === 'dark' ? '#fff' : '#00FF41'; // UFO Green
  const tagBgColor = colorScheme === 'dark' ? '#2A2A2A' : '#E5E5E5';
  const normalizedBoardTags = useMemo(() => {
    if (!boardParam) return [];
    const normalized = boardParam.toUpperCase();
    if (normalized === 'WAEC/JAMB') {
      return ['WAEC', 'JAMB'];
    }
    return [normalized];
  }, [boardParam]);

  useEffect(() => {
    const existingBooks = getBooks();
    setBooksState(existingBooks);
    setBooks(existingBooks);
  }, []);

  useEffect(() => {
    if (sectionParam === 'Collection') {
      setActiveSection('Collection');
    } else if (sectionParam === 'Textbooks') {
      setActiveSection('Textbooks');
    }
  }, [sectionParam]);

  const filteredBooks = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return books.filter((book) => {
      const matchesBoard = boardParam
        ? book.examTags
            .map((tag) => tag.toString().toUpperCase())
            .some((tag) => normalizedBoardTags.includes(tag))
        : true;
      const matchesSubject = subjectParam ? book.subject === subjectParam : true;
      const matchesQuery = query
        ? book.title.toLowerCase().includes(query) ||
          book.subject.toLowerCase().includes(query)
        : true;
      return matchesBoard && matchesSubject && matchesQuery && !book.pdfUri && book.subject !== 'Uploaded';
    });
  }, [books, searchQuery, boardParam, subjectParam, normalizedBoardTags]);

  const collectionBooks = useMemo(() => {
    return books.filter((book) => {
      const isCollection = book.pdfUri || book.subject === 'Uploaded';
      return isCollection;
    });
  }, [books]);

  const collectionViewBooks = useMemo(() => {
    if (!activeCollectionId) {
      return [];
    }
    const target = collections.find((c) => c.id === activeCollectionId);
    if (!target) {
      return [];
    }
    return books.filter((book) => target.bookIds.includes(book.id));
  }, [books, collections, activeCollectionId]);

  const subjectConfig = boardParam ? EXAM_SUBJECTS[boardParam.toUpperCase()] : null;
  const showSubjectList = activeSection === 'Textbooks' && boardParam && !subjectParam;

  const getBookCountForSubject = (subjectKey: string) =>
    books.filter(
      (b) =>
        !b.pdfUri &&
        b.subject !== 'Uploaded' &&
        b.subject === subjectKey &&
        b.examTags
          .map((t) => t.toString().toUpperCase())
          .some((tag) => normalizedBoardTags.includes(tag))
    ).length;

  const toggleSelectBook = (bookId: string) => {
    setSelectedBookIds((prev) =>
      prev.includes(bookId) ? prev.filter((id) => id !== bookId) : [...prev, bookId]
    );
  };

  const resetSelection = () => {
    setIsSelecting(false);
    setSelectedBookIds([]);
  };

  const openCreateCollection = () => {
    setCollectionModalMode('create');
    setCollectionNameInput('');
    setCollectionTargetId(null);
    setShowCollectionModal(true);
  };

  const openRenameCollection = (collectionId: string, currentName: string) => {
    setCollectionModalMode('rename');
    setCollectionNameInput(currentName);
    setCollectionTargetId(collectionId);
    setShowCollectionModal(true);
  };

  const saveCollection = () => {
    const name = collectionNameInput.trim();
    if (!name) {
      return;
    }
    if (collectionModalMode === 'create') {
      setCollections((prev) => [
        ...prev,
        { id: `collection-${Date.now()}`, name, bookIds: [] },
      ]);
    } else if (collectionModalMode === 'rename' && collectionTargetId) {
      setCollections((prev) =>
        prev.map((c) => (c.id === collectionTargetId ? { ...c, name } : c))
      );
    }
    setShowCollectionModal(false);
  };

  const deleteCollection = (collectionId: string) => {
    setCollections((prev) => prev.filter((c) => c.id !== collectionId));
    if (activeCollectionId === collectionId) {
      setActiveCollectionId(null);
    }
  };

  const assignToCollection = (collectionId: string) => {
    if (selectedBookIds.length === 0) {
      return;
    }
    setCollections((prev) =>
      prev.map((collection) =>
        collection.id === collectionId
          ? {
              ...collection,
              bookIds: Array.from(new Set([...collection.bookIds, ...selectedBookIds])),
            }
          : collection
      )
    );
    resetSelection();
  };

  const renderBook = ({ item }: { item: Book }) => (
    <TouchableOpacity
      style={[
        styles.bookCard,
        {
          backgroundColor: cardBgColor,
          shadowColor: colorScheme === 'dark' ? '#000' : '#000',
        },
        isSelecting && selectedBookIds.includes(item.id) && styles.bookCardSelected,
      ]}
      onPress={() =>
        isSelecting
          ? toggleSelectBook(item.id)
          : router.push({ pathname: '/book/[id]', params: { id: item.id } })
      }
      onLongPress={() => {
        if (!isSelecting) {
          setIsSelecting(true);
        }
        toggleSelectBook(item.id);
      }}
      activeOpacity={0.8}>
      <View style={[styles.bookIcon, { backgroundColor: tagBgColor }]}>
        <MaterialIcons name="menu-book" size={28} color={tintColor} />
      </View>
      <ThemedText style={[styles.bookTitle, { color: textColor }]} numberOfLines={2}>
        {item.title}
      </ThemedText>
      <ThemedText style={[styles.bookMeta, { color: mutedTextColor }]}>
        {item.subject}
      </ThemedText>
      {item.examTags.length > 0 && (
        <View style={styles.tagRow}>
          {item.examTags.map((tag, index) => (
            <View key={`${tag}-${index}`} style={[styles.tag, { backgroundColor: tagBgColor }]}>
              <ThemedText style={[styles.tagText, { color: tintColor }]}>{tag}</ThemedText>
            </View>
          ))}
        </View>
      )}
    </TouchableOpacity>
  );

  return (
    <ThemedView style={[styles.container, { backgroundColor }]}>
      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          {
            paddingTop: Math.max(insets.top, 16),
            paddingBottom: insets.bottom + 32,
          },
        ]}
        showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          {subjectParam ? (
            <TouchableOpacity
              style={styles.backToSubjectsRow}
              onPress={() => router.back()}
              activeOpacity={0.8}>
              <MaterialIcons name="arrow-back" size={24} color={tintColor} />
              <ThemedText style={[styles.backToSubjectsText, { color: tintColor }]}>
                Back to subjects
              </ThemedText>
            </TouchableOpacity>
          ) : null}
          <ThemedText type="title">
            {subjectParam
              ? `${subjectParam}`
              : boardParam
              ? `${boardParam} Bookshelf`
              : 'Bookshelf'}
          </ThemedText>
          {boardParam && !subjectParam && (
            <ThemedText style={[styles.headerSubtitle, { color: mutedTextColor }]}>
              Select a subject to view textbooks
            </ThemedText>
          )}
          {boardParam && subjectParam && (
            <ThemedText style={[styles.headerSubtitle, { color: mutedTextColor }]}>
              {boardParam} textbooks
            </ThemedText>
          )}
          <View style={styles.headerActions}>
            {activeSection === 'Textbooks' && !showSubjectList && (
              <TouchableOpacity
                style={[
                  styles.selectButton,
                  { borderColor: tagBgColor, backgroundColor: cardBgColor },
                ]}
                onPress={() => (isSelecting ? resetSelection() : setIsSelecting(true))}
                activeOpacity={0.8}>
                <ThemedText style={[styles.selectButtonText, { color: mutedTextColor }]}>
                  {isSelecting ? 'Cancel' : 'Select'}
                </ThemedText>
              </TouchableOpacity>
            )}
          </View>
        </View>

        {activeSection === 'Textbooks' && boardParam && !showSubjectList && (
          <View style={styles.searchContainer}>
            <View
              style={[
                styles.searchInputContainer,
                { backgroundColor: cardBgColor, borderColor: tagBgColor },
              ]}>
              <MaterialIcons name="search" size={20} color={mutedTextColor} />
              <ThemedTextInput
                style={styles.searchInput}
                placeholder={`Search ${boardParam} textbooks...`}
                value={searchQuery}
                onChangeText={setSearchQuery}
                autoCapitalize="none"
                autoCorrect={false}
              />
              {searchQuery.length > 0 && (
                <TouchableOpacity onPress={() => setSearchQuery('')} activeOpacity={0.7}>
                  <MaterialIcons name="close" size={20} color={mutedTextColor} />
                </TouchableOpacity>
              )}
            </View>
          </View>
        )}

        <View style={styles.sectionTabs}>
          {(['Textbooks', 'Collection'] as const).map((section) => (
            <TouchableOpacity
              key={section}
              style={[
                styles.sectionTab,
                { backgroundColor: cardBgColor, borderColor: tagBgColor },
                activeSection === section && { borderColor: tintColor },
              ]}
              onPress={() => setActiveSection(section)}
              activeOpacity={0.8}>
              <ThemedText
                style={[
                  styles.sectionTabText,
                  { color: activeSection === section ? tintColor : mutedTextColor },
                ]}>
                {section}
              </ThemedText>
            </TouchableOpacity>
          ))}
        </View>

        {activeSection === 'Textbooks' ? (
          <>
            {showSubjectList && subjectConfig ? (
              <View style={styles.subjectListContainer}>
                {subjectConfig.groups.map((group) => (
                  <View key={group.name} style={styles.subjectGroup}>
                    <ThemedText style={[styles.subjectGroupTitle, { color: mutedTextColor }]}>
                      {group.name}
                    </ThemedText>
                    <View style={styles.subjectGrid}>
                      {group.subjects.map((subj) => {
                        const count = getBookCountForSubject(subj.key);
                        return (
                          <TouchableOpacity
                            key={subj.key}
                            style={[styles.subjectCard, { backgroundColor: cardBgColor, borderColor: tagBgColor }]}
                            onPress={() =>
                              router.push({
                                pathname: '/(tabs)/bookshelf',
                                params: { board: boardParam, section: 'Textbooks', subject: subj.key },
                              })
                            }
                            activeOpacity={0.8}>
                            <MaterialIcons name="menu-book" size={24} color={tintColor} />
                            <ThemedText style={[styles.subjectCardLabel, { color: textColor }]} numberOfLines={2}>
                              {subj.label}
                            </ThemedText>
                            {count > 0 && (
                              <View style={[styles.subjectCountBadge, { backgroundColor: tagBgColor }]}>
                                <ThemedText style={[styles.subjectCountText, { color: tintColor }]}>
                                  {count}
                                </ThemedText>
                              </View>
                            )}
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  </View>
                ))}
              </View>
            ) : (
              <>
                {isSelecting && (
                  <View style={styles.selectionActions}>
                    <ThemedText style={[styles.selectionText, { color: mutedTextColor }]}>
                      {selectedBookIds.length} selected
                    </ThemedText>
                    <TouchableOpacity
                      style={[styles.assignButton, { backgroundColor: tintColor }]}
                      onPress={() => {
                        if (collections.length === 0) {
                          openCreateCollection();
                        } else {
                          setActiveCollectionId(null);
                          setShowCollectionModal(true);
                          setCollectionModalMode('create');
                        }
                      }}
                      activeOpacity={0.8}>
                      <ThemedText style={styles.assignButtonText}>Add to Collection</ThemedText>
                    </TouchableOpacity>
                  </View>
                )}
                {filteredBooks.length === 0 ? (
                  <View style={styles.emptyState}>
                    <MaterialIcons name="menu-book" size={48} color={mutedTextColor} />
                    <ThemedText style={[styles.emptyText, { color: mutedTextColor }]}>
                      {searchQuery
                        ? 'No textbooks match your search.'
                        : subjectParam
                        ? `No textbooks in ${subjectParam} yet.`
                        : boardParam
                        ? `No textbooks available for ${boardParam} yet.`
                        : 'Select an exam board to view textbooks.'}
                    </ThemedText>
                  </View>
                ) : (
                  <FlatList
                    data={filteredBooks}
                    renderItem={renderBook}
                    keyExtractor={(item) => item.id}
                    numColumns={2}
                    columnWrapperStyle={styles.row}
                    contentContainerStyle={styles.listContent}
                    scrollEnabled={false}
                  />
                )}
              </>
            )}
          </>
        ) : (
          <>
            <View style={styles.collectionHeader}>
              <ThemedText style={[styles.collectionTitle, { color: mutedTextColor }]}>
                Collections
              </ThemedText>
              <TouchableOpacity onPress={openCreateCollection} activeOpacity={0.8}>
                <ThemedText style={[styles.collectionAction, { color: tintColor }]}>
                  New
                </ThemedText>
              </TouchableOpacity>
            </View>

            {collections.length === 0 ? (
              <View style={styles.emptyState}>
                <MaterialIcons name="collections-bookmark" size={48} color={mutedTextColor} />
                <ThemedText style={[styles.emptyText, { color: mutedTextColor }]}>
                  Create a collection to organize your textbooks.
                </ThemedText>
              </View>
            ) : (
              <View style={styles.collectionList}>
                {collections.map((collection) => (
                  <TouchableOpacity
                    key={collection.id}
                    style={[styles.collectionCard, { backgroundColor: cardBgColor, borderColor: tagBgColor }]}
                    onPress={() => setActiveCollectionId(collection.id)}
                    activeOpacity={0.8}>
                    <View>
                      <ThemedText style={styles.collectionName}>{collection.name}</ThemedText>
                      <ThemedText style={[styles.collectionCount, { color: mutedTextColor }]}>
                        {collection.bookIds.length} books
                      </ThemedText>
                    </View>
                    <View style={styles.collectionActions}>
                      <TouchableOpacity
                        onPress={() => openRenameCollection(collection.id, collection.name)}
                        activeOpacity={0.8}>
                        <MaterialIcons name="edit" size={18} color={tintColor} />
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={() =>
                          Alert.alert('Delete collection', 'Are you sure?', [
                            { text: 'Cancel', style: 'cancel' },
                            {
                              text: 'Delete',
                              style: 'destructive',
                              onPress: () => deleteCollection(collection.id),
                            },
                          ])
                        }
                        activeOpacity={0.8}>
                        <MaterialIcons name="delete" size={18} color={mutedTextColor} />
                      </TouchableOpacity>
                    </View>
                  </TouchableOpacity>
                ))}
              </View>
            )}

            {activeCollectionId && (
              <>
                <View style={styles.collectionHeader}>
                  <ThemedText style={[styles.collectionTitle, { color: mutedTextColor }]}>
                    Collection Books
                  </ThemedText>
                  <TouchableOpacity
                    onPress={() => setActiveCollectionId(null)}
                    activeOpacity={0.8}>
                    <ThemedText style={[styles.collectionAction, { color: tintColor }]}>
                      Back
                    </ThemedText>
                  </TouchableOpacity>
                </View>
                {collectionViewBooks.length === 0 ? (
                  <View style={styles.emptyState}>
                    <MaterialIcons name="menu-book" size={48} color={mutedTextColor} />
                    <ThemedText style={[styles.emptyText, { color: mutedTextColor }]}>
                      This collection is empty.
                    </ThemedText>
                  </View>
                ) : (
                  <FlatList
                    data={collectionViewBooks}
                    renderItem={renderBook}
                    keyExtractor={(item) => item.id}
                    numColumns={2}
                    columnWrapperStyle={styles.row}
                    contentContainerStyle={styles.listContent}
                    scrollEnabled={false}
                  />
                )}
              </>
            )}
          </>
        )}
      </ScrollView>

      <Modal
        visible={showCollectionModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowCollectionModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { backgroundColor: cardBgColor, borderColor: tagBgColor }]}>
            <View style={styles.modalHeader}>
              <ThemedText style={styles.modalTitle} type="defaultSemiBold">
                {collectionModalMode === 'create' ? 'Create Collection' : 'Rename Collection'}
              </ThemedText>
              <TouchableOpacity
                onPress={() => setShowCollectionModal(false)}
                activeOpacity={0.8}>
                <MaterialIcons name="close" size={20} color={mutedTextColor} />
              </TouchableOpacity>
            </View>
            <ThemedTextInput
              style={styles.modalInput}
              placeholder="Collection name"
              value={collectionNameInput}
              onChangeText={setCollectionNameInput}
            />
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.modalButton, { borderColor: tagBgColor }]}
                onPress={() => setShowCollectionModal(false)}
                activeOpacity={0.8}>
                <ThemedText style={[styles.modalButtonText, { color: mutedTextColor }]}>
                  Cancel
                </ThemedText>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, { backgroundColor: tintColor }]}
                onPress={saveCollection}
                activeOpacity={0.8}>
                <ThemedText style={[styles.modalButtonText, { color: '#000000' }]}>Save</ThemedText>
              </TouchableOpacity>
            </View>
            {collectionModalMode === 'create' && selectedBookIds.length > 0 && (
              <View style={styles.modalHelper}>
                <ThemedText style={[styles.modalHelperText, { color: mutedTextColor }]}>
                  After creating, select the collection to add books.
                </ThemedText>
              </View>
            )}
          </View>
        </View>
      </Modal>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 32,
  },
  header: {
    paddingHorizontal: 16,
    paddingTop: 16,
    marginBottom: 16,
    gap: 12,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  headerSubtitle: {
    fontSize: 14,
  },
  backToSubjectsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  backToSubjectsText: {
    fontSize: 16,
    fontWeight: '600',
  },
  selectButton: {
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
  },
  selectButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  searchContainer: {
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  searchInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    borderWidth: 0,
    padding: 0,
    margin: 0,
    minHeight: 'auto',
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 32,
    gap: 12,
  },
  subjectListContainer: {
    paddingHorizontal: 16,
    paddingBottom: 32,
    gap: 24,
  },
  subjectGroup: {
    gap: 12,
  },
  subjectGroupTitle: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1,
  },
  subjectGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  subjectCard: {
    width: '47%',
    minWidth: 140,
    borderRadius: 12,
    borderWidth: 1,
    padding: 14,
    gap: 8,
  },
  subjectCardLabel: {
    fontSize: 14,
    fontWeight: '600',
  },
  subjectCountBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  subjectCountText: {
    fontSize: 12,
    fontWeight: '600',
  },
  sectionTabs: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    gap: 12,
    marginBottom: 16,
  },
  sectionTab: {
    flex: 1,
    borderRadius: 12,
    borderWidth: 1,
    paddingVertical: 10,
    alignItems: 'center',
  },
  sectionTabText: {
    fontSize: 14,
    fontWeight: '600',
  },
  row: {
    justifyContent: 'space-between',
    gap: 12,
  },
  bookCard: {
    flex: 1,
    minWidth: '47%',
    borderRadius: 12,
    padding: 16,
    gap: 8,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  bookCardSelected: {
    borderWidth: 2,
    borderColor: '#00FF41',
  },
  bookIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bookTitle: {
    fontSize: 14,
    fontWeight: '600',
  },
  bookMeta: {
    fontSize: 12,
  },
  tagRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  tag: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  tagText: {
    fontSize: 10,
    fontWeight: '600',
  },
  emptyState: {
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 48,
    gap: 12,
  },
  emptyText: {
    fontSize: 14,
    textAlign: 'center',
  },
  selectionActions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  selectionText: {
    fontSize: 14,
  },
  assignButton: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
  },
  assignButtonText: {
    color: '#000',
    fontWeight: '600',
  },
  collectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  collectionTitle: {
    fontSize: 14,
    fontWeight: '600',
  },
  collectionAction: {
    fontSize: 14,
    fontWeight: '600',
  },
  collectionList: {
    paddingHorizontal: 16,
    gap: 12,
    marginBottom: 16,
  },
  collectionCard: {
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  collectionName: {
    fontSize: 14,
    fontWeight: '600',
  },
  collectionCount: {
    fontSize: 12,
  },
  collectionActions: {
    flexDirection: 'row',
    gap: 12,
  },
  modalOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
  },
  modalCard: {
    width: '100%',
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    gap: 12,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  modalTitle: {
    fontSize: 16,
  },
  modalInput: {
    borderWidth: 1,
    borderColor: '#2A2A2A',
  },
  modalActions: {
    flexDirection: 'row',
    gap: 12,
  },
  modalButton: {
    flex: 1,
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
    borderWidth: 1,
  },
  modalButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  modalHelper: {
    marginTop: 6,
  },
  modalHelperText: {
    fontSize: 12,
  },
});

