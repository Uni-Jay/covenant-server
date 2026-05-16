import { Router } from 'express';
import pool from '../config/database';
import { authenticate, isAdmin } from '../middleware/auth.middleware';
import { sendBrevoTransactionalEmail } from '../services/email.service';

const router = Router();

const prayerAdminRecipient = process.env.PRAYER_REQUEST_EMAIL || 'admin@hocfam.org';
const MAIL_BRAND_LOGO_URL = process.env.MAIL_BRAND_LOGO_URL || 'https://hocfam.org/image/New_Logo.png';

// Get all prayer requests (admin/media only)
router.get('/all', authenticate, async (req, res) => {
  try {
    const user = (req as any).user;
    
    // Check if user is admin or media
    const isAdminOrMedia = user.role && ['super_admin', 'admin', 'gen_overseer', 'senior_pastor', 'pastor', 'media'].includes(user.role);
    
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
      const prayerSubject = `[Prayer Request] ${String(category || 'general').toUpperCase()}${isUrgent ? ' - URGENT' : ''}`;
      const formattedPrayer = String(finalRequest || '').replace(/\n/g, '<br/>');
      const prayerHtml = `
            <div style="margin:0;padding:24px;background:#f4f7fb;font-family:'Segoe UI',Arial,sans-serif;color:#0f172a;">
              <table role="presentation" style="width:100%;max-width:700px;margin:0 auto;background:#ffffff;border:1px solid #e2e8f0;border-radius:12px;overflow:hidden;border-collapse:separate;">
                <tr>
                  <td style="padding:20px 24px;background:#0d5f45;color:#ffffff;">
                    <img src="${MAIL_BRAND_LOGO_URL}" alt="HOCFAM Logo" style="display:block;width:56px;height:56px;object-fit:contain;background:#ffffff;border-radius:10px;padding:6px;margin-bottom:10px;" />
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

      const emailDelivered = await sendBrevoTransactionalEmail({
        from: `"${senderDisplay}" <info@hocfam.org>`,
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
        warning: emailDelivered ? undefined : 'Prayer request saved, but delivery failed.',
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
    const isAdminOrMedia = user.role && ['super_admin', 'admin', 'gen_overseer', 'senior_pastor', 'pastor', 'media'].includes(user.role);
    
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
