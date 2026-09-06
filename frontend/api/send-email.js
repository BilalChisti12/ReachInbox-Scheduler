// Vercel Serverless Function: /api/send-email
// This runs on Vercel (AWS Lambda) which does NOT block SMTP port 587.
// The Render backend (which blocks SMTP) calls this endpoint over HTTPS instead.

const nodemailer = require('nodemailer');

module.exports = async function handler(req, res) {
  // Only allow POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Verify shared secret so only our backend can call this
  const secret = req.headers['x-internal-secret'];
  if (!secret || secret !== process.env.INTERNAL_EMAIL_SECRET) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const {
    from,
    to,
    subject,
    html,
    attachments = [],
    messageId,
    smtpHost,
    smtpPort,
    smtpUser,
    smtpPass,
  } = req.body;

  if (!to || !subject || !smtpUser || !smtpPass) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  try {
    const transporter = nodemailer.createTransport({
      host: smtpHost || 'smtp.ethereal.email',
      port: smtpPort || 587,
      secure: false, // STARTTLS
      auth: {
        user: smtpUser,
        pass: smtpPass,
      },
      tls: { rejectUnauthorized: false },
      connectionTimeout: 30000,
      greetingTimeout: 30000,
      socketTimeout: 60000,
    });

    const info = await transporter.sendMail({
      from,
      to,
      subject,
      html,
      attachments,
      messageId: messageId ? `<${messageId}>` : undefined,
    });

    const previewUrl = nodemailer.getTestMessageUrl(info) || null;

    console.log(`[EmailBridge] Sent to ${to}. Preview: ${previewUrl}`);
    return res.status(200).json({
      success: true,
      messageId: info.messageId,
      previewUrl,
    });
  } catch (error) {
    console.error('[EmailBridge] SMTP error:', error.message);
    return res.status(500).json({ error: error.message });
  }
};
