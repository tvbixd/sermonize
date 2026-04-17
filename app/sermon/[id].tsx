import * as FileSystem from 'expo-file-system';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
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
import { extractOutline } from '@/services/outline';
import { findScriptureReferences } from '@/services/scriptureRegex';
import { getGroqKey, getTranslation } from '@/storage/keys';
import { getSermon, saveSermon } from '@/storage/sermons';
import { colors, radius, spacing, typography } from '@/theme';
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
        <ActivityIndicator style={{ marginTop: 40 }} color={colors.textSecondary} />
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
      const groqKey = await getGroqKey();
      if (!groqKey) throw new Error('Groq API key is not set.');
      const translation = await getTranslation();
      const outline = await extractOutline(sermon.transcript, groqKey);
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
      <Stack.Screen
        options={{
          title: '',
          headerStyle: { backgroundColor: colors.bgSurface },
          headerShadowVisible: false,
          headerRight: () => (
            <TouchableOpacity style={styles.exportBtn} onPress={onExport}>
              <Text style={styles.exportBtnText}>Export</Text>
            </TouchableOpacity>
          ),
        }}
      />

      <View style={styles.titleBlock}>
        <Text style={styles.sermonTitle} numberOfLines={3}>
          {sermon.title}
        </Text>
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

      <View style={styles.toolbar}>
        <TouchableOpacity style={styles.regenerateBtn} onPress={onRegenerate} disabled={busy}>
          {busy ? (
            <ActivityIndicator color={colors.textSecondary} />
          ) : (
            <Text style={styles.regenerateBtnText}>Regenerate Outline</Text>
          )}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

function sanitize(name: string): string {
  return name.replace(/[^a-z0-9-_]+/gi, '_').slice(0, 60) || 'sermon';
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bgPrimary },

  titleBlock: {
    backgroundColor: colors.bgSurface,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    paddingBottom: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.separator,
  },
  sermonTitle: { ...typography.title2, color: colors.textPrimary },
  sermonMeta: { ...typography.footnote, color: colors.textSecondary, marginTop: spacing.xs },

  exportBtn: { paddingHorizontal: spacing.sm },
  exportBtnText: { ...typography.headline, color: colors.accentBlue },

  tabs: {
    flexDirection: 'row',
    backgroundColor: colors.bgSurface,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.separator,
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabActive: { borderBottomColor: colors.textPrimary },
  tabText: { ...typography.subhead, fontWeight: '600', color: colors.textSecondary },
  tabTextActive: { color: colors.textPrimary },

  body: { padding: spacing.md, paddingBottom: spacing.xl },
  empty: { ...typography.subhead, color: colors.textSecondary, fontStyle: 'italic' },
  transcript: { ...typography.subhead, color: colors.textPrimary, lineHeight: 24 },

  toolbar: {
    backgroundColor: colors.bgSurface,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.separator,
    padding: spacing.md,
  },
  regenerateBtn: {
    paddingVertical: 14,
    borderRadius: radius.card,
    backgroundColor: colors.bgPrimary,
    alignItems: 'center',
  },
  regenerateBtnText: { ...typography.headline, color: colors.textPrimary },
});
