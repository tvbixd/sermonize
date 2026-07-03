import { Audio } from 'expo-av';
import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Easing,
  Image,
  Keyboard,
  KeyboardAvoidingView,
  Linking,
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
import { Circle, Path, Rect, Svg } from 'react-native-svg';
import * as WebBrowser from 'expo-web-browser';
import { CheckIcon, MicIcon } from '@/components/icons';
import { GROQ_CONSOLE_URL } from '@/config/support';
import { OAUTH_CANCELLED, useAuth } from '@/context/auth';
import { setGroqKey, setTranslation } from '@/storage/keys';
import { type Colors, radius, spacing, typography, useTheme } from '@/theme';

const APP_ICON = require('../assets/icon.png');

// Completes any pending OAuth browser session when the app regains focus.
WebBrowser.maybeCompleteAuthSession();

const isValidEmail = (e: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);

type AuthStep = 'landing' | 'email' | 'otp' | 'name' | 'mic' | 'groq' | 'translation' | 'success';

// ─── SVG Glyphs ──────────────────────────────────────────────────────────────

function AppleGlyph({ color = '#fff' }: { color?: string }) {
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24">
      <Path
        fill={color}
        d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2.01.76-3.27.81-1.31.05-2.31-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11"
      />
    </Svg>
  );
}

function GoogleGlyph() {
  return (
    <Svg width={18} height={18} viewBox="0 0 18 18">
      <Path d="M17.6 9.2c0-.6-.1-1.3-.2-1.8H9v3.4h4.8c-.2 1.1-.8 2.1-1.8 2.7v2.2h2.9c1.7-1.6 2.7-3.9 2.7-6.5z" fill="#4285F4" />
      <Path d="M9 18c2.4 0 4.5-.8 6-2.2l-2.9-2.2c-.8.5-1.8.9-3.1.9-2.4 0-4.4-1.6-5.2-3.8H.9v2.3C2.3 15.8 5.4 18 9 18z" fill="#34A853" />
      <Path d="M3.8 10.7c-.2-.6-.3-1.2-.3-1.9 0-.7.1-1.3.3-1.9V4.6H.9C.3 5.9 0 7.4 0 8.9c0 1.5.3 3 .9 4.3l2.9-2.5z" fill="#FBBC04" />
      <Path d="M9 3.6c1.3 0 2.5.5 3.4 1.4l2.6-2.6C13.5.9 11.4 0 9 0 5.4 0 2.3 2.2.9 4.6l2.9 2.3C4.6 5.2 6.6 3.6 9 3.6z" fill="#EA4335" />
    </Svg>
  );
}

function MailGlyph({ color = '#fff' }: { color?: string }) {
  return (
    <Svg width={18} height={18} viewBox="0 0 18 18" fill="none">
      <Rect x={1.5} y={3.5} width={15} height={11} rx={2} stroke={color} strokeWidth={1.6} />
      <Path d="M2 5l7 5 7-5" stroke={color} strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

function PersonGlyph({ color }: { color: string }) {
  return (
    <Svg width={18} height={18} viewBox="0 0 18 18" fill="none">
      <Circle cx={9} cy={7} r={3.5} stroke={color} strokeWidth={1.6} />
      <Path d="M2 16c.8-3 3.7-4.5 7-4.5s6.2 1.5 7 4.5" stroke={color} strokeWidth={1.6} strokeLinecap="round" />
    </Svg>
  );
}

function BackChevron({ color }: { color: string }) {
  return (
    <Svg width={10} height={16} viewBox="0 0 10 16" fill="none">
      <Path d="M9 1L2 8l7 7" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

// ─── Shared Components ───────────────────────────────────────────────────────

function NavBar({ onBack, t }: { onBack?: () => void; t: Colors }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 18, height: 44 }}>
      {onBack ? (
        <TouchableOpacity
          onPress={onBack}
          activeOpacity={0.7}
          hitSlop={12}
          style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}
        >
          <BackChevron color={t.accentBlue} />
          <Text style={{ color: t.accentBlue, fontSize: 17, marginLeft: 2 }}>Back</Text>
        </TouchableOpacity>
      ) : (
        <View style={{ width: 40 }} />
      )}
    </View>
  );
}

// ─── Auth Flow ───────────────────────────────────────────────────────────────

