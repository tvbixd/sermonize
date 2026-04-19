import { Link, Stack, useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useMemo, useState } from 'react';
import {
  Alert,
  SectionList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { deleteSermon, listSermons } from '@/storage/sermons';
import { type Colors, radius, spacing, typography, useTheme } from '@/theme';
import type { Sermon } from '@/types';
import { formatDate, formatElapsed } from '@/util/format';

type Section = { title: string; data: Sermon[] };

function groupSermons(sermons: Sermon[]): Section[] {
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const sevenDaysAgo = todayStart.getTime() - 6 * 86400000;

  const today: Sermon[] = [];
  const week: Sermon[] = [];
  const earlier: Sermon[] = [];

  for (const s of sermons) {
    if (s.createdAt >= todayStart.getTime()) today.push(s);
    else if (s.createdAt >= sevenDaysAgo) week.push(s);
    else earlier.push(s);
  }

  return [
    today.length > 0 && { title: 'Today', data: today },
    week.length > 0 && { title: 'Previous 7 Days', data: week },
    earlier.length > 0 && { title: 'Earlier', data: earlier },
  ].filter(Boolean) as Section[];
}

export default function HomeScreen() {
  const [sermons, setSermons] = useState<Sermon[]>([]);
  const router = useRouter();
  const t = useTheme();
  const styles = useMemo(() => makeStyles(t), [t]);

  const refresh = useCallback(async () => {
    const items = await listSermons();
    setSermons(items);
  }, []);

  useFocusEffect(
    useCallback(() => {
      void refresh();
    }, [refresh]),
  );

  const onDelete = (s: Sermon) => {
    Alert.alert('Delete sermon?', s.title, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await deleteSermon(s.id);
          await refresh();
        },
      },
    ]);
  };

  const sections = groupSermons(sermons);

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <Stack.Screen
        options={{
          headerStyle: { backgroundColor: t.bgSurface },
          headerRight: () => (
            <Link href="/settings" asChild>
              <TouchableOpacity style={styles.settingsBtn} hitSlop={8}>
                <Text style={styles.settingsBtnText}>⚙</Text>
              </TouchableOpacity>
            </Link>
          ),
        }}
      />

      {sermons.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyTitle}>No sermons yet</Text>
          <Text style={styles.emptySub}>Tap the mic button to record your first sermon.</Text>
        </View>
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={(s) => s.id}
          contentContainerStyle={styles.list}
          stickySectionHeadersEnabled={false}
          renderSectionHeader={({ section }) => (
            <Text style={styles.sectionHeader}>{section.title}</Text>
          )}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.card}
              onPress={() => router.push(`/sermon/${item.id}`)}
              onLongPress={() => onDelete(item)}
              activeOpacity={0.7}
            >
              <Text style={styles.cardTitle} numberOfLines={2}>{item.title}</Text>
              <Text style={styles.cardMeta}>
                {formatDate(item.createdAt)} · {formatElapsed(item.durationMs)} · {item.outline.points.length} points
              </Text>
            </TouchableOpacity>
          )}
        />
      )}

      <Link href="/record" asChild>
        <TouchableOpacity style={styles.fab} activeOpacity={0.85}>
          <Text style={styles.fabIcon}>🎙</Text>
        </TouchableOpacity>
      </Link>
    </SafeAreaView>
  );
}

function makeStyles(t: Colors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: t.bgPrimary },
    settingsBtn: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
    settingsBtnText: { fontSize: 20 },

    list: { paddingHorizontal: spacing.md, paddingTop: spacing.sm, paddingBottom: 100 },
    sectionHeader: {
      ...typography.footnote,
      fontWeight: '600',
      color: t.textSecondary,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
      marginTop: spacing.lg,
      marginBottom: spacing.sm,
      marginLeft: spacing.xs,
    },

    card: {
      backgroundColor: t.bgSurface,
      borderRadius: radius.card,
      paddingHorizontal: spacing.md,
      paddingVertical: 14,
      marginBottom: spacing.sm,
      minHeight: spacing.rowMinHeight,
    },
    cardTitle: { ...typography.headline, color: t.textPrimary, marginBottom: spacing.xs },
    cardMeta: { ...typography.footnote, color: t.textSecondary },

    empty: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.xl },
    emptyTitle: { ...typography.title3, color: t.textSecondary, marginBottom: spacing.sm },
    emptySub: { ...typography.subhead, color: t.textSecondary, textAlign: 'center' },

    fab: {
      position: 'absolute',
      bottom: 32,
      right: spacing.lg,
      width: 60,
      height: 60,
      borderRadius: radius.fab,
      backgroundColor: t.accentRed,
      alignItems: 'center',
      justifyContent: 'center',
      shadowColor: '#000',
      shadowOpacity: 0.2,
      shadowRadius: 8,
      shadowOffset: { width: 0, height: 4 },
      elevation: 6,
    },
    fabIcon: { fontSize: 26 },
  });
}
