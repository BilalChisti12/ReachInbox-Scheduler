import nodemailer from 'nodemailer';
import { Sender } from '@prisma/client';

export class EmailService {
  private transporters: Map<string, nodemailer.Transporter> = new Map();

  /**
   * Gets or creates a cached, pooled transporter for the sender to prevent connection timeouts.
   */
  private getTransporter(sender: Sender): nodemailer.Transporter {
    if (!this.transporters.has(sender.id)) {
      const transporter = nodemailer.createTransport({
        pool: true,
        maxConnections: 2, // Limit concurrent connections to prevent timeouts on Ethereal/free SMTP
        maxMessages: 100,
        connectionTimeout: 10000,
        greetingTimeout: 10000,
        socketTimeout: 15000,
        host: sender.smtpHost,
        port: sender.smtpPort,
        secure: sender.smtpPort === 465,
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
   * Dispatches an email using the provided Sender's SMTP credentials.
   * Returns metadata including the Ethereal preview URL if available.
   */
  async sendEmail(
    sender: Sender, 
    to: string, 
    subject: string, 
    html: string, 
    attachments: Array<{ filename: string, content: string, contentType: string }> = [],
    messageId?: string
  ) {
    const transporter = this.getTransporter(sender);

    try {
      const formattedAttachments = attachments.map(att => {
        // Strip out base64 prefix if frontend sends it (e.g. data:image/png;base64,...)
        const base64Data = att.content.includes('base64,') 
          ? att.content.split('base64,')[1] 
          : att.content;
          
        return {
          filename: att.filename,
          content: Buffer.from(base64Data, 'base64'),
          contentType: att.contentType
        };
      });

      const info = await transporter.sendMail({
        from: `"${sender.displayName || ''}" <${sender.email}>`,
        to,
        subject,
        html,
        attachments: formattedAttachments,
        messageId: messageId ? `<${messageId}>` : undefined // Inject deterministic Message-ID
      });
      
      let previewUrl = null;
      // Nodemailer provides a helper to get Ethereal preview URLs automatically
      const testMessageUrl = nodemailer.getTestMessageUrl(info);
      if (testMessageUrl) {
        previewUrl = testMessageUrl;
      }
      
      return { success: true, messageId: info.messageId, previewUrl };
    } catch (error) {
      console.error('SMTP sending failed:', error);
      throw error;
    }
  }
}
