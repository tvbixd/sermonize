import { Link, Stack, useFocusEffect, useRouter } from 'expo-router';
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
import { deleteFolder, listFolders, saveFolder } from '@/storage/folders';
import { listSermons } from '@/storage/sermons';
import { type Colors, radius, spacing, typography, useTheme } from '@/theme';
import type { Folder, Sermon } from '@/types';
import { newId } from '@/util/id';

const FOLDER_COLORS = ['#0A84FF', '#FF9F0A', '#30B65B', '#FF453A', '#5E5CE6', '#FF375F'];

type FolderRow = {
  id: string;
  name: string;
  color: string;
  count: number;
  system?: boolean;
};

export default function FoldersScreen() {
  const router = useRouter();
  const t = useTheme();
  const styles = useMemo(() => makeStyles(t), [t]);

  const [folders, setFolders] = useState<Folder[]>([]);
  const [sermons, setSermons] = useState<Sermon[]>([]);
  const [showNew, setShowNew] = useState(false);
  const [editingFolder, setEditingFolder] = useState<Folder | null>(null);
  const [draftName, setDraftName] = useState('');
  const [draftColor, setDraftColor] = useState(FOLDER_COLORS[0]);

  const refresh = useCallback(async () => {
    const [f, s] = await Promise.all([listFolders(), listSermons()]);
    setFolders(f);
    setSermons(s);
  }, []);

  useFocusEffect(useCallback(() => { void refresh(); }, [refresh]));

  const countFor = (folderId?: string) =>
    folderId === undefined
      ? sermons.length
      : sermons.filter((s) => s.folderId === folderId).length;

  const openCreateModal = () => {
    setEditingFolder(null);
    setDraftName('');
    setDraftColor(FOLDER_COLORS[0]);
    setShowNew(true);
  };

  const openEditModal = (f: Folder) => {
    setEditingFolder(f);
    setDraftName(f.name);
    setDraftColor(f.color);
    setShowNew(true);
  };

  const onSaveFolder = async () => {
    const name = draftName.trim();
    if (!name) return;
    const folder: Folder = {
      id: editingFolder?.id ?? newId(),
      name,
      color: draftColor,
      createdAt: editingFolder?.createdAt ?? Date.now(),
    };
    await saveFolder(folder);
    setShowNew(false);
    await refresh();
  };

  const onDeleteFolder = (f: Folder) => {
    Alert.alert('Delete folder?', `"${f.name}" will be deleted. Sermons inside will move to All Sermons.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await deleteFolder(f.id);
          await refresh();
        },
      },
    ]);
  };

  const myFolders: FolderRow[] = folders.map((f) => ({
    id: f.id,
    name: f.name,
    color: f.color,
    count: countFor(f.id),
  }));

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <Stack.Screen
        options={{
          title: 'Folders',
          headerLargeTitle: true,
          headerLargeTitleStyle: { fontWeight: '700', color: t.textPrimary },
          headerStyle: { backgroundColor: t.bgSurface },
          headerRight: () => (
            <Link href="/settings" asChild>
              <TouchableOpacity hitSlop={8}>
                <Text style={styles.navBtn}>⚙</Text>
              </TouchableOpacity>
            </Link>
          ),
        }}
      />

      <ScrollView contentContainerStyle={styles.content}>

        {/* System: All Sermons */}
        <View style={styles.card}>
          <TouchableOpacity
            style={styles.row}
            onPress={() => router.push('/sermons')}
            activeOpacity={0.7}
          >
            <View style={[styles.folderIcon, { backgroundColor: t.accentBlue }]}>
              <Text style={styles.folderIconText}>📋</Text>
            </View>
            <Text style={styles.rowLabel}>All Sermons</Text>
            <Text style={styles.rowCount}>{countFor(undefined)}</Text>
            <Text style={styles.chevron}>›</Text>
          </TouchableOpacity>
        </View>

        {/* My Folders */}
        {myFolders.length > 0 && (
          <>
            <Text style={styles.sectionLabel}>MY FOLDERS</Text>
            <View style={styles.card}>
              {myFolders.map((f, i) => (
                <React.Fragment key={f.id}>
                  <TouchableOpacity
                    style={styles.row}
                    onPress={() => router.push({ pathname: '/sermons', params: { folderId: f.id, folderName: f.name } })}
                    onLongPress={() => openEditModal(folders.find((x) => x.id === f.id)!)}
                    activeOpacity={0.7}
                  >
                    <View style={[styles.folderIcon, { backgroundColor: f.color }]}>
                      <Text style={styles.folderIconText}>📁</Text>
                    </View>
                    <Text style={styles.rowLabel}>{f.name}</Text>
                    <Text style={styles.rowCount}>{f.count}</Text>
                    <Text style={styles.chevron}>›</Text>
                  </TouchableOpacity>
                  {i < myFolders.length - 1 && <View style={styles.divider} />}
                </React.Fragment>
              ))}
            </View>
          </>
        )}

        {/* System: Drafts / Recently Deleted */}
        <Text style={styles.sectionLabel}>SYSTEM</Text>
        <View style={styles.card}>
          <TouchableOpacity style={styles.row} onPress={() => router.push({ pathname: '/sermons', params: { folderName: 'Drafts' } })} activeOpacity={0.7}>
            <View style={[styles.folderIcon, { backgroundColor: t.textSecondary }]}>
              <Text style={styles.folderIconText}>📝</Text>
            </View>
            <Text style={styles.rowLabel}>Drafts</Text>
            <Text style={styles.chevron}>›</Text>
          </TouchableOpacity>
          <View style={styles.divider} />
          <TouchableOpacity style={styles.row} activeOpacity={0.7}>
            <View style={[styles.folderIcon, { backgroundColor: t.textSecondary }]}>
              <Text style={styles.folderIconText}>🗑</Text>
            </View>
            <Text style={styles.rowLabel}>Recently Deleted</Text>
            <Text style={styles.chevron}>›</Text>
          </TouchableOpacity>
        </View>

      </ScrollView>

      {/* New Folder button */}
      <View style={styles.bottomBar}>
        <TouchableOpacity style={styles.newFolderBtn} onPress={openCreateModal} activeOpacity={0.7}>
          <Text style={styles.newFolderIcon}>📁</Text>
          <Text style={styles.newFolderText}>New Folder</Text>
        </TouchableOpacity>
      </View>

      {/* FAB mic */}
      <Link href="/record" asChild>
        <TouchableOpacity style={styles.fab} activeOpacity={0.85}>
          <Text style={styles.fabIcon}>🎙</Text>
        </TouchableOpacity>
      </Link>

      {/* New/Edit Folder modal */}
      <Modal visible={showNew} transparent animationType="slide" onRequestClose={() => setShowNew(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <View style={styles.grabHandle} />
            <View style={styles.modalHeader}>
              <TouchableOpacity onPress={() => setShowNew(false)}>
                <Text style={styles.modalCancel}>Cancel</Text>
              </TouchableOpacity>
              <Text style={styles.modalTitle}>{editingFolder ? 'Edit Folder' : 'New Folder'}</Text>
              <TouchableOpacity onPress={onSaveFolder}>
                <Text style={[styles.modalCancel, { color: t.accentBlue, fontWeight: '700' }]}>Save</Text>
              </TouchableOpacity>
            </View>

            <TextInput
              style={styles.modalInput}
              value={draftName}
              onChangeText={setDraftName}
              placeholder="Folder name"
              placeholderTextColor={t.textTertiary}
              autoFocus
            />

            <Text style={styles.colorLabel}>COLOR</Text>
            <View style={styles.colorRow}>
              {FOLDER_COLORS.map((c) => (
                <TouchableOpacity
                  key={c}
                  style={[styles.colorSwatch, { backgroundColor: c }, draftColor === c && styles.colorSwatchActive]}
                  onPress={() => setDraftColor(c)}
                />
              ))}
            </View>

            {editingFolder && (
              <TouchableOpacity style={styles.deleteRowBtn} onPress={() => { setShowNew(false); onDeleteFolder(editingFolder); }}>
                <Text style={styles.deleteRowText}>Delete Folder</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

function makeStyles(t: Colors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: t.bgPrimary },
    content: { padding: spacing.md, paddingBottom: 100 },

    navBtn: { fontSize: 20, color: t.accentBlue },

    sectionLabel: {
      ...typography.sectionHeader,
      color: t.textSecondary,
      marginBottom: spacing.sm,
      marginLeft: spacing.xs,
      marginTop: spacing.lg,
    },

    card: { backgroundColor: t.bgSurface, borderRadius: radius.card, overflow: 'hidden', marginBottom: spacing.sm },
    row: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.md, minHeight: 52, gap: spacing.sm },
    divider: { height: StyleSheet.hairlineWidth, backgroundColor: t.separator, marginLeft: 56 },

    folderIcon: { width: 28, height: 28, borderRadius: 6, alignItems: 'center', justifyContent: 'center' },
    folderIconText: { fontSize: 14 },
    rowLabel: { ...typography.body, color: t.textPrimary, flex: 1 },
    rowCount: { ...typography.body, color: t.textSecondary },
    chevron: { fontSize: 20, color: t.textTertiary, marginLeft: spacing.xs },

    bottomBar: {
      position: 'absolute', bottom: 0, left: 0, right: 0,
      paddingHorizontal: spacing.md, paddingBottom: spacing.lg, paddingTop: spacing.sm,
    },
    newFolderBtn: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, padding: spacing.sm },
    newFolderIcon: { fontSize: 18 },
    newFolderText: { ...typography.body, color: t.accentBlue },

    fab: {
      position: 'absolute', bottom: spacing.lg + spacing.xl, right: spacing.lg,
      width: 56, height: 56, borderRadius: 28,
      backgroundColor: t.accentRed,
      alignItems: 'center', justifyContent: 'center',
      shadowColor: t.accentRed, shadowOpacity: 0.38, shadowRadius: 12, shadowOffset: { width: 0, height: 8 },
      elevation: 6,
    },
    fabIcon: { fontSize: 24 },

    // Modal
    modalOverlay: { flex: 1, backgroundColor: t.dimOverlay, justifyContent: 'flex-end' },
    modalSheet: {
      backgroundColor: t.bgSurface, borderTopLeftRadius: 14, borderTopRightRadius: 14,
      paddingBottom: spacing.xl,
    },
    grabHandle: { width: 36, height: 5, borderRadius: 3, backgroundColor: t.textTertiary, alignSelf: 'center', marginTop: spacing.sm, marginBottom: spacing.xs },
    modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.md, paddingVertical: 10 },
    modalTitle: { ...typography.headline, color: t.textPrimary },
    modalCancel: { ...typography.body, color: t.accentBlue },
    modalInput: {
      ...typography.body, color: t.textPrimary,
      backgroundColor: t.bgSurfaceRaised,
      borderRadius: radius.small, marginHorizontal: spacing.md,
      paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
      borderWidth: 0.5, borderColor: t.separator, marginBottom: spacing.lg,
    },
    colorLabel: { ...typography.sectionHeader, color: t.textSecondary, marginLeft: spacing.md + spacing.xs, marginBottom: spacing.sm },
    colorRow: { flexDirection: 'row', gap: spacing.sm, paddingHorizontal: spacing.md, marginBottom: spacing.lg },
    colorSwatch: { width: 32, height: 32, borderRadius: 16 },
    colorSwatchActive: { borderWidth: 3, borderColor: t.textPrimary },
    deleteRowBtn: { alignItems: 'center', paddingVertical: spacing.md },
    deleteRowText: { ...typography.body, color: t.accentRed },
  });
}
