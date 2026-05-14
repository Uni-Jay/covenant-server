import cron from 'node-cron';
import { sendDailyEventReminders, sendBirthdayGreetings } from '../services/calendarReminder.service';

/**
 * Calendar Scheduler
 * Handles automatic sending of reminders and birthday greetings
 */

let scheduledJobs: any[] = [];

export const initializeCalendarScheduler = () => {
  try {
    console.log('⏰ Initializing calendar scheduler...');

    // ========== DAILY EVENT REMINDERS ==========
    // Send daily reminders for events within 3 months
    // Runs every day at 9:00 AM
    const eventRemindersJob = cron.schedule('0 9 * * *', async () => {
      console.log('🔔 Running daily event reminders...');
      try {
        await sendDailyEventReminders();
      } catch (error) {
        console.error('❌ Error in event reminders job:', error);
      }
    });

    scheduledJobs.push(eventRemindersJob);
    console.log('✅ Daily event reminders scheduled (9:00 AM)');

    // ========== BIRTHDAY GREETINGS ==========
    // Send birthday greetings at 6:00 AM
    const birthdayGreetingsJob = cron.schedule('0 6 * * *', async () => {
      console.log('🎂 Running birthday greetings...');
      try {
        await sendBirthdayGreetings();
      } catch (error) {
        console.error('❌ Error in birthday greetings job:', error);
      }
    });

    scheduledJobs.push(birthdayGreetingsJob);
    console.log('✅ Birthday greetings scheduled (6:00 AM)');

    // ========== DEVELOPMENT MODE ==========
    // If in development, also run reminders every 30 minutes for testing
    if (process.env.NODE_ENV === 'development') {
      const devTestJob = cron.schedule('*/30 * * * *', async () => {
        console.log('🧪 DEV: Running scheduler test...');
      });

      scheduledJobs.push(devTestJob);
      console.log('✅ Dev test scheduler enabled (every 30 minutes)');
    }

    console.log('✨ Calendar scheduler initialized successfully!');
    return true;

  } catch (error) {
    console.error('❌ Error initializing calendar scheduler:', error);
    return false;
  }
};

/**
 * Stop all scheduled jobs
 * Used for graceful shutdown
 */
export const stopCalendarScheduler = () => {
  try {
    console.log('⏸️  Stopping calendar scheduler...');

    for (const job of scheduledJobs) {
      job.stop();
    }

    scheduledJobs = [];
    console.log('✅ Calendar scheduler stopped');
    return true;

  } catch (error) {
    console.error('❌ Error stopping calendar scheduler:', error);
    return false;
  }
};

/**
 * Get scheduler status
 */
export const getSchedulerStatus = () => {
  return {
    isActive: scheduledJobs.length > 0,
    jobCount: scheduledJobs.length,
    jobs: [
      {
        name: 'Daily Event Reminders',
        schedule: '0 9 * * * (9:00 AM daily)',
        enabled: scheduledJobs.length > 0
      },
      {
        name: 'Birthday Greetings',
        schedule: '0 6 * * * (6:00 AM daily)',
        enabled: scheduledJobs.length > 0
      }
    ]
  };
};

/**
 * Manually trigger event reminders (for testing)
 */
export const manualTriggerEventReminders = async () => {
  try {
    console.log('🚀 Manually triggering event reminders...');
    await sendDailyEventReminders();
    console.log('✅ Manual trigger completed');
    return { success: true, message: 'Event reminders sent' };
  } catch (error: any) {
    console.error('❌ Error in manual trigger:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Manually trigger birthday greetings (for testing)
 */
export const manualTriggerBirthdayGreetings = async () => {
  try {
    console.log('🎉 Manually triggering birthday greetings...');
    await sendBirthdayGreetings();
    console.log('✅ Manual trigger completed');
    return { success: true, message: 'Birthday greetings sent' };
  } catch (error: any) {
    console.error('❌ Error in manual trigger:', error);
    return { success: false, error: error.message };
  }
};
