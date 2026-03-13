import nodemailer from 'nodemailer';
import pool from '../config/database';

const APP_BASE_URL = (process.env.APP_URL || 'https://hocfam.org').replace(/\/$/, '');

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
const SMTP_FAILURE_COOLDOWN_MS = parseEnvNumber(process.env.SMTP_FAILURE_COOLDOWN_MS, 60000);
const ORG_INFO_EMAIL = process.env.ORG_EMAIL_INFO || 'info@hocfam.org';
const SMTP_FROM_ADDRESS = process.env.SMTP_FROM_ADDRESS || ORG_INFO_EMAIL || process.env.EMAIL_USER || 'info@hocfam.org';
const PASSWORD_RESET_FROM_ADDRESS = process.env.PASSWORD_RESET_FROM_ADDRESS || ORG_INFO_EMAIL || SMTP_FROM_ADDRESS;
const PASSWORD_RESET_TOKEN_TTL_MINUTES = Math.max(30, parseEnvNumber(process.env.PASSWORD_RESET_TOKEN_TTL_MINUTES, 180));
const RESEND_API_KEY = process.env.RESEND_API_KEY;
const RESEND_FROM = process.env.RESEND_FROM || SMTP_FROM_ADDRESS;
const EMAIL_MODE = (process.env.EMAIL_MODE || 'auto').trim().toLowerCase();
const RESEND_ONLY_MODE = EMAIL_MODE === 'resend' || EMAIL_MODE === 'api';
const SMTP_ONLY_MODE = EMAIL_MODE === 'smtp';

let smtpBackoffUntil = 0;

function formatPasswordResetExpiry(ttlMinutes: number): string {
  if (ttlMinutes % 60 === 0) {
    const hours = ttlMinutes / 60;
    return `${hours} hour${hours === 1 ? '' : 's'}`;
  }
  return `${ttlMinutes} minutes`;
}

// Email configuration
function createTransporter(port = SMTP_PORT, secure = SMTP_SECURE) {
  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASSWORD) {
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
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASSWORD,
    },
  });
}

function normalizeMailError(error: unknown) {
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
      message: typeof errorObject.message === 'string' ? errorObject.message : fallbackMessage,
      code: typeof errorObject.code === 'string' ? errorObject.code : undefined,
      command: typeof errorObject.command === 'string' ? errorObject.command : undefined,
      responseCode: typeof errorObject.responseCode === 'number' ? errorObject.responseCode : undefined,
      response: typeof errorObject.response === 'string' ? errorObject.response : undefined,
    };
  }

  return { message: String(error) };
}

function isConnectionLevelError(error: ReturnType<typeof normalizeMailError>): boolean {
  return (
    error.code === 'ETIMEDOUT' ||
    error.code === 'ECONNREFUSED' ||
    error.code === 'EHOSTUNREACH' ||
    error.code === 'ENETUNREACH' ||
    error.code === 'ENOTFOUND' ||
    error.command === 'CONN'
  );
}

function isTransientMailError(error: ReturnType<typeof normalizeMailError>): boolean {
  return isConnectionLevelError(error) || /timeout|timed out/i.test(error.message || '');
}

function isSmtpBackoffActive(): boolean {
  return smtpBackoffUntil > Date.now();
}

function activateSmtpBackoff(error: ReturnType<typeof normalizeMailError>) {
  smtpBackoffUntil = Date.now() + SMTP_FAILURE_COOLDOWN_MS;
  console.warn('Notification SMTP backoff activated', {
    cooldownMs: SMTP_FAILURE_COOLDOWN_MS,
    until: new Date(smtpBackoffUntil).toISOString(),
    error,
  });
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

async function sendViaResend(mailOptions: nodemailer.SendMailOptions, label: string): Promise<boolean> {
  if (!RESEND_API_KEY) {
    return false;
  }

  const toList = Array.isArray(mailOptions.to) ? mailOptions.to : [mailOptions.to];
  const to = toList.filter(Boolean).map((item) => String(item));
  if (!to.length) {
    return false;
  }

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: String(mailOptions.from || RESEND_FROM),
        to,
        subject: String(mailOptions.subject || ''),
        html: String(mailOptions.html || ''),
        reply_to: mailOptions.replyTo ? String(mailOptions.replyTo) : undefined,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`${label} failed via Resend`, {
        status: response.status,
        body: errorText,
      });
      return false;
    }

    return true;
  } catch (error) {
    console.error(`${label} failed via Resend`, normalizeMailError(error));
    return false;
  }
}

