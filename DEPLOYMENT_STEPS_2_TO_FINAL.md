# ReachInbox Production Deployment Guide (Step 2 to Final)

This document contains everything you need to know to deploy the ReachInbox Email Job Scheduler for exactly $0. It assumes you have completed **Step 1 (GitHub setup)** and your code is safely stored in a private GitHub repository.

---

## STEP 2 — Provision the Oracle Cloud Always Free VM

**WHAT I AM DOING:** Getting a free virtual computer (server) in the cloud to run the backend.
**WHY I AM DOING IT:** Your API, database, and background worker need to run 24/7. Oracle Cloud offers an "Always Free" tier that never charges you.

1. Go to [Oracle Cloud](https://cloud.oracle.com) and sign in.
2. Click the **hamburger menu** (three horizontal lines) in the top-left corner.
3. Go to **Compute** -> **Instances**.
4. Click the blue **Create instance** button.
5. **Name:** Type `reachinbox-server`.
6. **Image and shape:**
   - Click **Edit** next to Image and shape.
   - Click **Change image**. Select **Canonical Ubuntu**, choose version **22.04 Minimal**, and click **Select image**.
   - Click **Change shape**. Select **Ampere** (ARM64 processor). Choose **VM.Standard.A1.Flex**.
   - **Crucial step for $0 cost:** Look for the "Always Free Eligible" tag. Set **OCPUs to 4** and **Memory to 24 GB**.
   - Click **Select shape**.
7. **Networking:** Leave the default settings (Create new virtual cloud network).
8. **Add SSH keys:** 
   - Select **Generate a key pair for me**.
   - Click **Save private key** (This downloads a `.key` file. Keep this safe; it is your password to the server!).
9. **Boot volume:** Leave as default (it is Always Free eligible).
10. Click the **Create** button at the bottom.

**EXPECTED RESULT:** The instance will say "Provisioning" for a few minutes, then change to a green "Running".
**HOW TO KNOW IT SUCCEEDED:** You will see a **Public IP address** on the instance page (e.g., `150.230.x.x`). Copy this down; this is `YOUR_ORACLE_PUBLIC_IP`.

---

## STEP 3 — Connect to the VM with SSH

**WHAT I AM DOING:** Logging securely into your new server from your Windows computer.
**WHY I AM DOING IT:** To install Docker and run your code, you must send text commands directly to the server.

1. Open **Windows PowerShell** on your computer.
2. Run this command, replacing `C:\path\to\your-key.key` with the exact path where you saved the key in Step 2, and `YOUR_ORACLE_PUBLIC_IP` with your actual server IP:
   ```powershell
   ssh -i "C:\path\to\your-key.key" ubuntu@YOUR_ORACLE_PUBLIC_IP
   ```
   *Note: Ensure you keep the quotation marks around the file path.*
3. If it asks `Are you sure you want to continue connecting (yes/no)?`, type `yes` and press Enter.

**EXPECTED RESULT:** The text prompt will change to `ubuntu@reachinbox-server:~$`. 
**WHAT TO DO IF IT FAILS:** 
- If you see `Permission denied`, double-check the path to your `.key` file. 
- If you see `Connection timed out`, wait 2 more minutes for the server to finish booting and try again.

---

## STEP 4 — Basic Linux Setup

**WHAT I AM DOING:** Updating the server's software.
**WHY I AM DOING IT:** To ensure security and compatibility before installing new tools.

1. Run the following command in your server terminal:
   ```bash
   sudo apt update && sudo apt upgrade -y
   ```
2. Wait for it to finish (it may take 1-3 minutes). If a pink screen pops up asking about restarting services, just press **Enter** to select "Ok".

---

## STEP 5 — Install Docker and Docker Compose

**WHAT I AM DOING:** Installing Docker.
**WHY I AM DOING IT:** Docker packages your app and its dependencies (PostgreSQL, Redis, Elasticsearch) into isolated "containers" so they run identically everywhere.

1. Run this command to install Docker:
   ```bash
   curl -fsSL https://get.docker.com -o get-docker.sh
   sudo sh get-docker.sh
   ```
2. Run this command to allow your user to run Docker without typing `sudo` every time:
   ```bash
   sudo usermod -aG docker $USER
   ```
3. Run this command to apply the new permissions immediately:
   ```bash
   newgrp docker
   ```
4. **Verify Docker:**
   ```bash
   docker --version
   ```
   *Expected output:* `Docker version 24.x.x...`
5. **Verify Docker Compose:**
   ```bash
   docker compose version
   ```
   *Expected output:* `Docker Compose version v2.x.x...`

---

## STEP 6 — Configure Oracle Firewall Rules

**WHAT I AM DOING:** Opening web ports (80 and 443) on Oracle's strict firewall.
**WHY I AM DOING IT:** Browsers need to connect to your server. We will NOT open database ports (5432, 6379, 9200) for security reasons.

1. Go back to your browser in the **Oracle Cloud Console** (on your instance's page).
2. Click the link next to **Virtual cloud network** (e.g., `vcn-xxxx`).
3. Under Resources on the left, click **Security Lists**.
4. Click the **Default Security List**.
5. Click **Add Ingress Rules**.
6. **Rule 1 (HTTP):**
   - Source CIDR: `0.0.0.0/0`
   - IP Protocol: TCP
   - Destination Port Range: `80`
7. Click **+ Additional Ingress Rule**.
8. **Rule 2 (HTTPS):**
   - Source CIDR: `0.0.0.0/0`
   - IP Protocol: TCP
   - Destination Port Range: `443`
9. Click **Add Ingress Rules**.

Next, we must open the firewall inside the Linux server itself:
10. Go back to your **PowerShell SSH window**.
11. Run these commands:
    ```bash
    sudo iptables -I INPUT 6 -m state --state NEW -p tcp --dport 80 -j ACCEPT
    sudo iptables -I INPUT 6 -m state --state NEW -p tcp --dport 443 -j ACCEPT
    sudo netfilter-persistent save
    ```

---

## STEP 7 — Clone the GitHub Repository

**WHAT I AM DOING:** Downloading your code from GitHub onto the Oracle VM.

1. In your SSH terminal, run:
   ```bash
   git clone https://github.com/YOUR_GITHUB_USERNAME/reachinbox-email-scheduler.git
   ```
   *Replace `YOUR_GITHUB_USERNAME` with your actual username. If it prompts for a password, you must use a GitHub Personal Access Token (classic) instead of your password.*
2. Enter the project folder:
   ```bash
   cd reachinbox-email-scheduler
   ```
3. Verify the files are there:
   ```bash
   ls
   ```
   *Expected output:* You should see `backend`, `docker-compose.prod.yml`, `nginx`, etc.

---

## STEP 8 — Create Production Environment Variables

**WHAT I AM DOING:** Creating the `.env` file that holds sensitive passwords.
**WHY I AM DOING IT:** Passwords are never stored on GitHub. We must create this file directly on the server.

1. Copy the example file:
   ```bash
   cp .env.example backend/.env
   ```
2. Open the file in the `nano` text editor:
   ```bash
   nano backend/.env
   ```
3. Fill in the following mandatory fields using your arrow keys to navigate:
   - `POSTGRES_PASSWORD`: Make up a secure password (e.g., `dbPass123!`).
   - `DATABASE_URL`: Edit it to match: `postgresql://reachinbox_user:dbPass123!@postgres:5432/reachinbox`
   - `SESSION_SECRET`: Type a long random string of letters and numbers (at least 32 characters).
   - `FRONTEND_URL`: Leave blank for now (we'll do this in Step 27).
   - `BACKEND_URL`: Leave blank for now.
   - `DEMO_ADMIN_EMAIL`: Type `admin@yourdomain.com`
   - `DEMO_ADMIN_PASSWORD`: Type a secure password (min 8 chars).
4. Save and exit: Press `Ctrl+O`, `Enter`, then `Ctrl+X`.

---

## STEP 9 — Start Infrastructure (Databases)

**WHAT I AM DOING:** Starting PostgreSQL, Redis, and Elasticsearch.
**WHY I AM DOING IT:** The API needs these databases running before it can start.

1. Run this command:
   ```bash
   docker compose -f docker-compose.prod.yml up -d postgres redis elasticsearch
   ```
2. Wait about 60 seconds for Elasticsearch to fully start.
3. Verify they are running:
   ```bash
   docker compose -f docker-compose.prod.yml ps
   ```
   *Expected result:* All three should say `Up (healthy)`.

---

## STEP 10 — Run Prisma Migrations

**WHAT I AM DOING:** Creating the database tables in PostgreSQL.

1. Run this command:
   ```bash
   docker compose -f docker-compose.prod.yml run --rm api npx prisma migrate deploy
   ```
   *What this does: It safely applies the database schema to the PostgreSQL container. Do NOT use `db push` in production.*
2. *Expected output:* `All migrations have been successfully applied.`

---

## STEP 11 — Start Backend API and Worker

**WHAT I AM DOING:** Starting your Node.js application and the BullMQ background worker.
**WHY I AM DOING IT:** The API serves web requests. The worker is a separate process that safely sends emails in the background without slowing down the API.

1. Run this command:
   ```bash
   docker compose -f docker-compose.prod.yml up -d --build api worker
   ```
   *This will take 2-4 minutes as Docker builds your ARM64 Node.js images.*
2. Verify they are running:
   ```bash
   docker compose -f docker-compose.prod.yml ps
   ```
   *Expected result:* `api` and `worker` should say `Up (healthy)` or `Up`.
3. Check worker logs:
   ```bash
   docker compose -f docker-compose.prod.yml logs worker
   ```
   *Expected result:* `[Worker] BullMQ Worker is running and listening for jobs`.

---

## STEP 12 — Configure DNS (Domain Name)

**WHAT I AM DOING:** Linking a human-readable domain to your Oracle server's IP.
**WHY I AM DOING IT:** We need a domain to get a free SSL (HTTPS) certificate.

1. Go to [DuckDNS](https://www.duckdns.org) (it is 100% free forever).
2. Sign in with Google/GitHub.
3. Under "sub domain", type a name (e.g., `my-reachinbox-api`) and click **add domain**.
4. In the "current ip" field, erase whatever is there and paste `YOUR_ORACLE_PUBLIC_IP`.
5. Click **update ip**.
6. Note down your full domain: e.g., `my-reachinbox-api.duckdns.org` (This is `YOUR_BACKEND_DOMAIN`).

---

## STEP 13 — Configure Nginx & Let's Encrypt (HTTPS)

**WHAT I AM DOING:** Setting up Nginx to route traffic to the API, and securing it with HTTPS.
**WHY I AM DOING IT:** Browsers block authentication cookies if the connection isn't secure (HTTPS).

1. Edit the Nginx config file:
   ```bash
   nano nginx/nginx.conf
   ```
2. Replace EVERY instance of `YOUR_DOMAIN_HERE` with your DuckDNS domain (e.g., `my-reachinbox-api.duckdns.org`). Save and exit (`Ctrl+O`, `Enter`, `Ctrl+X`).
3. Start Nginx:
   ```bash
   docker compose -f docker-compose.prod.yml up -d --build nginx
   ```
4. Install Certbot (the tool that gets free SSL certificates):
   ```bash
   sudo snap install --classic certbot
   sudo ln -s /snap/bin/certbot /usr/bin/certbot
   sudo mkdir -p /var/www/certbot
   ```
5. Get the SSL certificate:
   ```bash
   sudo certbot certonly --webroot -w /var/www/certbot -d YOUR_BACKEND_DOMAIN
   ```
   *(It will ask for your email and to agree to Terms. Enter them).*
6. *Expected output:* `Successfully received certificate.`
7. Restart Nginx so it uses the new certificate:
   ```bash
   docker compose -f docker-compose.prod.yml restart nginx
   ```

---

## STEP 14 — Configure Google OAuth

**WHAT I AM DOING:** Allowing users to log in with Google.

1. Go to the [Google Cloud Console](https://console.cloud.google.com).
2. Create a new Project.
3. Go to **APIs & Services** > **Credentials**.
4. Click **+ Create Credentials** > **OAuth client ID**.
5. Set Application type to **Web application**.
6. **Authorized redirect URIs**: Add exactly `https://YOUR_BACKEND_DOMAIN/auth/google/callback`
7. Click **Create**. Copy the **Client ID** and **Client Secret**.
8. Go back to your SSH terminal:
   ```bash
   nano backend/.env
   ```
9. Fill in `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`.
10. Fill in `GOOGLE_CALLBACK_URL` with exactly `https://YOUR_BACKEND_DOMAIN/auth/google/callback`

---

## STEP 15 — Configure Slack OAuth

**WHAT I AM DOING:** Allowing the app to send rate-limit notifications to Slack.

1. Go to [Slack API](https://api.slack.com/apps).
2. Click **Create New App** > **From scratch**.
3. Go to **OAuth & Permissions**.
4. Scroll to **Redirect URLs**, click **Add New Redirect URL**, and enter `https://YOUR_BACKEND_DOMAIN/api/slack/callback`. Click Save.
5. Under **Scopes** > **Bot Token Scopes**, add `chat:write` and `chat:write.public`.
6. Go to **Basic Information** > **App Credentials**. Copy the Client ID and Client Secret.
7. Open `backend/.env` on your server and fill in `SLACK_CLIENT_ID`, `SLACK_CLIENT_SECRET`, and `SLACK_REDIRECT_URI`.

---

## STEP 16 — Configure Ethereal SMTP

**WHAT I AM DOING:** Setting up a free test email provider so we don't accidentally spam real people during testing.

1. Go to [Ethereal Email](https://ethereal.email) and click **Create Ethereal Account**.
2. Copy the credentials shown on the screen.
3. Open `backend/.env` on your server and fill in:
   - `ETHEREAL_HOST=smtp.ethereal.email`
   - `ETHEREAL_PORT=587`
   - `ETHEREAL_USER=username@ethereal.email`
   - `ETHEREAL_PASSWORD=password`
   - `ETHEREAL_FROM=username@ethereal.email`

---

## STEP 17 — Deploy Frontend to Vercel

**WHAT I AM DOING:** Hosting the React website.
**WHY I AM DOING IT:** Vercel is free, lightning-fast, and automatically gives you HTTPS.

1. Go to [Vercel](https://vercel.com) and sign in with GitHub.
2. Click **Add New...** > **Project**.
3. Import your `reachinbox-email-scheduler` GitHub repository.
4. **Root Directory:** Click Edit and select the `frontend` folder.
5. **Framework Preset:** Leave as Vite.
6. **Environment Variables:** Add `VITE_API_URL` with the value `https://YOUR_BACKEND_DOMAIN` (no trailing slash).
7. Click **Deploy**.
8. Note down the domain it gives you (e.g., `https://reachinbox-xxxx.vercel.app`). This is `YOUR_FRONTEND_DOMAIN`.

---

## STEP 18 — Connect Frontend to Backend (CORS)

**WHAT I AM DOING:** Telling your backend to trust requests coming from your new Vercel website.

1. In your SSH terminal:
   ```bash
   nano backend/.env
   ```
2. Set `FRONTEND_URL=https://YOUR_FRONTEND_DOMAIN` (No trailing slash).
3. Set `BACKEND_URL=https://YOUR_BACKEND_DOMAIN`
4. Save the file.
5. Restart the API to apply the changes:
   ```bash
   docker compose -f docker-compose.prod.yml restart api worker
   ```
6. **Go to Google Cloud Console** (from Step 14) > Credentials > Edit your OAuth Client. Under **Authorized JavaScript origins**, add `https://YOUR_FRONTEND_DOMAIN`.

---

## STEP 19 — Create Demo Admin

**WHAT I AM DOING:** Creating the master account that has access to the Bull Board queue visualization.

1. In your SSH terminal, run this exact script:
   ```bash
   docker compose -f docker-compose.prod.yml exec api npm run seed:demo
   ```
   *This uses the email and password you set in Step 8 to create a user in the database with `isPlatformAdmin: true`.*
2. *Expected output:* `✅ Success: Created new Demo Platform Admin account...`

---

## STEP 20 — Complete Functional Testing

Let's test the entire assignment to ensure everything works flawlessly.

1. **Registration:** Open your Vercel URL. Click "Sign up". Enter an email and password. *Should log you in immediately.*
2. **Logout:** Click Logout in the sidebar. *Should return to login screen.*
3. **Google Login:** Click "Continue with Google". *Should authorize via Google and redirect back to the Dashboard.*
4. **Sender Creation:** Go to Senders > Add Sender. Use your Ethereal credentials. *Should appear as Active.*
5. **Compose & Schedule:** Go to Compose. Enter a subject, select the sender, add recipients, and set a scheduled time 2 minutes in the future. Click Schedule.
6. **BullMQ Delayed Job:** The email will appear in `/scheduled`. 
7. **Worker Execution:** Wait 2 minutes. The email should disappear from Scheduled and move to Sent.
8. **Ethereal Delivery:** Go to ethereal.email > Messages. *You should see the email actually arrived there.*
9. **Email Details:** Click the sent email in your dashboard. *Should open the email view.*
10. **Elasticsearch Indexing/Search:** Go to Dashboard. Type the subject in the search bar. *It should filter instantly. If it works, Elasticsearch is functioning.*
11. **Slack Connection:** Go to Settings. Click "Connect Slack". *Should redirect to Slack, authorize, and return you to settings with a green "Connected" badge.*
12. **Rate Limiting:** Create a campaign with 3 recipients. Set "Hourly Limit" to 1. 
13. **Idempotency:** *The worker will send 1 email and leave the other 2 delayed.*
14. **Slack Notification:** Check your Slack workspace. *You should see a message saying "Rate limit reached for sender..."*
15. **Tenant Isolation:** Log out. Log in with the Demo Admin account. *You should NOT see the senders or emails you created on the other account.*
16. **Bull Board:** While logged in as Demo Admin, go to Settings. Click "Queue Dashboard". *You should see the Bull Board UI showing completed and delayed jobs.*
17. **Normal User Block:** Log back into your normal account and try going to `https://YOUR_BACKEND_DOMAIN/admin/queues`. *You should see 403 Forbidden.*

---

## STEP 21 — Troubleshooting

**Oracle VM unavailable / Connection timed out:**
- Your Oracle VM might have shut down. Go to Oracle Cloud > Compute > Instances and ensure it is "Running".

**Docker Compose error `command not found`:**
- Run `sudo apt install docker-compose-plugin`.

**API won't start / 502 Bad Gateway:**
- Check logs: `docker compose -f docker-compose.prod.yml logs api`
- If it says "Database connection failed", verify `DATABASE_URL` in `.env` is exactly `postgresql://USER:PASS@postgres:5432/reachinbox`.

**Google OAuth fails with "redirect_uri_mismatch":**
- Ensure `GOOGLE_CALLBACK_URL` in `.env` EXACTLY matches the URL in Google Cloud Console. HTTPS is mandatory.

**CORS Error / Cookie Session Error:**
- Ensure `FRONTEND_URL` in `.env` exactly matches your Vercel URL (NO trailing slash, must be `https://`).
- Ensure you restarted the API: `docker compose -f docker-compose.prod.yml restart api`.

**Scheduled Email Never Sends:**
- Check worker logs: `docker compose -f docker-compose.prod.yml logs worker`
- If you see "connect ECONNREFUSED", ensure Redis is running: `docker compose -f docker-compose.prod.yml ps redis`.

**Elasticsearch Search Returns Nothing / Fails to Start:**
- Oracle VMs have 24GB RAM, but if ES crashes, check logs: `docker compose -f docker-compose.prod.yml logs elasticsearch`
- Run the manual re-index script to push existing database emails to ES:
  ```bash
  docker compose -f docker-compose.prod.yml exec api npx tsx src/scripts/reindexElasticsearch.ts
  ```

---

## STEP 22 — Backups

You are self-hosting PostgreSQL, so you are responsible for data backups.

**To manually backup:**
Run this in your SSH terminal:
```bash
docker compose -f docker-compose.prod.yml exec postgres pg_dump -U reachinbox_user reachinbox > backup-$(date +%Y%m%d).sql
```
This creates a `.sql` file in your folder.

**To restore:**
```bash
docker compose -f docker-compose.prod.yml exec -T postgres psql -U reachinbox_user reachinbox < backup-20261105.sql
```

---

## STEP 23 — Updating the application

When you push new code to GitHub, follow this to update the server:

1. SSH into your VM.
2. Go to the project directory: `cd reachinbox-email-scheduler`
3. Pull the latest code: `git pull`
4. Rebuild the containers: `docker compose -f docker-compose.prod.yml up -d --build api worker`
5. (If you changed the database schema): `docker compose -f docker-compose.prod.yml exec api npx prisma migrate deploy`

*(Vercel updates the frontend automatically when you push to GitHub).*

---

## FINAL ZERO-COST VERIFICATION

- **Oracle Cloud VM (Compute):** Always Free tier (4 OCPUs, 24GB RAM). Never charges.
- **Docker/Nginx/PostgreSQL/Redis/Elasticsearch:** Open source and running on the free VM. $0.
- **Vercel:** Hobby tier. Free for non-commercial use.
- **DuckDNS:** External free service. $0 forever.
- **Let's Encrypt SSL:** Open source certificate authority. $0 forever.
- **Google OAuth / Slack API:** Generous free tiers that this project will never exceed. $0.
- **Ethereal SMTP:** Test-only free service. $0 forever.

No temporary trials were used. The total deployment cost is strictly $0.

---

## FINAL CHECKLIST

- [ ] GitHub repository ready
- [ ] Oracle VM created
- [ ] Oracle VM is Always Free
- [ ] SSH works
- [ ] Docker installed
- [ ] Docker Compose works
- [ ] Firewall configured
- [ ] Repository cloned
- [ ] Production .env created
- [ ] PostgreSQL running
- [ ] Redis running
- [ ] Elasticsearch running
- [ ] Prisma migration completed
- [ ] Demo Admin created
- [ ] API running
- [ ] Worker running
- [ ] BullMQ working
- [ ] DNS configured
- [ ] Nginx configured
- [ ] HTTPS working
- [ ] Google OAuth working
- [ ] Slack OAuth working
- [ ] Ethereal SMTP working
- [ ] Frontend deployed to Vercel
- [ ] VITE_API_URL configured
- [ ] CORS configured
- [ ] Login working
- [ ] Registration working
- [ ] Sender working
- [ ] Compose working
- [ ] Scheduling working
- [ ] Worker sends emails
- [ ] Sent emails working
- [ ] Scheduled emails working
- [ ] Email details working
- [ ] Elasticsearch indexing working
- [ ] Elasticsearch search working
- [ ] Slack notifications working
- [ ] Rate limiting working
- [ ] Idempotency working
- [ ] Tenant isolation verified
- [ ] Demo Admin verified
- [ ] Bull Board verified
- [ ] HTTPS verified
- [ ] No secrets committed
- [ ] No paid service required
- [ ] Total deployment cost = $0
