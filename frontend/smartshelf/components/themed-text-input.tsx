import { TextInput, StyleSheet, type TextInputProps } from 'react-native';

import { useThemeColor } from '@/hooks/use-theme-color';
import { Colors } from '@/constants/theme';

export type ThemedTextInputProps = TextInputProps & {
  lightColor?: string;
  darkColor?: string;
  lightBackgroundColor?: string;
  darkBackgroundColor?: string;
};

export function ThemedTextInput({
  style,
  lightColor,
  darkColor,
  lightBackgroundColor,
  darkBackgroundColor,
  ...rest
}: ThemedTextInputProps) {
  const textColor = useThemeColor({ light: lightColor, dark: darkColor }, 'text');
  const backgroundColor = useThemeColor(
    { light: lightBackgroundColor, dark: darkBackgroundColor },
    'background'
  );
  const borderColor = useThemeColor(
    { light: Colors.light.icon, dark: Colors.dark.icon },
    'icon'
  );

  return (
    <TextInput
      style={[
        styles.input,
        { color: textColor, backgroundColor, borderColor },
        style,
      ]}
      placeholderTextColor={useThemeColor({}, 'icon')}
      {...rest}
    />
  );
}

const styles = StyleSheet.create({
  input: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    minHeight: 48,
  },
});

