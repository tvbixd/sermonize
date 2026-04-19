import React, { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { type Colors, spacing, typography, useTheme } from '@/theme';
import type { Outline } from '../types';

export function OutlineView({ outline }: { outline: Outline }) {
  const t = useTheme();
  const styles = useMemo(() => makeStyles(t), [t]);

  return (
    <View>
      <Text style={styles.title}>{outline.title}</Text>
      {outline.theme ? <Text style={styles.theme}>{outline.theme}</Text> : null}
      {outline.summary ? <Text style={styles.summary}>{outline.summary}</Text> : null}
      {outline.points.map((p, i) => (
        <View key={i} style={styles.point}>
          <Text style={styles.heading}>{i + 1}. {p.heading}</Text>
          {p.subPoints.map((sp, j) => (
            <Text key={j} style={styles.sub}>{'• '}{sp}</Text>
          ))}
          {p.scriptures.length > 0 ? (
            <Text style={styles.refs}>{p.scriptures.join('  ·  ')}</Text>
          ) : null}
        </View>
      ))}
    </View>
  );
}

function makeStyles(t: Colors) {
  return StyleSheet.create({
    title: { ...typography.title2, color: t.textPrimary, marginBottom: spacing.xs },
    theme: { ...typography.subhead, fontStyle: 'italic', color: t.textSecondary, marginBottom: spacing.sm },
    summary: { ...typography.subhead, color: t.textPrimary, marginBottom: spacing.md, lineHeight: 22 },
    point: { marginBottom: spacing.md },
    heading: { ...typography.headline, color: t.textPrimary, marginBottom: spacing.xs },
    sub: { ...typography.subhead, color: t.textPrimary, marginLeft: spacing.md, marginVertical: 2, lineHeight: 22 },
    refs: { ...typography.footnote, color: t.accentBlue, marginTop: spacing.xs, marginLeft: spacing.md },
  });
}
