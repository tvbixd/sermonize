import React, { useMemo } from 'react';
import { StyleSheet, Text } from 'react-native';
import { findScriptureMatches } from '@/services/scriptureRegex';
import { type Colors, useTheme } from '@/theme';

/**
 * The flowing live transcript shown while recording. Spoken scripture
 * references are replaced in place with their canonical form ("Romans 8:28")
 * and highlighted; the most recent words render brighter so the eye tracks the
 * live edge. Only the tail is shown — a full sermon transcript is never dumped
 * on screen.
 */
export function LiveTranscript({ text }: { text: string }) {
  const t = useTheme();
  const styles = useMemo(() => makeStyles(t), [t]);

  const segments = useMemo(() => {
    const TAIL = 600;
    const shown = text.length > TAIL ? '…' + text.slice(text.length - TAIL) : text;
    const matches = findScriptureMatches(shown);
    const parts: { key: string; s: string; kind: 'dim' | 'ref' | 'bright' }[] = [];
    let i = 0;
    let lastRefEnd = 0;
    matches.forEach((m, idx) => {
      if (m.start < i) return;
      if (m.start > i) parts.push({ key: `p${idx}`, s: shown.slice(i, m.start), kind: 'dim' });
      parts.push({ key: `r${idx}`, s: m.canonical, kind: 'ref' });
      i = m.end;
      lastRefEnd = i;
    });
    // The trailing run after the last reference is the "live edge" — brighten it.
    const trailing = shown.slice(i);
    if (trailing) parts.push({ key: 'tail', s: trailing, kind: lastRefEnd > 0 || matches.length ? 'bright' : 'dim' });
    if (parts.length === 0) parts.push({ key: 'all', s: shown, kind: 'dim' });
    return parts;
  }, [text]);

  return (
    <Text style={styles.base}>
      {segments.map((p) => (
        <Text
          key={p.key}
          style={p.kind === 'ref' ? styles.ref : p.kind === 'bright' ? styles.bright : styles.dim}
        >
          {p.s}
        </Text>
      ))}
    </Text>
  );
}

function makeStyles(t: Colors) {
  return StyleSheet.create({
    base: { fontSize: 17, lineHeight: 27 },
    dim: { color: t.textSecondary },
    bright: { color: t.textPrimary },
    ref: { color: t.accentBlue, fontWeight: '600' },
  });
}
