import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors, spacing, typography } from '@/theme';
import type { Outline } from '../types';

export function OutlineView({ outline }: { outline: Outline }) {
  return (
    <View>
      <Text style={styles.title}>{outline.title}</Text>
      {outline.theme ? <Text style={styles.theme}>{outline.theme}</Text> : null}
      {outline.summary ? <Text style={styles.summary}>{outline.summary}</Text> : null}
      {outline.points.map((p, i) => (
        <View key={i} style={styles.point}>
          <Text style={styles.heading}>
            {i + 1}. {p.heading}
          </Text>
          {p.subPoints.map((sp, j) => (
            <Text key={j} style={styles.sub}>
              {'• '}{sp}
            </Text>
          ))}
          {p.scriptures.length > 0 ? (
            <Text style={styles.refs}>{p.scriptures.join('  ·  ')}</Text>
          ) : null}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  title: { ...typography.title2, color: colors.textPrimary, marginBottom: spacing.xs },
  theme: { ...typography.subhead, fontStyle: 'italic', color: colors.textSecondary, marginBottom: spacing.sm },
  summary: { ...typography.subhead, color: colors.textPrimary, marginBottom: spacing.md, lineHeight: 22 },
  point: { marginBottom: spacing.md },
  heading: { ...typography.headline, color: colors.textPrimary, marginBottom: spacing.xs },
  sub: { ...typography.subhead, color: colors.textPrimary, marginLeft: spacing.md, marginVertical: 2, lineHeight: 22 },
  refs: { ...typography.footnote, color: colors.accentBlue, marginTop: spacing.xs, marginLeft: spacing.md },
});
