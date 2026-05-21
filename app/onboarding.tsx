import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Dimensions,
  Easing,
  Image,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Svg, Path } from 'react-native-svg';
import { MicIcon } from '@/components/icons';
import { type Colors, radius, spacing, typography, useTheme } from '@/theme';

const { width: SCREEN_W } = Dimensions.get('window');

type Step = 'welcome' | 'value';

export default function OnboardingScreen() {
  const [step, setStep] = useState<Step>('welcome');
  const router = useRouter();
  const t = useTheme();
  const styles = useMemo(() => makeStyles(t), [t]);
  const fadeAnim = useRef(new Animated.Value(1)).current;

  const goNext = () => {
    Animated.timing(fadeAnim, { toValue: 0.3, duration: 80, useNativeDriver: true }).start(() => {
      setStep('value');
      Animated.timing(fadeAnim, { toValue: 1, duration: 150, useNativeDriver: true }).start();
    });
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <Animated.View style={{ flex: 1, opacity: fadeAnim }}>
        {step === 'welcome' && (
          <WelcomeStep t={t} styles={styles} onNext={goNext} />
        )}
        {step === 'value' && (
          <ValuePropStep
            t={t}
            styles={styles}
            onSignUp={() => router.replace('/sign-up')}
            onSignIn={() => router.replace('/sign-in')}
          />
        )}
      </Animated.View>
    </SafeAreaView>
  );
}

// ─── Welcome ────────────────────────────────────────────────────────────────

function WelcomeStep({ t, styles, onNext }: { t: Colors; styles: any; onNext: () => void }) {
  const floatAnim = useRef(new Animated.Value(0)).current;
  const textFade = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(floatAnim, { toValue: 1, duration: 2000, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(floatAnim, { toValue: 0, duration: 2000, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ])
    ).start();
    Animated.timing(textFade, { toValue: 1, duration: 600, delay: 200, useNativeDriver: true }).start();
  }, []);

  const translateY = floatAnim.interpolate({ inputRange: [0, 1], outputRange: [0, -10] });
  const scale = floatAnim.interpolate({ inputRange: [0, 0.5, 1], outputRange: [1, 1.04, 1] });

  return (
    <View style={styles.stepFull}>
      <View style={styles.welcomeCenter}>
        <Animated.View style={{ transform: [{ translateY }, { scale }] }}>
          <BigLogomark />
        </Animated.View>
        <Animated.View style={{ opacity: textFade, alignItems: 'center', gap: 12 }}>
          <Text style={styles.welcomeTitle}>Let's get you set up.</Text>
          <Text style={styles.welcomeSub}>
            A few quick steps so Scribe is ready when you step into the pulpit.
          </Text>
        </Animated.View>
      </View>
      <Animated.View style={[styles.bottomActions, { opacity: textFade }]}>
        <PrimaryButton label="Get Started" onPress={onNext} color={t.accentBlue} />
      </Animated.View>
    </View>
  );
}

// ─── Value Props ────────────────────────────────────────────────────────────

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
    body: 'Cite a verse, Scribe finds it. KJV, NLT, NIV, or AMP — your choice.',
    visual: 'scripture' as const,
  },
];

