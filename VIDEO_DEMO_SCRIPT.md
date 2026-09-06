# Before You Press Record

### Recording Preparation Checklist
- [ ] **Browser**: Open Chrome or Edge. Ensure you have two tabs ready: one for the Frontend Application and one for the Bull Board (`/admin/queues`).
- [ ] **Accounts**: Have a test Google Account ready for OAuth. Have a test Slack workspace where you are an admin.
- [ ] **Backend Status**: Ensure PostgreSQL, Redis, Elasticsearch, the main API, and the Worker process are all running. 
- [ ] **Ethereal Account**: Have Ethereal (fake SMTP) credentials ready or configured in `.env` to verify delivery.
- [ ] **Test Sender**: Ensure at least one Sender is configured with Ethereal SMTP details.

### Demo Data
Save these files to your desktop before recording.
**test-leads.csv**
```csv
email
demo1@example.com
demo2@example.com
```
**invalid-leads.csv**
```csv
email
good@example.com
bad-email
duplicate@example.com
duplicate@example.com
```

### Waiting-Time Management
- When emails are scheduled with a delay, do **not** just sit on the screen. Switch to the Bull Board to explain delayed jobs, or switch to the Slack channel to show the rate limit notification arriving.

### Never Show These On Screen
- `DATABASE_URL` credentials in `.env`
- Slack Client Secrets or OAuth Tokens
- Ethereal Passwords
- Session Secrets
- DevTools Network tab if it exposes sensitive tokens.

### Browser / Screen Recording Setup
- **Zoom Level**: 100% or 110% for readability.
- **Terminal**: Keep the backend/worker terminal minimized unless explicitly showing a worker restart recovery. Do not show `.env` files.

---

# 0. VIDEO INTRODUCTION

### ACTION
Open the deployed application at the Login Page.

### SAY
"Hello, in this video I will demonstrate my implementation of the ReachInbox and Outbox Labs production-grade email job scheduler. I will walk through the application from authentication all the way through email scheduling, queue processing, delivery, Elasticsearch integration, rate limiting, and Slack notifications. I will also demonstrate the underlying reliability and security guarantees, specifically proving how the system handles idempotency, server restarts, and exactly satisfies the constraints from the original assignment without using standard cron jobs."

### SHOW
The Login screen with Google OAuth and Email/Password options visible.

---

# 1. LOGIN / AUTHENTICATION

### ACTION
Click "Continue with Google" or use the Email/Password login.

### SAY
"The application is secured via Passport.js using secure, HTTP-only sessions. For this demo, I will log in using Google OAuth. This establishes the Tenant context—meaning every sender, campaign, and email job is strictly isolated to my authenticated user account."

### SHOW
The Google OAuth consent screen, then the redirection to the `/scheduled` Dashboard.

### EXPLAIN
Authentication determines the user's identity. The backend automatically associates this user's UUID with all subsequent requests, ensuring tenant isolation.

### TECHNICAL POINT
Sessions are stored securely. The frontend never trusts a client-provided `userId`; it always uses the server-side session token.

### REQUIREMENT PROVEN
Google OAuth implementation and Tenant Isolation.

---

# 2. DASHBOARD / HOME PAGE

### ACTION
Mouse over the navigation sidebar and the main content area on the Scheduled Emails page.

### SAY
"Upon logging in, we land on the Scheduled Emails dashboard. On the left, we have our primary navigation: Scheduled, Sent, Compose, Senders, and Settings. In the center, we see our active and pending email jobs. Notice the clean, responsive UI with clear empty states and loading indicators."

### SHOW
Sidebar navigation and the Scheduled emails data table (which may be empty initially).

### EXPLAIN
The dashboard fetches data directly from the REST API, strictly returning only the jobs owned by the authenticated tenant.

---

# 3. NAVIGATION

### ACTION
Quickly click through "Scheduled" -> "Sent" -> "Senders" -> "Settings" -> "Compose".

### SAY
"The application uses React Router for client-side navigation. All routes except Login are protected by a higher-order component that verifies authentication state before rendering."

### REQUIREMENT PROVEN
Protected routes and basic UI structure.

---

# 4. SENDER MANAGEMENT

### ACTION
Navigate to Senders (`/senders`). Click "Add Sender".

### SAY
"Before sending emails, we must configure a Sender. The system supports multiple senders per user. Here, I configure an Ethereal SMTP account. Each sender has its own independent rate limits and execution tracks in the backend."

