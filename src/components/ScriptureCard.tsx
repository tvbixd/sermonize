import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors, radius, spacing, typography } from '@/theme';
import type { Scripture } from '../types';

export function ScriptureCard({ scripture }: { scripture: Scripture }) {
  return (
    <View style={styles.card}>
      <Text style={styles.ref}>
        {scripture.reference}
        {scripture.translation ? `  ·  ${scripture.translation}` : ''}
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
    backgroundColor: colors.bgSurface,
    borderLeftWidth: 3,
    borderLeftColor: colors.accentBlue,
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderRadius: radius.small,
  },
  ref: { ...typography.footnote, fontWeight: '700', color: colors.accentBlue, marginBottom: spacing.sm },
  text: { ...typography.subhead, color: colors.textPrimary, lineHeight: 22 },
  placeholder: { ...typography.footnote, color: colors.textSecondary, fontStyle: 'italic' },
});
