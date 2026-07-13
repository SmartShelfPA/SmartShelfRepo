import { Redirect } from 'expo-router';

/** Legacy route — onboarding now starts at student sign up. */
export default function AccountSelectScreen() {
  return <Redirect href="/register" />;
}
