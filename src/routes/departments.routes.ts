import { Router } from 'express';
import pool from '../config/database';
import { authenticate } from '../middleware/auth.middleware';
import { hasMediaDepartment } from '../middleware/permissions.middleware';
import { syncUserDepartmentGroups } from '../services/chat.service';

const router = Router();

// Middleware to check if user has Media department
const requireMedia = async (req: any, res: any, next: any) => {
  try {
    const isMedia = await hasMediaDepartment(req.user.id);
    if (!isMedia) {
      return res.status(403).json({ 
        error: 'Forbidden', 
        message: 'Only Media department members can assign roles' 
      });
    }
    next();
  } catch (error) {
    res.status(500).json({ message: 'Failed to verify permissions' });
  }
};

// Get all department executives (with optional department filter)
router.get('/executives', authenticate, async (req: any, res) => {
  try {
    const { department } = req.query;
    
    let query = `
      SELECT 
        id, 
        email, 
        first_name as firstName, 
        last_name as lastName, 
        CONCAT(first_name, ' ', last_name) as fullName,
        photo,
        department,
        executive_position as executivePosition,
        is_executive as isExecutive
      FROM users 
      WHERE is_executive = 1 
      AND department IS NOT NULL
    `;
    
    const params: any[] = [];
    if (department) {
      query += ' AND department = ?';
      params.push(department);
    }
    
    query += ' ORDER BY department, executive_position';

    const [executives] = await pool.execute(query, params) as any;

    res.json(executives);
  } catch (error: any) {
    console.error('Get executives error:', error);
    res.status(500).json({ message: 'Failed to fetch executives' });
  }
});

// Get all church leaders (pastors, apostles, etc.)
router.get('/leaders', authenticate, async (req: any, res) => {
  try {
    const [leaders] = await pool.execute(`
      SELECT 
        id, 
        email, 
        first_name as firstName, 
        last_name as lastName, 
        role,
        executive_position as executivePosition
      FROM users 
      WHERE executive_position IS NOT NULL
      AND executive_position != ''
      AND (
        role IN ('pastor', 'elder', 'deacon') 
        OR executive_position LIKE '%Pastor%'
        OR executive_position LIKE '%Apostle%'
        OR executive_position LIKE '%Prophet%'
        OR executive_position LIKE '%Evangelist%'
      )
      ORDER BY 
        CASE 
          WHEN executive_position LIKE '%Senior%' THEN 1
          WHEN executive_position LIKE '%Apostle%' THEN 2
          WHEN executive_position LIKE '%Prophet%' THEN 3
          WHEN executive_position LIKE '%Pastor%' THEN 4
          WHEN executive_position LIKE '%Evangelist%' THEN 5
          ELSE 6
        END,
        executive_position
    `) as any;

    res.json(leaders);
  } catch (error: any) {
    console.error('Get leaders error:', error);
    res.status(500).json({ message: 'Failed to fetch leaders' });
  }
});

// Add department executive
router.post('/executives', authenticate, requireMedia, async (req: any, res) => {
  try {
    const { userId, department, position } = req.body;

    if (!userId || !department || !position) {
      return res.status(400).json({ message: 'userId, department, and position are required' });
    }

    // Check if user exists
    const [users] = await pool.execute(
      'SELECT id, first_name, last_name, email, photo FROM users WHERE id = ?',
      [userId]
    ) as any;

    if (users.length === 0) {
      return res.status(404).json({ message: 'User not found' });
    }

    const user = users[0];

    // Check if position is already filled
    const [existing] = await pool.execute(
      'SELECT id FROM users WHERE department = ? AND executive_position = ? AND is_executive = 1',
      [department, position]
    ) as any;

    if (existing.length > 0) {
      return res.status(400).json({ message: 'This position is already filled' });
    }

    // Update user to be executive with this position
    await pool.execute(
      `UPDATE users 
       SET is_executive = 1, 
           department = ?, 
           executive_position = ?
       WHERE id = ?`,
      [department, position, userId]
    );

    // Also add department to departments JSON array if not exists
    const [currentUser] = await pool.execute(
      'SELECT departments FROM users WHERE id = ?',
      [userId]
    ) as any;

    const currentDepts = currentUser[0].departments ? JSON.parse(currentUser[0].departments) : [];
    if (!currentDepts.includes(department)) {
      currentDepts.push(department);
      await pool.execute(
        'UPDATE users SET departments = ? WHERE id = ?',
        [JSON.stringify(currentDepts), userId]
      );

      // Sync department group chats (async, don't wait)
      syncUserDepartmentGroups(userId, currentDepts).catch(err =>
        console.error('Failed to sync department groups:', err)
      );
    }

    res.json({ 
      message: 'Executive added successfully',
      executive: {
        id: user.id,
        firstName: user.first_name,
        lastName: user.last_name,
        fullName: `${user.first_name} ${user.last_name}`,
        email: user.email,
        photo: user.photo,
        department,
        executivePosition: position,
      }
    });
  } catch (error: any) {
    console.error('Add executive error:', error);
    res.status(500).json({ message: 'Failed to add executive' });
  }
});

