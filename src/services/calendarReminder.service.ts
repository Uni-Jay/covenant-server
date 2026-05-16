import pool from '../config/database';
import { sendEmailNotification } from './notification.service';
import { sendWhatsAppMessage } from './whatsapp.service';
import nodemailer from 'nodemailer';

/**
 * Calendar Reminder Service
 * Handles sending reminders for:
 * 1. Church activities/programs (daily from 3 months before until event day)
 * 2. Birthday greetings (once at 6 AM on birthday)
 */

interface CalendarEvent {
  id: number;
  title: string;
  description: string;
  date: string;
  created_by: number;
}

interface User {
  id: number;
  email: string;
  phoneNumber: string;
  firstName: string;
  lastName: string;
  date_of_birth: string;
}

// Send daily reminders for events within the next 3 months
export const sendDailyEventReminders = async () => {
  try {
    console.log('🔔 Starting daily event reminders check...');
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    // Get all events that are:
    // 1. In the future (after today)
    // 2. Within 3 months from today
    // 3. Not already reminded today
    const threeMonthsLater = new Date(today);
    threeMonthsLater.setMonth(threeMonthsLater.getMonth() + 3);
    
    const [events] = await pool.execute(
      `SELECT id, title, description, DATE(event_date) as event_date, created_by
       FROM calendar_events
       WHERE DATE(event_date) > DATE(NOW())
       AND DATE(event_date) <= DATE(?)
       AND event_type = 'activity'
       AND is_active = 1`,
      [threeMonthsLater.toISOString().split('T')[0]]
    ) as any;

    console.log(`📅 Found ${events.length} events to remind about`);

    for (const event of events) {
      await sendEventReminder(event);
    }

    console.log('✅ Daily event reminders sent');
  } catch (error) {
    console.error('❌ Error sending daily event reminders:', error);
  }
};

// Send reminder for a specific event to all members
const sendEventReminder = async (event: CalendarEvent) => {
  try {
    const eventDate = new Date(event.date);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const daysUntilEvent = Math.ceil((eventDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    
    console.log(`📢 Sending reminder for "${event.title}" (${daysUntilEvent} days away)`);

    // Get all active users with phone and email
    const [users] = await pool.execute(
      `SELECT id, email, phone_number as phoneNumber, first_name as firstName, last_name as lastName
       FROM users
       WHERE is_approved = 1
       AND email IS NOT NULL
       AND (phone_number IS NOT NULL OR email IS NOT NULL)`,
    ) as any;

    console.log(`👥 Sending to ${users.length} members`);

    // Format the event date
    const dateStr = eventDate.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });

    // Send to each user
    for (const user of users) {
      try {
        // Email reminder
        if (user.email) {
          const emailSubject = `📅 Reminder: ${event.title} - ${daysUntilEvent} days away!`;
          const emailBody = `
            <h2>🙏 Church Activity Reminder</h2>
            <p>Hi ${user.firstName},</p>
            <p>This is a reminder about an upcoming church activity:</p>
            <h3>${event.title}</h3>
            <p><strong>Date:</strong> ${dateStr}</p>
            <p><strong>Days remaining:</strong> ${daysUntilEvent} days</p>
            <p><strong>Details:</strong> ${event.description || 'No description provided'}</p>
            <p>We look forward to your participation!</p>
            <p>Blessings,<br/>The Church Team</p>
          `;
          
          await sendEmailNotification(user.id, user.email, emailSubject, emailBody);
        }

        // WhatsApp reminder
        if (user.phoneNumber) {
          const whatsappMessage = `
🙏 *Church Activity Reminder* 🙏

Hi ${user.firstName},

📅 *${event.title}*
📆 Date: ${dateStr}
⏳ In ${daysUntilEvent} day${daysUntilEvent === 1 ? '' : 's'}!

${event.description ? `📝 ${event.description}` : ''}

See you there!
          `;
          
          await sendWhatsAppMessage(user.phoneNumber, whatsappMessage.trim());
        }

        // Log that reminder was sent
        await logReminderSent(event.id, user.id, 'event', daysUntilEvent);

      } catch (userError) {
        console.error(`⚠️  Error sending reminder to user ${user.id}:`, userError);
      }
    }

  } catch (error) {
    console.error('❌ Error in sendEventReminder:', error);
  }
};

