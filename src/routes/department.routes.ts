import express from 'express';
import pool from '../config/database';
import { authenticate } from '../middleware/auth.middleware';

const router = express.Router();

// Get all departments
router.get('/', authenticate, async (req, res) => {
  try {
    const [departments] = await pool.query(`
      SELECT DISTINCT department as name
      FROM user_departments
      WHERE department IS NOT NULL AND department != ''
      ORDER BY department ASC
    `) as any;

    res.json({
      departments: departments.map((d: any) => ({ name: d.name }))
    });
  } catch (error: any) {
    console.error('Get departments error:', error);
    res.status(500).json({ message: 'Failed to fetch departments', error: error.message });
  }
});

export default router;
