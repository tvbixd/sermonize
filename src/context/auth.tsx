import type { Session, User } from '@supabase/supabase-js';
import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

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
  updateProfile: (displayName: string) => Promise<AuthResult>;
};

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
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

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  const signInWithIdToken = async (provider: 'google' | 'apple', idToken: string, nonce?: string): Promise<AuthResultWithUser> => {
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
    const { error } = await supabase.auth.signInWithOtp({ email });
    return { error: error?.message ?? null };
  };

  const verifyOtp = async (email: string, token: string): Promise<AuthResultWithUser> => {
    const { data, error } = await supabase.auth.verifyOtp({ email, token, type: 'email' });
    if (error) return { error: error.message, isNewUser: false, userName: null };
    const userName = data.user?.user_metadata?.display_name ?? null;
    return { error: null, isNewUser: !userName, userName };
  };

  const updateProfile = async (displayName: string): Promise<AuthResult> => {
    const { error } = await supabase.auth.updateUser({ data: { display_name: displayName } });
    return { error: error?.message ?? null };
  };

  return (
    <AuthContext.Provider
      value={{
        session,
        user: session?.user ?? null,
        loading,
        signOut,
        signInWithIdToken,
        sendOtp,
        verifyOtp,
        updateProfile,
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
