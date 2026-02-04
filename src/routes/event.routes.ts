import { Router } from 'express';
import pool from '../config/database';
import { authenticate, isAdmin } from '../middleware/auth.middleware';
import { upload } from '../middleware/upload.middleware';

const router = Router();

router.get('/', async (req, res) => {
  try {
    const [events]: any = await pool.execute('SELECT * FROM events ORDER BY date DESC');
    // Convert snake_case to camelCase for frontend
    const formattedEvents = events.map((event: any) => ({
      id: event.id,
      title: event.title,
      description: event.description,
      date: event.date,
      time: event.time,
      location: event.location,
      imageUrl: event.image_url,
      category: event.category,
      createdAt: event.created_at,
      updatedAt: event.updated_at
    }));
    res.json(formattedEvents);
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch events' });
  }
});

router.post('/', authenticate, isAdmin, upload.single('image'), async (req: any, res) => {
  try {
    const { title, description, date, time, location, category } = req.body;
    const imageUrl = req.file ? `/uploads/events/${req.file.filename}` : null;

    const [result]: any = await pool.execute(
      'INSERT INTO events (title, description, date, time, location, image_url, category) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [title, description, date, time, location, imageUrl, category]
    );

    res.status(201).json({ message: 'Event created', id: result.insertId });
  } catch (error) {
    res.status(500).json({ message: 'Failed to create event' });
  }
});

router.put('/:id', authenticate, isAdmin, upload.single('image'), async (req: any, res) => {
  try {
    const { title, description, date, time, location, category } = req.body;
    let imageUrl = null;
    
    if (req.file) {
      imageUrl = `/uploads/events/${req.file.filename}`;
    }

    if (imageUrl) {
      await pool.execute(
        'UPDATE events SET title = ?, description = ?, date = ?, time = ?, location = ?, image_url = ?, category = ? WHERE id = ?',
        [title, description, date, time, location, imageUrl, category, req.params.id]
      );
    } else {
      await pool.execute(
        'UPDATE events SET title = ?, description = ?, date = ?, time = ?, location = ?, category = ? WHERE id = ?',
        [title, description, date, time, location, category, req.params.id]
      );
    }

    res.json({ message: 'Event updated' });
  } catch (error) {
    res.status(500).json({ message: 'Failed to update event' });
  }
});

router.delete('/:id', authenticate, isAdmin, async (req, res) => {
  try {
    await pool.execute('DELETE FROM events WHERE id = ?', [req.params.id]);
    res.json({ message: 'Event deleted' });
  } catch (error) {
    res.status(500).json({ message: 'Failed to delete event' });
  }
});

export default router;
