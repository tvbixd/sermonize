import Constants from 'expo-constants';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system/legacy';
import * as WebBrowser from 'expo-web-browser';
import { Stack, useRouter } from 'expo-router';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Linking,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Circle, Path, Rect, Svg } from 'react-native-svg';
import {
  getAnthropicKey,
  getDeepgramKey,
  getGeminiKey,
  getTranslation,
  setAnthropicKey,
  setDeepgramKey,
  setGeminiKey,
  setTranslation,
} from '@/storage/keys';
import {
  type TranslationEntry,
  LEGACY_TRANSLATIONS,
  fetchApiBibleTranslations,
} from '@/services/bible';
import { useAuth } from '@/context/auth';
import { FAQ } from '@/config/faq';
import { PRIVACY_POLICY_TEXT, TERMS_TEXT } from '@/config/legal';
import { PRIVACY_POLICY_URL, SUPPORT_EMAIL, TERMS_URL } from '@/config/support';
import { getCrashLog, clearLogs } from '@/services/logger';
import { getAudioStorageBytes } from '@/storage/sermons';
import { getAvatarUri, setAvatarUri } from '@/storage/keys';
import { type Colors, radius, spacing, typography, useTheme } from '@/theme';
import { CheckIcon, EyeIcon, EyeOffIcon } from '@/components/icons';

// ─── Constants ───────────────────────────────────────────────────────────────

const PROFILE_ROLES = [
  { id: 'pastor', label: 'Pastor', desc: 'Lead preaching pastor' },
  { id: 'church-lead', label: 'Church leader', desc: 'Elder, board member, ministry director' },
  { id: 'small-group', label: 'Small group leader', desc: 'Bible study or home group leader' },
  { id: 'teacher', label: 'Teacher', desc: 'Sunday school, seminary, youth' },
  { id: 'member', label: 'Church member', desc: 'Active in a local church' },
  { id: 'seeker', label: 'Seeker / Exploring', desc: 'Curious about faith' },
  { id: 'non-believer', label: 'Non-believer', desc: 'Listening from outside the church' },
  { id: 'other', label: 'Other', desc: 'Tell us more in support' },
] as const;

const CHURCH_ROLES = ['pastor', 'church-lead', 'small-group', 'teacher', 'member'];

const PROFILE_INTERESTS = [
  { id: 'preaching', label: 'Preaching craft' },
  { id: 'theology', label: 'Theology' },
  { id: 'apologetics', label: 'Apologetics' },
  { id: 'bible-study', label: 'Bible study' },
  { id: 'hermeneutics', label: 'Hermeneutics' },
  { id: 'discipleship', label: 'Discipleship' },
  { id: 'pastoral-care', label: 'Pastoral care' },
  { id: 'counseling', label: 'Counseling' },
  { id: 'worship', label: 'Worship leading' },
  { id: 'youth', label: 'Youth ministry' },
  { id: 'missions', label: 'Missions' },
  { id: 'church-history', label: 'Church history' },
  { id: 'leadership', label: 'Leadership' },
  { id: 'evangelism', label: 'Evangelism' },
] as const;

const isValidEmail = (e: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  return name.trim().substring(0, 2).toUpperCase();
}

type LangGroup = { language: string; entries: TranslationEntry[] };

function groupByLanguage(entries: TranslationEntry[]): LangGroup[] {
  const map = new Map<string, TranslationEntry[]>();
  for (const e of entries) {
    const lang = e.language || 'Other';
    if (!map.has(lang)) map.set(lang, []);
    map.get(lang)!.push(e);
  }
  const groups = [...map.entries()].map(([language, ents]) => ({ language, entries: ents }));
  groups.sort((a, b) => {
    if (a.language === 'English') return -1;
    if (b.language === 'English') return 1;
    return a.language.localeCompare(b.language);
  });
  return groups;
}

// ─── SVG Icons for Settings Rows ─────────────────────────────────────────────

function PersonRowIcon({ color }: { color: string }) {
  return (
    <Svg width={16} height={16} viewBox="0 0 16 16" fill="none">
      <Circle cx={8} cy={6} r={2.8} stroke={color} strokeWidth={1.5} />
      <Path d="M2.5 14c1-2.6 3-4 5.5-4s4.5 1.4 5.5 4" stroke={color} strokeWidth={1.5} strokeLinecap="round" />
    </Svg>
  );
}

