import { Stack, useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useMemo, useState } from 'react';
import {
  ActionSheetIOS,
  Alert,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { deleteSermon, listSermons, saveSermon } from '@/storage/sermons';
import { type Colors, radius, spacing, typography, useTheme } from '@/theme';
import type { Sermon } from '@/types';
import { formatDate, formatElapsed } from '@/util/format';
import { BackChevronIcon, ChevronIcon, MicIcon, WaveformIcon } from '@/components/icons';

type Section = { title: string; data: Sermon[] };

function groupSermons(sermons: Sermon[]): Section[] {
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const sevenDaysAgo = todayStart.getTime() - 6 * 86400000;

  const pinned = sermons.filter((s) => s.pinned);
  const unpinned = sermons.filter((s) => !s.pinned);

  const today: Sermon[] = [];
  const week: Sermon[] = [];
  const earlier: Sermon[] = [];

  for (const s of unpinned) {
    if (s.createdAt >= todayStart.getTime()) today.push(s);
    else if (s.createdAt >= sevenDaysAgo) week.push(s);
    else earlier.push(s);
  }

  return [
    pinned.length > 0 && { title: 'Pinned', data: pinned },
    today.length > 0 && { title: 'Today', data: today },
    week.length > 0 && { title: 'Previous 7 Days', data: week },
    earlier.length > 0 && { title: 'Earlier', data: earlier },
  ].filter(Boolean) as Section[];
}

export default function SermonsScreen() {
  const { folderId, folderName } = useLocalSearchParams<{ folderId?: string; folderName?: string }>();
  const [sermons, setSermons] = useState<Sermon[]>([]);
  const router = useRouter();
  const t = useTheme();
  const styles = useMemo(() => makeStyles(t), [t]);

  const refresh = useCallback(async () => {
    const all = await listSermons();
    const filtered = folderId ? all.filter((s) => s.folderId === folderId) : all;
    setSermons(filtered);
  }, [folderId]);

  useFocusEffect(useCallback(() => { void refresh(); }, [refresh]));

  const onPin = async (s: Sermon) => {
    await saveSermon({ ...s, pinned: !s.pinned });
    await refresh();
  };

  const onDelete = (s: Sermon) => {
    Alert.alert('Delete sermon?', s.title, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => { await deleteSermon(s.id); await refresh(); } },
    ]);
  };

  const showContextMenu = (s: Sermon) => {
    const pinLabel = s.pinned ? 'Unpin' : 'Pin to Top';
    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        { options: [pinLabel, 'Edit', 'Delete', 'Cancel'], destructiveButtonIndex: 2, cancelButtonIndex: 3, title: s.title },
        (idx) => {
          if (idx === 0) void onPin(s);
          else if (idx === 1) router.push(`/sermon/${s.id}`);
          else if (idx === 2) onDelete(s);
        },
      );
    } else {
      Alert.alert(s.title, 'Choose action', [
        { text: pinLabel, onPress: () => void onPin(s) },
        { text: 'Edit', onPress: () => router.push(`/sermon/${s.id}`) },
        { text: 'Delete', style: 'destructive', onPress: () => onDelete(s) },
        { text: 'Cancel', style: 'cancel' },
      ]);
    }
  };

  const sections = groupSermons(sermons);
  const title = folderName ?? 'All Sermons';
  const total = sermons.length;

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <Stack.Screen options={{ headerShown: false }} />

      {/* Nav bar */}
      <View style={styles.navBar}>
        <TouchableOpacity onPress={() => router.back()} style={styles.navBack} hitSlop={8}>
          <BackChevronIcon color={t.accentBlue} size={20} />
          <Text style={[styles.navText, { color: t.accentBlue }]}>Folders</Text>
        </TouchableOpacity>
      </View>

      {/* Large title */}
      <View style={styles.titleRow}>
        <Text style={styles.largeTitle}>{title}</Text>
      </View>

      {sermons.length === 0 ? (
        <View style={styles.empty}>
          <View style={styles.emptyIcon}>
            <WaveformIcon size={56} color={t.textTertiary} />
          </View>
          <Text style={styles.emptyTitle}>No sermons yet</Text>
          <Text style={styles.emptySub}>{'Tap the mic to record\nyour first sermon'}</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.listContent}>
          <Text style={styles.subtitle}>
            {total} {total === 1 ? 'recording' : 'recordings'}
          </Text>
          {sections.map((section) => (
            <View key={section.title}>
              <Text style={styles.sectionHeader}>{section.title}</Text>
              <View style={styles.card}>
                {section.data.map((item, index) => {
                  const isLast = index === section.data.length - 1;
                  return (
                    <TouchableOpacity
                      key={item.id}
                      style={[styles.row, !isLast && styles.rowBorder]}
                      onPress={() => router.push(`/sermon/${item.id}`)}
                      onLongPress={() => showContextMenu(item)}
                      activeOpacity={0.7}
                    >
                      <View style={styles.rowContent}>
                        <View style={styles.rowTop}>
                          <Text style={styles.rowTitle} numberOfLines={1}>{item.title}</Text>
                          {item.pinned && <Text style={styles.pin}>📌</Text>}
                        </View>
                        <Text style={styles.rowMeta}>
                          {formatDate(item.createdAt)} · {formatElapsed(item.durationMs)}
                        </Text>
                      </View>
                      <ChevronIcon color={t.textTertiary} size={12} />
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          ))}
        </ScrollView>
      )}

      <TouchableOpacity style={styles.fab} activeOpacity={0.85} onPress={() => router.push('/record')}>
        <MicIcon size={28} color="#fff" />
      </TouchableOpacity>
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
      paddingTop: spacing.md,
      paddingBottom: spacing.xs,
    },
    navBack: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    navText: { ...typography.body },

    titleRow: { paddingHorizontal: 20, paddingTop: spacing.sm, paddingBottom: 2 },
    largeTitle: { ...typography.largeTitle, color: t.textPrimary },

    listContent: { paddingBottom: 100 },
    subtitle: {
      ...typography.subhead,
      color: t.textSecondary,
      paddingHorizontal: 20,
      paddingTop: 2,
      paddingBottom: spacing.md,
    },
    sectionHeader: {
      ...typography.sectionHeader,
      color: t.textSecondary,
      paddingTop: 20,
      paddingBottom: spacing.sm,
      paddingHorizontal: spacing.xl,
    },

    card: {
      backgroundColor: t.bgSurface,
      borderRadius: radius.card,
      marginHorizontal: spacing.md,
      overflow: 'hidden',
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: spacing.md,
      paddingVertical: 14,
      minHeight: 62,
      gap: spacing.sm,
    },
    rowBorder: { borderBottomWidth: 0.5, borderBottomColor: t.separator },
    rowContent: { flex: 1 },
    rowTop: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginBottom: spacing.xs },
    rowTitle: { ...typography.headline, color: t.textPrimary, flex: 1 },
    pin: { fontSize: 12 },
    rowMeta: { ...typography.footnote, color: t.textSecondary },

    empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl, gap: 20 },
    emptyIcon: {
      width: 104, height: 104, borderRadius: 52,
      backgroundColor: t.emptyBg, alignItems: 'center', justifyContent: 'center',
    },
    emptyTitle: { ...typography.title2, color: t.textPrimary },
    emptySub: { ...typography.subhead, color: t.textSecondary, textAlign: 'center', lineHeight: 22 },

    fab: {
      position: 'absolute', bottom: 32, right: spacing.lg,
      width: 64, height: 64, borderRadius: 32,
      backgroundColor: t.accentRed, alignItems: 'center', justifyContent: 'center',
      shadowColor: t.accentRed, shadowOpacity: 0.38, shadowRadius: 12, shadowOffset: { width: 0, height: 8 },
      elevation: 6,
    },
  });
}
