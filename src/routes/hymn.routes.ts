import express, { Response } from 'express';
import pool from '../config/database';
import { authenticate } from '../middleware/auth.middleware';
import { requirePermission } from '../middleware/permissions.middleware';

const router = express.Router();

interface AuthRequest extends express.Request {
  user?: {
    id: number;
    email: string;
    role: string;
  };
}

// Get all hymns
router.get('/', async (req, res: Response) => {
  try {
    const { category, search } = req.query;

    let query = 'SELECT * FROM hymns WHERE 1=1';
    const params: any[] = [];

    if (category) {
      query += ' AND category = ?';
      params.push(category);
    }

    if (search) {
      query += ' AND (title LIKE ? OR lyrics LIKE ?)';
      params.push(`%${search}%`, `%${search}%`);
    }

    query += ' ORDER BY number, title';

    const [hymns] = await pool.execute(query, params);

    res.json({ hymns });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Get hymn by ID
router.get('/:id', async (req, res: Response) => {
  try {
    const { id } = req.params;

    const [hymns] = await pool.execute(
      'SELECT * FROM hymns WHERE id = ?',
      [id]
    ) as any;

    if (hymns.length === 0) {
      return res.status(404).json({ error: 'Hymn not found' });
    }

    res.json({ hymn: hymns[0] });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Get hymn categories
router.get('/meta/categories', async (req, res: Response) => {
  try {
    const [categories] = await pool.execute(`
      SELECT DISTINCT category, COUNT(*) as count
      FROM hymns
      WHERE category IS NOT NULL
      GROUP BY category
      ORDER BY category
    `);

    res.json({ categories });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Create hymn (media and choir only)
router.post('/', authenticate, requirePermission('hymn:create'), async (req: AuthRequest, res: Response) => {
  try {
    const { title, number, lyrics, audioUrl, category } = req.body;

    if (!title || !lyrics) {
      return res.status(400).json({ error: 'Title and lyrics are required' });
    }

    const [result] = await pool.execute(
      `INSERT INTO hymns (title, number, lyrics, audio_url, category)
       VALUES (?, ?, ?, ?, ?)`,
      [title, number || null, lyrics, audioUrl || null, category || null]
    ) as any;

    res.status(201).json({ 
      message: 'Hymn created successfully',
      hymnId: result.insertId 
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Update hymn
router.put('/:id', authenticate, requirePermission('hymn:create'), async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { title, number, lyrics, audioUrl, category } = req.body;

    const [hymns] = await pool.execute(
      'SELECT id FROM hymns WHERE id = ?',
      [id]
    ) as any;

    if (hymns.length === 0) {
      return res.status(404).json({ error: 'Hymn not found' });
    }

    await pool.execute(
      `UPDATE hymns 
       SET title = ?, number = ?, lyrics = ?, audio_url = ?, category = ?
       WHERE id = ?`,
      [title, number || null, lyrics, audioUrl || null, category || null, id]
    );

    res.json({ message: 'Hymn updated successfully' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Delete hymn
router.delete('/:id', authenticate, requirePermission('hymn:create'), async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    await pool.execute('DELETE FROM hymns WHERE id = ?', [id]);

    res.json({ message: 'Hymn deleted successfully' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Get user's favorite hymns
router.get('/favorites/my', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;

    const [favorites] = await pool.execute(`
      SELECT h.*, uhf.created_at as favorited_at
      FROM user_hymn_favorites uhf
      JOIN hymns h ON uhf.hymn_id = h.id
      WHERE uhf.user_id = ?
      ORDER BY uhf.created_at DESC
    `, [userId]);

    res.json({ favorites });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Add hymn to favorites
router.post('/:id/favorite', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.user!.id;

    // Check if already favorited
    const [existing] = await pool.execute(
      'SELECT id FROM user_hymn_favorites WHERE user_id = ? AND hymn_id = ?',
      [userId, id]
    ) as any;

    if (existing.length > 0) {
      return res.status(400).json({ error: 'Hymn already in favorites' });
    }

    await pool.execute(
      'INSERT INTO user_hymn_favorites (user_id, hymn_id) VALUES (?, ?)',
      [userId, id]
    );

    res.json({ message: 'Hymn added to favorites' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Remove hymn from favorites
router.delete('/:id/favorite', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.user!.id;

    await pool.execute(
      'DELETE FROM user_hymn_favorites WHERE user_id = ? AND hymn_id = ?',
      [userId, id]
    );

    res.json({ message: 'Hymn removed from favorites' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Get worship setlists (choir only)
router.get('/setlists/all', authenticate, requirePermission('hymn:setlist'), async (req: AuthRequest, res: Response) => {
  try {
    const [setlists] = await pool.execute(`
      SELECT 
        ws.*,
        u.first_name as creator_first_name,
        u.last_name as creator_last_name,
        (SELECT COUNT(*) FROM setlist_hymns WHERE setlist_id = ws.id) as hymn_count
      FROM worship_setlists ws
      JOIN users u ON ws.created_by = u.id
      ORDER BY ws.date DESC
    `);

    res.json({ setlists });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Get setlist with hymns
router.get('/setlists/:id', authenticate, requirePermission('hymn:setlist'), async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    const [setlists] = await pool.execute(`
      SELECT 
        ws.*,
        u.first_name as creator_first_name,
        u.last_name as creator_last_name
      FROM worship_setlists ws
      JOIN users u ON ws.created_by = u.id
      WHERE ws.id = ?
    `, [id]) as any;

    if (setlists.length === 0) {
      return res.status(404).json({ error: 'Setlist not found' });
    }

    // Get hymns in setlist
    const [hymns] = await pool.execute(`
      SELECT h.*, sh.order_index
      FROM setlist_hymns sh
      JOIN hymns h ON sh.hymn_id = h.id
      WHERE sh.setlist_id = ?
      ORDER BY sh.order_index
    `, [id]);

    res.json({ setlist: setlists[0], hymns });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Create worship setlist (choir only)
router.post('/setlists', authenticate, requirePermission('hymn:setlist'), async (req: AuthRequest, res: Response) => {
  try {
    const { title, date, hymnIds, notes } = req.body;
    const userId = req.user!.id;

    if (!title || !date || !hymnIds || hymnIds.length === 0) {
      return res.status(400).json({ error: 'Title, date, and hymns are required' });
    }

    // Create setlist
    const [result] = await pool.execute(
      `INSERT INTO worship_setlists (title, date, created_by, notes)
       VALUES (?, ?, ?, ?)`,
      [title, date, userId, notes || null]
    ) as any;

    const setlistId = result.insertId;

    // Add hymns to setlist
    for (let i = 0; i < hymnIds.length; i++) {
      await pool.execute(
        'INSERT INTO setlist_hymns (setlist_id, hymn_id, order_index) VALUES (?, ?, ?)',
        [setlistId, hymnIds[i], i + 1]
      );
    }

    res.status(201).json({ 
      message: 'Setlist created successfully',
      setlistId 
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Update setlist
router.put('/setlists/:id', authenticate, requirePermission('hymn:setlist'), async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { title, date, hymnIds, notes } = req.body;

    // Update setlist
    await pool.execute(
      `UPDATE worship_setlists 
       SET title = ?, date = ?, notes = ?
       WHERE id = ?`,
      [title, date, notes || null, id]
    );

    // Update hymns if provided
    if (hymnIds) {
      // Remove existing hymns
      await pool.execute('DELETE FROM setlist_hymns WHERE setlist_id = ?', [id]);

      // Add new hymns
      for (let i = 0; i < hymnIds.length; i++) {
        await pool.execute(
          'INSERT INTO setlist_hymns (setlist_id, hymn_id, order_index) VALUES (?, ?, ?)',
          [id, hymnIds[i], i + 1]
        );
      }
    }

    res.json({ message: 'Setlist updated successfully' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Delete setlist
router.delete('/setlists/:id', authenticate, requirePermission('hymn:setlist'), async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    await pool.execute('DELETE FROM worship_setlists WHERE id = ?', [id]);

    res.json({ message: 'Setlist deleted successfully' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
