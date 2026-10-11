# Android push notifications (FCM)

Background alerts need Firebase Cloud Messaging. Socket alerts still work while the app is open.

You do **not** need a Google Play Developer account to test. A free Google account + Firebase project is enough. Sideload the APK as usual.

## 1. Create Firebase (once)

1. Open [Firebase Console](https://console.firebase.google.com/) → Add project.
2. Add an **Android** app with package name: `com.mederp.mederp_mobile`
3. Download `google-services.json`.
4. Copy it to:

```
apps/mobile/android/app/google-services.json
```

(See `google-services.json.example` for the expected location. The real file is gitignored.)

5. In Firebase → Project settings → **Service accounts** → Generate new private key.
6. On the EC2 server, put the whole JSON into `apps/web/.env` as one line (escape newlines in `private_key` as `\n`):

```env
FIREBASE_SERVICE_ACCOUNT_JSON={"type":"service_account","project_id":"...","private_key_id":"...","private_key":"-----BEGIN PRIVATE KEY-----\\n...\\n-----END PRIVATE KEY-----\\n","client_email":"...","client_id":"...","auth_uri":"https://accounts.google.com/o/oauth2/auth","token_uri":"https://oauth2.googleapis.com/token"}
```

7. Redeploy / recreate the web container so it picks up the env var. Run migrations so `DevicePushToken` exists.

## 2. Build and install the app

```bash
cd apps/mobile
flutter build apk --release
```

Install `build/app/outputs/flutter-apk/app-release.apk` on a phone that has Google Play services.

## 3. Test

1. Open the app, sign in, allow notifications.
2. Leave the app (home screen or swipe away).
3. Trigger a staff notification (e.g. book a visit / vitals ready).
4. You should get a system notification even with the app closed.

Without `google-services.json` or `FIREBASE_SERVICE_ACCOUNT_JSON`, the site and in-app socket alerts still work; only background FCM is skipped.

## iOS

The app registers an `IOS` FCM token and the server already sends an APNs alert through Firebase. Builds still open the site if Firebase is missing; background push is skipped until the files below exist.

Bundle id: `com.mederp.mederpMobile` (different from the Android package name).

1. Apple Developer → Identifiers → App ID `com.mederp.mederpMobile` → enable **Push Notifications**.
2. Apple Developer → Keys → create an **Apple Push Notifications service (APNs)** key. Download the `.p8` once, and note the Key ID and your Team ID.
3. Firebase → Project settings → add an **Apple** app with bundle id `com.mederp.mederpMobile`.
4. Download `GoogleService-Info.plist` and save it as:

```
apps/mobile/ios/Runner/GoogleService-Info.plist
```

(See `GoogleService-Info.plist.example`. The real file is gitignored. The Xcode build copies it into the app only when it is present.)

5. Firebase → Project settings → Cloud Messaging → Apple app configuration → upload the `.p8`, Key ID, and Team ID.
6. The same `FIREBASE_SERVICE_ACCOUNT_JSON` used for Android sends iOS messages. No extra server secret.
7. Build on a Mac with a real iPhone (the simulator does not receive APNs):

```bash
cd apps/mobile
flutter build ios
```

Debug builds use the development APNs environment. Release and profile builds use production, which is what TestFlight and the App Store require.
