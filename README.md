# ReachInbox / Outbox Labs — Production Email Job Scheduler

Production-grade full-stack email scheduling platform. Built with Node.js, BullMQ, PostgreSQL, Redis, Elasticsearch, React, and Ethereal SMTP.

---

## 1. Project Purpose & Architecture

This project is a scalable, distributed email scheduler. 

```text
Your Browser
    |
Vercel / Frontend Hosting
React Frontend (Vite, TypeScript, Tailwind)
    |
    | (HTTPS API calls)
    v
Express API (Node.js) <------> PostgreSQL (Source of Truth)
    |                             |
    +---- BullMQ (Redis) ---------+
    |                             |
    v                             v
BullMQ Worker (Node.js) -----> Elasticsearch (Search Index)
    |
    v
Ethereal SMTP / Slack Webhooks
```

### Key Technologies:
- **Frontend:** React, TypeScript, TailwindCSS, Vite.
- **Backend:** Node.js, Express, TypeScript, Prisma ORM.
- **Database:** PostgreSQL (primary data store).
- **Queues:** Redis & BullMQ (persisted, distributed delayed jobs).
- **Search:** Elasticsearch / OpenSearch.
- **Auth:** Google OAuth (Passport).

---

## 2. Local Setup & Deployment

### Prerequisites
You must have the following installed on your host machine:
- **Node.js** (v18+)
- **PostgreSQL** (v14+)
- **Redis** (v6+)
- **Elasticsearch** (or OpenSearch) (v7/v8)

### Environment Variables
Copy the `.env.example` file in the `backend/` directory to `.env` and configure your local connections:

```bash
cp backend/.env.example backend/.env
```

Ensure the following variables correctly point to your native services:
```env
DATABASE_URL="postgresql://user:pass@localhost:5432/reachinbox?schema=public"
REDIS_HOST="127.0.0.1"
REDIS_PORT="6379"
ELASTICSEARCH_NODE="http://localhost:9200"
```

Configure your external OAuth providers (Google, Slack) and Ethereal SMTP credentials in the `.env` file as well.

### Starting the Backend

1. Install dependencies:
   ```bash
   cd backend
   npm install
   ```

2. Run Database Migrations:
   ```bash
   npx prisma migrate deploy
   ```

3. Start the API Server:
   ```bash
   npm run start
   # Or for development: npm run dev
   ```

4. Start the Background Worker (REQUIRED for processing emails):
   ```bash
   npm run start:worker
   # Or for development: npm run worker:dev
   ```

### Starting the Frontend

1. Navigate to the frontend directory:
   ```bash
   cd frontend
   ```

2. Configure environment:
   ```bash
   cp .env.example .env
   ```
   Set `VITE_API_URL` to your backend URL (e.g., `http://localhost:5000`).

3. Install and run:
   ```bash
   npm install
   npm run dev
   ```

---

## 3. Core Features & Guarantees

### NO CRON
This architecture entirely avoids `setInterval` or `node-cron`. Instead, BullMQ leverages Redis keyspace notifications to accurately process delayed jobs at scale without polling loops.

### Concurrency & Rate Limiting
The worker implements an **Atomic Lua Script** evaluated in Redis. This guarantees that multiple concurrent worker processes cannot race and violate the sender or campaign hourly rate limits. If a limit is reached, the job calculates the precise delay required and reschedules itself for the next available window.

### Duplicate-Send Protection (Idempotency)
Before dispatching an email to SMTP, the worker claims the job via a PostgreSQL transaction (`status = scheduled -> processing`). If the worker crashes immediately after, BullMQ will eventually retry it, but the lock prevents another worker from simultaneously sending the same email.

### Restart Survival
Both the application state (PostgreSQL) and the scheduled job delays (Redis Append-Only-File) are persistently stored on disk. If the API or Worker crashes, no jobs are lost. 

### API Endpoints
- `GET /api/emails/search` - Full-text search backed by Elasticsearch.
- `POST /api/campaigns` - Schedule a new email campaign.
- `POST /api/admin/search/reindex` - Reconstruct the Elasticsearch index from Postgres.
- `GET /admin/queues` - Bull Board dashboard (requires Admin privileges).

---

## 4. Testing

The test suite evaluates concurrency, idempotency, failure handling, and limits.
To run the automated test scripts:

```bash
cd backend
./run-tests.sh
```

---

## 5. Production Deployment

For production, run the services using a process manager like `pm2`:
```bash
pm2 start dist/server.js --name reachinbox-api
pm2 start dist/worker.js --name reachinbox-worker
```
Configure your reverse proxy (e.g., Nginx or Caddy) to route external HTTPS traffic to the internal Express port (5000), ensuring `trust proxy` correctly handles secure session cookies.
