import { useState } from 'react';
import {
  StyleSheet,
  ScrollView,
  View,
  TouchableOpacity,
  Image,
  Alert,
  Modal,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import * as Haptics from 'expo-haptics';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useRouter } from 'expo-router';
import { ThemedView } from '@/components/themed-view';
import { ThemedText } from '@/components/themed-text';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useThemeColor } from '@/hooks/use-theme-color';
import { useAuth } from '@/src/context/AuthContext';

export default function ProfileScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const [avatarUri, setAvatarUri] = useState<string | null>(null);
  const [showAchievements, setShowAchievements] = useState(false);
  const colorScheme = useColorScheme();
  const textColor = useThemeColor({}, 'text');
  const backgroundColor = useThemeColor({}, 'background');
  const cardBgColor = colorScheme === 'dark' ? '#1F1F1F' : '#FFFFFF';
  const borderColor = colorScheme === 'dark' ? '#2A2A2A' : '#E5E5E5';
  const accentColor = '#00FF41';

  const displayName = 'Ade Solabomi';
  const initials = displayName
    .split(' ')
    .map((part) => part[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  const handlePickImage = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Permission needed', 'Please allow photo access to upload a profile image.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (!result.canceled && result.assets?.[0]?.uri) {
      setAvatarUri(result.assets[0].uri);
    }
  };

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
          <ThemedText style={styles.headerTitle} type="defaultSemiBold">
            Profile
          </ThemedText>
        </View>

        <View style={[styles.profileCard, { backgroundColor: cardBgColor, borderColor }]}>
          <View style={styles.avatarWrapper}>
            {avatarUri ? (
              <Image source={{ uri: avatarUri }} style={styles.avatarImage} />
            ) : (
              <View style={[styles.avatarPlaceholder, { borderColor: accentColor }]}>
                <ThemedText style={[styles.avatarText, { color: textColor }]}>
                  {initials}
                </ThemedText>
              </View>
            )}
            <TouchableOpacity style={styles.cameraBadge} onPress={handlePickImage} activeOpacity={0.8}>
              <MaterialIcons name="photo-camera" size={16} color={accentColor} />
            </TouchableOpacity>
          </View>

          <ThemedText style={styles.nameText} type="defaultSemiBold">
            {displayName}
          </ThemedText>
        </View>

        <View style={styles.actionList}>
          {[
            {
              label: 'SWITCH ACCOUNT',
              action: () => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                router.replace('/account-select');
              },
            },
            {
              label: 'SAMPLE PAPERS',
              action: () => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                router.push('/sample-papers');
              },
            },
            { label: 'MY BIO', action: () => Alert.alert('My Bio', 'Coming soon.') },
            { label: 'CHANGE PASSWORD', action: () => Alert.alert('Change Password', 'Coming soon.') },
            { label: 'MY ACHIEVEMENTS', action: () => setShowAchievements(true) },
          ].map((item) => (
            <TouchableOpacity
              key={item.label}
              style={[styles.actionRow, { backgroundColor: cardBgColor, borderColor }]}
              onPress={item.action}
              activeOpacity={0.8}>
              <ThemedText style={styles.actionText}>{item.label}</ThemedText>
              <MaterialIcons name="chevron-right" size={20} color={textColor} />
            </TouchableOpacity>
          ))}
        </View>

        <TouchableOpacity
          style={[styles.logoutButton, { backgroundColor: cardBgColor, borderColor }]}
          onPress={() => Alert.alert('Logout', 'Coming soon.')}
          activeOpacity={0.8}>
          <ThemedText style={[styles.logoutText, { color: accentColor }]}>Logout</ThemedText>
          <MaterialIcons name="logout" size={18} color={accentColor} />
        </TouchableOpacity>

      </ScrollView>
      <Modal
        visible={showAchievements}
        transparent
        animationType="fade"
        onRequestClose={() => setShowAchievements(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { backgroundColor: cardBgColor, borderColor }]}>
            <View style={styles.modalHeader}>
              <ThemedText style={styles.modalTitle} type="defaultSemiBold">
                Achievements
              </ThemedText>
              <TouchableOpacity
                onPress={() => setShowAchievements(false)}
                activeOpacity={0.8}>
                <MaterialIcons name="close" size={20} color={textColor} />
              </TouchableOpacity>
            </View>
            <View style={styles.badgeGrid}>
              {[
                { label: 'Bookworm', icon: 'menu-book' },
                { label: 'Top Scorer', icon: 'emoji-events' },
                { label: 'Consistency', icon: 'local-fire-department' },
                { label: 'Fast Learner', icon: 'bolt' },
              ].map((badge) => (
                <View
                  key={badge.label}
                  style={[styles.badgeCard, { backgroundColor: borderColor }]}>
                  <MaterialIcons name={badge.icon as any} size={24} color={accentColor} />
                  <ThemedText style={styles.badgeText}>{badge.label}</ThemedText>
                </View>
              ))}
            </View>
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
    padding: 16,
    paddingBottom: 32,
  },
  header: {
    marginBottom: 16,
  },
  headerTitle: {
    fontSize: 18,
  },
  profileCard: {
    borderRadius: 16,
    borderWidth: 1,
    paddingVertical: 20,
    alignItems: 'center',
    gap: 10,
  },
  avatarWrapper: {
    width: 96,
    height: 96,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarImage: {
    width: 96,
    height: 96,
    borderRadius: 48,
  },
  avatarPlaceholder: {
    width: 96,
    height: 96,
    borderRadius: 48,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 22,
    fontWeight: '600',
  },
  cameraBadge: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#1F1F1F',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#2A2A2A',
  },
  nameText: {
    fontSize: 16,
  },
  actionList: {
    marginTop: 20,
    gap: 12,
  },
  actionRow: {
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  actionText: {
    fontSize: 14,
    letterSpacing: 0.5,
  },
  logoutButton: {
    marginTop: 24,
    borderRadius: 12,
    borderWidth: 1,
    paddingVertical: 16,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  logoutText: {
    fontSize: 14,
    fontWeight: '600',
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
    gap: 16,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  modalTitle: {
    fontSize: 16,
  },
  badgeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  badgeCard: {
    width: '47%',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 10,
    alignItems: 'center',
    gap: 6,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
  },
});

