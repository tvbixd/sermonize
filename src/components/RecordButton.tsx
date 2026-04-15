import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

type Props = {
  status: 'idle' | 'recording' | 'paused';
  onPress: () => void;
};

export function RecordButton({ status, onPress }: Props) {
  const label =
    status === 'idle' ? 'Start Recording' : status === 'recording' ? 'Recording' : 'Paused';
  const inner = status === 'idle' ? 'circle' : status === 'recording' ? 'pulse' : 'square';

  return (
    <Pressable onPress={onPress} accessibilityLabel={label} style={styles.outer}>
      <View style={[styles.ring, status === 'recording' && styles.ringActive]}>
        <View
          style={[
            styles.inner,
            inner === 'pulse' && styles.innerRecording,
            inner === 'square' && styles.innerPaused,
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
    width: 160,
    height: 160,
    borderRadius: 80,
    borderWidth: 4,
    borderColor: '#cbd5e1',
    alignItems: 'center',
    justifyContent: 'center',
  },
  ringActive: { borderColor: '#dc2626' },
  inner: {
    width: 110,
    height: 110,
    borderRadius: 55,
    backgroundColor: '#dc2626',
  },
  innerRecording: { backgroundColor: '#dc2626' },
  innerPaused: { borderRadius: 12, width: 80, height: 80, backgroundColor: '#475569' },
  label: { marginTop: 16, fontSize: 18, fontWeight: '600', color: '#334155' },
});
