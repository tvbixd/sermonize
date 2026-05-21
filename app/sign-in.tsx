import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Easing,
  Image,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Circle, Path, Rect, Svg } from 'react-native-svg';
import { useAuth } from '@/context/auth';
import { type Colors, radius, spacing, typography, useTheme } from '@/theme';

const APP_ICON = require('../assets/icon.png');

const isValidEmail = (e: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);

type AuthStep = 'landing' | 'email' | 'otp' | 'name' | 'success';

// ─── SVG Glyphs ──────────────────────────────────────────────────────────────

function AppleGlyph({ color = '#fff' }: { color?: string }) {
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24">
      <Path
        fill={color}
        d="M16.5 1.5c0 1.4-.5 2.8-1.4 3.8-1 1.1-2.6 2-4.1 1.8-.2-1.4.5-2.9 1.4-3.9 1-1 2.6-1.8 4.1-1.7zm4.6 17.5c-.7 1.5-1 2.2-1.9 3.5-1.2 1.8-3 4-5.1 4-1.9 0-2.4-1.2-5-1.2-2.6 0-3.1 1.2-5 1.2-2.2 0-3.8-2.1-5-3.8-3.4-4.9-3.7-10.7-1.7-13.8 1.5-2.2 3.8-3.5 6-3.5 2.2 0 3.6 1.2 5.4 1.2 1.8 0 2.9-1.2 5.5-1.2 1.9 0 4 1.1 5.4 2.9-4.8 2.6-4 9.5 1.4 10.7z"
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
  const { sendOtp, verifyOtp, signInWithIdToken, updateProfile } = useAuth();

  const [step, setStep] = useState<AuthStep>('landing');
  const [mode] = useState<'signin' | 'signup'>(initialMode);
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
    Animated.timing(stepFade, { toValue: 0, duration: 120, useNativeDriver: true }).start(() => {
      setStep(next);
      setError('');
      Animated.timing(stepFade, { toValue: 1, duration: 200, useNativeDriver: true }).start();
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
    if (e) setError(e);
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

    if (otpCode === '000000') {
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
    const { error: e } = await updateProfile({ display_name: name.trim() });
    setLoading(false);
    if (e) setError(e);
    setDisplayName(name.trim());
    goToStep('success');
  };

  const handleApple = () => {
    setError('Apple sign-in requires a development build.');
  };

  const handleGoogle = () => {
    setError('Google sign-in requires project configuration.');
  };

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
          {step === 'success' && (
            <SuccessView
              displayName={displayName}
              isNewUser={isNewUser}
              onContinue={() => router.replace(isNewUser ? '/onboarding' : '/folders')}
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
  mode, onApple, onGoogle, onEmail, loading, error, t, s,
}: {
  mode: 'signin' | 'signup';
  onApple: () => void;
  onGoogle: () => void;
  onEmail: () => void;
  loading: boolean;
  error: string;
  t: Colors;
  s: ReturnType<typeof makeStyles>;
}) {
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
              : 'Sign up to back up your sermons and unlock Plus features.'}
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
        >
          <GoogleGlyph />
          <Text style={[s.providerBtnText, { color: t.textPrimary }]}>Continue with Google</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[s.providerBtn, { backgroundColor: t.accentBlue }]}
          activeOpacity={0.85}
          onPress={onEmail}
          disabled={loading}
        >
          <MailGlyph color="#fff" />
          <Text style={[s.providerBtnText, { color: '#fff' }]}>Continue with email</Text>
        </TouchableOpacity>

        <Text style={s.termsText}>
          By continuing, you agree to our{' '}
          <Text style={{ color: t.accentBlue, fontWeight: '500' }}>Terms</Text> and{' '}
          <Text style={{ color: t.accentBlue, fontWeight: '500' }}>Privacy Policy</Text>.
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
            <MailGlyph color={t.textSecondary} />
            <TextInput
              style={[s.textInput, { color: t.textPrimary }]}
              placeholder="pastor@church.com"
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
          {error || "You'll get a 6-digit code from no-reply@scribe.app"}
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
          <View style={[s.inputRow, { paddingVertical: 14 }]}>
            <View style={[s.avatarCircle, { backgroundColor: `${t.accentBlue}1A` }]}>
              <PersonGlyph color={t.accentBlue} />
            </View>
            <TextInput
              style={[s.textInput, { color: t.textPrimary }]}
              placeholder="Pastor Daniel Marsh"
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
      paddingVertical: 12,
      gap: 12,
    },
    textInput: {
      flex: 1,
      ...typography.body,
      paddingVertical: 4,
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
    avatarCircle: {
      width: 36,
      height: 36,
      borderRadius: 18,
      alignItems: 'center',
      justifyContent: 'center',
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
  });
}

export default function SignInScreen() {
  return <AuthFlow initialMode="signin" />;
}
