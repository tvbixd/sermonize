import Constants from 'expo-constants';
import { Stack, useRouter } from 'expo-router';
import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Linking,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import {
  getGroqKey,
  getTranslation,
  setGroqKey,
  setTranslation,
} from '@/storage/keys';
import {
  type TranslationEntry,
  LEGACY_TRANSLATIONS,
  clearApiBibleCache,
  fetchApiBibleTranslations,
} from '@/services/bible';
import { type Colors, radius, spacing, typography, useTheme } from '@/theme';
import { CheckIcon, EyeIcon, EyeOffIcon } from '@/components/icons';

type LangGroup = { language: string; entries: TranslationEntry[] };

function groupByLanguage(entries: TranslationEntry[]): LangGroup[] {
  const map = new Map<string, TranslationEntry[]>();
  for (const e of entries) {
    const lang = e.language || 'Other';
    if (!map.has(lang)) map.set(lang, []);
    map.get(lang)!.push(e);
  }
  const groups = [...map.entries()].map(([language, entries]) => ({ language, entries }));
  groups.sort((a, b) => {
    if (a.language === 'English') return -1;
    if (b.language === 'English') return 1;
    return a.language.localeCompare(b.language);
  });
  return groups;
}

export default function SettingsScreen() {
  const router = useRouter();
  const [groq, setGroq] = useState('');
  const [translation, setTrans] = useState('web');
  const [loaded, setLoaded] = useState(false);
  const [showGroqKey, setShowGroqKey] = useState(false);
  const [keyStatus, setKeyStatus] = useState<'idle' | 'checking' | 'valid' | 'invalid'>('idle');
  const [apiBibles, setApiBibles] = useState<TranslationEntry[]>([]);
  const [loadingBibles, setLoadingBibles] = useState(false);
  const [bibleSearch, setBibleSearch] = useState('');
  const t = useTheme();
  const styles = useMemo(() => makeStyles(t), [t]);

  useEffect(() => {
    void (async () => {
      const [gk, tr] = await Promise.all([getGroqKey(), getTranslation()]);
      setGroq(gk ?? '');
      setTrans(tr);
      setLoaded(true);
      void loadApiBibles();
    })();
  }, []);

  const loadApiBibles = async () => {
    setLoadingBibles(true);
    try {
      const bibles = await fetchApiBibleTranslations();
      setApiBibles(bibles);
    } catch {
      // Silently fall back to built-in translations
    }
    setLoadingBibles(false);
  };

  const validateKey = async (key: string): Promise<boolean> => {
    if (!key.trim()) return true;
    try {
      const resp = await fetch('https://api.groq.com/openai/v1/models', {
        headers: { Authorization: `Bearer ${key.trim()}` },
      });
      return resp.ok;
    } catch {
      return true;
    }
  };

  const onSave = async () => {
    await setGroqKey(groq.trim());
    await setTranslation(translation);
    if (groq.trim()) {
      setKeyStatus('checking');
      const valid = await validateKey(groq);
      setKeyStatus(valid ? 'valid' : 'invalid');
    }
  };

  if (!loaded) return null;

  const onDone = async () => {
    await onSave();
    router.back();
  };

  const filteredApiBibles = bibleSearch.trim()
    ? apiBibles.filter((b) =>
        b.label.toLowerCase().includes(bibleSearch.toLowerCase()) ||
        b.abbr.toLowerCase().includes(bibleSearch.toLowerCase()) ||
        b.language.toLowerCase().includes(bibleSearch.toLowerCase()))
    : apiBibles;

  const apiGroups = groupByLanguage(filteredApiBibles);

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <Stack.Screen options={{ headerShown: false, presentation: 'modal' }} />

      <View style={styles.grabHandle} />

      <View style={styles.modalHeader}>
        <View style={{ width: 60 }} />
        <Text style={styles.modalTitle}>Settings</Text>
        <TouchableOpacity onPress={onDone} style={{ width: 60, alignItems: 'flex-end' }}>
          <Text style={[styles.doneText, { color: t.accentBlue }]}>Done</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>

        <Text style={styles.sectionLabel}>Groq API Key</Text>
        <View style={styles.card}>
          <Text style={styles.helpText}>
            Sermonize uses Groq for fast transcription and outlining. Create a free key at console.groq.com — no credit card required.
          </Text>
          <View style={styles.divider} />
          <View style={styles.keyRow}>
            <TextInput
              style={styles.keyInput}
              value={groq}
              onChangeText={(v) => { setGroq(v); setKeyStatus('idle'); }}
              placeholder="gsk_..."
              placeholderTextColor={t.textTertiary}
              autoCapitalize="none"
              autoCorrect={false}
              secureTextEntry={!showGroqKey}
            />
            <TouchableOpacity onPress={() => setShowGroqKey((v) => !v)} style={styles.eyeBtn} hitSlop={8}>
              {showGroqKey
                ? <EyeOffIcon size={18} color={t.textSecondary} />
                : <EyeIcon size={18} color={t.textSecondary} />}
            </TouchableOpacity>
          </View>
          {keyStatus !== 'idle' && (
            <View style={styles.keyStatusRow}>
              {keyStatus === 'checking' && (
                <>
                  <ActivityIndicator size="small" color={t.textSecondary} />
                  <Text style={[styles.keyStatusText, { color: t.textSecondary }]}>Validating key...</Text>
                </>
              )}
              {keyStatus === 'valid' && (
                <>
                  <CheckIcon size={14} color={t.statusSuccess} />
                  <Text style={[styles.keyStatusText, { color: t.statusSuccess }]}>Key is valid</Text>
                </>
              )}
              {keyStatus === 'invalid' && (
                <Text style={[styles.keyStatusText, { color: t.statusError }]}>Invalid key — check and try again</Text>
              )}
            </View>
          )}
        </View>

        <Text style={styles.sectionLabel}>Bible Translation</Text>

        {loadingBibles && (
          <View style={styles.loadingRow}>
            <ActivityIndicator size="small" color={t.textSecondary} />
            <Text style={[styles.keyStatusText, { color: t.textSecondary }]}>Loading translations...</Text>
          </View>
        )}

        <Text style={styles.groupLabel}>Built-in</Text>
        <View style={styles.card}>
          {LEGACY_TRANSLATIONS.map((tr, i) => (
            <React.Fragment key={tr.id}>
              <TouchableOpacity
                onPress={() => setTrans(tr.id)}
                style={styles.row}
                activeOpacity={0.6}
              >
                <View style={{ flex: 1 }}>
                  <Text style={styles.rowLabel}>{tr.label}</Text>
                  <Text style={styles.rowSub}>{tr.abbr} — {tr.language}</Text>
                </View>
                {translation === tr.id && <CheckIcon size={18} color={t.accentBlue} />}
              </TouchableOpacity>
              {i < LEGACY_TRANSLATIONS.length - 1 && <View style={styles.divider} />}
            </React.Fragment>
          ))}
        </View>

        {apiBibles.length > 0 && (
          <>
            <Text style={styles.groupLabel}>All Translations ({apiBibles.length})</Text>
            <View style={styles.searchWrap}>
              <TextInput
                style={styles.searchInput}
                placeholder="Search by name, language..."
                placeholderTextColor={t.textTertiary}
                value={bibleSearch}
                onChangeText={setBibleSearch}
                clearButtonMode="while-editing"
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>

            {apiGroups.map((group) => (
              <React.Fragment key={group.language}>
                <Text style={styles.langLabel}>{group.language}</Text>
                <View style={styles.card}>
                  {group.entries.map((tr, i) => (
                    <React.Fragment key={tr.id}>
                      <TouchableOpacity
                        onPress={() => setTrans(tr.id)}
                        style={styles.row}
                        activeOpacity={0.6}
                      >
                        <View style={{ flex: 1 }}>
                          <Text style={styles.rowLabel} numberOfLines={1}>{tr.label}</Text>
                          <Text style={styles.rowSub}>{tr.abbr}</Text>
                        </View>
                        {translation === tr.id && <CheckIcon size={18} color={t.accentBlue} />}
                      </TouchableOpacity>
                      {i < group.entries.length - 1 && <View style={styles.divider} />}
                    </React.Fragment>
                  ))}
                </View>
              </React.Fragment>
            ))}
          </>
        )}

        <Text style={styles.sectionLabel}>About</Text>
        <View style={styles.card}>
          <View style={styles.row}>
            <Text style={styles.rowLabel}>Version</Text>
            <Text style={styles.rowValue}>{Constants.expoConfig?.version ?? '1.0.0'}</Text>
          </View>
          <View style={styles.divider} />
          <TouchableOpacity
            style={styles.row}
            activeOpacity={0.6}
            onPress={() => void Linking.openURL('https://sermonize.app/privacy')}
          >
            <Text style={[styles.rowLabel, { color: t.accentBlue }]}>Privacy Policy</Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity style={styles.saveBtn} onPress={onSave} activeOpacity={0.8}>
          <Text style={styles.saveBtnText}>Save</Text>
        </TouchableOpacity>

      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function makeStyles(t: Colors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: t.bgPrimary },

    grabHandle: {
      width: 36,
      height: 5,
      borderRadius: 3,
      backgroundColor: t.textTertiary,
      alignSelf: 'center',
      marginTop: spacing.sm,
      marginBottom: 2,
    },
    modalHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: spacing.md,
      paddingVertical: 10,
    },
    modalTitle: { ...typography.headline, color: t.textPrimary },
    doneText: { ...typography.body, fontWeight: '600' },

    content: { paddingHorizontal: spacing.md, paddingTop: spacing.xs, paddingBottom: spacing.xl },

    sectionLabel: {
      ...typography.sectionHeader,
      color: t.textSecondary,
      marginBottom: spacing.sm,
      marginLeft: spacing.xs,
      marginTop: 20,
    },
    groupLabel: {
      ...typography.footnote,
      color: t.textSecondary,
      fontWeight: '600',
      marginBottom: spacing.sm,
      marginLeft: spacing.xs,
      marginTop: spacing.xs,
    },
    langLabel: {
      ...typography.caption,
      color: t.accentBlue,
      fontWeight: '600',
      marginBottom: spacing.xs,
      marginLeft: spacing.xs,
      marginTop: spacing.md,
    },

    card: {
      backgroundColor: t.bgSurface,
      borderRadius: radius.card,
      marginBottom: spacing.sm,
      overflow: 'hidden',
    },
    helpText: {
      ...typography.footnote,
      color: t.textSecondary,
      padding: spacing.md,
      lineHeight: 18,
    },
    divider: {
      height: StyleSheet.hairlineWidth,
      backgroundColor: t.separator,
      marginLeft: spacing.md,
    },

    keyRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: spacing.md,
      minHeight: spacing.rowMinHeight,
    },
    keyInput: {
      ...typography.body,
      color: t.textPrimary,
      flex: 1,
      paddingVertical: spacing.sm,
    },
    eyeBtn: { padding: spacing.xs },
    keyStatusRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
    },
    keyStatusText: { ...typography.footnote },

    loadingRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      marginBottom: spacing.sm,
      marginLeft: spacing.xs,
    },

    searchWrap: { marginBottom: spacing.sm },
    searchInput: {
      backgroundColor: t.bgSurface,
      borderRadius: radius.small,
      paddingHorizontal: 14,
      height: 40,
      fontSize: 15,
      color: t.textPrimary,
      borderWidth: 0.5,
      borderColor: t.separator,
    },

    row: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: spacing.md,
      minHeight: spacing.rowMinHeight,
      paddingVertical: spacing.sm,
    },
    rowLabel: { ...typography.body, color: t.textPrimary, flex: 1 },
    rowSub: { ...typography.footnote, color: t.textSecondary, marginTop: 2 },
    rowValue: { ...typography.body, color: t.textSecondary },

    saveBtn: {
      backgroundColor: t.accentBlue,
      borderRadius: radius.pill,
      height: 50,
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: spacing.sm,
    },
    saveBtnText: { ...typography.headline, color: '#FFFFFF' },
  });
}
