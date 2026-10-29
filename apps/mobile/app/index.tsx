import { Redirect } from 'expo-router';
import { useAuth } from '../lib/auth';

/** Entry point: welcome when signed out, home when signed in. */
export default function Index() {
  const { status } = useAuth();
  return <Redirect href={status === 'signedIn' ? '/home' : '/welcome'} />;
}
