import { Stack, useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useMemo, useState } from 'react';
import {
  Alert,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { listFolders } from '@/storage/folders';
import {
  deleteSermon,
  listDeletedSermons,
  listDraftSermons,
  listSermons,
  restoreSermon,
  saveSermon,
  softDeleteSermon,
} from '@/storage/sermons';
import { type Colors, radius, spacing, typography, useTheme } from '@/theme';
import type { Folder, Sermon } from '@/types';
import { formatDate, formatElapsed } from '@/util/format';
import { BackChevronIcon, ChevronIcon, FolderIcon, MicIcon, TrashIcon, WaveformIcon } from '@/components/icons';

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
  const { folderId, folderName, isDeleted, isDrafts } = useLocalSearchParams<{
    folderId?: string;
    folderName?: string;
    isDeleted?: string;
    isDrafts?: string;
  }>();
  const isTrash = isDeleted === 'true';
  const isDraftView = isDrafts === 'true';
  const [sermons, setSermons] = useState<Sermon[]>([]);
  const [folders, setFolders] = useState<Folder[]>([]);
  const [menuSermon, setMenuSermon] = useState<Sermon | null>(null);
  const [showFolderPicker, setShowFolderPicker] = useState(false);
  const [search, setSearch] = useState('');
  const router = useRouter();
  const t = useTheme();
  const styles = useMemo(() => makeStyles(t), [t]);

  const refresh = useCallback(async () => {
    if (isTrash) {
      setSermons(await listDeletedSermons());
    } else if (isDraftView) {
      setSermons(await listDraftSermons());
    } else {
      const all = await listSermons();
      const filtered = folderId ? all.filter((s) => s.folderId === folderId) : all;
      setSermons(filtered);
    }
    setFolders(await listFolders());
  }, [folderId, isTrash, isDraftView]);

  useFocusEffect(useCallback(() => { void refresh(); }, [refresh]));

  const filtered = search.trim()
    ? sermons.filter((s) =>
        s.title.toLowerCase().includes(search.toLowerCase()) ||
        s.transcript.toLowerCase().includes(search.toLowerCase()))
    : sermons;

  const onPin = async (s: Sermon) => {
    await saveSermon({ ...s, pinned: !s.pinned });
    setMenuSermon(null);
    await refresh();
  };

  const onSoftDelete = async (s: Sermon) => {
    setMenuSermon(null);
    await softDeleteSermon(s.id);
    await refresh();
  };

  const onRestore = async (s: Sermon) => {
    await restoreSermon(s.id);
    await refresh();
  };

  const onPermanentDelete = (s: Sermon) => {
    Alert.alert('Delete permanently?', `"${s.title}" will be permanently removed.`, [
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

  const onFinishDraft = async (s: Sermon) => {
    await saveSermon({ ...s, isDraft: false });
    await refresh();
    router.push(`/sermon/${s.id}`);
  };

  const onMoveToFolder = async (s: Sermon, targetFolderId: string | undefined) => {
    await saveSermon({ ...s, folderId: targetFolderId });
    setShowFolderPicker(false);
    setMenuSermon(null);
    await refresh();
  };

  const sections = groupSermons(filtered);
  const title = folderName ?? (isTrash ? 'Recently Deleted' : isDraftView ? 'Drafts' : 'All Sermons');
  const total = filtered.length;
  const isSpecial = isTrash || isDraftView;

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

      {/* Search bar */}
      {!isSpecial && sermons.length > 0 && (
        <View style={styles.searchWrap}>
          <TextInput
            style={styles.searchInput}
            placeholder="Search sermons..."
            placeholderTextColor={t.textTertiary}
            value={search}
            onChangeText={setSearch}
            clearButtonMode="while-editing"
            autoCapitalize="none"
            autoCorrect={false}
          />
        </View>
      )}

      {filtered.length === 0 ? (
        <View style={styles.empty}>
          <View style={styles.emptyIcon}>
            {isTrash
              ? <TrashIcon size={56} color={t.textTertiary} />
              : <WaveformIcon size={56} color={t.textTertiary} />}
          </View>
          <Text style={styles.emptyTitle}>
            {isTrash ? 'Nothing here' : isDraftView ? 'No drafts' : search ? 'No results' : 'No sermons yet'}
          </Text>
          <Text style={styles.emptySub}>
            {isTrash
              ? 'Deleted sermons will appear here.'
              : isDraftView
              ? 'Discarded recordings saved as drafts\nwill appear here.'
              : search
              ? `No sermons match "${search}"`
              : 'Tap the mic to record\nyour first sermon'}
          </Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.listContent}>
          <Text style={styles.subtitle}>
            {total} {total === 1 ? 'recording' : 'recordings'}
          </Text>

          {isTrash ? (
            <View style={[styles.card, { marginHorizontal: spacing.md }]}>
              {filtered.map((item, index) => {
                const isLast = index === filtered.length - 1;
                return (
                  <View key={item.id} style={[styles.row, !isLast && styles.rowBorder]}>
                    <View style={styles.rowContent}>
                      <Text style={styles.rowTitle} numberOfLines={1}>{item.title}</Text>
                      <Text style={styles.rowMeta}>{formatDate(item.createdAt)}</Text>
                    </View>
                    <TouchableOpacity onPress={() => onRestore(item)} hitSlop={6}>
                      <Text style={styles.restoreBtn}>Restore</Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => onPermanentDelete(item)} hitSlop={6}>
                      <TrashIcon size={18} color={t.accentRed} />
                    </TouchableOpacity>
                  </View>
                );
              })}
            </View>
          ) : isDraftView ? (
            <View style={[styles.card, { marginHorizontal: spacing.md }]}>
              {filtered.map((item, index) => {
                const isLast = index === filtered.length - 1;
                return (
                  <View key={item.id} style={[styles.row, !isLast && styles.rowBorder]}>
                    <View style={styles.rowContent}>
                      <Text style={styles.rowTitle} numberOfLines={1}>{item.title}</Text>
                      <Text style={styles.rowMeta}>
                        {formatDate(item.createdAt)} · {formatElapsed(item.durationMs)}
                      </Text>
                    </View>
                    <TouchableOpacity onPress={() => onFinishDraft(item)} hitSlop={6}>
                      <Text style={styles.restoreBtn}>Finish</Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => onPermanentDelete(item)} hitSlop={6}>
                      <TrashIcon size={18} color={t.accentRed} />
                    </TouchableOpacity>
                  </View>
                );
              })}
            </View>
          ) : (
            sections.map((section) => (
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
                        onLongPress={() => setMenuSermon(item)}
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
            ))
          )}
        </ScrollView>
      )}

      {!isSpecial && (
        <TouchableOpacity style={styles.fab} activeOpacity={0.85} onPress={() => router.push('/record')}>
          <MicIcon size={28} color="#fff" />
        </TouchableOpacity>
      )}

      {/* Context menu bottom sheet */}
      <Modal visible={!!menuSermon} transparent animationType="slide" onRequestClose={() => setMenuSermon(null)}>
        <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={() => setMenuSermon(null)}>
          <View style={styles.sheet}>
            <View style={styles.grabHandle} />
            <Text style={styles.sheetTitle} numberOfLines={1}>{menuSermon?.title}</Text>

            <TouchableOpacity style={styles.sheetRow} onPress={() => { if (menuSermon) { router.push(`/sermon/${menuSermon.id}`); setMenuSermon(null); } }}>
              <Text style={styles.sheetRowText}>Open</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.sheetRow} onPress={() => { if (menuSermon) void onPin(menuSermon); }}>
              <Text style={styles.sheetRowText}>{menuSermon?.pinned ? 'Unpin' : 'Pin to Top'}</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.sheetRow} onPress={() => { setShowFolderPicker(true); }}>
              <Text style={styles.sheetRowText}>Move to Folder</Text>
            </TouchableOpacity>

            <View style={styles.sheetDivider} />

            <TouchableOpacity style={styles.sheetRow} onPress={() => { if (menuSermon) void onSoftDelete(menuSermon); }}>
              <Text style={[styles.sheetRowText, { color: t.accentRed }]}>Delete</Text>
            </TouchableOpacity>

            <TouchableOpacity style={[styles.sheetRow, styles.sheetCancel]} onPress={() => setMenuSermon(null)}>
              <Text style={[styles.sheetRowText, { fontWeight: '600' }]}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Folder picker sheet */}
      <Modal visible={showFolderPicker} transparent animationType="slide" onRequestClose={() => setShowFolderPicker(false)}>
        <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={() => setShowFolderPicker(false)}>
          <View style={styles.sheet}>
            <View style={styles.grabHandle} />
            <Text style={styles.sheetTitle}>Move to Folder</Text>

            <TouchableOpacity
              style={styles.sheetRow}
              onPress={() => { if (menuSermon) void onMoveToFolder(menuSermon, undefined); }}
            >
              <FolderIcon kind="all" size={22} color={t.accentBlue} />
              <Text style={styles.sheetRowText}>All Sermons</Text>
              {!menuSermon?.folderId && <Text style={styles.checkMark}>✓</Text>}
            </TouchableOpacity>

            {folders.map((f) => (
              <TouchableOpacity
                key={f.id}
                style={styles.sheetRow}
                onPress={() => { if (menuSermon) void onMoveToFolder(menuSermon, f.id); }}
              >
                <FolderIcon kind="folder" size={22} color={f.color} />
                <Text style={styles.sheetRowText}>{f.name}</Text>
                {menuSermon?.folderId === f.id && <Text style={styles.checkMark}>✓</Text>}
              </TouchableOpacity>
            ))}

            <TouchableOpacity style={[styles.sheetRow, styles.sheetCancel]} onPress={() => setShowFolderPicker(false)}>
              <Text style={[styles.sheetRowText, { fontWeight: '600' }]}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
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

    searchWrap: { paddingHorizontal: spacing.md, paddingTop: spacing.sm, paddingBottom: spacing.xs },
    searchInput: {
      backgroundColor: t.bgSurface,
      borderRadius: radius.small,
      paddingHorizontal: 14,
      paddingVertical: 10,
      ...typography.subhead,
      color: t.textPrimary,
      borderWidth: 0.5,
      borderColor: t.separator,
    },

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
    restoreBtn: { ...typography.subhead, color: t.accentBlue, fontWeight: '600', marginRight: spacing.sm },

    empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl },
    emptyIcon: {
      width: 104, height: 104, borderRadius: 52,
      backgroundColor: t.emptyBg, alignItems: 'center', justifyContent: 'center',
      marginBottom: 16,
    },
    emptyTitle: { ...typography.title2, color: t.textPrimary, marginBottom: 4 },
    emptySub: { ...typography.subhead, color: t.textSecondary, textAlign: 'center', lineHeight: 22 },

    fab: {
      position: 'absolute', bottom: 32, right: spacing.lg,
      width: 64, height: 64, borderRadius: 32,
      backgroundColor: t.accentRed, alignItems: 'center', justifyContent: 'center',
      shadowColor: t.accentRed, shadowOpacity: 0.38, shadowRadius: 12, shadowOffset: { width: 0, height: 8 },
      elevation: 6,
    },

    overlay: { flex: 1, backgroundColor: t.dimOverlay, justifyContent: 'flex-end' },
    sheet: {
      backgroundColor: t.bgSurface,
      borderTopLeftRadius: 14,
      borderTopRightRadius: 14,
      paddingBottom: 34,
    },
    grabHandle: {
      width: 36, height: 5, borderRadius: 3,
      backgroundColor: t.textTertiary,
      alignSelf: 'center',
      marginTop: spacing.sm,
      marginBottom: spacing.sm,
    },
    sheetTitle: {
      ...typography.headline,
      color: t.textPrimary,
      textAlign: 'center',
      paddingHorizontal: spacing.md,
      paddingBottom: spacing.sm,
    },
    sheetRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      paddingHorizontal: spacing.lg,
      paddingVertical: 14,
    },
    sheetRowText: { ...typography.body, color: t.textPrimary, flex: 1 },
    sheetDivider: { height: StyleSheet.hairlineWidth, backgroundColor: t.separator, marginHorizontal: spacing.lg, marginVertical: 4 },
    sheetCancel: { marginTop: spacing.xs },
    checkMark: { ...typography.body, color: t.accentBlue, fontWeight: '600' },
  });
}
