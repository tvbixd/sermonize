import { Redirect, useRouter } from 'expo-router';
import React, { useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MicIcon, WaveformIcon } from '@/components/icons';
import { getGroqKey } from '@/storage/keys';
import { type Colors, radius, spacing, typography, useTheme } from '@/theme';

export default function Root() {
  const [checked, setChecked] = useState(false);
  const [hasKey, setHasKey] = useState(false);
  const router = useRouter();
  const t = useTheme();
  const styles = useMemo(() => makeStyles(t), [t]);

  useEffect(() => {
    void (async () => {
      const key = await getGroqKey();
      setHasKey(!!key);
      setChecked(true);
    })();
  }, []);

  if (!checked) return null;
  if (hasKey) return <Redirect href="/folders" />;

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <View style={styles.iconWrap}>
          <MicIcon size={48} color={t.accentRed} />
        </View>
        <Text style={styles.title}>Welcome to Sermonize</Text>
        <Text style={styles.subtitle}>
          Record sermons and get AI-powered outlines{'\n'}with Bible scriptures — completely free.
        </Text>

        <View style={styles.steps}>
          <View style={styles.step}>
            <Text style={styles.stepNum}>1</Text>
            <View style={styles.stepContent}>
              <Text style={styles.stepTitle}>Get a free Groq API key</Text>
              <Text style={styles.stepDesc}>Visit console.groq.com — no credit card needed.</Text>
            </View>
          </View>
          <View style={styles.step}>
            <Text style={styles.stepNum}>2</Text>
            <View style={styles.stepContent}>
              <Text style={styles.stepTitle}>Paste it in Settings</Text>
              <Text style={styles.stepDesc}>Your key is stored securely on this device only.</Text>
            </View>
          </View>
          <View style={styles.step}>
            <Text style={styles.stepNum}>3</Text>
            <View style={styles.stepContent}>
              <Text style={styles.stepTitle}>Start recording</Text>
              <Text style={styles.stepDesc}>Tap the mic and let AI do the note-taking.</Text>
            </View>
          </View>
        </View>
      </View>

      <View style={styles.bottom}>
        <TouchableOpacity
          style={styles.primaryBtn}
          activeOpacity={0.85}
          onPress={() => router.push('/settings')}
        >
          <Text style={styles.primaryBtnText}>Set Up API Key</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.skipBtn}
          activeOpacity={0.7}
          onPress={() => router.replace('/folders')}
        >
          <Text style={styles.skipBtnText}>Skip for now</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

function makeStyles(t: Colors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: t.bgPrimary },
    content: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.lg },

    iconWrap: {
      width: 96, height: 96, borderRadius: 48,
      backgroundColor: t.emptyBg,
      alignItems: 'center', justifyContent: 'center',
      marginBottom: spacing.lg,
    },
    title: { ...typography.title2, color: t.textPrimary, marginBottom: spacing.sm, textAlign: 'center' },
    subtitle: { ...typography.subhead, color: t.textSecondary, textAlign: 'center', lineHeight: 22, marginBottom: 36 },

    steps: { width: '100%', gap: 16 },
    step: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 14,
      backgroundColor: t.bgSurface,
      borderRadius: radius.card,
      padding: 16,
    },
    stepNum: {
      width: 28, height: 28, borderRadius: 14,
      backgroundColor: t.accentBlue,
      color: '#fff',
      fontWeight: '700',
      fontSize: 14,
      textAlign: 'center',
      lineHeight: 28,
      overflow: 'hidden',
    },
    stepContent: { flex: 1 },
    stepTitle: { ...typography.headline, color: t.textPrimary, marginBottom: 2 },
    stepDesc: { ...typography.footnote, color: t.textSecondary, lineHeight: 18 },

    bottom: { paddingHorizontal: spacing.lg, paddingBottom: spacing.md, gap: 10 },
    primaryBtn: {
      backgroundColor: t.accentBlue,
      height: 52,
      borderRadius: radius.button,
      alignItems: 'center',
      justifyContent: 'center',
    },
    primaryBtnText: { ...typography.headline, color: '#fff' },
    skipBtn: { alignItems: 'center', paddingVertical: spacing.sm },
    skipBtnText: { ...typography.subhead, color: t.textSecondary },
  });
}
