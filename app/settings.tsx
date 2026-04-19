import React, { useEffect, useMemo, useState } from 'react';
import {
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
import {
  getGroqKey,
  getTranslation,
  setGroqKey,
  setTranslation,
} from '@/storage/keys';
import { type Colors, radius, spacing, typography, useTheme } from '@/theme';

const TRANSLATIONS = [
  { id: 'web', label: 'World English Bible', abbr: 'WEB — modern, public domain' },
  { id: 'kjv', label: 'King James Version', abbr: 'KJV — classic English' },
  { id: 'bbe', label: 'Bible in Basic English', abbr: 'BBE — simplified vocabulary' },
  { id: 'oeb-us', label: 'Open English Bible', abbr: 'OEB — contemporary, open' },
];

export default function SettingsScreen() {
  const [groq, setGroq] = useState('');
  const [translation, setTrans] = useState('web');
  const [loaded, setLoaded] = useState(false);
  const [showKey, setShowKey] = useState(false);
  const t = useTheme();
  const styles = useMemo(() => makeStyles(t), [t]);

  useEffect(() => {
    void (async () => {
      setGroq((await getGroqKey()) ?? '');
      setTrans(await getTranslation());
      setLoaded(true);
    })();
  }, []);

  const onSave = async () => {
    await setGroqKey(groq.trim());
    await setTranslation(translation);
    Alert.alert('Saved', 'Your settings have been stored securely on this device.');
  };

  if (!loaded) return null;

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>

        <Text style={styles.sectionLabel}>GROQ API KEY</Text>
        <View style={styles.card}>
          <Text style={styles.helpText}>
            Sermonize uses Groq for fast transcription and outlining. Create a free key at console.groq.com — no credit card required.
          </Text>
          <View style={styles.divider} />
          <View style={styles.keyRow}>
            <TextInput
              style={styles.keyInput}
              value={groq}
              onChangeText={setGroq}
              placeholder="gsk_..."
              placeholderTextColor={t.textTertiary}
              autoCapitalize="none"
              autoCorrect={false}
              secureTextEntry={!showKey}
            />
            <TouchableOpacity onPress={() => setShowKey((v) => !v)} style={styles.eyeBtn} hitSlop={8}>
              <Text style={styles.eyeIcon}>{showKey ? '🙈' : '👁'}</Text>
            </TouchableOpacity>
          </View>
        </View>

        <Text style={styles.sectionLabel}>BIBLE TRANSLATION</Text>
        <View style={styles.card}>
          {TRANSLATIONS.map((tr, i) => (
            <React.Fragment key={tr.id}>
              <TouchableOpacity
                onPress={() => setTrans(tr.id)}
                style={styles.row}
                activeOpacity={0.6}
              >
                <View style={{ flex: 1 }}>
                  <Text style={styles.rowLabel}>{tr.label}</Text>
                  <Text style={styles.rowSub}>{tr.abbr}</Text>
                </View>
                {translation === tr.id ? (
                  <Text style={styles.checkmark}>✓</Text>
                ) : null}
              </TouchableOpacity>
              {i < TRANSLATIONS.length - 1 && <View style={styles.divider} />}
            </React.Fragment>
          ))}
        </View>

        <Text style={styles.sectionLabel}>ABOUT</Text>
        <View style={styles.card}>
          <View style={styles.row}>
            <Text style={styles.rowLabel}>Version</Text>
            <Text style={styles.rowValue}>1.0.0</Text>
          </View>
          <View style={styles.divider} />
          <TouchableOpacity style={styles.row} activeOpacity={0.6}>
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
    content: { padding: spacing.md, paddingTop: spacing.lg, paddingBottom: spacing.xl },

    sectionLabel: {
      ...typography.sectionHeader,
      color: t.textSecondary,
      marginBottom: spacing.sm,
      marginLeft: spacing.xs,
    },

    card: {
      backgroundColor: t.bgSurface,
      borderRadius: radius.card,
      marginBottom: spacing.lg,
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
    eyeIcon: { fontSize: 16 },

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
    checkmark: { ...typography.headline, color: t.accentBlue },

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
