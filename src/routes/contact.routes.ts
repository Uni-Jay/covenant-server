import { Router } from 'express';
import pool from '../config/database';
import { BrevoMailOptions, sendBrevoTransactionalEmail } from '../services/email.service';

const router = Router();

const orgMailboxes = {
  admin: process.env.ORG_EMAIL_ADMIN || 'admin@hocfam.org',
  info: process.env.ORG_EMAIL_INFO || 'info@hocfam.org',
  support: process.env.ORG_EMAIL_SUPPORT || 'support@hocfam.org',
  media: process.env.ORG_EMAIL_MEDIA || 'media@hocfam.org',
};

const CONTACT_FORM_FROM = '"HOCFAM Contact Form" <info@hocfam.org>';
const CONTACT_CONFIRMATION_FROM = '"Household Of Covenant And Faith Apostolic Ministry" <info@hocfam.org>';
const EMAIL_SEND_TIMEOUT_MS = 15000;
const MAIL_BRAND_LOGO_URL = 'https://hocfam.org/image/New_Logo.png';

type ContactCategory = 'admin' | 'info' | 'support' | 'media';

function buildContactMail(options: BrevoMailOptions): Promise<boolean> {
  return sendBrevoTransactionalEmail(options);
}

function resolveCategory(category: unknown, subject: string, message: string): ContactCategory {
  const normalizedCategory = String(category || '').trim().toLowerCase();
  if (normalizedCategory === 'admin' || normalizedCategory === 'info' || normalizedCategory === 'support' || normalizedCategory === 'media') {
    return normalizedCategory;
  }

  const combined = `${subject} ${message}`.toLowerCase();

  if (/(media|livestream|stream|sermon|video|audio|graphic|camera|broadcast)/.test(combined)) {
    return 'media';
  }

  if (/(support|help|issue|problem|bug|error|login|password|account|technical)/.test(combined)) {
    return 'support';
  }

  if (/(admin|approval|verification|access|leadership|role|executive)/.test(combined)) {
    return 'admin';
  }
  return 'info';
}

async function sendMailWithFallback(mailOptions: BrevoMailOptions) {
  return buildContactMail(mailOptions);
}