async function sendMailWithFallback(mailOptions: nodemailer.SendMailOptions, label: string): Promise<boolean> {
  if (RESEND_ONLY_MODE) {
    if (!RESEND_API_KEY) {
      throw new Error(`EMAIL_MODE=${EMAIL_MODE} but RESEND_API_KEY is not configured`);
    }

    return sendViaResend(mailOptions, `${label} (Resend mode)`);
  }

  if (isSmtpBackoffActive()) {
    if (!SMTP_ONLY_MODE && RESEND_API_KEY) {
      return sendViaResend(mailOptions, `${label} (SMTP backoff)`);
    }

    throw {
      message: `SMTP temporarily paused. Backoff active for ${Math.max(0, smtpBackoffUntil - Date.now())}ms`,
      code: 'SMTP_BACKOFF',
      command: 'CONN',
    };
  }

  const transporter = createTransporter();
  let lastError: unknown;

  if (transporter) {
    try {
      await withTimeout(transporter.sendMail({
        ...mailOptions,
        from: mailOptions.from || `"Household Of Covenant And Faith Apostolic Ministry" <${SMTP_FROM_ADDRESS}>`,
      }), `${label} (primary SMTP)`);
      return true;
    } catch (error) {
      const normalizedError = normalizeMailError(error);
      lastError = normalizedError;
      if (isTransientMailError(normalizedError)) {
        activateSmtpBackoff(normalizedError);
      }
      console.error(`${label} failed with primary SMTP transport`, normalizedError);

      if (isConnectionLevelError(normalizedError) && (SMTP_FALLBACK_PORT !== SMTP_PORT || SMTP_FALLBACK_SECURE !== SMTP_SECURE)) {
        const fallbackTransporter = createTransporter(SMTP_FALLBACK_PORT, SMTP_FALLBACK_SECURE);
        if (fallbackTransporter) {
          try {
            await withTimeout(fallbackTransporter.sendMail({
              ...mailOptions,
              from: mailOptions.from || `"Household Of Covenant And Faith Apostolic Ministry" <${SMTP_FROM_ADDRESS}>`,
            }), `${label} (fallback SMTP)`);
            return true;
          } catch (fallbackError) {
            const normalizedFallbackError = normalizeMailError(fallbackError);
            lastError = normalizedFallbackError;
            if (isTransientMailError(normalizedFallbackError)) {
              activateSmtpBackoff(normalizedFallbackError);
            }
            console.error(`${label} failed with fallback SMTP transport`, normalizedFallbackError);
          }
        }
      }
    }
  }

  if (!SMTP_ONLY_MODE && RESEND_API_KEY) {
    return sendViaResend(mailOptions, label);
  }

  if (lastError) {
    throw lastError;
  }

  throw new Error(`${label} could not be sent because no valid mail transport is configured`);
}

export const sendWelcomeEmail = async (
  to: string,
  firstName: string,
  userType: 'member' | 'first_timer' = 'member'
) => {
  try {
    const subject = userType === 'first_timer' 
      ? '🙏 Welcome to Household Of Covenant And Faith Apostolic Ministry!' 
      : '✨ Welcome to Household Of Covenant And Faith Apostolic Ministry Family!';

    const htmlContent = userType === 'first_timer' 
      ? getFirstTimerWelcomeEmail(firstName)
      : getMemberWelcomeEmail(firstName);

    await sendMailWithFallback({
      from: `"Household Of Covenant And Faith Apostolic Ministry" <${SMTP_FROM_ADDRESS}>`,
      to,
      subject,
      html: htmlContent,
    }, 'Welcome email');

    console.log(`✓ Welcome email sent to ${to}`);
    return true;
  } catch (error) {
    console.error('Email send error:', error);
    return false;
  }
};

export const sendWelcomeSMS = async (
  phone: string,
  firstName: string,
  userType: 'member' | 'first_timer' = 'member'
) => {
  try {
    // Using Twilio or similar SMS service
    // For now, just log (implement actual SMS service as needed)
    const message = userType === 'first_timer'
      ? `Hi ${firstName}! 🙏 Welcome to Household Of Covenant And Faith Apostolic Ministry. We're blessed to have you! Download our app to stay connected. God bless you!`
      : `Welcome ${firstName}! ✨ You're now part of the Household Of Covenant And Faith Apostolic Ministry family. Check your email for next steps. Blessings!`;

    console.log(`📱 SMS to ${phone}: ${message}`);
    
    // TODO: Integrate actual SMS service (Twilio, Africa's Talking, etc.)
    // const accountSid = process.env.TWILIO_ACCOUNT_SID;
    // const authToken = process.env.TWILIO_AUTH_TOKEN;
    // const client = require('twilio')(accountSid, authToken);
    // await client.messages.create({
    //   body: message,
    //   from: process.env.TWILIO_PHONE_NUMBER,
    //   to: phone
    // });

    return true;
  } catch (error) {
    console.error('SMS send error:', error);
    return false;
  }
};

