import type { Session, User } from '@supabase/supabase-js';
import React, { createContext, useContext, useEffect, useState } from 'react';
import { isSupabaseConfigured, supabase } from '@/lib/supabase';

const NOT_CONFIGURED =
  'Sign-in is not available in this build (auth service not configured). You can still use the app without an account.';

type AuthResult = { error: string | null };
type AuthResultWithUser = { error: string | null; isNewUser: boolean; userName: string | null };

type AuthState = {
  session: Session | null;
  user: User | null;
  loading: boolean;
  signOut: () => Promise<void>;
  signInWithIdToken: (provider: 'google' | 'apple', idToken: string, nonce?: string) => Promise<AuthResultWithUser>;
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
    supabase.auth.getSession().then(({ data: { session: s } }) => {
      setSession(s);
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
    });

    return () => subscription.unsubscribe();
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