export function AuthFlow({ initialMode = 'signin' }: { initialMode?: 'signin' | 'signup' }) {
  const router = useRouter();
  const t = useTheme();
  const s = useMemo(() => makeStyles(t), [t]);
  const { sendOtp, verifyOtp, signInWithOAuth, updateProfile, session, setTestUser } = useAuth();

  const [step, setStep] = useState<AuthStep>('landing');
  const [mode, setMode] = useState<'signin' | 'signup'>(initialMode);
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [otpState, setOtpState] = useState<'idle' | 'verifying' | 'error' | 'success'>('idle');
  const [isNewUser, setIsNewUser] = useState(false);
  const [resendSeconds, setResendSeconds] = useState(45);

  const verifyingRef = useRef(false);
  const stepFade = useRef(new Animated.Value(1)).current;
  const shakeAnim = useRef(new Animated.Value(0)).current;

  const goToStep = useCallback((next: AuthStep) => {
    Animated.timing(stepFade, { toValue: 0.3, duration: 80, useNativeDriver: true }).start(() => {
      setStep(next);
      setError('');
      Animated.timing(stepFade, { toValue: 1, duration: 150, useNativeDriver: true }).start();
    });
  }, [stepFade]);

  useEffect(() => {
    if (step !== 'otp' || resendSeconds <= 0) return;
    const id = setTimeout(() => setResendSeconds(prev => prev - 1), 1000);
    return () => clearTimeout(id);
  }, [step, resendSeconds]);

  useEffect(() => {
    if (code.length === 6 && !verifyingRef.current) {
      doVerifyOtp(code);
    }
  }, [code]);

  const shakeSlots = () => {
    Animated.sequence([
      Animated.timing(shakeAnim, { toValue: 10, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -10, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 8, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -8, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 4, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 0, duration: 50, useNativeDriver: true }),
    ]).start();
  };

  const handleSendOtp = async () => {
    if (!isValidEmail(email.trim())) return;
    setLoading(true);
    setError('');
    const { error: e } = await sendOtp(email.trim());
    setLoading(false);
    if (e) {
      // Stay on the email step — advancing to the code screen when no code
      // was sent strands the user.
      setError(e);
      return;
    }
    setResendSeconds(45);
    setCode('');
    setOtpState('idle');
    verifyingRef.current = false;
    goToStep('otp');
  };

  const doVerifyOtp = async (otpCode: string) => {
    if (verifyingRef.current) return;
    verifyingRef.current = true;
    setOtpState('verifying');

    if (__DEV__ && otpCode === '000000') {
      verifyingRef.current = false;
      setOtpState('success');
      Keyboard.dismiss();
      setIsNewUser(true);
      setTimeout(() => goToStep('name'), 600);
      return;
    }

    const { error: e, isNewUser: newUser, userName } = await verifyOtp(email.trim(), otpCode);
    verifyingRef.current = false;
    if (e) {
      setOtpState('error');
      shakeSlots();
      return;
    }
    setOtpState('success');
    Keyboard.dismiss();
    setIsNewUser(newUser);
    if (newUser) {
      setTimeout(() => goToStep('name'), 600);
    } else {
      setDisplayName(userName || email.split('@')[0]);
      setTimeout(() => goToStep('success'), 600);
    }
  };

  const handleResend = async () => {
    setError('');
    const { error: e } = await sendOtp(email.trim());
    if (e) { setError(e); return; }
    setResendSeconds(45);
    setCode('');
    setOtpState('idle');
    verifyingRef.current = false;
  };

  const handleName = async () => {
    if (!name.trim()) return;
    setLoading(true);
    setError('');
    if (session) {
      const { error: e } = await updateProfile({ display_name: name.trim() });
      if (e) setError(e);
    } else {
      setTestUser(email.trim(), name.trim());
    }
    setLoading(false);
    setDisplayName(name.trim());
    goToStep('mic');
  };

  const handleOAuth = async (provider: 'google' | 'apple') => {
    setLoading(true);
    setError('');
    const { error: e, isNewUser: newUser, userName } = await signInWithOAuth(provider);
    setLoading(false);
    if (e === OAUTH_CANCELLED) return; // user closed the browser — not an error
    if (e) {
      setError(e);
      return;
    }
    setIsNewUser(newUser);
    if (newUser) {
      goToStep('name');
    } else {
      setDisplayName(userName || email.split('@')[0] || 'there');
      goToStep('success');
    }
  };

  const handleApple = () => void handleOAuth('apple');
  const handleGoogle = () => void handleOAuth('google');

  const handleCodeChange = (text: string) => {
    if (otpState === 'verifying' || otpState === 'success') return;
    const digits = text.replace(/[^0-9]/g, '');
    if (digits.length <= 6) {
      setCode(digits);
      if (otpState === 'error') setOtpState('idle');
    }
  };

  return (
    <SafeAreaView style={s.container} edges={['top', 'bottom']}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <Animated.View style={{ flex: 1, opacity: stepFade }}>
          {step === 'landing' && (
            <LandingView
              mode={mode}
              onApple={handleApple}
              onGoogle={handleGoogle}
              onEmail={() => goToStep('email')}
              onToggleMode={() => setMode((m) => (m === 'signin' ? 'signup' : 'signin'))}
              loading={loading}
              error={error}
              t={t}
              s={s}
            />
          )}
          {step === 'email' && (
            <EmailView
              email={email}
              onChangeEmail={setEmail}
              onContinue={handleSendOtp}
              onBack={() => goToStep('landing')}
              loading={loading}
              error={error}
              t={t}
              s={s}
            />
          )}
          {step === 'otp' && (
            <OTPView
              email={email}
              code={code}
              onChangeCode={handleCodeChange}
              otpState={otpState}
              resendSeconds={resendSeconds}
              onResend={handleResend}
              onBack={() => {
                setCode('');
                setOtpState('idle');
                verifyingRef.current = false;
                shakeAnim.setValue(0);
                goToStep('email');
              }}
              shakeAnim={shakeAnim}
              error={error}
              t={t}
              s={s}
            />
          )}
          {step === 'name' && (
            <NameView
              name={name}
              onChangeName={setName}
              onContinue={handleName}
              loading={loading}
              error={error}
              t={t}
              s={s}
            />
          )}
          {step === 'mic' && (
            <MicSetupView
              onNext={() => goToStep('groq')}
              t={t}
              s={s}
            />
          )}
          {step === 'groq' && (
            <GroqSetupView
              onNext={() => goToStep('translation')}
              t={t}
              s={s}
            />
          )}
          {step === 'translation' && (
            <TranslationSetupView
              onNext={() => goToStep('success')}
              t={t}
              s={s}
            />
          )}
          {step === 'success' && (
            <SuccessView
              displayName={displayName}
              isNewUser={isNewUser}
              onContinue={() => router.replace('/folders')}
              t={t}
              s={s}
            />
          )}
        </Animated.View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// ─── Landing ─────────────────────────────────────────────────────────────────

function LandingView({
  mode, onApple, onGoogle, onEmail, onToggleMode, loading, error, t, s,
}: {
  mode: 'signin' | 'signup';
  onApple: () => void;
  onGoogle: () => void;
  onEmail: () => void;
  onToggleMode: () => void;
  loading: boolean;
  error: string;
  t: Colors;
  s: ReturnType<typeof makeStyles>;
}) {
  const router = useRouter();
  const floatAnim = useRef(new Animated.Value(0)).current;
  const textFade = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(floatAnim, { toValue: 1, duration: 2000, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(floatAnim, { toValue: 0, duration: 2000, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ])
    );
    anim.start();
    Animated.timing(textFade, { toValue: 1, duration: 500, delay: 100, useNativeDriver: true }).start();
    return () => anim.stop();
  }, []);

  const translateY = floatAnim.interpolate({ inputRange: [0, 1], outputRange: [0, -10] });
  const scale = floatAnim.interpolate({ inputRange: [0, 0.5, 1], outputRange: [1, 1.04, 1] });

  return (
    <View style={{ flex: 1 }}>
      <NavBar t={t} />

      <View style={s.landingCenter}>
        <Animated.View style={{ transform: [{ translateY }, { scale }] }}>
          <View style={s.logoWrap}>
            <Image source={APP_ICON} style={s.logoImage} />
          </View>
        </Animated.View>

        <Animated.View style={{ opacity: textFade, alignItems: 'center' }}>
          <Text style={s.landingTitle}>
            {mode === 'signin' ? 'Welcome to Scribe.' : 'Create your account.'}
          </Text>
          <Text style={s.landingSubtitle}>
            {mode === 'signin'
              ? 'Sign in to sync your sermons across devices.'
              : 'Sign up to back up your sermons and access them anywhere.'}
          </Text>
        </Animated.View>
      </View>

      <Animated.View style={[s.providerSection, { opacity: textFade }]}>
        {error ? <Text style={s.errorText}>{error}</Text> : null}

        {Platform.OS === 'ios' && (
          <TouchableOpacity
            style={[s.providerBtn, { backgroundColor: '#000' }]}
            activeOpacity={0.85}
            onPress={onApple}
            disabled={loading}
            accessibilityRole="button"
            accessibilityLabel="Continue with Apple"
          >
            <AppleGlyph color="#fff" />
            <Text style={[s.providerBtnText, { color: '#fff' }]}>Continue with Apple</Text>
          </TouchableOpacity>
        )}

        <TouchableOpacity
          style={[s.providerBtn, { backgroundColor: t.bgSurface, borderWidth: 0.5, borderColor: t.separator }]}
          activeOpacity={0.85}
          onPress={onGoogle}
          disabled={loading}
          accessibilityRole="button"
          accessibilityLabel="Continue with Google"
        >
          <GoogleGlyph />
          <Text style={[s.providerBtnText, { color: t.textPrimary }]}>Continue with Google</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[s.providerBtn, { backgroundColor: t.accentBlue }]}
          activeOpacity={0.85}
          onPress={onEmail}
          disabled={loading}
          accessibilityRole="button"
          accessibilityLabel="Continue with email"
        >
          <MailGlyph color="#fff" />
          <Text style={[s.providerBtnText, { color: '#fff' }]}>Continue with email</Text>
        </TouchableOpacity>

        <TouchableOpacity onPress={onToggleMode} style={{ alignSelf: 'center', paddingVertical: 8 }} hitSlop={8}>
          <Text style={[typography.subhead, { color: t.textSecondary }]}>
            {mode === 'signin' ? "Don't have an account? " : 'Already have an account? '}
            <Text style={{ color: t.accentBlue, fontWeight: '600' }}>
              {mode === 'signin' ? 'Sign up' : 'Sign in'}
            </Text>
          </Text>
        </TouchableOpacity>

        <Text style={s.termsText}>
          By continuing, you agree to our{' '}
          <Text
            style={{ color: t.accentBlue, fontWeight: '500' }}
            onPress={() => router.push('/legal/terms')}
            accessibilityRole="link"
          >Terms</Text>{' '}
          and{' '}
          <Text
            style={{ color: t.accentBlue, fontWeight: '500' }}
            onPress={() => router.push('/legal/privacy')}
            accessibilityRole="link"
          >Privacy Policy</Text>.
        </Text>
      </Animated.View>
    </View>
  );
}

