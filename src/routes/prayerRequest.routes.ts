import { Router } from 'express';
import pool from '../config/database';
import { authenticate, isAdmin } from '../middleware/auth.middleware';
import nodemailer from 'nodemailer';

const router = Router();

const prayerAdminRecipient = process.env.PRAYER_REQUEST_EMAIL || 'admin@hocfam.org';
const PRAYER_SMTP_TIMEOUT_MS = parseInt((process.env.SMTP_TIMEOUT_MS || '2500').replace(/[^0-9]/g, '') || '2500', 10);
const PRAYER_BLOCKING_WAIT_MS = parseInt((process.env.SMTP_BLOCKING_WAIT_MS || '2500').replace(/[^0-9]/g, '') || '2500', 10);
const PRAYER_EMAIL_MODE = (process.env.EMAIL_MODE || 'auto').trim().toLowerCase();
const PRAYER_RESEND_ONLY_MODE = PRAYER_EMAIL_MODE === 'resend' || PRAYER_EMAIL_MODE === 'api';
const PRAYER_SMTP_ONLY_MODE = PRAYER_EMAIL_MODE === 'smtp';
const PRAYER_RESEND_API_KEY = process.env.RESEND_API_KEY;
const PRAYER_RESEND_FROM = process.env.RESEND_FROM || process.env.EMAIL_ADMIN_USER || process.env.EMAIL_USER || 'admin@hocfam.org';

const prayerTransporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST || 'smtp.zoho.com',
  port: parseInt(process.env.EMAIL_PORT || '587'),
  secure: (process.env.EMAIL_SECURE || 'false') === 'true',
  connectionTimeout: PRAYER_SMTP_TIMEOUT_MS,
  greetingTimeout: PRAYER_SMTP_TIMEOUT_MS,
  socketTimeout: PRAYER_SMTP_TIMEOUT_MS,
  auth: {
    user: process.env.EMAIL_ADMIN_USER || process.env.EMAIL_USER,
    pass: process.env.EMAIL_ADMIN_PASSWORD || process.env.EMAIL_PASSWORD,
  },
});