// Add church leader
router.post('/leaders', authenticate, requireMedia, async (req: any, res) => {
  try {
    const { email, title, role } = req.body;

    if (!email || !title) {
      return res.status(400).json({ message: 'Email and title are required' });
    }

    // Check if user exists
    const [users] = await pool.execute(
      'SELECT id, first_name, last_name FROM users WHERE email = ?',
      [email]
    ) as any;

    if (users.length === 0) {
      return res.status(404).json({ message: 'User not found with this email' });
    }

    // Update user with leadership title
    const updateRole = role || 'pastor';
    await pool.execute(
      `UPDATE users 
       SET executive_position = ?, 
           role = ?,
           is_executive = 1
       WHERE email = ?`,
      [title, updateRole, email]
    );

    // Add to ministers group if applicable
    const isMinister = 
      title.toLowerCase().includes('pastor') ||
      title.toLowerCase().includes('apostle') ||
      title.toLowerCase().includes('prophet') ||
      title.toLowerCase().includes('evangelist') ||
      updateRole === 'pastor' ||
      updateRole === 'elder';

    if (isMinister) {
      try {
        // Get ministers group
        const [groups] = await pool.execute(
          "SELECT id FROM chat_groups WHERE type = 'ministers'",
        ) as any;

        if (groups.length > 0) {
          const groupId = groups[0].id;
          // Add user to ministers group
          await pool.execute(
            `INSERT IGNORE INTO group_members (group_id, user_id, role)
             VALUES (?, ?, 'member')`,
            [groupId, users[0].id]
          );
        }
      } catch (groupError) {
        console.log('Ministers group not yet created');
      }
    }

    res.json({ 
      message: 'Church leader added successfully',
      leader: {
        id: users[0].id,
        firstName: users[0].first_name,
        lastName: users[0].last_name,
        email,
        executivePosition: title,
        role: updateRole,
      }
    });
  } catch (error: any) {
    console.error('Add leader error:', error);
    res.status(500).json({ message: 'Failed to add leader' });
  }
});

// Remove executive
router.delete('/executives/:id', authenticate, requireMedia, async (req: any, res) => {
  try {
    const { id } = req.params;

    await pool.execute(
      `UPDATE users 
       SET is_executive = 0, 
           executive_position = NULL
       WHERE id = ?`,
      [id]
    );

    res.json({ message: 'Executive removed successfully' });
  } catch (error: any) {
    console.error('Remove executive error:', error);
    res.status(500).json({ message: 'Failed to remove executive' });
  }
});

// Remove leader
router.delete('/leaders/:id', authenticate, requireMedia, async (req: any, res) => {
  try {
    const { id } = req.params;

    await pool.execute(
      `UPDATE users 
       SET is_executive = 0, 
           executive_position = NULL
       WHERE id = ?`,
      [id]
    );

    res.json({ message: 'Leader removed successfully' });
  } catch (error: any) {
    console.error('Remove leader error:', error);
    res.status(500).json({ message: 'Failed to remove leader' });
  }
});

export default router;
