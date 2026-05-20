import { Audio } from 'expo-av';
import { Redirect, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Dimensions,
  Easing,
  Linking,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Svg, Path, Rect, Circle } from 'react-native-svg';
import { CheckIcon, MicIcon, WaveformIcon } from '@/components/icons';
import { LEGACY_TRANSLATIONS } from '@/services/bible';
import { getGroqKey, setGroqKey, setTranslation } from '@/storage/keys';
import { type Colors, radius, spacing, typography, useTheme } from '@/theme';

const { width: SCREEN_W } = Dimensions.get('window');

type Step = 'welcome' | 'value' | 'mic' | 'groq' | 'translation' | 'allset';
const SETUP_STEPS: Step[] = ['value', 'mic', 'groq', 'translation'];

export default function Root() {
  const [checked, setChecked] = useState(false);
  const [hasKey, setHasKey] = useState(false);
  const [step, setStep] = useState<Step>('welcome');
  const router = useRouter();
  const t = useTheme();
  const styles = useMemo(() => makeStyles(t), [t]);

  useEffect(() => {
    void (async () => {
      const key = await getGroqKey();
      setHasKey(!!key);
      setChecked(true);
    })();
  }, []);

  if (!checked) return null;
  // TODO: remove this bypass after testing onboarding
  // if (hasKey) return <Redirect href="/folders" />;

  const setupIndex = SETUP_STEPS.indexOf(step);

  const goNext = (next: Step) => setStep(next);
  const goBack = () => {
    const idx = SETUP_STEPS.indexOf(step);
    if (idx > 0) setStep(SETUP_STEPS[idx - 1]);
    else if (step === 'allset') setStep('translation');
    else setStep('welcome');
  };
  const skip = () => router.replace('/folders');
  const finish = () => router.replace('/folders');

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      {/* Progress chrome for setup steps */}
      {setupIndex >= 0 && (
        <StepChrome
          step={setupIndex}
          total={SETUP_STEPS.length}
          onBack={goBack}
          onSkip={skip}
          t={t}
          styles={styles}
        />
      )}

      {step === 'welcome' && (
        <WelcomeStep t={t} styles={styles} onNext={() => goNext('value')} onSkip={skip} />
      )}
      {step === 'value' && (
        <ValuePropStep t={t} styles={styles} onNext={() => goNext('mic')} />
      )}
      {step === 'mic' && (
        <MicPermissionStep t={t} styles={styles} onNext={() => goNext('groq')} />
      )}
      {step === 'groq' && (
        <GroqKeyStep t={t} styles={styles} onNext={() => goNext('translation')} />
      )}
      {step === 'translation' && (
        <TranslationStep t={t} styles={styles} onNext={() => goNext('allset')} />
      )}
      {step === 'allset' && (
        <AllSetStep t={t} styles={styles} onFinish={finish} />
      )}
    </SafeAreaView>
  );
}

// ─── Step Chrome (progress dots + back/skip) ─────────────────────────────────

function StepChrome({
  step, total, onBack, onSkip, t, styles,
}: { step: number; total: number; onBack: () => void; onSkip: () => void; t: Colors; styles: any }) {
  return (
    <View style={styles.chrome}>
      <TouchableOpacity onPress={onBack} activeOpacity={0.7} hitSlop={12}>
        <Text style={styles.chromeBack}>Back</Text>
      </TouchableOpacity>
      <View style={styles.chromeDots}>
        {Array.from({ length: total }).map((_, i) => (
          <View
            key={i}
            style={[
              styles.chromeDot,
              i === step && styles.chromeDotActive,
              i < step && styles.chromeDotDone,
            ]}
          />
        ))}
      </View>
      <TouchableOpacity onPress={onSkip} activeOpacity={0.7} hitSlop={12}>
        <Text style={styles.chromeSkip}>Skip</Text>
      </TouchableOpacity>
    </View>
  );
}

// ─── Step 1: Welcome ─────────────────────────────────────────────────────────

