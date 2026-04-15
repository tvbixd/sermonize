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
  getAnthropicKey,
  getOpenAiKey,
  getTranslation,
  setAnthropicKey,
  setOpenAiKey,
  setTranslation,
} from '@/storage/keys';

const TRANSLATIONS = [
  { id: 'web', label: 'World English Bible' },
  { id: 'kjv', label: 'King James Version' },
  { id: 'bbe', label: 'Bible in Basic English' },
  { id: 'oeb-us', label: 'Open English Bible (US)' },
];

export default function SettingsScreen() {
  const [openai, setOpenai] = useState('');
  const [anthropic, setAnthropic] = useState('');
  const [translation, setTrans] = useState('web');
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    void (async () => {
      setOpenai((await getOpenAiKey()) ?? '');
      setAnthropic((await getAnthropicKey()) ?? '');
      setTrans(await getTranslation());
      setLoaded(true);
    })();
  }, []);

  const onSave = async () => {
    await setOpenAiKey(openai.trim());
    await setAnthropicKey(anthropic.trim());
    await setTranslation(translation);
    Alert.alert('Saved', 'Your settings have been stored securely on this device.');
  };

  if (!loaded) return null;

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.label}>OpenAI API Key</Text>
        <Text style={styles.help}>Used for Whisper transcription. Stored in secure storage on this device.</Text>
        <TextInput
          style={styles.input}
          value={openai}
          onChangeText={setOpenai}
          placeholder="sk-..."
          autoCapitalize="none"
          autoCorrect={false}
          secureTextEntry
        />

        <Text style={styles.label}>Anthropic API Key</Text>
        <Text style={styles.help}>Used for outlining via Claude. Stored in secure storage on this device.</Text>
        <TextInput
          style={styles.input}
          value={anthropic}
          onChangeText={setAnthropic}
          placeholder="sk-ant-..."
          autoCapitalize="none"
          autoCorrect={false}
          secureTextEntry
        />

        <Text style={styles.label}>Bible Translation</Text>
        <View style={styles.choices}>
          {TRANSLATIONS.map((t) => (
            <TouchableOpacity
              key={t.id}
              onPress={() => setTrans(t.id)}
              style={[styles.choice, translation === t.id && styles.choiceActive]}
            >
              <Text
                style={[styles.choiceText, translation === t.id && styles.choiceTextActive]}
              >
                {t.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <TouchableOpacity style={styles.save} onPress={onSave}>
          <Text style={styles.saveText}>Save</Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f1f5f9' },
  content: { padding: 20 },
  label: { fontSize: 15, fontWeight: '700', color: '#0f172a', marginTop: 16 },
  help: { fontSize: 13, color: '#64748b', marginTop: 4, marginBottom: 8 },
  input: {
    backgroundColor: '#fff',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    borderWidth: 1,
    borderColor: '#cbd5e1',
  },
  choices: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 },
  choice: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: '#e2e8f0',
  },
  choiceActive: { backgroundColor: '#0369a1' },
  choiceText: { color: '#334155', fontWeight: '600' },
  choiceTextActive: { color: '#fff' },
  save: {
    marginTop: 28,
    backgroundColor: '#0f172a',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  saveText: { color: '#fff', fontWeight: '700', fontSize: 16 },
});
