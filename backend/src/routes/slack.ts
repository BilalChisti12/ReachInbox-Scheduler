import { Router, Request, Response } from 'express';
import { requireAuth } from '../middleware/requireAuth';
import { SlackService } from '../services/SlackService';
import crypto from 'crypto';

const router = Router();
const slackService = new SlackService();

// Initiate Slack OAuth flow
router.get('/auth', requireAuth, (req: Request, res: Response) => {
  // Generate a random state token for CSRF protection
  const state = crypto.randomBytes(16).toString('hex');
  
  // Store the state in the user's session
  (req.session as any).slackOAuthState = state;
  
  const authUrl = slackService.generateAuthUrl(state);
  res.redirect(authUrl);
});

// Slack OAuth callback
router.get('/callback', requireAuth, async (req: Request, res: Response) => {
  const { code, state, error } = req.query;

  if (error) {
    return res.status(400).json({ error: `Slack OAuth failed: ${error}` });
  }

  // Verify state matches to prevent CSRF
  const sessionState = (req.session as any).slackOAuthState;
  if (!state || state !== sessionState) {
    return res.status(400).json({ error: 'Invalid state parameter. CSRF validation failed.' });
  }

  // Clear the state from the session
  delete (req.session as any).slackOAuthState;

  if (!code || typeof code !== 'string') {
    return res.status(400).json({ error: 'Authorization code missing' });
  }

  try {
    const userId = req.user!.id;
    await slackService.exchangeCode(code, userId);
    
    // Redirect to settings page so user sees Slack connection confirmed
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    res.redirect(`${frontendUrl}/settings?slack=connected`);
  } catch (err: any) {
    console.error('Slack OAuth exchange failed:', err);
    res.status(500).json({ error: 'Failed to connect Slack account' });
  }
});

// Disconnect Slack
router.post('/disconnect', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    await slackService.disconnect(userId);
    res.json({ success: true, message: 'Slack disconnected successfully' });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to disconnect Slack' });
  }
});

// Get Slack connection status
router.get('/status', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const status = await slackService.getStatus(userId);
    res.json(status);
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to fetch Slack status' });
  }
});

export default router;
