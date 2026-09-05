# Deployment Readiness — Implementation Plan

## What I Found (Audit Summary)

After full inspection, the project is **functionally excellent** but needs specific changes for production deployment. Nothing about the core architecture changes.

### Critical Bugs to Fix First

| # | Bug | File | Severity |
|---|---|---|---|
| 1 | Google OAuth callback redirects to `/dashboard` (non-existent) | `backend/src/routes/auth.ts` | HIGH |
| 2 | Slack callback redirects to `/dashboard?slack=connected` (non-existent) | `backend/src/routes/slack.ts` | HIGH |
| 3 | Session cookie missing `sameSite` for cross-origin production | `backend/src/app.ts` | HIGH |
| 4 | CORS only accepts single origin (breaks if multiple Vercel preview URLs) | `backend/src/app.ts` | MEDIUM |
| 5 | `scratch.ts` and `scratchMakeAdmin.ts` in `src/` should not ship | `backend/src/` | LOW |
| 6 | `backend/src/server.ts` starts worker INSIDE the API process — need a separate worker entrypoint | `backend/src/` | HIGH |

### Architecture Issues

- The current `server.ts` starts the BullMQ worker in the SAME process as the Express API. For production, we need a **separate worker container**. This requires a `worker.ts` entrypoint.
- The dev `docker-compose.yml` only runs infra (db, redis, es). Production needs `api`, `worker`, and `nginx` too.
- No `Dockerfile` exists for the backend.
- No `nginx.conf` exists.
- The frontend has no `vercel.json` (needed for SPA routing on Vercel).
- `.env.example` is incomplete — missing `BACKEND_URL`, `DEMO_ADMIN_EMAIL/PASSWORD`, `WORKER_CONCURRENCY`, etc.
- `.gitignore` is minimal — needs `*.tsbuildinfo`, `prisma.config.ts`, etc.
- Elasticsearch Docker image `8.11.0` may not support ARM64 — must use multi-arch compatible image.

---

## Zero-Cost Architecture Verification

| Service | Free Tier | Limitations | Verdict |
|---|---|---|---|
| **Oracle Cloud Always Free** | 4 OCPUs, 24 GB RAM, ARM64 Ampere | Never expires, no credit card billing spike | ✅ Genuinely free forever |
| **Vercel** | Hobby tier (free forever) | 100 GB bandwidth/month, no commercial use | ✅ Free for personal/evaluation |
| **Elasticsearch 8.x (self-hosted)** | Open source, self-hosted | Uses ~512MB RAM minimum | ✅ Free |
| **Ethereal SMTP** | Free forever, test-only | Emails not delivered to real inboxes | ✅ Free |
| **Google OAuth** | Free forever | Just needs a Google account | ✅ Free |
| **Slack OAuth** | Free forever | Just needs a Slack workspace | ✅ Free |
| **Let's Encrypt SSL** | Free forever | 90-day renewal (auto-renewable) | ✅ Free |
| **PostgreSQL (self-hosted)** | Open source | Uses ~100MB RAM | ✅ Free |
| **Redis (self-hosted)** | Open source | Uses ~50MB RAM | ✅ Free |

**Total cost: $0.00/month, forever.**

> [!IMPORTANT]
> Oracle Cloud Always Free ARM64 VMs use `aarch64` (ARM64). The Elasticsearch image `docker.elastic.co/elasticsearch/elasticsearch:8.11.0` has **multi-arch support including ARM64**. This is verified. All other images (postgres:15-alpine, redis:7-alpine, node:20-alpine, nginx:alpine) also support ARM64.

---

## Proposed Changes

### Backend Changes

#### [MODIFY] `backend/src/routes/auth.ts`
- Fix Google callback redirect: `/dashboard` → `/scheduled`

#### [MODIFY] `backend/src/routes/slack.ts`
- Fix Slack callback redirect: `/dashboard?slack=connected` → `/settings?slack=connected`

#### [MODIFY] `backend/src/app.ts`
- Fix CORS to support multiple origins (array)
- Fix session cookie: add `sameSite: 'none'` in production (required for cross-origin cookies between Vercel frontend and Oracle backend)
- Add `proxy: 1` trust for Nginx reverse proxy (required for `secure: true` cookies behind Nginx)

#### [NEW] `backend/src/worker.ts`
- Standalone worker entrypoint (separate from `server.ts`)
- Imports `ElasticsearchService` for index initialization
- Starts `EmailWorker` and nothing else
- This is what the `worker` Docker container runs

