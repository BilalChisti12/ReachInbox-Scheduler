# ReachInbox Deployment Guide (Vercel + Render)

This application is designed to be deployed using a fully managed Serverless/PaaS architecture without any Docker dependency.

## Architecture

- **Frontend**: Deployed to Vercel (React/Vite).
- **Backend API**: Deployed to Render as a Node.js Web Service.
- **Backend Worker**: Deployed to Render as a Node.js Background Worker.
- **Database**: External PostgreSQL provider (e.g., Supabase, Neon, Render Postgres).
- **Redis**: External Redis provider (e.g., Upstash, Redis Cloud).
- **Elasticsearch**: External Elasticsearch provider (e.g., Bonsai, Elastic Cloud). *Note: Search falls back to PostgreSQL if Elasticsearch is omitted or goes offline.*

---

## 1. Prepare External Services

Before deploying the application code, provision the necessary managed databases:

1. **PostgreSQL**: Create a database. Note the connection string (e.g., `postgresql://...`).
2. **Redis**: Create a Redis instance. Note the connection URL (e.g., `redis://...` or `rediss://...`).
3. **Elasticsearch** (Optional): Create a cluster. Note the URL, username, and password.

---

## 2. Deploy the Backend (Render)

We provide a `render.yaml` file that acts as Infrastructure as Code. It completely automates the creation of both the API and the Worker on Render.

1. Go to your [Render Dashboard](https://dashboard.render.com/).
2. Click **New** -> **Blueprints**.
3. Connect your GitHub repository.
4. Render will detect the `render.yaml` file and prompt you to set the required environment variables.
5. Fill in the required environment variables:
   - `DATABASE_URL`: Your PostgreSQL connection string.
   - `REDIS_URL`: Your Redis connection string.
   - `ELASTICSEARCH_URL`: Your Elasticsearch connection string (leave blank to skip).
   - `FRONTEND_URL`: The URL where your Vercel frontend will live (e.g., `https://your-frontend.vercel.app`).
   - `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET`: Your Google OAuth credentials.
   - `SLACK_CLIENT_ID` / `SLACK_CLIENT_SECRET`: Your Slack OAuth credentials.
   - `ETHEREAL_...`: Ethereal SMTP credentials for testing.
6. Click **Apply**.
7. Render will automatically build and deploy two services:
   - `reachinbox-api`: The Express server.
   - `reachinbox-worker`: The BullMQ background processor.

> **Note**: Both services will automatically run database migrations on startup.

---

## 3. Deploy the Frontend (Vercel)

1. Go to your [Vercel Dashboard](https://vercel.com/dashboard).
2. Click **Add New...** -> **Project**.
3. Import your GitHub repository.
4. Vercel will automatically detect the Vite React project in the `frontend` directory.
5. Before clicking "Deploy", expand the **Environment Variables** section.
6. Add the following variable:
   - Name: `VITE_API_URL`
   - Value: The URL of your deployed Render Web Service (e.g., `https://reachinbox-api.onrender.com`).
7. Click **Deploy**.

---

## 4. Final Configuration

1. **OAuth Callbacks**: Ensure that your Google and Slack OAuth apps are configured with the correct callback URLs pointing to your Render backend URL (e.g., `https://reachinbox-api.onrender.com/auth/google/callback`).
2. **CORS**: Ensure the `FRONTEND_URL` variable in Render exactly matches your deployed Vercel domain so CORS requests succeed.

---

## Local Development (No Docker Required)

You do not need Docker to develop locally. 

1. Ensure you have Node.js (v20+) installed.
2. In the `backend` folder, copy `.env.example` to `.env` and fill in your local or remote database URLs.
3. Start the backend:
   ```bash
   npm install
   npm run dev
   npm run worker:dev # in a separate terminal
   ```
4. Start the frontend:
   ```bash
   cd frontend
   npm install
   npm run dev
   ```
