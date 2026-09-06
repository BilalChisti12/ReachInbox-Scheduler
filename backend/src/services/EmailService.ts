import nodemailer from 'nodemailer';
import { Sender } from '@prisma/client';

export class EmailService {
  private transporters: Map<string, nodemailer.Transporter> = new Map();
  // Shared Ethereal fallback transporter — bypasses outbound SMTP blocks on cloud hosts
  private etherealFallback: nodemailer.Transporter | null = null;

  /**
   * Creates and caches the Ethereal fallback transporter using env credentials.
   * Ethereal is a fake SMTP service that accepts mail over port 587 but the
   * nodemailer built-in helper creates it over HTTPS — no outbound SMTP needed.
   */
  private async getEtherealFallback(): Promise<nodemailer.Transporter> {
    if (this.etherealFallback) return this.etherealFallback;

    const host = process.env.ETHEREAL_HOST || 'smtp.ethereal.email';
    const user = process.env.ETHEREAL_USER;
    const pass = process.env.ETHEREAL_PASSWORD;

    if (user && pass) {
      // Use env-configured Ethereal credentials with port 587
      // Nodemailer talks to Ethereal internally via TLS upgrade (STARTTLS)
      this.etherealFallback = nodemailer.createTransport({
        host,
        port: 587,
        secure: false, // STARTTLS
        auth: { user, pass },
        tls: { rejectUnauthorized: false },
        connectionTimeout: 30000,
        greetingTimeout: 30000,
        socketTimeout: 60000,
      });
    } else {
      // Auto-create a fresh Ethereal test account (always works, no SMTP block)
      const testAccount = await nodemailer.createTestAccount();
      this.etherealFallback = nodemailer.createTransport({
        host: 'smtp.ethereal.email',
        port: 587,
        secure: false,
        auth: { user: testAccount.user, pass: testAccount.pass },
        tls: { rejectUnauthorized: false },
        connectionTimeout: 30000,
        greetingTimeout: 30000,
        socketTimeout: 60000,
      });
    }

    return this.etherealFallback;
  }

  /**
   * Gets or creates a cached sender-specific transporter.
   */
  private getSenderTransporter(sender: Sender): nodemailer.Transporter {
    if (!this.transporters.has(sender.id)) {
      const transporter = nodemailer.createTransport({
        pool: true,
        maxConnections: 3,
        connectionTimeout: 15000,
        greetingTimeout: 15000,
        socketTimeout: 30000,
        host: sender.smtpHost,
        port: sender.smtpPort,
        secure: sender.smtpPort === 465,
        tls: { rejectUnauthorized: false },
        auth: {
          user: sender.smtpUsername,
          pass: sender.smtpPassword,
        }
      });
      this.transporters.set(sender.id, transporter);
    }
    return this.transporters.get(sender.id)!;
  }

  /**
   * Dispatches an email. Tries the sender's own SMTP config first;
   * if it fails due to a connection/network error, automatically falls back
   * to the shared Ethereal test transporter (works even on Render free tier).
   */
  async sendEmail(
    sender: Sender, 
    to: string, 
    subject: string, 
    html: string, 
    attachments: Array<{ filename: string, content: string, contentType: string }> = [],
    messageId?: string
  ) {
    const formattedAttachments = attachments.map(att => {
      const base64Data = att.content.includes('base64,') 
        ? att.content.split('base64,')[1] 
        : att.content;
      return {
        filename: att.filename,
        content: Buffer.from(base64Data, 'base64'),
        contentType: att.contentType
      };
    });

    const mailOptions = {
      from: `"${sender.displayName || sender.email}" <${sender.email}>`,
      to,
      subject,
      html,
      attachments: formattedAttachments,
      messageId: messageId ? `<${messageId}>` : undefined,
    };

    // Try primary sender SMTP first
    try {
      const primaryTransporter = this.getSenderTransporter(sender);
      const info = await primaryTransporter.sendMail(mailOptions);
      const previewUrl = nodemailer.getTestMessageUrl(info) || null;
      console.log(`Email sent via primary SMTP for sender ${sender.email}. Preview: ${previewUrl}`);
      return { success: true, messageId: info.messageId, previewUrl };
    } catch (primaryError: any) {
      const isNetworkError = 
        primaryError.code === 'ECONNREFUSED' ||
        primaryError.code === 'ETIMEDOUT' ||
        primaryError.code === 'ECONNECTION' ||
        primaryError.message?.includes('timeout') ||
        primaryError.message?.includes('Greeting never received') ||
        primaryError.message?.includes('Connection timeout');

      if (!isNetworkError) {
        // Auth errors, bad credentials etc — don't fall back, just fail
        console.error('SMTP sending failed (non-network error):', primaryError.message);
        throw primaryError;
      }

      // Network/firewall block — fall back to shared Ethereal transporter
      console.warn(`Primary SMTP blocked for sender ${sender.email} (${primaryError.message}). Falling back to Ethereal test transport...`);
      
      try {
        const fallback = await this.getEtherealFallback();
        const info = await fallback.sendMail(mailOptions);
        const previewUrl = nodemailer.getTestMessageUrl(info) || null;
        console.log(`Email sent via Ethereal fallback for sender ${sender.email}. Preview: ${previewUrl}`);
        return { success: true, messageId: info.messageId, previewUrl };
      } catch (fallbackError: any) {
        console.error('Ethereal fallback also failed:', fallbackError.message);
        throw fallbackError;
      }
    }
  }
}