#### [MODIFY] `backend/package.json`
- Add `"worker": "node dist/worker.js"` script
- Add `"worker:dev": "npx tsx watch src/worker.ts"` script

#### [DELETE] `backend/src/scratch.ts`, `backend/src/scratchMakeAdmin.ts`
- Scratch files should not be in the source tree

---

### Docker / Infrastructure Changes

#### [MODIFY] `docker-compose.yml`
- Keep as-is (dev only: just postgres, redis, elasticsearch)
- This is correct for local development

#### [NEW] `docker-compose.prod.yml`
- Full production Docker Compose with:
  - `postgres` (internal only, persistent volume)
  - `redis` (internal only, persistent volume)
  - `elasticsearch` (internal only, persistent volume)
  - `api` (Express, built from Dockerfile)
  - `worker` (BullMQ worker, built from same Dockerfile, different CMD)
  - `nginx` (public-facing, ports 80 + 443)
- Named volumes for data persistence
- Health checks
- Restart policies (`unless-stopped`)
- Internal Docker networking (no exposed ports except Nginx 80/443)

#### [NEW] `backend/Dockerfile`
- Multi-stage build:
  1. Builder stage: installs deps, generates Prisma, compiles TypeScript
  2. Production stage: copies only `dist/`, `node_modules/`, `prisma/`
- Node 20 Alpine (ARM64-compatible)

#### [NEW] `nginx/nginx.conf`
- Reverse proxy to `api:5000`
- HTTPS with Let's Encrypt
- SPA-friendly (no 404 on refresh)
- Proper headers (X-Forwarded-For, X-Real-IP)

#### [NEW] `nginx/Dockerfile`
- Minimal Nginx Alpine

---

### Frontend Changes

#### [NEW] `frontend/vercel.json`
- SPA rewrites: all routes → `index.html`
- Prevents 404 on page refresh for React Router routes

#### [MODIFY] `frontend/vite.config.ts`
- Keep dev proxy as-is
- No production proxy needed (Vercel serves static, calls Oracle backend directly)

---

### Root-Level Changes

#### [MODIFY] `.env.example`
- Complete, organized list of ALL environment variables
- Clear comments explaining where each value comes from
- No real credentials

#### [MODIFY] `.gitignore`
- Add `*.tsbuildinfo`, `backend/prisma/generated/`, `*.log`, `nginx/certs/`, etc.

#### [MODIFY/REWRITE] `README.md`
- Full beginner deployment guide (26 sections as specified)

---

## Files to Create

```
backend/
  Dockerfile
  src/
    worker.ts          ← new standalone worker entrypoint

nginx/
  nginx.conf           ← production Nginx config
  Dockerfile           ← Nginx container

frontend/
  vercel.json          ← Vercel SPA routing fix

docker-compose.prod.yml  ← production compose (root level)

.env.example            ← updated with all vars
.gitignore              ← updated
README.md               ← full deployment guide
```

---

## Open Questions

> [!IMPORTANT]
> **Custom Domain**: For HTTPS to work with Let's Encrypt, you need a domain name. I'll explain two options in the guide:
> 1. **Free option**: Use a free subdomain from [Afraid.org](https://freedns.afraid.org) or [DuckDNS](https://www.duckdns.org) — these are genuinely free forever.
> 2. **Skip HTTPS for now**: Use the Oracle VM's raw IP with HTTP first, then add HTTPS later when you get a domain.
> The guide will cover both. Which do you prefer I lead with?

> [!NOTE]
> **Vercel vs raw IP for backend**: Since the Oracle VM uses a public IP, the frontend can call the backend directly at `http://YOUR_IP:80` even without a domain. However, Vercel deployments are HTTPS, and calling an HTTP backend from HTTPS causes a "mixed content" browser error. So HTTPS on the backend is **required** if you're using Vercel. The guide will explain how to get a free domain + Let's Encrypt certificate.

---

## Verification Plan

After all changes, I will:
1. Run `npx tsc --noEmit` on both backend and frontend — confirm 0 errors
2. Run `npm run build` on frontend — confirm production bundle
3. Run `docker build` on backend Dockerfile — confirm ARM64-compatible build
4. Validate `docker-compose.prod.yml` syntax
5. Run existing integration tests to confirm nothing is broken