function ValuePropStep({
  t, styles, onSignUp, onSignIn,
}: { t: Colors; styles: any; onSignUp: () => void; onSignIn: () => void }) {
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
      onSignUp();
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
          label={page < 2 ? 'Continue' : 'Create Account'}
          onPress={advance}
          color={t.accentBlue}
        />
        {page >= 2 && (
          <TouchableOpacity onPress={onSignIn} activeOpacity={0.7} style={styles.linkBtn}>
            <Text style={[styles.linkBtnText, { color: t.accentBlue }]}>I already have an account</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

// ─── Visuals ────────────────────────────────────────────────────────────────

function useStaggerFade(count: number, delay = 150) {
  const anims = useRef(Array.from({ length: count }, () => new Animated.Value(0))).current;
  useEffect(() => {
    anims.forEach((a, i) => {
      Animated.timing(a, { toValue: 1, duration: 400, delay: i * delay, useNativeDriver: true }).start();
    });
  }, []);
  return anims;
}

function TranscribeVisual({ t }: { t: Colors }) {
  const fades = useStaggerFade(2, 200);
  return (
    <View style={[vStyles.card, { backgroundColor: t.bgSurface }]}>
      <Animated.View style={[vStyles.micCircle, { backgroundColor: t.accentBlue, opacity: fades[0], transform: [{ scale: fades[0] }] }]}>
        <MicIcon size={32} color="#fff" />
      </Animated.View>
      <Animated.View style={[vStyles.transcriptBubble, { backgroundColor: t.bgSurfaceRaised, opacity: fades[1] }]}>
        <Text style={[vStyles.transcriptText, { color: t.textPrimary }]}>
          …not as scholars, but as <Text style={{ backgroundColor: `${t.accentBlue}22` }}>sojourners</Text>…
        </Text>
      </Animated.View>
    </View>
  );
}

function OutlineVisual({ t }: { t: Colors }) {
  const points = [
    { n: '1', t: 'Blessing precedes command', sub: 'Gen 15:6' },
    { n: '2', t: 'The language of sojourners', sub: 'Heb 11:13' },
    { n: '3', t: 'What we inherit, we also carry', sub: 'Gen 26:3' },
  ];
  const fades = useStaggerFade(3);
  return (
    <View style={[vStyles.card, { backgroundColor: t.bgSurface, padding: 20 }]}>
      {points.map((p, i) => (
        <Animated.View key={i} style={[vStyles.outlineRow, { backgroundColor: t.bgSurfaceRaised, opacity: fades[i], transform: [{ translateY: fades[i].interpolate({ inputRange: [0, 1], outputRange: [12, 0] }) }] }]}>
          <View style={[vStyles.outlineNum, { backgroundColor: t.accentBlue }]}>
            <Text style={vStyles.outlineNumText}>{p.n}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[vStyles.outlineTitle, { color: t.textPrimary }]}>{p.t}</Text>
            <Text style={[vStyles.outlineSub, { color: t.accentBlue }]}>{p.sub}</Text>
          </View>
        </Animated.View>
      ))}
    </View>
  );
}

function ScriptureVisual({ t }: { t: Colors }) {
  const verses = [
    { ref: 'Genesis 15:6', text: '"And he believed in the Lord; and he counted it to him for righteousness."' },
    { ref: 'Hebrews 11:13', text: '"These all died in faith, not having received the promises…"' },
  ];
  const fades = useStaggerFade(2, 200);
  return (
    <View style={[vStyles.card, { backgroundColor: t.bgSurface, padding: 20 }]}>
      {verses.map((v, i) => (
        <Animated.View key={i} style={[vStyles.verseCard, { backgroundColor: t.bgSurfaceRaised, opacity: fades[i], transform: [{ translateY: fades[i].interpolate({ inputRange: [0, 1], outputRange: [12, 0] }) }] }]}>
          <View style={vStyles.verseHeader}>
            <Text style={[vStyles.verseRef, { color: t.accentBlue }]}>{v.ref}</Text>
            <View style={[vStyles.verseBadge, { backgroundColor: t.bgSurface }]}>
              <Text style={[vStyles.verseBadgeText, { color: t.textSecondary }]}>KJV</Text>
            </View>
          </View>
          <Text style={[vStyles.verseText, { color: t.textPrimary }]}>{v.text}</Text>
        </Animated.View>
      ))}
    </View>
  );
}

function ValueVisual({ kind, t }: { kind: 'transcribe' | 'outline' | 'scripture'; t: Colors }) {
  if (kind === 'transcribe') return <TranscribeVisual t={t} />;
  if (kind === 'outline') return <OutlineVisual t={t} />;
  return <ScriptureVisual t={t} />;
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

// ─── Shared Components ──────────────────────────────────────────────────────

const APP_ICON = require('../assets/icon.png');

function BigLogomark() {
  return (
    <View style={logoStyles.wrap}>
      <Image source={APP_ICON} style={logoStyles.image} />
    </View>
  );
}

const logoStyles = StyleSheet.create({
  wrap: {
    width: 120,
    height: 120,
    borderRadius: 30,
    overflow: 'hidden',
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 12 }, shadowOpacity: 0.25, shadowRadius: 24 },
      android: { elevation: 12 },
    }),
  },
  image: { width: 120, height: 120, borderRadius: 30 },
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
  primary: { height: 54, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
  primaryText: { ...typography.headline, color: '#fff', fontSize: 18 },
});

// ─── Styles ─────────────────────────────────────────────────────────────────

function makeStyles(t: Colors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: t.bgPrimary },
    stepFull: { flex: 1 },

    welcomeCenter: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.xl, gap: 24 },
    welcomeTitle: { fontSize: 32, fontWeight: '700', color: t.textPrimary, textAlign: 'center', letterSpacing: -0.8 },
    welcomeSub: { ...typography.body, color: t.textSecondary, textAlign: 'center', lineHeight: 24, maxWidth: 300 },

    bottomActions: { paddingHorizontal: spacing.lg, paddingBottom: spacing.md, gap: 10 },
    linkBtn: { alignItems: 'center', paddingVertical: 10 },
    linkBtnText: { ...typography.subhead, fontWeight: '500' },

    valueSlide: { width: SCREEN_W, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.xl, paddingTop: 20 },
    valueEyebrow: { fontSize: 11, fontWeight: '600', letterSpacing: 0.6, color: t.accentBlue, marginTop: 24, marginBottom: 10 },
    valueTitle: { fontSize: 26, fontWeight: '700', color: t.textPrimary, textAlign: 'center', letterSpacing: -0.5, marginBottom: 12 },
    valueBody: { ...typography.body, color: t.textSecondary, textAlign: 'center', lineHeight: 24, maxWidth: 300 },
    valueDots: { flexDirection: 'row', justifyContent: 'center', gap: 6, paddingVertical: spacing.md },
    valueDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: t.stepPipInactive },
    valueDotActive: { width: 22, backgroundColor: t.accentBlue },
  });
}
