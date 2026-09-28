# Demo calendar setup

Public demo booking lives at `/demo`. A platform admin connects one Google Calendar, prospects pick a free slot, and Resend emails both sides an ICS invite.

## Google Cloud

1. Open [Google Cloud Console](https://console.cloud.google.com/) and create or select a project.
2. Enable **Google Calendar API** (APIs & Services → Library).
3. Configure the OAuth consent screen (External is fine for testing; add the sales Google account as a test user while the app is in Testing).
4. Create an OAuth client ID of type **Web application**.
5. Authorized redirect URIs:
   - Local: `http://localhost:3000/api/platform/demos/google/callback`
   - Production: `https://mederp.co.in/api/platform/demos/google/callback`
6. Scopes used by the app (requested at connect time, not typed into the console):
   - `https://www.googleapis.com/auth/calendar.events`
   - `https://www.googleapis.com/auth/calendar.readonly`
   - `https://www.googleapis.com/auth/userinfo.email`

Put the client id and secret in `apps/web/.env` (**no spaces around `=`**):

```
GOOGLE_CLIENT_ID="...."
GOOGLE_CLIENT_SECRET="...."
GOOGLE_REDIRECT_URI="https://mederp.co.in/api/platform/demos/google/callback"
TOKEN_ENCRYPTION_KEY="...."
NEXT_PUBLIC_API_URL="https://mederp.co.in"
```

On production, `GOOGLE_REDIRECT_URI` and `NEXT_PUBLIC_API_URL` must be the public HTTPS site. The app **never** uses localhost for Google OAuth. Spaces around `=` (e.g. `GOOGLE_REDIRECT_URI = "..."`) prevent the variable from loading.

Sign in as a software admin, open **Demo bookings → Settings**, and choose **Connect Google Calendar**. Use the sales account whose calendar should block busy time and receive the events.

## Email (optional — Resend)

By default MedERP does **not** send its own emails. Google Calendar emails the prospect the invite and Meet link.

Only if you later want a separate MedERP confirmation email:

1. Verify a domain in Resend (required by Resend — cannot be skipped for real recipients).
2. Set:

```
DEMO_EMAIL_ENABLED="1"
RESEND_API_KEY="re_...."
DEMO_FROM_EMAIL="MedERP <demos@your-verified-domain.com>"
DEMO_NOTIFY_EMAIL="hello@honeysoftech.com"
```

Until then, leave `DEMO_EMAIL_ENABLED` unset.

## Product defaults

Duration 30 minutes, buffer 15 minutes, timezone `Asia/Kolkata`, bookable window 14 days, hours 10:00–18:00. Change these under `/platform/demos/settings`.
