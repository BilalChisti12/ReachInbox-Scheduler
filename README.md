# ReachInbox / Outbox Labs — Production Email Job Scheduler

Production-grade full-stack email scheduling platform. Built with Node.js, BullMQ, PostgreSQL, Redis, Elasticsearch, React, and Ethereal SMTP.

---

## Table of Contents

1. [What We Are Building](#section-1--what-we-are-building)
2. [Accounts You Need](#section-2--accounts-you-need)
3. [GitHub Setup](#section-3--github)
4. [Oracle Cloud VM](#section-4--oracle-cloud-vm)
5. [Linux Basics](#section-5--linux-basics-you-need)
6. [Install Docker](#section-6--install-docker)
7. [Clone the Project](#section-7--clone-the-project)
8. [Environment Variables](#section-8--environment-variables)
9. [PostgreSQL](#section-9--postgresql)
10. [Redis](#section-10--redis)
11. [Elasticsearch](#section-11--elasticsearch)
12. [Backend API](#section-12--backend-api)
13. [BullMQ Worker](#section-13--bullmq-worker)
14. [Nginx](#section-14--nginx)
15. [HTTPS with Let's Encrypt](#section-15--https)
16. [Google OAuth](#section-16--google-oauth)
17. [Slack OAuth](#section-17--slack-oauth)
18. [Ethereal SMTP](#section-18--ethereal-smtp)
19. [Vercel Frontend](#section-19--vercel-frontend)
20. [Connect Frontend to Backend](#section-20--connect-frontend-to-backend)
21. [Demo Admin](#section-21--demo-admin)
22. [Bull Board](#section-22--bull-board)
23. [Final Test Checklist](#section-23--final-test-checklist)
24. [Troubleshooting](#section-24--troubleshooting)
25. [Stop / Restart Everything](#section-25--stop--restart-everything)
26. [Update the Application](#section-26--update-the-application)
27. [Backup PostgreSQL](#section-27--backup-postgresql)

---

## Section 1 — What We Are Building

Here is the complete architecture of what you will deploy:

```
Your Browser
    |
    | (HTTPS)
    v
Vercel (free)
React Frontend
    |
    | (HTTPS API calls)
    v
Oracle Cloud Always Free VM (your server)
    |
    v
Nginx (port 80 + 443)   ← the only thing the internet touches
    |
    v
Express API (port 5000, internal)
    |
    +------------------------------------------+
    |                                          |
    v                                          v
BullMQ Worker (separate process)          PostgreSQL (database)
    |                                          |
    v                                    Redis (queue storage)
Ethereal SMTP (external, free)                |
                                     Elasticsearch (search index)

External integrations:
  - Google OAuth (login)
  - Slack OAuth (notifications)
```

**What each part does:**

| Service | What it does | Where it runs |
|---|---|---|
| **Vercel** | Hosts the React website | vercel.com (free) |
| **Oracle Cloud VM** | Your server running in the cloud | Oracle (free forever) |
| **Docker** | Runs all backend services in isolated containers | On the Oracle VM |
| **Nginx** | Routes internet traffic to your API, handles HTTPS | Docker container |
| **Express API** | Handles all API requests (login, campaigns, senders) | Docker container |
| **BullMQ Worker** | Processes scheduled emails in the background | Docker container |
| **PostgreSQL** | Stores all data (users, emails, campaigns) | Docker container |
| **Redis** | Stores the email job queue and rate limit counters | Docker container |
| **Elasticsearch** | Makes emails searchable by recipient/subject | Docker container |
| **Ethereal SMTP** | Test email provider (free, no real delivery) | External service |
| **Google OAuth** | Lets users log in with Google | Google (free) |
| **Slack OAuth** | Sends rate-limit notifications to Slack | Slack (free) |
| **Bull Board** | Visual dashboard showing the email job queue | Built into the API |

**Cost: $0.00 per month, forever.**

---

## Section 2 — Accounts You Need

Create the following accounts **before** starting deployment. All are free.

### 1. GitHub
- **Website:** https://github.com
- **Click:** "Sign up" → create free account
- **Cost:** Free forever
- **Used for:** Storing your code, connecting to Vercel

### 2. Oracle Cloud
- **Website:** https://cloud.oracle.com
- **Click:** "Start for free" → enter name, email, phone, credit card
- **Cost:** FREE FOREVER — Oracle Always Free tier never expires and never charges
- **Important:** You must enter a credit card to verify identity, but you will NOT be charged. The Always Free resources have no billing.
- **Used for:** Your server (VM) where all backend services run

### 3. Vercel
- **Website:** https://vercel.com
- **Click:** "Sign Up" → sign up with your GitHub account
- **Cost:** Free (Hobby tier, personal use)
- **Used for:** Hosting the React frontend

### 4. Google Cloud Console
- **Website:** https://console.cloud.google.com
- **Click:** Sign in with your existing Google account
- **Cost:** Free (OAuth is free)
- **Used for:** Google "Login with Google" feature

### 5. Slack
- **Website:** https://slack.com
- **Click:** "Try for free" → create a workspace
- **Cost:** Free (free workspace)
- **Used for:** Receiving rate-limit notifications

### 6. Ethereal Email
- **Website:** https://ethereal.email
- **Click:** "Create Ethereal Account" (big green button)
- **Cost:** Free forever
- **Used for:** Test email SMTP (emails are captured but not delivered to real inboxes)

### 7. Free Domain (Optional but needed for HTTPS)

You need a domain name to get an HTTPS certificate. Two free options:

**Option A — DuckDNS (easiest)**
- Website: https://www.duckdns.org
- Sign in with Google
- Create a free subdomain: e.g. `reachinbox.duckdns.org`
- Point it to your Oracle VM's IP address
- Cost: Free forever

**Option B — Afraid.org**
- Website: https://freedns.afraid.org
- Register for free
- Choose from hundreds of free domain extensions
- Cost: Free forever

---

## Section 3 — GitHub

You need to put your code on GitHub so Vercel can deploy it.

### Step 1: Initialize a Git repository

Open a terminal/command prompt on your Windows machine.
Go to the project folder:

```
cd "d:\Email Job Scheduler"
```

Initialize git:

```
git init
```

> **What this does:** Creates a hidden `.git` folder that tracks your code changes.

### Step 2: Stage all files

```
git add .
```

> **What this does:** Tells git "I want to include all these files in my next commit."
> The `.gitignore` file automatically excludes secrets (`.env` files) and `node_modules`.

### Step 3: Create your first commit

```
git commit -m "Initial production-ready deployment"
```

> **What this does:** Saves a snapshot of your code with a message describing what changed.

### Step 4: Create a GitHub repository

1. Go to https://github.com
2. Click the **+** button in the top-right corner
3. Click **"New repository"**
4. Name it: `reachinbox-email-scheduler`
5. Leave it **Private** (recommended — your code contains configuration)
6. Do NOT check "Add a README" — you already have one
7. Click **"Create repository"**

### Step 5: Connect your local code to GitHub

GitHub will show you a page with instructions. Look for the section that says **"…or push an existing repository from the command line"**. Copy those commands exactly. They will look like:

```
git remote add origin https://github.com/YOUR_USERNAME/reachinbox-email-scheduler.git
git branch -M main
git push -u origin main
```

Run those three commands in your terminal.

> **What these do:**
> - `git remote add origin ...` — tells git where GitHub is
> - `git branch -M main` — renames your branch to "main"
> - `git push -u origin main` — uploads your code to GitHub

You will be asked for your GitHub username and password (or a personal access token).

**After this step:** Go to https://github.com/YOUR_USERNAME/reachinbox-email-scheduler and you should see all your files.

---

## Section 4 — Oracle Cloud VM

### Step 1: Create an Oracle Cloud account

1. Go to https://cloud.oracle.com
2. Click **"Start for free"**
3. Fill in your name, email, and country
4. Enter a credit card (required for identity verification — you will NOT be charged)
5. Choose your **Home Region** — pick one close to your location (e.g. UK South, Germany Central, US East). **Important: you cannot change this later.**
6. Complete signup

### Step 2: Create the VM

1. Log into your Oracle Cloud dashboard
2. Click the **"hamburger menu"** (three horizontal lines) in the top-left
3. Click **"Compute"** → **"Instances"**
4. Click **"Create instance"**

### Step 3: Configure the VM

Fill in the form:

**Name:** `reachinbox-server` (or anything you like)

**Image and shape:**
- Click **"Change image"**
- Select **"Canonical Ubuntu"**
- Select version **22.04** (Minimal)
- Click **"Select image"**
- Click **"Change shape"**
- Select **"Ampere"** (this is the ARM64 processor — it's in the Always Free tier)
- Select **"VM.Standard.A1.Flex"**
- Set OCPUs to **4** and Memory to **24 GB** (this is the Always Free maximum)
- Click **"Select shape"**

**SSH keys:**
- Select **"Generate a key pair for me"**
- Click **"Save private key"** → save the `.key` file to your computer
- Also click **"Save public key"**
- **Keep the private key safe — it is how you connect to the server**

**Networking:** Leave all defaults

Click **"Create"** at the bottom.

### Step 4: Wait for the VM to start

The VM will show "Provisioning" for 1-2 minutes, then change to "Running".

### Step 5: Find your public IP address

On the instance detail page, look for **"Public IP address"**. It will look like: `150.230.123.45`

**Write this down** — you will need it many times.

### Step 6: Open firewall ports

By default, Oracle blocks almost all traffic. You need to open ports 80 (HTTP) and 443 (HTTPS).

1. On the instance page, click on your **Virtual Cloud Network** link (in the left panel)
2. Click **"Security Lists"**
3. Click on **"Default Security List for..."**
4. Click **"Add Ingress Rules"**

Add these two rules:

**Rule 1 — HTTP:**
- Source CIDR: `0.0.0.0/0`
- IP Protocol: TCP
- Destination Port Range: `80`

**Rule 2 — HTTPS:**
- Source CIDR: `0.0.0.0/0`
- IP Protocol: TCP
- Destination Port Range: `443`

Click **"Add Ingress Rules"**.

### Step 7: Connect to the VM

On Windows, open **PowerShell** (or Command Prompt).

Replace `YOUR_IP` with your server's public IP and `path/to/your-key.key` with the path to your downloaded private key:

```
ssh -i "C:\path\to\your-key.key" ubuntu@YOUR_IP
```

The first time you connect, it will ask:
```
Are you sure you want to continue connecting (yes/no)? 
```
Type `yes` and press Enter.

You should see something like:
```
ubuntu@reachinbox-server:~$
```

**You are now inside your Oracle Cloud VM.** Everything from here is Linux commands typed into this terminal.

---

## Section 5 — Linux Basics You Need

Here are the commands you'll use. Don't worry — I'll show you each command when needed.

| Command | What it does |
|---|---|
| `pwd` | Shows which folder you're currently in |
| `ls` | Lists files and folders in the current folder |
| `cd foldername` | Goes into a folder |
| `cd ..` | Goes back one folder |
| `mkdir foldername` | Creates a new folder |
| `nano filename` | Opens a text editor for that file |
| `cat filename` | Prints the contents of a file |
| `sudo command` | Runs a command as administrator |
| `docker ps` | Shows running Docker containers |
| `docker compose ...` | Manages your Docker services |

**Inside `nano` editor:**
- Type or paste your text
- Press `Ctrl+X` to exit
- Press `Y` to save
- Press `Enter` to confirm the filename

---

## Section 6 — Install Docker

Run these commands one by one on your Oracle VM. After each command, wait for it to finish.

**Step 1: Update the system package list**
```bash
sudo apt update
```
> This downloads an updated list of available software. You'll see lots of output — that's normal.

**Step 2: Install prerequisite tools**
```bash
sudo apt install -y ca-certificates curl gnupg lsb-release
```
> Installs tools needed to securely download Docker.

**Step 3: Add Docker's official signing key**
```bash
sudo install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
sudo chmod a+r /etc/apt/keyrings/docker.gpg
```
> This verifies that Docker packages are authentic (not tampered with).

**Step 4: Add Docker's repository**
```bash
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
```
> Tells the system where to download Docker from.

**Step 5: Install Docker**
```bash
sudo apt update
sudo apt install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
```
> This installs Docker. It may take 2-3 minutes.

**Step 6: Let yourself use Docker without `sudo`**
```bash
sudo usermod -aG docker ubuntu
```
> Without this, every Docker command requires `sudo`. This gives your user permission directly.

**Step 7: Apply the permission change**
```bash
newgrp docker
```
> Applies the new group permission without requiring you to log out.

**Step 8: Test that Docker works**
```bash
docker run hello-world
```
> You should see: `Hello from Docker! This message shows that your installation appears to be working correctly.`

**Step 9: Enable Docker to start automatically on reboot**
```bash
sudo systemctl enable docker
```

---

## Section 7 — Clone the Project

**Step 1: Install Git (usually pre-installed)**
```bash
sudo apt install -y git
```

**Step 2: Clone your repository**
```bash
git clone https://github.com/YOUR_USERNAME/reachinbox-email-scheduler.git
```
> Replace `YOUR_USERNAME` with your actual GitHub username.
> This downloads all your code to the server.

**Step 3: Go into the project folder**
```bash
cd reachinbox-email-scheduler
```

**Step 4: Confirm you're in the right place**
```bash
ls
```

You should see files like:
```
backend/  docker-compose.prod.yml  frontend/  nginx/  README.md  .env.example
```

If you see these, you're in the right place.

---

## Section 8 — Environment Variables

### What is a `.env` file?

A `.env` file is a text file that stores secret values (passwords, API keys) separately from your code. This way, secrets are never committed to GitHub.

The project comes with `.env.example` — a template showing every variable you need.

### Create your `.env` file

```bash
cp .env.example backend/.env
```
> This copies the template to the right location.

```bash
nano backend/.env
```
> This opens the file in a text editor.

You'll see a file full of placeholder values. **Fill in each section below.**

### What to fill in

**DATABASE section:**
- `POSTGRES_PASSWORD` — make up any secure password, e.g. `MyS3cur3DB2024!`
- `DATABASE_URL` — replace `CHANGE_THIS_PASSWORD` with the same password

**SESSION_SECRET:**
- Generate a random value by running this command (in a NEW terminal window):
```bash
openssl rand -hex 32
```
- Copy the output and paste it as the SESSION_SECRET value

**FRONTEND_URL / BACKEND_URL:**
- Leave these blank for now — you'll fill them in after getting your domain and Vercel URL

**GOOGLE OAuth:**
- Leave blank for now — you'll fill in after Section 16

**SLACK OAuth:**
- Leave blank for now — you'll fill in after Section 17

**ETHEREAL:**
- Fill in from Section 18 first, then come back

**DEMO_ADMIN_EMAIL / DEMO_ADMIN_PASSWORD:**
- Choose any email and a password at least 8 characters long
- Example: `DEMO_ADMIN_EMAIL=admin@example.com`
- Example: `DEMO_ADMIN_PASSWORD=Eval2024!`

To save and exit nano: Press `Ctrl+X`, then `Y`, then `Enter`.

---

## Section 9 — PostgreSQL

You don't need to do anything special — Docker runs PostgreSQL automatically.

When you run `docker compose -f docker-compose.prod.yml up -d`, the `postgres` container starts automatically with:
- The database name from `POSTGRES_DB`
- The username from `POSTGRES_USER`
- The password from `POSTGRES_PASSWORD`

**Data persistence:** PostgreSQL data is stored in a Docker volume named `reachinbox_postgres_data`. This volume survives:
- Container restart
- Docker restart
- VM reboot

You will never lose data as long as you don't run `docker volume rm reachinbox_postgres_data`.

**Running migrations:**

After the first deployment, run:
```bash
docker compose -f docker-compose.prod.yml exec api npx prisma migrate deploy
```
> **What this does:** Applies the database schema (creates all tables). Safe to run multiple times — it skips already-applied migrations.

---

## Section 10 — Redis

Redis is also started automatically by Docker Compose.

**What Redis does in this project:**
- Stores BullMQ job queues (scheduled and delayed email jobs)
- Stores rate limit counters (how many emails sent per sender per hour)
- Stores Slack notification deduplication locks

**Data persistence:** Redis is configured with `appendonly yes` — every operation is written to disk. If Redis restarts, all jobs are restored exactly as they were. A scheduled email job for tomorrow will still be there after a Redis restart.

You don't need to manually configure Redis. It just works.

---

## Section 11 — Elasticsearch

Elasticsearch provides full-text search for emails.

**What it does:**
- When an email is sent, marked failed, or rescheduled, the worker indexes that email into Elasticsearch
- When you search in the dashboard, the API queries Elasticsearch by recipient email, subject, or body

**Starting Elasticsearch:**
It starts automatically with Docker Compose. The first startup takes about 30-60 seconds (it's initializing its internal data structures).

**Check Elasticsearch is alive:**
```bash
docker compose -f docker-compose.prod.yml exec api wget -qO- http://elasticsearch:9200/_cluster/health
```
You should see something like:
```json
{"cluster_name":"reachinbox","status":"yellow","..."}
```
`"status":"yellow"` is normal for a single-node setup (no replicas). This is fine.

**Memory note for Oracle VM:**
The `docker-compose.prod.yml` sets Elasticsearch to use 256MB of RAM (`ES_JAVA_OPTS=-Xms256m -Xmx256m`). This is fine for this project and leaves room for the other services.

---

## Section 12 — Backend API

### Run the migrations

Before the API can start properly, you need to create the database tables.

First, start just the infrastructure (database, Redis, Elasticsearch):
```bash
docker compose -f docker-compose.prod.yml up -d postgres redis elasticsearch
```

Wait about 30 seconds for PostgreSQL to be ready, then run migrations:
```bash
docker compose -f docker-compose.prod.yml run --rm api npx prisma migrate deploy
```

You should see:
```
Applying migration `20260904134431_init`
All migrations have been applied.
```

### Start everything

```bash
docker compose -f docker-compose.prod.yml up -d --build
```

> **What this does:**
> - `--build` compiles your Docker images from the source code
> - `-d` runs everything in the background
> This takes 3-5 minutes the first time (it downloads images and compiles TypeScript).

### Check the API is running

```bash
docker compose -f docker-compose.prod.yml logs api --tail=50
```

You should see:
```
Server is running on port 5000
Successfully connected to Redis
Elasticsearch index ready
```

### Test the health endpoint

```bash
curl http://localhost:5000/health
```

You should see:
```json
{"status":"ok","timestamp":"2024-..."}
```

---

## Section 13 — BullMQ Worker

> [!IMPORTANT]
> **The worker is critical.** Without the worker, scheduled emails are never sent. The API creates jobs; the worker processes them.

The worker runs as a **completely separate Docker container** called `worker`. When the API container is restarted, the worker keeps running. When the worker is restarted, the API keeps serving requests.

### Check the worker is running

```bash
docker compose -f docker-compose.prod.yml ps
```

You should see `reachinbox_worker` listed with status `running`.

### Check worker logs

```bash
docker compose -f docker-compose.prod.yml logs worker --tail=50
```

You should see:
```
[Worker] Starting BullMQ Worker...
[Worker] Elasticsearch index ready
[Worker] BullMQ Worker is running and listening for jobs
```

### Verify delayed jobs survive restarts

If you schedule an email for 2 hours from now, then restart the worker:
```bash
docker compose -f docker-compose.prod.yml restart worker
```

The email job is still in Redis and will still process at the scheduled time.
**BullMQ stores jobs in Redis, not in the worker process's memory.** The worker just picks up jobs from Redis when it starts.

---

## Section 14 — Nginx

### What Nginx does

Nginx is a "reverse proxy." Think of it like a receptionist in an office:
- The internet reaches Nginx on ports 80 and 443 (the standard web ports)
- Nginx forwards requests to your Express API on port 5000 (internal)
- Express is never directly exposed to the internet

This is important because:
- Nginx handles HTTPS termination (decrypts HTTPS)
- Express only ever sees HTTP internally (simpler, faster)
- You don't expose port 5000 to the internet

### Configure your domain in Nginx

You must replace `YOUR_DOMAIN_HERE` in the Nginx config with your actual domain before building:

On your local Windows machine:
```
notepad "d:\Email Job Scheduler\nginx\nginx.conf"
```

Replace all occurrences of `YOUR_DOMAIN_HERE` with your domain (e.g. `api.reachinbox.duckdns.org`).

Save the file and push to GitHub:
```
git add nginx/nginx.conf
git commit -m "Set production domain in Nginx config"
git push
```

Then on the server, pull the update:
```bash
git pull
```

### Build and start Nginx

```bash
docker compose -f docker-compose.prod.yml up -d nginx
```

### Test Nginx is working (HTTP only, before HTTPS)

From your local browser, go to: `http://YOUR_VM_IP/health`

You should see: `{"status":"ok",...}`

---

## Section 15 — HTTPS

HTTPS is required. Without it, browsers block cookies, and login won't work between Vercel (HTTPS) and your backend.

You need a domain name. See Section 2 for free options (DuckDNS recommended).

### Step 1: Point your domain to your Oracle VM

**Using DuckDNS:**
1. Log into https://www.duckdns.org
2. Create a subdomain, e.g. `reachinbox-api`
3. In the "current ip" field, enter your Oracle VM's public IP
4. Click "update ip"

Your domain is now: `reachinbox-api.duckdns.org`

Wait 2-5 minutes for DNS to propagate. Test with:
```bash
ping reachinbox-api.duckdns.org
```
It should return your Oracle VM's IP address.

### Step 2: Create the certbot folder on the server

```bash
sudo mkdir -p /var/www/certbot
```

### Step 3: Temporarily allow HTTP-only Nginx (to get the certificate)

For now, Nginx only needs to serve HTTP (to verify you own the domain). First start Nginx with just the HTTP block working. Run a quick test:

```bash
curl http://reachinbox-api.duckdns.org/health
```
If you see `{"status":"ok"...}`, your domain is pointing correctly.

### Step 4: Install Certbot

```bash
sudo snap install --classic certbot
sudo ln -s /snap/bin/certbot /usr/bin/certbot
```

### Step 5: Get your SSL certificate

```bash
sudo certbot certonly --webroot -w /var/www/certbot -d reachinbox-api.duckdns.org
```

> Replace `reachinbox-api.duckdns.org` with YOUR domain.

You'll be asked for an email address (for renewal notices). Enter your email.

When it succeeds you'll see:
```
Successfully received certificate.
Certificate is saved at: /etc/letsencrypt/live/reachinbox-api.duckdns.org/fullchain.pem
```

### Step 6: Restart all services (Nginx now serves HTTPS)

```bash
docker compose -f docker-compose.prod.yml up -d --build
```

Test HTTPS:
```bash
curl https://reachinbox-api.duckdns.org/health
```

You should see the health response over HTTPS.

### Certificate Auto-Renewal

Let's Encrypt certificates last 90 days. Set up automatic renewal:

```bash
sudo crontab -e
```

Add this line at the bottom:
```
0 3 * * * certbot renew --quiet && docker compose -f /home/ubuntu/reachinbox-email-scheduler/docker-compose.prod.yml restart nginx
```

> This runs every night at 3am. If your certificate is close to expiring, it renews automatically and restarts Nginx to load the new certificate.

---

## Section 16 — Google OAuth

Google OAuth allows users to log in with their Google account.

### Step 1: Create a Google Cloud Project

1. Go to https://console.cloud.google.com
2. Click the project selector at the top (it might say "No project" or a project name)
3. Click **"New Project"**
4. Name it: `reachinbox`
5. Click **"Create"**
6. Make sure the project is selected

### Step 2: Enable the Google OAuth API

1. Click the hamburger menu → **"APIs & Services"** → **"Library"**
2. Search for "Google+ API" or "Google Identity"
3. Click **"Google Identity"** → click **"Enable"**

### Step 3: Create OAuth Credentials

1. Click hamburger menu → **"APIs & Services"** → **"Credentials"**
2. Click **"+ Create Credentials"** → **"OAuth client ID"**
3. If prompted to configure the consent screen:
   - Click **"Configure consent screen"**
   - Choose **"External"**
   - Fill in App name: `ReachInbox`
   - Enter your email for support
   - Click **"Save and Continue"** through all steps
4. Back on "Create OAuth client ID":
   - Application type: **"Web application"**
   - Name: `ReachInbox Web`
   
5. **Authorized JavaScript origins** — add both:
   ```
   https://YOUR_FRONTEND_VERCEL_URL.vercel.app
   https://reachinbox-api.duckdns.org
   ```
   (Replace with your actual URLs)

6. **Authorized redirect URIs** — add exactly:
   ```
   https://reachinbox-api.duckdns.org/auth/google/callback
   ```
   (Replace domain with yours. This MUST match exactly what's in your `.env` file)

7. Click **"Create"**

8. You'll see your **Client ID** and **Client Secret**. Copy them.

### Step 4: Update your `.env` file

On your server:
```bash
nano backend/.env
```

Fill in:
```
GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-client-secret
GOOGLE_CALLBACK_URL=https://reachinbox-api.duckdns.org/auth/google/callback
FRONTEND_URL=https://your-app.vercel.app
BACKEND_URL=https://reachinbox-api.duckdns.org
```

Save, then restart the API:
```bash
docker compose -f docker-compose.prod.yml restart api
```

---

## Section 17 — Slack OAuth

Slack OAuth allows the app to send rate-limit notifications to your Slack workspace.

### Step 1: Create a Slack App

1. Go to https://api.slack.com/apps
2. Click **"Create New App"**
3. Select **"From scratch"**
4. App Name: `ReachInbox Notifier`
5. Select your workspace from the dropdown
6. Click **"Create App"**

### Step 2: Configure OAuth & Permissions

1. Click **"OAuth & Permissions"** in the left sidebar
2. Scroll down to **"Scopes"** → **"Bot Token Scopes"**
3. Click **"Add an OAuth Scope"**
4. Add: `chat:write`
5. Add: `chat:write.public`

### Step 3: Add Redirect URL

1. Scroll up to **"Redirect URLs"**
2. Click **"Add New Redirect URL"**
3. Enter exactly:
   ```
   https://reachinbox-api.duckdns.org/api/slack/callback
   ```
4. Click **"Save URLs"**

### Step 4: Get credentials

1. Click **"Basic Information"** in the left sidebar
2. Scroll to **"App Credentials"**
3. Copy **"Client ID"** and **"Client Secret"**

### Step 5: Update `.env`

```bash
nano backend/.env
```

Fill in:
```
SLACK_CLIENT_ID=your-slack-client-id
SLACK_CLIENT_SECRET=your-slack-client-secret
SLACK_REDIRECT_URI=https://reachinbox-api.duckdns.org/api/slack/callback
```

Restart:
```bash
docker compose -f docker-compose.prod.yml restart api worker
```

---

## Section 18 — Ethereal SMTP

Ethereal is a free test email service. Emails are captured for inspection but not delivered to real inboxes. This is perfect for this project.

### Step 1: Create an Ethereal account

1. Go to https://ethereal.email
2. Click **"Create Ethereal Account"** (the big green button)
3. Ethereal will instantly create a test account and show you credentials

### Step 2: Copy the credentials

The page will show something like:
```
Name: Some Name
Username: someuser@ethereal.email
Password: somepassword123
Host: smtp.ethereal.email
Port: 587
Secure: false (STARTTLS)
```

### Step 3: Update `.env`

```bash
nano backend/.env
```

Fill in:
```
ETHEREAL_HOST=smtp.ethereal.email
ETHEREAL_PORT=587
ETHEREAL_USER=someuser@ethereal.email
ETHEREAL_PASSWORD=somepassword123
ETHEREAL_FROM=someuser@ethereal.email
```

Restart:
```bash
docker compose -f docker-compose.prod.yml restart worker
```

### Step 4: Test it works

1. Log into the app
2. Add a new Sender using the Ethereal credentials
3. Compose and send an email to any address (e.g. `test@example.com`)
4. Go to https://ethereal.email/messages (log in with the same credentials)
5. You should see the email there within 30 seconds

---

## Section 19 — Vercel Frontend

### Step 1: Push your latest code to GitHub

On your Windows machine:
```
cd "d:\Email Job Scheduler"
git add .
git commit -m "Add deployment files"
git push
```

### Step 2: Import project on Vercel

1. Go to https://vercel.com
2. Log in (use your GitHub account)
3. Click **"Add New..."** → **"Project"**
4. Find your repository `reachinbox-email-scheduler` and click **"Import"**

### Step 3: Configure the build

Vercel will auto-detect that this is a monorepo (it has both `frontend/` and `backend/`). Configure it:

- **Root Directory:** Click "Edit" and type `frontend`
- **Framework Preset:** Vite (auto-detected)
- **Build Command:** `npm run build`
- **Output Directory:** `dist`

### Step 4: Add environment variables

Click **"Environment Variables"** and add:

| Name | Value |
|---|---|
| `VITE_API_URL` | `https://reachinbox-api.duckdns.org` |

> Replace with your actual backend domain.

### Step 5: Deploy

Click **"Deploy"**.

Vercel will build and deploy in about 1 minute.

After deployment, you'll get a URL like: `https://reachinbox-email-scheduler.vercel.app`

**Copy this URL** — you need it for the next step and for Google OAuth.

---

## Section 20 — Connect Frontend to Backend

### What this means

The frontend (on Vercel) needs to know WHERE to send API requests. This is controlled by the `VITE_API_URL` environment variable you set in Section 19.

### Update CORS on the backend

Now that you have your Vercel URL, update the backend's `FRONTEND_URL`:

```bash
nano backend/.env
```

Set:
```
FRONTEND_URL=https://reachinbox-email-scheduler.vercel.app
```

Restart the API:
```bash
docker compose -f docker-compose.prod.yml restart api
```

### Update Google OAuth

Go back to Google Cloud Console → Credentials → your OAuth client.

Under **"Authorized JavaScript origins"**, add:
```
https://reachinbox-email-scheduler.vercel.app
```

Click **"Save"**.

### Test the connection

1. Open your Vercel URL in a browser: `https://reachinbox-email-scheduler.vercel.app`
2. You should see the login page
3. Click "Login with Google"
4. You should be redirected to Google login, then back to the app

If you see a "Network Error" or CORS error, check Section 24 (Troubleshooting).

---

## Section 21 — Demo Admin

The Demo Admin is a special account that gives access to the Bull Board queue dashboard.

### Step 1: Set credentials

In `backend/.env`:
```
DEMO_ADMIN_EMAIL=admin@example.com
DEMO_ADMIN_PASSWORD=YourSecurePassword123
```

### Step 2: Run the seed script

```bash
docker compose -f docker-compose.prod.yml exec api npm run seed:demo
```

You should see:
```
Success: Created new Demo Platform Admin account for admin@example.com.
```

**This is safe to run multiple times** — it updates the existing account if it already exists.

### Step 3: Log in

1. Open your frontend
2. Click **"or sign in with email"** (under the Google button)
3. Enter your `DEMO_ADMIN_EMAIL` and `DEMO_ADMIN_PASSWORD`
4. You'll be logged in as a platform admin

### Important security notes

- **Never put the password in frontend code** — the password lives only in `backend/.env` on the server
- The Demo Admin has the same data isolation as any other user — they can only see their own senders, campaigns, and emails
- The only extra privilege is Bull Board access

---

## Section 22 — Bull Board

Bull Board is a visual dashboard showing all queued, active, completed, and failed email jobs.

### Access it

As the Demo Admin, go to:
```
https://reachinbox-api.duckdns.org/admin/queues
```

Or click the **"Queue Dashboard"** link in the Settings page.

### Access control

| Who | What they see |
|---|---|
| Not logged in | 401 Unauthorized |
| Logged in, regular user | 403 Forbidden |
| Demo Admin (isPlatformAdmin=true) | Full Bull Board dashboard |

The authorization is enforced on the **backend**. The frontend code cannot bypass this.

---

## Section 23 — Final Test Checklist

Go through each item below. Check it off when it works.

### Infrastructure
- [ ] `curl https://your-backend-domain/health` returns `{"status":"ok"}`
- [ ] `docker compose -f docker-compose.prod.yml ps` shows all 6 containers as "running"

### Authentication
- [ ] Frontend opens at your Vercel URL without errors
- [ ] **Email/password signup** works (create a new account)
- [ ] **Email/password login** works (log in with the same account)
- [ ] **Google OAuth login** works (redirects to Google, then back to `/scheduled`)
- [ ] **Logout** works (redirects to login page)
- [ ] After logout, going to `/scheduled` redirects to `/login`

### Senders
- [ ] Navigate to `/senders`
- [ ] Add a sender using Ethereal credentials
- [ ] Sender appears in list with "Active" badge

### Compose & Scheduling
- [ ] Navigate to `/compose`
- [ ] Fill in subject, body, recipients, select sender
- [ ] Click "Send" — email appears in `/scheduled`
- [ ] Wait 30 seconds — email moves to `/sent`
- [ ] Go to https://ethereal.email/messages — email appears there

### Dashboard
- [ ] `/scheduled` shows scheduled emails
- [ ] `/sent` shows sent emails
- [ ] Click an email — email detail page opens
- [ ] Delete an email — email disappears from list

### Search
- [ ] Type a recipient email in the search box
- [ ] Results filter correctly (Elasticsearch working)

### Rate Limiting
- [ ] Compose email with 5 recipients, Hourly Limit: 2
- [ ] After processing: 2 show as "sent", 3 show as "scheduled" (deferred 1 hour)
- [ ] If Slack is connected: receive a Slack notification

### Slack
- [ ] Navigate to `/settings`
- [ ] Click "Connect to Slack" — completes OAuth
- [ ] Slack shows as connected

### Bull Board
- [ ] Log in as Demo Admin
- [ ] Navigate to `/settings` — "Queue Dashboard" card is visible
- [ ] Click "Launch Bull Board" — Bull Board opens showing `email-scheduler` queue
- [ ] Log in as regular user — Bull Board link not visible
- [ ] Try navigating to `/admin/queues` as regular user — get 403

### Worker Restart Test
- [ ] Schedule an email for 5 minutes in the future
- [ ] Run: `docker compose -f docker-compose.prod.yml restart worker`
- [ ] Wait for the scheduled time
- [ ] Email processes and appears in `/sent`

### Tenant Isolation
- [ ] Log in as User A, create senders and campaigns
- [ ] Log in as User B (different account)
- [ ] User B cannot see User A's senders, campaigns, or emails

### HTTPS
- [ ] All pages load over HTTPS (padlock in browser)
- [ ] HTTP automatically redirects to HTTPS

---

## Section 24 — Troubleshooting

### Problem: Frontend shows "Network Error"
**Likely cause:** `VITE_API_URL` is wrong in Vercel, or the backend is down.

**Check:**
1. On Vercel dashboard → Settings → Environment Variables → confirm `VITE_API_URL`
2. Test backend directly: `curl https://your-backend-domain/health`
3. Check API logs: `docker compose -f docker-compose.prod.yml logs api --tail=50`

### Problem: CORS error in browser console
**Likely cause:** `FRONTEND_URL` in `backend/.env` doesn't match your Vercel URL exactly.

**Check:**
```bash
grep FRONTEND_URL backend/.env
```
The value must match exactly (including `https://`). No trailing slash.

Then restart: `docker compose -f docker-compose.prod.yml restart api`

### Problem: Google login redirects to localhost
**Likely cause:** `GOOGLE_CALLBACK_URL` in `.env` still says `localhost`, or Google Console has the wrong URL.

**Check:**
```bash
grep GOOGLE_CALLBACK_URL backend/.env
```
Must be: `https://your-backend-domain/auth/google/callback`

Also check Google Cloud Console → Credentials → your app → Authorized redirect URIs.

### Problem: Emails are not being sent
**Check worker is running:**
```bash
docker compose -f docker-compose.prod.yml ps
docker compose -f docker-compose.prod.yml logs worker --tail=100
```

**Check Redis has the jobs:**
```bash
docker compose -f docker-compose.prod.yml exec redis redis-cli KEYS "bull:*" | wc -l
```

**Check Ethereal credentials:**
```bash
grep ETHEREAL backend/.env
```

### Problem: Scheduled email never sends
**Step 1:** Check the worker is running:
```bash
docker compose -f docker-compose.prod.yml logs worker -f
```
Watch the logs in real time. When the scheduled time arrives, you should see processing logs.

**Step 2:** Check the job exists in Bull Board (as Demo Admin):
```
https://your-backend-domain/admin/queues
```
Look for the job in "Delayed" tab.

**Step 3:** Check Redis is running:
```bash
docker compose -f docker-compose.prod.yml exec redis redis-cli ping
```
Should return: `PONG`

### Problem: Elasticsearch search fails
**Check ES is running:**
```bash
docker compose -f docker-compose.prod.yml logs elasticsearch --tail=30
```

**Test ES directly:**
```bash
docker compose -f docker-compose.prod.yml exec api wget -qO- http://elasticsearch:9200/_cluster/health
```
Should return JSON with `"status":"yellow"` or `"green"`.

**Re-index existing emails:**
```bash
docker compose -f docker-compose.prod.yml exec api node dist/scripts/reindexElasticsearch.js
```

### Problem: Slack notification doesn't arrive
**Check:**
1. Is Slack connected? — `/settings` → Slack shows as connected
2. Check worker logs when rate limit is hit: `docker compose -f docker-compose.prod.yml logs worker --tail=50`
3. Re-connect Slack (token may have expired)

### Problem: Bull Board returns 403
**Check that the logged-in user is a platform admin:**
```bash
docker compose -f docker-compose.prod.yml exec api npm run seed:demo
```
Run the seed again to ensure the admin user has `isPlatformAdmin=true`.

### Problem: Database connection failed
**Check DATABASE_URL:**
```bash
grep DATABASE_URL backend/.env
```
In production, should be: `postgresql://reachinbox_user:YOUR_PASSWORD@postgres:5432/reachinbox`
Note: `postgres` is the Docker container name (not `localhost`).

**Check PostgreSQL is running:**
```bash
docker compose -f docker-compose.prod.yml ps postgres
```

### Problem: Elasticsearch won't start / runs out of memory
**Fix:** Reduce memory in `docker-compose.prod.yml`:
```yaml
- ES_JAVA_OPTS=-Xms128m -Xmx128m
```
Then: `docker compose -f docker-compose.prod.yml up -d --build elasticsearch`

---

## Section 25 — Stop / Restart Everything

### Stop all services
```bash
docker compose -f docker-compose.prod.yml down
```
> Stops and removes all containers. **Data is preserved in volumes.**

### Start all services
```bash
docker compose -f docker-compose.prod.yml up -d
```

### Restart one service
```bash
docker compose -f docker-compose.prod.yml restart api
docker compose -f docker-compose.prod.yml restart worker
docker compose -f docker-compose.prod.yml restart nginx
```

### View live logs
```bash
# All services
docker compose -f docker-compose.prod.yml logs -f

# Just the API
docker compose -f docker-compose.prod.yml logs -f api

# Just the worker
docker compose -f docker-compose.prod.yml logs -f worker

# Last 100 lines from API
docker compose -f docker-compose.prod.yml logs api --tail=100
```

### See what's running
```bash
docker compose -f docker-compose.prod.yml ps
```

---

## Section 26 — Update the Application

When you change code on your Windows machine and want to deploy the update:

### Step 1: Commit and push your code changes

On Windows:
```
cd "d:\Email Job Scheduler"
git add .
git commit -m "Your description of what changed"
git push
```

### Step 2: Pull the changes on the server

```bash
git pull
```

### Step 3: Rebuild and restart

```bash
docker compose -f docker-compose.prod.yml up -d --build api worker
```
> `--build` recompiles the Docker image with your new code.
> Only rebuilds `api` and `worker` — Nginx and databases are unchanged.

### Step 4: Run migrations (only if you changed the Prisma schema)

```bash
docker compose -f docker-compose.prod.yml exec api npx prisma migrate deploy
```
> Only run this if you added/changed tables in `schema.prisma`.
> Safe to run even if there are no new migrations — it just says "everything up to date".

### Frontend updates

The frontend redeploys **automatically** on Vercel whenever you push to GitHub. No manual steps needed.

---

## Section 27 — Backup PostgreSQL

Since you're hosting the database yourself, you are responsible for backups.

### Manual backup

Run this command on the server:
```bash
docker compose -f docker-compose.prod.yml exec postgres pg_dump -U reachinbox_user reachinbox > backup-$(date +%Y%m%d-%H%M%S).sql
```

> **What this does:** Exports your entire database to a `.sql` file named with today's date/time.

Example output file: `backup-20241105-143022.sql`

### Download the backup to your Windows machine

On your Windows machine (in PowerShell):
```powershell
scp -i "C:\path\to\your-key.key" ubuntu@YOUR_VM_IP:~/backup-*.sql .
```

### Restore from a backup

If you need to restore:
```bash
docker compose -f docker-compose.prod.yml exec -T postgres psql -U reachinbox_user reachinbox < backup-20241105-143022.sql
```

### Automated daily backup (optional)

```bash
sudo crontab -e
```

Add:
```
0 2 * * * cd /home/ubuntu/reachinbox-email-scheduler && docker compose -f docker-compose.prod.yml exec postgres pg_dump -U reachinbox_user reachinbox > /home/ubuntu/backups/backup-$(date +%Y%m%d).sql
```

Create the backups folder:
```bash
mkdir -p ~/backups
```

---

## Local Development (for reference)

For local development, the existing setup still works unchanged:

### Start infrastructure
```bash
docker compose up -d
```
*(This starts just postgres, redis, elasticsearch)*

### Start backend
```bash
cd backend
npm run dev
```

### Start frontend
```bash
cd frontend
npm run dev
```

### Start worker separately (optional — dev mode starts worker inside API)
```bash
cd backend
npm run worker:dev
```

---

## Files Changed During Deployment Setup

| File | Change |
|---|---|
| `backend/src/app.ts` | Multi-origin CORS, trust proxy, SameSite=none cookies for production |
| `backend/src/routes/auth.ts` | Fixed Google callback redirect: `/dashboard` → `/scheduled` |
| `backend/src/routes/slack.ts` | Fixed Slack callback redirect: `/dashboard` → `/settings` |
| `backend/src/worker.ts` | **NEW** — standalone worker process for separate Docker container |
| `backend/src/server.ts` | Unchanged (still starts API + worker together in dev mode) |
| `backend/package.json` | Added `worker:dev` and `start:worker` scripts |
| `backend/Dockerfile` | **NEW** — multi-stage production Docker build |
| `docker-compose.prod.yml` | **NEW** — production compose with all 6 services |
| `nginx/nginx.conf` | **NEW** — HTTPS reverse proxy config |
| `nginx/Dockerfile` | **NEW** — Nginx container |
| `frontend/vercel.json` | **NEW** — SPA routing (prevents 404 on page refresh) |
| `.env.example` | **UPDATED** — all variables documented |
| `.gitignore` | **UPDATED** — covers all generated files |

---

## Architecture Diagram

```
                    Internet
                       │
              ┌────────▼────────┐
              │   Vercel (free) │
              │  React Frontend │
              └────────┬────────┘
                       │ HTTPS API calls
                       │
              ┌────────▼────────────────────────────────┐
              │         Oracle Cloud Always Free VM      │
              │                                          │
              │  ┌────────────────────────────────────┐  │
              │  │         Nginx (port 80/443)        │  │
              │  │  HTTPS termination + reverse proxy │  │
              │  └──────────────┬─────────────────────┘  │
              │                 │                         │
              │  ┌──────────────▼──────────────────────┐  │
              │  │        Express API (port 5000)      │  │
              │  │   Auth, Campaigns, Senders, Search  │  │
              │  └──────────────┬──────────────────────┘  │
              │                 │                         │
              │    ┌────────────┼────────────┐            │
              │    │            │            │            │
              │  ┌─▼──┐    ┌───▼──┐   ┌────▼──────────┐  │
              │  │ PG │    │Redis │   │Elasticsearch  │  │
              │  └────┘    └──┬───┘   └───────────────┘  │
              │               │                           │
              │  ┌────────────▼────────────────────────┐  │
              │  │      BullMQ Worker (separate)        │  │
              │  │   Processes scheduled email jobs     │  │
              │  └────────────────────────────────────┘  │
              └─────────────────────────────────────────┘
                                  │
                         ┌────────▼────────┐
                         │  Ethereal SMTP  │
                         │  (test emails)  │
                         └─────────────────┘
```

---

## Known Limitations

1. **Figma Design**: The Figma design link was restricted (403 Forbidden). The frontend UI is built to match the described Gmail-like inbox interface.
2. **Ethereal SMTP**: Emails are captured for inspection but not delivered to real inboxes. This is by design for a test/evaluation system.
3. **Bull Board Multi-Tenant**: Bull Board shows all queued jobs globally (not filtered per tenant). This is a Bull Board architectural limitation.
4. **Single-node Elasticsearch**: The `status:"yellow"` from Elasticsearch is normal — it means no replica shards (expected for single-node deployment).
5. **Oracle ARM64**: All Docker images in this project are confirmed multi-arch (support both ARM64 and x86_64).
