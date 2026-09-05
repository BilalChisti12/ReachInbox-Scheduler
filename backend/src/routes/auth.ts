import { Router, Request, Response } from 'express';
import { getEnvArray } from '../config/env';
import passport from '../config/passport';
import bcrypt from 'bcryptjs';
import { UserRepository } from '../repositories/UserRepository';
import { requireAuth } from '../middleware/requireAuth';

const router = Router();
const userRepository = new UserRepository();

// Initiate Google OAuth flow
router.get(
  '/google',
  passport.authenticate('google', { scope: ['profile', 'email'] })
);

// Google OAuth callback
router.get(
  '/google/callback',
  (req, res, next) => {
    // Determine the frontend URL (taking the first if it's a comma-separated list)
    const frontendUrls = getEnvArray('FRONTEND_URL', 'http://localhost:5173');
    const frontendUrl = frontendUrls[0].trim();
    
    passport.authenticate('google', { failureRedirect: `${frontendUrl}/login?error=oauth_failed` })(req, res, next);
  },
  (req: Request, res: Response) => {
    // On successful login, redirect to frontend scheduled inbox
    const frontendUrls = getEnvArray('FRONTEND_URL', 'http://localhost:5173');
    const frontendUrl = frontendUrls[0].trim();
    res.redirect(`${frontendUrl}/scheduled`);
  }
);

// Get current authenticated user session data
router.get('/me', (req: Request, res: Response) => {
  if (req.isAuthenticated() && req.user) {
    const { passwordHash: _, ...safeUser } = req.user as any;
    res.json({
      authenticated: true,
      user: safeUser,
    });
  } else {
    res.status(401).json({
      authenticated: false,
      user: null,
    });
  }
});

// Logout endpoint
router.post('/logout', (req: Request, res: Response, next) => {
  req.logout((err) => {
    if (err) {
      return next(err);
    }
    req.session.destroy(() => {
      res.clearCookie('reachinbox.sid'); // Must match the name set in app.ts
      res.json({ success: true, message: 'Logged out successfully' });
    });
  });
});

// Email/Password Login
router.post('/login', async (req: Request, res: Response, next) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const user = await userRepository.findByEmail(email);
    if (!user || !user.passwordHash) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const isValid = await bcrypt.compare(password, user.passwordHash);
    if (!isValid) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    req.login(user, (err) => {
      if (err) return next(err);
      const { passwordHash: _, ...safeUser } = user as any;
      return res.json({ success: true, user: safeUser });
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Email/Password Registration
router.post('/register', async (req: Request, res: Response, next) => {
  try {
    const { email, password, name } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const existingUser = await userRepository.findByEmail(email);
    if (existingUser) {
      // Don't leak that the account exists if security is strict, but typical registration warns about it.
      return res.status(409).json({ error: 'Account with this email already exists' });
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    const user = await userRepository.createUserWithPassword({
      email,
      passwordHash,
      name,
    });

    // Automatically log them in
    req.login(user, (err) => {
      if (err) return next(err);
      const { passwordHash: _, ...safeUser } = user as any;
      return res.status(201).json({ success: true, user: safeUser });
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update User Profile Name
router.patch('/profile', requireAuth, async (req: Request, res: Response) => {
  try {
    const { name } = req.body;
    
    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return res.status(400).json({ error: 'Name must be a valid non-empty string' });
    }

    const trimmedName = name.trim();
    if (trimmedName.length > 50) {
      return res.status(400).json({ error: 'Name cannot exceed 50 characters' });
    }

    // Safely pull the authenticated user's ID
    const userId = req.user!.id;
    
    const updatedUser = await userRepository.updateProfile(userId, { name: trimmedName });
    
    const { passwordHash: _, ...safeUser } = updatedUser as any;
    return res.json({ success: true, user: safeUser });
  } catch (error) {
    console.error('Profile update error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
