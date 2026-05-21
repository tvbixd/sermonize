import { Redirect } from 'expo-router';
import { useAuth } from '@/context/auth';

export default function Root() {
  const { session, loading } = useAuth();

  if (loading) return null;
  if (session) return <Redirect href="/folders" />;
  return <Redirect href="/sign-in" />;
}