router.post('/', async (req, res) => {
  try {
    const { name, email, phone, subject, message, category } = req.body;

    if (!name || !email || !subject || !message) {
      return res.status(400).json({ message: 'Name, email, subject, and message are required' });
    }

    const resolvedCategory = resolveCategory(category, subject, message);
    const recipient = orgMailboxes[resolvedCategory];

    const [result]: any = await pool.execute(
      'INSERT INTO contact_messages (name, email, phone, subject, message) VALUES (?, ?, ?, ?, ?)',
      [name, email, phone, subject, message]
    );

    const formattedMessage = String(message).replace(/\n/g, '<br/>');

    const adminMailPromise = sendMailWithFallback({
        from: CONTACT_FORM_FROM,
        to: recipient,
        replyTo: email,
        subject: `[Contact:${resolvedCategory.toUpperCase()}] ${subject}`,
        html: `
          <div style="margin:0;padding:24px;background:#f4f7fb;font-family:'Segoe UI',Arial,sans-serif;color:#0f172a;">
            <table role="presentation" style="width:100%;max-width:700px;margin:0 auto;background:#ffffff;border:1px solid #e2e8f0;border-radius:12px;overflow:hidden;border-collapse:separate;">
              <tr>
                <td style="padding:20px 24px;background:#0b3b8f;color:#ffffff;">
                  <img src="${MAIL_BRAND_LOGO_URL}" alt="HOCFAM Logo" style="display:block;width:56px;height:56px;object-fit:contain;background:#ffffff;border-radius:10px;padding:6px;margin-bottom:10px;" />
                  <div style="font-size:12px;letter-spacing:.08em;text-transform:uppercase;opacity:.9;">HOCFAM Contact Desk</div>
                  <h2 style="margin:8px 0 0;font-size:22px;line-height:1.3;">New Contact Message</h2>
                </td>
              </tr>
              <tr>
                <td style="padding:20px 24px;">
                  <p style="margin:0 0 14px;font-size:14px;color:#334155;">A new website message has been routed for follow-up.</p>
                  <table role="presentation" style="width:100%;border-collapse:collapse;font-size:14px;">
                    <tr>
                      <td style="padding:8px 0;color:#475569;width:140px;"><strong>Routed To</strong></td>
                      <td style="padding:8px 0;color:#0f172a;">${recipient}</td>
                    </tr>
                    <tr>
                      <td style="padding:8px 0;color:#475569;"><strong>Category</strong></td>
                      <td style="padding:8px 0;color:#0f172a;text-transform:capitalize;">${resolvedCategory}</td>
                    </tr>
                    <tr>
                      <td style="padding:8px 0;color:#475569;"><strong>Name</strong></td>
                      <td style="padding:8px 0;color:#0f172a;">${name}</td>
                    </tr>
                    <tr>
                      <td style="padding:8px 0;color:#475569;"><strong>Email</strong></td>
                      <td style="padding:8px 0;color:#0f172a;">${email}</td>
                    </tr>
                    <tr>
                      <td style="padding:8px 0;color:#475569;"><strong>Phone</strong></td>
                      <td style="padding:8px 0;color:#0f172a;">${phone || 'Not provided'}</td>
                    </tr>
                    <tr>
                      <td style="padding:8px 0;color:#475569;"><strong>Subject</strong></td>
                      <td style="padding:8px 0;color:#0f172a;">${subject}</td>
                    </tr>
                  </table>
                  <div style="margin-top:16px;padding:16px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;">
                    <div style="margin:0 0 8px;font-size:12px;letter-spacing:.04em;text-transform:uppercase;color:#64748b;">Message</div>
                    <div style="font-size:14px;line-height:1.65;color:#0f172a;">${formattedMessage}</div>
                  </div>
                </td>
              </tr>
            </table>
          </div>
        `,
      });

    let adminEmailDelivered = true;

    try {
      await Promise.race([
        adminMailPromise,
        new Promise((_, reject) => {
          setTimeout(() => reject(new Error(`Admin contact notification timed out after ${EMAIL_SEND_TIMEOUT_MS}ms`)), EMAIL_SEND_TIMEOUT_MS);
        }),
      ]);
    } catch (emailError) {
      console.error('Contact email dispatch failed:', emailError instanceof Error ? emailError.message : String(emailError));
      adminEmailDelivered = false;
    }

    // Confirmation email is best-effort and should not delay API response.
    void sendMailWithFallback({
          from: CONTACT_CONFIRMATION_FROM,
          to: email,
          subject: 'We received your message',
          html: `
            <div style="margin:0;padding:24px;background:#f4f7fb;font-family:'Segoe UI',Arial,sans-serif;color:#0f172a;">
              <table role="presentation" style="width:100%;max-width:680px;margin:0 auto;background:#ffffff;border:1px solid #e2e8f0;border-radius:12px;overflow:hidden;border-collapse:separate;">
                <tr>
                  <td style="padding:20px 24px;background:#0b3b8f;color:#ffffff;">
                    <img src="${MAIL_BRAND_LOGO_URL}" alt="HOCFAM Logo" style="display:block;width:56px;height:56px;object-fit:contain;background:#ffffff;border-radius:10px;padding:6px;margin-bottom:10px;" />
                    <div style="font-size:12px;letter-spacing:.08em;text-transform:uppercase;opacity:.9;">Household Of Covenant And Faith</div>
                    <h2 style="margin:8px 0 0;font-size:22px;line-height:1.3;">We Received Your Message</h2>
                  </td>
                </tr>
                <tr>
                  <td style="padding:20px 24px;">
                    <p style="margin:0 0 12px;font-size:14px;line-height:1.65;color:#0f172a;">Hi ${name},</p>
                    <p style="margin:0 0 12px;font-size:14px;line-height:1.65;color:#334155;">Thank you for contacting Household Of Covenant And Faith Apostolic Ministry.</p>
                    <p style="margin:0 0 14px;font-size:14px;line-height:1.65;color:#334155;">Your request has been received and routed to our <strong style="text-transform:capitalize;color:#0f172a;">${resolvedCategory}</strong> team. We will get back to you shortly.</p>
                    <div style="padding:14px 16px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;font-size:14px;color:#0f172a;">
                      <strong>Subject:</strong> ${subject}
                    </div>
                    <p style="margin:18px 0 0;font-size:14px;line-height:1.65;color:#334155;">Blessings,<br/>HOCFAM Team</p>
                  </td>
                </tr>
              </table>
            </div>
          `,
        }).catch((confirmationError) => {
        console.error('Sender confirmation email failed (non-blocking):', confirmationError instanceof Error ? confirmationError.message : String(confirmationError));
      });

    const emailDelivered = adminEmailDelivered;

    const responsePayload = {
      message: 'Message sent successfully',
      id: result.insertId,
      routedTo: recipient,
      category: resolvedCategory,
      emailDelivered,
      warning: emailDelivered
        ? undefined
        : 'Message was saved, but delivery to church mailbox failed.',
    };

    if (!emailDelivered) {
      return res.status(202).json(responsePayload);
    }

    res.status(201).json(responsePayload);
  } catch (error) {
    console.error('Contact route failed:', error);
    res.status(500).json({ message: 'Failed to send message' });
  }
});

export default router;
