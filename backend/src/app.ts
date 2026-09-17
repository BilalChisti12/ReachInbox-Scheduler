import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import session from 'express-session';
import { RedisStore } from 'connect-redis';
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
import { emailQueue } from './config/queue';
import redis from './config/redis';

const app = express();

// Trust proxy — required for secure cookies behind Render/Nginx reverse proxy.
// Render terminates HTTPS at its load balancer, Express sees HTTP internally.
// Without this, express-session refuses to set secure cookies.
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
  .map((o) => o.trim().replace(/\/$/, ''))
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
// the frontend (Vercel, HTTPS) and backend (Render, HTTPS) are on different domains.
const isProduction = process.env.NODE_ENV === 'production';

// In production, use Redis as the session store so sessions survive server restarts.
// In development, the default MemoryStore is used (no Redis required for local dev without Docker).
const sessionConfig: session.SessionOptions = {
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
};

if (isProduction) {
  // connect-redis v7+ expects a Node-Redis v4 style client where set() takes an options object.
  // ioredis does not support this natively and stringifies it to "[object Object]", causing an ERR syntax error.
  // We wrap the ioredis client in a Proxy to translate the arguments.
  const redisSessionClient = new Proxy(redis, {
    get(target: any, prop: string) {
      if (prop === 'set') {
        return async (key: string, val: string, options?: any) => {
          if (options && options.expiration && options.expiration.type === 'EX') {
            return target.set(key, val, 'EX', options.expiration.value);
          }
          return target.set(key, val);
        };
      }
      if (prop === 'mGet') {
        return (keys: string[]) => target.mget(keys);
      }
      const value = target[prop];
      return typeof value === 'function' ? value.bind(target) : value;
    }
  });

  sessionConfig.store = new RedisStore({
    client: redisSessionClient,
    prefix: 'reachinbox:sess:',
  });
  console.log('Session store: Redis');
} else {
  console.log('Session store: MemoryStore (development only)');
}

app.use(session(sessionConfig));

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

// Health check — used by monitoring platforms
app.get('/health', (req: express.Request, res: express.Response) => {
  res.status(200).json({ status: 'ok', timestamp: new Date().toISOString(), frontendUrl: process.env.FRONTEND_URL });
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

// Global Error Handler
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Unhandled Error:', err);
  res.status(err.status || 500).json({
    error: 'Internal Server Error',
    message: err.message,
    stack: process.env.NODE_ENV === 'development' ? err.stack : undefined,
    details: err,
  });
});

export default app;
