import { Router, Request, Response } from 'express';
import { authenticate } from '../middleware/auth.middleware';
import { requireAdmin } from '../middleware/permissions.middleware';
import {
  manualTriggerEventReminders,
  manualTriggerBirthdayGreetings,
  getSchedulerStatus
} from '../services/calendarScheduler';
import { setupCalendarDatabase } from '../scripts/setupCalendarDatabase';
import pool from '../config/database';

const router = Router();

/**
 * Calendar Admin Routes
 * Admin-only endpoints for managing calendar system
 */

// Setup calendar database (first run only)
router.post('/admin/setup-calendar', authenticate, requireAdmin, async (req: Request, res: Response) => {
  try {
    console.log('🔧 Admin requested calendar database setup');
    
    await setupCalendarDatabase();
    
    res.json({
      success: true,
      message: 'Calendar database initialized successfully'
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Get scheduler status
router.get('/admin/scheduler-status', authenticate, requireAdmin, async (req: Request, res: Response) => {
  try {
    const status = getSchedulerStatus();
    
    res.json({
      status,
      message: 'Scheduler status retrieved'
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Manually trigger event reminders
router.post('/admin/trigger-event-reminders', authenticate, requireAdmin, async (req: Request, res: Response) => {
  try {
    const result = await manualTriggerEventReminders();
    
    if (result.success) {
      res.json({ success: true, message: result.message });
    } else {
      res.status(500).json({ success: false, error: result.error });
    }
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Manually trigger birthday greetings
router.post('/admin/trigger-birthdays', authenticate, requireAdmin, async (req: Request, res: Response) => {
  try {
    const result = await manualTriggerBirthdayGreetings();
    
    if (result.success) {
      res.json({ success: true, message: result.message });
    } else {
      res.status(500).json({ success: false, error: result.error });
    }
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Get reminder logs
router.get('/admin/reminder-logs', authenticate, requireAdmin, async (req: Request, res: Response) => {
  try {
    const { limit = 100, offset = 0, type } = req.query;

    let query = 'SELECT * FROM reminder_logs WHERE 1=1';
    const params: any[] = [];

    if (type) {
      query += ' AND reminder_type = ?';
      params.push(type);
    }

    query += ' ORDER BY sent_at DESC LIMIT ? OFFSET ?';
    params.push(Number(limit), Number(offset));

    const [logs] = await pool.execute(query, params) as any;

    // Get total count
    let countQuery = 'SELECT COUNT(*) as total FROM reminder_logs WHERE 1=1';
    const countParams: any[] = [];

    if (type) {
      countQuery += ' AND reminder_type = ?';
      countParams.push(type);
    }

    const [countResult] = await pool.execute(countQuery, countParams) as any;

    res.json({
      logs,
      total: countResult[0].total,
      limit: Number(limit),
      offset: Number(offset)
    });

  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Get WhatsApp logs
router.get('/admin/whatsapp-logs', authenticate, requireAdmin, async (req: Request, res: Response) => {
  try {
    const { limit = 100, offset = 0, status } = req.query;

    let query = 'SELECT * FROM whatsapp_logs WHERE 1=1';
    const params: any[] = [];

    if (status) {
      query += ' AND status = ?';
      params.push(status);
    }

    query += ' ORDER BY sent_at DESC LIMIT ? OFFSET ?';
    params.push(Number(limit), Number(offset));

    const [logs] = await pool.execute(query, params) as any;

    // Get total count
    let countQuery = 'SELECT COUNT(*) as total FROM whatsapp_logs WHERE 1=1';
    const countParams: any[] = [];

    if (status) {
      countQuery += ' AND status = ?';
      countParams.push(status);
    }

    const [countResult] = await pool.execute(countQuery, countParams) as any;

    res.json({
      logs,
      total: countResult[0].total,
      limit: Number(limit),
      offset: Number(offset)
    });

  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Get birthday greetings sent history
router.get('/admin/birthday-history', authenticate, requireAdmin, async (req: Request, res: Response) => {
  try {
    const { limit = 50, offset = 0 } = req.query;

    const [history] = await pool.execute(
      `SELECT bg.id, u.first_name, u.last_name, u.email, bg.sent_at
       FROM birthday_greetings_sent bg
       JOIN users u ON bg.user_id = u.id
       ORDER BY bg.sent_at DESC
       LIMIT ? OFFSET ?`,
      [Number(limit), Number(offset)]
    ) as any;

    res.json({
      history,
      limit: Number(limit),
      offset: Number(offset)
    });

  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Get calendar statistics
router.get('/admin/calendar-stats', authenticate, requireAdmin, async (req: Request, res: Response) => {
  try {
    // Total events
    const [totalEvents] = await pool.execute(
      'SELECT COUNT(*) as count FROM calendar_events WHERE is_active = 1'
    ) as any;

    // Upcoming events (next 90 days)
    const [upcomingEvents] = await pool.execute(
      `SELECT COUNT(*) as count FROM calendar_events 
       WHERE is_active = 1 
       AND DATE(event_date) > DATE(NOW())
       AND DATE(event_date) <= DATE_ADD(NOW(), INTERVAL 90 DAY)`
    ) as any;

    // Users with birthdays
    const [birthdayUsers] = await pool.execute(
      'SELECT COUNT(*) as count FROM users WHERE date_of_birth IS NOT NULL AND is_approved = 1'
    ) as any;

    // Reminders sent today
    const [remindersToday] = await pool.execute(
      `SELECT COUNT(*) as count FROM reminder_logs 
       WHERE DATE(sent_at) = DATE(NOW())`
    ) as any;

    // Birthday greetings sent today
    const [birthdaysToday] = await pool.execute(
      `SELECT COUNT(*) as count FROM birthday_greetings_sent 
       WHERE DATE(sent_at) = DATE(NOW())`
    ) as any;

    res.json({
      totalEvents: totalEvents[0].count,
      upcomingEvents: upcomingEvents[0].count,
      birthdayUsers: birthdayUsers[0].count,
      reminderssentToday: remindersToday[0].count,
      birthdaysGreetedToday: birthdaysToday[0].count
    });

  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
