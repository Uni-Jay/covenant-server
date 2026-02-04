import { Router } from 'express';
import pool from '../config/database';
import { authenticate, isAdmin } from '../middleware/auth.middleware';

const router = Router();

router.get('/', authenticate, isAdmin, async (req, res) => {
  try {
    const [requests] = await pool.execute('SELECT * FROM prayer_requests ORDER BY created_at DESC');
    res.json(requests);
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch prayer requests' });
  }
});

router.post('/', async (req, res) => {
  try {
    const { name, email, phone, request, category, isAnonymous } = req.body;
    const [result]: any = await pool.execute(
      'INSERT INTO prayer_requests (name, email, phone, request, category, is_anonymous) VALUES (?, ?, ?, ?, ?, ?)',
      [isAnonymous ? null : name, isAnonymous ? null : email, isAnonymous ? null : phone, request, category, isAnonymous]
    );
    res.status(201).json({ message: 'Prayer request submitted', id: result.insertId });
  } catch (error) {
    res.status(500).json({ message: 'Failed to submit prayer request' });
  }
});

router.patch('/:id', authenticate, isAdmin, async (req, res) => {
  try {
    const { status } = req.body;
    await pool.execute('UPDATE prayer_requests SET status = ? WHERE id = ?', [status, req.params.id]);
    res.json({ message: 'Status updated' });
  } catch (error) {
    res.status(500).json({ message: 'Failed to update status' });
  }
});

router.delete('/:id', authenticate, isAdmin, async (req, res) => {
  try {
    await pool.execute('DELETE FROM prayer_requests WHERE id = ?', [req.params.id]);
    res.json({ message: 'Prayer request deleted' });
  } catch (error) {
    res.status(500).json({ message: 'Failed to delete prayer request' });
  }
});

export default router;
