import { Router } from 'express';
import pool from '../config/database';

const router = Router();

router.post('/', async (req, res) => {
  try {
    const { name, email, phone, subject, message } = req.body;
    const [result]: any = await pool.execute(
      'INSERT INTO contact_messages (name, email, phone, subject, message) VALUES (?, ?, ?, ?, ?)',
      [name, email, phone, subject, message]
    );
    res.status(201).json({ message: 'Message sent successfully', id: result.insertId });
  } catch (error) {
    res.status(500).json({ message: 'Failed to send message' });
  }
});

export default router;
