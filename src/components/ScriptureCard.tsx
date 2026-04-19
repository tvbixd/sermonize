import React, { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { type Colors, radius, spacing, typography, useTheme } from '@/theme';
import type { Scripture } from '../types';

export function ScriptureCard({ scripture }: { scripture: Scripture }) {
  const t = useTheme();
  const styles = useMemo(() => makeStyles(t), [t]);

  return (
    <View style={styles.card}>
      <View style={styles.refRow}>
        <Text style={styles.ref}>{scripture.reference}</Text>
        {scripture.translation ? (
          <View style={styles.translationBadge}>
            <Text style={styles.translationText}>{scripture.translation}</Text>
          </View>
        ) : null}
      </View>
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
    refRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      marginBottom: spacing.sm,
    },
    ref: { ...typography.headline, color: t.accentBlue },
    translationBadge: {
      backgroundColor: t.bgSurfaceRaised,
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderRadius: 4,
    },
    translationText: { ...typography.caption, color: t.textSecondary },
    text: { ...typography.subhead, color: t.textPrimary, lineHeight: 22 },
    placeholder: { ...typography.footnote, color: t.textSecondary, fontStyle: 'italic' },
  });
}
