import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';

dotenv.config();

const prisma = new PrismaClient();

export class SlackService {
  private clientId = process.env.SLACK_CLIENT_ID || '';
  private clientSecret = process.env.SLACK_CLIENT_SECRET || '';
  private redirectUri = process.env.SLACK_REDIRECT_URI || '';

  /**
   * Generates the Slack OAuth v2 authorization URL.
   * @param state A secure CSRF state token tied to the user's session
   */
  generateAuthUrl(state: string): string {
    const scopes = ['chat:write', 'chat:write.public'];
    const url = new URL('https://slack.com/oauth/v2/authorize');
    url.searchParams.append('client_id', this.clientId);
    url.searchParams.append('scope', scopes.join(','));
    url.searchParams.append('redirect_uri', this.redirectUri);
    url.searchParams.append('state', state);
    return url.toString();
  }

  /**
   * Exchanges the OAuth code for an access token and persists the connection.
   */
  async exchangeCode(code: string, userId: string): Promise<void> {
    const response = await fetch('https://slack.com/api/oauth.v2.access', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_id: this.clientId,
        client_secret: this.clientSecret,
        code,
        redirect_uri: this.redirectUri,
      }),
    });

    const data = await response.json();

    if (!data.ok) {
      throw new Error(`Slack OAuth Error: ${data.error}`);
    }

    // Persist securely. The token is stored as plain text here, but in a real system it would be encrypted.
    // The instructions say "If the existing architecture supports encryption-at-rest, use it. If not, document the local-development limitation."
    // There's no existing encryption service, so we store it and document it.
    await prisma.slackConnection.upsert({
      where: { userId },
      create: {
        userId,
        accessToken: data.access_token,
        slackTeamId: data.team?.id,
        slackTeamName: data.team?.name,
        selectedChannelId: data.authed_user?.id, // Capture authed user for DM
        connected: true,
      },
      update: {
        accessToken: data.access_token,
        slackTeamId: data.team?.id,
        slackTeamName: data.team?.name,
        selectedChannelId: data.authed_user?.id,
        connected: true,
        updatedAt: new Date(),
      },
    });
  }

  /**
   * Disconnects a user's Slack account.
   */
  async disconnect(userId: string): Promise<void> {
    await prisma.slackConnection.update({
      where: { userId },
      data: { connected: false, accessToken: '' }
    }).catch(() => { /* Ignore if it doesn't exist */ });
  }

  /**
   * Gets the Slack connection status for a user.
   */
  async getStatus(userId: string): Promise<{ connected: boolean }> {
    const connection = await prisma.slackConnection.findUnique({
      where: { userId },
      select: { connected: true }
    });
    return { connected: !!connection?.connected };
  }

  /**
   * Sends a rate-limit notification to Slack for a specific user.
   */
  async sendRateLimitNotification(
    userId: string,
    senderEmail: string,
    campaignId: string,
    limit: number,
    limitType: 'sender' | 'campaign'
  ): Promise<void> {
    try {
      const connection = await prisma.slackConnection.findUnique({
        where: { userId }
      });

      if (!connection || !connection.connected || !connection.accessToken) {
        return; // No Slack connection or disconnected. Fail gracefully.
      }

      const text = 
`🚨 *Email Rate Limit Reached* 🚨
*Sender:* ${senderEmail}
*Campaign ID:* ${campaignId}
*Limit Hit:* ${limit} emails/hour (${limitType} limit)

The remaining emails for this sender have been deferred until the next available rate-limit window.`;

      // Send direct message to the authed user instead of relying on #general
      const channel = connection.selectedChannelId;
      if (!channel) {
        throw new Error('No Slack channel/user configured for notification.');
      }

      const response = await fetch('https://slack.com/api/chat.postMessage', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${connection.accessToken}`
        },
        body: JSON.stringify({
          channel,
          text
        })
      });

      const data = await response.json();
      
      if (!data.ok) {
        console.error(`Slack notification failed: ${data.error}`);
        // If token is invalid/revoked, optionally disconnect automatically:
        if (data.error === 'invalid_auth' || data.error === 'token_revoked') {
          await this.disconnect(userId);
          console.warn(`Slack token revoked/invalid for user ${userId}. Automatically disconnected.`);
          return; // Suppress hard failure since token is dead anyway
        }
        throw new Error(`Slack API rejected the request: ${data.error}`);
      }
    } catch (error: any) {
      // Propagate error up to caller so the Deduplication lock can be safely released!
      console.error(`Failed to send Slack notification: ${error.message}`);
      throw error;
    }
  }
}
