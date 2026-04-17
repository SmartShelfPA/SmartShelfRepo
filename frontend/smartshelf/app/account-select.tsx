import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import {
  StyleSheet,
  View,
  TouchableOpacity,
  Image,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useThemeColor } from '@/hooks/use-theme-color';
import { useColorScheme } from '@/hooks/use-color-scheme';

type AccountType = 'student' | 'parent';

export default function AccountSelectScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const colorScheme = useColorScheme();
  const backgroundColor = useThemeColor({}, 'background');
  const textColor = useThemeColor({}, 'text');
  const mutedTextColor = colorScheme === 'dark' ? '#9BA1A6' : '#687076';
  const tintColor = colorScheme === 'dark' ? '#fff' : '#00FF41';
  const cardBgColor = colorScheme === 'dark' ? '#1F1F1F' : '#FFFFFF';
  const borderColor = colorScheme === 'dark' ? '#2A2A2A' : '#E5E5E5';

  const cardSize = Math.min(width * 0.4, 160);

  const handleSelect = (type: AccountType) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (type === 'student') {
      router.replace('/(tabs)');
    } else {
      router.replace('/parent');
    }
  };

  return (
    <ThemedView style={[styles.container, { backgroundColor }]}>
      <View
        style={[
          styles.content,
          {
            paddingTop: Math.max(insets.top, 24) + 24,
            paddingBottom: insets.bottom + 24,
          },
        ]}>
        <View style={styles.header}>
          <Image
            source={require('@/assets/images/ss-logo.png')}
            style={styles.logo}
            resizeMode="contain"
          />
          <ThemedText style={[styles.title, { color: textColor }]}>
            Who's using SmartShelf?
          </ThemedText>
          <ThemedText style={[styles.subtitle, { color: mutedTextColor }]}>
            Choose an account to continue
          </ThemedText>
        </View>

        <View style={styles.cardsRow}>
          <TouchableOpacity
            style={[
              styles.accountCard,
              {
                width: cardSize,
                height: cardSize,
                backgroundColor: cardBgColor,
                borderColor,
              },
            ]}
            onPress={() => handleSelect('student')}
            activeOpacity={0.8}>
            <View style={[styles.iconCircle, { backgroundColor: `${tintColor}20` }]}>
              <MaterialIcons name="school" size={48} color={tintColor} />
            </View>
            <ThemedText style={[styles.accountLabel, { color: textColor }]}>
              Student
            </ThemedText>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.accountCard,
              {
                width: cardSize,
                height: cardSize,
                backgroundColor: cardBgColor,
                borderColor,
              },
            ]}
            onPress={() => handleSelect('parent')}
            activeOpacity={0.8}>
            <View style={[styles.iconCircle, { backgroundColor: `${tintColor}20` }]}>
              <MaterialIcons name="people" size={48} color={tintColor} />
            </View>
            <ThemedText style={[styles.accountLabel, { color: textColor }]}>
              Parent
            </ThemedText>
          </TouchableOpacity>
        </View>
      </View>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  header: {
    alignItems: 'center',
    marginBottom: 48,
    gap: 12,
  },
  logo: {
    width: 64,
    height: 64,
    borderRadius: 32,
  },
  title: {
    fontSize: 26,
    fontWeight: '700',
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    textAlign: 'center',
  },
  cardsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 32,
    flexWrap: 'wrap',
  },
  accountCard: {
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 16,
    borderWidth: 2,
    gap: 12,
  },
  iconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  accountLabel: {
    fontSize: 18,
    fontWeight: '600',
  },
});
