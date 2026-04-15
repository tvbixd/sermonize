import * as FileSystem from 'expo-file-system';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as Sharing from 'expo-sharing';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { OutlineView } from '@/components/OutlineView';
import { ScriptureCard } from '@/components/ScriptureCard';
import { lookupVerses } from '@/services/bible';
import { extractOutline } from '@/services/claude';
import { findScriptureReferences } from '@/services/scriptureRegex';
import { getAnthropicKey, getTranslation } from '@/storage/keys';
import { getSermon, saveSermon } from '@/storage/sermons';
import type { Sermon } from '@/types';
import { formatDate, formatElapsed, sermonToMarkdown } from '@/util/format';

type Tab = 'outline' | 'scriptures' | 'transcript';

export default function SermonDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [sermon, setSermon] = useState<Sermon | null>(null);
  const [tab, setTab] = useState<Tab>('outline');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void (async () => {
      if (!id) return;
      const s = await getSermon(id);
      setSermon(s);
    })();
  }, [id]);

  if (!sermon) {
    return (
      <SafeAreaView style={styles.container}>
        <ActivityIndicator style={{ marginTop: 40 }} />
      </SafeAreaView>
    );
  }

  const onExport = async () => {
    const md = sermonToMarkdown(sermon);
    const path = `${FileSystem.cacheDirectory}${sanitize(sermon.title)}.md`;
    await FileSystem.writeAsStringAsync(path, md);
    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(path, { mimeType: 'text/markdown', dialogTitle: 'Share sermon notes' });
    }
  };

  const onRegenerate = async () => {
    if (!sermon.transcript.trim()) return;
    setBusy(true);
    try {
      const anthropicKey = await getAnthropicKey();
      if (!anthropicKey) throw new Error('Anthropic API key is not set.');
      const translation = await getTranslation();
      const outline = await extractOutline(sermon.transcript, anthropicKey);
      const refs = new Set<string>(findScriptureReferences(sermon.transcript));
      for (const p of outline.points) for (const r of p.scriptures) refs.add(r);
      const scriptures = await lookupVerses([...refs], translation);
      const updated: Sermon = { ...sermon, title: outline.title, outline, scriptures };
      await saveSermon(updated);
      setSermon(updated);
    } finally {
      setBusy(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <View style={styles.header}>
        <Text style={styles.headerTitle} numberOfLines={2}>
          {sermon.title}
        </Text>
        <Text style={styles.headerMeta}>
          {formatDate(sermon.createdAt)} • {formatElapsed(sermon.durationMs)}
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

      <ScrollView contentContainerStyle={styles.body}>
        {tab === 'outline' ? (
          <OutlineView outline={sermon.outline} />
        ) : tab === 'scriptures' ? (
          sermon.scriptures.length === 0 ? (
            <Text style={styles.empty}>No scriptures detected.</Text>
          ) : (
            sermon.scriptures.map((s, i) => <ScriptureCard key={i} scripture={s} />)
          )
        ) : (
          <Text style={styles.transcript}>{sermon.transcript || '(no transcript)'}</Text>
        )}
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity style={styles.secondary} onPress={onRegenerate} disabled={busy}>
          {busy ? <ActivityIndicator color="#334155" /> : <Text style={styles.secondaryText}>Regenerate Outline</Text>}
        </TouchableOpacity>
        <TouchableOpacity style={styles.primary} onPress={onExport}>
          <Text style={styles.primaryText}>Export</Text>
        </TouchableOpacity>
      </View>

      <TouchableOpacity onPress={() => router.back()} style={styles.backLink}>
        <Text style={styles.backLinkText}>← Back</Text>
      </TouchableOpacity>
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
  headerMeta: { fontSize: 13, color: '#64748b', marginTop: 4 },
  tabs: { flexDirection: 'row', backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#e2e8f0' },
  tab: { flex: 1, paddingVertical: 12, alignItems: 'center' },
  tabActive: { borderBottomWidth: 2, borderBottomColor: '#0369a1' },
  tabText: { fontSize: 14, color: '#64748b', fontWeight: '600' },
  tabTextActive: { color: '#0369a1' },
  body: { padding: 16 },
  empty: { color: '#64748b', fontStyle: 'italic' },
  transcript: { fontSize: 15, color: '#1e293b', lineHeight: 22 },
  footer: {
    flexDirection: 'row',
    padding: 16,
    gap: 12,
    backgroundColor: '#f1f5f9',
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
  },
  primary: { flex: 1, backgroundColor: '#0f172a', paddingVertical: 14, borderRadius: 12, alignItems: 'center' },
  primaryText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  secondary: { flex: 2, backgroundColor: '#e2e8f0', paddingVertical: 14, borderRadius: 12, alignItems: 'center' },
  secondaryText: { color: '#334155', fontWeight: '600', fontSize: 16 },
  backLink: { padding: 8, alignItems: 'center' },
  backLinkText: { color: '#64748b', fontSize: 14 },
});