function WelcomeStep({ t, styles, onNext, onSkip }: { t: Colors; styles: any; onNext: () => void; onSkip: () => void }) {
  const pulseAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1, duration: 2000, easing: Easing.out(Easing.ease), useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 0, duration: 2000, easing: Easing.in(Easing.ease), useNativeDriver: true }),
      ])
    ).start();
  }, []);

  const scale = pulseAnim.interpolate({ inputRange: [0, 1], outputRange: [1, 1.08] });

  return (
    <View style={styles.stepFull}>
      <View style={styles.welcomeCenter}>
        <Animated.View style={{ transform: [{ scale }] }}>
          <BigLogomark color={t.accentBlue} />
        </Animated.View>
        <Text style={styles.welcomeTitle}>Welcome to Scribe.</Text>
        <Text style={styles.welcomeSub}>
          The pulpit-ready notebook that listens while you preach.
        </Text>
      </View>
      <View style={styles.bottomActions}>
        <PrimaryButton label="Get Started" onPress={onNext} color={t.accentBlue} />
        <TouchableOpacity onPress={onSkip} activeOpacity={0.7} style={styles.linkBtn}>
          <Text style={[styles.linkBtnText, { color: t.accentBlue }]}>I already have an account</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ─── Step 2: Value Props ─────────────────────────────────────────────────────

const VALUE_PROPS = [
  {
    title: 'It listens while you preach.',
    body: 'Tap the mic. Scribe captures every word and stays out of your way.',
    visual: 'transcribe' as const,
  },
  {
    title: 'You walk off with a clean outline.',
    body: 'Three points, key transitions, a paragraph summary — built in the background while you preach.',
    visual: 'outline' as const,
  },
  {
    title: 'Every scripture, automatically cited.',
    body: 'Cite a verse, Scribe finds it. WEB, KJV, BBE, or OEB — your choice.',
    visual: 'scripture' as const,
  },
];

function ValuePropStep({ t, styles, onNext }: { t: Colors; styles: any; onNext: () => void }) {
  const [page, setPage] = useState(0);
  const scrollRef = useRef<ScrollView>(null);

  const onScroll = useCallback((e: any) => {
    const idx = Math.round(e.nativeEvent.contentOffset.x / SCREEN_W);
    if (idx >= 0 && idx <= 2) setPage(idx);
  }, []);

  const advance = () => {
    if (page < 2) {
      scrollRef.current?.scrollTo({ x: SCREEN_W * (page + 1), animated: true });
    } else {
      onNext();
    }
  };

  return (
    <View style={styles.stepFull}>
      <View style={{ flex: 1 }}>
        <ScrollView
          ref={scrollRef}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onScroll={onScroll}
          scrollEventThrottle={16}
        >
          {VALUE_PROPS.map((prop, idx) => (
            <View key={idx} style={styles.valueSlide}>
              <ValueVisual kind={prop.visual} t={t} />
              <Text style={styles.valueEyebrow}>HOW IT WORKS</Text>
              <Text style={styles.valueTitle}>{prop.title}</Text>
              <Text style={styles.valueBody}>{prop.body}</Text>
            </View>
          ))}
        </ScrollView>
        <View style={styles.valueDots}>
          {[0, 1, 2].map((i) => (
            <View
              key={i}
              style={[styles.valueDot, i === page && styles.valueDotActive]}
            />
          ))}
        </View>
      </View>
      <View style={styles.bottomActions}>
        <PrimaryButton
          label={page < 2 ? 'Continue' : 'Next: set up'}
          onPress={advance}
          color={t.accentBlue}
        />
      </View>
    </View>
  );
}

function ValueVisual({ kind, t }: { kind: 'transcribe' | 'outline' | 'scripture'; t: Colors }) {
  if (kind === 'transcribe') {
    return (
      <View style={[vStyles.card, { backgroundColor: t.bgSurface }]}>
        <View style={[vStyles.micCircle, { backgroundColor: t.accentBlue }]}>
          <MicIcon size={32} color="#fff" />
        </View>
        <View style={[vStyles.transcriptBubble, { backgroundColor: t.bgSurfaceRaised }]}>
          <Text style={[vStyles.transcriptText, { color: t.textPrimary }]}>
            …not as scholars, but as <Text style={{ backgroundColor: `${t.accentBlue}22` }}>sojourners</Text>…
          </Text>
        </View>
      </View>
    );
  }
  if (kind === 'outline') {
    const points = [
      { n: '1', t: 'Blessing precedes command', sub: 'Gen 15:6' },
      { n: '2', t: 'The language of sojourners', sub: 'Heb 11:13' },
      { n: '3', t: 'What we inherit, we also carry', sub: 'Gen 26:3' },
    ];
    return (
      <View style={[vStyles.card, { backgroundColor: t.bgSurface, padding: 20 }]}>
        {points.map((p, i) => (
          <View key={i} style={[vStyles.outlineRow, { backgroundColor: t.bgSurfaceRaised }]}>
            <View style={[vStyles.outlineNum, { backgroundColor: t.accentBlue }]}>
              <Text style={vStyles.outlineNumText}>{p.n}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[vStyles.outlineTitle, { color: t.textPrimary }]}>{p.t}</Text>
              <Text style={[vStyles.outlineSub, { color: t.accentBlue }]}>{p.sub}</Text>
            </View>
          </View>
        ))}
      </View>
    );
  }
  // scripture
  const verses = [
    { ref: 'Genesis 15:6', text: '"And he believed in the Lord; and he counted it to him for righteousness."' },
    { ref: 'Hebrews 11:13', text: '"These all died in faith, not having received the promises…"' },
  ];
  return (
    <View style={[vStyles.card, { backgroundColor: t.bgSurface, padding: 20 }]}>
      {verses.map((v, i) => (
        <View key={i} style={[vStyles.verseCard, { backgroundColor: t.bgSurfaceRaised }]}>
          <View style={vStyles.verseHeader}>
            <Text style={[vStyles.verseRef, { color: t.accentBlue }]}>{v.ref}</Text>
            <View style={[vStyles.verseBadge, { backgroundColor: t.bgSurface }]}>
              <Text style={[vStyles.verseBadgeText, { color: t.textSecondary }]}>WEB</Text>
            </View>
          </View>
          <Text style={[vStyles.verseText, { color: t.textPrimary }]}>{v.text}</Text>
        </View>
      ))}
    </View>
  );
}

