# How to Get Free Environment Variables for ReachInbox

Since you are operating completely free, this guide will walk you through exactly where and how to get free-tier services for every required environment variable. 

No credit card is required for any of these services if you select the free tiers.

---

## 1. PostgreSQL Database (`DATABASE_URL`)
**Provider:** [Neon.tech](https://neon.tech/) (Generous forever-free tier)

1. Go to [Neon.tech](https://neon.tech/) and sign up for a free account.
2. Click **Create a Project**. Name it `reachinbox-db`.
3. Select the region closest to you and click **Create Project**.
4. On the dashboard, you will see a connection string. 
5. Uncheck the "Pooled connection" checkbox if it's there (Prisma works best with direct connections by default unless configured otherwise).
6. Copy the connection string. It will look like this:
   `postgresql://username:password@ep-cool-snowflake-123.region.aws.neon.tech/neondb?sslmode=require`
7. Set this as your `DATABASE_URL`.

---

## 2. Redis Database (`REDIS_URL`)
**Provider:** [Upstash](https://upstash.com/) (Forever-free serverless Redis)

1. Go to [Upstash.com](https://upstash.com/) and sign in.
2. Go to the **Redis** section and click **Create Database**.
3. Name it `reachinbox-redis`.
4. Choose a region, select the **Free** plan, and click **Create**.
5. Once created, scroll down to the **Connect your application** section.
6. Select **Redis URI** (or copy the `rediss://...` URL).
7. Copy the URL. It will look like this: 
   `rediss://default:password123@us1-cool-redis-123.upstash.io:30000`
8. Set this as your `REDIS_URL`.

---

## 3. Elasticsearch (`ELASTICSEARCH_URL`) - *OPTIONAL*
**Note:** The app is designed to gracefully fallback to PostgreSQL search if this is left blank. Because free Elasticsearch hosts are rare and highly restricted, **I highly recommend leaving these blank** to save yourself the headache.

If you must have it:
1. Go to [Bonsai.io](https://bonsai.io/) and create an account.
2. Create a free cluster.
3. Grab the Elasticsearch URL and credentials provided and split them into `ELASTICSEARCH_URL`, `ELASTICSEARCH_USERNAME`, and `ELASTICSEARCH_PASSWORD`.

---

## 4. Session Secret (`SESSION_SECRET`)
This is just a long, random string used to encrypt user cookies.

1. You don't need a website for this.
2. Just type a very long, random string of letters and numbers (at least 32 characters).
3. Example: `dsf879234lkjsdf098234lkjsdf890234lksdjf`
4. Set this as your `SESSION_SECRET`.

---

## 5. Google OAuth (`GOOGLE_CLIENT_ID` & `GOOGLE_CLIENT_SECRET`)
**Provider:** [Google Cloud Console](https://console.cloud.google.com/) (Free)

1. Go to the [Google Cloud Console](https://console.cloud.google.com/).
2. Create a new project (name it `ReachInbox`).
3. In the left sidebar, go to **APIs & Services** > **OAuth consent screen**.
   - Choose **External** and click **Create**.
   - Fill in the required app name and support email (you can use your own email).
   - Click **Save and Continue** until finished (skip scopes and test users for now).
4. In the left sidebar, go to **Credentials**.
   - Click **+ CREATE CREDENTIALS** at the top.
   - Choose **OAuth client ID**.
   - Application type: **Web application**.
   - Under **Authorized redirect URIs**, click Add URI and paste:
     `https://reachinbox-api.onrender.com/auth/google/callback` 
     *(Replace `reachinbox-api.onrender.com` with your actual Render backend URL later).*
     *(For local dev, add `http://localhost:5000/auth/google/callback` too).*
5. Click **Create**.
6. A popup will show your **Client ID** and **Client Secret**. 
7. Set these as your `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`.

---

## 6. Slack OAuth (`SLACK_CLIENT_ID` & `SLACK_CLIENT_SECRET`)
**Provider:** [Slack API](https://api.slack.com/) (Free)

1. Go to [api.slack.com/apps](https://api.slack.com/apps) and sign in.
2. Click **Create New App** > **From scratch**.
3. Name it `ReachInbox` and select any Slack workspace you are a part of.
4. Once created, scroll down on the **Basic Information** page to **App Credentials**.
5. Copy the **Client ID** and **Client Secret**.
6. Set these as your `SLACK_CLIENT_ID` and `SLACK_CLIENT_SECRET`.
7. Next, go to **OAuth & Permissions** in the left sidebar.
8. Scroll down to **Redirect URLs**.
9. Click **Add New Redirect URL** and paste:
   `https://reachinbox-api.onrender.com/api/slack/callback`
   *(Replace with your actual Render backend URL later, and add localhost for local dev).*
10. Click **Save URLs**.

---

## 7. Ethereal SMTP (`ETHEREAL_...`)
**Provider:** [Ethereal.email](https://ethereal.email/) (Free fake SMTP service for testing)

1. Go to [ethereal.email](https://ethereal.email/).
2. Click **Create Ethereal Account**.
3. It will instantly generate an account and display your credentials on the screen.
4. Copy the following values into your environment variables:
   - `ETHEREAL_HOST` -> (usually `smtp.ethereal.email`)
   - `ETHEREAL_PORT` -> (usually `587`)
   - `ETHEREAL_USER` -> (the generated email address)
   - `ETHEREAL_PASSWORD` -> (the generated password)

---

## 8. App Configuration & Demo Admin

These are settings you configure yourself; no websites required.

1. **`NODE_ENV`**: Set to `production` (on Render/Vercel) or `development` (locally).
2. **`FRONTEND_URL`**: Set to your Vercel URL (e.g., `https://my-reachinbox.vercel.app`) or `http://localhost:5173` locally.
3. **`WORKER_CONCURRENCY`**: Set to `5`.
4. **`MIN_EMAIL_DELAY_MS`**: Set to `2000`.
5. **`MAX_EMAILS_PER_HOUR`**: Set to `200`.
6. **`DEMO_ADMIN_EMAIL`**: Set to any email you want to use to log into the BullMQ Admin Dashboard (e.g., `admin@myapp.com`).
7. **`DEMO_ADMIN_PASSWORD`**: Set a secure password you want to use for the admin dashboard.

---

## Quick Summary Checklist

When deploying to **Render**, you will paste these exact keys into the Environment Variables section:

```
NODE_ENV=production
DATABASE_URL=postgresql://... (from Neon)
REDIS_URL=rediss://... (from Upstash)
SESSION_SECRET=your-random-string
FRONTEND_URL=https://your-vercel-app.vercel.app
GOOGLE_CLIENT_ID=... (from Google)
GOOGLE_CLIENT_SECRET=... (from Google)
SLACK_CLIENT_ID=... (from Slack)
SLACK_CLIENT_SECRET=... (from Slack)
ETHEREAL_HOST=smtp.ethereal.email
ETHEREAL_PORT=587
ETHEREAL_USER=... (from Ethereal)
ETHEREAL_PASSWORD=... (from Ethereal)
DEMO_ADMIN_EMAIL=admin@example.com
DEMO_ADMIN_PASSWORD=my-secure-password
WORKER_CONCURRENCY=5
MIN_EMAIL_DELAY_MS=2000
MAX_EMAILS_PER_HOUR=200
```
