import { usePathname, useRouter } from 'expo-router';
import React, { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, Text, TouchableOpacity } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useSessionStore } from '@/state/sessionStore';
import { typography, useTheme } from '@/theme';

function formatTimer(ms: number): string {
  const totalSec = Math.floor(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = String(totalSec % 60).padStart(2, '0');
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${s}` : `${String(m).padStart(2, '0')}:${s}`;
}

/**
 * A persistent "Recording · 12:34" bar shown at the top of every screen while a
 * recording is in progress and the user is somewhere other than the record
 * screen. Tapping it returns to the record screen (where all controls live).
 */
export function RecordingBar() {
  const t = useTheme();
  const router = useRouter();
  const pathname = usePathname();
  const insets = useSafeAreaInsets();

  const status = useSessionStore((s) => s.status);
  const elapsedMs = useSessionStore((s) => s.elapsedMs);

  const pulse = useRef(new Animated.Value(1)).current;

  const active = status === 'recording' || status === 'paused';
  const onRecordScreen = pathname === '/record';
  const visible = active && !onRecordScreen;

  useEffect(() => {
    if (status !== 'recording') { pulse.setValue(1); return; }
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 0.3, duration: 700, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1, duration: 700, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ]),
    );
    anim.start();
    return () => anim.stop();
  }, [status]);

  if (!visible) return null;

  return (
    <TouchableOpacity
      activeOpacity={0.9}
      onPress={() => router.push('/record')}
      style={[styles.bar, { backgroundColor: t.accentRed, paddingTop: insets.top + 6 }]}
      accessibilityRole="button"
      accessibilityLabel={`Recording in progress, ${formatTimer(elapsedMs)}. Tap to return.`}
    >
      <Animated.View style={[styles.dot, { opacity: status === 'recording' ? pulse : 0.5 }]} />
      <Text style={styles.label}>
        {status === 'paused' ? 'Paused' : 'Recording'} · {formatTimer(elapsedMs)}
      </Text>
      <Text style={styles.tapHint}>Tap to return</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  bar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 1000,
    elevation: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  dot: { width: 9, height: 9, borderRadius: 5, backgroundColor: '#fff' },
  label: { ...typography.subhead, color: '#fff', fontWeight: '700' },
  tapHint: { ...typography.footnote, color: 'rgba(255,255,255,0.85)', marginLeft: 'auto' },
});
