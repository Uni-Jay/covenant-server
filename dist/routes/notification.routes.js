"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const auth_middleware_1 = require("../middleware/auth.middleware");
const permissions_middleware_1 = require("../middleware/permissions.middleware");
const database_1 = __importDefault(require("../config/database"));
const nodemailer_1 = __importDefault(require("nodemailer"));
const router = express_1.default.Router();
// Email transporter configuration (using Gmail as example)
const emailTransporter = nodemailer_1.default.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USER || 'your-church-email@gmail.com',
        pass: process.env.EMAIL_PASSWORD || 'your-app-password'
    }
});
// SMS service configuration (Africa's Talking example)
// You can also use Twilio by changing the API endpoint
const SMS_API_KEY = process.env.SMS_API_KEY || '';
const SMS_USERNAME = process.env.SMS_USERNAME || 'sandbox';
const SMS_SENDER = process.env.SMS_SENDER || 'WORDCOV';
// Helper function to send email
async function sendEmail(to, subject, message) {
    try {
        await emailTransporter.sendMail({
            from: process.env.EMAIL_USER || 'Word of Covenant <noreply@wordofcovenant.org>',
            to,
            subject,
            html: message
        });
        return { success: true };
    }
    catch (error) {
        console.error('Email error:', error);
        return { success: false, error: error.message };
    }
}
// Helper function to send SMS (Africa's Talking)
async function sendSMS(phone, message) {
    try {
        const response = await fetch('https://api.africastalking.com/version1/messaging', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'apiKey': SMS_API_KEY,
                'Accept': 'application/json'
            },
            body: new URLSearchParams({
                username: SMS_USERNAME,
                to: phone,
                message: message,
                from: SMS_SENDER
            })
        });
        const data = await response.json();
        return { success: true, data };
    }
    catch (error) {
        console.error('SMS error:', error);
        return { success: false, error: error.message };
    }
}
// Send event reminder to all users and first-timers
router.post('/send-event-reminder', auth_middleware_1.authenticate, (0, permissions_middleware_1.requirePermission)('manage_events'), async (req, res) => {
    const { eventId, message, subject, sendEmail: shouldSendEmail, sendSMS: shouldSendSMS } = req.body;
    const connection = await database_1.default.getConnection();
    try {
        await connection.beginTransaction();
        // Get event details
        const [eventRows] = await connection.execute('SELECT * FROM events WHERE id = ?', [eventId]);
        if (!eventRows || eventRows.length === 0) {
            await connection.rollback();
            return res.status(404).json({ message: 'Event not found' });
        }
        const event = eventRows[0];
        // Get all users with email and phone
        const [users] = await connection.execute(`SELECT id, email, phone_number, CONCAT(first_name, ' ', last_name) as name 
       FROM users 
       WHERE is_approved = TRUE`);
        // Get all first-timers
        const [firstTimers] = await connection.execute(`SELECT id, email, phone, CONCAT(first_name, ' ', last_name) as name 
       FROM first_timers 
       WHERE is_converted_to_member = FALSE`);
        const recipients = [];
        // Queue notifications for users
        for (const user of users) {
            if (shouldSendEmail && user.email) {
                const emailMessage = `
          <h2>Event Reminder</h2>
          <p>Dear ${user.name},</p>
          <p>${message}</p>
          <h3>${event.title}</h3>
          <p><strong>Date:</strong> ${new Date(event.date).toLocaleDateString()}</p>
          <p><strong>Time:</strong> ${event.time || 'TBD'}</p>
          <p><strong>Location:</strong> ${event.location || 'Church premises'}</p>
          <p>We look forward to seeing you!</p>
          <p>God bless,<br/>Word of Covenant Church</p>
        `;
                await connection.execute(`INSERT INTO notification_queue 
           (recipient_type, recipient_id, notification_type, subject, message, email_to, event_id, status) 
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`, ['user', user.id, 'email', subject, emailMessage, user.email, eventId, 'pending']);
                // Send email immediately
                const emailResult = await sendEmail(user.email, subject, emailMessage);
                if (emailResult.success) {
                    await connection.execute(`UPDATE notification_queue SET status = 'sent', sent_at = NOW() WHERE email_to = ? AND event_id = ?`, [user.email, eventId]);
                    recipients.push({ type: 'email', to: user.email, status: 'sent' });
                }
                else {
                    await connection.execute(`UPDATE notification_queue SET status = 'failed', error_message = ? WHERE email_to = ? AND event_id = ?`, [emailResult.error, user.email, eventId]);
                }
            }
            if (shouldSendSMS && user.phone_number) {
                const smsMessage = `Event Reminder: ${event.title}\nDate: ${new Date(event.date).toLocaleDateString()}\n${message}\n- Word of Covenant`;
                await connection.execute(`INSERT INTO notification_queue 
           (recipient_type, recipient_id, notification_type, message, phone_to, event_id, status) 
           VALUES (?, ?, ?, ?, ?, ?, ?)`, ['user', user.id, 'sms', smsMessage, user.phone_number, eventId, 'pending']);
                // Send SMS immediately
                const smsResult = await sendSMS(user.phone_number, smsMessage);
                if (smsResult.success) {
                    await connection.execute(`UPDATE notification_queue SET status = 'sent', sent_at = NOW() WHERE phone_to = ? AND event_id = ?`, [user.phone_number, eventId]);
                    recipients.push({ type: 'sms', to: user.phone_number, status: 'sent' });
                }
                else {
                    await connection.execute(`UPDATE notification_queue SET status = 'failed', error_message = ? WHERE phone_to = ? AND event_id = ?`, [smsResult.error, user.phone_number, eventId]);
                }
            }
        }
        // Queue notifications for first-timers
        for (const firstTimer of firstTimers) {
            if (shouldSendEmail && firstTimer.email) {
                const emailMessage = `
          <h2>Event Reminder</h2>
          <p>Dear ${firstTimer.name},</p>
          <p>${message}</p>
          <h3>${event.title}</h3>
          <p><strong>Date:</strong> ${new Date(event.date).toLocaleDateString()}</p>
          <p><strong>Time:</strong> ${event.time || 'TBD'}</p>
          <p><strong>Location:</strong> ${event.location || 'Church premises'}</p>
          <p>We would love to see you again!</p>
          <p>God bless,<br/>Word of Covenant Church</p>
        `;
                await connection.execute(`INSERT INTO notification_queue 
           (recipient_type, recipient_id, notification_type, subject, message, email_to, event_id, status) 
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`, ['first_timer', firstTimer.id, 'email', subject, emailMessage, firstTimer.email, eventId, 'pending']);
                const emailResult = await sendEmail(firstTimer.email, subject, emailMessage);
                if (emailResult.success) {
                    await connection.execute(`UPDATE notification_queue SET status = 'sent', sent_at = NOW() WHERE email_to = ? AND event_id = ?`, [firstTimer.email, eventId]);
                    recipients.push({ type: 'email', to: firstTimer.email, status: 'sent' });
                }
            }
            if (shouldSendSMS && firstTimer.phone) {
                const smsMessage = `Event Reminder: ${event.title}\nDate: ${new Date(event.date).toLocaleDateString()}\n${message}\n- Word of Covenant`;
                await connection.execute(`INSERT INTO notification_queue 
           (recipient_type, recipient_id, notification_type, message, phone_to, event_id, status) 
           VALUES (?, ?, ?, ?, ?, ?, ?)`, ['first_timer', firstTimer.id, 'sms', smsMessage, firstTimer.phone, eventId, 'pending']);
                const smsResult = await sendSMS(firstTimer.phone, smsMessage);
                if (smsResult.success) {
                    await connection.execute(`UPDATE notification_queue SET status = 'sent', sent_at = NOW() WHERE phone_to = ? AND event_id = ?`, [firstTimer.phone, eventId]);
                    recipients.push({ type: 'sms', to: firstTimer.phone, status: 'sent' });
                }
            }
        }
        await connection.commit();
        res.json({
            message: 'Notifications sent successfully',
            totalRecipients: recipients.length,
            details: recipients
        });
    }
    catch (error) {
        await connection.rollback();
        console.error('Send event reminder error:', error);
        res.status(500).json({ message: 'Failed to send notifications', error: error.message });
    }
    finally {
        connection.release();
    }
});
// Get notification queue (for admin/media_head)
router.get('/queue', auth_middleware_1.authenticate, (0, permissions_middleware_1.requirePermission)('view_dashboard'), async (req, res) => {
    const { status } = req.query;
    try {
        let query = `
      SELECT nq.*, e.title as event_title, e.date as event_date
      FROM notification_queue nq
      LEFT JOIN events e ON nq.event_id = e.id
    `;
        const params = [];
        if (status) {
            query += ' WHERE nq.status = ?';
            params.push(status);
        }
        query += ' ORDER BY nq.created_at DESC LIMIT 100';
        const [notifications] = await database_1.default.execute(query, params);
        res.json(notifications);
    }
    catch (error) {
        console.error('Get queue error:', error);
        res.status(500).json({ message: 'Failed to get notifications', error: error.message });
    }
});
// Retry failed notification
router.post('/retry/:id', auth_middleware_1.authenticate, (0, permissions_middleware_1.requirePermission)('manage_events'), async (req, res) => {
    const { id } = req.params;
    try {
        const [notifications] = await database_1.default.execute('SELECT * FROM notification_queue WHERE id = ? AND status = "failed"', [id]);
        if (!notifications || notifications.length === 0) {
            return res.status(404).json({ message: 'Notification not found or not in failed status' });
        }
        const notification = notifications[0];
        let result;
        if (notification.notification_type === 'email' && notification.email_to) {
            result = await sendEmail(notification.email_to, notification.subject, notification.message);
        }
        else if (notification.notification_type === 'sms' && notification.phone_to) {
            result = await sendSMS(notification.phone_to, notification.message);
        }
        if (result?.success) {
            await database_1.default.execute(`UPDATE notification_queue SET status = 'sent', sent_at = NOW(), error_message = NULL WHERE id = ?`, [id]);
            res.json({ message: 'Notification resent successfully' });
        }
        else {
            await database_1.default.execute(`UPDATE notification_queue SET error_message = ? WHERE id = ?`, [result?.error || 'Unknown error', id]);
            res.status(500).json({ message: 'Failed to resend notification', error: result?.error });
        }
    }
    catch (error) {
        console.error('Retry notification error:', error);
        res.status(500).json({ message: 'Failed to retry notification', error: error.message });
    }
});
// Send custom notification to specific role
router.post('/send-to-role', auth_middleware_1.authenticate, (0, permissions_middleware_1.requirePermission)('manage_events'), async (req, res) => {
    const { role, message, subject, sendEmail: shouldSendEmail, sendSMS: shouldSendSMS } = req.body;
    try {
        const [users] = await database_1.default.execute(`SELECT id, email, phone_number, CONCAT(first_name, ' ', last_name) as name, role 
       FROM users 
       WHERE role = ? AND is_approved = TRUE`, [role]);
        const recipients = [];
        for (const user of users) {
            if (shouldSendEmail && user.email) {
                const emailMessage = `
          <h2>Notification from Word of Covenant</h2>
          <p>Dear ${user.name},</p>
          <p>${message}</p>
          <p>God bless,<br/>Word of Covenant Church</p>
        `;
                await database_1.default.execute(`INSERT INTO notification_queue 
           (recipient_type, recipient_id, recipient_role, notification_type, subject, message, email_to, status) 
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`, ['role', user.id, role, 'email', subject, emailMessage, user.email, 'pending']);
                const emailResult = await sendEmail(user.email, subject, emailMessage);
                if (emailResult.success) {
                    await database_1.default.execute(`UPDATE notification_queue SET status = 'sent', sent_at = NOW() WHERE email_to = ? AND recipient_role = ?`, [user.email, role]);
                    recipients.push({ type: 'email', to: user.email, status: 'sent' });
                }
            }
            if (shouldSendSMS && user.phone_number) {
                const smsMessage = `${message}\n- Word of Covenant`;
                await database_1.default.execute(`INSERT INTO notification_queue 
           (recipient_type, recipient_id, recipient_role, notification_type, message, phone_to, status) 
           VALUES (?, ?, ?, ?, ?, ?, ?)`, ['role', user.id, role, 'sms', smsMessage, user.phone_number, 'pending']);
                const smsResult = await sendSMS(user.phone_number, smsMessage);
                if (smsResult.success) {
                    await database_1.default.execute(`UPDATE notification_queue SET status = 'sent', sent_at = NOW() WHERE phone_to = ? AND recipient_role = ?`, [user.phone_number, role]);
                    recipients.push({ type: 'sms', to: user.phone_number, status: 'sent' });
                }
            }
        }
        res.json({
            message: 'Notifications sent successfully',
            totalRecipients: recipients.length,
            details: recipients
        });
    }
    catch (error) {
        console.error('Send to role error:', error);
        res.status(500).json({ message: 'Failed to send notifications', error: error.message });
    }
});
exports.default = router;
