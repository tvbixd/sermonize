import React, { useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';

/**
 * A live "listening" waveform. New input levels push in from the right and
 * scroll left, so it moves while the preacher speaks. Driven by `getLevel`
 * (0..1, from the recorder's metering); when metering is unavailable it still
 * shows a gentle idle shimmer so the screen never looks frozen.
 */
export function LiveWaveform({
  getLevel,
  active,
  color,
  bars = 28,
  height = 44,
}: {
  getLevel: () => number;
  active: boolean;
  color: string;
  bars?: number;
  height?: number;
}) {
  const [levels, setLevels] = useState<number[]>(() => new Array(bars).fill(0.05));
  const getLevelRef = useRef(getLevel);
  getLevelRef.current = getLevel;

  useEffect(() => {
    const id = setInterval(() => {
      setLevels((prev) => {
        const next = prev.slice(1);
        const raw = active ? getLevelRef.current() : 0;
        // A little jitter keeps quiet passages alive without faking loud audio.
        const shimmer = active ? 0.06 + Math.random() * 0.06 : 0.04;
        next.push(Math.max(shimmer, Math.min(1, raw)));
        return next;
      });
    }, 90);
    return () => clearInterval(id);
  }, [active]);

  return (
    <View style={[styles.row, { height }]} accessible={false} pointerEvents="none">
      {levels.map((l, i) => (
        <View
          key={i}
          style={[
            styles.bar,
            { height: Math.max(3, l * height), backgroundColor: color, opacity: active ? 0.55 + l * 0.45 : 0.3 },
          ]}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4 },
  bar: { width: 3, borderRadius: 2 },
});
