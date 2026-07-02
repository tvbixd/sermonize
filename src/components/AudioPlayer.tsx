import { Audio, type AVPlaybackStatus } from 'expo-av';
import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Svg, Path, Rect } from 'react-native-svg';
import { typography, useTheme } from '@/theme';

function formatMs(ms: number): string {
  const totalSec = Math.max(0, Math.floor(ms / 1000));
  const mm = Math.floor(totalSec / 60);
  const ss = String(totalSec % 60).padStart(2, '0');
  return `${mm}:${ss}`;
}

type Props = {
  /** Ordered chunk file URIs; played back-to-back as one recording. */
  uris: string[];
  /** Known total length (sermon.durationMs) for the progress bar. */
  totalDurationMs?: number;
};

/**
 * Sequential player for a sermon's audio chunks. Play/pause + progress;
 * chunks advance automatically so they feel like a single recording.
 */
export function AudioPlayer({ uris, totalDurationMs }: Props) {
  const t = useTheme();

  const soundRef = useRef<Audio.Sound | null>(null);
  const indexRef = useRef(0);
  const completedMsRef = useRef(0);
  const [playing, setPlaying] = useState(false);
  const [loading, setLoading] = useState(false);
  const [positionMs, setPositionMs] = useState(0);
  const [error, setError] = useState(false);

  useEffect(() => {
    return () => {
      void soundRef.current?.unloadAsync().catch(() => {});
    };
  }, []);

  const onStatus = (status: AVPlaybackStatus) => {
    if (!status.isLoaded) return;
    setPositionMs(completedMsRef.current + (status.positionMillis ?? 0));
    if (status.didJustFinish) {
      completedMsRef.current += status.durationMillis ?? status.positionMillis ?? 0;
      void playIndex(indexRef.current + 1);
    }
  };

  const playIndex = async (i: number) => {
    await soundRef.current?.unloadAsync().catch(() => {});
    soundRef.current = null;
    if (i >= uris.length) {
      // End of recording — reset to the start.
      indexRef.current = 0;
      completedMsRef.current = 0;
      setPositionMs(0);
      setPlaying(false);
      return;
    }
    indexRef.current = i;
    const { sound } = await Audio.Sound.createAsync(
      { uri: uris[i] },
      { shouldPlay: true, progressUpdateIntervalMillis: 250 },
      onStatus,
    );
    soundRef.current = sound;
    setPlaying(true);
  };

  const onToggle = async () => {
    try {
      setError(false);
      if (!soundRef.current) {
        setLoading(true);
        // allowsRecordingIOS routes audio to the earpiece — switch it off
        // for playback so the speaker is used.
        await Audio.setAudioModeAsync({ allowsRecordingIOS: false, playsInSilentModeIOS: true });
        await playIndex(0);
        setLoading(false);
        return;
      }
      const status = await soundRef.current.getStatusAsync();
      if (status.isLoaded && status.isPlaying) {
        await soundRef.current.pauseAsync();
        setPlaying(false);
      } else {
        await soundRef.current.playAsync();
        setPlaying(true);
      }
    } catch {
      setLoading(false);
      setPlaying(false);
      setError(true);
    }
  };

  const totalMs = Math.max(totalDurationMs ?? 0, positionMs);
  const progress = totalMs > 0 ? Math.min(1, positionMs / totalMs) : 0;

  return (
    <View style={[styles.card, { backgroundColor: t.bgSurfaceRaised, borderColor: t.separator }]}>
      <TouchableOpacity
        onPress={onToggle}
        style={[styles.playBtn, { backgroundColor: t.accentBlue }]}
        disabled={loading}
        accessibilityRole="button"
        accessibilityLabel={playing ? 'Pause audio' : 'Play sermon audio'}
      >
        {loading ? (
          <ActivityIndicator color="#fff" size="small" />
        ) : playing ? (
          <Svg width={16} height={16} viewBox="0 0 16 16">
            <Rect x="2.5" y="1" width="4" height="14" rx="1.5" fill="#fff" />
            <Rect x="9.5" y="1" width="4" height="14" rx="1.5" fill="#fff" />
          </Svg>
        ) : (
          <Svg width={16} height={16} viewBox="0 0 16 16">
            <Path d="M4 1.8 L14 8 L4 14.2 Z" fill="#fff" />
          </Svg>
        )}
      </TouchableOpacity>
      <View style={styles.right}>
        {error ? (
          <Text style={[typography.footnote, { color: t.accentRed }]}>
            Couldn't play audio — the file may have been removed.
          </Text>
        ) : (
          <>
            <View style={[styles.track, { backgroundColor: t.separator }]}>
              <View
                style={[styles.fill, { backgroundColor: t.accentBlue, width: `${progress * 100}%` }]}
              />
            </View>
            <View style={styles.times}>
              <Text style={[typography.caption, { color: t.textSecondary }]}>{formatMs(positionMs)}</Text>
              <Text style={[typography.caption, { color: t.textTertiary }]}>{formatMs(totalMs)}</Text>
            </View>
          </>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: 12,
    borderWidth: 0.5,
    padding: 12,
  },
  playBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  right: { flex: 1, gap: 6 },
  track: { height: 4, borderRadius: 2, overflow: 'hidden' },
  fill: { height: 4, borderRadius: 2 },
  times: { flexDirection: 'row', justifyContent: 'space-between' },
});
