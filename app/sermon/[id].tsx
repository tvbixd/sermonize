import * as FileSystem from 'expo-file-system/legacy';
import { useLocalSearchParams, useNavigation, useRouter } from 'expo-router';
import * as Sharing from 'expo-sharing';
import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
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

  // Draft state for edits
  const [draftTitle, setDraftTitle] = useState('');
  const [draftTheme, setDraftTheme] = useState('');
  const [draftSummary, setDraftSummary] = useState('');
  const [draftPoints, setDraftPoints] = useState<Outline['points']>([]);
  const [newScriptureRef, setNewScriptureRef] = useState('');
  const [addingScripture, setAddingScripture] = useState(false);

  useEffect(() => {
    void (async () => {
      if (!id) return;
      const s = await getSermon(id);
      if (s) {
        setSermon(s);
        seedDraft(s);
      }
    })();
  }, [id]);

  const seedDraft = (s: Sermon) => {
    setDraftTitle(s.outline.title);
    setDraftTheme(s.outline.theme);
    setDraftSummary(s.outline.summary);
    setDraftPoints(JSON.parse(JSON.stringify(s.outline.points)));
  };

  // Put Edit / Save in the nav header
  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () =>
        editing ? (
          <View style={{ flexDirection: 'row', gap: 12, marginRight: 4 }}>
            <TouchableOpacity onPress={onCancelEdit}>
              <Text style={{ color: '#94a3b8', fontWeight: '600', fontSize: 15 }}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={onSaveEdit}>
              <Text style={{ color: '#fff', fontWeight: '700', fontSize: 15 }}>Save</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <TouchableOpacity onPress={() => setEditing(true)} style={{ marginRight: 4 }}>
            <Text style={{ color: '#fff', fontWeight: '600', fontSize: 15 }}>Edit</Text>
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

  // Point editing helpers
  const updatePointHeading = (i: number, text: string) => {
    setDraftPoints((pts) => pts.map((p, idx) => idx === i ? { ...p, heading: text } : p));
  };

  const updateSubPoint = (pi: number, si: number, text: string) => {
    setDraftPoints((pts) =>
      pts.map((p, idx) =>
        idx === pi
          ? { ...p, subPoints: p.subPoints.map((sp, sIdx) => sIdx === si ? text : sp) }
          : p,
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

  // Scripture management (live on the sermon, not a draft — auto-saves)
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
    const updated: Sermon = {
      ...sermon,
      scriptures: sermon.scriptures.filter((_, i) => i !== idx),
    };
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
        <ActivityIndicator style={{ marginTop: 40 }} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      {/* Header info */}
      <View style={styles.header}>
        {editing ? (
          <TextInput
            style={styles.titleInput}
            value={draftTitle}
            onChangeText={setDraftTitle}
            placeholder="Sermon title"
          />
        ) : (
          <Text style={styles.headerTitle}>{sermon.title}</Text>
        )}
        <Text style={styles.headerMeta}>
          {formatDate(sermon.createdAt)} • {formatElapsed(sermon.durationMs)}
        </Text>
      </View>

      {/* Tabs */}
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

          {/* ── OUTLINE TAB ── */}
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
                    multiline
                  />
                  <Text style={styles.fieldLabel}>Summary</Text>
                  <TextInput
                    style={[styles.input, { minHeight: 72 }]}
                    value={draftSummary}
                    onChangeText={setDraftSummary}
                    placeholder="Brief summary…"
                    multiline
                  />
                  <Text style={styles.fieldLabel}>Points</Text>
                </>
              )}

              {!editing && (
                <>
                  {sermon.outline.theme ? (
                    <Text style={styles.theme}>{sermon.outline.theme}</Text>
                  ) : null}
                  {sermon.outline.summary ? (
                    <Text style={styles.summary}>{sermon.outline.summary}</Text>
                  ) : null}
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
                        <Text style={styles.pointRefs}>
                          Scriptures: {point.scriptures.join(', ')}
                        </Text>
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

          {/* ── SCRIPTURES TAB ── */}
          {tab === 'scriptures' && (
            <View>
              {/* Add scripture */}
              <View style={styles.addScriptureRow}>
                <TextInput
                  style={[styles.input, { flex: 1 }]}
                  value={newScriptureRef}
                  onChangeText={setNewScriptureRef}
                  placeholder="e.g. John 3:16"
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
                <Text style={styles.empty}>No scriptures yet. Type a reference above to add one.</Text>
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

          {/* ── TRANSCRIPT TAB ── */}
          {tab === 'transcript' && (
            <Text style={styles.transcript}>{sermon.transcript || '(no transcript)'}</Text>
          )}
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Footer */}
      <View style={styles.footer}>
        <TouchableOpacity style={styles.secondary} onPress={onRegenerate} disabled={busy}>
          {busy
            ? <ActivityIndicator color="#334155" />
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

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f1f5f9' },
  header: { padding: 16, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#e2e8f0' },
  headerTitle: { fontSize: 20, fontWeight: '700', color: '#0f172a' },
  titleInput: {
    fontSize: 20, fontWeight: '700', color: '#0f172a',
    borderBottomWidth: 2, borderBottomColor: '#0369a1', paddingVertical: 4,
  },
  headerMeta: { fontSize: 13, color: '#64748b', marginTop: 4 },
  tabs: { flexDirection: 'row', backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#e2e8f0' },
  tab: { flex: 1, paddingVertical: 12, alignItems: 'center' },
  tabActive: { borderBottomWidth: 2, borderBottomColor: '#0369a1' },
  tabText: { fontSize: 14, color: '#64748b', fontWeight: '600' },
  tabTextActive: { color: '#0369a1' },
  body: { padding: 16, paddingBottom: 24 },
  fieldLabel: { fontSize: 12, fontWeight: '700', color: '#64748b', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4, marginTop: 12 },
  input: {
    backgroundColor: '#fff', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10,
    fontSize: 15, borderWidth: 1, borderColor: '#cbd5e1', marginBottom: 8,
  },
  theme: { fontSize: 14, fontStyle: 'italic', color: '#475569', marginBottom: 8 },
  summary: { fontSize: 15, color: '#334155', marginBottom: 16 },
  pointCard: {
    backgroundColor: '#fff', borderRadius: 12, padding: 14, marginBottom: 12,
    shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 3, shadowOffset: { width: 0, height: 1 }, elevation: 1,
  },
  pointRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  pointHeading: { fontSize: 16, fontWeight: '600', color: '#0f172a', marginBottom: 4 },
  subRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginLeft: 8 },
  bullet: { color: '#64748b', fontSize: 16 },
  subPoint: { fontSize: 15, color: '#334155', marginLeft: 12, marginVertical: 2 },
  pointRefs: { fontSize: 13, color: '#0369a1', marginTop: 4, marginLeft: 12 },
  removeBtn: { padding: 6 },
  removeBtnText: { color: '#ef4444', fontWeight: '700', fontSize: 16 },
  addLink: { marginTop: 4 },
  addLinkText: { color: '#0369a1', fontSize: 14, fontWeight: '600' },
  addPointBtn: {
    borderWidth: 2, borderColor: '#0369a1', borderStyle: 'dashed',
    borderRadius: 12, paddingVertical: 14, alignItems: 'center', marginTop: 4,
  },
  addPointText: { color: '#0369a1', fontWeight: '700', fontSize: 16 },
  addScriptureRow: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  addScriptureBtn: {
    backgroundColor: '#0369a1', paddingHorizontal: 16, paddingVertical: 10,
    borderRadius: 8, alignItems: 'center', justifyContent: 'center', minWidth: 64,
  },
  addScriptureBtnText: { color: '#fff', fontWeight: '700' },
  empty: { color: '#64748b', fontStyle: 'italic', textAlign: 'center', marginTop: 24 },
  scriptureWrap: { marginBottom: 4 },
  scriptureRemove: { alignSelf: 'flex-end', marginTop: -4, marginBottom: 8, paddingHorizontal: 4 },
  scriptureRemoveText: { color: '#ef4444', fontSize: 13, fontWeight: '600' },
  transcript: { fontSize: 15, color: '#1e293b', lineHeight: 22 },
  footer: {
    flexDirection: 'row', gap: 12, padding: 16,
    borderTopWidth: 1, borderTopColor: '#e2e8f0', backgroundColor: '#f1f5f9',
  },
  primary: { flex: 1, backgroundColor: '#0f172a', paddingVertical: 14, borderRadius: 12, alignItems: 'center' },
  primaryText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  secondary: { flex: 2, backgroundColor: '#e2e8f0', paddingVertical: 14, borderRadius: 12, alignItems: 'center' },
  secondaryText: { color: '#334155', fontWeight: '600', fontSize: 16 },
});
