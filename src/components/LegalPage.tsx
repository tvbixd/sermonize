import { Stack, useRouter } from 'expo-router';
import React, { useMemo } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Svg, Path } from 'react-native-svg';
import { type Colors, spacing, typography, useTheme } from '@/theme';

/** Simple in-app reader for terms/privacy text — no external site needed. */
export function LegalPage({ title, body }: { title: string; body: string }) {
  const router = useRouter();
  const t = useTheme();
  const styles = useMemo(() => makeStyles(t), [t]);

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={styles.navBar}>
        <TouchableOpacity
          onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}
          style={styles.navBack}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <Svg width={10} height={16} viewBox="0 0 10 16" fill="none">
            <Path d="M9 1L2 8l7 7" stroke={t.accentBlue} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
          </Svg>
          <Text style={[typography.body, { color: t.accentBlue }]}>Back</Text>
        </TouchableOpacity>
      </View>
      <ScrollView contentContainerStyle={styles.body}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.text}>{body}</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

function makeStyles(t: Colors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: t.bgPrimary },
    navBar: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: spacing.md,
      height: 44,
    },
    navBack: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    body: { padding: spacing.md, paddingBottom: spacing.xl },
    title: { ...typography.title2, color: t.textPrimary, marginBottom: spacing.md },
    text: { ...typography.subhead, color: t.textPrimary, lineHeight: 22 },
  });
}