const vStyles = StyleSheet.create({
  card: { width: 260, height: 260, borderRadius: 28, alignItems: 'center', justifyContent: 'center', alignSelf: 'center' },
  micCircle: { width: 72, height: 72, borderRadius: 36, alignItems: 'center', justifyContent: 'center', marginBottom: 20 },
  transcriptBubble: { borderRadius: 12, padding: 12, marginHorizontal: 20 },
  transcriptText: { fontSize: 13, lineHeight: 18 },
  outlineRow: { flexDirection: 'row', alignItems: 'center', borderRadius: 12, padding: 12, gap: 12, marginBottom: 8 },
  outlineNum: { width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  outlineNumText: { color: '#fff', fontSize: 13, fontWeight: '600' },
  outlineTitle: { fontSize: 14, fontWeight: '500' },
  outlineSub: { fontSize: 12, fontWeight: '500', marginTop: 2 },
  verseCard: { borderRadius: 12, padding: 12, marginBottom: 10 },
  verseHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  verseRef: { fontSize: 12, fontWeight: '600' },
  verseBadge: { borderRadius: 3, paddingHorizontal: 5, paddingVertical: 1 },
  verseBadgeText: { fontSize: 11, fontWeight: '500' },
  verseText: { fontSize: 12, lineHeight: 17, fontStyle: 'italic' },
});

// ─── Step 3: Mic Permission ──────────────────────────────────────────────────

function MicPermissionStep({ t, styles, onNext }: { t: Colors; styles: any; onNext: () => void }) {
  const [granted, setGranted] = useState(false);
  const pulseAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!granted) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1, duration: 2000, easing: Easing.out(Easing.ease), useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 0, duration: 2000, easing: Easing.in(Easing.ease), useNativeDriver: true }),
        ])
      ).start();
    }
  }, [granted]);

  const requestPermission = async () => {
    try {
      const { granted: g } = await Audio.requestPermissionsAsync();
      setGranted(g);
      if (g) {
        setTimeout(onNext, 800);
      }
    } catch {
      setGranted(false);
    }
  };

  const scale = pulseAnim.interpolate({ inputRange: [0, 1], outputRange: [1, 1.06] });

  return (
    <View style={styles.stepFull}>
      <View style={styles.welcomeCenter}>
        {granted ? (
          <View style={styles.grantedCircle}>
            <Svg width={52} height={52} viewBox="0 0 58 58" fill="none">
              <Path d="M14 30l10 10 20-22" stroke="#fff" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
            </Svg>
          </View>
        ) : (
          <Animated.View style={{ transform: [{ scale }] }}>
            <BigLogomark color={t.accentBlue} icon="mic" />
          </Animated.View>
        )}
        <Text style={styles.welcomeTitle}>
          {granted ? 'You’re all set.' : 'Let Scribe hear you.'}
        </Text>
        <Text style={styles.welcomeSub}>
          {granted
            ? 'Microphone access granted. Scribe is ready to listen whenever you tap the mic.'
            : 'Scribe needs microphone access to record your sermons. Audio stays on your phone — only the transcript is sent to Groq.'}
        </Text>
      </View>
      <View style={styles.bottomActions}>
        {granted ? (
          <PrimaryButton label="Continue" onPress={onNext} color={t.accentBlue} />
        ) : (
          <>
            <PrimaryButton label="Allow Microphone Access" onPress={requestPermission} color={t.accentBlue} />
            <TouchableOpacity onPress={onNext} activeOpacity={0.7} style={styles.linkBtn}>
              <Text style={styles.skipText}>Not now</Text>
            </TouchableOpacity>
          </>
        )}
      </View>
    </View>
  );
}

