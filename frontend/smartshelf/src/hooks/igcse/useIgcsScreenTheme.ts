import { useColorScheme } from '@/hooks/use-color-scheme';
import { useThemeColor } from '@/hooks/use-theme-color';

export function useIgcsScreenTheme() {
  const colorScheme = useColorScheme();
  const textColor = useThemeColor({}, 'text');
  const backgroundColor = useThemeColor({}, 'background');
  const cardBgColor = colorScheme === 'dark' ? '#1F1F1F' : '#FFFFFF';
  const mutedTextColor = colorScheme === 'dark' ? '#9BA1A6' : '#687076';
  const tintColor = colorScheme === 'dark' ? '#fff' : '#00FF41';
  const borderColor = colorScheme === 'dark' ? '#2A2A2A' : '#E5E5E5';

  return {
    colorScheme,
    textColor,
    backgroundColor,
    cardBgColor,
    mutedTextColor,
    tintColor,
    borderColor,
  };
}