const getMemberWelcomeEmail = (firstName: string) => `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
    .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
    .button { display: inline-block; background: #667eea; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; margin: 20px 0; }
    .footer { text-align: center; margin-top: 30px; color: #666; font-size: 12px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>✨ Welcome to the Family!</h1>
    </div>
    <div class="content">
      <h2>Hello ${firstName}! 🙏</h2>
      
      <p>We're absolutely thrilled to welcome you to the <strong>Household Of Covenant And Faith Apostolic Ministry</strong> family! Your registration is complete, and you're now part of a vibrant community of believers.</p>
      
      <h3>🎉 What's Next?</h3>
      <ul>
        <li><strong>Download the App:</strong> Stay connected with sermons, events, and live streams</li>
        <li><strong>Join a Department:</strong> Find your place in our ministries</li>
        <li><strong>Attend Services:</strong> We meet every Sunday at 9:00 AM</li>
        <li><strong>Connect:</strong> Join our community chat and fellowship</li>
      </ul>
      
      <h3>📱 Quick Links</h3>
      <p>
        <a href="${APP_BASE_URL}" class="button">Download Mobile App</a>
        <a href="${APP_BASE_URL}/events" class="button">View Events</a>
      </p>
      
      <h3>📞 Need Help?</h3>
      <p>Our team is here for you!</p>
      <ul>
        <li>Email: <a href="mailto:info@hocfam.org">info@hocfam.org</a></li>
        <li>Phone: Call during office hours</li>
        <li>Visit: Check our website for church location</li>
      </ul>
      
      <p><strong>God bless you abundantly!</strong></p>
      <p>The Household Of Covenant And Faith Apostolic Ministry Team</p>
    </div>
    <div class="footer">
      <p>© ${new Date().getFullYear()} Household Of Covenant And Faith Apostolic Ministry. All rights reserved.</p>
      <p>You're receiving this because you registered on our platform.</p>
    </div>
  </div>
</body>
</html>
`;

const getFirstTimerWelcomeEmail = (firstName: string) => `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
    .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
    .button { display: inline-block; background: #f5576c; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; margin: 20px 0; }
    .footer { text-align: center; margin-top: 30px; color: #666; font-size: 12px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>🙏 Welcome Friend!</h1>
    </div>
    <div class="content">
      <h2>Hello ${firstName}!</h2>
      
      <p>Thank you for visiting <strong>Household Of Covenant And Faith Apostolic Ministry</strong>! We're absolutely blessed that you chose to worship with us. Your presence made our service even more special.</p>
      
      <h3>🎊 We'd Love to See You Again!</h3>
      <p>Here's what you can expect when you visit us:</p>
      <ul>
        <li><strong>Warm Fellowship:</strong> A welcoming community that feels like family</li>
        <li><strong>Powerful Worship:</strong> Spirit-filled praise and worship</li>
        <li><strong>Biblical Teaching:</strong> Life-changing messages from God's Word</li>
        <li><strong>Prayer & Support:</strong> We're here for you in your journey</li>
      </ul>
      
      <h3>📅 Join Us Again!</h3>
      <p><strong>Sunday Services:</strong> 9:00 AM<br>
      <strong>Bible Study:</strong> Wednesdays, 6:00 PM<br>
      <strong>Prayer Meetings:</strong> Fridays, 7:00 PM</p>
      
      <p>
        <a href="${APP_BASE_URL}/events" class="button">View Our Events</a>
      </p>
      
      <h3>💬 Stay Connected</h3>
      <p>Download our mobile app to:</p>
      <ul>
        <li>Watch live streams</li>
        <li>Access sermon recordings</li>
        <li>Get event notifications</li>
        <li>Connect with our community</li>
      </ul>
      
      <p><strong>Questions? We're Here!</strong><br>
      Email: <a href="mailto:info@hocfam.org">info@hocfam.org</a></p>
      
      <p><em>"For where two or three gather in my name, there am I with them." - Matthew 18:20</em></p>
      
      <p><strong>See you soon!</strong><br>
      Pastor & The Household Of Covenant And Faith Apostolic Ministry Family</p>
    </div>
    <div class="footer">
      <p>© ${new Date().getFullYear()} Household Of Covenant And Faith Apostolic Ministry. All rights reserved.</p>
    </div>
  </div>
</body>
</html>
`;