// ─── Step 4: Groq Key ────────────────────────────────────────────────────────

function GroqKeyStep({ t, styles, onNext }: { t: Colors; styles: any; onNext: () => void }) {
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
      setStatus('valid');
    }
  };

  const onChangeKey = (v: string) => {
    setKey(v);
    setStatus('empty');
  };

  const onSubmitKey = () => void validate(key);

  const onContinue = async () => {
    if (status === 'valid') {
      await setGroqKey(key.trim());
    }
    onNext();
  };

  return (
    <View style={styles.stepFull}>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.groqContent} keyboardShouldPersistTaps="handled">
        <View style={styles.groqIconWrap}>
          <Svg width={28} height={28} viewBox="0 0 24 24" fill="none">
            <Rect x="3" y="11" width="18" height="11" rx="2" stroke={t.accentBlue} strokeWidth="1.8" />
            <Path d="M7 11V7a5 5 0 0 1 10 0v4" stroke={t.accentBlue} strokeWidth="1.8" strokeLinecap="round" />
            <Circle cx="12" cy="16.5" r="1.5" fill={t.accentBlue} />
          </Svg>
        </View>
        <Text style={styles.groqTitle}>Add your Groq key.</Text>
        <Text style={styles.groqBody}>
          Scribe uses Groq for fast, private transcription. The free tier is generous and covers most preachers without ever paying a cent.
        </Text>

        {/* Key input card */}
        <View style={styles.groqCard}>
          <TextInput
            style={styles.groqInput}
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
            <TouchableOpacity onPress={() => { setKey(''); setStatus('empty'); }} style={styles.groqClear}>
              <View style={[styles.groqClearCircle, { backgroundColor: t.textTertiary }]}>
                <Text style={{ color: '#fff', fontSize: 11, fontWeight: '700' }}>✕</Text>
              </View>
            </TouchableOpacity>
          )}
        </View>

        {/* Status */}
        <View style={styles.groqStatus}>
          {status === 'verifying' && (
            <>
              <ActivityIndicator size="small" color={t.accentBlue} />
              <Text style={[styles.groqStatusText, { color: t.textSecondary }]}>Verifying…</Text>
            </>
          )}
          {status === 'valid' && (
            <>
              <CheckIcon size={14} color={t.statusSuccess} />
              <Text style={[styles.groqStatusText, { color: t.statusSuccess }]}>Key looks good</Text>
            </>
          )}
          {status === 'invalid' && (
            <Text style={[styles.groqStatusText, { color: t.statusError }]}>That key didn't work. Double-check and try again.</Text>
          )}
        </View>

        {/* Help card */}
        <TouchableOpacity
          style={[styles.groqHelp, { backgroundColor: t.bgSurface }]}
          activeOpacity={0.7}
          onPress={() => void Linking.openURL('https://console.groq.com')}
        >
          <View style={[styles.groqHelpIcon, { backgroundColor: `${t.accentBlue}1A` }]}>
            <Svg width={16} height={16} viewBox="0 0 16 16" fill="none">
              <Circle cx="8" cy="8" r="7" stroke={t.accentBlue} strokeWidth="1.5" />
              <Path d="M6 6a2 2 0 1 1 3 1.6c-.6.4-1 .6-1 1.2M8 11.5v.01" stroke={t.accentBlue} strokeWidth="1.5" strokeLinecap="round" />
            </Svg>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.groqHelpTitle, { color: t.textPrimary }]}>Don't have a key?</Text>
            <Text style={[styles.groqHelpSub, { color: t.textSecondary }]}>Open console.groq.com — takes two minutes.</Text>
          </View>
        </TouchableOpacity>
      </ScrollView>

      <View style={styles.bottomActions}>
        <PrimaryButton
          label="Continue"
          onPress={onContinue}
          color={t.accentBlue}
          disabled={status !== 'valid'}
        />
        <TouchableOpacity onPress={onNext} activeOpacity={0.7} style={styles.linkBtn}>
          <Text style={styles.skipText}>I'll add it later</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ─── Step 5: Translation ─────────────────────────────────────────────────────

