import { useState } from 'react';
import { StyleSheet, TouchableOpacity, View } from 'react-native';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';

import { ThemedTextInput, type ThemedTextInputProps } from '@/components/themed-text-input';
import { useThemeColor } from '@/hooks/use-theme-color';

export function PasswordInput({ style, editable = true, ...rest }: ThemedTextInputProps) {
  const [visible, setVisible] = useState(false);
  const iconColor = useThemeColor({}, 'icon');

  return (
    <View style={styles.wrap}>
      <ThemedTextInput
        {...rest}
        editable={editable}
        style={[styles.input, style]}
        secureTextEntry={!visible}
      />
      <TouchableOpacity
        style={styles.toggle}
        onPress={() => setVisible((v) => !v)}
        disabled={editable === false}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        accessibilityRole="button"
        accessibilityLabel={visible ? 'Hide password' : 'Show password'}>
        <MaterialIcons
          name={visible ? 'visibility-off' : 'visibility'}
          size={22}
          color={iconColor}
        />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'relative',
    width: '100%',
  },
  input: {
    paddingRight: 48,
  },
  toggle: {
    position: 'absolute',
    right: 12,
    top: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    minWidth: 32,
  },
});
