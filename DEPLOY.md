# Deploy ChristianGetsFit on Render

## 1. Connect GitHub

1. Go to [render.com](https://render.com) and sign in (or create an account).
2. **Dashboard** → **New +** → **Blueprint**.
3. Connect your GitHub account if needed, then select the **ChristianGetsFit** repo (or paste `https://github.com/SpaceraCF/ChristianGetsFit`).
4. Render will read `render.yaml` and create:
   - A **PostgreSQL** database (`christian-gets-fit-db`)
   - A **Web Service** (`christian-gets-fit`) with root directory `app`.

5. Click **Apply** to create the resources.

## 2. Google OAuth setup

1. Go to [Google Cloud Console](https://console.cloud.google.com/).
2. Create a project (or use existing).
3. **APIs & Services** → **Credentials** → **Create Credentials** → **OAuth 2.0 Client ID**.
4. Application type: **Web application**.
5. Authorized redirect URIs: `https://cgf.one22.me/api/auth/google/callback`
   (and `http://localhost:3000/api/auth/google/callback` for local dev).
6. Copy the **Client ID** and **Client Secret**.

## 3. Environment variables

In the **Web Service** → **Environment** tab, add (or edit):

| Key | Value |
|-----|--------|
| `APP_URL` | `https://cgf.one22.me` |
| `NEXTAUTH_SECRET` | Use the one Render generated, or set your own long random string |
| `CRON_SECRET` | Use the one Render generated, or set your own (for cron endpoints) |
| `GOOGLE_CLIENT_ID` | From Google Cloud Console |
| `GOOGLE_CLIENT_SECRET` | From Google Cloud Console |

Optional (add when you're ready):

- `SENDGRID_API_KEY`, `SENDGRID_FROM_EMAIL` -- notification emails
- `TELEGRAM_BOT_TOKEN` -- Telegram bot
- `CALCOM_API_KEY`, `CALCOM_USERNAME`, `CALCOM_EVENT_TYPE_SLUG`, `CALCOM_WEBHOOK_SECRET` -- Cal.com
- `FITBIT_CLIENT_ID`, `FITBIT_CLIENT_SECRET` -- Fitbit

`DATABASE_URL` is set automatically from the linked PostgreSQL database.

## 4. First deploy and seed

1. Let the first deploy finish (Build + Start).
2. Open the **Shell** tab for the Web Service (or use **Dashboard** → your service → **Shell**).
3. Run:
   ```bash
   cd app && npx prisma db push && npx tsx prisma/seed.ts
   ```
4. Open your app URL. Sign in with Google.

## 5. Cron jobs (optional)

Use [Render Cron Jobs](https://render.com/docs/cron-jobs) or an external scheduler (e.g. cron-job.org) to call:

- **Daily:** `GET https://cgf.one22.me/api/cron/daily`  
  Header: `Authorization: Bearer YOUR_CRON_SECRET`
- **Weekly:** `GET https://cgf.one22.me/api/cron/weekly`
- **Rest-day:** `GET https://cgf.one22.me/api/cron/rest-day`
- **Schedule Cal.com (midnight Sunday night):** `GET https://cgf.one22.me/api/cron/schedule-calcom`

See **README.md** for suggested times (e.g. Monday 00:00 AEDT for schedule-calcom).

## 6. Cal.com webhook (optional)

In Cal.com: **Settings → Developer → Webhooks** → Subscriber URL:  
`https://cgf.one22.me/api/webhooks/calcom`  
Trigger: **Booking Cancelled**. Set the same secret as `CALCOM_WEBHOOK_SECRET` in Render env.

## 7. Telegram webhook

After setting `TELEGRAM_BOT_TOKEN`, set the Telegram webhook:

```text
https://api.telegram.org/bot<YOUR_BOT_TOKEN>/setWebhook?url=https://cgf.one22.me/api/telegram/webhook
```

Then in the app: Settings → Link Telegram, and in Telegram send `/link YOUR_CODE`.