// ─── Email Entry ─────────────────────────────────────────────────────────────

function EmailView({
  email, onChangeEmail, onContinue, onBack, loading, error, t, s,
}: {
  email: string;
  onChangeEmail: (text: string) => void;
  onContinue: () => void;
  onBack: () => void;
  loading: boolean;
  error: string;
  t: Colors;
  s: ReturnType<typeof makeStyles>;
}) {
  return (
    <View style={{ flex: 1 }}>
      <NavBar onBack={onBack} t={t} />

      <View style={s.stepHeader}>
        <Text style={s.stepTitle}>What's your email?</Text>
        <Text style={s.stepSubtitle}>
          We'll send you a one-time code. No password to remember.
        </Text>
      </View>

      <View style={s.inputSection}>
        <View style={[s.inputCard, { backgroundColor: t.bgSurface }]}>
          <View style={s.inputRow}>
            <View style={[s.iconCircle, { backgroundColor: `${t.accentBlue}1A` }]}>
              <MailGlyph color={t.accentBlue} />
            </View>
            <TextInput
              style={[s.textInput, { color: t.textPrimary }]}
              placeholder="you@example.com"
              placeholderTextColor={t.textTertiary}
              value={email}
              onChangeText={onChangeEmail}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
              textContentType="emailAddress"
              autoFocus
              onSubmitEditing={onContinue}
              returnKeyType="go"
            />
            {email.length > 0 && (
              <TouchableOpacity onPress={() => onChangeEmail('')} style={{ padding: 2 }}>
                <View style={[s.clearCircle, { backgroundColor: t.textTertiary }]}>
                  <Text style={{ color: '#fff', fontSize: 11, fontWeight: '700' }}>✕</Text>
                </View>
              </TouchableOpacity>
            )}
          </View>
        </View>
        <Text style={[s.hintText, error ? { color: t.statusError } : { color: t.textSecondary }]}>
          {error || "You'll get a 6-digit code by email — check spam if you don't see it"}
        </Text>
      </View>

      <View style={{ flex: 1 }} />

      <View style={s.bottomAction}>
        <TouchableOpacity
          style={[
            s.primaryBtn,
            { backgroundColor: isValidEmail(email.trim()) && !loading ? t.accentBlue : '#C7C7CC' },
          ]}
          activeOpacity={0.85}
          onPress={onContinue}
          disabled={!isValidEmail(email.trim()) || loading}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={s.primaryBtnText}>Continue</Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ─── OTP ─────────────────────────────────────────────────────────────────────

function OTPView({
  email, code, onChangeCode, otpState, resendSeconds, onResend, onBack, shakeAnim, error, t, s,
}: {
  email: string;
  code: string;
  onChangeCode: (text: string) => void;
  otpState: 'idle' | 'verifying' | 'error' | 'success';
  resendSeconds: number;
  onResend: () => void;
  onBack: () => void;
  shakeAnim: Animated.Value;
  error: string;
  t: Colors;
  s: ReturnType<typeof makeStyles>;
}) {
  const otpInputRef = useRef<TextInput>(null);

  return (
    <View style={{ flex: 1 }}>
      <NavBar onBack={onBack} t={t} />

      <View style={s.stepHeader}>
        <Text style={s.stepTitle}>Check your email.</Text>
        <Text style={s.stepSubtitle}>
          We sent a 6-digit code to{' '}
          <Text style={{ color: t.textPrimary, fontWeight: '500' }}>{email}</Text>.
        </Text>
      </View>

      <View style={s.otpSection}>
        <Pressable onPress={() => otpInputRef.current?.focus()}>
          <Animated.View style={[s.otpSlotsRow, { transform: [{ translateX: shakeAnim }] }]}>
            {[0, 1, 2, 3, 4, 5].map((i) => {
              const isActive = i === code.length && otpState === 'idle';
              const filled = i < code.length;
              const isError = otpState === 'error';
              return (
                <View
                  key={i}
                  style={[
                    s.otpSlot,
                    { backgroundColor: t.bgSurface },
                    isError
                      ? { borderWidth: 1.5, borderColor: t.statusError }
                      : isActive
                        ? { borderWidth: 1.5, borderColor: t.accentBlue }
                        : { borderWidth: 0.5, borderColor: t.separator },
                    isActive && Platform.OS === 'ios' && {
                      shadowColor: t.accentBlue,
                      shadowOffset: { width: 0, height: 0 },
                      shadowOpacity: 0.1,
                      shadowRadius: 3,
                    },
                  ]}
                >
                  {filled && (
                    <Text style={[s.otpDigit, { color: isError ? t.statusError : t.textPrimary }]}>
                      {code[i]}
                    </Text>
                  )}
                </View>
              );
            })}
          </Animated.View>
        </Pressable>

        <TextInput
          ref={otpInputRef}
          value={code}
          onChangeText={onChangeCode}
          maxLength={6}
          keyboardType="number-pad"
          textContentType="oneTimeCode"
          autoFocus
          caretHidden
          style={{ position: 'absolute', width: 1, height: 1, opacity: 0 }}
        />

        <View style={s.otpStatusRow}>
          {otpState === 'verifying' && (
            <>
              <ActivityIndicator size="small" color={t.accentBlue} />
              <Text style={[s.otpStatusText, { color: t.textSecondary }]}>Verifying...</Text>
            </>
          )}
          {otpState === 'error' && (
            <Text style={[s.otpStatusText, { color: t.statusError, fontWeight: '500' }]}>
              That code didn't match. Check your email and try again.
            </Text>
          )}
          {otpState === 'success' && (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <Svg width={14} height={14} viewBox="0 0 14 14" fill="none">
                <Path d="M3 7.5l2.5 2.5L11 4" stroke="#30B65B" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
              </Svg>
              <Text style={[s.otpStatusText, { color: '#30B65B', fontWeight: '500' }]}>
                Code verified
              </Text>
            </View>
          )}
          {error && otpState === 'idle' && (
            <Text style={[s.otpStatusText, { color: t.statusError }]}>{error}</Text>
          )}
        </View>
      </View>

      <View style={{ flex: 1, alignItems: 'center', paddingTop: 8 }}>
        <TouchableOpacity
          onPress={onResend}
          disabled={resendSeconds > 0}
          activeOpacity={0.7}
        >
          <Text style={[s.resendText, { color: resendSeconds > 0 ? t.textSecondary : t.accentBlue }]}>
            {resendSeconds > 0
              ? `Resend in 0:${String(resendSeconds).padStart(2, '0')}`
              : 'Resend code'}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ─── Name Entry ──────────────────────────────────────────────────────────────

function NameView({
  name, onChangeName, onContinue, loading, error, t, s,
}: {
  name: string;
  onChangeName: (text: string) => void;
  onContinue: () => void;
  loading: boolean;
  error: string;
  t: Colors;
  s: ReturnType<typeof makeStyles>;
}) {
  return (
    <View style={{ flex: 1 }}>
      <NavBar t={t} />

      <View style={s.stepHeader}>
        <Text style={s.stepTitle}>What should we call you?</Text>
        <Text style={s.stepSubtitle}>
          This is the name your team will see when you share sermons.
        </Text>
      </View>

      <View style={s.inputSection}>
        <View style={[s.inputCard, { backgroundColor: t.bgSurface }]}>
          <View style={s.inputRow}>
            <View style={[s.iconCircle, { backgroundColor: `${t.accentBlue}1A` }]}>
              <PersonGlyph color={t.accentBlue} />
            </View>
            <TextInput
              style={[s.textInput, { color: t.textPrimary }]}
              placeholder="Daniel Ayowole"
              placeholderTextColor={t.textTertiary}
              value={name}
              onChangeText={onChangeName}
              autoCapitalize="words"
              textContentType="name"
              autoFocus
              onSubmitEditing={onContinue}
              returnKeyType="done"
            />
          </View>
        </View>
        <Text style={[s.hintText, error ? { color: t.statusError } : { color: t.textSecondary }]}>
          {error || 'You can change this any time in Settings.'}
        </Text>
      </View>

      <View style={{ flex: 1 }} />

      <View style={s.bottomAction}>
        <TouchableOpacity
          style={[
            s.primaryBtn,
            { backgroundColor: name.trim() && !loading ? t.accentBlue : '#C7C7CC' },
          ]}
          activeOpacity={0.85}
          onPress={onContinue}
          disabled={!name.trim() || loading}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={s.primaryBtnText}>Continue</Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ─── Mic Setup ──────────────────────────────────────────────────────────────

function MicSetupView({ onNext, t, s }: { onNext: () => void; t: Colors; s: ReturnType<typeof makeStyles> }) {
  const [granted, setGranted] = useState(false);
  const floatAnim = useRef(new Animated.Value(0)).current;
  const grantedScale = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(floatAnim, { toValue: 1, duration: 2000, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(floatAnim, { toValue: 0, duration: 2000, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ])
    ).start();
  }, []);

  const requestPermission = async () => {
    try {
      const { granted: g } = await Audio.requestPermissionsAsync();
      if (g) {
        setGranted(true);
        Animated.spring(grantedScale, { toValue: 1, friction: 5, tension: 80, useNativeDriver: true }).start();
        setTimeout(onNext, 1000);
      }
    } catch {
      setGranted(false);
    }
  };

  const translateY = floatAnim.interpolate({ inputRange: [0, 1], outputRange: [0, -8] });

  return (
    <View style={{ flex: 1 }}>
      <NavBar t={t} />
      <View style={s.setupCenter}>
        {granted ? (
          <Animated.View style={[s.grantedCircle, { transform: [{ scale: grantedScale }] }]}>
            <Svg width={52} height={52} viewBox="0 0 58 58" fill="none">
              <Path d="M14 30l10 10 20-22" stroke="#fff" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
            </Svg>
          </Animated.View>
        ) : (
          <Animated.View style={[s.micCircleLarge, { backgroundColor: t.accentBlue, transform: [{ translateY }] }]}>
            <MicIcon size={36} color="#fff" />
          </Animated.View>
        )}
        <Text style={s.setupTitle}>
          {granted ? 'You’re all set.' : 'Let Scribe hear you.'}
        </Text>
        <Text style={s.setupSub}>
          {granted
            ? 'Microphone access granted.'
            : 'Scribe needs microphone access to record your sermons. Recordings are saved on your device and sent to Groq only for transcription.'}
        </Text>
      </View>
      <View style={s.bottomAction}>
        {granted ? (
          <TouchableOpacity style={[s.primaryBtn, { backgroundColor: t.accentBlue }]} activeOpacity={0.85} onPress={onNext}>
            <Text style={s.primaryBtnText}>Continue</Text>
          </TouchableOpacity>
        ) : (
          <>
            <TouchableOpacity style={[s.primaryBtn, { backgroundColor: t.accentBlue }]} activeOpacity={0.85} onPress={requestPermission}>
              <Text style={s.primaryBtnText}>Allow Microphone Access</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={onNext} activeOpacity={0.7} style={{ alignItems: 'center', paddingVertical: 10 }}>
              <Text style={{ ...typography.subhead, color: t.textSecondary, fontWeight: '500' }}>Not now</Text>
            </TouchableOpacity>
          </>
        )}
      </View>
    </View>
  );
}

// ─── Groq Setup ─────────────────────────────────────────────────────────────

function GroqSetupView({ onNext, t, s }: { onNext: () => void; t: Colors; s: ReturnType<typeof makeStyles> }) {
  const [key, setKey] = useState('');
  const [status, setStatus] = useState<'empty' | 'verifying' | 'valid' | 'invalid'>('empty');

  const validate = async (k: string) => {
    if (!k.trim()) { setStatus('empty'); return; }
    setStatus('verifying');
    try {
      const resp = await fetch('https://api.groq.com/openai/v1/models', {
        headers: { Authorization: `Bearer ${k.trim()}` },
      });
      setStatus(resp.ok ? 'valid' : 'invalid');
    } catch {
      setStatus('invalid');
    }
  };

  const onChangeKey = (v: string) => { setKey(v); setStatus('empty'); };
  const onSubmitKey = () => void validate(key);

  const onContinue = async () => {
    if (status === 'valid') await setGroqKey(key.trim());
    onNext();
  };

  return (
    <View style={{ flex: 1 }}>
      <NavBar t={t} />
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingHorizontal: spacing.lg, paddingTop: 20, paddingBottom: spacing.md }} keyboardShouldPersistTaps="handled">
        <View style={s.setupIconWrap}>
          <Svg width={28} height={28} viewBox="0 0 24 24" fill="none">
            <Rect x="3" y="11" width="18" height="11" rx="2" stroke={t.accentBlue} strokeWidth="1.8" />
            <Path d="M7 11V7a5 5 0 0 1 10 0v4" stroke={t.accentBlue} strokeWidth="1.8" strokeLinecap="round" />
            <Circle cx="12" cy="16.5" r="1.5" fill={t.accentBlue} />
          </Svg>
        </View>
        <Text style={s.stepTitle}>Add your Groq key.</Text>
        <Text style={[s.stepSubtitle, { marginBottom: 24 }]}>
          Scribe uses Groq for fast, private transcription. The free tier covers most preachers.
        </Text>

        <View style={[s.groqCard, { backgroundColor: t.bgSurface }]}>
          <TextInput
            style={s.groqInput}
            value={key}
            onChangeText={onChangeKey}
            onEndEditing={onSubmitKey}
            placeholder="gsk_..."
            placeholderTextColor={t.textTertiary}
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="done"
            onSubmitEditing={onSubmitKey}
          />
          {key.length > 0 && (
            <TouchableOpacity onPress={() => { setKey(''); setStatus('empty'); }} style={{ padding: 4 }}>
              <View style={[s.clearCircle, { backgroundColor: t.textTertiary }]}>
                <Text style={{ color: '#fff', fontSize: 11, fontWeight: '700' }}>{'✕'}</Text>
              </View>
            </TouchableOpacity>
          )}
        </View>

        <View style={s.groqStatus}>
          {status === 'verifying' && (
            <>
              <ActivityIndicator size="small" color={t.accentBlue} />
              <Text style={[s.groqStatusText, { color: t.textSecondary }]}>Verifying…</Text>
            </>
          )}
          {status === 'valid' && (
            <>
              <CheckIcon size={14} color={t.statusSuccess} />
              <Text style={[s.groqStatusText, { color: t.statusSuccess }]}>Key looks good</Text>
            </>
          )}
          {status === 'invalid' && (
            <Text style={[s.groqStatusText, { color: t.statusError }]}>That key didn't work. Double-check and try again.</Text>
          )}
        </View>

        <TouchableOpacity
          style={[s.groqHelp, { backgroundColor: t.bgSurface }]}
          activeOpacity={0.7}
          onPress={() => void Linking.openURL(GROQ_CONSOLE_URL)}
          accessibilityRole="link"
          accessibilityLabel="Open Groq console to create an API key"
        >
          <View style={[s.groqHelpIcon, { backgroundColor: `${t.accentBlue}1A` }]}>
            <Svg width={16} height={16} viewBox="0 0 16 16" fill="none">
              <Circle cx="8" cy="8" r="7" stroke={t.accentBlue} strokeWidth="1.5" />
              <Path d="M6 6a2 2 0 1 1 3 1.6c-.6.4-1 .6-1 1.2M8 11.5v.01" stroke={t.accentBlue} strokeWidth="1.5" strokeLinecap="round" />
            </Svg>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ ...typography.subhead, fontWeight: '500', color: t.textPrimary, marginBottom: 2 }}>Don't have a key?</Text>
            <Text style={{ ...typography.footnote, color: t.textSecondary }}>Open console.groq.com — takes two minutes.</Text>
          </View>
        </TouchableOpacity>
      </ScrollView>

      <View style={s.bottomAction}>
        <TouchableOpacity
          style={[s.primaryBtn, { backgroundColor: status === 'valid' ? t.accentBlue : '#C7C7CC' }]}
          activeOpacity={0.85}
          onPress={onContinue}
          disabled={status !== 'valid'}
        >
          <Text style={s.primaryBtnText}>Continue</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={onNext} activeOpacity={0.7} style={{ alignItems: 'center', paddingVertical: 10 }}>
          <Text style={{ ...typography.subhead, color: t.textSecondary, fontWeight: '500' }}>I'll add it later</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ─── Translation Setup ──────────────────────────────────────────────────────

const SETUP_TRANSLATIONS = [
  { id: 'kjv', label: 'King James Version', abbr: 'KJV', desc: 'Classic English. Familiar cadence.' },
  { id: 'nlt', label: 'New Living Translation', abbr: 'NLT', desc: 'Clear, natural language.' },
  { id: 'niv', label: 'New International Version', abbr: 'NIV', desc: 'Balanced accuracy and readability.' },
  { id: 'amp', label: 'Amplified Bible', abbr: 'AMP', desc: 'Expanded meanings and nuance.' },
];

function TranslationSetupView({ onNext, t, s }: { onNext: () => void; t: Colors; s: ReturnType<typeof makeStyles> }) {
  const [selected, setSelected] = useState('kjv');

  const onContinue = async () => {
    await setTranslation(selected);
    onNext();
  };

  return (
    <View style={{ flex: 1 }}>
      <NavBar t={t} />
      <View style={{ flex: 1, paddingHorizontal: spacing.lg, paddingTop: 20 }}>
        <View style={s.setupIconWrap}>
          <Svg width={28} height={28} viewBox="0 0 24 24" fill="none">
            <Path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" stroke={t.accentBlue} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            <Path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" stroke={t.accentBlue} strokeWidth="1.8" />
          </Svg>
        </View>
        <Text style={s.stepTitle}>Pick a translation.</Text>
        <Text style={s.stepSubtitle}>
          Scribe will look up every verse you cite in this translation. You can switch any time in Settings.
        </Text>

        <View style={[s.translationCard, { backgroundColor: t.bgSurface }]}>
          {SETUP_TRANSLATIONS.map((tr, i) => (
            <React.Fragment key={tr.id}>
              <TouchableOpacity style={s.translationRow} activeOpacity={0.6} onPress={() => setSelected(tr.id)}>
                <View style={[s.translationBadge, { backgroundColor: selected === tr.id ? t.accentBlue : t.bgSurfaceRaised }]}>
                  <Text style={[s.translationBadgeText, { color: selected === tr.id ? '#fff' : t.textSecondary }]}>{tr.abbr}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[s.translationName, { color: t.textPrimary }]}>{tr.label}</Text>
                  <Text style={[s.translationDesc, { color: t.textSecondary }]}>{tr.desc}</Text>
                </View>
                {selected === tr.id && <CheckIcon size={20} color={t.accentBlue} />}
              </TouchableOpacity>
              {i < SETUP_TRANSLATIONS.length - 1 && (
                <View style={[s.translationDivider, { backgroundColor: t.separator }]} />
              )}
            </React.Fragment>
          ))}
        </View>
      </View>
      <View style={s.bottomAction}>
        <TouchableOpacity style={[s.primaryBtn, { backgroundColor: t.accentBlue }]} activeOpacity={0.85} onPress={onContinue}>
          <Text style={s.primaryBtnText}>Continue</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ─── Success ─────────────────────────────────────────────────────────────────

function SuccessView({
  displayName, isNewUser, onContinue, t, s,
}: {
  displayName: string;
  isNewUser: boolean;
  onContinue: () => void;
  t: Colors;
  s: ReturnType<typeof makeStyles>;
}) {
  const scaleAnim = useRef(new Animated.Value(0)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(scaleAnim, { toValue: 1, friction: 6, tension: 80, useNativeDriver: true }),
      Animated.timing(fadeAnim, { toValue: 1, duration: 320, useNativeDriver: true }),
    ]).start();
  }, []);

  return (
    <View style={{ flex: 1 }}>
      <NavBar t={t} />

      <View style={s.successCenter}>
        <Animated.View
          style={[s.checkmarkCircle, { transform: [{ scale: scaleAnim }], opacity: fadeAnim }]}
        >
          <Svg width={60} height={60} viewBox="0 0 60 60" fill="none">
            <Path
              d="M14 30l10 10 22-24"
              stroke="#fff"
              strokeWidth={5}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </Svg>
        </Animated.View>

        <Animated.View style={{ opacity: fadeAnim, alignItems: 'center' }}>
          <Text style={s.successTitle}>
            {isNewUser ? `Welcome to Scribe, ${displayName}.` : `Welcome back, ${displayName}.`}
          </Text>
          <Text style={s.successSubtitle}>
            {isNewUser
              ? "Your account is ready. Let's set up your first sermon."
              : 'Your sermons are syncing. Taking you to the home screen.'}
          </Text>
        </Animated.View>
      </View>

      <View style={s.bottomAction}>
        <TouchableOpacity
          style={[s.primaryBtn, { backgroundColor: t.accentBlue }]}
          activeOpacity={0.85}
          onPress={onContinue}
        >
          <Text style={s.primaryBtnText}>Open Scribe</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

function makeStyles(t: Colors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: t.bgPrimary },

    landingCenter: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 32,
      gap: 28,
    },
    logoWrap: {
      width: 108,
      height: 108,
      borderRadius: 27,
      overflow: 'hidden',
      ...Platform.select({
        ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 12 }, shadowOpacity: 0.25, shadowRadius: 24 },
        android: { elevation: 12 },
      }),
    },
    logoImage: { width: 108, height: 108, borderRadius: 27 },
    landingTitle: {
      fontSize: 32,
      fontWeight: '700',
      color: t.textPrimary,
      letterSpacing: -0.8,
      lineHeight: 36,
      textAlign: 'center',
      marginBottom: 10,
    },
    landingSubtitle: {
      ...typography.body,
      color: t.textSecondary,
      textAlign: 'center',
      lineHeight: 24,
      maxWidth: 300,
    },

    providerSection: {
      paddingHorizontal: 20,
      paddingBottom: 14,
      gap: 10,
    },
    providerBtn: {
      height: 54,
      borderRadius: radius.pill,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 10,
    },
    providerBtnText: {
      ...typography.headline,
      fontWeight: '500',
    },
    termsText: {
      ...typography.caption,
      color: t.textSecondary,
      textAlign: 'center',
      paddingHorizontal: 16,
      paddingTop: 14,
      paddingBottom: 4,
      lineHeight: 16,
    },
    errorText: {
      ...typography.footnote,
      color: t.statusError,
      textAlign: 'center',
      marginBottom: 4,
    },

    stepHeader: {
      paddingTop: 20,
      paddingHorizontal: 24,
    },
    stepTitle: {
      fontSize: 30,
      fontWeight: '700',
      color: t.textPrimary,
      letterSpacing: -0.7,
      lineHeight: 34,
      marginBottom: 10,
    },
    stepSubtitle: {
      ...typography.body,
      color: t.textSecondary,
      lineHeight: 24,
    },

    inputSection: {
      paddingTop: 24,
      paddingHorizontal: 16,
    },
    inputCard: {
      borderRadius: radius.card,
      overflow: 'hidden',
    },
    inputRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 16,
      paddingVertical: 10,
      gap: 12,
      minHeight: 56,
    },
    textInput: {
      flex: 1,
      fontSize: 17,
      fontWeight: '400' as const,
      letterSpacing: -0.2,
      paddingVertical: 0,
    },
    iconCircle: {
      width: 36,
      height: 36,
      borderRadius: 18,
      alignItems: 'center' as const,
      justifyContent: 'center' as const,
    },
    clearCircle: {
      width: 22,
      height: 22,
      borderRadius: 11,
      alignItems: 'center',
      justifyContent: 'center',
    },
    hintText: {
      ...typography.footnote,
      paddingTop: 10,
      paddingHorizontal: 6,
    },

    otpSection: {
      paddingTop: 28,
      paddingHorizontal: 16,
      alignItems: 'center',
    },
    otpSlotsRow: {
      flexDirection: 'row',
      gap: 8,
      justifyContent: 'center',
    },
    otpSlot: {
      width: 44,
      height: 56,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
      ...Platform.select({
        ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 3 },
        android: { elevation: 1 },
      }),
    },
    otpDigit: {
      fontSize: 24,
      fontWeight: '500',
      fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    },
    otpStatusRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      minHeight: 22,
      marginTop: 14,
    },
    otpStatusText: {
      ...typography.footnote,
    },
    resendText: {
      ...typography.subhead,
      fontWeight: '500',
    },

    successCenter: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 32,
      gap: 28,
    },
    checkmarkCircle: {
      width: 132,
      height: 132,
      borderRadius: 33,
      backgroundColor: '#30B65B',
      alignItems: 'center',
      justifyContent: 'center',
      ...Platform.select({
        ios: { shadowColor: '#30B65B', shadowOffset: { width: 0, height: 16 }, shadowOpacity: 0.4, shadowRadius: 20 },
        android: { elevation: 16 },
      }),
    },
    successTitle: {
      fontSize: 30,
      fontWeight: '700',
      color: t.textPrimary,
      letterSpacing: -0.7,
      lineHeight: 34,
      textAlign: 'center',
      marginBottom: 10,
    },
    successSubtitle: {
      ...typography.body,
      color: t.textSecondary,
      textAlign: 'center',
      lineHeight: 24,
      maxWidth: 300,
    },

    primaryBtn: {
      height: 54,
      borderRadius: radius.pill,
      alignItems: 'center',
      justifyContent: 'center',
    },
    primaryBtnText: {
      ...typography.headline,
      color: '#fff',
      fontSize: 18,
    },
    bottomAction: {
      paddingHorizontal: 20,
      paddingBottom: 14,
    },

    // Setup steps (mic, groq, translation)
    setupCenter: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: spacing.xl,
      gap: 24,
    },
    setupTitle: {
      fontSize: 28,
      fontWeight: '700',
      color: t.textPrimary,
      textAlign: 'center',
      letterSpacing: -0.6,
    },
    setupSub: {
      ...typography.body,
      color: t.textSecondary,
      textAlign: 'center',
      lineHeight: 24,
      maxWidth: 300,
    },
    setupIconWrap: {
      width: 56,
      height: 56,
      borderRadius: 14,
      backgroundColor: t.bgSurface,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 18,
    },
    micCircleLarge: {
      width: 88,
      height: 88,
      borderRadius: 44,
      alignItems: 'center',
      justifyContent: 'center',
      ...Platform.select({
        ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.2, shadowRadius: 16 },
        android: { elevation: 8 },
      }),
    },
    grantedCircle: {
      width: 88,
      height: 88,
      borderRadius: 44,
      backgroundColor: '#30B65B',
      alignItems: 'center',
      justifyContent: 'center',
      ...Platform.select({
        ios: { shadowColor: '#30B65B', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.4, shadowRadius: 16 },
        android: { elevation: 8 },
      }),
    },
    groqCard: {
      borderRadius: radius.card,
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 14,
      minHeight: 50,
    },
    groqInput: {
      flex: 1,
      fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
      fontSize: 15,
      letterSpacing: 0.5,
      color: t.textPrimary,
      paddingVertical: 12,
    },
    groqStatus: { flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 22, paddingTop: 10 },
    groqStatusText: { ...typography.footnote },
    groqHelp: {
      marginTop: 20,
      borderRadius: 14,
      padding: 14,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 14,
    },
    groqHelpIcon: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
    translationCard: { borderRadius: radius.card, marginTop: spacing.lg, overflow: 'hidden' },
    translationRow: { flexDirection: 'row', alignItems: 'center', padding: 14, gap: 14 },
    translationBadge: { width: 44, height: 44, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
    translationBadgeText: { fontSize: 13, fontWeight: '700', letterSpacing: 0.3 },
    translationName: { ...typography.body, fontWeight: '500', marginBottom: 2 },
    translationDesc: { ...typography.footnote },
    translationDivider: { height: StyleSheet.hairlineWidth, marginLeft: 14 },
  });
}

export default function SignInScreen() {
  return <AuthFlow initialMode="signin" />;
}