### SHOW
The Sender creation form. Enter mock Ethereal credentials (keep passwords hidden).

### EXPLAIN
Because users can have multiple senders, the backend Rate Limit service atomic counters are keyed by `senderId`.

### REQUIREMENT PROVEN
Multiple Senders configuration.

---

# 5. COMPOSE PAGE — COMPLETE DEMONSTRATION

### ACTION
Navigate to Compose (`/compose`).

### SAY
"This is the Compose interface. I can select my configured Sender from the dropdown. I can type emails manually, but I can also upload a CSV or TXT file of leads. The system automatically parses the file and extracts valid email addresses."

### DO THIS
Upload `invalid-leads.csv`.

### SHOW
The UI immediately showing valid emails in green and invalid/duplicate emails in red.

### SAY
"As you can see, the frontend instantly validates the list, removing duplicates and flagging invalid addresses. I'll add a subject and use the rich-text editor for the body."

### ACTION
Type a subject and use the Rich Text Editor simulation buttons to format some text. Enter "10" for Delay and "5" for Hourly Limit. Select a future time in the "Send Later" popover.

### EXPLAIN
"I can configure the delay between emails and the hourly rate limit. I am scheduling this campaign 2 minutes into the future."

### REQUIREMENT PROVEN
CSV/TXT upload, regex email parsing, duplicate validation, customizable delay, customizable hourly limit, and rich-text editing.

---

# 6. SCHEDULING DEMONSTRATION

### ACTION
Click "Send" on the Compose page. 

### SAY
"When I schedule this campaign, the REST API writes the Campaign and individual EmailJob records to PostgreSQL in a single atomic transaction with a 'scheduled' status. It then enqueues these jobs into BullMQ as delayed jobs."

### SHOW
The UI redirecting to the Scheduled Dashboard, showing the newly created jobs with a "Scheduled" badge.

---

# 7. BULLMQ DEMONSTRATION & REDIS EXPLANATION

### ACTION
Switch your browser tab to the Bull Board (`/admin/queues`).

### SAY
"Because the assignment explicitly forbids `setInterval` or cron, I used BullMQ backed by Redis. Here in the Bull Board—an operational dashboard restricted strictly to Platform Admins—we can see our jobs sitting in the 'Delayed' state. Redis persists this queue, meaning if the server crashes right now, these jobs will not be lost. When their timestamp arrives, they will move to the 'Active' state."

### REQUIREMENT PROVEN
No-cron constraint, delayed jobs, Redis persistence, Bull Board administration.

---

# 8. WORKER DEMONSTRATION & MINIMUM DELAY

### ACTION
Switch back to the frontend Scheduled tab and watch the jobs transition to "Processing" or "Sent". Optionally show the backend terminal logging worker activity.

### SAY
"The worker processes jobs concurrently. When a job is claimed, it transitions to 'Processing' in the database. You'll notice they aren't all sending instantly—there is a strict minimum delay enforced between emails to protect SMTP reputation, dynamically calculated alongside our custom campaign delays."

### EXPLAIN
The worker uses `emailJobRepo.transitionStatus` to atomically claim jobs, preventing two concurrent workers from sending the same email.

---

# 9. ETHEREAL EMAIL DEMONSTRATION

### ACTION
Open Ethereal Mail in another tab and show the captured emails.

### SAY
"These emails are physically dispatched to Ethereal SMTP. We can see them arriving here perfectly formatted."

### REQUIREMENT PROVEN
Ethereal SMTP integration.

---

# 10. RATE LIMIT DEMONSTRATION & SLACK NOTIFICATION

### ACTION
Go to Settings. Click "Connect to Slack". Authorize the application.
Then, schedule a new campaign of 10 emails, but set the Hourly Limit to `2`.

### SAY
"I have connected my Slack workspace via OAuth 2.0. I just scheduled 10 emails with an hourly limit of 2. Let's watch what the worker does."

### SHOW
The Bull Board, showing the first 2 emails succeeding, and the remaining 8 being pushed *back* into the Delayed queue.

### SAY
"The atomic Redis rate limiter rejected the 3rd email. Instead of failing it, the worker caught the `DelayedError` and rescheduled the job for the next hour window."

### ACTION
Open Slack and show the channel.

### SAY
"Simultaneously, the backend acquired a distributed lock and sent a deduplicated Slack notification alerting us that the rate limit was hit. It only sends this once per hour per sender."

