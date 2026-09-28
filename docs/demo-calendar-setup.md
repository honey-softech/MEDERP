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

Put the client id and secret in `apps/web/.env`:

```
GOOGLE_CLIENT_ID=""
GOOGLE_CLIENT_SECRET=""
GOOGLE_REDIRECT_URI="http://localhost:3000/api/platform/demos/google/callback"
TOKEN_ENCRYPTION_KEY=""
```

`TOKEN_ENCRYPTION_KEY` is any long random string. The refresh token is encrypted with it before it is stored. Do not commit the key.

Sign in as a software admin, open **Demo bookings → Settings**, and choose **Connect Google Calendar**. Use the sales account whose calendar should block busy time and receive the events.

## Resend

1. Create an account at [resend.com](https://resend.com/).
2. Verify the sending domain (for example `mederp.co.in`) and add the DNS records Resend shows.
3. Create an API key.

```
RESEND_API_KEY=""
DEMO_FROM_EMAIL="MedERP <demos@mederp.co.in>"
DEMO_NOTIFY_EMAIL="sales@mederp.co.in"
```

`DEMO_FROM_EMAIL` must use the verified domain. `DEMO_NOTIFY_EMAIL` is the default sales inbox; the settings page can override it per deployment.

If `RESEND_API_KEY` is empty, booking still creates the calendar event and the email text is printed to the server log.

## Product defaults

Duration 30 minutes, buffer 15 minutes, timezone `Asia/Kolkata`, bookable window 14 days, hours 10:00–18:00. Change these under `/platform/demos/settings`.
