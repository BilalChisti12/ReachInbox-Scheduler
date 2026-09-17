# ReachInbox / Outbox Labs — Production Email Job Scheduler

Production-grade full-stack email scheduling platform. Built with Node.js, BullMQ, PostgreSQL, Redis, Elasticsearch, React, and Ethereal SMTP.

## Architecture Overview

This application uses a fully serverless / Platform-as-a-Service architecture:

- **Frontend**: React (Vite) hosted on Vercel.
- **Backend API**: Node.js Express server hosted on Render.
- **Backend Worker**: Node.js BullMQ processor hosted on Render.
- **Database**: PostgreSQL
- **Queue & Rate Limiting**: Redis
- **Search Index**: Elasticsearch (Optional — falls back to PostgreSQL if unavailable).

## Deployment

Please see [DEPLOYMENT.md](DEPLOYMENT.md) for full instructions on how to deploy this application to Vercel and Render. **Docker is not required or supported.**

## Local Development

You do not need Docker to develop locally.

### Prerequisites
- Node.js v20+
- Access to a PostgreSQL database (local or remote)
- Access to a Redis database (local or remote)

### Setup

1. **Environment Variables**:
   In `backend/`, copy `.env.example` to `.env` and fill in your connection strings.
   In `frontend/`, copy `.env.example` to `.env`.

2. **Backend**:
   ```bash
   cd backend
   npm install
   npx prisma generate
   npx prisma migrate dev
   
   # Start the API
   npm run dev

   # In a new terminal, start the worker
   npm run worker:dev
   ```

3. **Frontend**:
   ```bash
   cd frontend
   npm install
   npm run dev
   ```

## Features

- **Google & Slack OAuth**: Secure authentication.
- **BullMQ Integration**: Robust email scheduling and queue management.
- **Elasticsearch**: High-performance email search (gracefully degrades to Postgres).
- **Bull Board**: Admin UI for queue monitoring.
- **Rate Limiting**: Redis-backed limits for email sending.
