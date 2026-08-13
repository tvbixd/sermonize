import { Redirect } from 'expo-router';
import { useEffect, useState } from 'react';
import { useAuth } from '@/context/auth';
import { getOnboarded } from '@/storage/keys';

export default function Root() {
  const { session, loading } = useAuth();
  const [onboarded, setOnboarded] = useState<boolean | null>(null);

  useEffect(() => {
    getOnboarded().then(setOnboarded).catch(() => setOnboarded(false));
  }, []);

  if (loading || onboarded === null) return null;
  // A signed-in user OR anyone who finished onboarding (incl. guests) goes
  // straight to the app; only a truly fresh install sees onboarding.
  if (session || onboarded) return <Redirect href="/folders" />;
  return <Redirect href="/onboarding" />;
}
