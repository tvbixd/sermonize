import * as FileSystem from 'expo-file-system/legacy';
import { Stack, useLocalSearchParams, useNavigation, useRouter } from 'expo-router';
import * as Sharing from 'expo-sharing';
import React, { useEffect, useLayoutEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ScriptureCard } from '@/components/ScriptureCard';
import { lookupVerse, lookupVerses } from '@/services/bible';
import { extractOutline } from '@/services/outline';
import { findScriptureReferences } from '@/services/scriptureRegex';
import { getGroqKey, getTranslation } from '@/storage/keys';
import { getSermon, saveSermon } from '@/storage/sermons';
import { type Colors, radius, spacing, typography, useTheme } from '@/theme';
import type { Outline, Sermon } from '@/types';
import { formatDate, formatElapsed, sermonToMarkdown } from '@/util/format';

type Tab = 'outline' | 'scriptures' | 'transcript';

export default function SermonDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const navigation = useNavigation();

  const [sermon, setSermon] = useState<Sermon | null>(null);
  const [tab, setTab] = useState<Tab>('outline');
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);

  const [draftTitle, setDraftTitle] = useState('');
  const [draftTheme, setDraftTheme] = useState('');
  const [draftSummary, setDraftSummary] = useState('');
  const [draftPoints, setDraftPoints] = useState<Outline['points']>([]);
  const [newScriptureRef, setNewScriptureRef] = useState('');
  const [addingScripture, setAddingScripture] = useState(false);
  const t = useTheme();
  const styles = useMemo(() => makeStyles(t), [t]);

  useEffect(() => {
    void (async () => {
      if (!id) return;
      const s = await getSermon(id);
      if (s) { setSermon(s); seedDraft(s); }
    })();
  }, [id]);

  const seedDraft = (s: Sermon) => {
    setDraftTitle(s.outline.title);
    setDraftTheme(s.outline.theme);
    setDraftSummary(s.outline.summary);
    setDraftPoints(JSON.parse(JSON.stringify(s.outline.points)));
  };

  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () =>
        editing ? (
          <View style={{ flexDirection: 'row', gap: 12, marginRight: 4 }}>
            <TouchableOpacity onPress={onCancelEdit}>
              <Text style={{ color: t.textSecondary, fontWeight: '600', fontSize: 15 }}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={onSaveEdit}>
              <Text style={{ color: t.accentBlue, fontWeight: '700', fontSize: 15 }}>Save</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <TouchableOpacity onPress={() => setEditing(true)} style={{ marginRight: 4 }}>
            <Text style={{ color: t.accentBlue, fontWeight: '600', fontSize: 15 }}>Edit</Text>
          </TouchableOpacity>
        ),
    });
  }, [editing, draftTitle, draftTheme, draftSummary, draftPoints]);

  const onCancelEdit = () => {
    if (sermon) seedDraft(sermon);
    setEditing(false);
  };

  const onSaveEdit = async () => {
    if (!sermon) return;
    const updated: Sermon = {
      ...sermon,
      title: draftTitle.trim() || sermon.title,
      outline: {
        ...sermon.outline,
        title: draftTitle.trim() || sermon.outline.title,
        theme: draftTheme,
        summary: draftSummary,
        points: draftPoints,
      },
    };
    await saveSermon(updated);
    setSermon(updated);
    setEditing(false);
  };

  const updatePointHeading = (i: number, text: string) => {
    setDraftPoints((pts) => pts.map((p, idx) => idx === i ? { ...p, heading: text } : p));
  };

  const updateSubPoint = (pi: number, si: number, text: string) => {
    setDraftPoints((pts) =>
      pts.map((p, idx) =>
        idx === pi ? { ...p, subPoints: p.subPoints.map((sp, sIdx) => sIdx === si ? text : sp) } : p,
      ),
    );
  };

  const addSubPoint = (pi: number) => {
    setDraftPoints((pts) =>
      pts.map((p, idx) => idx === pi ? { ...p, subPoints: [...p.subPoints, ''] } : p),
    );
  };

  const removeSubPoint = (pi: number, si: number) => {
    setDraftPoints((pts) =>
      pts.map((p, idx) =>
        idx === pi ? { ...p, subPoints: p.subPoints.filter((_, sIdx) => sIdx !== si) } : p,
      ),
    );
  };

  const addPoint = () => {
    setDraftPoints((pts) => [...pts, { heading: '', subPoints: [], scriptures: [] }]);
  };

  const removePoint = (i: number) => {
    setDraftPoints((pts) => pts.filter((_, idx) => idx !== i));
  };

  const onAddScripture = async () => {
    const ref = newScriptureRef.trim();
    if (!ref || !sermon) return;
    setAddingScripture(true);
    try {
      const translation = await getTranslation();
      const scripture = await lookupVerse(ref, translation);
      const updated: Sermon = { ...sermon, scriptures: [...sermon.scriptures, scripture] };
      await saveSermon(updated);
      setSermon(updated);
      setNewScriptureRef('');
    } finally {
      setAddingScripture(false);
    }
  };

  const onRemoveScripture = async (idx: number) => {
    if (!sermon) return;
    const updated: Sermon = { ...sermon, scriptures: sermon.scriptures.filter((_, i) => i !== idx) };
    await saveSermon(updated);
    setSermon(updated);
  };

  const onRegenerate = async () => {
    if (!sermon?.transcript.trim()) return;
    setBusy(true);
    try {
      const key = await getGroqKey();
      if (!key) throw new Error('Groq API key not set.');
      const translation = await getTranslation();
      const outline = await extractOutline(sermon.transcript, key);
      const refs = new Set(findScriptureReferences(sermon.transcript));
      for (const p of outline.points) for (const r of p.scriptures) refs.add(r);
      const scriptures = await lookupVerses([...refs], translation);
      const updated: Sermon = { ...sermon, title: outline.title, outline, scriptures };
      await saveSermon(updated);
      setSermon(updated);
      seedDraft(updated);
    } catch (e) {
      Alert.alert('Error', e instanceof Error ? e.message : 'Could not regenerate.');
    } finally {
      setBusy(false);
    }
  };

  const onExport = async () => {
    if (!sermon) return;
    const md = sermonToMarkdown(sermon);
    const path = `${FileSystem.cacheDirectory}${sanitize(sermon.title)}.md`;
    await FileSystem.writeAsStringAsync(path, md);
    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(path, { mimeType: 'text/markdown', dialogTitle: 'Share sermon notes' });
    }
  };

  if (!sermon) {
    return (
      <SafeAreaView style={styles.container}>
        <ActivityIndicator style={{ marginTop: 40 }} color={colors.textSecondary} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <Stack.Screen
        options={{
          title: '',
          headerStyle: { backgroundColor: colors.bgSurface },
          headerShadowVisible: false,
        }}
      />

      <View style={styles.titleBlock}>
        {editing ? (
          <TextInput
            style={styles.titleInput}
            value={draftTitle}
            onChangeText={setDraftTitle}
            placeholder="Sermon title"
            placeholderTextColor={colors.textTertiary}
          />
        ) : (
          <Text style={styles.sermonTitle} numberOfLines={3}>{sermon.title}</Text>
        )}
        <Text style={styles.sermonMeta}>
          {formatDate(sermon.createdAt)} · {formatElapsed(sermon.durationMs)}
        </Text>
      </View>

      <View style={styles.tabs}>
        {(['outline', 'scriptures', 'transcript'] as Tab[]).map((t) => (
          <TouchableOpacity
            key={t}
            onPress={() => setTab(t)}
            style={[styles.tab, tab === t && styles.tabActive]}
          >
            <Text style={[styles.tabText, tab === t && styles.tabTextActive]}>
              {t === 'outline' ? 'Outline' : t === 'scriptures' ? 'Scriptures' : 'Transcript'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">

          {tab === 'outline' && (
            <View>
              {editing && (
                <>
                  <Text style={styles.fieldLabel}>Theme</Text>
                  <TextInput
                    style={styles.input}
                    value={draftTheme}
                    onChangeText={setDraftTheme}
                    placeholder="Central theme…"
                    placeholderTextColor={colors.textTertiary}
                    multiline
                  />
                  <Text style={styles.fieldLabel}>Summary</Text>
                  <TextInput
                    style={[styles.input, { minHeight: 72 }]}
                    value={draftSummary}
                    onChangeText={setDraftSummary}
                    placeholder="Brief summary…"
                    placeholderTextColor={colors.textTertiary}
                    multiline
                  />
                  <Text style={styles.fieldLabel}>Points</Text>
                </>
              )}

              {!editing && (
                <>
                  {sermon.outline.theme ? <Text style={styles.theme}>{sermon.outline.theme}</Text> : null}
                  {sermon.outline.summary ? <Text style={styles.summary}>{sermon.outline.summary}</Text> : null}
                </>
              )}

              {(editing ? draftPoints : sermon.outline.points).map((point, pi) => (
                <View key={pi} style={styles.pointCard}>
                  {editing ? (
                    <>
                      <View style={styles.pointRow}>
                        <TextInput
                          style={[styles.input, { flex: 1 }]}
                          value={point.heading}
                          onChangeText={(t) => updatePointHeading(pi, t)}
                          placeholder={`Point ${pi + 1} heading…`}
                          placeholderTextColor={colors.textTertiary}
                        />
                        <TouchableOpacity onPress={() => removePoint(pi)} style={styles.removeBtn}>
                          <Text style={styles.removeBtnText}>✕</Text>
                        </TouchableOpacity>
                      </View>
                      {point.subPoints.map((sp, si) => (
                        <View key={si} style={styles.subRow}>
                          <Text style={styles.bullet}>•</Text>
                          <TextInput
                            style={[styles.input, { flex: 1 }]}
                            value={sp}
                            onChangeText={(t) => updateSubPoint(pi, si, t)}
                            placeholder="Sub-point…"
                            placeholderTextColor={colors.textTertiary}
                          />
                          <TouchableOpacity onPress={() => removeSubPoint(pi, si)} style={styles.removeBtn}>
                            <Text style={styles.removeBtnText}>✕</Text>
                          </TouchableOpacity>
                        </View>
                      ))}
                      <TouchableOpacity onPress={() => addSubPoint(pi)} style={styles.addLink}>
                        <Text style={styles.addLinkText}>+ Add sub-point</Text>
                      </TouchableOpacity>
                    </>
                  ) : (
                    <>
                      <Text style={styles.pointHeading}>{pi + 1}. {point.heading}</Text>
                      {point.subPoints.map((sp, si) => (
                        <Text key={si} style={styles.subPoint}>• {sp}</Text>
                      ))}
                      {point.scriptures.length > 0 && (
                        <Text style={styles.pointRefs}>{point.scriptures.join('  ·  ')}</Text>
                      )}
                    </>
                  )}
                </View>
              ))}

              {editing && (
                <TouchableOpacity onPress={addPoint} style={styles.addPointBtn}>
                  <Text style={styles.addPointText}>+ Add Point</Text>
                </TouchableOpacity>
              )}
            </View>
          )}

          {tab === 'scriptures' && (
            <View>
              <View style={styles.addScriptureRow}>
                <TextInput
                  style={[styles.input, { flex: 1 }]}
                  value={newScriptureRef}
                  onChangeText={setNewScriptureRef}
                  placeholder="e.g. John 3:16"
                  placeholderTextColor={colors.textTertiary}
                  autoCapitalize="words"
                  returnKeyType="done"
                  onSubmitEditing={onAddScripture}
                />
                <TouchableOpacity
                  onPress={onAddScripture}
                  style={styles.addScriptureBtn}
                  disabled={addingScripture || !newScriptureRef.trim()}
                >
                  {addingScripture
                    ? <ActivityIndicator color="#fff" />
                    : <Text style={styles.addScriptureBtnText}>Add</Text>}
                </TouchableOpacity>
              </View>

              {sermon.scriptures.length === 0 ? (
                <Text style={styles.emptyText}>No scriptures yet. Type a reference above to add one.</Text>
              ) : (
                sermon.scriptures.map((s, i) => (
                  <View key={i} style={styles.scriptureWrap}>
                    <ScriptureCard scripture={s} />
                    <TouchableOpacity
                      style={styles.scriptureRemove}
                      onPress={() =>
                        Alert.alert('Remove scripture?', s.reference, [
                          { text: 'Cancel', style: 'cancel' },
                          { text: 'Remove', style: 'destructive', onPress: () => void onRemoveScripture(i) },
                        ])
                      }
                    >
                      <Text style={styles.scriptureRemoveText}>Remove</Text>
                    </TouchableOpacity>
                  </View>
                ))
              )}
            </View>
          )}

          {tab === 'transcript' && (
            <Text style={styles.transcript}>{sermon.transcript || '(no transcript)'}</Text>
          )}

        </ScrollView>
      </KeyboardAvoidingView>

      <View style={styles.footer}>
        <TouchableOpacity style={styles.secondary} onPress={onRegenerate} disabled={busy}>
          {busy
            ? <ActivityIndicator color={colors.textSecondary} />
            : <Text style={styles.secondaryText}>Regenerate</Text>}
        </TouchableOpacity>
        <TouchableOpacity style={styles.primary} onPress={onExport}>
          <Text style={styles.primaryText}>Export</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

function sanitize(name: string): string {
  return name.replace(/[^a-z0-9-_]+/gi, '_').slice(0, 60) || 'sermon';
}

function makeStyles(t: Colors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: t.bgPrimary },

    titleBlock: { paddingHorizontal: spacing.md, paddingVertical: spacing.md, backgroundColor: t.bgSurface },
    sermonTitle: { ...typography.title2, color: t.textPrimary, marginBottom: spacing.xs },
    titleInput: {
      ...typography.title2,
      color: t.textPrimary,
      borderBottomWidth: 2,
      borderBottomColor: t.accentBlue,
      paddingVertical: 4,
      marginBottom: spacing.xs,
    },
    sermonMeta: { ...typography.footnote, color: t.textSecondary },

    tabs: {
      flexDirection: 'row',
      backgroundColor: t.bgSurface,
      borderBottomWidth: 1,
      borderBottomColor: t.separator,
    },
    tab: { flex: 1, paddingVertical: 12, alignItems: 'center' },
    tabActive: { borderBottomWidth: 2, borderBottomColor: t.accentBlue },
    tabText: { ...typography.subhead, color: t.textSecondary, fontWeight: '600' },
    tabTextActive: { color: t.accentBlue },

    body: { padding: spacing.md, paddingBottom: spacing.xl },

    fieldLabel: {
      fontSize: 11,
      fontWeight: '700',
      color: t.textSecondary,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
      marginBottom: spacing.xs,
      marginTop: spacing.md,
    },
    input: {
      backgroundColor: t.bgSurface,
      borderRadius: radius.small,
      paddingHorizontal: spacing.md,
      paddingVertical: 10,
      ...typography.subhead,
      borderWidth: 1,
      borderColor: t.separator,
      marginBottom: spacing.sm,
      color: t.textPrimary,
    },

    theme: { ...typography.subhead, fontStyle: 'italic', color: t.textSecondary, marginBottom: spacing.sm },
    summary: { ...typography.subhead, color: t.textPrimary, marginBottom: spacing.md, lineHeight: 22 },

    pointCard: {
      backgroundColor: t.bgSurface,
      borderRadius: radius.card,
      padding: spacing.md,
      marginBottom: spacing.sm,
      shadowColor: '#000',
      shadowOpacity: 0.04,
      shadowRadius: 3,
      shadowOffset: { width: 0, height: 1 },
      elevation: 1,
    },
    pointRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
    pointHeading: { ...typography.headline, color: t.textPrimary, marginBottom: spacing.xs },
    subRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginLeft: spacing.sm },
    bullet: { color: t.textSecondary, fontSize: 16 },
    subPoint: { ...typography.subhead, color: t.textPrimary, marginLeft: spacing.md, marginVertical: 2, lineHeight: 22 },
    pointRefs: { ...typography.footnote, color: t.accentBlue, marginTop: spacing.xs, marginLeft: spacing.md },
    removeBtn: { padding: 6 },
    removeBtnText: { color: t.accentRed, fontWeight: '700', fontSize: 16 },
    addLink: { marginTop: spacing.xs },
    addLinkText: { ...typography.subhead, color: t.accentBlue, fontWeight: '600' },
    addPointBtn: {
      borderWidth: 2,
      borderColor: t.accentBlue,
      borderStyle: 'dashed',
      borderRadius: radius.card,
      paddingVertical: 14,
      alignItems: 'center',
      marginTop: spacing.xs,
    },
    addPointText: { ...typography.headline, color: t.accentBlue },

    addScriptureRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md },
    addScriptureBtn: {
      backgroundColor: t.accentBlue,
      paddingHorizontal: spacing.md,
      paddingVertical: 10,
      borderRadius: radius.small,
      alignItems: 'center',
      justifyContent: 'center',
      minWidth: 64,
    },
    addScriptureBtnText: { color: '#fff', fontWeight: '700' },
    emptyText: { ...typography.subhead, color: t.textSecondary, fontStyle: 'italic', textAlign: 'center', marginTop: spacing.xl },
    scriptureWrap: { marginBottom: spacing.xs },
    scriptureRemove: { alignSelf: 'flex-end', marginTop: -4, marginBottom: spacing.sm, paddingHorizontal: spacing.xs },
    scriptureRemoveText: { ...typography.footnote, color: t.accentRed, fontWeight: '600' },

    transcript: { ...typography.subhead, color: t.textPrimary, lineHeight: 22 },

    footer: {
      flexDirection: 'row',
      gap: spacing.sm,
      padding: spacing.md,
      borderTopWidth: 1,
      borderTopColor: t.separator,
      backgroundColor: t.bgPrimary,
    },
    primary: {
      flex: 1,
      backgroundColor: t.textPrimary,
      paddingVertical: 14,
      borderRadius: radius.card,
      alignItems: 'center',
    },
    primaryText: { ...typography.headline, color: t.bgPrimary },
    secondary: {
      flex: 2,
      backgroundColor: t.bgSurface,
      paddingVertical: 14,
      borderRadius: radius.card,
      alignItems: 'center',
      borderWidth: 1,
      borderColor: t.separator,
    },
    secondaryText: { ...typography.headline, color: t.textPrimary },
  });
}
