import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { Scripture } from '../types';

export function ScriptureCard({ scripture }: { scripture: Scripture }) {
  return (
    <View style={styles.card}>
      <Text style={styles.ref}>
        {scripture.reference}
        {scripture.translation ? ` (${scripture.translation})` : ''}
      </Text>
      {scripture.text ? (
        <Text style={styles.text}>{scripture.text}</Text>
      ) : (
        <Text style={styles.placeholder}>Verse text unavailable.</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#f8fafc',
    borderLeftWidth: 4,
    borderLeftColor: '#0369a1',
    padding: 12,
    marginBottom: 12,
    borderRadius: 6,
  },
  ref: { fontSize: 14, fontWeight: '700', color: '#0369a1', marginBottom: 6 },
  text: { fontSize: 15, color: '#1e293b', lineHeight: 22 },
  placeholder: { fontSize: 13, color: '#94a3b8', fontStyle: 'italic' },
});
