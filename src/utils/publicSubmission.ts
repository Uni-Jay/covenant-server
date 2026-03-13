import nodemailer from 'nodemailer';
import pool from '../config/database';

const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST || 'smtp.zoho.com',
  port: parseInt(process.env.EMAIL_PORT || '587'),
  secure: (process.env.EMAIL_SECURE || 'false') === 'true',
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