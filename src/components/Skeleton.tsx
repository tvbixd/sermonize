import React, { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';
import { useTheme } from '@/theme';

type Props = { width?: number | string; height?: number; radius?: number };

export function Skeleton({ width = '100%', height = 16, radius = 8 }: Props) {
  const t = useTheme();
  const opacity = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 1, duration: 800, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.3, duration: 800, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ]),
    );
    anim.start();
    return () => anim.stop();
  }, [opacity]);

  return (
    <Animated.View
      style={[
        { width: width as number, height, borderRadius: radius, backgroundColor: t.textTertiary, opacity },
      ]}
    />
  );
}

export function SermonCardSkeleton() {
  return (
    <View style={styles.card}>
      <View style={styles.row}>
        <View style={{ flex: 1, gap: 8 }}>
          <Skeleton width="70%" height={18} />
          <Skeleton width="40%" height={14} />
        </View>
      </View>
      <View style={styles.divider} />
      <View style={styles.row}>
        <View style={{ flex: 1, gap: 8 }}>
          <Skeleton width="60%" height={18} />
          <Skeleton width="35%" height={14} />
        </View>
      </View>
      <View style={styles.divider} />
      <View style={styles.row}>
        <View style={{ flex: 1, gap: 8 }}>
          <Skeleton width="80%" height={18} />
          <Skeleton width="45%" height={14} />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 16,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 16,
    minHeight: 62,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(0,0,0,0.06)',
    marginLeft: 16,
  },
});
