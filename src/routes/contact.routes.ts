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

function parseEnvNumber(rawValue: string | undefined, fallback: number): number {
  if (!rawValue) {
    return fallback;
  }

  const normalized = rawValue.trim().replace(/^['\"]|['\"]$/g, '');
  const firstNumericMatch = normalized.match(/\d+/);
  if (!firstNumericMatch) {
    return fallback;
  }

  const parsed = parseInt(firstNumericMatch[0], 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function parseEnvBoolean(rawValue: string | undefined, fallback: boolean): boolean {
  if (!rawValue) {
    return fallback;
  }

  const normalized = rawValue.trim().replace(/^['\"]|['\"]$/g, '').toLowerCase();
  if (['true', '1', 'yes', 'on'].includes(normalized)) {
    return true;
  }
  if (['false', '0', 'no', 'off'].includes(normalized)) {
    return false;
  }

  return fallback;
}

const SMTP_TIMEOUT_MS = parseEnvNumber(process.env.SMTP_TIMEOUT_MS, 12000);
const SMTP_PORT = parseEnvNumber(process.env.EMAIL_PORT, 587);
const SMTP_SECURE = parseEnvBoolean(process.env.EMAIL_SECURE, false);
const SMTP_FALLBACK_PORT = parseEnvNumber(process.env.EMAIL_FALLBACK_PORT, 465);
const SMTP_FALLBACK_SECURE = parseEnvBoolean(process.env.EMAIL_FALLBACK_SECURE, true);
const SMTP_DEBUG = parseEnvBoolean(process.env.SMTP_DEBUG, false);
const SMTP_SINGLE_ACCOUNT = parseEnvBoolean(process.env.SMTP_SINGLE_ACCOUNT, true);
const SMTP_USE_ORG_FROM = parseEnvBoolean(process.env.SMTP_USE_ORG_FROM, false);
const SMTP_FROM_ADDRESS = process.env.SMTP_FROM_ADDRESS || '';
const SMTP_BLOCKING_WAIT_MS = parseEnvNumber(process.env.SMTP_BLOCKING_WAIT_MS, 2500);
const SMTP_FAILURE_COOLDOWN_MS = parseEnvNumber(process.env.SMTP_FAILURE_COOLDOWN_MS, 60000);
const RESEND_API_KEY = process.env.RESEND_API_KEY;
const RESEND_FROM = process.env.RESEND_FROM || process.env.EMAIL_USER || 'admin@hocfam.org';

let smtpBackoffUntil = 0;

type ContactCategory = 'admin' | 'info' | 'support' | 'media';

type SmtpAuth = {
  user?: string;
  pass?: string;
};

function getCategorySmtpAuth(category: ContactCategory): SmtpAuth {
  if (SMTP_SINGLE_ACCOUNT) {
    return getGlobalSmtpAuth();
  }

  const categoryKey = category.toUpperCase();
  const categoryUser = process.env[`EMAIL_${categoryKey}_USER` as keyof NodeJS.ProcessEnv] as string | undefined;
  const categoryPassword = process.env[`EMAIL_${categoryKey}_PASSWORD` as keyof NodeJS.ProcessEnv] as string | undefined;

  const user = categoryUser || orgMailboxes[category] || process.env.EMAIL_USER;
  const pass = categoryPassword || process.env.EMAIL_PASSWORD;

  return { user, pass };
}

function getGlobalSmtpAuth(): SmtpAuth {
  return {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASSWORD,
  };
}

function createTransporter(auth: SmtpAuth, port = SMTP_PORT, secure = SMTP_SECURE) {
  if (!auth.user || !auth.pass) {
    return null;
  }

  return nodemailer.createTransport({
    host: process.env.EMAIL_HOST || 'smtp.zoho.com',
    port,
    secure,
    connectionTimeout: SMTP_TIMEOUT_MS,
    greetingTimeout: SMTP_TIMEOUT_MS,
    socketTimeout: SMTP_TIMEOUT_MS,
    logger: SMTP_DEBUG,
    debug: SMTP_DEBUG,
    auth: {
      user: auth.user,
      pass: auth.pass,
    },
  });
}

/**
 * Return the SMTP "from" address to use.
 * Priority: SMTP_FROM_ADDRESS env (explicit override) → SMTP_USE_ORG_FROM (org mailbox for category)
 * → authenticated SMTP user → info fallback.
 */
function resolveSmtpFrom(authUser: string | undefined, category: ContactCategory): string {
  if (SMTP_FROM_ADDRESS) return SMTP_FROM_ADDRESS;
  if (SMTP_USE_ORG_FROM) return orgMailboxes[category];
  return authUser || orgMailboxes.info;
}

function normalizeSmtpError(error: unknown) {
  if (error instanceof Error) {
    const errorWithMeta = error as Error & {
      code?: string;
      command?: string;
      response?: string;
      responseCode?: number;
    };

    return {
      message: errorWithMeta.message,
      code: errorWithMeta.code,
      command: errorWithMeta.command,
      responseCode: errorWithMeta.responseCode,
      response: errorWithMeta.response,
    };
  }

  if (typeof error === 'object' && error !== null) {
    const errorObject = error as {
      message?: unknown;
      code?: unknown;
      command?: unknown;
      response?: unknown;
      responseCode?: unknown;
    };

    const fallbackMessageSource = errorObject.message ?? errorObject;
    let fallbackMessage = '';
    try {
      fallbackMessage = JSON.stringify(fallbackMessageSource);
    } catch {
      fallbackMessage = String(fallbackMessageSource);
    }

    return {
      message: typeof errorObject.message === 'string'
        ? errorObject.message
        : fallbackMessage,
      code: typeof errorObject.code === 'string' ? errorObject.code : undefined,
      command: typeof errorObject.command === 'string' ? errorObject.command : undefined,
      responseCode: typeof errorObject.responseCode === 'number' ? errorObject.responseCode : undefined,
      response: typeof errorObject.response === 'string' ? errorObject.response : undefined,
    };
  }

  return {
    message: String(error),
  };
}

function isTransientSmtpError(error: ReturnType<typeof normalizeSmtpError>): boolean {
  return isConnectionLevelError(error) || /timeout|timed out/i.test(error.message || '');
}

function isSmtpBackoffActive(): boolean {
  return smtpBackoffUntil > Date.now();
}

function activateSmtpBackoff(error: ReturnType<typeof normalizeSmtpError>) {
  smtpBackoffUntil = Date.now() + SMTP_FAILURE_COOLDOWN_MS;
  console.warn('SMTP backoff activated', {
    cooldownMs: SMTP_FAILURE_COOLDOWN_MS,
    until: new Date(smtpBackoffUntil).toISOString(),
    error,
  });
}

function buildSmtpHint(error: ReturnType<typeof normalizeSmtpError> | undefined): string {
  if (!error) {
    return 'No SMTP error details were captured.';
  }

  const parts: string[] = [];
  if (error.code) {
    parts.push(`code=${error.code}`);
  }
  if (typeof error.responseCode === 'number') {
    parts.push(`responseCode=${error.responseCode}`);
  }
  if (error.command) {
    parts.push(`command=${error.command}`);
  }
  if (error.response) {
    parts.push(`response=${error.response}`);
  }
  if (error.message) {
    parts.push(`message=${error.message}`);
  }

  return parts.join(' | ') || 'No SMTP error details were captured.';
}

function isConnectionLevelError(error: ReturnType<typeof normalizeSmtpError>): boolean {
  return (
    error.code === 'ETIMEDOUT' ||
    error.code === 'ECONNREFUSED' ||
    error.code === 'EHOSTUNREACH' ||
    error.code === 'ENETUNREACH' ||
    error.code === 'ENOTFOUND' ||
    error.command === 'CONN'
  );
}

async function sendViaResend(mailOptions: nodemailer.SendMailOptions, label: string): Promise<boolean> {
  if (!RESEND_API_KEY) {
    return false;
  }

  const toList = Array.isArray(mailOptions.to) ? mailOptions.to : [mailOptions.to];
  const to = toList.filter(Boolean).map((item) => String(item));
  if (!to.length) {
    return false;
  }

  const payload = {
    from: RESEND_FROM,
    to,
    subject: String(mailOptions.subject || ''),
    html: String(mailOptions.html || ''),
    reply_to: mailOptions.replyTo ? String(mailOptions.replyTo) : undefined,
  };

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`${label} failed via Resend fallback`, {
        status: response.status,
        body: errorText,
      });
      return false;
    }

    return true;
  } catch (error) {
    console.error(`${label} failed via Resend fallback`, normalizeSmtpError(error));
    return false;
  }
}

async function withTimeout<T>(promise: Promise<T>, label: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => {
      setTimeout(() => {
        const timeoutError = new Error(`${label} timed out after ${SMTP_TIMEOUT_MS}ms`) as Error & {
          code?: string;
          command?: string;
        };
        timeoutError.code = 'ETIMEDOUT';
        timeoutError.command = 'CONN';
        reject(timeoutError);
      }, SMTP_TIMEOUT_MS);
    }),
  ]);
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

async function sendMailWithFallback(
  category: ContactCategory,
  mailOptions: nodemailer.SendMailOptions,
  label: string
) {
  if (isSmtpBackoffActive()) {
    if (RESEND_API_KEY) {
      const resendSent = await sendViaResend(mailOptions, `${label} (SMTP backoff)`);
      if (resendSent) {
        return;
      }
    }

    throw {
      message: `SMTP temporarily paused. Backoff active for ${Math.max(0, smtpBackoffUntil - Date.now())}ms`,
      code: 'SMTP_BACKOFF',
      command: 'CONN',
    };
  }

  const categoryAuth = getCategorySmtpAuth(category);
  const globalAuth = getGlobalSmtpAuth();

  const categoryTransporter = createTransporter(categoryAuth);
  const shouldTryGlobalFallback = !!globalAuth.user && !!globalAuth.pass && (
    globalAuth.user !== categoryAuth.user || globalAuth.pass !== categoryAuth.pass
  );
  const globalTransporter = shouldTryGlobalFallback ? createTransporter(globalAuth) : null;

  let lastError: unknown;

  if (categoryTransporter) {
    try {
      await withTimeout(categoryTransporter.sendMail({
        ...mailOptions,
        from: `"HOCFAM Contact Form" <${resolveSmtpFrom(categoryAuth.user, category)}>`,
      }), `${label} (category SMTP)`);
      return;
    } catch (error) {
      const normalizedError = normalizeSmtpError(error);
      lastError = normalizedError;
      if (isTransientSmtpError(normalizedError)) {
        activateSmtpBackoff(normalizedError);
      }
      console.error(`${label} failed with category SMTP credentials`, {
        mailbox: categoryAuth.user,
        error: normalizedError,
      });

      if (isConnectionLevelError(normalizedError) && (SMTP_FALLBACK_PORT !== SMTP_PORT || SMTP_FALLBACK_SECURE !== SMTP_SECURE)) {
        const categoryFallbackTransporter = createTransporter(categoryAuth, SMTP_FALLBACK_PORT, SMTP_FALLBACK_SECURE);
        if (categoryFallbackTransporter) {
          try {
            await withTimeout(categoryFallbackTransporter.sendMail({
              ...mailOptions,
              from: `"HOCFAM Contact Form" <${resolveSmtpFrom(categoryAuth.user, category)}>`,
            }), `${label} (category SMTP transport fallback)`);
            return;
          } catch (fallbackError) {
            const normalizedFallbackError = normalizeSmtpError(fallbackError);
            lastError = normalizedFallbackError;
            if (isTransientSmtpError(normalizedFallbackError)) {
              activateSmtpBackoff(normalizedFallbackError);
            }
            console.error(`${label} failed with category SMTP transport fallback`, {
              mailbox: categoryAuth.user,
              error: normalizedFallbackError,
            });
          }
        }
      }
    }
  }

  if (globalTransporter && globalAuth.user) {
    try {
      await withTimeout(globalTransporter.sendMail({
        ...mailOptions,
        from: `"HOCFAM Contact Form" <${resolveSmtpFrom(globalAuth.user, category)}>`,
      }), `${label} (global SMTP fallback)`);
      return;
    } catch (error) {
      const normalizedError = normalizeSmtpError(error);
      lastError = normalizedError;
      if (isTransientSmtpError(normalizedError)) {
        activateSmtpBackoff(normalizedError);
      }
      console.error(`${label} failed with global SMTP fallback credentials`, {
        mailbox: globalAuth.user,
        error: normalizedError,
      });

      if (isConnectionLevelError(normalizedError) && (SMTP_FALLBACK_PORT !== SMTP_PORT || SMTP_FALLBACK_SECURE !== SMTP_SECURE)) {
        const globalTransportFallback = createTransporter(globalAuth, SMTP_FALLBACK_PORT, SMTP_FALLBACK_SECURE);
        if (globalTransportFallback) {
          try {
            await withTimeout(globalTransportFallback.sendMail({
              ...mailOptions,
              from: `"HOCFAM Contact Form" <${resolveSmtpFrom(globalAuth.user, category)}>`,
            }), `${label} (global SMTP transport fallback)`);
            return;
          } catch (fallbackError) {
            const normalizedFallbackError = normalizeSmtpError(fallbackError);
            lastError = normalizedFallbackError;
            if (isTransientSmtpError(normalizedFallbackError)) {
              activateSmtpBackoff(normalizedFallbackError);
            }
            console.error(`${label} failed with global SMTP transport fallback`, {
              mailbox: globalAuth.user,
              error: normalizedFallbackError,
            });
          }
        }
      }
    }
  }

  if (RESEND_API_KEY) {
    const resendSent = await sendViaResend(mailOptions, label);
    if (resendSent) {
      return;
    }
  }

  throw lastError || new Error(`${label} could not be sent because no valid SMTP transporter is available`);
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

    const [result]: any = await pool.execute(
      'INSERT INTO contact_messages (name, email, phone, subject, message) VALUES (?, ?, ?, ?, ?)',
      [name, email, phone, subject, message]
    );

    const adminMailPromise = sendMailWithFallback(resolvedCategory, {
        from: `"${name} via HOCFAM" <${resolveSmtpFrom(senderAuth.user, resolvedCategory)}>`,
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
      }, 'Admin contact notification email');

    let adminEmailDelivered = true;
    let adminSmtpError: ReturnType<typeof normalizeSmtpError> | undefined;

    try {
      await Promise.race([
        adminMailPromise,
        new Promise((_, reject) => {
          setTimeout(() => reject(new Error(`Admin contact notification wait timed out after ${SMTP_BLOCKING_WAIT_MS}ms`)), SMTP_BLOCKING_WAIT_MS);
        }),
      ]);
    } catch (emailError) {
      adminSmtpError = normalizeSmtpError(emailError);
      console.error('Contact email dispatch failed:', adminSmtpError);
      adminEmailDelivered = false;

      // Consume eventual promise rejection to avoid unhandled rejection noise.
      void adminMailPromise.catch(() => undefined);
    }

    const shouldSendConfirmation = adminEmailDelivered || !!RESEND_API_KEY || !isTransientSmtpError(adminSmtpError || { message: '' });
    if (shouldSendConfirmation) {
      // Confirmation email is best-effort and should not delay API response.
      void sendMailWithFallback(resolvedCategory, {
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
        }, 'Sender confirmation email').catch((confirmationError) => {
        console.error('Sender confirmation email failed (non-blocking):', normalizeSmtpError(confirmationError));
      });
    }

    const emailDelivered = adminEmailDelivered;

    const responsePayload = {
      message: 'Message sent successfully',
      id: result.insertId,
      routedTo: recipient,
      category: resolvedCategory,
      emailDelivered,
      warning: emailDelivered
        ? undefined
        : `Message was saved, but delivery to church mailbox failed. ${buildSmtpHint(adminSmtpError)}`,
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