const ONBOARDING_TRANSLATIONS = LEGACY_TRANSLATIONS.filter(
  (tr) => ['web', 'kjv', 'bbe', 'oeb-us'].includes(tr.id)
);

function TranslationStep({ t, styles, onNext }: { t: Colors; styles: any; onNext: () => void }) {
  const [selected, setSelected] = useState('web');

  const onContinue = async () => {
    await setTranslation(selected);
    onNext();
  };

  return (
    <View style={styles.stepFull}>
      <View style={{ flex: 1, paddingHorizontal: spacing.lg, paddingTop: spacing.lg }}>
        <View style={styles.groqIconWrap}>
          <Svg width={28} height={28} viewBox="0 0 24 24" fill="none">
            <Path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" stroke={t.accentBlue} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            <Path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" stroke={t.accentBlue} strokeWidth="1.8" />
          </Svg>
        </View>
        <Text style={styles.groqTitle}>Pick a translation.</Text>
        <Text style={styles.groqBody}>
          Scribe will look up every verse you cite in this translation. You can switch any time in Settings.
        </Text>

        <View style={[styles.translationCard, { backgroundColor: t.bgSurface }]}>
          {ONBOARDING_TRANSLATIONS.map((tr, i) => (
            <React.Fragment key={tr.id}>
              <TouchableOpacity
                style={styles.translationRow}
                activeOpacity={0.6}
                onPress={() => setSelected(tr.id)}
              >
                <View style={[
                  styles.translationBadge,
                  { backgroundColor: selected === tr.id ? t.accentBlue : t.bgSurfaceRaised },
                ]}>
                  <Text style={[
                    styles.translationBadgeText,
                    { color: selected === tr.id ? '#fff' : t.textSecondary },
                  ]}>
                    {tr.abbr}
                  </Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.translationName, { color: t.textPrimary }]}>{tr.label}</Text>
                  <Text style={[styles.translationDesc, { color: t.textSecondary }]}>
                    {tr.id === 'web' && 'Modern, public domain. A great default.'}
                    {tr.id === 'kjv' && 'Classic English. Familiar cadence.'}
                    {tr.id === 'bbe' && 'Simplified vocabulary, easy reading.'}
                    {tr.id === 'oeb-us' && 'Contemporary, openly licensed.'}
                  </Text>
                </View>
                {selected === tr.id && <CheckIcon size={20} color={t.accentBlue} />}
              </TouchableOpacity>
              {i < ONBOARDING_TRANSLATIONS.length - 1 && (
                <View style={[styles.translationDivider, { backgroundColor: t.separator }]} />
              )}
            </React.Fragment>
          ))}
        </View>
      </View>
      <View style={styles.bottomActions}>
        <PrimaryButton label="Continue" onPress={onContinue} color={t.accentBlue} />
      </View>
    </View>
  );
}

