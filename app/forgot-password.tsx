import { useRouter } from 'expo-router';
import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '@/context/auth';
import { type Colors, radius, spacing, typography, useTheme } from '@/theme';

const APP_ICON = require('../assets/icon.png');

export default function ForgotPasswordScreen() {
  const router = useRouter();
  const t = useTheme();
  const s = useMemo(() => makeStyles(t), [t]);
  const { resetPassword } = useAuth();

  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const onReset = async () => {
    if (!email.trim()) return;
    setError('');
    setLoading(true);
    const { error: e } = await resetPassword(email.trim());
    setLoading(false);
    if (e) setError(e);
    else setSent(true);
  };

  return (
    <SafeAreaView style={s.container} edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={s.content}>
          <View style={s.header}>
            <Image source={APP_ICON} style={s.logo} />
            <Text style={s.title}>{sent ? 'Check your email.' : 'Reset password.'}</Text>
            <Text style={[s.subtitle, { maxWidth: 300 }]}>
              {sent
                ? `We sent a reset link to ${email}. Follow the link to set a new password.`
                : "Enter your email and we'll send you a link to reset your password."}
            </Text>
          </View>

          {!sent && (
            <>
              <View style={[s.inputCard, { backgroundColor: t.bgSurface }]}>
                <TextInput
                  style={[s.input, { color: t.textPrimary }]}
                  placeholder="Email"
                  placeholderTextColor={t.textTertiary}
                  value={email}
                  onChangeText={setEmail}
                  autoCapitalize="none"
                  autoCorrect={false}
                  keyboardType="email-address"
                  textContentType="emailAddress"
                  onSubmitEditing={onReset}
                  returnKeyType="go"
                />
              </View>

              {error ? <Text style={s.errorText}>{error}</Text> : null}

              <TouchableOpacity
                style={[s.primaryBtn, { backgroundColor: t.accentBlue }]}
                activeOpacity={0.85}
                onPress={onReset}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={s.primaryBtnText}>Send Reset Link</Text>
                )}
              </TouchableOpacity>
            </>
          )}

          <TouchableOpacity
            onPress={() => router.back()}
            activeOpacity={0.7}
            style={s.backBtn}
          >
            <Text style={[s.backText, { color: t.accentBlue }]}>Back to Sign In</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function makeStyles(t: Colors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: t.bgPrimary },
    content: { flex: 1, paddingHorizontal: spacing.lg, justifyContent: 'center' },

    header: { alignItems: 'center', marginBottom: 32 },
    logo: { width: 72, height: 72, borderRadius: 18, marginBottom: 20 },
    title: { fontSize: 28, fontWeight: '700', color: t.textPrimary, letterSpacing: -0.6, marginBottom: 8, textAlign: 'center' },
    subtitle: { ...typography.body, color: t.textSecondary, textAlign: 'center' },

    inputCard: { borderRadius: radius.card, overflow: 'hidden', marginBottom: 16 },
    input: { ...typography.body, paddingHorizontal: spacing.md, height: 50 },

    errorText: { ...typography.footnote, color: t.statusError, textAlign: 'center', marginBottom: 12 },

    primaryBtn: { height: 54, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
    primaryBtnText: { ...typography.headline, color: '#fff', fontSize: 18 },

    backBtn: { alignItems: 'center', paddingVertical: 10 },
    backText: { ...typography.subhead, fontWeight: '500' },
  });
}
