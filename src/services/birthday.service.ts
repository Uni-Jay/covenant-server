import cron from 'node-cron';
import pool from '../config/database';
import nodemailer from 'nodemailer';

// Configure email transporter
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASSWORD,
  },
});

// Send birthday email
async function sendBirthdayEmail(email: string, name: string) {
  try {
    await transporter.sendMail({
      from: `"Word of Covenant Church" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: '🎂 Happy Birthday from Word of Covenant Church!',
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
            .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
            .birthday-emoji { font-size: 48px; margin: 20px 0; }
            .message { font-size: 18px; margin: 20px 0; }
            .verse { background: white; padding: 20px; border-left: 4px solid #667eea; margin: 20px 0; font-style: italic; }
            .footer { text-align: center; margin-top: 30px; color: #666; font-size: 14px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>🎉 Happy Birthday, ${name}! 🎉</h1>
            </div>
            <div class="content">
              <div class="birthday-emoji">🎂🎈🎁</div>
              
              <div class="message">
                <p>Dear ${name},</p>
                
                <p>On this special day, the entire Word of Covenant Church family celebrates YOU! 
                We thank God for the gift of your life and the blessing you are to our community.</p>
                
                <div class="verse">
                  <p><strong>"For I know the plans I have for you," declares the LORD, "plans to prosper you and not to harm you, plans to give you hope and a future."</strong></p>
                  <p style="text-align: right; margin-top: 10px;">- Jeremiah 29:11</p>
                </div>
                
                <p>May this new year of your life be filled with:</p>
                <ul>
                  <li>🙏 God's abundant grace and mercy</li>
                  <li>💫 Divine favor in all your endeavors</li>
                  <li>❤️ Love, joy, and peace that surpasses understanding</li>
                  <li>🌟 New opportunities and breakthroughs</li>
                  <li>🎯 Purpose and fulfillment in Christ</li>
                </ul>
                
                <p>We are praying for you today and always. May the Lord bless you and keep you, 
                make His face shine upon you, and give you peace.</p>
                
                <p style="margin-top: 30px;"><strong>With love and prayers,</strong><br>
                Your Word of Covenant Church Family 💜</p>
              </div>
              
              <div class="footer">
                <p>📍 Word of Covenant Church<br>
                "Light of the World" - John 8:12</p>
              </div>
            </div>
          </div>
        </body>
        </html>
      `,
    });
    console.log(`✅ Birthday email sent to ${email}`);
  } catch (error) {
    console.error(`❌ Failed to send birthday email to ${email}:`, error);
  }
}

// Send birthday SMS
async function sendBirthdaySMS(phone: string, name: string) {
  // Note: Implement SMS service integration here (Twilio, Africa's Talking, etc.)
  console.log(`📱 Birthday SMS would be sent to ${phone}: Happy Birthday ${name}! 🎂`);
  
  // Example with Twilio:
  // const twilio = require('twilio');
  // const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
  // await client.messages.create({
  //   body: `🎉 Happy Birthday ${name}! May God bless you abundantly on your special day. - Word of Covenant Church 💜`,
  //   from: process.env.TWILIO_PHONE_NUMBER,
  //   to: phone
  // });
}

// Check for birthdays and send messages
async function checkBirthdays() {
  try {
    console.log('🎂 Checking for birthdays...');
    
    const [users]: any = await pool.execute(`
      SELECT id, first_name, last_name, email, phone, date_of_birth
      FROM users 
      WHERE DATE_FORMAT(date_of_birth, '%m-%d') = DATE_FORMAT(CURDATE(), '%m-%d')
      AND date_of_birth IS NOT NULL
    `);

    if (users.length === 0) {
      console.log('No birthdays today');
      return;
    }

    console.log(`🎉 Found ${users.length} birthday(s) today!`);

    for (const user of users) {
      const name = user.first_name || 'Friend';
      
      // Send birthday email
      if (user.email) {
        await sendBirthdayEmail(user.email, name);
      }
      
      // Send birthday SMS
      if (user.phone) {
        await sendBirthdaySMS(user.phone, name);
      }
    }

    console.log('✅ Birthday messages sent successfully');
  } catch (error) {
    console.error('❌ Error checking birthdays:', error);
  }
}

// Initialize birthday checker
export function initializeBirthdayChecker() {
  // Run every day at 8:00 AM
  cron.schedule('0 8 * * *', () => {
    console.log('⏰ Running daily birthday check...');
    checkBirthdays();
  });

  console.log('✅ Birthday checker initialized (runs daily at 8:00 AM)');
  
  // Optional: Run on startup for testing
  // checkBirthdays();
}

// Export for manual testing
export { checkBirthdays };
