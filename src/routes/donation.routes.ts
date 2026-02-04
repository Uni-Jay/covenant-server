import { Router } from 'express';
import pool from '../config/database';
import { authenticate, isAdmin } from '../middleware/auth.middleware';

const router = Router();

router.get('/', authenticate, isAdmin, async (req, res) => {
  try {
    const [donations] = await pool.execute('SELECT * FROM donations ORDER BY created_at DESC');
    res.json(donations);
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch donations' });
  }
});

router.post('/', async (req, res) => {
  try {
    const { name, email, phone, amount, purpose, paymentMethod } = req.body;
    const [result]: any = await pool.execute(
      'INSERT INTO donations (name, email, phone, amount, purpose, payment_method, status) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [name, email, phone, amount, purpose, paymentMethod, 'pending']
    );
    res.status(201).json({ message: 'Donation recorded', id: result.insertId });
  } catch (error) {
    res.status(500).json({ message: 'Failed to record donation' });
  }
});

export default router;
