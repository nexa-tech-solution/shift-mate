# ShiftMate

Shift calendar and paycheck estimator for hourly workers. Built with Expo SDK 58, React Native, TypeScript and Expo Router. It works offline and needs no account; data stays on the device unless the user signs in with Google (optional) for cloud backup and Google Calendar sync.

## Features

| Area | What it does |
|---|---|
| Onboarding | Workplace, hourly rate, currency, pay period, preset shift templates, optional reminders |
| Today | Current or next shift as a "ticket" with a live countdown or progress, pay-period stats, the coming week |
| Calendar | Month grid with color bars, 24h week timeline (overnight shifts split at midnight), day agenda, swipe between months/weeks, long-press a day to add |
| Shifts | Two-tap quick add from templates; full editor with overnight shifts, unpaid breaks, logged actual times, notes, colors, overlap warning |
| Rotations | Weekly pattern (free) or any 1–28 day cycle (Pro), optional end date, per-day exceptions (edit or remove a single day) |
| Pay | Scheduled vs worked, configurable periods (weekly, biweekly, semimonthly, monthly with any start day), comparison with the previous period, per-shift estimates |
| Pro ($1.99/mo, $14.99/yr) | Multiple workplaces, custom rotations, user-defined overtime/night/weekend rules, per-shift rate, paycheck comparison, PDF & CSV period reports |
| Business (planned $9.99/mo) | Shown on the paywall as *Coming soon*: teams of up to 10, shared live schedule, shift assignment, time-off. Needs a backend; not sold yet. Set `EXPO_PUBLIC_BUSINESS_CONTACT` to enable a waitlist e-mail button |
| Account (optional) | Sign in with Google (Firebase Auth). The schedule is backed up to Firestore and restored on a new phone; if both phone and cloud have shifts the user picks one. Sign out keeps local data; delete account removes the backup and the Firebase user |
| Google Calendar | After sign-in, shifts are written to a dedicated "Shiftly" calendar via the Calendar API (`calendar.app.created` scope). Independent of the device-calendar sync |
| Settings | Currency, 12/24h, week start, theme, haptics, reminder lead time, JSON backup, CSV export, erase data, subscription management |

## Architecture

```
src/
  app/            Expo Router screens: (tabs) native tab bar, modals, form sheet
  components/     Design system (ui.tsx), shift ticket and rows, native pickers, icons
  lib/            Pure logic: time.ts, schedule.ts, pay.ts (unit tested), plus notifications, purchases, export
  store/          Typed models, zustand store persisted to SQLite (expo-sqlite/kv-store), selectors
  theme/          Tokens: paper/ink neutrals, ember accent, 7 shift colors, light/dark
```

- **Time model.** A shift is a wall-clock `date` + `start`/`end` (`HH:mm`) plus the IANA `tz` it was created in. If `end <= start`, the shift ends the next day. Durations use real instants, so a night shift over a DST change is 7h or 9h, not 8h.
- **Rotations** are not copied into shifts; they are expanded when viewed. Editing one day turns it into a standalone shift and adds that date to the rotation's `exceptions`.
- **Pay** is an estimate: paid hours × rate. Pro adds rules the user defines: daily or weekly overtime (no double counting), a night premium per hour, and a weekend multiplier. Overtime and weekend multipliers don't stack; the higher one applies. No country's labor law is hard-coded.
- **Worked hours** come from logged actual times, or from the schedule once a shift has ended.
- **Reminders** use local notifications. They are rescheduled (next 30 days, at most 48 pending) whenever shifts, rotations, templates or reminder settings change.
- **Accounts** are off unless the `EXPO_PUBLIC_FIREBASE_*` and `EXPO_PUBLIC_GOOGLE_*` keys are set (`src/lib/firebase.ts`). The backup is one JSON string at `users/{uid}/backup/state`; uploads are debounced 3s after edits, last write wins across devices. Rules: `firestore.rules`. `app.config.js` adds the Google Sign-In plugin only when the iOS client ID is set.
- **Google Calendar sync** diffs instead of rewriting: each shift has a stable event id (hex of its id), and a crc32 fingerprint in `extendedProperties` skips unchanged events (`src/lib/googleEvents.ts`, unit tested). Window: 30 days back to 120 ahead. Turning it off deletes the Shiftly calendar.
- **Purchases** go through RevenueCat (`react-native-purchases`) with the `premium` entitlement. Prices come from the store. Pro is granted only when the store reports the entitlement as active. Purchases are disabled in Expo Go, where RevenueCat's preview mode would fake them, and when no API key is set.

## Setup

```bash
npm install
cp .env.example .env          # add RevenueCat keys (optional for local dev)
```

### Run (development build; Expo Go is not supported)

```bash
npm run ios                   # = npx expo run:ios  (needs Xcode)
npm run android               # = npx expo run:android (needs Android SDK + emulator/device)
```

> **exFAT/external drives:** macOS writes `._*` AppleDouble files there. Metro, Jest and ESLint ignore them, but Xcode/Gradle builds can fail on them. Build from an APFS disk, or run `dot_clean -m .` first.

### Cloud builds (EAS)

```bash
npx eas-cli@latest build --profile development --platform ios     # dev client for devices
npx eas-cli@latest build --profile development-simulator --platform ios
npx eas-cli@latest build --profile production --platform all
npx eas-cli@latest submit --platform ios
```

Set `EXPO_PUBLIC_RC_IOS_KEY` / `EXPO_PUBLIC_RC_ANDROID_KEY` as EAS environment variables for builds.

### Quality checks

```bash
npm test          # scheduling, DST, rotations, pay periods, overtime/night/weekend, CSV/PDF
npm run typecheck
npm run lint
npx expo-doctor
```

## RevenueCat / store setup

1. In App Store Connect and Play Console, create auto-renewing subscriptions: monthly at $1.99 and yearly at $14.99, in one subscription group.
2. In RevenueCat, create the entitlement `premium`, attach both products, and add them to the **current** offering as `$rc_monthly` and `$rc_annual`.
3. Put the public SDK keys in `.env`.
4. Test with sandbox / license-tester accounts. The paywall shows the localized store price, and supports restore and manage subscription.

## Android signing key

Release keystore: `shiftly-release.jks` in the project root. It is gitignored, so back it up yourself (password manager or a private drive). Losing it means you cannot ship updates signed with it.

| | |
|---|---|
| Alias | `admin` |
| Store / key password | `Admin1234!` |
| SHA-1 | `67:09:CC:87:97:57:20:7A:13:56:E8:04:30:96:C8:7C:12:01:19:6F` |
| SHA-256 | `A8:9E:AF:9B:29:FB:7E:0E:72:98:41:DB:5F:0C:F1:E1:35:3A:EC:1F:FC:3D:78:DB:D9:4B:F8:27:E3:87:DA:53` |

Other SHA-1s to add in Firebase › Project settings › Android app (`com.shiftmate.app`):

- Expo/RN template debug keystore (`npx expo run:android`): `5E:8F:16:06:2E:A3:CD:2C:4A:0D:54:78:76:BA:A6:F3:8C:AB:F6:25`
- Local `~/.android/debug.keystore`: `DD:8B:C6:BB:CB:AD:E0:CF:D3:8F:14:A1:57:24:ED:09:54:F0:21:7A`
- Google Play app signing key: Play Console › App integrity

To have EAS sign with this keystore: `npx eas-cli@latest credentials -p android` › upload keystore.

## Not in v1

- Importing a JSON backup (export exists)
- Home-screen widgets and Live Activities (planned as Expo native modules)
- Cloud sync and accounts
- A clock-in before midnight on the day before a shift's scheduled date is not modeled
