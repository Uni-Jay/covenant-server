import { Router } from 'express';
import pool from '../config/database';
import { authenticate } from '../middleware/auth.middleware';
import { requireSuperAdmin } from '../middleware/permissions.middleware';

const router = Router();

/**
 * Admin-only route to list all users with their roles and departments
 */
router.get('/users', authenticate, async (req, res) => {
  try {
    const adminUser = (req as any).user;

    // Check if requester is admin or media
    if (!['super_admin', 'admin', 'media'].includes(adminUser.role)) {
      return res.status(403).json({ error: 'Only admins can view users' });
    }

    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 50;
    const offset = (page - 1) * limit;

    // Get total count
    const [countResult]: any = await pool.execute(
      'SELECT COUNT(*) as total FROM users'
    );
    const total = countResult[0].total;

    // Get users
    const [users]: any = await pool.execute(
      'SELECT id, email, first_name, last_name, role, departments, is_approved, created_at FROM users ORDER BY created_at DESC LIMIT ? OFFSET ?',
      [limit, offset]
    );

    // Parse departments for each user
    const formattedUsers = users.map((user: any) => {
      let departments = [];
      if (user.departments) {
        if (Array.isArray(user.departments)) {
          departments = user.departments;
        } else if (typeof user.departments === 'string') {
          try {
            departments = JSON.parse(user.departments);
          } catch {
            departments = [];
          }
        }
      }

      return {
        id: user.id,
        email: user.email,
        name: `${user.first_name} ${user.last_name}`,
        role: user.role || 'member',
        departments,
        isActive: user.is_approved,
        status: user.is_approved ? 'active' : 'suspended',
        createdAt: user.created_at
      };
    });

    res.json({
      users: formattedUsers,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error: any) {
    console.error('Error fetching users:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Admin-only route to assign a role to a user
 * Only admin/media can assign roles to other users
 */
router.post('/users/:userId/assign-role', authenticate, async (req, res) => {
  try {
    const { userId } = req.params;
    const { role } = req.body;
    const adminUser = (req as any).user;

    // Check if requester is admin or media
    if (!['super_admin', 'admin', 'media'].includes(adminUser.role)) {
      return res.status(403).json({ error: 'Only admins can assign roles' });
    }

    // Validate role
    const validRoles = ['member', 'gen_overseer', 'senior_pastor', 'pastor', 'church_committee_chairman', 'church_committee_secretary', 'secretary', 'treasurer', 'pro', 'media', 'coordinator', 'assistant_coordinator'];
    if (!validRoles.includes(role)) {
      return res.status(400).json({ error: `Invalid role. Must be one of: ${validRoles.join(', ')}` });
    }

    // Get current user
    const [users]: any = await pool.execute('SELECT id, role FROM users WHERE id = ?', [userId]);
    if (users.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const currentRole = users[0].role;

    // Update user role
    await pool.execute('UPDATE users SET role = ? WHERE id = ?', [role, userId]);

    // Log the change
    await logRoleChange(userId, adminUser.id, currentRole, role, 'role_assigned');

    res.json({ 
      message: `User role updated from '${currentRole}' to '${role}'`,
      userId,
      newRole: role
    });
  } catch (error: any) {
    console.error('Error assigning role:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Admin-only route to remove a role from a user (revert to member)
 */
router.post('/users/:userId/remove-role', authenticate, async (req, res) => {
  try {
    const { userId } = req.params;
    const adminUser = (req as any).user;

    // Check if requester is admin or media
    if (!['super_admin', 'admin', 'media'].includes(adminUser.role)) {
      return res.status(403).json({ error: 'Only admins can remove roles' });
    }

    // Get current user
    const [users]: any = await pool.execute('SELECT id, role FROM users WHERE id = ?', [userId]);
    if (users.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const currentRole = users[0].role;

    // Revert to member role
    await pool.execute('UPDATE users SET role = ? WHERE id = ?', ['member', userId]);

    // Log the change
    await logRoleChange(userId, adminUser.id, currentRole, 'member', 'role_removed');

    res.json({ 
      message: `User role removed. User reverted to 'member'`,
      userId,
      previousRole: currentRole,
      newRole: 'member'
    });
  } catch (error: any) {
    console.error('Error removing role:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Admin-only route to assign a user to a department
 */
router.post('/users/:userId/assign-department', authenticate, async (req, res) => {
  try {
    const { userId } = req.params;
    const { department } = req.body;
    const adminUser = (req as any).user;

    // Check if requester is admin or media
    if (!['super_admin', 'admin', 'media'].includes(adminUser.role)) {
      return res.status(403).json({ error: 'Only admins can assign departments' });
    }

    if (!department || typeof department !== 'string') {
      return res.status(400).json({ error: 'Department name is required' });
    }

    // Get current user and departments
    const [users]: any = await pool.execute(
      'SELECT id, departments FROM users WHERE id = ?',
      [userId]
    );

    if (users.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Parse existing departments
    let departments = [];
    const user = users[0];
    if (user.departments) {
      if (Array.isArray(user.departments)) {
        departments = user.departments;
      } else if (typeof user.departments === 'string') {
        try {
          departments = JSON.parse(user.departments);
        } catch {
          departments = [];
        }
      }
    }

    // Add department if not already present
    if (!departments.includes(department)) {
      departments.push(department);
    }

    // Update departments
    await pool.execute(
      'UPDATE users SET departments = ? WHERE id = ?',
      [JSON.stringify(departments), userId]
    );

    // Log the change
    await logDepartmentChange(userId, adminUser.id, 'department_added', department);

    res.json({
      message: `User assigned to department '${department}'`,
      userId,
      departments
    });
  } catch (error: any) {
    console.error('Error assigning department:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Admin-only route to remove a user from a department
 */
router.post('/users/:userId/remove-department', authenticate, async (req, res) => {
  try {
    const { userId } = req.params;
    const { department } = req.body;
    const adminUser = (req as any).user;

    // Check if requester is admin or media
    if (!['super_admin', 'admin', 'media'].includes(adminUser.role)) {
      return res.status(403).json({ error: 'Only admins can remove departments' });
    }

    if (!department || typeof department !== 'string') {
      return res.status(400).json({ error: 'Department name is required' });
    }

    // Get current user and departments
    const [users]: any = await pool.execute(
      'SELECT id, departments FROM users WHERE id = ?',
      [userId]
    );

    if (users.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Parse existing departments
    let departments = [];
    const user = users[0];
    if (user.departments) {
      if (Array.isArray(user.departments)) {
        departments = user.departments;
      } else if (typeof user.departments === 'string') {
        try {
          departments = JSON.parse(user.departments);
        } catch {
          departments = [];
        }
      }
    }

    // Remove department
    departments = departments.filter((d: string) => d !== department);

    // Update departments
    await pool.execute(
      'UPDATE users SET departments = ? WHERE id = ?',
      [JSON.stringify(departments), userId]
    );

    // Log the change
    await logDepartmentChange(userId, adminUser.id, 'department_removed', department);

    res.json({
      message: `User removed from department '${department}'`,
      userId,
      departments
    });
  } catch (error: any) {
    console.error('Error removing department:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Admin-only route to suspend a user (disable access)
 */
router.post('/users/:userId/suspend', authenticate, async (req, res) => {
  try {
    const { userId } = req.params;
    const { reason } = req.body;
    const adminUser = (req as any).user;

    // Check if requester is admin or media
    if (!['super_admin', 'admin', 'media'].includes(adminUser.role)) {
      return res.status(403).json({ error: 'Only admins can suspend users' });
    }

    // Get current user
    const [users]: any = await pool.execute(
      'SELECT id, is_approved FROM users WHERE id = ?',
      [userId]
    );

    if (users.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Suspend user (set is_approved to false)
    await pool.execute('UPDATE users SET is_approved = 0 WHERE id = ?', [userId]);

    // Log the suspension
    await logUserAction(userId, adminUser.id, 'user_suspended', reason || 'No reason provided');

    res.json({
      message: `User suspended successfully`,
      userId
    });
  } catch (error: any) {
    console.error('Error suspending user:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Admin-only route to restore/unsuspend a user
 */
router.post('/users/:userId/restore', authenticate, async (req, res) => {
  try {
    const { userId } = req.params;
    const adminUser = (req as any).user;

    // Check if requester is admin or media
    if (!['super_admin', 'admin', 'media'].includes(adminUser.role)) {
      return res.status(403).json({ error: 'Only admins can restore users' });
    }

    // Get current user
    const [users]: any = await pool.execute(
      'SELECT id, is_approved FROM users WHERE id = ?',
      [userId]
    );

    if (users.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Restore user (set is_approved to true)
    await pool.execute('UPDATE users SET is_approved = 1 WHERE id = ?', [userId]);

    // Log the restoration
    await logUserAction(userId, adminUser.id, 'user_restored', 'User restored to active');

    res.json({
      message: `User restored successfully`,
      userId
    });
  } catch (error: any) {
    console.error('Error restoring user:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Admin-only route to view a user's roles and departments
 */
router.get('/users/:userId/access-info', authenticate, async (req, res) => {
  try {
    const { userId } = req.params;
    const adminUser = (req as any).user;

    // Check if requester is admin or media
    if (!['super_admin', 'admin', 'media'].includes(adminUser.role)) {
      return res.status(403).json({ error: 'Only admins can view user access info' });
    }

    // Get user info
    const [users]: any = await pool.execute(
      'SELECT id, email, first_name, last_name, role, departments, is_approved FROM users WHERE id = ?',
      [userId]
    );

    if (users.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const user = users[0];

    // Parse departments
    let departments = [];
    if (user.departments) {
      if (Array.isArray(user.departments)) {
        departments = user.departments;
      } else if (typeof user.departments === 'string') {
        try {
          departments = JSON.parse(user.departments);
        } catch {
          departments = [];
        }
      }
    }

    res.json({
      userId: user.id,
      email: user.email,
      name: `${user.first_name} ${user.last_name}`,
      role: user.role,
      departments,
      isActive: user.is_approved,
      status: user.is_approved ? 'active' : 'suspended'
    });
  } catch (error: any) {
    console.error('Error getting user access info:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Helper function to log role changes
 */
async function logRoleChange(
  userId: number,
  adminId: number,
  oldRole: string,
  newRole: string,
  action: string
) {
  try {
    // Create audit_logs table if it doesn't exist
    await pool.execute(`
      CREATE TABLE IF NOT EXISTS audit_logs (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        admin_id INT NOT NULL,
        action VARCHAR(100) NOT NULL,
        old_value VARCHAR(255),
        new_value VARCHAR(255),
        timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_user_id (user_id),
        INDEX idx_admin_id (admin_id),
        INDEX idx_timestamp (timestamp)
      )
    `);

    await pool.execute(
      'INSERT INTO audit_logs (user_id, admin_id, action, old_value, new_value) VALUES (?, ?, ?, ?, ?)',
      [userId, adminId, action, oldRole, newRole]
    );
  } catch (error) {
    console.error('Error logging role change:', error);
    // Don't throw - logging failure shouldn't break the main operation
  }
}

/**
 * Helper function to log department changes
 */
async function logDepartmentChange(
  userId: number,
  adminId: number,
  action: string,
  department: string
) {
  try {
    // Create audit_logs table if it doesn't exist
    await pool.execute(`
      CREATE TABLE IF NOT EXISTS audit_logs (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        admin_id INT NOT NULL,
        action VARCHAR(100) NOT NULL,
        old_value VARCHAR(255),
        new_value VARCHAR(255),
        timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_user_id (user_id),
        INDEX idx_admin_id (admin_id),
        INDEX idx_timestamp (timestamp)
      )
    `);

    await pool.execute(
      'INSERT INTO audit_logs (user_id, admin_id, action, new_value) VALUES (?, ?, ?, ?)',
      [userId, adminId, action, department]
    );
  } catch (error) {
    console.error('Error logging department change:', error);
  }
}

/**
 * Helper function to log user actions
 */
async function logUserAction(
  userId: number,
  adminId: number,
  action: string,
  details: string
) {
  try {
    await pool.execute(`
      CREATE TABLE IF NOT EXISTS audit_logs (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        admin_id INT NOT NULL,
        action VARCHAR(100) NOT NULL,
        old_value VARCHAR(255),
        new_value VARCHAR(255),
        timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_user_id (user_id),
        INDEX idx_admin_id (admin_id),
        INDEX idx_timestamp (timestamp)
      )
    `);

    await pool.execute(
      'INSERT INTO audit_logs (user_id, admin_id, action, new_value) VALUES (?, ?, ?, ?)',
      [userId, adminId, action, details]
    );
  } catch (error) {
    console.error('Error logging user action:', error);
  }
}

export default router;
