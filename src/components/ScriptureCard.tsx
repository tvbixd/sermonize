import React, { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { type Colors, radius, spacing, typography, useTheme } from '@/theme';
import type { Scripture } from '../types';

export function ScriptureCard({ scripture }: { scripture: Scripture }) {
  const t = useTheme();
  const styles = useMemo(() => makeStyles(t), [t]);

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

function makeStyles(t: Colors) {
  return StyleSheet.create({
    card: {
      backgroundColor: t.bgSurface,
      borderLeftWidth: 3,
      borderLeftColor: t.accentBlue,
      padding: spacing.md,
      marginBottom: spacing.sm,
      borderRadius: radius.small,
    },
    ref: { ...typography.footnote, fontWeight: '700', color: t.accentBlue, marginBottom: spacing.sm },
    text: { ...typography.subhead, color: t.textPrimary, lineHeight: 22 },
    placeholder: { ...typography.footnote, color: t.textSecondary, fontStyle: 'italic' },
  });
}
