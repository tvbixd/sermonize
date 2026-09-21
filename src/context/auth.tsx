import type { Session, User } from '@supabase/supabase-js';
import { makeRedirectUri } from 'expo-auth-session';
import * as WebBrowser from 'expo-web-browser';
import React, { createContext, useContext, useEffect, useState } from 'react';
import { isSupabaseConfigured, supabase } from '@/lib/supabase';

const NOT_CONFIGURED =
  'Sign-in is not available in this build (auth service not configured). You can still use the app without an account.';

/** Sentinel: the user closed the OAuth browser — not an error to display. */
export const OAUTH_CANCELLED = 'OAUTH_CANCELLED';

const oauthRedirectTo = makeRedirectUri({ scheme: 'scribe', path: 'auth-callback' });

type AuthResult = { error: string | null };
type AuthResultWithUser = { error: string | null; isNewUser: boolean; userName: string | null };

type AuthState = {
  session: Session | null;
  user: User | null;
  loading: boolean;
  signOut: () => Promise<void>;
  signInWithIdToken: (provider: 'google' | 'apple', idToken: string, nonce?: string) => Promise<AuthResultWithUser>;
  signInWithOAuth: (provider: 'google' | 'apple') => Promise<AuthResultWithUser>;
  sendOtp: (email: string) => Promise<AuthResult>;
  verifyOtp: (email: string, token: string) => Promise<AuthResultWithUser>;
  updateProfile: (data: Record<string, unknown>) => Promise<AuthResult>;
  changeEmail: (newEmail: string) => Promise<AuthResult>;
  setTestUser: (email: string, displayName: string) => void;
};

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [testUser, setTestUserState] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    const finish = (s: Session | null) => {
      if (!mounted) return;
      setSession(s);
      setLoading(false);
    };

    // getSession() can reject or stall (offline, or a stored token refreshing
    // against a slow/unreachable auth server). Always resolve loading, and never
    // let the app hang on a blank screen after the splash.
    supabase.auth.getSession()
      .then(({ data: { session: s } }) => finish(s))
      .catch(() => finish(null));
    const safety = setTimeout(() => { if (mounted) setLoading(false); }, 3000);

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, s) => {
      if (mounted) setSession(s);
    });

    return () => {
      mounted = false;
      clearTimeout(safety);
      subscription.unsubscribe();
    };
  }, []);

  const setTestUser = (email: string, displayName: string) => {
    if (!__DEV__) return;
    setTestUserState({
      id: 'test-user',
      email,
      user_metadata: { display_name: displayName },
      app_metadata: {},
      aud: 'authenticated',
      created_at: new Date().toISOString(),
    } as unknown as User);
  };

  const signOut = async () => {
    setTestUserState(null);
    await supabase.auth.signOut();
  };

  const signInWithIdToken = async (provider: 'google' | 'apple', idToken: string, nonce?: string): Promise<AuthResultWithUser> => {
    if (!isSupabaseConfigured) return { error: NOT_CONFIGURED, isNewUser: false, userName: null };
    const { data, error } = await supabase.auth.signInWithIdToken({
      provider,
      token: idToken,
      nonce,
    });
    if (error) return { error: error.message, isNewUser: false, userName: null };
    const userName = data.user?.user_metadata?.display_name ?? null;
    return { error: null, isNewUser: !userName, userName };
  };

  /**
   * Web-based OAuth (Google/Apple) via the system browser. Works in any
   * native build — requires the provider to be enabled in Supabase and
   * `scribe://auth-callback` added to the allowed redirect URLs.
   */
  const signInWithOAuth = async (provider: 'google' | 'apple'): Promise<AuthResultWithUser> => {
    if (!isSupabaseConfigured) return { error: NOT_CONFIGURED, isNewUser: false, userName: null };
    try {
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider,
        options: { redirectTo: oauthRedirectTo, skipBrowserRedirect: true },
      });
      if (error || !data?.url) {
        return { error: error?.message ?? 'Could not start sign-in.', isNewUser: false, userName: null };
      }
      const result = await WebBrowser.openAuthSessionAsync(data.url, oauthRedirectTo);
      if (result.type !== 'success' || !result.url) {
        return { error: OAUTH_CANCELLED, isNewUser: false, userName: null };
      }
      const url = new URL(result.url);
      const errorDesc = url.searchParams.get('error_description');
      if (errorDesc) return { error: errorDesc, isNewUser: false, userName: null };
      const code = url.searchParams.get('code');
      if (!code) return { error: 'Sign-in did not return a code. Check the provider setup in Supabase.', isNewUser: false, userName: null };
      const { data: sessionData, error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
      if (exchangeError) return { error: exchangeError.message, isNewUser: false, userName: null };
      const userName = sessionData.user?.user_metadata?.display_name ?? null;
      return { error: null, isNewUser: !userName, userName };
    } catch (e) {
      return { error: e instanceof Error ? e.message : 'Sign-in failed.', isNewUser: false, userName: null };
    }
  };

  const sendOtp = async (email: string): Promise<AuthResult> => {
    if (!isSupabaseConfigured) return { error: NOT_CONFIGURED };
    const { error } = await supabase.auth.signInWithOtp({ email });
    return { error: error?.message ?? null };
  };

  const verifyOtp = async (email: string, token: string): Promise<AuthResultWithUser> => {
    if (!isSupabaseConfigured) return { error: NOT_CONFIGURED, isNewUser: false, userName: null };
    const { data, error } = await supabase.auth.verifyOtp({ email, token, type: 'email' });
    if (error) return { error: error.message, isNewUser: false, userName: null };
    const userName = data.user?.user_metadata?.display_name ?? null;
    return { error: null, isNewUser: !userName, userName };
  };

  const updateProfile = async (data: Record<string, unknown>): Promise<AuthResult> => {
    const { error } = await supabase.auth.updateUser({ data });
    return { error: error?.message ?? null };
  };

  const changeEmail = async (newEmail: string): Promise<AuthResult> => {
    const { error } = await supabase.auth.updateUser({ email: newEmail });
    return { error: error?.message ?? null };
  };

  return (
    <AuthContext.Provider
      value={{
        session: session ?? (__DEV__ && testUser ? ({ user: testUser } as unknown as Session) : null),
        user: session?.user ?? (__DEV__ ? testUser : null),
        loading,
        signOut,
        signInWithIdToken,
        signInWithOAuth,
        sendOtp,
        verifyOtp,
        updateProfile,
        changeEmail,
        setTestUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
