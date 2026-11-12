import { GoogleSignin, isSuccessResponse } from '@react-native-google-signin/google-signin';
import {
  deleteUser,
  GoogleAuthProvider,
  onAuthStateChanged,
  reauthenticateWithCredential,
  signInWithCredential,
  signOut as firebaseSignOut,
  type User,
} from 'firebase/auth';
import { deleteDoc, doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore';
import { Alert, Platform } from 'react-native';
import { create } from 'zustand';
import type { DataState } from '@/store/useStore';
import { useStore } from '@/store/useStore';
import type { Settings } from '@/store/types';
import { accountsEnabled, auth, db } from './firebase';

export const useAccount = create<{ user: User | null; ready: boolean }>(() => ({ user: null, ready: !accountsEnabled }));
if (auth) onAuthStateChanged(auth, (user) => useAccount.setState({ user, ready: true }));

/** What goes to the cloud: the schedule and preferences, not links to this device's calendars or a running clock. */
type Backup = Pick<DataState, 'workplaces' | 'templates' | 'shifts' | 'rotations' | 'paychecks'> & {
  settings: Omit<Settings, 'calendarSync' | 'googleCalendar'>;
};

const userRef = (uid: string) => doc(db!, 'users', uid);
// one JSON string keeps Firestore from rejecting undefined fields; shortcut: 1 MiB doc limit ≈ 5k shifts, split per collection if users get near it
const backupRef = (uid: string) => doc(db!, 'users', uid, 'backup', 'state');

const snapshot = ({ settings, workplaces, templates, shifts, rotations, paychecks }: DataState): Backup => {
  const { calendarSync: _c, googleCalendar: _g, ...rest } = settings;
  return { settings: rest, workplaces, templates, shifts, rotations, paychecks };
};

// set while a sign-in decides which side wins, so the auto-backup can't overwrite the cloud copy first
let reconciling = false;

async function upload(uid: string) {
  await setDoc(backupRef(uid), { data: JSON.stringify(snapshot(useStore.getState())), updatedAt: serverTimestamp(), platform: Platform.OS });
}

function restore(b: Backup) {
  useStore.setState((s) => ({
    ...b,
    settings: { ...s.settings, ...b.settings, calendarSync: s.settings.calendarSync, googleCalendar: s.settings.googleCalendar },
    clock: null,
  }));
}

async function reconcile(uid: string) {
  const snap = await getDoc(backupRef(uid));
  const local = useStore.getState();
  if (!snap.exists()) return upload(uid);
  const cloud = JSON.parse(snap.get('data')) as Backup;
  if (!local.shifts.length && !local.rotations.length) return restore(cloud);
  const when = snap.get('updatedAt')?.toDate?.().toLocaleDateString() ?? 'earlier';
  // both sides have a schedule: never merge silently, let the person pick
  await new Promise<void>((resolve) =>
    Alert.alert('Backup found', `Your Google account has a Shiftly backup from ${when}. Use it, or keep the shifts on this phone?`, [
      { text: 'Keep this phone', onPress: () => upload(uid).catch(() => {}).finally(resolve) },
      { text: 'Use backup', style: 'destructive', onPress: () => (restore(cloud), resolve()) },
    ], { cancelable: false }),
  );
}

async function googleIdToken(interactive: boolean): Promise<string | null> {
  if (Platform.OS === 'android') await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
  if (!interactive) {
    const silent = await GoogleSignin.signInSilently();
    if (silent.type === 'success' && silent.data.idToken) return silent.data.idToken;
  }
  const res = await GoogleSignin.signIn();
  return isSuccessResponse(res) ? res.data.idToken : null;
}

/** Google sign-in into Firebase, then match up the cloud backup. False when the person cancels. */
export async function signInWithGoogle(): Promise<boolean> {
  if (!auth || !db) throw new Error('Sign-in is not set up in this build.');
  reconciling = true;
  try {
    const idToken = await googleIdToken(true);
    if (!idToken) return false;
    const { user } = await signInWithCredential(auth, GoogleAuthProvider.credential(idToken));
    await setDoc(userRef(user.uid), {
      name: user.displayName,
      email: user.email,
      photo: user.photoURL,
      createdAt: user.metadata.creationTime ?? null,
      lastSignInAt: serverTimestamp(),
    }, { merge: true });
    await reconcile(user.uid);
    return true;
  } finally {
    reconciling = false;
  }
}

let timer: ReturnType<typeof setTimeout> | undefined;
/** Debounced upload after local edits; the app keeps working offline and the next edit retries. */
export function scheduleBackup() {
  const uid = auth?.currentUser?.uid;
  if (!uid || reconciling) return;
  clearTimeout(timer);
  timer = setTimeout(() => upload(uid).catch(() => {}), 3000);
}

/** Calendar id the account used before, so reconnecting reuses the same "Shiftly" calendar. */
export async function savedGoogleCalendarId(): Promise<string | undefined> {
  const uid = auth?.currentUser?.uid;
  if (!uid) return undefined;
  return (await getDoc(userRef(uid))).get('googleCalendarId') ?? undefined;
}

export async function saveGoogleCalendarId(calendarId: string | null) {
  const uid = auth?.currentUser?.uid;
  if (uid) await setDoc(userRef(uid), { googleCalendarId: calendarId }, { merge: true });
}

/** Local data stays on the phone; only the cloud link ends. */
export async function signOut() {
  const uid = auth?.currentUser?.uid;
  clearTimeout(timer);
  if (uid) await upload(uid).catch(() => {});
  useStore.getState().updateSettings({ googleCalendar: undefined });
  await GoogleSignin.signOut().catch(() => {});
  if (auth) await firebaseSignOut(auth);
}

/** Required by the App Store for apps with accounts: removes the backup, the profile and the Firebase user. */
export async function deleteAccount(): Promise<boolean> {
  const user = auth?.currentUser;
  if (!user) return false;
  // Firebase only deletes users who signed in recently
  const idToken = await googleIdToken(false);
  if (!idToken) return false;
  await reauthenticateWithCredential(user, GoogleAuthProvider.credential(idToken));
  clearTimeout(timer);
  await deleteDoc(backupRef(user.uid));
  await deleteDoc(userRef(user.uid));
  useStore.getState().updateSettings({ googleCalendar: undefined });
  await deleteUser(user);
  await GoogleSignin.revokeAccess().catch(() => {});
  await GoogleSignin.signOut().catch(() => {});
  return true;
}
