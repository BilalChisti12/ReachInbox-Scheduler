import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import session from 'express-session';
import passport from 'passport';
import authRoutes from './routes/auth';
import senderRoutes from './routes/senders';
import campaignRoutes from './routes/campaigns';
import emailRoutes from './routes/emails';
import slackRoutes from './routes/slack';
import { requireAuth } from './middleware/requireAuth';
import { requirePlatformAdmin } from './middleware/requirePlatformAdmin';
import { createBullBoard } from '@bull-board/api';
import { BullMQAdapter } from '@bull-board/api/bullMQAdapter';
import { ExpressAdapter } from '@bull-board/express';
import { emailQueue, redisConnection } from './config/queue';
import { RedisStore } from 'connect-redis';

const app = express();

// Trust Nginx reverse proxy — required so express-session sets secure cookies correctly
// behind a proxy (the proxy terminates HTTPS, Express sees HTTP internally)
if (process.env.NODE_ENV === 'production') {
  app.set('trust proxy', 1);
}

// Set up Bull Board
const serverAdapter = new ExpressAdapter();
serverAdapter.setBasePath('/admin/queues');

createBullBoard({
  queues: [new BullMQAdapter(emailQueue)],
  serverAdapter: serverAdapter,
});

// CORS — allow configured frontend origin(s)
// In production: FRONTEND_URL=https://your-app.vercel.app
// Supports comma-separated origins for multiple Vercel preview URLs
const allowedOrigins = (process.env.FRONTEND_URL || 'http://localhost:5173')
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean);

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (e.g. server-to-server, curl, mobile apps)
      if (!origin) return callback(null, true);
      if (allowedOrigins.includes(origin)) return callback(null, true);
      callback(new Error(`CORS: origin '${origin}' not allowed`));
    },
    credentials: true, // Required to send/receive session cookies cross-origin
  })
);

app.use(helmet());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Session configuration
// Production: cookies must be secure=true and sameSite='none' because
// the frontend (Vercel, HTTPS) and backend (Oracle, HTTPS) are on different domains.
const isProduction = process.env.NODE_ENV === 'production';

app.use(
  session({
    store: new RedisStore({ client: redisConnection, prefix: 'reachinbox:sess:' }),
    secret: process.env.SESSION_SECRET || 'change-this-in-production',
    resave: false,
    saveUninitialized: false,
    name: 'reachinbox.sid',
    cookie: {
      secure: isProduction,
      httpOnly: true,
      sameSite: isProduction ? 'none' : 'lax',
      maxAge: 1000 * 60 * 60 * 24 * 7, // 7 days
    },
  })
);

// Initialize Passport
app.use(passport.initialize());
app.use(passport.session());

// Routes
app.use('/auth', authRoutes);
app.use('/api/senders', requireAuth, senderRoutes);
app.use('/api/campaigns', requireAuth, campaignRoutes);
app.use('/api/emails', requireAuth, emailRoutes);
app.use('/api/slack', slackRoutes);
app.use('/admin/queues', requirePlatformAdmin, serverAdapter.getRouter());

// Health check — used by Docker health checks and monitoring
app.get('/health', (req: express.Request, res: express.Response) => {
  res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Protected test route — verifies middleware works
app.get('/api/protected-test', requireAuth, (req: express.Request, res: express.Response) => {
  res.json({
    success: true,
    message: 'You have accessed a protected resource successfully.',
    tenantId: req.user!.id,
    userEmail: req.user!.email,
  });
});

export default app;
