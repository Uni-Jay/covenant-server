import { Router, Request, Response } from 'express';
import pool from '../config/database';
import { authenticate } from '../middleware/auth.middleware';
import { requireAdmin } from '../middleware/permissions.middleware';
import { getUpcomingEvents, getUpcomingBirthdays } from '../services/calendarReminder.service';

const router = Router();

/**
 * Calendar Routes
 * Admin can create/edit/delete church activities and programs
 * All members can view the calendar
 */

// ========== ADMIN ROUTES ==========

// Create church activity/program
router.post('/admin/events', authenticate, requireAdmin, async (req: Request, res: Response) => {
  try {
    const { title, description, eventDate, eventType, notes } = req.body;
    const userId = (req as any).user.id;

    if (!title || !eventDate) {
      return res.status(400).json({ error: 'Title and event date are required' });
    }

    // Validate event type
    const validTypes = ['activity', 'birthday', 'service'];
    if (!validTypes.includes(eventType || 'activity')) {
      return res.status(400).json({ error: 'Invalid event type' });
    }

    const [result] = await pool.execute(
      `INSERT INTO calendar_events (title, description, event_date, event_type, created_by, notes, is_active)
       VALUES (?, ?, ?, ?, ?, ?, 1)`,
      [title, description || null, eventDate, eventType || 'activity', userId, notes || null]
    ) as any;

    res.status(201).json({
      message: 'Event created successfully',
      eventId: result.insertId,
      event: {
        id: result.insertId,
        title,
        description,
        eventDate,
        eventType: eventType || 'activity',
        createdBy: userId
      }
    });

  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Update church activity/program
router.put('/admin/events/:eventId', authenticate, requireAdmin, async (req: Request, res: Response) => {
  try {
    const { eventId } = req.params;
    const { title, description, eventDate, eventType, notes, isActive } = req.body;

    // Check if event exists
    const [events] = await pool.execute(
      'SELECT id, created_by FROM calendar_events WHERE id = ?',
      [eventId]
    ) as any;

    if (events.length === 0) {
      return res.status(404).json({ error: 'Event not found' });
    }

    // Build update query
    const updateFields: string[] = [];
    const updateValues: any[] = [];

    if (title !== undefined) {
      updateFields.push('title = ?');
      updateValues.push(title);
    }
    if (description !== undefined) {
      updateFields.push('description = ?');
      updateValues.push(description);
    }
    if (eventDate !== undefined) {
      updateFields.push('event_date = ?');
      updateValues.push(eventDate);
    }
    if (eventType !== undefined) {
      updateFields.push('event_type = ?');
      updateValues.push(eventType);
    }
    if (notes !== undefined) {
      updateFields.push('notes = ?');
      updateValues.push(notes);
    }
    if (isActive !== undefined) {
      updateFields.push('is_active = ?');
      updateValues.push(isActive ? 1 : 0);
    }

    if (updateFields.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    updateValues.push(eventId);

    await pool.execute(
      `UPDATE calendar_events SET ${updateFields.join(', ')}, updated_at = NOW() WHERE id = ?`,
      updateValues
    );

    res.json({ message: 'Event updated successfully' });

  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Delete church activity/program
router.delete('/admin/events/:eventId', authenticate, requireAdmin, async (req: Request, res: Response) => {
  try {
    const { eventId } = req.params;

    const [result] = await pool.execute(
      'DELETE FROM calendar_events WHERE id = ?',
      [eventId]
    ) as any;

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Event not found' });
    }

    res.json({ message: 'Event deleted successfully' });

  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Get all events (admin view)
router.get('/admin/events', authenticate, requireAdmin, async (req: Request, res: Response) => {
  try {
    const { status, type, limit = 50, offset = 0 } = req.query;

    let query = 'SELECT * FROM calendar_events WHERE 1=1';
    const params: any[] = [];

    if (status === 'active') {
      query += ' AND is_active = 1';
    } else if (status === 'inactive') {
      query += ' AND is_active = 0';
    }

    if (type) {
      query += ' AND event_type = ?';
      params.push(type);
    }

    query += ' ORDER BY event_date DESC LIMIT ? OFFSET ?';
    params.push(Number(limit), Number(offset));

    const [events] = await pool.execute(query, params) as any;

    res.json({
      events,
      total: events.length,
      limit: Number(limit),
      offset: Number(offset)
    });

  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ========== MEMBER ROUTES ==========

// Get calendar view (upcoming events and birthdays)
router.get('/calendar', authenticate, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;

    // Get upcoming events
    const upcomingEvents = await getUpcomingEvents(userId);

    // Get upcoming birthdays
    const upcomingBirthdays = await getUpcomingBirthdays();

    res.json({
      events: upcomingEvents,
      birthdays: upcomingBirthdays,
      total: upcomingEvents.length + upcomingBirthdays.length
    });

  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Get all active events
router.get('/events', authenticate, async (req: Request, res: Response) => {
  try {
    const { type } = req.query;

    let query = `
      SELECT id, title, description, event_date, event_type, notes,
             DATEDIFF(event_date, NOW()) as days_until
      FROM calendar_events
      WHERE is_active = 1
      AND event_type != 'birthday'
      AND DATE(event_date) >= DATE(NOW())
    `;
    const params: any[] = [];

    if (type) {
      query += ' AND event_type = ?';
      params.push(type);
    }

    query += ' ORDER BY event_date ASC LIMIT 50';

    const [events] = await pool.execute(query, params) as any;

    res.json({ events });

  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Get single event details
router.get('/events/:eventId', authenticate, async (req: Request, res: Response) => {
  try {
    const { eventId } = req.params;

    const [events] = await pool.execute(
      `SELECT * FROM calendar_events WHERE id = ? AND is_active = 1`,
      [eventId]
    ) as any;

    if (events.length === 0) {
      return res.status(404).json({ error: 'Event not found' });
    }

    res.json({ event: events[0] });

  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ========== BIRTHDAY SETTINGS ==========

// Get user's birthday visibility setting
router.get('/birthday-settings', authenticate, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;

    const [settings] = await pool.execute(
      'SELECT show_birthday FROM user_settings WHERE user_id = ?',
      [userId]
    ) as any;

    const showBirthday = settings.length > 0 ? settings[0].show_birthday !== 0 : true;

    res.json({ showBirthday });

  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Update birthday visibility
router.put('/birthday-settings', authenticate, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const { showBirthday } = req.body;

    // Check if settings exist
    const [existing] = await pool.execute(
      'SELECT id FROM user_settings WHERE user_id = ?',
      [userId]
    ) as any;

    if (existing.length > 0) {
      await pool.execute(
        'UPDATE user_settings SET show_birthday = ? WHERE user_id = ?',
        [showBirthday ? 1 : 0, userId]
      );
    } else {
      await pool.execute(
        'INSERT INTO user_settings (user_id, show_birthday) VALUES (?, ?)',
        [userId, showBirthday ? 1 : 0]
      );
    }

    res.json({
      message: 'Birthday visibility updated',
      showBirthday
    });

  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
