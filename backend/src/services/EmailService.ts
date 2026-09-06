import nodemailer from 'nodemailer';
import { Sender } from '@prisma/client';
import https from 'https';
import http from 'http';

export class EmailService {
  /**
   * Sends an email by routing through the Vercel email-bridge serverless function.
   * This completely bypasses Render's outbound SMTP blocks since Vercel (AWS Lambda)
   * allows outbound SMTP on port 587 without restrictions.
   *
   * Falls back to direct SMTP if VERCEL_EMAIL_BRIDGE_URL is not configured
   * (useful for local development).
   */
  async sendEmail(
    sender: Sender,
    to: string,
    subject: string,
    html: string,
    attachments: Array<{ filename: string; content: string; contentType: string }> = [],
    messageId?: string
  ) {
    const bridgeUrl = process.env.VERCEL_EMAIL_BRIDGE_URL;
    const bridgeSecret = process.env.INTERNAL_EMAIL_SECRET;

    const formattedAttachments = attachments.map((att) => {
      const base64Data = att.content.includes('base64,')
        ? att.content.split('base64,')[1]
        : att.content;
      return {
        filename: att.filename,
        content: Buffer.from(base64Data, 'base64').toString('base64'),
        encoding: 'base64',
        contentType: att.contentType,
      };
    });

    // ─── Use Vercel Bridge (Production on Render) ───────────────────────────
    if (bridgeUrl && bridgeSecret) {
      console.log(`[EmailService] Routing email to Vercel bridge: ${bridgeUrl}`);
      return this.sendViaVercelBridge(bridgeUrl, bridgeSecret, {
        from: `"${sender.displayName || sender.email}" <${sender.email}>`,
        to,
        subject,
        html,
        attachments: formattedAttachments,
        messageId,
        smtpHost: sender.smtpHost,
        smtpPort: sender.smtpPort,
        smtpUser: sender.smtpUsername,
        smtpPass: sender.smtpPassword,
      });
    }

    // ─── Direct SMTP Fallback (Local Dev) ───────────────────────────────────
    console.log(`[EmailService] No Vercel bridge configured — using direct SMTP for ${sender.email}`);
    return this.sendViaSMTP(sender, to, subject, html, formattedAttachments, messageId);
  }

  private async sendViaVercelBridge(
    bridgeUrl: string,
    secret: string,
    payload: Record<string, unknown>
  ): Promise<{ success: boolean; messageId: string; previewUrl: string | null }> {
    const body = JSON.stringify(payload);
    const url = new URL(bridgeUrl);
    const isHttps = url.protocol === 'https:';
    const lib = isHttps ? https : http;

    return new Promise((resolve, reject) => {
      const options = {
        hostname: url.hostname,
        port: url.port || (isHttps ? 443 : 80),
        path: url.pathname,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(body),
          'x-internal-secret': secret,
        },
        timeout: 60000,
      };

      const req = lib.request(options, (res) => {
        let data = '';
        res.on('data', (chunk) => (data += chunk));
        res.on('end', () => {
          try {
            const parsed = JSON.parse(data);
            if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
              resolve(parsed);
            } else {
              reject(new Error(parsed.error || `Bridge responded with status ${res.statusCode}`));
            }
          } catch {
            reject(new Error(`Failed to parse bridge response: ${data}`));
          }
        });
      });

      req.on('timeout', () => {
        req.destroy();
        reject(new Error('Vercel bridge request timed out'));
      });

      req.on('error', (err) => reject(err));
      req.write(body);
      req.end();
    });
  }

  private async sendViaSMTP(
    sender: Sender,
    to: string,
    subject: string,
    html: string,
    attachments: Array<{ filename: string; content: string; encoding: string; contentType: string }>,
    messageId?: string
  ) {
    const transporter = nodemailer.createTransport({
      pool: true,
      maxConnections: 3,
      host: sender.smtpHost,
      port: sender.smtpPort,
      secure: sender.smtpPort === 465,
      auth: { user: sender.smtpUsername, pass: sender.smtpPassword },
      tls: { rejectUnauthorized: false },
      connectionTimeout: 30000,
      greetingTimeout: 30000,
      socketTimeout: 60000,
    });

    const info = await transporter.sendMail({
      from: `"${sender.displayName || sender.email}" <${sender.email}>`,
      to,
      subject,
      html,
      attachments,
      messageId: messageId ? `<${messageId}>` : undefined,
    });

    const previewUrl = (nodemailer.getTestMessageUrl(info) as string | false) || null;
    return { success: true, messageId: info.messageId, previewUrl };
  }
}