// Check if user has enabled specific notification type
export const checkNotificationPreference = async (
  userId: number,
  notificationType: 'push' | 'email' | 'event'
): Promise<boolean> => {
  try {
    const [users]: any = await pool.execute(
      'SELECT push_notifications, email_updates, event_reminders FROM users WHERE id = ?',
      [userId]
    );

    if (users.length === 0) {
      return true; // Default to enabled if user not found
    }

    const user = users[0];
    
    switch (notificationType) {
      case 'push':
        return user.push_notifications !== 0;
      case 'email':
        return user.email_updates !== 0;
      case 'event':
        return user.event_reminders !== 0;
      default:
        return true;
    }
  } catch (error) {
    console.error('Error checking notification preference:', error);
    return true; // Default to enabled on error
  }
};

// Send email with preference check
export const sendEmailNotification = async (
  userId: number,
  to: string,
  subject: string,
  htmlContent: string
): Promise<boolean> => {
  try {
    // Check if user has email notifications enabled
    const emailEnabled = await checkNotificationPreference(userId, 'email');
    
    if (!emailEnabled) {
      console.log(`⏭️ Email skipped for user ${userId} - email updates disabled`);
      return false;
    }

    await sendMailWithFallback({
      from: `"Household Of Covenant And Faith Apostolic Ministry" <${SMTP_FROM_ADDRESS}>`,
      to,
      subject,
      html: htmlContent,
    }, 'Password reset email');

    console.log(`✓ Email sent to ${to}`);
    return true;
  } catch (error) {
    console.error('Email send error:', error);
    return false;
  }
};

