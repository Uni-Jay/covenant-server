"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendEventReminderEmail = exports.sendEmailNotification = exports.checkNotificationPreference = exports.sendWelcomeSMS = exports.sendWelcomeEmail = void 0;
const nodemailer_1 = __importDefault(require("nodemailer"));
const database_1 = __importDefault(require("../config/database"));
// Email configuration
const transporter = nodemailer_1.default.createTransport({
    host: process.env.EMAIL_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.EMAIL_PORT || '587'),
    secure: false,
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASSWORD,
    },
});
const sendWelcomeEmail = async (to, firstName, userType = 'member') => {
    try {
        const subject = userType === 'first_timer'
            ? '🙏 Welcome to Word of Covenant!'
            : '✨ Welcome to Word of Covenant Family!';
        const htmlContent = userType === 'first_timer'
            ? getFirstTimerWelcomeEmail(firstName)
            : getMemberWelcomeEmail(firstName);
        await transporter.sendMail({
            from: `"Word of Covenant" <${process.env.EMAIL_USER || 'noreply@wordofcovenant.org'}>`,
            to,
            subject,
            html: htmlContent,
        });
        console.log(`✓ Welcome email sent to ${to}`);
        return true;
    }
    catch (error) {
        console.error('Email send error:', error);
        return false;
    }
};
exports.sendWelcomeEmail = sendWelcomeEmail;
const sendWelcomeSMS = async (phone, firstName, userType = 'member') => {
    try {
        // Using Twilio or similar SMS service
        // For now, just log (implement actual SMS service as needed)
        const message = userType === 'first_timer'
            ? `Hi ${firstName}! 🙏 Welcome to Word of Covenant. We're blessed to have you! Download our app to stay connected. God bless you!`
            : `Welcome ${firstName}! ✨ You're now part of the Word of Covenant family. Check your email for next steps. Blessings!`;
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
    }
    catch (error) {
        console.error('SMS send error:', error);
        return false;
    }
};
exports.sendWelcomeSMS = sendWelcomeSMS;
const getMemberWelcomeEmail = (firstName) => `
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
      
      <p>We're absolutely thrilled to welcome you to the <strong>Word of Covenant</strong> family! Your registration is complete, and you're now part of a vibrant community of believers.</p>
      
      <h3>🎉 What's Next?</h3>
      <ul>
        <li><strong>Download the App:</strong> Stay connected with sermons, events, and live streams</li>
        <li><strong>Join a Department:</strong> Find your place in our ministries</li>
        <li><strong>Attend Services:</strong> We meet every Sunday at 9:00 AM</li>
        <li><strong>Connect:</strong> Join our community chat and fellowship</li>
      </ul>
      
      <h3>📱 Quick Links</h3>
      <p>
        <a href="#" class="button">Download Mobile App</a>
        <a href="#" class="button">View Events</a>
      </p>
      
      <h3>📞 Need Help?</h3>
      <p>Our team is here for you!</p>
      <ul>
        <li>Email: <a href="mailto:info@wordofcovenant.org">info@wordofcovenant.org</a></li>
        <li>Phone: Call during office hours</li>
        <li>Visit: Check our website for church location</li>
      </ul>
      
      <p><strong>God bless you abundantly!</strong></p>
      <p>The Word of Covenant Team</p>
    </div>
    <div class="footer">
      <p>© ${new Date().getFullYear()} Word of Covenant. All rights reserved.</p>
      <p>You're receiving this because you registered on our platform.</p>
    </div>
  </div>
</body>
</html>
`;
const getFirstTimerWelcomeEmail = (firstName) => `
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
      
      <p>Thank you for visiting <strong>Word of Covenant</strong>! We're absolutely blessed that you chose to worship with us. Your presence made our service even more special.</p>
      
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
        <a href="#" class="button">View Our Events</a>
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
      Email: <a href="mailto:info@wordofcovenant.org">info@wordofcovenant.org</a></p>
      
      <p><em>"For where two or three gather in my name, there am I with them." - Matthew 18:20</em></p>
      
      <p><strong>See you soon!</strong><br>
      Pastor & The Word of Covenant Family</p>
    </div>
    <div class="footer">
      <p>© ${new Date().getFullYear()} Word of Covenant. All rights reserved.</p>
    </div>
  </div>
</body>
</html>
`;
// Check if user has enabled specific notification type
const checkNotificationPreference = async (userId, notificationType) => {
    try {
        const [users] = await database_1.default.execute('SELECT push_notifications, email_updates, event_reminders FROM users WHERE id = ?', [userId]);
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
    }
    catch (error) {
        console.error('Error checking notification preference:', error);
        return true; // Default to enabled on error
    }
};
exports.checkNotificationPreference = checkNotificationPreference;
// Send email with preference check
const sendEmailNotification = async (userId, to, subject, htmlContent) => {
    try {
        // Check if user has email notifications enabled
        const emailEnabled = await (0, exports.checkNotificationPreference)(userId, 'email');
        if (!emailEnabled) {
            console.log(`⏭️ Email skipped for user ${userId} - email updates disabled`);
            return false;
        }
        await transporter.sendMail({
            from: `"Word of Covenant" <${process.env.EMAIL_USER || 'noreply@wordofcovenant.org'}>`,
            to,
            subject,
            html: htmlContent,
        });
        console.log(`✓ Email sent to ${to}`);
        return true;
    }
    catch (error) {
        console.error('Email send error:', error);
        return false;
    }
};
exports.sendEmailNotification = sendEmailNotification;
// Send event reminder email
const sendEventReminderEmail = async (userId, to, eventName, eventDate, eventTime, eventLocation) => {
    try {
        // Check if user has event reminders enabled
        const eventRemindersEnabled = await (0, exports.checkNotificationPreference)(userId, 'event');
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
        return await (0, exports.sendEmailNotification)(userId, to, subject, htmlContent);
    }
    catch (error) {
        console.error('Event reminder email error:', error);
        return false;
    }
};
exports.sendEventReminderEmail = sendEventReminderEmail;
exports.default = {
    sendWelcomeEmail: exports.sendWelcomeEmail,
    sendWelcomeSMS: exports.sendWelcomeSMS,
    checkNotificationPreference: exports.checkNotificationPreference,
    sendEmailNotification: exports.sendEmailNotification,
    sendEventReminderEmail: exports.sendEventReminderEmail,
};
