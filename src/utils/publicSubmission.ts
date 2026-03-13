import nodemailer from 'nodemailer';
import pool from '../config/database';

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

const SMTP_PORT = parseEnvNumber(process.env.EMAIL_PORT, 587);
const SMTP_SECURE = parseEnvBoolean(process.env.EMAIL_SECURE, false);

const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST || 'smtp.zoho.com',
  port: SMTP_PORT,
  secure: SMTP_SECURE,
  auth: {
    user: process.env.EMAIL_INFO_USER || process.env.EMAIL_USER,
    pass: process.env.EMAIL_INFO_PASSWORD || process.env.EMAIL_PASSWORD,
  },
});

type SubmissionPayload = {
  name: string;
  email: string;
  phone?: string;
  subject: string;
  message: string;
  recipient?: string;
};

export async function savePublicSubmission(payload: SubmissionPayload) {
  const { name, email, phone, subject, message } = payload;
  const [result]: any = await pool.execute(
    'INSERT INTO contact_messages (name, email, phone, subject, message) VALUES (?, ?, ?, ?, ?)',
    [name, email, phone || null, subject, message]
  );

  return result.insertId as number;
}

export async function notifyPublicSubmission(payload: SubmissionPayload) {
  const recipient = payload.recipient || process.env.ORG_EMAIL_INFO || 'info@hocfam.org';
  const fromAddress = process.env.EMAIL_INFO_USER || process.env.EMAIL_USER || recipient;

  try {
    await transporter.sendMail({
      from: `"HOCFAM Website" <${fromAddress}>`,
      to: recipient,
      replyTo: payload.email,
      subject: payload.subject,
      html: payload.message,
    });

    return true;
  } catch (error) {
    console.error('Public submission email dispatch failed:', error);
    return false;
  }
}