// Send event reminder email
export const sendEventReminderEmail = async (
  userId: number,
  to: string,
  eventName: string,
  eventDate: string,
  eventTime: string,
  eventLocation: string
): Promise<boolean> => {
  try {
    // Check if user has event reminders enabled
    const eventRemindersEnabled = await checkNotificationPreference(userId, 'event');
    
    if (!eventRemindersEnabled) {
      console.log(`⏭️ Event reminder skipped for user ${userId} - event reminders disabled`);
      return false;
    }

    const subject = `📅 Reminder: ${eventName}`;
    const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; background: #f9f9f9; }
    .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
    .content { background: white; padding: 30px; border-radius: 0 0 10px 10px; }
    .event-details { background: #f0f4ff; padding: 20px; border-radius: 8px; margin: 20px 0; }
    .button { display: inline-block; background: #667eea; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; margin: 20px 0; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>📅 Event Reminder</h1>
    </div>
    <div class="content">
      <p>This is a friendly reminder about an upcoming event:</p>
      
      <div class="event-details">
        <h2>${eventName}</h2>
        <p><strong>📅 Date:</strong> ${eventDate}</p>
        <p><strong>🕐 Time:</strong> ${eventTime}</p>
        <p><strong>📍 Location:</strong> ${eventLocation}</p>
      </div>
      
      <p>We look forward to seeing you there!</p>
      
      <p><em>God bless you!</em></p>
    </div>
  </div>
</body>
</html>
    `;

    return await sendEmailNotification(userId, to, subject, htmlContent);
  } catch (error) {
    console.error('Event reminder email error:', error);
    return false;
  }
};

// Send password reset email
export const sendPasswordResetEmail = async (
  to: string,
  firstName: string,
  resetToken: string
): Promise<boolean> => {
  try {
    const resetUrl = `${APP_BASE_URL}/reset-password?token=${resetToken}`;
    const expiryText = formatPasswordResetExpiry(PASSWORD_RESET_TOKEN_TTL_MINUTES);
    
    const subject = 'Password Reset Instructions - Household Of Covenant And Faith Apostolic Ministry';
    const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: #0b3b8f; color: white; padding: 28px 30px; text-align: center; border-radius: 10px 10px 0 0; }
    .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
    .button { display: inline-block; background: #0b3b8f; color: white; padding: 14px 35px; text-decoration: none; border-radius: 8px; margin: 20px 0; font-weight: bold; }
    .warning { background: #fff3cd; border-left: 4px solid #ffc107; padding: 15px; margin: 20px 0; border-radius: 4px; }
    .footer { text-align: center; margin-top: 30px; color: #666; font-size: 12px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1 style="margin:0;">Password Reset Request</h1>
      <p style="margin:10px 0 0;font-size:13px;opacity:.9;">Household Of Covenant And Faith Apostolic Ministry</p>
    </div>
    <div class="content">
      <h2>Hello ${firstName},</h2>
      
      <p>We received a request to reset your password for your HOCFAM account.</p>
      
      <p>Use the button below to continue:</p>
      
      <p style="text-align: center;">
        <a href="${resetUrl}" class="button">Reset Password</a>
      </p>
      
      <p>If the button does not open, copy and paste this link into your browser:</p>
      <p style="word-break: break-all; background: #fff; padding: 10px; border-radius: 4px; font-size: 12px;">
        ${resetUrl}
      </p>
      
      <div class="warning">
        <strong>Important:</strong>
        <ul style="margin: 10px 0;">
          <li>This link will expire in <strong>${expiryText}</strong>.</li>
          <li>If you did not request this change, you can safely ignore this email.</li>
          <li>Your current password remains unchanged until you complete the reset.</li>
        </ul>
      </div>
      
      <h3>Security Tips</h3>
      <ul>
        <li>Use a strong and unique password.</li>
        <li>Do not share your password with anyone.</li>
        <li>Contact support immediately if this request was not made by you.</li>
      </ul>
      
      <p><strong>Need help?</strong><br>
      Contact us at <a href="mailto:info@hocfam.org">info@hocfam.org</a></p>
      
      <p>Regards,<br>
      Household Of Covenant And Faith Apostolic Ministry</p>
    </div>
    <div class="footer">
      <p>© ${new Date().getFullYear()} Household Of Covenant And Faith Apostolic Ministry. All rights reserved.</p>
      <p>You're receiving this because a password reset was requested for your account.</p>
    </div>
  </div>
</body>
</html>
    `;

    await sendMailWithFallback({
      from: `"Household Of Covenant And Faith Apostolic Ministry" <${PASSWORD_RESET_FROM_ADDRESS}>`,
      to,
      subject,
      html: htmlContent,
    }, 'Password reset email');

    console.log(`✓ Password reset email sent to ${to}`);
    return true;
  } catch (error) {
    console.error('Password reset email error:', normalizeMailError(error));
    return false;
  }
};

// Send password changed notification email
export const sendPasswordChangedEmail = async (
  to: string,
  firstName: string
): Promise<boolean> => {
  try {
    const subject = '✅ Password Changed Successfully - Household Of Covenant And Faith Apostolic Ministry';
    const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
    .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
    .success { background: #d1fae5; border-left: 4px solid #10b981; padding: 15px; margin: 20px 0; border-radius: 4px; }
    .warning { background: #fee2e2; border-left: 4px solid #dc2626; padding: 15px; margin: 20px 0; border-radius: 4px; }
    .footer { text-align: center; margin-top: 30px; color: #666; font-size: 12px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>✅ Password Changed</h1>
    </div>
    <div class="content">
      <h2>Hello ${firstName}!</h2>
      
      <div class="success">
        <p><strong>✓ Your password has been changed successfully!</strong></p>
        <p>Date: ${new Date().toLocaleString()}</p>
      </div>
      
      <p>Your Household Of Covenant And Faith Apostolic Ministry account password was recently updated. You can now sign in with your new password.</p>
      
      <div class="warning">
        <strong>⚠️ Didn't make this change?</strong>
        <p>If you didn't request this password change, please contact us immediately at <a href="mailto:support@hocfam.org">support@hocfam.org</a> to secure your account.</p>
      </div>
      
      <h3>🔒 Account Security Tips</h3>
      <ul>
        <li>Keep your password private and secure</li>
        <li>Use a unique password for this account</li>
        <li>Change your password regularly</li>
        <li>Be cautious of phishing emails</li>
      </ul>
      
      <p><strong>Need help?</strong><br>
      Our support team is here for you:<br>
      Email: <a href="mailto:support@hocfam.org">support@hocfam.org</a></p>
      
      <p><strong>God bless you!</strong><br>
      The Household Of Covenant And Faith Apostolic Ministry Team</p>
    </div>
    <div class="footer">
      <p>© ${new Date().getFullYear()} Household Of Covenant And Faith Apostolic Ministry. All rights reserved.</p>
      <p>This is a security notification for your account.</p>
    </div>
  </div>
</body>
</html>
    `;

    await sendMailWithFallback({
      from: `"Household Of Covenant And Faith Apostolic Ministry" <${PASSWORD_RESET_FROM_ADDRESS}>`,
      to,
      subject,
      html: htmlContent,
    }, 'Password changed email');

    console.log(`✓ Password changed notification sent to ${to}`);
    return true;
  } catch (error) {
    console.error('Password changed email error:', normalizeMailError(error));
    return false;
  }
};

export default {
  sendWelcomeEmail,
  sendWelcomeSMS,
  checkNotificationPreference,
  sendEmailNotification,
  sendEventReminderEmail,
  sendPasswordResetEmail,
  sendPasswordChangedEmail,
};
