import type { ReactNode } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View,
  type StyleProp,
  type TextInputProps,
  type ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useThemeColor } from '@/hooks/use-theme-color';

export function useKitTheme() {
  const isDark = useColorScheme() === 'dark';
  return {
    isDark,
    background: useThemeColor({}, 'background'),
    text: useThemeColor({}, 'text'),
    muted: isDark ? '#9BA1A6' : '#687076',
    tint: isDark ? '#fff' : '#00C832',
    accent: '#00FF41',
    card: isDark ? '#1F1F1F' : '#FFFFFF',
    border: isDark ? '#2A2A2A' : '#E5E5E5',
    danger: '#e53935',
    warning: '#d4a017',
  };
}

type ScreenProps = {
  title: string;
  subtitle?: string;
  right?: ReactNode;
  children: ReactNode;
  scroll?: boolean;
  onBack?: () => void;
};

/** Standard screen: back button + title header, centred content column. */
export function Screen({ title, subtitle, right, children, scroll = true, onBack }: ScreenProps) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const t = useKitTheme();
  const back = onBack ?? (() => (router.canGoBack() ? router.back() : router.replace('/')));

  return (
    <ThemedView style={[styles.flex, { backgroundColor: t.background }]}>
      <View
        style={[
          styles.header,
          { paddingTop: Math.max(insets.top, 16), borderBottomColor: t.border },
        ]}>
        <TouchableOpacity onPress={back} style={styles.iconBtn} accessibilityLabel="Back">
          <MaterialIcons name="arrow-back" size={24} color={t.tint} />
        </TouchableOpacity>
        <View style={styles.flex}>
          <ThemedText style={styles.headerTitle} numberOfLines={1}>
            {title}
          </ThemedText>
          {subtitle ? (
            <ThemedText style={[styles.headerSubtitle, { color: t.muted }]} numberOfLines={1}>
              {subtitle}
            </ThemedText>
          ) : null}
        </View>
        {right}
      </View>
      {scroll ? (
        <ScrollView
          contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 40 }]}
          keyboardShouldPersistTaps="handled">
          {children}
        </ScrollView>
      ) : (
        <View style={[styles.flex, styles.content]}>{children}</View>
      )}
    </ThemedView>
  );
}

export function Card({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const t = useKitTheme();
  return (
    <View style={[styles.card, { backgroundColor: t.card, borderColor: t.border }, style]}>
      {children}
    </View>
  );
}

export function SectionLabel({ children }: { children: ReactNode }) {
  const t = useKitTheme();
  return <ThemedText style={[styles.sectionLabel, { color: t.muted }]}>{children}</ThemedText>;
}

export function Muted({ children, style }: { children: ReactNode; style?: object }) {
  const t = useKitTheme();
  return <ThemedText style={[{ color: t.muted, fontSize: 14, lineHeight: 20 }, style]}>{children}</ThemedText>;
}

type ButtonProps = {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'danger';
  disabled?: boolean;
  loading?: boolean;
  icon?: keyof typeof MaterialIcons.glyphMap;
  style?: StyleProp<ViewStyle>;
};

export function Button({ label, onPress, variant = 'primary', disabled, loading, icon, style }: ButtonProps) {
  const t = useKitTheme();
  const isPrimary = variant === 'primary';
  const color = variant === 'danger' ? t.danger : isPrimary ? '#000' : t.text;
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled || loading}
      activeOpacity={0.8}
      accessibilityRole="button"
      style={[
        styles.button,
        isPrimary
          ? { backgroundColor: t.accent, borderColor: t.accent }
          : { backgroundColor: 'transparent', borderColor: variant === 'danger' ? t.danger : t.border },
        (disabled || loading) && { opacity: 0.5 },
        style,
      ]}>
      {loading ? (
        <ActivityIndicator size="small" color={color} />
      ) : icon ? (
        <MaterialIcons name={icon} size={18} color={color} />
      ) : null}
      <ThemedText style={[styles.buttonLabel, { color }]}>{label}</ThemedText>
    </TouchableOpacity>
  );
}

type FieldProps = TextInputProps & { label?: string; hint?: string };

export function Field({ label, hint, style, multiline, ...rest }: FieldProps) {
  const t = useKitTheme();
  return (
    <View style={styles.field}>
      {label ? <ThemedText style={styles.fieldLabel}>{label}</ThemedText> : null}
      <TextInput
        placeholderTextColor={t.muted}
        multiline={multiline}
        style={[
          styles.input,
          { color: t.text, borderColor: t.border, backgroundColor: t.card },
          multiline && styles.inputMultiline,
          style,
        ]}
        {...rest}
      />
      {hint ? <ThemedText style={[styles.hint, { color: t.muted }]}>{hint}</ThemedText> : null}
    </View>
  );
}

export function Chip({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected?: boolean;
  onPress?: () => void;
}) {
  const t = useKitTheme();
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={!onPress}
      style={[
        styles.chip,
        { borderColor: selected ? t.accent : t.border },
        selected && { backgroundColor: t.accent },
      ]}>
      <ThemedText style={[styles.chipLabel, selected && { color: '#000' }]}>{label}</ThemedText>
    </TouchableOpacity>
  );
}

export function Pill({ label, color }: { label: string; color: string }) {
  return (
    <View style={[styles.pill, { backgroundColor: color + '22', borderColor: color }]}>
      <ThemedText style={[styles.pillLabel, { color }]}>{label}</ThemedText>
    </View>
  );
}

export function CenteredState({
  loading,
  message,
  actionLabel,
  onAction,
}: {
  loading?: boolean;
  message?: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  const t = useKitTheme();
  return (
    <View style={styles.centered}>
      {loading ? <ActivityIndicator size="large" color={t.accent} /> : null}
      {message ? <ThemedText style={{ textAlign: 'center', color: t.muted }}>{message}</ThemedText> : null}
      {actionLabel && onAction ? <Button label={actionLabel} onPress={onAction} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 8,
  },
  iconBtn: { padding: 6 },
  headerTitle: { fontSize: 20, fontWeight: '700' },
  headerSubtitle: { fontSize: 13 },
  content: {
    paddingHorizontal: 16,
    paddingTop: 16,
    gap: 12,
    width: '100%',
    maxWidth: 720,
    alignSelf: 'center',
  },
  card: { borderWidth: 1, borderRadius: 12, padding: 14, gap: 8 },
  sectionLabel: { fontSize: 12, fontWeight: '700', letterSpacing: 1, marginTop: 8 },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1,
  },
  buttonLabel: { fontWeight: '700', fontSize: 15 },
  field: { gap: 6 },
  fieldLabel: { fontSize: 14, fontWeight: '600' },
  input: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
  },
  inputMultiline: { minHeight: 96, textAlignVertical: 'top' },
  hint: { fontSize: 12 },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 18,
    borderWidth: 1,
    marginRight: 8,
    marginBottom: 8,
  },
  chipLabel: { fontSize: 13, fontWeight: '600' },
  pill: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    borderWidth: 1,
  },
  pillLabel: { fontSize: 12, fontWeight: '700' },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 24, minHeight: 240 },
});