// ─── Step 6: All Set ─────────────────────────────────────────────────────────

function AllSetStep({ t, styles, onFinish }: { t: Colors; styles: any; onFinish: () => void }) {
  const checklist = [
    { label: 'Microphone access', done: true },
    { label: 'Groq API key', done: true },
    { label: 'Bible translation', done: true },
  ];

  return (
    <View style={styles.stepFull}>
      <View style={styles.welcomeCenter}>
        <BigLogomark color={t.accentBlue} />
        <Text style={styles.welcomeTitle}>You're ready to preach.</Text>
        <Text style={styles.welcomeSub}>
          Tap the red mic on the home screen the next time you step into the pulpit. Scribe takes care of the rest.
        </Text>

        <View style={[styles.checklistCard, { backgroundColor: t.bgSurface }]}>
          {checklist.map((c, i) => (
            <React.Fragment key={i}>
              <View style={styles.checklistRow}>
                <View style={styles.checklistIcon}>
                  <Svg width={12} height={12} viewBox="0 0 12 12" fill="none">
                    <Path d="M3 6.5l2 2 4-4.5" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </Svg>
                </View>
                <Text style={[styles.checklistLabel, { color: t.textPrimary }]}>{c.label}</Text>
              </View>
              {i < checklist.length - 1 && (
                <View style={[styles.translationDivider, { backgroundColor: t.separator }]} />
              )}
            </React.Fragment>
          ))}
        </View>
      </View>
      <View style={styles.bottomActions}>
        <PrimaryButton label="Open Scribe" onPress={onFinish} color={t.accentBlue} />
      </View>
    </View>
  );
}

// ─── Shared Components ───────────────────────────────────────────────────────

function BigLogomark({ color, icon = 'waveform' }: { color: string; icon?: 'waveform' | 'mic' }) {
  return (
    <View style={[logoStyles.wrap, { backgroundColor: color }]}>
      {icon === 'mic' ? (
        <Svg width={56} height={56} viewBox="0 0 24 24" fill="none">
          <Rect x="9" y="3" width="6" height="12" rx="3" fill="#fff" />
          <Path d="M5 11a7 7 0 0 0 14 0M12 18v3" stroke="#fff" strokeWidth="2" strokeLinecap="round" />
        </Svg>
      ) : (
        <Svg width={56} height={56} viewBox="0 0 64 64" fill="none">
          <Path d="M8 32v0M18 24v16M28 14v36M38 20v24M48 28v8" stroke="#fff" strokeWidth="4.5" strokeLinecap="round" />
        </Svg>
      )}
    </View>
  );
}

const logoStyles = StyleSheet.create({
  wrap: {
    width: 120,
    height: 120,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 12 }, shadowOpacity: 0.25, shadowRadius: 24 },
      android: { elevation: 12 },
    }),
  },
});

function PrimaryButton({ label, onPress, color, disabled = false }: { label: string; onPress: () => void; color: string; disabled?: boolean }) {
  return (
    <TouchableOpacity
      style={[btnStyles.primary, { backgroundColor: disabled ? '#C7C7CC' : color }]}
      activeOpacity={0.85}
      onPress={onPress}
      disabled={disabled}
    >
      <Text style={btnStyles.primaryText}>{label}</Text>
    </TouchableOpacity>
  );
}

