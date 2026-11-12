import { GoogleSignin } from '@react-native-google-signin/google-signin';
import { getApps, initializeApp } from 'firebase/app';
import * as FirebaseAuth from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import Storage from 'expo-sqlite/kv-store';
import { Platform } from 'react-native';

const env = process.env;
const firebaseConfig = {
  apiKey: env.EXPO_PUBLIC_FIREBASE_API_KEY,
  authDomain: env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
  appId: env.EXPO_PUBLIC_FIREBASE_APP_ID,
};

/** Accounts are optional: with no Firebase/Google keys the app stays fully local and hides sign-in. */
export const accountsEnabled =
  Platform.OS !== 'web' &&
  !!(firebaseConfig.apiKey && firebaseConfig.projectId && firebaseConfig.appId && env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID) &&
  (Platform.OS !== 'ios' || !!env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID);

export const CALENDAR_SCOPE = 'https://www.googleapis.com/auth/calendar.app.created';

// the typings describe the web build; the React Native build Metro bundles does export this
const { getReactNativePersistence, initializeAuth } = FirebaseAuth as typeof FirebaseAuth & {
  getReactNativePersistence: (storage: unknown) => FirebaseAuth.Persistence;
};

const app = accountsEnabled ? (getApps()[0] ?? initializeApp(firebaseConfig)) : undefined;
// expo-sqlite's kv-store has the AsyncStorage API, so the session survives restarts without another dependency
export const auth = app ? initializeAuth(app, { persistence: getReactNativePersistence(Storage) }) : undefined;
export const db = app ? getFirestore(app) : undefined;

if (accountsEnabled) {
  GoogleSignin.configure({
    webClientId: env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID, // needed for the idToken Firebase verifies
    iosClientId: env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID,
    scopes: ['email', 'profile'], // the calendar scope is asked for only when Google Calendar sync is turned on
  });
}
