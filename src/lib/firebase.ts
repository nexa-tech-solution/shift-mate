import { GoogleSignin } from '@react-native-google-signin/google-signin';
import { getApps, initializeApp } from 'firebase/app';
import * as FirebaseAuth from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import Storage from 'expo-sqlite/kv-store';
import { Platform } from 'react-native';

// written out in full: production builds only inline literal process.env.EXPO_PUBLIC_* reads, not reads through a variable
const webClientId = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID;
const iosClientId = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID;
const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
};

/** Accounts are optional: with no Firebase/Google keys the app stays fully local and hides sign-in. */
export const accountsEnabled =
  Platform.OS !== 'web' &&
  !!(firebaseConfig.apiKey && firebaseConfig.projectId && firebaseConfig.appId && webClientId) &&
  (Platform.OS !== 'ios' || !!iosClientId);

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
    webClientId, // needed for the idToken Firebase verifies
    iosClientId,
    scopes: ['email', 'profile'], // the calendar scope is asked for only when Google Calendar sync is turned on
  });
}
