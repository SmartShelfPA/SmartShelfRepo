import { Modal, Pressable, StyleSheet, TouchableOpacity, View } from 'react-native';
import { useRouter, type Href } from 'expo-router';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';

import { ThemedText } from '@/components/themed-text';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useAuthStore } from '@/src/store/auth';

export type AccountMenuItem = {
  id: string;
  label: string;
  icon: keyof typeof MaterialIcons.glyphMap;
  href?: Href;
  onPress?: () => void;
};

type Props = {
  visible: boolean;
  onClose: () => void;
  title?: string;
  subtitle?: string;
  extraItems?: AccountMenuItem[];
};

/** Bottom-sheet account menu for parent/teacher screens (works on web, unlike multi-button Alerts). */
export function AccountMenu({ visible, onClose, title, subtitle, extraItems = [] }: Props) {
  const router = useRouter();
  const signOut = useAuthStore((s) => s.signOut);
  const isDark = useColorScheme() === 'dark';
  const sheetBg = isDark ? '#1F1F1F' : '#FFFFFF';
  const borderColor = isDark ? '#2A2A2A' : '#E5E5E5';
  const muted = isDark ? '#9BA1A6' : '#687076';
  const tint = isDark ? '#fff' : '#00C832';

  const items: AccountMenuItem[] = [
    ...extraItems,
    { id: 'help', label: 'Help & feedback', icon: 'support-agent', href: '/feedback' },
    { id: 'privacy', label: 'Privacy & data', icon: 'privacy-tip', href: '/privacy-data' },
  ];

  const go = (item: AccountMenuItem) => {
    onClose();
    if (item.onPress) item.onPress();
    else if (item.href) router.push(item.href);
  };

  const handleSignOut = async () => {
    onClose();
    await signOut();
    router.replace('/login');
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={[styles.sheet, { backgroundColor: sheetBg }]} onPress={() => {}}>
          {title ? <ThemedText type="subtitle">{title}</ThemedText> : null}
          {subtitle ? <ThemedText style={{ color: muted }}>{subtitle}</ThemedText> : null}
          <View style={[styles.list, { borderColor }]}>
            {items.map((item) => (
              <TouchableOpacity
                key={item.id}
                style={[styles.row, { borderBottomColor: borderColor }]}
                onPress={() => go(item)}
                accessibilityRole="button">
                <MaterialIcons name={item.icon} size={22} color={tint} />
                <ThemedText style={styles.rowLabel}>{item.label}</ThemedText>
                <MaterialIcons name="chevron-right" size={20} color={muted} />
              </TouchableOpacity>
            ))}
            <TouchableOpacity style={styles.row} onPress={handleSignOut} accessibilityRole="button">
              <MaterialIcons name="logout" size={22} color="#e53935" />
              <ThemedText style={[styles.rowLabel, { color: '#e53935' }]}>Sign out</ThemedText>
            </TouchableOpacity>
          </View>
          <TouchableOpacity onPress={onClose} style={styles.cancel}>
            <ThemedText style={{ color: muted, fontWeight: '600' }}>Close</ThemedText>
          </TouchableOpacity>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  sheet: {
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    padding: 20,
    gap: 10,
    width: '100%',
    maxWidth: 600,
    alignSelf: 'center',
  },
  list: { borderWidth: 1, borderRadius: 12, overflow: 'hidden', marginTop: 6 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  rowLabel: { flex: 1, fontSize: 16, fontWeight: '600' },
  cancel: { alignItems: 'center', paddingVertical: 8 },
});
