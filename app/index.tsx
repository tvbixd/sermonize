import { Redirect, useRouter } from 'expo-router';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Dimensions,
  FlatList,
  Linking,
  NativeScrollEvent,
  NativeSyntheticEvent,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MicIcon, WaveformIcon, CheckIcon } from '@/components/icons';
import { getGroqKey } from '@/storage/keys';
import { type Colors, radius, spacing, typography, useTheme } from '@/theme';

const { width: SCREEN_W } = Dimensions.get('window');

type Slide = {
  icon: (t: Colors) => React.ReactNode;
  title: string;
  body: string;
};

const slides: Slide[] = [
  {
    icon: (t) => <MicIcon size={40} color="#fff" />,
    title: 'Record your sermon',
    body: 'Hit record during the sermon and Sermonize captures every word automatically.',
  },
  {
    icon: (t) => <WaveformIcon size={40} color="#fff" />,
    title: 'AI-powered outlines',
    body: 'Get a structured outline with key points, themes, and scripture references — all generated in real time.',
  },
  {
    icon: (t) => <CheckIcon size={40} color="#fff" />,
    title: 'One quick setup step',
    body: 'Sermonize uses Groq for fast AI processing. Create a free API key (no credit card) and paste it in Settings.',
  },
];

export default function Root() {
  const [checked, setChecked] = useState(false);
  const [hasKey, setHasKey] = useState(false);
  const [page, setPage] = useState(0);
  const router = useRouter();
  const t = useTheme();
  const styles = useMemo(() => makeStyles(t), [t]);
  const listRef = useRef<FlatList>(null);

  useEffect(() => {
    void (async () => {
      const key = await getGroqKey();
      setHasKey(!!key);
      setChecked(true);
    })();
  }, []);

  if (!checked) return null;
  if (hasKey) return <Redirect href="/folders" />;

  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const idx = Math.round(e.nativeEvent.contentOffset.x / SCREEN_W);
    setPage(idx);
  };

  const advance = () => {
    if (page < slides.length - 1) {
      listRef.current?.scrollToIndex({ index: page + 1, animated: true });
    }
  };

  const isLast = page === slides.length - 1;

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <FlatList
        ref={listRef}
        data={slides}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onScroll={onScroll}
        scrollEventThrottle={16}
        keyExtractor={(_, i) => String(i)}
        renderItem={({ item }) => (
          <View style={styles.slide}>
            <View style={styles.iconWrap}>{item.icon(t)}</View>
            <Text style={styles.slideTitle}>{item.title}</Text>
            <Text style={styles.slideBody}>{item.body}</Text>
          </View>
        )}
      />

      {/* Page dots */}
      <View style={styles.dots}>
        {slides.map((_, i) => (
          <View
            key={i}
            style={[styles.dot, i === page && styles.dotActive]}
          />
        ))}
      </View>

      {/* Bottom actions */}
      <View style={styles.bottom}>
        {isLast ? (
          <>
            <TouchableOpacity
              style={styles.primaryBtn}
              activeOpacity={0.85}
              onPress={() => void Linking.openURL('https://console.groq.com')}
            >
              <Text style={styles.primaryBtnText}>Get Free Groq Key</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.secondaryBtn}
              activeOpacity={0.85}
              onPress={() => router.push('/settings')}
            >
              <Text style={styles.secondaryBtnText}>I have a key — go to Settings</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.skipBtn}
              activeOpacity={0.7}
              onPress={() => router.replace('/folders')}
            >
              <Text style={styles.skipBtnText}>Skip for now</Text>
            </TouchableOpacity>
          </>
        ) : (
          <>
            <TouchableOpacity
              style={styles.primaryBtn}
              activeOpacity={0.85}
              onPress={advance}
            >
              <Text style={styles.primaryBtnText}>Next</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.skipBtn}
              activeOpacity={0.7}
              onPress={() => router.replace('/folders')}
            >
              <Text style={styles.skipBtnText}>Skip</Text>
            </TouchableOpacity>
          </>
        )}
      </View>
    </SafeAreaView>
  );
}

function makeStyles(t: Colors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: t.bgPrimary },

    slide: {
      width: SCREEN_W,
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: spacing.xl,
    },
    iconWrap: {
      width: 88,
      height: 88,
      borderRadius: 44,
      backgroundColor: t.accentBlue,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: spacing.lg,
      shadowColor: t.cardShadow,
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 1,
      shadowRadius: 20,
      elevation: 8,
    },
    slideTitle: {
      fontSize: 28,
      fontWeight: '700',
      color: t.textPrimary,
      textAlign: 'center',
      letterSpacing: -0.3,
      marginBottom: spacing.md,
    },
    slideBody: {
      ...typography.body,
      color: t.textSecondary,
      textAlign: 'center',
      lineHeight: 24,
      maxWidth: 320,
    },

    dots: {
      flexDirection: 'row',
      justifyContent: 'center',
      gap: 8,
      paddingBottom: spacing.lg,
    },
    dot: {
      width: 8,
      height: 8,
      borderRadius: 4,
      backgroundColor: t.textTertiary,
    },
    dotActive: {
      backgroundColor: t.accentBlue,
      width: 24,
    },

    bottom: {
      paddingHorizontal: spacing.lg,
      paddingBottom: spacing.md,
      gap: 12,
    },
    primaryBtn: {
      backgroundColor: t.accentBlue,
      height: 54,
      borderRadius: radius.pill,
      alignItems: 'center',
      justifyContent: 'center',
    },
    primaryBtnText: { ...typography.headline, color: '#fff', fontSize: 18 },
    secondaryBtn: {
      height: 50,
      borderRadius: radius.pill,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1.5,
      borderColor: t.accentBlue,
    },
    secondaryBtnText: { ...typography.headline, color: t.accentBlue },
    skipBtn: { alignItems: 'center', paddingVertical: spacing.sm },
    skipBtnText: { ...typography.subhead, color: t.textSecondary },
  });
}
