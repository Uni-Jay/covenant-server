import { Router } from 'express';
import pool from '../config/database';
import nodemailer from 'nodemailer';

const router = Router();

const orgMailboxes = {
  admin: process.env.ORG_EMAIL_ADMIN || 'admin@hocfam.org',
  info: process.env.ORG_EMAIL_INFO || 'info@hocfam.org',
  support: process.env.ORG_EMAIL_SUPPORT || 'support@hocfam.org',
  media: process.env.ORG_EMAIL_MEDIA || 'media@hocfam.org',
};

type ContactCategory = 'admin' | 'info' | 'support' | 'media';

function getCategorySmtpAuth(category: ContactCategory) {
  const categoryKey = category.toUpperCase();
  const categoryUser = process.env[`EMAIL_${categoryKey}_USER` as keyof NodeJS.ProcessEnv] as string | undefined;
  const categoryPassword = process.env[`EMAIL_${categoryKey}_PASSWORD` as keyof NodeJS.ProcessEnv] as string | undefined;

  const user = categoryUser || orgMailboxes[category] || process.env.EMAIL_USER;
  const pass = categoryPassword || process.env.EMAIL_PASSWORD;

  return { user, pass };
}

function getCategoryTransporter(category: ContactCategory) {
  const auth = getCategorySmtpAuth(category);

  return nodemailer.createTransport({
    host: process.env.EMAIL_HOST || 'smtp.zoho.com',
    port: parseInt(process.env.EMAIL_PORT || '587'),
    secure: (process.env.EMAIL_SECURE || 'false') === 'true',
    auth: {
      user: auth.user,
      pass: auth.pass,
    },
  });
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

router.post('/', async (req, res) => {
  try {
    const { name, email, phone, subject, message, category } = req.body;

    if (!name || !email || !subject || !message) {
      return res.status(400).json({ message: 'Name, email, subject, and message are required' });
    }

    const resolvedCategory = resolveCategory(category, subject, message);
    const recipient = orgMailboxes[resolvedCategory];
    const senderAuth = getCategorySmtpAuth(resolvedCategory);
    const transporter = getCategoryTransporter(resolvedCategory);

    const [result]: any = await pool.execute(
      'INSERT INTO contact_messages (name, email, phone, subject, message) VALUES (?, ?, ?, ?, ?)',
      [name, email, phone, subject, message]
    );

    let emailDelivered = true;

    try {
      await transporter.sendMail({
        from: `"HOCFAM Contact Form" <${senderAuth.user || orgMailboxes.info}>`,
        to: recipient,
        replyTo: email,
        subject: `[Contact:${resolvedCategory.toUpperCase()}] ${subject}`,
        html: `
          <h2>New Contact Message</h2>
          <p><strong>Routed To:</strong> ${recipient}</p>
          <p><strong>Category:</strong> ${resolvedCategory}</p>
          <p><strong>Name:</strong> ${name}</p>
          <p><strong>Email:</strong> ${email}</p>
          <p><strong>Phone:</strong> ${phone || 'Not provided'}</p>
          <p><strong>Subject:</strong> ${subject}</p>
          <hr />
          <p>${String(message).replace(/\n/g, '<br/>')}</p>
        `,
      });

      await transporter.sendMail({
        from: `"Household Of Covenant And Faith Apostolic Ministry" <${senderAuth.user || orgMailboxes.info}>`,
        to: email,
        subject: 'We received your message',
        html: `
          <p>Hi ${name},</p>
          <p>Thank you for contacting Household Of Covenant And Faith Apostolic Ministry.</p>
          <p>Your message has been received and routed to our ${resolvedCategory} team. We will get back to you shortly.</p>
          <p><strong>Your subject:</strong> ${subject}</p>
          <p>Blessings,<br/>HOCFAM Team</p>
        `,
      });
    } catch (emailError) {
      console.error('Contact email dispatch failed:', emailError);
      emailDelivered = false;
    }

    const responsePayload = {
      message: 'Message sent successfully',
      id: result.insertId,
      routedTo: recipient,
      category: resolvedCategory,
      emailDelivered,
      warning: emailDelivered ? undefined : 'Message was saved, but email delivery failed. Please check SMTP credentials and logs.',
    };

    if (!emailDelivered) {
      return res.status(202).json(responsePayload);
    }

    res.status(201).json(responsePayload);
  } catch (error) {
    res.status(500).json({ message: 'Failed to send message' });
  }
});

export default router;
