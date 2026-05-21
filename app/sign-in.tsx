import * as AppleAuthentication from 'expo-apple-authentication';
import * as Crypto from 'expo-crypto';
import { useRouter } from 'expo-router';
import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Image,
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
import { Svg, Path, Rect } from 'react-native-svg';
import { useAuth } from '@/context/auth';
import { type Colors, radius, spacing, typography, useTheme } from '@/theme';

const APP_ICON = require('../assets/icon.png');

export default function SignInScreen() {
  const router = useRouter();
  const t = useTheme();
  const s = useMemo(() => makeStyles(t), [t]);
  const { signInWithEmail, signInWithIdToken } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const onEmailSignIn = async () => {
    if (!email.trim() || !password) return;
    setError('');
    setLoading(true);
    const { error: e } = await signInWithEmail(email.trim(), password);
    setLoading(false);
    if (e) setError(e);
    else router.replace('/folders');
  };

  const onAppleSignIn = async () => {
    try {
      const nonce = Math.random().toString(36).substring(2);
      const hashedNonce = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, nonce);
      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
        nonce: hashedNonce,
      });
      if (credential.identityToken) {
        setLoading(true);
        const { error: e } = await signInWithIdToken('apple', credential.identityToken, nonce);
        setLoading(false);
        if (e) setError(e);
        else router.replace('/folders');
      }
    } catch (e: any) {
      if (e.code !== 'ERR_REQUEST_CANCELED') setError('Apple sign-in failed');
    }
  };

  const onGoogleSignIn = async () => {
    setError('Google sign-in requires project configuration. Add your Google OAuth credentials in Supabase dashboard.');
  };

  return (
    <SafeAreaView style={s.container} edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={s.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={s.header}>
            <Image source={APP_ICON} style={s.logo} />
            <Text style={s.title}>Welcome back.</Text>
            <Text style={s.subtitle}>Sign in to your Scribe account.</Text>
          </View>

          {/* Social buttons */}
          <View style={s.socialSection}>
            {Platform.OS === 'ios' && (
              <TouchableOpacity style={s.socialBtn} activeOpacity={0.8} onPress={onAppleSignIn}>
                <AppleIcon color={t.textPrimary} />
                <Text style={[s.socialBtnText, { color: t.textPrimary }]}>Continue with Apple</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity style={s.socialBtn} activeOpacity={0.8} onPress={onGoogleSignIn}>
              <GoogleIcon />
              <Text style={[s.socialBtnText, { color: t.textPrimary }]}>Continue with Google</Text>
            </TouchableOpacity>
          </View>

          {/* Divider */}
          <View style={s.dividerRow}>
            <View style={[s.dividerLine, { backgroundColor: t.separator }]} />
            <Text style={[s.dividerText, { color: t.textTertiary }]}>or</Text>
            <View style={[s.dividerLine, { backgroundColor: t.separator }]} />
          </View>

          {/* Email form */}
          <View style={s.form}>
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
              />
              <View style={[s.inputDivider, { backgroundColor: t.separator }]} />
              <TextInput
                style={[s.input, { color: t.textPrimary }]}
                placeholder="Password"
                placeholderTextColor={t.textTertiary}
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                textContentType="password"
                onSubmitEditing={onEmailSignIn}
                returnKeyType="go"
              />
            </View>

            <TouchableOpacity
              onPress={() => router.push('/forgot-password')}
              activeOpacity={0.7}
              style={s.forgotBtn}
            >
              <Text style={[s.forgotText, { color: t.accentBlue }]}>Forgot password?</Text>
            </TouchableOpacity>
          </View>

          {error ? <Text style={s.errorText}>{error}</Text> : null}

          <TouchableOpacity
            style={[s.primaryBtn, { backgroundColor: t.accentBlue }]}
            activeOpacity={0.85}
            onPress={onEmailSignIn}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={s.primaryBtnText}>Sign In</Text>
            )}
          </TouchableOpacity>

          <View style={s.footer}>
            <Text style={[s.footerText, { color: t.textSecondary }]}>Don't have an account?</Text>
            <TouchableOpacity onPress={() => router.replace('/sign-up')} activeOpacity={0.7}>
              <Text style={[s.footerLink, { color: t.accentBlue }]}> Sign Up</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function AppleIcon({ color = '#000' }: { color?: string }) {
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24" fill={color}>
      <Path d="M17.05 20.28c-.98.95-2.05.88-3.08.4-1.09-.5-2.08-.53-3.23 0-1.44.62-2.2.44-3.06-.4C3.79 16.17 4.36 9.02 8.93 8.76c1.28.07 2.16.73 2.91.78.99-.2 1.94-.78 3-.84 1.58.08 2.73.7 3.5 1.83-3.14 1.87-2.42 5.96.55 7.1-.65 1.7-1.48 3.37-2.84 4.67zM12.07 8.68c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z" />
    </Svg>
  );
}

function GoogleIcon() {
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
      <Path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
      <Path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
      <Path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18A10.96 10.96 0 0 0 1 12c0 1.77.42 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05" />
      <Path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
    </Svg>
  );
}

function makeStyles(t: Colors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: t.bgPrimary },
    content: { paddingHorizontal: spacing.lg, paddingTop: 40, paddingBottom: spacing.xl },

    header: { alignItems: 'center', marginBottom: 32 },
    logo: { width: 72, height: 72, borderRadius: 18, marginBottom: 20 },
    title: { fontSize: 28, fontWeight: '700', color: t.textPrimary, letterSpacing: -0.6, marginBottom: 8 },
    subtitle: { ...typography.body, color: t.textSecondary },

    socialSection: { gap: 10, marginBottom: 20 },
    socialBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 10,
      height: 50,
      borderRadius: radius.card,
      backgroundColor: t.bgSurface,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: t.separator,
    },
    socialBtnText: { ...typography.headline, fontWeight: '500' },

    dividerRow: { flexDirection: 'row', alignItems: 'center', gap: 16, marginBottom: 20 },
    dividerLine: { flex: 1, height: StyleSheet.hairlineWidth },
    dividerText: { ...typography.footnote },

    form: { marginBottom: 16 },
    inputCard: { borderRadius: radius.card, overflow: 'hidden' },
    input: { ...typography.body, paddingHorizontal: spacing.md, height: 50 },
    inputDivider: { height: StyleSheet.hairlineWidth, marginLeft: spacing.md },
    forgotBtn: { alignSelf: 'flex-end', paddingVertical: 10 },
    forgotText: { ...typography.footnote, fontWeight: '500' },

    errorText: { ...typography.footnote, color: t.statusError, textAlign: 'center', marginBottom: 12 },

    primaryBtn: { height: 54, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
    primaryBtnText: { ...typography.headline, color: '#fff', fontSize: 18 },

    footer: { flexDirection: 'row', justifyContent: 'center', paddingVertical: spacing.sm },
    footerText: { ...typography.subhead },
    footerLink: { ...typography.subhead, fontWeight: '600' },
  });
}