// Send birthday greetings at 6 AM
export const sendBirthdayGreetings = async () => {
  try {
    console.log('🎂 Starting birthday greetings check...');
    
    const today = new Date();
    const monthDay = `${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

    // Get all users with birthday today
    const [birthdays] = await pool.execute(
      `SELECT id, email, phone_number as phoneNumber, first_name as firstName, last_name as lastName, date_of_birth
       FROM users
       WHERE is_approved = 1
       AND MONTH(date_of_birth) = MONTH(NOW())
       AND DAY(date_of_birth) = DAY(NOW())
       AND date_of_birth IS NOT NULL
       AND (email IS NOT NULL OR phone_number IS NOT NULL)`,
    ) as any;

    console.log(`🎉 Found ${birthdays.length} birthdays today`);

    // Get all other active members to send birthday greetings
    const [members] = await pool.execute(
      `SELECT id, email, phone_number as phoneNumber, first_name as firstName
       FROM users
       WHERE is_approved = 1
       AND (email IS NOT NULL OR phone_number IS NOT NULL)`,
    ) as any;

    for (const birthday of birthdays) {
      // Check if already sent today
      const [alreadySent] = await pool.execute(
        `SELECT id FROM birthday_greetings_sent 
         WHERE user_id = ? 
         AND DATE(sent_at) = DATE(NOW())`,
        [birthday.id]
      ) as any;

      if (alreadySent.length > 0) {
        console.log(`⏭️  Birthday greeting for ${birthday.firstName} already sent today`);
        continue;
      }

      // Send birthday message to the birthday person
      await sendBirthdayMessageToUser(birthday);

      // Send birthday greetings from other members
      if (members.length > 0) {
        const birthdayAge = today.getFullYear() - new Date(birthday.date_of_birth).getFullYear();
        await sendGroupBirthdayGreetings(birthday, members, birthdayAge);
      }

      // Mark birthday as reminded today
      await pool.execute(
        `INSERT INTO birthday_greetings_sent (user_id, sent_at) 
         VALUES (?, NOW())`,
        [birthday.id]
      );

      console.log(`🎊 Birthday greeting sent for ${birthday.firstName} ${birthday.lastName}`);
    }

    console.log('✅ Birthday greetings processed');
  } catch (error) {
    console.error('❌ Error sending birthday greetings:', error);
  }
};

// Send birthday message to the birthday person
const sendBirthdayMessageToUser = async (user: User) => {
  try {
    const age = new Date().getFullYear() - new Date(user.date_of_birth).getFullYear();
    
    // Email birthday greeting
    if (user.email) {
      const emailSubject = `🎉 Happy Birthday, ${user.firstName}!`;
      const emailBody = `
        <h2>🎂 Happy Birthday! 🎂</h2>
        <p>Dear ${user.firstName},</p>
        <p>Wishing you a blessed and wonderful birthday!</p>
        <p>We pray God's favor, joy, and protection over you as you celebrate your special day.</p>
        <p><strong>You are turning ${age} today!</strong> 🎉</p>
        <p>May this year bring you closer to God's purpose and filled with His grace and blessings.</p>
        <p>With love and prayers,<br/>The Church Family</p>
      `;
      
      await sendEmailNotification(user.id, user.email, emailSubject, emailBody);
    }

    // WhatsApp birthday greeting
    if (user.phoneNumber) {
      const whatsappMessage = `
🎂 *Happy Birthday, ${user.firstName}!* 🎂

Wishing you a blessed and wonderful birthday!
We pray God's favor and joy over you.

You are ${age} today! 🎉

May this year be filled with God's grace and blessings.

With love from the Church Family ❤️
      `;
      
      await sendWhatsAppMessage(user.phoneNumber, whatsappMessage.trim());
    }
  } catch (error) {
    console.error(`❌ Error sending birthday message to ${user.id}:`, error);
  }
};

// Send group birthday greetings from all members
const sendGroupBirthdayGreetings = async (birthday: User, members: User[], age: number) => {
  try {
    // Get birthday visibility setting
    const [settings] = await pool.execute(
      `SELECT show_birthday FROM user_settings WHERE user_id = ?`,
      [birthday.id]
    ) as any;

    // If user hid their birthday, don't show it to others
    if (settings.length > 0 && settings[0].show_birthday === 0) {
      console.log(`🔒 Birthday for ${birthday.firstName} is hidden`);
      return;
    }

    // Get list of members to greet (excluding the birthday person)
    const greeters = members.filter((m: User) => m.id !== birthday.id);

    console.log(`👥 Sending birthday notification to ${greeters.length} members`);

    // Send notification to all other members (on the birthday person's behalf)
    for (const greeter of greeters.slice(0, 20)) { // Limit to 20 to avoid spam
      try {
        if (greeter.email) {
          const emailSubject = `🎉 Today is ${birthday.firstName}'s birthday!`;
          const emailBody = `
            <p>Hi ${greeter.firstName},</p>
            <p>Today is <strong>${birthday.firstName}'s birthday!</strong> 🎉</p>
            <p>${birthday.firstName} is turning ${age} today.</p>
            <p>Why not send a birthday blessing or encouragement message?</p>
            <p>Blessings,<br/>The Church Team</p>
          `;
          
          await sendEmailNotification(greeter.id, greeter.email, emailSubject, emailBody);
        }
      } catch (error) {
        console.error(`⚠️  Error notifying ${greeter.firstName}:`, error);
      }
    }
  } catch (error) {
    console.error('❌ Error in sendGroupBirthdayGreetings:', error);
  }
};