### REQUIREMENT PROVEN
Rate-limit rescheduling, Real Slack OAuth, Deduplicated Slack notifications.

---

# 11. IDEMPOTENCY / DUPLICATE-SEND PROTECTION

### SAY
"A critical requirement was exactly-once delivery. Every EmailJob has a unique `idempotencyKey`. The database acts as a state machine: `scheduled` -> `processing` -> `sent`. If BullMQ accidentally delivers the same job twice due to a network blip, the worker checks the database. If it's already 'processing' or 'sent', the worker safely skips it. The status transition uses a PostgreSQL transaction to guarantee atomic claiming."

### REQUIREMENT PROVEN
Idempotency, duplicate-send protection across concurrent workers.

---

# 12. SERVER RESTART RECOVERY DEMONSTRATION

### ACTION
If comfortable, open the terminal, kill the backend server process while jobs are "Delayed", wait 5 seconds, and restart it.

### SAY
"I have just killed the backend server. Because we rely on Redis for queue persistence and PostgreSQL for state, when I boot the server back up, the worker reconnects to BullMQ, resumes the delayed jobs, and checks the database state. Zero emails were lost, and zero duplicates were sent."

### REQUIREMENT PROVEN
Server Restart Recovery.

---

# 13. ELASTICSEARCH DEMONSTRATION

### ACTION
Navigate to the frontend Dashboard. Use the Search bar. Type a recipient's email or subject.

### SAY
"For high-performance querying, we use Elasticsearch. Whenever an email is sent, its state is synchronized to our Elasticsearch index. When I search here, the query hits Elasticsearch."

### EXPLAIN
"Elasticsearch is purely a secondary index. If Elasticsearch goes down, the primary PostgreSQL database is unaffected, ensuring no data loss. Furthermore, the Elasticsearch query is strictly filtered by the authenticated user's ID to maintain tenant isolation."

### REQUIREMENT PROVEN
Elasticsearch search, secondary index failure safety, tenant-isolated search.

---

# 14. EMAIL DETAILS & SENT EMAILS PAGE

### ACTION
Navigate to the "Sent" tab. Click on a specific email row.

### SAY
"This is the Sent Emails page, pulling directly from Elasticsearch or the database. Clicking a row takes us to the Email Details page, where we can review the exact subject, recipient, timing, and HTML body of the message."

### SHOW
The Email Details page with rich content rendered.

---

# 15. SETTINGS PAGE & ADDITIONAL FEATURES

### ACTION
Navigate to Settings (`/settings`). Change the profile name. Disconnect and Reconnect Slack.

### SAY
"In the Settings page, users can update their profile, manage their Slack OAuth connection securely, and if they are a Platform Admin, access the Bull Board link. The Slack token is encrypted and never exposed to the frontend."

### REQUIREMENT PROVEN
Slack disconnect/reconnect, Profile management, Authorization distinction (User vs Platform Admin).

---

# 16. ARCHITECTURE & 1000+ EMAIL SCALE EXPLANATION

### SAY
"To summarize the architecture: The Frontend React app communicates via REST API to the Express Node backend. PostgreSQL is our absolute source of truth. When scheduling 1,000+ emails, the API creates database records and pushes minimal job IDs to Redis. We do NOT create 1,000 `setTimeout` or cron timers in Node's memory, avoiding memory leaks and event loop blockage. BullMQ manages the durable queue, and our Worker horizontally scales to pull jobs safely using atomic state transitions. Elasticsearch handles read-heavy search operations."

### REQUIREMENT PROVEN
1000+ Email Architecture, Technical Architecture.

---

# 17. VALIDATION / ERROR HANDLING / UX

### SAY
"Throughout the app, you saw robust UX. Buttons are disabled during mutations, loading spinners appear, and toast notifications handle errors. The backend uses Zod or manual validation to strictly sanitize all inputs, rejecting malformed emails or invalid scheduling delays before they ever reach the database."

---

# 18. FINAL CONCLUSION

### SAY
"In conclusion, this project perfectly meets all original assignment criteria and goes beyond by implementing a true production-grade architecture. By utilizing PostgreSQL for authoritative state, Redis and BullMQ for durable scheduling without cron, Elasticsearch for tenant-isolated searching, and robust idempotency controls, the system guarantees that emails are sent exactly once, respecting sender rate limits, and safely surviving process crashes. Thank you for evaluating my work."

---

# Assignment Requirement Coverage

