import { Router } from 'express';
import pool from '../config/database';

const router = Router();

router.get('/', async (req, res) => {
  try {
    const [ministries] = await pool.execute('SELECT * FROM ministries ORDER BY name');
    res.json(ministries);
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch ministries' });
  }
});

export default router;
