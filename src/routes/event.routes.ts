import { Router } from 'express';
import pool from '../config/database';
import { authenticate, isAdmin, isAdminOrMedia } from '../middleware/auth.middleware';
import { upload } from '../middleware/upload.middleware';
import { notifyPublicSubmission, savePublicSubmission } from '../utils/publicSubmission';

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

router.post('/:id/register', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, email, phone, numberOfSeats } = req.body;
    const [events]: any = await pool.execute('SELECT title, date, time, location FROM events WHERE id = ?', [id]);

    if (!events.length) {
      return res.status(404).json({ message: 'Event not found' });
    }

    const event = events[0];
    const subject = `Event Registration - ${event.title}`;
    const html = `
      <h2>New Event Registration</h2>
      <p><strong>Event:</strong> ${event.title}</p>
      <p><strong>Date:</strong> ${event.date}</p>
      <p><strong>Time:</strong> ${event.time || 'Not set'}</p>
      <p><strong>Location:</strong> ${event.location || 'Not set'}</p>
      <p><strong>Name:</strong> ${name}</p>
      <p><strong>Email:</strong> ${email}</p>
      <p><strong>Phone:</strong> ${phone || 'Not provided'}</p>
      <p><strong>Seats:</strong> ${numberOfSeats || 1}</p>
    `;

    const insertId = await savePublicSubmission({
      name,
      email,
      phone,
      subject,
      message: `Event registration for ${event.title} (${numberOfSeats || 1} seats)` ,
    });
    const emailDelivered = await notifyPublicSubmission({
      name,
      email,
      phone,
      subject,
      message: html,
      recipient: process.env.ORG_EMAIL_INFO || 'info@hocfam.org',
    });

    res.status(emailDelivered ? 201 : 202).json({
      id: insertId,
      message: 'Event registration submitted',
      emailDelivered,
    });
  } catch (error) {
    res.status(500).json({ message: 'Failed to submit event registration' });
  }
});

router.post('/', authenticate, isAdminOrMedia, upload.single('image'), async (req: any, res) => {
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

router.put('/:id', authenticate, isAdminOrMedia, upload.single('image'), async (req: any, res) => {
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

router.delete('/:id', authenticate, isAdminOrMedia, async (req, res) => {
  try {
    await pool.execute('DELETE FROM events WHERE id = ?', [req.params.id]);
    res.json({ message: 'Event deleted' });
  } catch (error) {
    res.status(500).json({ message: 'Failed to delete event' });
  }
});

export default router;
