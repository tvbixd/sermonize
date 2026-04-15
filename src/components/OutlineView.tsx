import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
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
              {'\u2022'} {sp}
            </Text>
          ))}
          {p.scriptures.length > 0 ? (
            <Text style={styles.refs}>Scriptures: {p.scriptures.join(', ')}</Text>
          ) : null}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 22, fontWeight: '700', color: '#0f172a', marginBottom: 4 },
  theme: { fontSize: 14, fontStyle: 'italic', color: '#475569', marginBottom: 8 },
  summary: { fontSize: 15, color: '#334155', marginBottom: 16 },
  point: { marginBottom: 16 },
  heading: { fontSize: 16, fontWeight: '600', color: '#0f172a', marginBottom: 4 },
  sub: { fontSize: 15, color: '#334155', marginLeft: 12, marginVertical: 2 },
  refs: { fontSize: 13, color: '#0369a1', marginTop: 4, marginLeft: 12 },
});
