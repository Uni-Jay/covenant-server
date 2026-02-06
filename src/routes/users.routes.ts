import { Router } from 'express';
import pool from '../config/database';
import { authenticate } from '../middleware/auth.middleware';

const router = Router();

// Search users by name (for autocomplete)
router.get('/search', authenticate, async (req: any, res) => {
  try {
    const { q } = req.query;

    if (!q || typeof q !== 'string' || q.length < 2) {
      return res.status(400).json({ message: 'Search query must be at least 2 characters' });
    }

    const searchTerm = `%${q}%`;
    
    const [users] = await pool.execute(`
      SELECT 
        id, 
        email, 
        first_name as firstName, 
        last_name as lastName,
        CONCAT(first_name, ' ', last_name) as fullName,
        photo
      FROM users 
      WHERE (first_name LIKE ? OR last_name LIKE ? OR CONCAT(first_name, ' ', last_name) LIKE ?)
      AND is_approved = 1
      ORDER BY first_name, last_name
      LIMIT 20
    `, [searchTerm, searchTerm, searchTerm]) as any;

    res.json(users);
  } catch (error: any) {
    console.error('User search error:', error);
    res.status(500).json({ message: 'Failed to search users' });
  }
});

export default router;