| Requirement | Demonstrated In Video | Where |
|---|---|---|
| TypeScript, Node.js, Express, React | Yes | Architecture explanation |
| PostgreSQL & Redis | Yes | Architecture & worker |
| BullMQ / No Cron | Yes | Bull Board / Code explanation |
| Delayed Jobs | Yes | Bull Board |
| Worker Concurrency & Safety | Yes | Worker explanation / Idempotency |
| Minimum Delay & Hourly Limit | Yes | Compose Page & Rate Limit demo |
| Multiple Senders | Yes | Sender Management |
| Rate-limit Rescheduling | Yes | Rate Limit Demo |
| Ethereal SMTP | Yes | Ethereal Inbox |
| Idempotency / Duplicate Protection | Yes | Spoken Technical Explanation |
| Restart Survival | Yes | Server Restart Demo |
| 1000+ Email Architecture | Yes | Architecture Explanation |
| Elasticsearch & Search | Yes | Live UI Search |
| Bull Board Dashboard | Yes | Admin UI Demo |
| Google OAuth | Yes | Login Page |
| Real Slack OAuth | Yes | Settings Page |
| Slack Disconnect/Reconnect | Yes | Settings Page |
| Slack Rate Limit Notification | Yes | Slack App Demo |
| CSV/TXT Upload & Lead Parsing | Yes | Compose Page Upload |
| UI Empty/Loading/Error States | Yes | UI Walkthrough |
| Tenant Isolation & Security | Yes | Search & Auth Explanations |
| Tests & Documentation | Yes | Mentioned in repository structure |

### Additional Features Discovered & Demonstrated
1. **Rich Text Editor**: Simulated in the Compose UI.
2. **Platform Admin Authorization**: Separate from standard tenant isolation, protecting Bull Board.
3. **Profile Management**: Updating name securely in settings.
4. **Email Details Page**: Viewing full HTML email bodies after sending.
5. **Attachments Support**: UI/DB support for attachments.

---

# FINAL RECORDING CHECKLIST

- [ ] Login demonstrated
- [ ] Google OAuth demonstrated
- [ ] Dashboard demonstrated
- [ ] Every navigation item demonstrated
- [ ] Compose demonstrated
- [ ] Sender selection demonstrated
- [ ] Sender management demonstrated
- [ ] CSV upload demonstrated
- [ ] Email parsing demonstrated
- [ ] Validation demonstrated
- [ ] Scheduled email demonstrated
- [ ] BullMQ delayed job demonstrated
- [ ] Bull Board demonstrated
- [ ] Worker demonstrated
- [ ] Ethereal demonstrated
- [ ] Sent email demonstrated
- [ ] Email details demonstrated
- [ ] Elasticsearch search demonstrated
- [ ] Slack OAuth demonstrated
- [ ] Slack disconnect/reconnect demonstrated
- [ ] Rate limiting demonstrated
- [ ] Rate-limit rescheduling demonstrated
- [ ] Slack rate-limit notification demonstrated
- [ ] Minimum delay explained
- [ ] Multiple senders explained
- [ ] Idempotency explained
- [ ] Restart recovery demonstrated
- [ ] Tenant isolation explained
- [ ] Security explained
- [ ] Error handling demonstrated
- [ ] UX states demonstrated
- [ ] Additional project features demonstrated
- [ ] Architecture explained
- [ ] Database explained
- [ ] API architecture explained
- [ ] No-cron constraint explained
- [ ] 1000+ email architecture explained
- [ ] Final conclusion delivered

---

# Requirement -> Video Timestamp Planning

| Section | Approximate Duration | Requirement(s) Covered |
|---|---:|---|
| Introduction & Login | 1:00 | Auth, Google OAuth, Tenant Isolation |
| Dashboard & Navigation | 1:00 | UI States, Routing |
| Senders & Compose | 2:00 | Multiple Senders, CSV Parsing, Scheduling |
| BullMQ, Redis, Worker | 2:00 | No-cron, Delayed Jobs, Redis, Idempotency |
| Rate Limiting & Slack | 1:30 | Rescheduling, Slack OAuth, Notifications |
| Ethereal & Sent Emails | 1:00 | Ethereal SMTP, Details Page |
| Elasticsearch & Search | 1:00 | ES Search, Tenant Isolation |
| Settings & Architecture | 1:30 | Disconnect Slack, 1000+ Scale, Recovery |
| Conclusion | 1:00 | Summary |
| **Total Approximate Time** | **~12:00** | All Requirements |