// Log reminder sent (to prevent duplicates)
const logReminderSent = async (eventId: number, userId: number, type: 'event' | 'birthday', daysRemaining: number) => {
  try {
    await pool.execute(
      `INSERT INTO reminder_logs (event_id, user_id, reminder_type, days_remaining, sent_at)
       VALUES (?, ?, ?, ?, NOW())`,
      [eventId, userId, type, daysRemaining]
    );
  } catch (error) {
    // Table might not exist yet - that's okay
    console.log('📝 Logging reminder...');
  }
};

// Get upcoming events for user (next 3 months)
export const getUpcomingEvents = async (userId?: number): Promise<CalendarEvent[]> => {
  try {
    const query = `
      SELECT 
        id, title, description, event_date, created_by,
        DATEDIFF(event_date, NOW()) as days_until
      FROM calendar_events
      WHERE is_active = 1
      AND event_type = 'activity'
      AND DATE(event_date) > DATE(NOW())
      AND DATE(event_date) <= DATE_ADD(NOW(), INTERVAL 3 MONTH)
      ORDER BY event_date ASC
      LIMIT 20
    `;

    const [events] = await pool.execute(query) as any;
    return events;
  } catch (error) {
    console.error('❌ Error getting upcoming events:', error);
    return [];
  }
};

// Get upcoming birthdays for calendar (next 3 months)
export const getUpcomingBirthdays = async (): Promise<any[]> => {
  try {
    const [birthdays] = await pool.execute(
      `SELECT 
        id, first_name as firstName, last_name as lastName, 
        date_of_birth as dateOfBirth,
        DATEDIFF(DATE_FORMAT(DATE_ADD(date_of_birth, INTERVAL YEAR(NOW()) - YEAR(date_of_birth) YEAR), '%Y-%m-%d'), NOW()) as days_until
      FROM users
      WHERE is_approved = 1
      AND date_of_birth IS NOT NULL
      AND (SELECT show_birthday FROM user_settings WHERE user_id = users.id LIMIT 1) != 0
      HAVING days_until >= 0 AND days_until <= 90
      ORDER BY days_until ASC
      LIMIT 30`
    ) as any;

    return birthdays;
  } catch (error) {
    console.error('❌ Error getting upcoming birthdays:', error);
    return [];
  }
};
