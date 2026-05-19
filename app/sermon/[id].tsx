import { Audio } from 'expo-av';
import * as FileSystem from 'expo-file-system/legacy';
import * as Print from 'expo-print';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import * as Sharing from 'expo-sharing';
import React, { useEffect, useMemo, useRef, useState } from 'react';
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
import { BackChevronIcon, CloseIcon, ExportIcon, PlusIcon, RegenIcon } from '@/components/icons';
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
  const t = useTheme();
  const styles = useMemo(() => makeStyles(t), [t]);

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
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackPos, setPlaybackPos] = useState(0);
  const soundRef = useRef<Audio.Sound | null>(null);

  useEffect(() => {
    return () => { void soundRef.current?.unloadAsync(); };
  }, []);

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

  const goBack = () => {
    void soundRef.current?.unloadAsync();
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/sermons');
    }
  };

  const togglePlayback = async () => {
    if (!sermon?.audioUris?.length) return;
    if (isPlaying && soundRef.current) {
      await soundRef.current.pauseAsync();
      setIsPlaying(false);
      return;
    }
    if (soundRef.current) {
      await soundRef.current.playAsync();
      setIsPlaying(true);
      return;
    }
    await Audio.setAudioModeAsync({ playsInSilentModeIOS: true });
    const { sound } = await Audio.Sound.createAsync(
      { uri: sermon.audioUris[0] },
      { shouldPlay: true },
      (status) => {
        if (status.isLoaded) {
          setPlaybackPos(status.positionMillis);
          if (status.didJustFinish) {
            setIsPlaying(false);
            setPlaybackPos(0);
            void soundRef.current?.unloadAsync();
            soundRef.current = null;
          }
        }
      },
    );
    soundRef.current = sound;
    setIsPlaying(true);
  };

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

  const onExport = () => {
    if (!sermon) return;
    Alert.alert('Export', 'Choose a format', [
      {
        text: 'Markdown',
        onPress: async () => {
          const md = sermonToMarkdown(sermon);
          const path = `${FileSystem.cacheDirectory}${sanitize(sermon.title)}.md`;
          await FileSystem.writeAsStringAsync(path, md);
          if (await Sharing.isAvailableAsync()) {
            await Sharing.shareAsync(path, { mimeType: 'text/markdown', dialogTitle: 'Share sermon notes' });
          }
        },
      },
      {
        text: 'PDF',
        onPress: async () => {
          const html = sermonToHtml(sermon);
          const { uri } = await Print.printToFileAsync({ html });
          if (await Sharing.isAvailableAsync()) {
            await Sharing.shareAsync(uri, { mimeType: 'application/pdf', dialogTitle: 'Share sermon PDF' });
          }
        },
      },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  if (!sermon) {
    return (
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        <Stack.Screen options={{ headerShown: false }} />
        <ActivityIndicator style={{ marginTop: 40 }} color={t.textSecondary} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <Stack.Screen options={{ headerShown: false }} />

      {/* Nav bar */}
      <View style={styles.navBar}>
        <TouchableOpacity onPress={goBack} style={styles.navBack} hitSlop={8}>
          <BackChevronIcon color={t.accentBlue} size={20} />
          <Text style={styles.navText}>Sermons</Text>
        </TouchableOpacity>
        {editing ? (
          <View style={styles.navRight}>
            <TouchableOpacity onPress={onCancelEdit}>
              <Text style={[styles.navText, { color: t.textSecondary }]}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={onSaveEdit}>
              <Text style={[styles.navText, { color: t.accentBlue, fontWeight: '700' }]}>Save</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <TouchableOpacity onPress={() => setEditing(true)} hitSlop={8}>
            <Text style={[styles.navText, { color: t.accentBlue }]}>Edit</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Header: title + meta */}
      <View style={styles.titleBlock}>
        {editing ? (
          <TextInput
            style={styles.titleInput}
            value={draftTitle}
            onChangeText={setDraftTitle}
            placeholder="Sermon title"
            placeholderTextColor={t.textTertiary}
          />
        ) : (
          <Text style={styles.sermonTitle} numberOfLines={3}>{sermon.title}</Text>
        )}
        <View style={styles.metaRow}>
          <Text style={styles.sermonMeta}>
            {formatDate(sermon.createdAt)} · {formatElapsed(sermon.durationMs)}
          </Text>
          {sermon.audioUris?.length > 0 && (
            <TouchableOpacity onPress={togglePlayback} style={styles.playBtn} activeOpacity={0.7}>
              <Text style={styles.playBtnText}>{isPlaying ? '⏸ Pause' : '▶ Play'}</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Summary card */}
      {!editing && (sermon.outline.theme || sermon.outline.summary) && (
        <View style={styles.summaryCard}>
          {sermon.outline.theme ? (
            <Text style={styles.summaryTheme}>{sermon.outline.theme}</Text>
          ) : null}
          {sermon.outline.summary ? (
            <Text style={styles.summaryCopy} numberOfLines={3}>{sermon.outline.summary}</Text>
          ) : null}
          {sermon.scriptures.length > 0 && (
            <View style={styles.summaryRefs}>
              {sermon.scriptures.slice(0, 3).map((s, i) => (
                <Text key={i} style={styles.summaryRefPill}>{s.reference}</Text>
              ))}
              {sermon.scriptures.length > 3 && (
                <Text style={styles.summaryRefMore}>+{sermon.scriptures.length - 3} more</Text>
              )}
            </View>
          )}
        </View>
      )}

      {/* Segmented tabs */}
      <View style={styles.tabs}>
        {(['outline', 'scriptures', 'transcript'] as Tab[]).map((tb) => (
          <TouchableOpacity
            key={tb}
            onPress={() => { if (!editing) setTab(tb); }}
            style={[styles.tab, tab === tb && styles.tabActive]}
          >
            <Text style={[styles.tabText, tab === tb && styles.tabTextActive]}>
              {tb === 'outline' ? 'Outline' : tb === 'scriptures' ? 'Scriptures' : 'Transcript'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">

          {tab === 'outline' && (
            <View>
              {editing ? (
                <>
                  <Text style={styles.fieldLabel}>Theme</Text>
                  <TextInput
                    style={styles.input}
                    value={draftTheme}
                    onChangeText={setDraftTheme}
                    placeholder="Central theme…"
                    placeholderTextColor={t.textTertiary}
                    multiline
                  />
                  <Text style={styles.fieldLabel}>Summary</Text>
                  <TextInput
                    style={[styles.input, { minHeight: 72 }]}
                    value={draftSummary}
                    onChangeText={setDraftSummary}
                    placeholder="Brief summary…"
                    placeholderTextColor={t.textTertiary}
                    multiline
                  />
                  <Text style={styles.fieldLabel}>Points</Text>

                  {draftPoints.map((point, pi) => (
                    <View key={pi} style={styles.pointCard}>
                      <Text style={styles.pointCardLabel}>Point {pi + 1}</Text>
                      <View style={styles.pointRow}>
                        <TextInput
                          style={[styles.input, { flex: 1, marginBottom: 0 }]}
                          value={point.heading}
                          onChangeText={(text) => updatePointHeading(pi, text)}
                          placeholder={`Point ${pi + 1} heading…`}
                          placeholderTextColor={t.textTertiary}
                        />
                        <TouchableOpacity onPress={() => removePoint(pi)} style={styles.removeCircle}>
                          <CloseIcon size={12} color="#fff" />
                        </TouchableOpacity>
                      </View>
                      {point.subPoints.map((sp, si) => (
                        <View key={si} style={[styles.pointRow, { marginTop: spacing.sm }]}>
                          <TextInput
                            style={[styles.input, { flex: 1, marginBottom: 0 }]}
                            value={sp}
                            onChangeText={(text) => updateSubPoint(pi, si, text)}
                            placeholder="Sub-point…"
                            placeholderTextColor={t.textTertiary}
                          />
                          <TouchableOpacity onPress={() => removeSubPoint(pi, si)} style={styles.removeRing}>
                            <CloseIcon size={10} color={t.textSecondary} />
                          </TouchableOpacity>
                        </View>
                      ))}
                      <TouchableOpacity onPress={() => addSubPoint(pi)} style={styles.addLink}>
                        <PlusIcon size={12} color={t.accentBlue} />
                        <Text style={styles.addLinkText}>Add sub-point</Text>
                      </TouchableOpacity>
                    </View>
                  ))}

                  <TouchableOpacity onPress={addPoint} style={styles.addPointBtn}>
                    <PlusIcon size={14} color={t.accentBlue} />
                    <Text style={styles.addPointText}>Add Point</Text>
                  </TouchableOpacity>
                </>
              ) : (
                <>
                  {sermon.outline.theme ? (
                    <View style={styles.themeBlock}>
                      <Text style={styles.fieldLabel}>Theme</Text>
                      <Text style={styles.theme}>{sermon.outline.theme}</Text>
                    </View>
                  ) : null}
                  {sermon.outline.summary ? (
                    <View style={styles.summaryBlock}>
                      <Text style={styles.fieldLabel}>Summary</Text>
                      <Text style={styles.summary}>{sermon.outline.summary}</Text>
                    </View>
                  ) : null}

                  {sermon.outline.points.map((point, pi) => (
                    <View key={pi} style={styles.pointCard}>
                      <Text style={styles.pointHeading}>{pi + 1}. {point.heading}</Text>
                      {point.subPoints.map((sp, si) => (
                        <View key={si} style={styles.subRow}>
                          <Text style={styles.bullet}>•</Text>
                          <Text style={styles.subPoint}>{sp}</Text>
                        </View>
                      ))}
                      {point.scriptures.length > 0 && (
                        <View style={styles.refsRow}>
                          {point.scriptures.map((r, ri) => (
                            <Text key={ri} style={styles.refTag}>{r}</Text>
                          ))}
                        </View>
                      )}
                    </View>
                  ))}
                </>
              )}
            </View>
          )}

          {tab === 'scriptures' && (
            <View>
              <View style={styles.addScriptureRow}>
                <TextInput
                  style={[styles.input, { flex: 1, marginBottom: 0 }]}
                  value={newScriptureRef}
                  onChangeText={setNewScriptureRef}
                  placeholder="e.g. John 3:16"
                  placeholderTextColor={t.textTertiary}
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
                <Text style={styles.emptyText}>No scriptures yet. Type a reference above.</Text>
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

      {/* Footer */}
      <View style={styles.footer}>
        <TouchableOpacity style={styles.regenBtn} onPress={onRegenerate} disabled={busy}>
          {busy
            ? <ActivityIndicator color={t.textSecondary} />
            : (
              <>
                <RegenIcon color={t.textPrimary} size={18} />
                <Text style={styles.regenText}>Regenerate</Text>
              </>
            )}
        </TouchableOpacity>
        <TouchableOpacity style={styles.exportBtn} onPress={onExport}>
          <ExportIcon color="#fff" size={18} />
          <Text style={styles.exportText}>Export</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

function sanitize(name: string): string {
  return name.replace(/[^a-z0-9-_]+/gi, '_').slice(0, 60) || 'sermon';
}

function sermonToHtml(sermon: Sermon): string {
  const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  let html = `<!DOCTYPE html><html><head><meta charset="utf-8"/><style>
    body{font-family:-apple-system,Helvetica,Arial,sans-serif;padding:32px;color:#222;line-height:1.6}
    h1{font-size:24px;margin-bottom:4px}h2{font-size:18px;color:#555;margin-top:24px}
    .meta{color:#888;font-size:13px;margin-bottom:16px}
    .theme{font-style:italic;color:#555;margin-bottom:12px}
    .point{background:#f7f7f9;border-radius:10px;padding:14px;margin-bottom:10px}
    .point h3{margin:0 0 6px;font-size:16px}.sub{margin:2px 0 2px 16px;font-size:14px}
    .refs{color:#0A84FF;font-size:13px;margin-top:6px}
    .scripture{border-left:3px solid #0A84FF;padding-left:12px;margin:8px 0}
    .scripture .ref{font-weight:600;color:#0A84FF}.scripture .text{font-style:italic}
  </style></head><body>`;
  html += `<h1>${esc(sermon.outline.title)}</h1>`;
  html += `<p class="meta">${esc(formatDate(sermon.createdAt))} · ${esc(formatElapsed(sermon.durationMs))}</p>`;
  if (sermon.outline.theme) html += `<p class="theme">${esc(sermon.outline.theme)}</p>`;
  if (sermon.outline.summary) html += `<p>${esc(sermon.outline.summary)}</p>`;
  html += '<h2>Outline</h2>';
  sermon.outline.points.forEach((p, i) => {
    html += `<div class="point"><h3>${i + 1}. ${esc(p.heading)}</h3>`;
    p.subPoints.forEach((sp) => { html += `<p class="sub">• ${esc(sp)}</p>`; });
    if (p.scriptures.length) html += `<p class="refs">${p.scriptures.map(esc).join(' · ')}</p>`;
    html += '</div>';
  });
  if (sermon.scriptures.length) {
    html += '<h2>Scriptures</h2>';
    sermon.scriptures.forEach((s) => {
      html += `<div class="scripture"><p class="ref">${esc(s.reference)}${s.translation ? ` (${esc(s.translation)})` : ''}</p>`;
      if (s.text) html += `<p class="text">"${esc(s.text)}"</p>`;
      html += '</div>';
    });
  }
  html += '<h2>Transcript</h2>';
  html += `<p>${esc(sermon.transcript || '(no transcript)')}</p>`;
  html += '</body></html>';
  return html;
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
      backgroundColor: t.bgSurface,
    },
    navBack: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    navText: { ...typography.body, color: t.accentBlue },
    navRight: { flexDirection: 'row', gap: 16 },

    titleBlock: {
      paddingHorizontal: spacing.md,
      paddingTop: 14,
      paddingBottom: 10,
      backgroundColor: t.bgSurface,
    },
    sermonTitle: { ...typography.title2, color: t.textPrimary, marginBottom: 4 },
    titleInput: {
      ...typography.title2,
      color: t.textPrimary,
      borderBottomWidth: 2,
      borderBottomColor: t.accentBlue,
      paddingVertical: 4,
      marginBottom: 4,
    },
    sermonMeta: { ...typography.footnote, color: t.textSecondary },
    metaRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    playBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      backgroundColor: t.bgSurfaceRaised,
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: radius.pill,
      borderWidth: 0.5,
      borderColor: t.separator,
    },
    playBtnText: { ...typography.footnote, color: t.accentBlue, fontWeight: '600' },

    summaryCard: {
      marginHorizontal: spacing.md,
      marginBottom: spacing.sm,
      backgroundColor: t.bgSurface,
      borderRadius: radius.card,
      padding: 14,
      borderWidth: 0.5,
      borderColor: t.separator,
    },
    summaryTheme: {
      ...typography.subhead,
      fontStyle: 'italic',
      color: t.accentBlue,
      marginBottom: 4,
    },
    summaryCopy: {
      ...typography.subhead,
      color: t.textPrimary,
      lineHeight: 21,
    },
    summaryRefs: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 6,
      marginTop: 8,
    },
    summaryRefPill: {
      ...typography.caption,
      color: t.accentBlue,
      fontWeight: '600',
      backgroundColor: t.accentBlue + '15',
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: radius.pill,
      overflow: 'hidden',
    },
    summaryRefMore: {
      ...typography.caption,
      color: t.textSecondary,
      paddingVertical: 3,
    },

    tabs: {
      flexDirection: 'row',
      backgroundColor: t.bgSurface,
      borderBottomWidth: 0.5,
      borderBottomColor: t.separator,
    },
    tab: { flex: 1, paddingVertical: 10, paddingBottom: 12, alignItems: 'center' },
    tabActive: { borderBottomWidth: 2, borderBottomColor: t.accentBlue, marginBottom: -0.5 },
    tabText: { ...typography.subhead, color: t.textSecondary, fontWeight: '400' },
    tabTextActive: { color: t.accentBlue, fontWeight: '600' },

    body: { padding: spacing.md, paddingBottom: spacing.xl, backgroundColor: t.bgSurface },

    fieldLabel: {
      fontSize: 11,
      fontWeight: '500',
      letterSpacing: 0.5,
      textTransform: 'uppercase',
      color: t.textSecondary,
      marginBottom: 6,
      marginTop: spacing.xs,
    },
    input: {
      backgroundColor: t.bgSurfaceRaised,
      borderRadius: radius.small,
      paddingHorizontal: spacing.md,
      paddingVertical: 10,
      ...typography.subhead,
      borderWidth: 0.5,
      borderColor: t.separator,
      marginBottom: spacing.sm,
      color: t.textPrimary,
    },

    themeBlock: { paddingVertical: spacing.xs, paddingHorizontal: 4, marginBottom: spacing.sm },
    theme: { ...typography.subhead, fontStyle: 'italic', color: t.textSecondary, lineHeight: 22 },
    summaryBlock: { paddingHorizontal: 4, marginBottom: spacing.md },
    summary: { ...typography.subhead, color: t.textPrimary, lineHeight: 22 },

    pointCard: {
      backgroundColor: t.bgSurfaceRaised,
      borderRadius: radius.card,
      padding: 14,
      marginBottom: spacing.sm,
      borderWidth: 0.5,
      borderColor: t.separator,
    },
    pointCardLabel: { fontSize: 11, fontWeight: '500', letterSpacing: 0.5, textTransform: 'uppercase', color: t.textSecondary, marginBottom: 4 },
    pointRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
    pointHeading: { ...typography.headline, color: t.textPrimary, marginBottom: spacing.sm },
    subRow: { flexDirection: 'row', gap: 8, marginBottom: 4 },
    bullet: { color: t.textTertiary, fontWeight: '500', fontSize: 15, lineHeight: 21 },
    subPoint: { ...typography.subhead, color: t.textPrimary, flex: 1, lineHeight: 21 },
    refsRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap', marginTop: 10 },
    refTag: { ...typography.footnote, color: t.accentBlue, fontWeight: '500' },

    removeCircle: {
      width: 24, height: 24, borderRadius: 12,
      backgroundColor: t.accentRed,
      alignItems: 'center', justifyContent: 'center',
    },
    removeRing: {
      width: 24, height: 24, borderRadius: 12,
      borderWidth: 1, borderColor: t.textTertiary,
      alignItems: 'center', justifyContent: 'center',
    },
    addLink: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: spacing.sm },
    addLinkText: { ...typography.footnote, color: t.accentBlue, fontWeight: '500' },
    addPointBtn: {
      borderWidth: 1.5,
      borderColor: t.accentBlue,
      borderStyle: 'dashed',
      borderRadius: radius.card,
      paddingVertical: 14,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 4,
      marginTop: spacing.xs,
    },
    addPointText: { ...typography.subhead, color: t.accentBlue, fontWeight: '500' },

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
    scriptureRemove: { alignSelf: 'flex-end', paddingHorizontal: spacing.xs, paddingBottom: spacing.sm },
    scriptureRemoveText: { ...typography.footnote, color: t.accentRed },

    transcript: { ...typography.subhead, color: t.textPrimary, lineHeight: 22 },

    footer: {
      flexDirection: 'row',
      gap: 10,
      paddingHorizontal: spacing.md,
      paddingVertical: 10,
      paddingBottom: spacing.md,
      borderTopWidth: 0.5,
      borderTopColor: t.separator,
      backgroundColor: t.bgSurface,
    },
    regenBtn: {
      flex: 2,
      height: 46,
      borderRadius: radius.pill,
      borderWidth: 0.5,
      borderColor: t.separator,
      backgroundColor: t.bgSurface,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
    },
    regenText: { ...typography.headline, color: t.textPrimary },
    exportBtn: {
      flex: 1,
      height: 46,
      borderRadius: radius.pill,
      backgroundColor: t.accentRed,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
    },
    exportText: { ...typography.headline, color: '#fff' },
  });
}