async function sendPrayerViaResend(mailOptions: nodemailer.SendMailOptions): Promise<boolean> {
  if (!PRAYER_RESEND_API_KEY) {
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
        Authorization: `Bearer ${PRAYER_RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: PRAYER_RESEND_FROM,
        to,
        subject: String(mailOptions.subject || ''),
        html: String(mailOptions.html || ''),
        reply_to: mailOptions.replyTo ? String(mailOptions.replyTo) : undefined,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Prayer request email dispatch failed via Resend:', {
        status: response.status,
        body: errorText,
      });
      return false;
    }

    return true;
  } catch (error) {
    console.error('Prayer request email dispatch failed via Resend:', error instanceof Error ? error.message : String(error));
    return false;
  }
}

// Get all prayer requests (admin/media only)
router.get('/all', authenticate, async (req, res) => {
  try {
    const user = (req as any).user;
    
    // Check if user is admin or media
    const isAdminOrMedia = user.role && ['super_admin', 'admin', 'media_head', 'media'].includes(user.role);
    
    if (!isAdminOrMedia) {
      // Check if user belongs to media or prayer team department
      let userDepartments: string[] = [];
      if (user.departments) {
        if (Array.isArray(user.departments)) {
          userDepartments = user.departments;
        } else if (typeof user.departments === 'string') {
          try {
            userDepartments = JSON.parse(user.departments);
          } catch {
            userDepartments = user.departments.split(',').map((d: string) => d.trim()).filter((d: string) => d);
          }
        }
      }
      
      const hasAccess = userDepartments.some(dept => {
        const deptName = dept.toLowerCase().trim();
        return deptName.includes('media') || deptName.includes('prayer');
      });
      
      if (!hasAccess) {
        return res.status(403).json({ message: 'Access denied' });
      }
    }
    
    const [requests] = await pool.execute(
      'SELECT * FROM prayer_requests ORDER BY created_at DESC'
    );
    res.json({ requests });
  } catch (error) {
    console.error('Fetch all prayer requests error:', error);
    res.status(500).json({ message: 'Failed to fetch prayer requests' });
  }
});

// Get user's own prayer requests
router.get('/my-prayers', authenticate, async (req, res) => {
  try {
    const user = (req as any).user;
    const [requests] = await pool.execute(
      'SELECT * FROM prayer_requests WHERE email = ? ORDER BY created_at DESC',
      [user.email]
    );
    res.json({ requests });
  } catch (error) {
    console.error('Fetch my prayers error:', error);
    res.status(500).json({ message: 'Failed to fetch your prayer requests' });
  }
});

router.post('/', async (req, res) => {
  try {
    const { name, email, phoneNumber, phone, requestText, request, category, isAnonymous, isUrgent, source } = req.body;
    
    // Support both field name formats
    const finalPhone = phoneNumber || phone;
    const finalRequest = requestText || request;
    
    const [result]: any = await pool.execute(
      'INSERT INTO prayer_requests (name, email, phone, request, category, is_anonymous) VALUES (?, ?, ?, ?, ?, ?)',
      [isAnonymous ? null : name, isAnonymous ? null : email, isAnonymous ? null : finalPhone, finalRequest, category, isAnonymous || false]
    );

    // Website submissions should notify admin mailbox; mobile keeps previous behavior (DB save only).
    if (source === 'website') {
      const senderDisplay = isAnonymous ? 'Anonymous Prayer Request' : `${name || 'Someone'} via HOCFAM`;
      const senderEmail = process.env.EMAIL_ADMIN_USER || process.env.EMAIL_USER || 'admin@hocfam.org';
      const prayerSubject = `[Prayer Request] ${String(category || 'general').toUpperCase()}${isUrgent ? ' - URGENT' : ''}`;
      const formattedPrayer = String(finalRequest || '').replace(/\n/g, '<br/>');
      const prayerHtml = `
            <div style="margin:0;padding:24px;background:#f4f7fb;font-family:'Segoe UI',Arial,sans-serif;color:#0f172a;">
              <table role="presentation" style="width:100%;max-width:700px;margin:0 auto;background:#ffffff;border:1px solid #e2e8f0;border-radius:12px;overflow:hidden;border-collapse:separate;">
                <tr>
                  <td style="padding:20px 24px;background:#0d5f45;color:#ffffff;">
                    <div style="font-size:12px;letter-spacing:.08em;text-transform:uppercase;opacity:.9;">HOCFAM Prayer Desk</div>
                    <h2 style="margin:8px 0 0;font-size:22px;line-height:1.3;">New Prayer Request</h2>
                  </td>
                </tr>
                <tr>
                  <td style="padding:20px 24px;">
                    <p style="margin:0 0 14px;font-size:14px;color:#334155;">A prayer request has been submitted from the website.</p>
                    <table role="presentation" style="width:100%;border-collapse:collapse;font-size:14px;">
                      <tr>
                        <td style="padding:8px 0;color:#475569;width:140px;"><strong>Category</strong></td>
                        <td style="padding:8px 0;color:#0f172a;text-transform:capitalize;">${category || 'general'}</td>
                      </tr>
                      <tr>
                        <td style="padding:8px 0;color:#475569;"><strong>Source</strong></td>
                        <td style="padding:8px 0;color:#0f172a;">Website</td>
                      </tr>
                      <tr>
                        <td style="padding:8px 0;color:#475569;"><strong>Urgent</strong></td>
                        <td style="padding:8px 0;color:#0f172a;">${isUrgent ? 'Yes' : 'No'}</td>
                      </tr>
                      <tr>
                        <td style="padding:8px 0;color:#475569;"><strong>Anonymous</strong></td>
                        <td style="padding:8px 0;color:#0f172a;">${isAnonymous ? 'Yes' : 'No'}</td>
                      </tr>
                      <tr>
                        <td style="padding:8px 0;color:#475569;"><strong>Name</strong></td>
                        <td style="padding:8px 0;color:#0f172a;">${isAnonymous ? 'Anonymous' : (name || 'Not provided')}</td>
                      </tr>
                      <tr>
                        <td style="padding:8px 0;color:#475569;"><strong>Email</strong></td>
                        <td style="padding:8px 0;color:#0f172a;">${isAnonymous ? 'Anonymous' : (email || 'Not provided')}</td>
                      </tr>
                      <tr>
                        <td style="padding:8px 0;color:#475569;"><strong>Phone</strong></td>
                        <td style="padding:8px 0;color:#0f172a;">${isAnonymous ? 'Anonymous' : (finalPhone || 'Not provided')}</td>
                      </tr>
                    </table>
                    <div style="margin-top:16px;padding:16px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;">
                      <div style="margin:0 0 8px;font-size:12px;letter-spacing:.04em;text-transform:uppercase;color:#64748b;">Prayer Request</div>
                      <div style="font-size:14px;line-height:1.65;color:#0f172a;">${formattedPrayer}</div>
                    </div>
                  </td>
                </tr>
              </table>
            </div>
          `;

      if (PRAYER_RESEND_ONLY_MODE && !PRAYER_SMTP_ONLY_MODE) {
        const emailDelivered = await sendPrayerViaResend({
          from: `"${senderDisplay}" <${PRAYER_RESEND_FROM}>`,
          to: prayerAdminRecipient,
          replyTo: isAnonymous ? undefined : email,
          subject: prayerSubject,
          html: prayerHtml,
        });

        return res.status(emailDelivered ? 201 : 202).json({
          message: 'Prayer request submitted',
          id: result.insertId,
          routedTo: prayerAdminRecipient,
          emailDelivered,
          warning: emailDelivered ? undefined : `Prayer request saved, but delivery failed in EMAIL_MODE=${PRAYER_EMAIL_MODE}.`,
        });
      }

      const mailPromise = prayerTransporter.sendMail({
          from: `"${senderDisplay}" <${senderEmail}>`,
          to: prayerAdminRecipient,
          replyTo: isAnonymous ? undefined : email,
          subject: prayerSubject,
          html: prayerHtml,
        });

      let emailDelivered = true;
      try {
        await Promise.race([
          mailPromise,
          new Promise((_, reject) => {
            setTimeout(() => reject(new Error(`Prayer email wait timed out after ${PRAYER_BLOCKING_WAIT_MS}ms`)), PRAYER_BLOCKING_WAIT_MS);
          }),
        ]);
      } catch (mailError) {
        console.error('Prayer request email dispatch failed:', mailError instanceof Error ? mailError.message : String(mailError));
        emailDelivered = false;
        void mailPromise.catch(() => undefined);
      }

      return res.status(emailDelivered ? 201 : 202).json({
        message: 'Prayer request submitted',
        id: result.insertId,
        routedTo: prayerAdminRecipient,
        emailDelivered,
        warning: emailDelivered ? undefined : 'Prayer request saved, but email delivery failed. Please check SMTP credentials and logs.',
      });
    }

    res.status(201).json({ message: 'Prayer request submitted', id: result.insertId });
  } catch (error) {
    console.error('Prayer request submission error:', error);
    res.status(500).json({ message: 'Failed to submit prayer request', error: error instanceof Error ? error.message : 'Unknown error' });
  }
});

router.patch('/:id', authenticate, async (req, res) => {
  try {
    const user = (req as any).user;
    const { status } = req.body;
    
    // Check if user is admin or media
    const isAdminOrMedia = user.role && ['super_admin', 'admin', 'media_head', 'media'].includes(user.role);
    
    if (!isAdminOrMedia) {
      // Check if user belongs to media or prayer team department
      let userDepartments: string[] = [];
      if (user.departments) {
        if (Array.isArray(user.departments)) {
          userDepartments = user.departments;
        } else if (typeof user.departments === 'string') {
          try {
            userDepartments = JSON.parse(user.departments);
          } catch {
            userDepartments = user.departments.split(',').map((d: string) => d.trim()).filter((d: string) => d);
          }
        }
      }
      
      const hasAccess = userDepartments.some(dept => {
        const deptName = dept.toLowerCase().trim();
        return deptName.includes('media') || deptName.includes('prayer');
      });
      
      if (!hasAccess) {
        return res.status(403).json({ message: 'Access denied' });
      }
    }
    
    await pool.execute(
      'UPDATE prayer_requests SET status = ?, updated_at = NOW() WHERE id = ?',
      [status, req.params.id]
    );
    res.json({ message: 'Status updated successfully' });
  } catch (error) {
    console.error('Update status error:', error);
    res.status(500).json({ message: 'Failed to update status' });
  }
});

router.delete('/:id', authenticate, isAdmin, async (req, res) => {
  try {
    await pool.execute('DELETE FROM prayer_requests WHERE id = ?', [req.params.id]);
    res.json({ message: 'Prayer request deleted' });
  } catch (error) {
    res.status(500).json({ message: 'Failed to delete prayer request' });
  }
});

export default router;
