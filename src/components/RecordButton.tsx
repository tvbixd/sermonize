import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, typography } from '@/theme';

type Props = {
  status: 'idle' | 'recording' | 'paused';
  onPress: () => void;
};

export function RecordButton({ status, onPress }: Props) {
  const label =
    status === 'idle' ? 'Tap to Record' : status === 'recording' ? 'Tap to Pause' : 'Tap to Resume';

  return (
    <Pressable onPress={onPress} accessibilityLabel={label} style={styles.outer}>
      <View style={[styles.ring, status === 'recording' && styles.ringRecording]}>
        <View
          style={[
            styles.inner,
            status === 'recording' && styles.innerRecording,
            status === 'paused' && styles.innerPaused,
          ]}
        />
      </View>
      <Text style={styles.label}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  outer: { alignItems: 'center', justifyContent: 'center' },
  ring: {
    width: 164,
    height: 164,
    borderRadius: 82,
    borderWidth: 3,
    borderColor: colors.darkBgSurfaceRaised,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ringRecording: { borderColor: colors.accentRed },
  inner: {
    width: 112,
    height: 112,
    borderRadius: 56,
    backgroundColor: colors.accentRed,
  },
  innerRecording: { backgroundColor: colors.accentRed },
  innerPaused: {
    borderRadius: 14,
    width: 72,
    height: 72,
    backgroundColor: colors.darkTextSecondary,
  },
  label: {
    ...typography.subhead,
    fontWeight: '600',
    color: colors.darkTextSecondary,
    marginTop: 20,
  },
});
