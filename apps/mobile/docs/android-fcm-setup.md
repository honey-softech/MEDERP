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

Deferred. Same Flutter packages; needs Apple Developer + APNs key in Firebase later.