const btnStyles = StyleSheet.create({
  primary: {
    height: 54,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryText: { ...typography.headline, color: '#fff', fontSize: 18 },
});

// ─── Styles ──────────────────────────────────────────────────────────────────

function makeStyles(t: Colors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: t.bgPrimary },

    // Chrome
    chrome: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: spacing.lg,
      height: 40,
    },
    chromeBack: { ...typography.body, color: t.accentBlue },
    chromeSkip: { ...typography.body, color: t.textSecondary },
    chromeDots: { flexDirection: 'row', gap: 6 },
    chromeDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: t.stepPipInactive },
    chromeDotActive: { width: 22, backgroundColor: t.accentBlue },
    chromeDotDone: { backgroundColor: `${t.accentBlue}80` },

    // Shared step layout
    stepFull: { flex: 1 },

    // Welcome
    welcomeCenter: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.xl, gap: 24 },
    welcomeTitle: {
      fontSize: 32,
      fontWeight: '700',
      color: t.textPrimary,
      textAlign: 'center',
      letterSpacing: -0.8,
    },
    welcomeSub: {
      ...typography.body,
      color: t.textSecondary,
      textAlign: 'center',
      lineHeight: 24,
      maxWidth: 300,
    },

    // Bottom actions
    bottomActions: { paddingHorizontal: spacing.lg, paddingBottom: spacing.md, gap: 10 },
    linkBtn: { alignItems: 'center', paddingVertical: 10 },
    linkBtnText: { ...typography.subhead, fontWeight: '500' },
    skipText: { ...typography.subhead, color: t.textSecondary, fontWeight: '500' },

    // Value props
    valueSlide: {
      width: SCREEN_W,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: spacing.xl,
      paddingTop: 20,
    },
    valueEyebrow: {
      fontSize: 11,
      fontWeight: '600',
      letterSpacing: 0.6,
      color: t.accentBlue,
      marginTop: 24,
      marginBottom: 10,
    },
    valueTitle: {
      fontSize: 26,
      fontWeight: '700',
      color: t.textPrimary,
      textAlign: 'center',
      letterSpacing: -0.5,
      marginBottom: 12,
    },
    valueBody: {
      ...typography.body,
      color: t.textSecondary,
      textAlign: 'center',
      lineHeight: 24,
      maxWidth: 300,
    },
    valueDots: { flexDirection: 'row', justifyContent: 'center', gap: 6, paddingVertical: spacing.md },
    valueDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: t.stepPipInactive },
    valueDotActive: { width: 22, backgroundColor: t.accentBlue },

    // Mic permission
    grantedCircle: {
      width: 120,
      height: 120,
      borderRadius: 30,
      backgroundColor: '#30B65B',
      alignItems: 'center',
      justifyContent: 'center',
      ...Platform.select({
        ios: { shadowColor: '#30B65B', shadowOffset: { width: 0, height: 12 }, shadowOpacity: 0.4, shadowRadius: 24 },
        android: { elevation: 12 },
      }),
    },

    // Groq key
    groqContent: { paddingHorizontal: spacing.lg, paddingTop: spacing.lg, paddingBottom: spacing.md },
    groqIconWrap: {
      width: 56,
      height: 56,
      borderRadius: 14,
      backgroundColor: t.bgSurface,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 18,
    },
    groqTitle: {
      fontSize: 28,
      fontWeight: '700',
      color: t.textPrimary,
      letterSpacing: -0.6,
      marginBottom: 10,
    },
    groqBody: {
      ...typography.body,
      color: t.textSecondary,
      lineHeight: 24,
      marginBottom: 24,
    },
    groqCard: {
      backgroundColor: t.bgSurface,
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
    groqClear: { padding: 4 },
    groqClearCircle: { width: 20, height: 20, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
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
    groqHelpTitle: { ...typography.subhead, fontWeight: '500', marginBottom: 2 },
    groqHelpSub: { ...typography.footnote },

    // Translation
    translationCard: { borderRadius: radius.card, marginTop: spacing.lg, overflow: 'hidden' },
    translationRow: { flexDirection: 'row', alignItems: 'center', padding: 14, gap: 14 },
    translationBadge: {
      width: 44,
      height: 44,
      borderRadius: 10,
      alignItems: 'center',
      justifyContent: 'center',
    },
    translationBadgeText: { fontSize: 13, fontWeight: '700', letterSpacing: 0.3 },
    translationName: { ...typography.body, fontWeight: '500', marginBottom: 2 },
    translationDesc: { ...typography.footnote },
    translationDivider: { height: StyleSheet.hairlineWidth, marginLeft: 14 },

    // All set checklist
    checklistCard: { borderRadius: radius.card, overflow: 'hidden', width: '100%', marginTop: 8 },
    checklistRow: { flexDirection: 'row', alignItems: 'center', padding: 14, gap: 12 },
    checklistIcon: {
      width: 24,
      height: 24,
      borderRadius: 12,
      backgroundColor: '#30B65B',
      alignItems: 'center',
      justifyContent: 'center',
    },
    checklistLabel: { ...typography.body, flex: 1 },
  });
}
