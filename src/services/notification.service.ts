import nodemailer from 'nodemailer';
import pool from '../config/database';

// Email configuration
const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST || 'smtp.gmail.com',
  port: parseInt(process.env.EMAIL_PORT || '587'),
  secure: false,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASSWORD,
  },
});

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

    await transporter.sendMail({
      from: `"Household Of Covenant And Faith Apostolic Ministry" <${process.env.EMAIL_USER || 'noreply@hocfam.org'}>`,
      to,
      subject,
      html: htmlContent,
    });

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
        <a href="#" class="button">Download Mobile App</a>
        <a href="#" class="button">View Events</a>
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

    await transporter.sendMail({
      from: `"Household Of Covenant And Faith Apostolic Ministry" <${process.env.EMAIL_USER || 'noreply@hocfam.org'}>`,
      to,
      subject,
      html: htmlContent,
    });

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
    const resetUrl = `${process.env.CLIENT_URL || 'http://localhost:5173'}/reset-password?token=${resetToken}`;
    
    const subject = '🔐 Password Reset Request - Household Of Covenant And Faith Apostolic Ministry';
    const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: linear-gradient(135deg, #9333ea 0%, #dc2626 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
    .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
    .button { display: inline-block; background: #9333ea; color: white; padding: 14px 35px; text-decoration: none; border-radius: 8px; margin: 20px 0; font-weight: bold; }
    .warning { background: #fff3cd; border-left: 4px solid #ffc107; padding: 15px; margin: 20px 0; border-radius: 4px; }
    .footer { text-align: center; margin-top: 30px; color: #666; font-size: 12px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>🔐 Password Reset Request</h1>
    </div>
    <div class="content">
      <h2>Hello ${firstName}!</h2>
      
      <p>We received a request to reset your password for your Household Of Covenant And Faith Apostolic Ministry account.</p>
      
      <p>Click the button below to reset your password:</p>
      
      <p style="text-align: center;">
        <a href="${resetUrl}" class="button">Reset Password</a>
      </p>
      
      <p>Or copy and paste this link into your browser:</p>
      <p style="word-break: break-all; background: #fff; padding: 10px; border-radius: 4px; font-size: 12px;">
        ${resetUrl}
      </p>
      
      <div class="warning">
        <strong>⚠️ Important:</strong>
        <ul style="margin: 10px 0;">
          <li>This link will expire in <strong>1 hour</strong></li>
          <li>If you didn't request this, please ignore this email</li>
          <li>Your password won't change unless you click the link above</li>
        </ul>
      </div>
      
      <h3>🔒 Security Tips</h3>
      <ul>
        <li>Never share your password with anyone</li>
        <li>Use a strong, unique password</li>
        <li>Enable two-factor authentication when available</li>
      </ul>
      
      <p><strong>Need help?</strong><br>
      Contact us at <a href="mailto:support@hocfam.org">support@hocfam.org</a></p>
      
      <p><strong>God bless you!</strong><br>
      The Household Of Covenant And Faith Apostolic Ministry Team</p>
    </div>
    <div class="footer">
      <p>© ${new Date().getFullYear()} Household Of Covenant And Faith Apostolic Ministry. All rights reserved.</p>
      <p>You're receiving this because a password reset was requested for your account.</p>
    </div>
  </div>
</body>
</html>
    `;

    await transporter.sendMail({
      from: `"Household Of Covenant And Faith Apostolic Ministry" <${process.env.EMAIL_USER || 'noreply@hocfam.org'}>`,
      to,
      subject,
      html: htmlContent,
    });

    console.log(`✓ Password reset email sent to ${to}`);
    return true;
  } catch (error) {
    console.error('Password reset email error:', error);
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

    await transporter.sendMail({
      from: `"Household Of Covenant And Faith Apostolic Ministry" <${process.env.EMAIL_USER || 'noreply@hocfam.org'}>`,
      to,
      subject,
      html: htmlContent,
    });

    console.log(`✓ Password changed notification sent to ${to}`);
    return true;
  } catch (error) {
    console.error('Password changed email error:', error);
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