function EmailRowIcon({ color }: { color: string }) {
  return (
    <Svg width={16} height={16} viewBox="0 0 16 16" fill="none">
      <Path d="M2 4h12v8a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V4z M2 4l6 4 6-4" stroke={color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

function ChevronRight({ color }: { color: string }) {
  return (
    <Svg width={8} height={14} viewBox="0 0 8 14" fill="none">
      <Path d="M1 1l6 6-6 6" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
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

function CameraIcon({ color }: { color: string }) {
  return (
    <Svg width={14} height={14} viewBox="0 0 14 14" fill="none">
      <Path d="M2.5 4h2L6 2.5h2L9.5 4h2a1 1 0 0 1 1 1v6a1 1 0 0 1-1 1h-9a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1z" stroke={color} strokeWidth={1.4} strokeLinejoin="round" />
      <Circle cx={7} cy={8} r={2} stroke={color} strokeWidth={1.4} />
    </Svg>
  );
}

// ─── Shared Components ───────────────────────────────────────────────────────

function RowIcon({ bg, children }: { bg: string; children: React.ReactNode }) {
  return (
    <View style={{ width: 28, height: 28, borderRadius: 7, backgroundColor: bg, alignItems: 'center', justifyContent: 'center' }}>
      {children}
    </View>
  );
}

function Divider({ indent = 56 }: { indent?: number }) {
  const t = useTheme();
  return <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: t.separator, marginLeft: indent, marginRight: 16 }} />;
}

// ─── Main Settings Screen ────────────────────────────────────────────────────

export default function SettingsScreen() {
  const router = useRouter();
  const t = useTheme();
  const s = useMemo(() => makeStyles(t), [t]);
  // Android renders this "modal" full-screen and edge-to-edge — without
  // insets the nav buttons sit under the status bar and the content ends
  // under the gesture bar. On iOS sheets the insets resolve to ~0.
  const insets = useSafeAreaInsets();
  // iOS modal sheets already inset for the notch (and show a grab handle), so
  // only add top padding on Android edge-to-edge. Adding it on iOS too was
  // stacking and leaving a big gap at the top.
  const containerStyle = [
    s.container,
    { paddingTop: Platform.OS === 'android' ? insets.top : 0, paddingBottom: insets.bottom },
  ];
  const { user, signOut, updateProfile, changeEmail } = useAuth();

  const [page, setPage] = useState<'root' | 'edit-profile' | 'change-email' | 'faq' | 'privacy' | 'terms'>('root');
  const [expandedFaq, setExpandedFaq] = useState<number | null>(null);

  // Deepgram key state (optional — better transcription when set)
  const [deepgram, setDeepgram] = useState('');
  const [showDeepgramKey, setShowDeepgramKey] = useState(false);
  // Gemini key state (optional — free-tier outline engine)
  const [gemini, setGemini] = useState('');
  const [showGeminiKey, setShowGeminiKey] = useState(false);
  // Anthropic key state (optional — higher-quality outlines, paid)
  const [anthropic, setAnthropic] = useState('');
  const [showAnthropicKey, setShowAnthropicKey] = useState(false);

  // Translation state
  const [translation, setTrans] = useState('web');
  const [apiBibles, setApiBibles] = useState<TranslationEntry[]>([]);
  const [apiBibleStatus, setApiBibleStatus] = useState<'loading' | 'ready' | 'unavailable'>('loading');
  const [bibleSearch, setBibleSearch] = useState('');
  const [bibleModalOpen, setBibleModalOpen] = useState(false);

  // Profile state
  const [displayName, setDisplayName] = useState('');
  const [profileRole, setProfileRole] = useState('');
  const [profileChurch, setProfileChurch] = useState('');
  const [profileDenom, setProfileDenom] = useState('');
  const [profileInterests, setProfileInterests] = useState<string[]>([]);
  const [avatarUri, setAvatarUriState] = useState<string | null>(null);
  const [newEmail, setNewEmail] = useState('');

  const [loaded, setLoaded] = useState(false);

  const [audioStorageMb, setAudioStorageMb] = useState<string | null>(null);
  const [crashCount, setCrashCount] = useState(0);

  useEffect(() => {
    void (async () => {
      const [tr, av, dg, an, gm] = await Promise.all([
        getTranslation(), getAvatarUri(), getDeepgramKey(), getAnthropicKey(), getGeminiKey(),
      ]);
      setDeepgram(dg ?? '');
      setAnthropic(an ?? '');
      setGemini(gm ?? '');
      setTrans(tr);
      setAvatarUriState(av);
      setLoaded(true);
      try {
        const bibles = await fetchApiBibleTranslations();
        setApiBibles(bibles);
        setApiBibleStatus('ready');
      } catch {
        setApiBibleStatus('unavailable');
      }
      const bytes = await getAudioStorageBytes().catch(() => 0);
      setAudioStorageMb((bytes / (1024 * 1024)).toFixed(1));
      const crashes = await getCrashLog().catch(() => []);
      setCrashCount(crashes.length);
    })();
  }, []);

  useEffect(() => {
    if (user?.user_metadata) {
      const m = user.user_metadata;
      setDisplayName((m.display_name as string) ?? '');
      setProfileRole((m.role as string) ?? '');
      setProfileChurch((m.church as string) ?? '');
      setProfileDenom((m.denomination as string) ?? '');
      setProfileInterests((m.interests as string[]) ?? []);
    }
  }, [user]);

  if (!loaded) return null;

  const onDone = async () => {
    // Save and close immediately — never block the Done button on a network
    // round-trip. (We don't validate after closing: the screen is gone, so
    // there's nowhere to show the result.)
    await setDeepgramKey(deepgram.trim());
    await setAnthropicKey(anthropic.trim());
    await setGeminiKey(gemini.trim());
    await setTranslation(translation);
    router.back();
  };

  const pickAvatar = async () => {
    try {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        Alert.alert('Photo Access Needed', 'Allow photo access in Settings to choose a profile picture.');
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.7,
      });
      if (result.canceled || !result.assets?.[0]?.uri) return;
      // Copy into the app's documents so it survives the picker's temp cache.
      const dir = `${FileSystem.documentDirectory ?? ''}profile/`;
      await FileSystem.makeDirectoryAsync(dir, { intermediates: true }).catch(() => {});
      const dest = `${dir}avatar-${Date.now()}.jpg`;
      await FileSystem.copyAsync({ from: result.assets[0].uri, to: dest });
      await setAvatarUri(dest);
      setAvatarUriState(dest);
    } catch (e) {
      Alert.alert('Could not set picture', e instanceof Error ? e.message : 'Please try again.');
    }
  };

  const onSignOut = async () => {
    await signOut();
    router.replace('/');
  };

  const onContactSupport = () => {
    const subject = encodeURIComponent('Scribe support request');
    const body = encodeURIComponent(
      `\n\n---\nApp version: ${Constants.expoConfig?.version ?? '1.0.0'}\nPlatform: ${Platform.OS}`,
    );
    void Linking.openURL(`mailto:${SUPPORT_EMAIL}?subject=${subject}&body=${body}`);
  };

  const onDeleteAccount = () => {
    Alert.alert(
      'Delete account?',
      'This permanently removes your account from our auth provider. Your local sermons and audio stay on this device. To finish deletion, we need a confirmation by email.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Email Support',
          style: 'destructive',
          onPress: () => {
            const subject = encodeURIComponent('Delete my Scribe account');
            const body = encodeURIComponent(
              `Please permanently delete the account associated with this email address.\n\nUser ID: ${user?.id ?? 'unknown'}\nApp version: ${Constants.expoConfig?.version ?? '1.0.0'}`,
            );
            void Linking.openURL(`mailto:${SUPPORT_EMAIL}?subject=${subject}&body=${body}`);
            void signOut().then(() => router.replace('/'));
          },
        },
      ],
    );
  };

  const onSaveProfile = async () => {
    await updateProfile({
      display_name: displayName.trim(),
      role: profileRole,
      church: profileChurch,
      denomination: profileDenom,
      interests: profileInterests,
    });
    setPage('root');
  };

  const onSendEmailChange = async () => {
    if (!isValidEmail(newEmail.trim()) || newEmail.trim() === user?.email) return;
    await changeEmail(newEmail.trim());
    setPage('root');
  };

  const userName = displayName || user?.user_metadata?.display_name as string || '';
  const userEmail = user?.email ?? '';
  const userInitials = userName ? getInitials(userName) : userEmail ? userEmail[0].toUpperCase() : '?';

  // ─── Edit Profile ────────────────────────────────────────────────────────

  if (page === 'edit-profile') {
    return (
      <KeyboardAvoidingView style={containerStyle} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <Stack.Screen options={{ headerShown: false, presentation: 'modal' }} />
        <View style={s.grabHandle} />
        <View style={s.subNavBar}>
          <TouchableOpacity onPress={() => setPage('root')} style={s.backBtn}>
            <BackChevron color={t.accentBlue} />
            <Text style={[s.backText, { color: t.accentBlue }]}>Settings</Text>
          </TouchableOpacity>
          <Text style={s.subNavTitle}>Edit Profile</Text>
          <TouchableOpacity onPress={onSaveProfile} style={{ width: 60, alignItems: 'flex-end' }}>
            <Text style={[s.doneText, { color: t.accentBlue }]}>Save</Text>
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={s.scrollContent} showsVerticalScrollIndicator={false}>
          {/* Avatar */}
          <View style={{ alignItems: 'center', paddingTop: 20, paddingBottom: 8 }}>
            <TouchableOpacity style={{ position: 'relative' }} onPress={() => void pickAvatar()} activeOpacity={0.8} accessibilityRole="button" accessibilityLabel="Change profile picture">
              {avatarUri ? (
                <Image source={{ uri: avatarUri }} style={s.bigAvatar} />
              ) : (
                <View style={s.bigAvatar}>
                  <Text style={s.bigAvatarText}>{userInitials}</Text>
                </View>
              )}
              <View style={s.cameraBtn}>
                <CameraIcon color={t.accentBlue} />
              </View>
            </TouchableOpacity>
          </View>

          {/* Display name */}
          <Text style={s.sectionLabel}>DISPLAY NAME</Text>
          <View style={[s.card, { marginHorizontal: 16 }]}>
            <TextInput
              style={[s.cardInput, { color: t.textPrimary }]}
              value={displayName}
              onChangeText={setDisplayName}
              placeholder="Your name"
              placeholderTextColor={t.textTertiary}
              autoCapitalize="words"
            />
          </View>
          <Text style={s.hintText}>Shown when you share sermons with your team.</Text>

          {/* Role */}
          <Text style={s.sectionLabel}>HOW WOULD YOU DESCRIBE YOURSELF?</Text>
          <View style={[s.card, { marginHorizontal: 16 }]}>
            {PROFILE_ROLES.map((r, i) => (
              <React.Fragment key={r.id}>
                <TouchableOpacity
                  onPress={() => setProfileRole(r.id)}
                  style={s.roleRow}
                  activeOpacity={0.6}
                >
                  <View style={[
                    s.radioCircle,
                    profileRole === r.id
                      ? { borderColor: t.accentBlue, backgroundColor: t.accentBlue }
                      : { borderColor: t.textTertiary, backgroundColor: 'transparent' },
                  ]}>
                    {profileRole === r.id && <View style={s.radioInner} />}
                  </View>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={[s.roleLabel, { color: t.textPrimary }]}>{r.label}</Text>
                    <Text style={[s.roleDesc, { color: t.textSecondary }]}>{r.desc}</Text>
                  </View>
                </TouchableOpacity>
                {i < PROFILE_ROLES.length - 1 && <Divider indent={50} />}
              </React.Fragment>
            ))}
          </View>

          {/* Church (conditional) */}
          {CHURCH_ROLES.includes(profileRole) && (
            <>
              <Text style={s.sectionLabel}>CHURCH</Text>
              <View style={[s.card, { marginHorizontal: 16 }]}>
                <View style={s.fieldRow}>
                  <Text style={[s.fieldLabel, { color: t.textSecondary }]}>Name</Text>
                  <TextInput
                    style={[s.fieldInput, { color: t.textPrimary }]}
                    value={profileChurch}
                    onChangeText={setProfileChurch}
                    placeholder="Add your church"
                    placeholderTextColor={t.textTertiary}
                  />
                </View>
                <Divider indent={16} />
                <View style={s.fieldRow}>
                  <Text style={[s.fieldLabel, { color: t.textSecondary }]}>Tradition</Text>
                  <TextInput
                    style={[s.fieldInput, { color: t.textPrimary }]}
                    value={profileDenom}
                    onChangeText={setProfileDenom}
                    placeholder="Optional"
                    placeholderTextColor={t.textTertiary}
                  />
                </View>
              </View>
            </>
          )}

          {/* Interests */}
          <Text style={s.sectionLabel}>INTERESTS</Text>
          <View style={[s.card, { marginHorizontal: 16, padding: 14 }]}>
            <View style={s.chipsWrap}>
              {PROFILE_INTERESTS.map((int) => {
                const active = profileInterests.includes(int.id);
                return (
                  <TouchableOpacity
                    key={int.id}
                    onPress={() => {
                      setProfileInterests(prev =>
                        active ? prev.filter(x => x !== int.id) : [...prev, int.id]
                      );
                    }}
                    style={[
                      s.chip,
                      active
                        ? { backgroundColor: t.accentBlue, borderWidth: 0 }
                        : { backgroundColor: t.bgPrimary, borderWidth: 0.5, borderColor: t.separator },
                    ]}
                    activeOpacity={0.7}
                  >
                    {active && <CheckIcon size={12} color="#fff" />}
                    <Text style={[s.chipText, { color: active ? '#fff' : t.textPrimary, fontWeight: active ? '500' : '400' }]}>
                      {int.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
          <Text style={s.hintText}>We use these to tailor outline suggestions and scripture lookups.</Text>
          <View style={{ height: 32 }} />
        </ScrollView>
      </KeyboardAvoidingView>
    );
  }

  // ─── Change Email ────────────────────────────────────────────────────────

  if (page === 'change-email') {
    const valid = isValidEmail(newEmail.trim());
    const isDifferent = newEmail.trim() !== userEmail;
    const canSubmit = valid && isDifferent;

    return (
      <KeyboardAvoidingView style={containerStyle} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <Stack.Screen options={{ headerShown: false, presentation: 'modal' }} />
        <View style={s.grabHandle} />
        <View style={s.subNavBar}>
          <TouchableOpacity onPress={() => { setNewEmail(''); setPage('root'); }} style={s.backBtn}>
            <BackChevron color={t.accentBlue} />
            <Text style={[s.backText, { color: t.accentBlue }]}>Settings</Text>
          </TouchableOpacity>
          <Text style={s.subNavTitle}>Change Email</Text>
          <View style={{ width: 60 }} />
        </View>

        <ScrollView contentContainerStyle={s.scrollContent} showsVerticalScrollIndicator={false}>
          <View style={{ paddingHorizontal: 24, paddingTop: 24 }}>
            <View style={s.emailIconWrap}>
              <Svg width={28} height={28} viewBox="0 0 28 28" fill="none">
                <Rect x={3} y={6} width={22} height={16} rx={3} stroke={t.accentBlue} strokeWidth={1.6} />
                <Path d="M4 8l10 7 10-7" stroke={t.accentBlue} strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" />
              </Svg>
            </View>
            <Text style={s.changeEmailTitle}>Update your email</Text>
            <Text style={s.changeEmailSub}>We'll send a 6-digit code to the new address to confirm it's yours.</Text>
          </View>

          <Text style={s.sectionLabel}>CURRENT EMAIL</Text>
          <View style={[s.card, { marginHorizontal: 16 }]}>
            <View style={s.currentEmailRow}>
              <Text style={[typography.body, { color: t.textSecondary, flex: 1 }]}>{userEmail}</Text>
              <View style={s.verifiedBadge}>
                <CheckIcon size={11} color="#30B65B" />
                <Text style={s.verifiedText}>Verified</Text>
              </View>
            </View>
          </View>

          <Text style={s.sectionLabel}>NEW EMAIL</Text>
          <View style={[s.card, { marginHorizontal: 16 }]}>
            <View style={s.newEmailRow}>
              <Svg width={18} height={18} viewBox="0 0 18 18" fill="none">
                <Rect x={1.5} y={3.5} width={15} height={11} rx={2} stroke={t.textSecondary} strokeWidth={1.6} />
                <Path d="M2 5l7 5 7-5" stroke={t.textSecondary} strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" />
              </Svg>
              <TextInput
                style={[s.newEmailInput, { color: t.textPrimary }]}
                value={newEmail}
                onChangeText={setNewEmail}
                placeholder="new@email.com"
                placeholderTextColor={t.textTertiary}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                autoFocus
              />
              {newEmail.length > 0 && (
                <TouchableOpacity onPress={() => setNewEmail('')} style={{ padding: 2 }}>
                  <View style={[s.clearCircle, { backgroundColor: t.textTertiary }]}>
                    <Text style={{ color: '#fff', fontSize: 11, fontWeight: '700' }}>✕</Text>
                  </View>
                </TouchableOpacity>
              )}
            </View>
          </View>
          <Text style={[s.hintText, newEmail && !valid ? { color: t.statusError } : {}]}>
            {newEmail && !valid
              ? "That doesn't look like a valid email."
              : valid && !isDifferent
                ? "That's already your email."
                : canSubmit
                  ? `We'll send a code to ${newEmail.trim()}.`
                  : "You'll need access to the inbox to confirm."}
          </Text>

          <View style={{ flex: 1 }} />
        </ScrollView>

        <View style={{ paddingHorizontal: 20, paddingBottom: 14 }}>
          <TouchableOpacity
            style={[s.primaryBtn, { backgroundColor: canSubmit ? t.accentBlue : '#C7C7CC' }]}
            activeOpacity={0.85}
            onPress={onSendEmailChange}
            disabled={!canSubmit}
          >
            <Text style={s.primaryBtnText}>Send verification code</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    );
  }

  // ─── FAQ ─────────────────────────────────────────────────────────────────

  if (page === 'faq') {
    return (
      <View style={containerStyle}>
        <Stack.Screen options={{ headerShown: false, presentation: 'modal' }} />
        <View style={s.grabHandle} />
        <View style={s.subNavBar}>
          <TouchableOpacity
            onPress={() => setPage('root')}
            style={s.backBtn}
            accessibilityRole="button"
            accessibilityLabel="Back to settings"
          >
            <BackChevron color={t.accentBlue} />
            <Text style={[s.backText, { color: t.accentBlue }]}>Settings</Text>
          </TouchableOpacity>
          <Text style={s.subNavTitle}>Help & FAQ</Text>
          <View style={{ width: 90 }} />
        </View>
        <ScrollView contentContainerStyle={s.scrollContent} showsVerticalScrollIndicator={false}>
          <View style={[s.card, { marginHorizontal: 16, marginTop: 12 }]}>
            {FAQ.map((entry, i) => {
              const expanded = expandedFaq === i;
              return (
                <React.Fragment key={i}>
                  <TouchableOpacity
                    onPress={() => setExpandedFaq(expanded ? null : i)}
                    style={{ paddingHorizontal: 16, paddingVertical: 14 }}
                    activeOpacity={0.6}
                    accessibilityRole="button"
                    accessibilityLabel={entry.q}
                    accessibilityState={{ expanded }}
                  >
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                      <Text style={[typography.body, { color: t.textPrimary, flex: 1, fontWeight: expanded ? '600' : '400' }]}>
                        {entry.q}
                      </Text>
                      <Text style={{ color: t.textTertiary, fontSize: 16 }}>{expanded ? '−' : '+'}</Text>
                    </View>
                    {expanded && (
                      <Text style={[typography.subhead, { color: t.textSecondary, marginTop: 8, lineHeight: 21 }]}>
                        {entry.a}
                      </Text>
                    )}
                  </TouchableOpacity>
                  {i < FAQ.length - 1 && <Divider indent={16} />}
                </React.Fragment>
              );
            })}
          </View>
          <View style={{ paddingHorizontal: 20, paddingVertical: 24 }}>
            <Text style={[typography.footnote, { color: t.textSecondary, textAlign: 'center' }]}>
              Still stuck? Tap Contact support in Settings to email us.
            </Text>
          </View>
        </ScrollView>
      </View>
    );
  }

  // ─── Privacy ─────────────────────────────────────────────────────────────

  if (page === 'privacy' || page === 'terms') {
    const isPrivacy = page === 'privacy';
    return (
      <View style={containerStyle}>
        <Stack.Screen options={{ headerShown: false, presentation: 'modal' }} />
        <View style={s.grabHandle} />
        <View style={s.subNavBar}>
          <TouchableOpacity
            onPress={() => setPage('root')}
            style={s.backBtn}
            accessibilityRole="button"
            accessibilityLabel="Back to settings"
          >
            <BackChevron color={t.accentBlue} />
            <Text style={[s.backText, { color: t.accentBlue }]}>Settings</Text>
          </TouchableOpacity>
          <Text style={s.subNavTitle}>{isPrivacy ? 'Privacy Policy' : 'Terms of Service'}</Text>
          <View style={{ width: 90 }} />
        </View>
        <ScrollView contentContainerStyle={[s.scrollContent, { paddingHorizontal: 22, paddingTop: 12 }]} showsVerticalScrollIndicator={false}>
          <Text style={[typography.subhead, { color: t.textPrimary, lineHeight: 22 }]}>
            {isPrivacy ? PRIVACY_POLICY_TEXT : TERMS_TEXT}
          </Text>
          <TouchableOpacity
            onPress={() => void Linking.openURL(isPrivacy ? PRIVACY_POLICY_URL : TERMS_URL)}
            style={{ paddingVertical: 20, alignItems: 'center' }}
            accessibilityRole="link"
          >
            <Text style={[typography.footnote, { color: t.accentBlue }]}>
              View online version
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </View>
    );
  }

  // ─── Settings Root ───────────────────────────────────────────────────────

  const isBibleSearching = bibleSearch.trim().length > 0;
  // Combined pool (built-in + API) powers the translation picker popup.
  const allTranslations = [...LEGACY_TRANSLATIONS, ...apiBibles];
  const matchesSearch = (b: TranslationEntry) =>
    b.label.toLowerCase().includes(bibleSearch.toLowerCase()) ||
    b.abbr.toLowerCase().includes(bibleSearch.toLowerCase()) ||
    b.language.toLowerCase().includes(bibleSearch.toLowerCase());
  const filteredAll = isBibleSearching ? allTranslations.filter(matchesSearch) : allTranslations;
  const allGroups = groupByLanguage(filteredAll);
  // Without a search, only show English (what most users want) and tuck the
  // other languages behind search so the list isn't a 200-item scroll.
  const visibleGroups = isBibleSearching ? allGroups : allGroups.filter((g) => g.language === 'English');
  const hiddenLangCount = isBibleSearching ? 0 : allGroups.length - visibleGroups.length;

  const selectedTranslation = allTranslations.find((tr) => tr.id === translation);
  const selectedLabel = selectedTranslation
    ? `${selectedTranslation.label} · ${selectedTranslation.abbr}`
    : 'World English Bible · WEB';

  return (
    <KeyboardAvoidingView style={containerStyle} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Stack.Screen options={{ headerShown: false, presentation: 'modal' }} />
      <View style={s.grabHandle} />
      <View style={s.navBar}>
        <View style={{ width: 60 }} />
        <Text style={s.navTitle}>Settings</Text>
        <TouchableOpacity onPress={onDone} style={{ width: 60, alignItems: 'flex-end' }}>
          <Text style={[s.doneText, { color: t.accentBlue }]}>Done</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={s.scrollContent} showsVerticalScrollIndicator={false}>

        {/* Profile Card */}
        {user ? (
          <View style={[s.card, { marginHorizontal: 16, marginTop: 12 }]}>
            <TouchableOpacity onPress={() => setPage('edit-profile')} style={s.profileRow} activeOpacity={0.6}>
              {avatarUri ? (
                <Image source={{ uri: avatarUri }} style={s.avatar} />
              ) : (
                <View style={s.avatar}>
                  <Text style={s.avatarText}>{userInitials}</Text>
                </View>
              )}
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={[s.profileName, { color: t.textPrimary }]} numberOfLines={1}>{userName || 'Set up profile'}</Text>
                <Text style={[s.profileEmail, { color: t.textSecondary }]} numberOfLines={1}>{userEmail}</Text>
              </View>
              <ChevronRight color={t.textTertiary} />
            </TouchableOpacity>
          </View>
        ) : (
          <View style={[s.card, { marginHorizontal: 16, marginTop: 12 }]}>
            <View style={s.signInPrompt}>
              <View style={s.signInAvatar}>
                <Svg width={26} height={26} viewBox="0 0 26 26" fill="none">
                  <Circle cx={13} cy={9} r={4.5} stroke={t.textSecondary} strokeWidth={1.6} />
                  <Path d="M4 22c1.4-4 5-6 9-6s7.6 2 9 6" stroke={t.textSecondary} strokeWidth={1.6} strokeLinecap="round" />
                </Svg>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[typography.headline, { color: t.textPrimary, marginBottom: 3 }]}>Sign in to sync</Text>
                <Text style={[typography.footnote, { color: t.textSecondary }]}>Back up sermons across devices.</Text>
              </View>
              <TouchableOpacity
                onPress={() => router.replace('/sign-in')}
                style={[s.signInBtn, { backgroundColor: t.accentBlue }]}
              >
                <Text style={s.signInBtnText}>Sign in</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Account */}
        {user && (
          <>
            <Text style={s.sectionLabel}>ACCOUNT</Text>
            <View style={[s.card, { marginHorizontal: 16 }]}>
              <TouchableOpacity onPress={() => setPage('edit-profile')} style={s.settingsRow} activeOpacity={0.6}>
                <RowIcon bg={`${t.accentBlue}1A`}><PersonRowIcon color={t.accentBlue} /></RowIcon>
                <Text style={[s.rowText, { color: t.textPrimary }]}>Edit profile</Text>
                <ChevronRight color={t.textTertiary} />
              </TouchableOpacity>
              <Divider />
              <TouchableOpacity onPress={() => setPage('change-email')} style={s.settingsRow} activeOpacity={0.6}>
                <RowIcon bg={`${t.accentBlue}1A`}><EmailRowIcon color={t.accentBlue} /></RowIcon>
                <Text style={[s.rowText, { flex: 1, color: t.textPrimary }]}>Change email</Text>
                <Text style={[typography.footnote, { color: t.textSecondary, marginRight: 6, maxWidth: 140 }]} numberOfLines={1}>{userEmail}</Text>
                <ChevronRight color={t.textTertiary} />
              </TouchableOpacity>
            </View>

          </>
        )}

        {/* Deepgram API Key (optional override) */}
        <Text style={s.sectionLabel}>DEEPGRAM API KEY (OPTIONAL)</Text>
        <View style={[s.card, { marginHorizontal: 16 }]}>
          <Text style={s.helpText}>
            Transcription is included — you don't need a key. Advanced: add your own
            Deepgram key here to use your account instead.
          </Text>
          <Divider indent={16} />
          <View style={s.keyRow}>
            <TextInput
              style={[s.keyInput, { color: t.textPrimary }]}
              value={deepgram}
              onChangeText={setDeepgram}
              placeholder="Deepgram key (optional)"
              placeholderTextColor={t.textTertiary}
              autoCapitalize="none"
              autoCorrect={false}
              secureTextEntry={!showDeepgramKey}
            />
            <TouchableOpacity onPress={() => setShowDeepgramKey(v => !v)} style={{ padding: 4 }} hitSlop={8}>
              {showDeepgramKey
                ? <EyeOffIcon size={18} color={t.textSecondary} />
                : <EyeIcon size={18} color={t.textSecondary} />}
            </TouchableOpacity>
          </View>
        </View>

        {/* Gemini (Google) API Key (optional — free outline engine) */}
        <Text style={s.sectionLabel}>GEMINI API KEY (OPTIONAL)</Text>
        <View style={[s.card, { marginHorizontal: 16 }]}>
          <Text style={s.helpText}>
            Outlines are included — you don't need a key. Advanced: add your own
            free Google Gemini key (from aistudio.google.com) to use your account.
          </Text>
          <Divider indent={16} />
          <View style={s.keyRow}>
            <TextInput
              style={[s.keyInput, { color: t.textPrimary }]}
              value={gemini}
              onChangeText={setGemini}
              placeholder="Gemini key (optional)"
              placeholderTextColor={t.textTertiary}
              autoCapitalize="none"
              autoCorrect={false}
              secureTextEntry={!showGeminiKey}
            />
            <TouchableOpacity onPress={() => setShowGeminiKey(v => !v)} style={{ padding: 4 }} hitSlop={8}>
              {showGeminiKey
                ? <EyeOffIcon size={18} color={t.textSecondary} />
                : <EyeIcon size={18} color={t.textSecondary} />}
            </TouchableOpacity>
          </View>
        </View>

        {/* Anthropic (Claude) API Key (optional — higher quality, paid) */}
        <Text style={s.sectionLabel}>ANTHROPIC API KEY (OPTIONAL)</Text>
        <View style={[s.card, { marginHorizontal: 16 }]}>
          <Text style={s.helpText}>
            Advanced: add an Anthropic (Claude) key for higher-quality outlines
            (paid). If set, it's used when Gemini isn't available.
          </Text>
          <Divider indent={16} />
          <View style={s.keyRow}>
            <TextInput
              style={[s.keyInput, { color: t.textPrimary }]}
              value={anthropic}
              onChangeText={setAnthropic}
              placeholder="sk-ant-... (optional)"
              placeholderTextColor={t.textTertiary}
              autoCapitalize="none"
              autoCorrect={false}
              secureTextEntry={!showAnthropicKey}
            />
            <TouchableOpacity onPress={() => setShowAnthropicKey(v => !v)} style={{ padding: 4 }} hitSlop={8}>
              {showAnthropicKey
                ? <EyeOffIcon size={18} color={t.textSecondary} />
                : <EyeIcon size={18} color={t.textSecondary} />}
            </TouchableOpacity>
          </View>
        </View>

        {/* Bible Translation */}
        <Text style={s.sectionLabel}>BIBLE TRANSLATION</Text>
        <View style={[s.card, { marginHorizontal: 16 }]}>
          <TouchableOpacity
            style={s.settingsRow}
            activeOpacity={0.6}
            onPress={() => { setBibleSearch(''); setBibleModalOpen(true); }}
            accessibilityRole="button"
            accessibilityLabel="Choose Bible translation"
          >
            <Text style={[s.rowText, { color: t.textPrimary }]}>Translation</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexShrink: 1 }}>
              <Text style={[typography.body, { color: t.textSecondary }]} numberOfLines={1}>{selectedLabel}</Text>
              <ChevronRight color={t.textTertiary} />
            </View>
          </TouchableOpacity>
        </View>

        {/* Translation picker popup */}
        <Modal
          visible={bibleModalOpen}
          animationType="slide"
          presentationStyle="pageSheet"
          onRequestClose={() => setBibleModalOpen(false)}
        >
          <View style={{ flex: 1, backgroundColor: t.bgPrimary }}>
            <View style={s.grabHandle} />
            <View style={s.navBar}>
              <View style={{ width: 60 }} />
              <Text style={s.navTitle}>Translation</Text>
              <TouchableOpacity onPress={() => setBibleModalOpen(false)} style={{ width: 60, alignItems: 'flex-end' }}>
                <Text style={[s.doneText, { color: t.accentBlue }]}>Done</Text>
              </TouchableOpacity>
            </View>
            <View style={{ marginHorizontal: 16, marginBottom: 8 }}>
              <TextInput
                style={[s.searchInput, { color: t.textPrimary, backgroundColor: t.bgSurface, borderColor: t.separator }]}
                placeholder={apiBibles.length > 0 ? `Search ${allTranslations.length} translations & languages…` : 'Search translations…'}
                placeholderTextColor={t.textTertiary}
                value={bibleSearch}
                onChangeText={setBibleSearch}
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>
            <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 24 }} keyboardShouldPersistTaps="handled">
              {apiBibles.length === 0 && apiBibleStatus !== 'ready' && (
                <Text style={[s.hintText]}>
                  {apiBibleStatus === 'loading'
                    ? 'Loading more translations…'
                    : 'More translations (200+) need the API.Bible key configured and an internet connection. The versions here always work.'}
                </Text>
              )}
              {visibleGroups.map((group) => (
                <React.Fragment key={group.language}>
                  <Text style={s.langLabel}>{group.language}</Text>
                  <View style={[s.card, { marginHorizontal: 16 }]}>
                    {group.entries.map((tr, i) => (
                      <React.Fragment key={tr.id}>
                        <TouchableOpacity
                          onPress={() => { setTrans(tr.id); setBibleModalOpen(false); }}
                          style={s.translationRow}
                          activeOpacity={0.6}
                        >
                          <View style={{ flex: 1 }}>
                            <Text style={[typography.body, { color: t.textPrimary }]} numberOfLines={1}>{tr.label}</Text>
                            <Text style={[typography.footnote, { color: t.textSecondary }]}>{tr.abbr}</Text>
                          </View>
                          {translation === tr.id && <CheckIcon size={18} color={t.accentBlue} />}
                        </TouchableOpacity>
                        {i < group.entries.length - 1 && <Divider indent={16} />}
                      </React.Fragment>
                    ))}
                  </View>
                </React.Fragment>
              ))}
              {hiddenLangCount > 0 && (
                <Text style={[s.hintText, { textAlign: 'center' }]}>
                  + {hiddenLangCount} more languages — search to find them.
                </Text>
              )}
              {isBibleSearching && visibleGroups.length === 0 && (
                <Text style={[s.hintText, { textAlign: 'center' }]}>No translations match “{bibleSearch.trim()}”.</Text>
              )}
            </ScrollView>
          </View>
        </Modal>

        {/* Storage */}
        <Text style={s.sectionLabel}>STORAGE</Text>
        <View style={[s.card, { marginHorizontal: 16 }]}>
          <View style={s.settingsRow}>
            <Text style={[s.rowText, { color: t.textPrimary }]}>Audio recordings</Text>
            <Text style={[typography.body, { color: t.textSecondary }]}>{audioStorageMb ? `${audioStorageMb} MB` : '...'}</Text>
          </View>
          <Divider indent={16} />
          <View style={s.settingsRow}>
            <Text style={[s.rowText, { color: t.textPrimary }]}>Error log</Text>
            <Text style={[typography.body, { color: t.textSecondary }]}>{crashCount} entries</Text>
          </View>
          {crashCount > 0 && (
            <>
              <Divider indent={16} />
              <TouchableOpacity
                style={s.settingsRow}
                activeOpacity={0.6}
                onPress={() => {
                  void clearLogs().then(() => setCrashCount(0));
                }}
              >
                <Text style={[s.rowText, { color: t.destructive }]}>Clear error log</Text>
              </TouchableOpacity>
            </>
          )}
        </View>

        {/* Support */}
        <Text style={s.sectionLabel}>SUPPORT</Text>
        <View style={[s.card, { marginHorizontal: 16 }]}>
          <TouchableOpacity
            style={s.settingsRow}
            activeOpacity={0.6}
            onPress={() => setPage('faq')}
            accessibilityRole="button"
            accessibilityLabel="Open Help and FAQ"
          >
            <Text style={[s.rowText, { color: t.textPrimary }]}>Help & FAQ</Text>
            <ChevronRight color={t.textTertiary} />
          </TouchableOpacity>
          <Divider indent={16} />
          <TouchableOpacity
            style={s.settingsRow}
            activeOpacity={0.6}
            onPress={onContactSupport}
            accessibilityRole="button"
            accessibilityLabel="Email support"
          >
            <Text style={[s.rowText, { color: t.textPrimary }]}>Contact support</Text>
            <ChevronRight color={t.textTertiary} />
          </TouchableOpacity>
          <Divider indent={16} />
          <TouchableOpacity
            style={s.settingsRow}
            activeOpacity={0.6}
            onPress={() => setPage('privacy')}
            accessibilityRole="button"
            accessibilityLabel="Open privacy policy"
          >
            <Text style={[s.rowText, { color: t.textPrimary }]}>Privacy policy</Text>
            <ChevronRight color={t.textTertiary} />
          </TouchableOpacity>
          <Divider indent={16} />
          <TouchableOpacity
            style={s.settingsRow}
            activeOpacity={0.6}
            onPress={() => setPage('terms')}
            accessibilityRole="button"
            accessibilityLabel="Open terms of service"
          >
            <Text style={[s.rowText, { color: t.textPrimary }]}>Terms of service</Text>
            <ChevronRight color={t.textTertiary} />
          </TouchableOpacity>
          <Divider indent={16} />
          <View style={s.settingsRow}>
            <Text style={[typography.body, { color: t.textPrimary, flex: 1 }]}>Version</Text>
            <Text style={[typography.body, { color: t.textSecondary }]}>{Constants.expoConfig?.version ?? '1.0.0'}</Text>
          </View>
        </View>

        {/* Sign Out */}
        {user && (
          <>
            <View style={{ paddingHorizontal: 16, paddingTop: 28, paddingBottom: 8 }}>
              <TouchableOpacity
                onPress={onSignOut}
                style={[s.signOutBtn, { backgroundColor: t.bgSurface }]}
                activeOpacity={0.8}
              >
                <Text style={[typography.headline, { color: t.destructive, fontWeight: '500' }]}>Sign out</Text>
              </TouchableOpacity>
            </View>
            <TouchableOpacity
              style={{ alignItems: 'center', paddingVertical: 10, paddingBottom: 32 }}
              onPress={onDeleteAccount}
              accessibilityRole="button"
              accessibilityLabel="Delete account"
            >
              <Text style={[typography.footnote, { color: t.textSecondary }]}>Delete account</Text>
            </TouchableOpacity>
          </>
        )}

        {!user && <View style={{ height: 32 }} />}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

function makeStyles(t: Colors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: t.bgPrimary },

    grabHandle: {
      width: 36, height: 5, borderRadius: 3,
      backgroundColor: t.textTertiary,
      alignSelf: 'center', marginTop: 8, marginBottom: 2,
    },
    navBar: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      paddingHorizontal: 16, paddingVertical: 10,
    },
    navTitle: { ...typography.headline, color: t.textPrimary },
    doneText: { ...typography.body, fontWeight: '600' },

    subNavBar: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      paddingHorizontal: 16, paddingVertical: 10,
    },
    subNavTitle: { ...typography.headline, color: t.textPrimary },
    backBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, width: 90 },
    backText: { fontSize: 17, marginLeft: 2 },

    scrollContent: { paddingBottom: 32 },

    sectionLabel: {
      ...typography.sectionHeader,
      color: t.textSecondary,
      marginBottom: 8, marginLeft: 20, marginTop: 20,
    },
    langLabel: {
      ...typography.caption, color: t.accentBlue, fontWeight: '600',
      marginBottom: 4, marginLeft: 20, marginTop: 16,
    },

    card: {
      backgroundColor: t.bgSurface, borderRadius: radius.card,
      marginBottom: 8, overflow: 'hidden',
    },

    // Profile card
    profileRow: {
      flexDirection: 'row', alignItems: 'center', padding: 14, gap: 14,
    },
    avatar: {
      width: 52, height: 52, borderRadius: 26,
      backgroundColor: t.accentBlue,
      alignItems: 'center', justifyContent: 'center',
    },
    avatarText: { color: '#fff', fontWeight: '600', fontSize: 18, letterSpacing: 0.3 },
    profileName: { ...typography.headline, marginBottom: 3 },
    profileEmail: { ...typography.footnote },

    // Sign-in prompt
    signInPrompt: {
      flexDirection: 'row', alignItems: 'center', padding: 16, gap: 14,
    },
    signInAvatar: {
      width: 52, height: 52, borderRadius: 26,
      backgroundColor: '#E5E5EA',
      alignItems: 'center', justifyContent: 'center',
    },
    signInBtn: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: radius.pill },
    signInBtnText: { ...typography.subhead, color: '#fff', fontWeight: '600' },

    // Settings rows
    settingsRow: {
      flexDirection: 'row', alignItems: 'center',
      paddingHorizontal: 16, paddingVertical: 11, gap: 12,
    },
    rowText: { ...typography.body, flex: 1 },

    // Groq key
    helpText: { ...typography.footnote, color: t.textSecondary, padding: 16, lineHeight: 18 },
    keyRow: {
      flexDirection: 'row', alignItems: 'center',
      paddingHorizontal: 16, minHeight: 48,
    },
    keyInput: { ...typography.body, flex: 1, paddingVertical: 8 },
    keyStatusRow: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 16, paddingVertical: 8 },
    modeRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 12 },

    // Translation row
    translationRow: {
      flexDirection: 'row', alignItems: 'center',
      paddingHorizontal: 16, paddingVertical: 12, gap: 12,
    },

    searchInput: {
      borderRadius: radius.small, paddingHorizontal: 14, height: 40,
      fontSize: 15, borderWidth: 0.5,
    },

    // Sign out
    signOutBtn: {
      height: 50, borderRadius: 14, alignItems: 'center', justifyContent: 'center',
    },

    // Edit profile
    bigAvatar: {
      width: 96, height: 96, borderRadius: 48,
      backgroundColor: t.accentBlue,
      alignItems: 'center', justifyContent: 'center',
      ...Platform.select({
        ios: { shadowColor: t.accentBlue, shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.33, shadowRadius: 12 },
        android: { elevation: 8 },
      }),
    },
    bigAvatarText: { color: '#fff', fontWeight: '600', fontSize: 36, letterSpacing: 0.5 },
    cameraBtn: {
      position: 'absolute', bottom: -2, right: -2, width: 32, height: 32, borderRadius: 16,
      backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center',
      ...Platform.select({
        ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.18, shadowRadius: 6 },
        android: { elevation: 4 },
      }),
    },
    cardInput: { ...typography.body, paddingHorizontal: 16, paddingVertical: 12 },
    hintText: { ...typography.footnote, color: t.textSecondary, paddingHorizontal: 22, paddingTop: 6, paddingBottom: 4 },

    roleRow: {
      flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, gap: 12,
    },
    radioCircle: {
      width: 22, height: 22, borderRadius: 11, borderWidth: 1.5,
      alignItems: 'center', justifyContent: 'center',
    },
    radioInner: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#fff' },
    roleLabel: { ...typography.body, marginBottom: 2 },
    roleDesc: { ...typography.footnote },

    fieldRow: {
      flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12,
    },
    fieldLabel: { ...typography.footnote, width: 90 },
    fieldInput: { ...typography.body, flex: 1, paddingVertical: 0 },

    chipsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    chip: {
      flexDirection: 'row', alignItems: 'center', gap: 5,
      paddingHorizontal: 14, paddingVertical: 8, borderRadius: radius.pill,
    },
    chipText: { ...typography.subhead },

    // Change email
    emailIconWrap: {
      width: 56, height: 56, borderRadius: 14,
      backgroundColor: t.bgSurface, alignItems: 'center', justifyContent: 'center',
      marginBottom: 18,
    },
    changeEmailTitle: {
      fontSize: 28, fontWeight: '700', color: t.textPrimary,
      letterSpacing: -0.6, lineHeight: 33, marginBottom: 10,
    },
    changeEmailSub: { ...typography.body, color: t.textSecondary, lineHeight: 24 },
    currentEmailRow: {
      flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, gap: 10,
    },
    verifiedBadge: {
      flexDirection: 'row', alignItems: 'center', gap: 4,
      backgroundColor: '#30B65B1A', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 4,
    },
    verifiedText: { ...typography.caption, color: '#30B65B', fontWeight: '500' },
    newEmailRow: {
      flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, gap: 12,
    },
    newEmailInput: { ...typography.body, flex: 1, paddingVertical: 0 },
    clearCircle: {
      width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center',
    },
    primaryBtn: { height: 50, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
    primaryBtnText: { ...typography.headline, color: '#fff', fontWeight: '600' },
  });
}
