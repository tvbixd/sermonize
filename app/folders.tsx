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
import {
  ChevronIcon,
  FolderIcon,
  GearIcon,
  MicIcon,
  NewFolderIcon,
} from '@/components/icons';

const FOLDER_COLORS = ['#0A84FF', '#FF9F0A', '#30B65B', '#FF453A', '#5E5CE6', '#FF375F'];

type FolderRow = { id: string; name: string; color: string; count: number };

export default function FoldersScreen() {
  const router = useRouter();
  const t = useTheme();
  const styles = useMemo(() => makeStyles(t), [t]);

  const [folders, setFolders] = useState<Folder[]>([]);
  const [sermons, setSermons] = useState<Sermon[]>([]);
  const [showModal, setShowModal] = useState(false);
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
    setShowModal(true);
  };

  const openEditModal = (f: Folder) => {
    setEditingFolder(f);
    setDraftName(f.name);
    setDraftColor(f.color);
    setShowModal(true);
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
    setShowModal(false);
    await refresh();
  };

  const onDeleteFolder = (f: Folder) => {
    Alert.alert('Delete folder?', `"${f.name}" will be deleted. Sermons inside will move to All Sermons.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => { await deleteFolder(f.id); await refresh(); },
      },
    ]);
  };

  const myFolders: FolderRow[] = folders.map((f) => ({
    id: f.id, name: f.name, color: f.color, count: countFor(f.id),
  }));

  const allCount = countFor(undefined);

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <Stack.Screen options={{ headerShown: false }} />

      {/* Nav bar */}
      <View style={styles.navBar}>
        <TouchableOpacity onPress={openCreateModal} hitSlop={8}>
          <Text style={styles.navBtn}>Edit</Text>
        </TouchableOpacity>
        <Link href="/settings" asChild>
          <TouchableOpacity hitSlop={8}>
            <GearIcon size={22} color={t.accentBlue} />
          </TouchableOpacity>
        </Link>
      </View>

      {/* Large title */}
      <View style={styles.titleRow}>
        <Text style={styles.largeTitle}>Folders</Text>
      </View>
      <Text style={styles.subtitle}>
        {allCount} {allCount === 1 ? 'recording' : 'recordings'}
      </Text>

      <ScrollView contentContainerStyle={styles.content}>
        {/* All Sermons */}
        <View style={styles.card}>
          <TouchableOpacity
            style={styles.row}
            onPress={() => router.push('/sermons')}
            activeOpacity={0.7}
          >
            <FolderIcon kind="all" color={t.accentBlue} size={28} />
            <Text style={styles.rowLabel}>All Sermons</Text>
            <Text style={styles.rowCount}>{allCount}</Text>
            <ChevronIcon color={t.textTertiary} size={12} />
          </TouchableOpacity>
        </View>

        {/* My Folders */}
        {myFolders.length > 0 && (
          <>
            <Text style={styles.sectionLabel}>My Folders</Text>
            <View style={styles.card}>
              {myFolders.map((f, i) => (
                <React.Fragment key={f.id}>
                  <TouchableOpacity
                    style={styles.row}
                    onPress={() => router.push({ pathname: '/sermons', params: { folderId: f.id, folderName: f.name } })}
                    onLongPress={() => openEditModal(folders.find((x) => x.id === f.id)!)}
                    activeOpacity={0.7}
                  >
                    <FolderIcon kind="folder" color={f.color} size={28} />
                    <Text style={styles.rowLabel}>{f.name}</Text>
                    <Text style={styles.rowCount}>{f.count}</Text>
                    <ChevronIcon color={t.textTertiary} size={12} />
                  </TouchableOpacity>
                  {i < myFolders.length - 1 && <View style={styles.divider} />}
                </React.Fragment>
              ))}
            </View>
          </>
        )}

        {/* System */}
        <View style={[styles.card, { marginTop: spacing.md }]}>
          <TouchableOpacity
            style={styles.row}
            onPress={() => router.push({ pathname: '/sermons', params: { folderName: 'Drafts' } })}
            activeOpacity={0.7}
          >
            <FolderIcon kind="draft" size={28} />
            <Text style={styles.rowLabel}>Drafts</Text>
            <ChevronIcon color={t.textTertiary} size={12} />
          </TouchableOpacity>
          <View style={styles.divider} />
          <TouchableOpacity style={styles.row} activeOpacity={0.7}>
            <FolderIcon kind="trash" size={28} />
            <Text style={styles.rowLabel}>Recently Deleted</Text>
            <ChevronIcon color={t.textTertiary} size={12} />
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Bottom toolbar */}
      <View style={styles.bottomBar}>
        <TouchableOpacity onPress={openCreateModal} style={styles.newFolderBtn} activeOpacity={0.7}>
          <NewFolderIcon size={22} color={t.accentBlue} />
          <Text style={styles.newFolderText}>New Folder</Text>
        </TouchableOpacity>
      </View>

      {/* FAB */}
      <Link href="/record" asChild>
        <TouchableOpacity style={styles.fab} activeOpacity={0.85}>
          <MicIcon size={24} color="#fff" />
        </TouchableOpacity>
      </Link>

      {/* Create / Edit modal */}
      <Modal visible={showModal} transparent animationType="slide" onRequestClose={() => setShowModal(false)}>
        <View style={styles.overlay}>
          <View style={styles.sheet}>
            <View style={styles.grabHandle} />
            <View style={styles.modalHeader}>
              <TouchableOpacity onPress={() => setShowModal(false)}>
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
                  style={[styles.swatch, { backgroundColor: c }, draftColor === c && styles.swatchActive]}
                  onPress={() => setDraftColor(c)}
                />
              ))}
            </View>

            {editingFolder && (
              <TouchableOpacity
                style={styles.deleteBtn}
                onPress={() => { setShowModal(false); onDeleteFolder(editingFolder); }}
              >
                <Text style={styles.deleteText}>Delete Folder</Text>
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

    navBar: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: spacing.md,
      paddingTop: spacing.md,
      paddingBottom: spacing.xs,
    },
    navBtn: { ...typography.body, color: t.accentBlue },

    titleRow: { paddingHorizontal: 20, paddingTop: spacing.sm, paddingBottom: 2 },
    largeTitle: { ...typography.largeTitle, color: t.textPrimary },
    subtitle: { ...typography.subhead, color: t.textSecondary, paddingHorizontal: 20, paddingBottom: spacing.md },

    content: { paddingHorizontal: spacing.md, paddingBottom: 120 },

    sectionLabel: {
      ...typography.sectionHeader,
      color: t.textSecondary,
      marginTop: 20,
      marginBottom: spacing.sm,
      marginLeft: spacing.xs,
    },

    card: { backgroundColor: t.bgSurface, borderRadius: radius.card, overflow: 'hidden' },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: spacing.md,
      paddingVertical: 10,
      minHeight: 52,
      gap: spacing.sm,
    },
    divider: { height: StyleSheet.hairlineWidth, backgroundColor: t.separator, marginLeft: 56 },

    rowLabel: { ...typography.body, color: t.textPrimary, flex: 1 },
    rowCount: { ...typography.body, color: t.textSecondary, marginRight: 6 },

    bottomBar: {
      position: 'absolute',
      bottom: 0,
      left: 0,
      right: 0,
      height: 72,
      paddingHorizontal: 22,
      paddingBottom: spacing.sm,
      justifyContent: 'flex-end',
    },
    newFolderBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      padding: spacing.sm,
      alignSelf: 'flex-start',
    },
    newFolderText: { ...typography.body, color: t.accentBlue },

    fab: {
      position: 'absolute',
      right: 22,
      bottom: 24,
      width: 56,
      height: 56,
      borderRadius: 28,
      backgroundColor: t.accentRed,
      alignItems: 'center',
      justifyContent: 'center',
      shadowColor: t.accentRed,
      shadowOpacity: 0.38,
      shadowRadius: 12,
      shadowOffset: { width: 0, height: 8 },
      elevation: 6,
    },

    overlay: { flex: 1, backgroundColor: t.dimOverlay, justifyContent: 'flex-end' },
    sheet: {
      backgroundColor: t.bgSurface,
      borderTopLeftRadius: 14,
      borderTopRightRadius: 14,
      paddingBottom: spacing.xl,
    },
    grabHandle: {
      width: 36,
      height: 5,
      borderRadius: 3,
      backgroundColor: t.textTertiary,
      alignSelf: 'center',
      marginTop: spacing.sm,
      marginBottom: spacing.xs,
    },
    modalHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: spacing.md,
      paddingVertical: 10,
    },
    modalTitle: { ...typography.headline, color: t.textPrimary },
    modalCancel: { ...typography.body, color: t.accentBlue },
    modalInput: {
      ...typography.body,
      color: t.textPrimary,
      backgroundColor: t.bgSurfaceRaised,
      borderRadius: radius.small,
      marginHorizontal: spacing.md,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      borderWidth: 0.5,
      borderColor: t.separator,
      marginBottom: spacing.lg,
    },
    colorLabel: {
      ...typography.sectionHeader,
      color: t.textSecondary,
      marginLeft: spacing.md + spacing.xs,
      marginBottom: spacing.sm,
    },
    colorRow: {
      flexDirection: 'row',
      gap: spacing.sm,
      paddingHorizontal: spacing.md,
      marginBottom: spacing.lg,
    },
    swatch: { width: 32, height: 32, borderRadius: 16 },
    swatchActive: { borderWidth: 3, borderColor: t.textPrimary },
    deleteBtn: { alignItems: 'center', paddingVertical: spacing.md },
    deleteText: { ...typography.body, color: t.accentRed },
  });
}
