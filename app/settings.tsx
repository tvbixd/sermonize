import React, { useEffect, useState } from 'react';
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
import { colors, radius, spacing, typography } from '@/theme';

const TRANSLATIONS = [
  { id: 'web', label: 'World English Bible' },
  { id: 'kjv', label: 'King James Version' },
  { id: 'bbe', label: 'Bible in Basic English' },
  { id: 'oeb-us', label: 'Open English Bible (US)' },
];

export default function SettingsScreen() {
  const [groq, setGroq] = useState('');
  const [translation, setTrans] = useState('web');
  const [loaded, setLoaded] = useState(false);

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
            Sermonize uses Groq's free tier for transcription (Whisper) and outlining (Llama 3.3 70B). Create a free account at console.groq.com — no credit card required.
          </Text>
          <View style={styles.divider} />
          <TextInput
            style={styles.input}
            value={groq}
            onChangeText={setGroq}
            placeholder="gsk_..."
            placeholderTextColor={colors.textTertiary}
            autoCapitalize="none"
            autoCorrect={false}
            secureTextEntry
          />
        </View>

        <Text style={styles.sectionLabel}>BIBLE TRANSLATION</Text>
        <View style={styles.card}>
          {TRANSLATIONS.map((t, i) => (
            <React.Fragment key={t.id}>
              <TouchableOpacity
                onPress={() => setTrans(t.id)}
                style={styles.row}
                activeOpacity={0.6}
              >
                <Text style={styles.rowLabel}>{t.label}</Text>
                {translation === t.id ? (
                  <Text style={styles.checkmark}>✓</Text>
                ) : null}
              </TouchableOpacity>
              {i < TRANSLATIONS.length - 1 && <View style={styles.divider} />}
            </React.Fragment>
          ))}
        </View>

        <TouchableOpacity style={styles.saveBtn} onPress={onSave} activeOpacity={0.8}>
          <Text style={styles.saveBtnText}>Save Settings</Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bgPrimary },
  content: { padding: spacing.md, paddingTop: spacing.lg },

  sectionLabel: {
    ...typography.footnote,
    fontWeight: '600',
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: spacing.sm,
    marginLeft: spacing.xs,
  },

  card: {
    backgroundColor: colors.bgSurface,
    borderRadius: radius.card,
    marginBottom: spacing.lg,
    overflow: 'hidden',
  },
  helpText: {
    ...typography.footnote,
    color: colors.textSecondary,
    padding: spacing.md,
    lineHeight: 18,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.separator,
    marginLeft: spacing.md,
  },
  input: {
    ...typography.body,
    color: colors.textPrimary,
    padding: spacing.md,
    minHeight: spacing.rowMinHeight,
  },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    minHeight: spacing.rowMinHeight,
  },
  rowLabel: { ...typography.body, color: colors.textPrimary, flex: 1 },
  checkmark: { ...typography.headline, color: colors.accentBlue },

  saveBtn: {
    backgroundColor: colors.accentBlue,
    borderRadius: radius.card,
    paddingVertical: 15,
    alignItems: 'center',
    marginTop: spacing.sm,
  },
  saveBtnText: { ...typography.headline, color: '#FFFFFF' },
});
