# ChristianGetsFit

Fitness accountability app: 5 workouts planned per week (min 3 to hit goal), 30 min weight training (Smith machine + dumbbells). Workouts are scheduled in Cal.com 11am–4pm AEDT. Nagging, gamification, and progress tracking.

## Requirements

- Node.js 20+
- PostgreSQL

## Stack

- **App**: Next.js 16 (App Router), TypeScript, Tailwind CSS, Prisma, PostgreSQL
- **Auth**: Magic link (SendGrid)
- **Integrations**: Telegram, Cal.com, Fitbit, SendGrid

## Setup

1. **Clone and install**

   ```bash
   cd app && npm install
   ```

2. **Environment**

   Copy `.env.example` to `.env` and set:

   - `DATABASE_URL` – PostgreSQL connection string
   - `NEXTAUTH_SECRET` – random secret for sessions
   - `SENDGRID_API_KEY` (optional) – for magic link emails
   - `SENDGRID_FROM_EMAIL` – verified sender
   - `TELEGRAM_BOT_TOKEN` (optional) – for Telegram bot
   - `CALCOM_API_KEY` (optional) – for calendar and scheduling
   - `CALCOM_USERNAME` – your Cal.com username (for scheduling 5 slots/week)
   - `CALCOM_EVENT_TYPE_SLUG` (optional) – event type slug, default `workout`
   - `CALCOM_WEBHOOK_SECRET` (optional) – same secret as in Cal.com webhook, to verify cancellation webhooks
   - `FITBIT_CLIENT_ID` / `FITBIT_CLIENT_SECRET` (optional) – for Fitbit
   - `APP_URL` – e.g. `http://localhost:3000`
   - `CRON_SECRET` – secret for cron endpoints

3. **Database**

   ```bash
   npx prisma db push
   npm run db:seed
   ```

4. **Run**

   ```bash
   npm run dev
   ```

   Open [http://localhost:3000](http://localhost:3000). Log in with a magic link (or use the link printed in the terminal if SendGrid is not configured).

## Deploy (Render)

1. Create a **PostgreSQL** database and a **Web Service** on Render.
2. Root directory: `app`.
3. Build: `npm ci && npx prisma generate && npm run build`
4. Start: `npx prisma db push && npm run start`
5. Set env vars (including `DATABASE_URL` from the DB, `APP_URL` = your service URL, `NEXTAUTH_SECRET`, `CRON_SECRET`).
6. After first deploy, run seed (one-off): `npx prisma db push --accept-data-loss` and seed via a script or Render shell.

### Cron jobs (Render Cron or external)

- **Daily (e.g. 8:00 UTC)**  
  `GET https://your-app.onrender.com/api/cron/daily`  
  Header: `Authorization: Bearer YOUR_CRON_SECRET`

- **Weekly (e.g. Sunday 20:00 UTC)**  
  `GET https://your-app.onrender.com/api/cron/weekly`  
  Same header.

- **Rest-day (e.g. 7:00 UTC)**  
  `GET https://your-app.onrender.com/api/cron/rest-day`  
  Same header. Requires Fitbit linked.

- **Schedule Cal.com – midnight Sunday night (start of Monday) every week**  
  e.g. Monday 00:00 AEDT = Sunday 13:00 UTC  
  `GET https://your-app.onrender.com/api/cron/schedule-calcom`  
  Same header. Creates 5 workout slots (Mon–Fri 12:00 AEDT) in Cal.com.

### Cal.com cancellation webhook

If you cancel a workout meeting in Cal.com, the app can send you a Telegram reminder to rebook:

1. In Cal.com go to **Settings → Developer → Webhooks**.
2. Add a webhook: **Subscriber URL** = `https://your-app.com/api/webhooks/calcom`, **Event trigger** = **Booking Cancelled**.
3. (Optional) Set a **Secret** in Cal.com and the same value as `CALCOM_WEBHOOK_SECRET` in your app env.

The reminder is sent only for the workout event type and only to users who have linked Telegram (matched by attendee email).

## Telegram

1. Create a bot with [@BotFather](https://t.me/BotFather), set `TELEGRAM_BOT_TOKEN`.
2. Set webhook: `https://api.telegram.org/bot<TOKEN>/setWebhook?url=https://your-app.com/api/telegram/webhook`
3. In the app: Settings → Link Telegram, then in Telegram send `/link YOUR_CODE`.

Commands: `/status`, `/done`, `/weight 81.5`, `/punishment`, `/skip`.

## Features

- Magic link login, dashboard with weight goal and weekly workout count
- Workouts A/B/C (Push, Pull, Legs) + express (3 exercises)
- Warm-up, recommended weights, difficulty/enjoyment feedback, exercise blacklist
- Weight and waist logging, analytics charts
- Injury tracking (workouts auto-substitute)
- Fitbit: link account, workout verification, rest-day suggestions
- PWA manifest + service worker; screen wake lock during workouts
- 5 workouts planned per week in Cal.com (11am–4pm AEDT), calendar updated at midnight Sunday night; min 3 to hit goal (alcohol ban if fewer). If you cancel a workout meeting, you get a Telegram reminder to rebook.
- Gamification: XP, levels, achievements
