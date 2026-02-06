import express, { Response } from 'express';
import pool from '../config/database';
import { authenticate } from '../middleware/auth.middleware';
import { upload } from '../middleware/upload.middleware';
import { syncUserDepartmentGroups } from '../services/chat.service';

const router = express.Router();

interface AuthRequest extends express.Request {
  user?: {
    id: number;
    email: string;
    role: string;
  };
}

// Get user's chat groups
router.get('/groups', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    console.log(`[Chat Groups] Request from user ${userId}`);

    // First, get user's departments
    const [users] = await pool.execute(
      'SELECT departments FROM users WHERE id = ?',
      [userId]
    ) as any;

    if (users.length > 0 && users[0].departments) {
      let departments: string[] = [];
      try {
        departments = typeof users[0].departments === 'string' 
          ? JSON.parse(users[0].departments) 
          : (Array.isArray(users[0].departments) ? users[0].departments : []);
      } catch (e) {
        console.error(`[Chat Groups] Error parsing departments for user ${userId}:`, e);
        departments = [];
      }

      // Sync user to department groups (ensure they're added) - MUST AWAIT
      if (departments.length > 0) {
        console.log(`[Chat Groups] Syncing departments for user ${userId}:`, departments);
        try {
          await syncUserDepartmentGroups(userId, departments);
          console.log(`[Chat Groups] Successfully synced departments for user ${userId}`);
        } catch (syncError) {
          console.error(`[Chat Groups] Failed to sync departments for user ${userId}:`, syncError);
          // Continue anyway to show existing groups
        }
      } else {
        console.log(`[Chat Groups] User ${userId} has no departments`);
      }
    }

    // Now get all groups user is a member of
    const [groups] = await pool.execute(`
      SELECT DISTINCT
        cg.id, cg.name, cg.description, cg.type, cg.department, cg.photo,
        cg.created_at,
        (SELECT COUNT(*) FROM group_members WHERE group_id = cg.id) as member_count,
        (SELECT COUNT(*) FROM chat_messages WHERE group_id = cg.id AND is_read = FALSE 
         AND sender_id != ?) as unread_count,
        (SELECT message FROM chat_messages WHERE group_id = cg.id 
         ORDER BY created_at DESC LIMIT 1) as last_message,
        (SELECT created_at FROM chat_messages WHERE group_id = cg.id 
         ORDER BY created_at DESC LIMIT 1) as last_message_time
      FROM chat_groups cg
      INNER JOIN group_members gm ON cg.id = gm.group_id
      WHERE gm.user_id = ?
      ORDER BY last_message_time DESC
    `, [userId, userId]);

    console.log(`[Chat Groups] Found ${(groups as any[]).length} groups for user ${userId}`);
    res.json({ groups });
  } catch (error: any) {
    console.error('[Chat Groups] Error:', error);
    res.status(500).json({ error: error.message || 'Failed to load groups' });
  }
});

// Get group details with members
router.get('/groups/:id', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.user!.id;

    // Check if user is member of this group
    const [membership] = await pool.execute(
      'SELECT id FROM group_members WHERE group_id = ? AND user_id = ?',
      [id, userId]
    ) as any;

    if (membership.length === 0) {
      return res.status(403).json({ error: 'You are not a member of this group' });
    }

    // Get group details
    const [groups] = await pool.execute(`
      SELECT cg.*, u.first_name as creator_first_name, u.last_name as creator_last_name
      FROM chat_groups cg
      JOIN users u ON cg.created_by = u.id
      WHERE cg.id = ?
    `, [id]) as any;

    if (groups.length === 0) {
      return res.status(404).json({ error: 'Group not found' });
    }

    // Get members
    const [members] = await pool.execute(`
      SELECT 
        u.id, u.first_name, u.last_name, u.profile_image, u.role,
        gm.role as group_role, gm.joined_at
      FROM group_members gm
      JOIN users u ON gm.user_id = u.id
      WHERE gm.group_id = ?
      ORDER BY gm.role DESC, u.first_name
    `, [id]);

    res.json({ group: groups[0], members });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Get group messages
router.get('/groups/:id/messages', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const groupId = parseInt(req.params.id);
    const userId = req.user!.id;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 50;
    const offset = (page - 1) * limit;

    if (isNaN(groupId)) {
      return res.status(400).json({ error: 'Invalid group ID' });
    }

    console.log(`[Chat Messages] Loading messages for group ${groupId}, user ${userId}, limit ${limit}, offset ${offset}`);

    // Check membership
    const [membership] = await pool.execute(
      'SELECT id FROM group_members WHERE group_id = ? AND user_id = ?',
      [groupId, userId]
    ) as any;

    if (membership.length === 0) {
      return res.status(403).json({ error: 'You are not a member of this group' });
    }

    // Get messages
    let messages = [];
    try {
      console.log(`[Chat Messages] Query params: groupId=${groupId} (${typeof groupId}), limit=${limit} (${typeof limit}), offset=${offset} (${typeof offset})`);
      
      const [result] = await pool.query(`
        SELECT 
          cm.*,
          u.first_name, u.last_name, u.role
        FROM chat_messages cm
        JOIN users u ON cm.sender_id = u.id
        WHERE cm.group_id = ?
        ORDER BY cm.created_at DESC
        LIMIT ? OFFSET ?
      `, [groupId, limit, offset]);
      messages = result as any[];
      console.log(`[Chat Messages] Found ${messages.length} messages`);
    } catch (queryError: any) {
      // If table doesn't exist, return empty array
      console.log('[Chat Messages] Query error:', queryError.message);
      console.log('[Chat Messages] Full error:', queryError);
      messages = [];
    }

    // Mark messages as read
    if (messages.length > 0) {
      try {
        await pool.execute(
          'UPDATE chat_messages SET is_read = TRUE WHERE group_id = ? AND sender_id != ?',
          [groupId, userId]
        );
      } catch (updateError) {
        console.log('[Chat Messages] Error marking as read:', updateError);
      }
    }

    res.json({ messages: (messages as any[]).reverse() }); // Return in chronological order
  } catch (error: any) {
    console.error('[Chat Messages] Error loading messages for group', req.params.id, ':', error);
    res.status(500).json({ error: error.message });
  }
});

// Send message to group
router.post('/groups/:id/messages', authenticate, upload.single('media'), async (req: AuthRequest, res: Response) => {
  try {
    const groupId = parseInt(req.params.id);
    const { message } = req.body;
    const userId = req.user!.id;

    if (isNaN(groupId)) {
      return res.status(400).json({ error: 'Invalid group ID' });
    }

    if (!message && !req.file) {
      return res.status(400).json({ error: 'Message or media is required' });
    }

    // Check membership and role
    const [membership] = await pool.query(
      `SELECT gm.*, cg.type, u.role as user_role 
       FROM group_members gm
       JOIN chat_groups cg ON gm.group_id = cg.id
       JOIN users u ON gm.user_id = u.id
       WHERE gm.group_id = ? AND gm.user_id = ?`,
      [groupId, userId]
    ) as any;

    if (membership.length === 0) {
      return res.status(403).json({ error: 'You are not a member of this group' });
    }

    // Check if media upload is allowed
    if (req.file) {
      const userRole = membership[0].user_role;
      const groupRole = membership[0].role;
      const canUploadMedia = ['super_admin', 'media_head', 'media', 'pastor'].includes(userRole) || groupRole === 'admin';
      
      if (!canUploadMedia) {
        return res.status(403).json({ error: 'Only media team and group admins can upload media' });
      }
    }

    let mediaUrl = null;
    let mediaType = null;

    if (req.file) {
      mediaUrl = `/uploads/${req.file.filename}`;
      if (req.file.mimetype.startsWith('image/')) mediaType = 'image';
      else if (req.file.mimetype.startsWith('video/')) mediaType = 'video';
      else if (req.file.mimetype.startsWith('audio/')) mediaType = 'audio';
      else mediaType = 'document';
    }

    // Insert message
    const [result] = await pool.query(
      `INSERT INTO chat_messages (sender_id, group_id, message, media_url, media_type)
       VALUES (?, ?, ?, ?, ?)`,
      [userId, groupId, message || '', mediaUrl, mediaType]
    ) as any;

    // Get the created message with user details
    const [newMessage] = await pool.query(`
      SELECT 
        cm.*,
        u.first_name, u.last_name, u.role
      FROM chat_messages cm
      JOIN users u ON cm.sender_id = u.id
      WHERE cm.id = ?
    `, [result.insertId]) as any;

    res.status(201).json({ message: newMessage[0] });
  } catch (error: any) {
    console.error('[Chat Send] Error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Create department group (auto-created, but can be manually managed)
router.post('/groups', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { name, description, type, department } = req.body;
    const userId = req.user!.id;
    const userRole = req.user!.role;

    // Only certain roles can create groups
    const canCreateGroup = ['super_admin', 'pastor', 'elder', 'department_head', 'media_head'].includes(userRole);
    if (!canCreateGroup) {
      return res.status(403).json({ error: 'You do not have permission to create groups' });
    }

    if (!name || !type) {
      return res.status(400).json({ error: 'Name and type are required' });
    }

    // Check if department group already exists
    if (type === 'department' && department) {
      const [existing] = await pool.execute(
        'SELECT id FROM chat_groups WHERE type = ? AND department = ?',
        ['department', department]
      ) as any;

      if (existing.length > 0) {
        return res.status(400).json({ error: 'Department group already exists' });
      }
    }

    // Create group
    const [result] = await pool.execute(
      `INSERT INTO chat_groups (name, description, type, department, created_by, is_auto_join)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [name, description, type, department || null, userId, type === 'department' || type === 'general']
    ) as any;

    const groupId = result.insertId;

    // Add creator as admin
    await pool.execute(
      'INSERT INTO group_members (group_id, user_id, role) VALUES (?, ?, ?)',
      [groupId, userId, 'admin']
    );

    // If department group, add all users from that department
    if (type === 'department' && department) {
      await pool.execute(`
        INSERT INTO group_members (group_id, user_id, role)
        SELECT ?, id, 'member'
        FROM users
        WHERE JSON_CONTAINS(departments, JSON_QUOTE(?))
        AND id != ?
      `, [groupId, department, userId]);
    }

    res.status(201).json({ 
      message: 'Group created successfully',
      groupId 
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Add user to group
router.post('/groups/:id/members', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { userId } = req.body;
    const requesterId = req.user!.id;

    // Check if requester is admin of the group
    const [membership] = await pool.execute(
      'SELECT role FROM group_members WHERE group_id = ? AND user_id = ?',
      [id, requesterId]
    ) as any;

    if (membership.length === 0 || membership[0].role !== 'admin') {
      return res.status(403).json({ error: 'Only group admins can add members' });
    }

    // Check if user is already a member
    const [existing] = await pool.execute(
      'SELECT id FROM group_members WHERE group_id = ? AND user_id = ?',
      [id, userId]
    ) as any;

    if (existing.length > 0) {
      return res.status(400).json({ error: 'User is already a member' });
    }

    // Add user
    await pool.execute(
      'INSERT INTO group_members (group_id, user_id, role) VALUES (?, ?, ?)',
      [id, userId, 'member']
    );

    res.json({ message: 'Member added successfully' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Remove user from group
router.delete('/groups/:id/members/:userId', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { id, userId } = req.params;
    const requesterId = req.user!.id;

    // Check if requester is admin or removing themselves
    const [membership] = await pool.execute(
      'SELECT role FROM group_members WHERE group_id = ? AND user_id = ?',
      [id, requesterId]
    ) as any;

    const canRemove = membership.length > 0 && 
      (membership[0].role === 'admin' || requesterId === parseInt(userId));

    if (!canRemove) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    await pool.execute(
      'DELETE FROM group_members WHERE group_id = ? AND user_id = ?',
      [id, userId]
    );

    res.json({ message: 'Member removed successfully' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Get direct messages conversations
router.get('/direct', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;

    // Get unique conversations
    const [conversations] = await pool.execute(`
      SELECT DISTINCT
        CASE 
          WHEN cm.sender_id = ? THEN cm.receiver_id
          ELSE cm.sender_id
        END as other_user_id,
        u.first_name, u.last_name, u.profile_image, u.role,
        (SELECT message FROM chat_messages 
         WHERE (sender_id = ? AND receiver_id = u.id) 
            OR (sender_id = u.id AND receiver_id = ?)
         ORDER BY created_at DESC LIMIT 1) as last_message,
        (SELECT created_at FROM chat_messages 
         WHERE (sender_id = ? AND receiver_id = u.id) 
            OR (sender_id = u.id AND receiver_id = ?)
         ORDER BY created_at DESC LIMIT 1) as last_message_time,
        (SELECT COUNT(*) FROM chat_messages 
         WHERE sender_id = u.id AND receiver_id = ? AND is_read = FALSE) as unread_count
      FROM chat_messages cm
      JOIN users u ON u.id = CASE 
        WHEN cm.sender_id = ? THEN cm.receiver_id
        ELSE cm.sender_id
      END
      WHERE cm.sender_id = ? OR cm.receiver_id = ?
      ORDER BY last_message_time DESC
    `, [userId, userId, userId, userId, userId, userId, userId, userId, userId]);

    res.json({ conversations });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Get direct messages with specific user
router.get('/direct/:otherUserId', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const { otherUserId } = req.params;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 50;
    const offset = (page - 1) * limit;

    const [messages] = await pool.execute(`
      SELECT 
        cm.*,
        u.first_name, u.last_name, u.profile_image, u.role
      FROM chat_messages cm
      JOIN users u ON cm.sender_id = u.id
      WHERE (cm.sender_id = ? AND cm.receiver_id = ?)
         OR (cm.sender_id = ? AND cm.receiver_id = ?)
      ORDER BY cm.created_at DESC
      LIMIT ? OFFSET ?
    `, [userId, otherUserId, otherUserId, userId, limit, offset]);

    // Mark messages as read
    await pool.execute(
      'UPDATE chat_messages SET is_read = TRUE WHERE sender_id = ? AND receiver_id = ?',
      [otherUserId, userId]
    );

    res.json({ messages: (messages as any[]).reverse() });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Send direct message
router.post('/direct/:receiverId', authenticate, upload.single('media'), async (req: AuthRequest, res: Response) => {
  try {
    const { receiverId } = req.params;
    const { message } = req.body;
    const userId = req.user!.id;

    if (!message && !req.file) {
      return res.status(400).json({ error: 'Message or media is required' });
    }

    // Check if media upload is allowed (only media team for DMs)
    if (req.file) {
      const [users] = await pool.execute(
        'SELECT role FROM users WHERE id = ?',
        [userId]
      ) as any;

      const userRole = users[0].role;
      const canUploadMedia = ['super_admin', 'media_head', 'media', 'pastor'].includes(userRole);
      
      if (!canUploadMedia) {
        return res.status(403).json({ error: 'Only media team can upload media in direct messages' });
      }
    }

    let mediaUrl = null;
    let mediaType = null;

    if (req.file) {
      mediaUrl = `/uploads/${req.file.filename}`;
      if (req.file.mimetype.startsWith('image/')) mediaType = 'image';
      else if (req.file.mimetype.startsWith('video/')) mediaType = 'video';
      else if (req.file.mimetype.startsWith('audio/')) mediaType = 'audio';
      else mediaType = 'document';
    }

    const [result] = await pool.execute(
      `INSERT INTO chat_messages (sender_id, receiver_id, message, media_url, media_type)
       VALUES (?, ?, ?, ?, ?)`,
      [userId, receiverId, message || '', mediaUrl, mediaType]
    ) as any;

    const [newMessage] = await pool.execute(`
      SELECT 
        cm.*,
        u.first_name, u.last_name, u.profile_image, u.role
      FROM chat_messages cm
      JOIN users u ON cm.sender_id = u.id
      WHERE cm.id = ?
    `, [result.insertId]) as any;

    res.status(201).json({ message: newMessage[0] });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Mark messages as read in a group
router.put('/groups/:id/messages/read', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const groupId = parseInt(req.params.id);
    const userId = req.user!.id;

    if (isNaN(groupId)) {
      return res.status(400).json({ error: 'Invalid group ID' });
    }

    await pool.query(
      'UPDATE chat_messages SET is_read = TRUE WHERE group_id = ? AND sender_id != ?',
      [groupId, userId]
    );

    res.json({ message: 'Messages marked as read' });
  } catch (error: any) {
    console.error('[Chat Messages] Error marking as read:', error);
    res.status(500).json({ error: error.message });
  }
});

// Upload file/media to group chat
router.post('/groups/:id/upload', authenticate, upload.single('file'), async (req: AuthRequest, res: Response) => {
  try {
    const groupId = parseInt(req.params.id);
    const { messageType } = req.body;
    const userId = req.user!.id;

    if (isNaN(groupId)) {
      return res.status(400).json({ error: 'Invalid group ID' });
    }

    if (!req.file) {
      return res.status(400).json({ error: 'File is required' });
    }

    // Check membership
    const [membership] = await pool.query(
      'SELECT id FROM group_members WHERE group_id = ? AND user_id = ?',
      [groupId, userId]
    ) as any;

    if (membership.length === 0) {
      return res.status(403).json({ error: 'You are not a member of this group' });
    }

    const fileUrl = `/uploads/chat/${req.file.filename}`;

    // Insert message with file
    const [result] = await pool.query(
      `INSERT INTO chat_messages (sender_id, group_id, message, media_type, media_url)
       VALUES (?, ?, ?, ?, ?)`,
      [userId, groupId, req.file.originalname, messageType, fileUrl]
    ) as any;

    res.status(201).json({ 
      messageId: result.insertId,
      fileUrl,
      message: 'File uploaded successfully' 
    });
  } catch (error: any) {
    console.error('[Chat Upload] Error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Delete message
router.delete('/messages/:messageId', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const messageId = parseInt(req.params.messageId);
    const userId = req.user!.id;

    if (isNaN(messageId)) {
      return res.status(400).json({ error: 'Invalid message ID' });
    }

    // Check if message exists and belongs to user
    const [messages] = await pool.query(
      'SELECT id, sender_id, media_url FROM chat_messages WHERE id = ?',
      [messageId]
    ) as any;

    if (messages.length === 0) {
      return res.status(404).json({ error: 'Message not found' });
    }

    const message = messages[0];
    if (message.sender_id !== userId) {
      return res.status(403).json({ error: 'You can only delete your own messages' });
    }

    // Delete the message
    await pool.query('DELETE FROM chat_messages WHERE id = ?', [messageId]);

    // If there's a media file, optionally delete it from filesystem
    if (message.media_url) {
      const fs = require('fs');
      const path = require('path');
      const filePath = path.join(__dirname, '../../', message.media_url);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    }

    res.json({ message: 'Message deleted successfully' });
  } catch (error: any) {
    console.error('[Chat Delete] Error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Sync current user's department groups
router.post('/sync-my-groups', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;

    // Get user's departments
    const [users] = await pool.execute(
      'SELECT departments FROM users WHERE id = ?',
      [userId]
    ) as any;

    if (users.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    let departments: string[] = [];
    if (users[0].departments) {
      try {
        departments = JSON.parse(users[0].departments);
      } catch (e) {
        departments = users[0].departments.split(',').map((d: string) => d.trim()).filter((d: string) => d);
      }
    }

    if (departments.length === 0) {
      return res.json({ message: 'No departments found', groups: [] });
    }

    // Sync department groups
    await syncUserDepartmentGroups(userId, departments);

    // Get updated groups list
    const [groups] = await pool.execute(`
      SELECT DISTINCT
        cg.id, cg.name, cg.description, cg.type, cg.department
      FROM chat_groups cg
      INNER JOIN group_members gm ON cg.id = gm.group_id
      WHERE gm.user_id = ?
      ORDER BY cg.name
    `, [userId]);

    res.json({ 
      message: 'Groups synced successfully',
      groups 
    });
  } catch (error: any) {
    console.error('Sync groups error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get group members
router.get('/groups/:id/members', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const groupId = parseInt(req.params.id);

    // Check if user is a member
    const [membership] = await pool.query(
      'SELECT * FROM group_members WHERE group_id = ? AND user_id = ?',
      [groupId, userId]
    ) as any;

    if (membership.length === 0) {
      return res.status(403).json({ error: 'Not a member of this group' });
    }

    // Get all members with their details
    const [members] = await pool.query(`
      SELECT 
        u.id, 
        u.first_name, 
        u.last_name, 
        u.email,
        u.profile_image as profileImage,
        u.photo,
        gm.role,
        gm.joined_at
      FROM group_members gm
      INNER JOIN users u ON gm.user_id = u.id
      WHERE gm.group_id = ?
      ORDER BY gm.joined_at ASC
    `, [groupId]) as any;

    res.json({ members });
  } catch (error: any) {
    console.error('[Group Members] Error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Add member to group (executives only)
router.post('/groups/:id/members', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const groupId = parseInt(req.params.id);
    const { newUserId } = req.body;

    if (!newUserId) {
      return res.status(400).json({ error: 'newUserId is required' });
    }

    // Check if requester is a member of this group
    const [requesterMembership] = await pool.query(
      'SELECT gm.role, cg.department FROM group_members gm INNER JOIN chat_groups cg ON gm.group_id = cg.id WHERE gm.group_id = ? AND gm.user_id = ?',
      [groupId, userId]
    ) as any;

    if (requesterMembership.length === 0) {
      return res.status(403).json({ error: 'You are not a member of this group' });
    }

    // Check if requester is a department executive (has a position in this department)
    const groupDepartment = requesterMembership[0].department;
    const [executive] = await pool.query(
      'SELECT id, executive_position FROM users WHERE id = ? AND is_executive = 1 AND department = ?',
      [userId, groupDepartment]
    ) as any;

    if (executive.length === 0) {
      return res.status(403).json({ error: 'Only department executives can add members' });
    }

    // Check if new user already exists
    const [existing] = await pool.query(
      'SELECT * FROM group_members WHERE group_id = ? AND user_id = ?',
      [groupId, newUserId]
    ) as any;

    if (existing.length > 0) {
      return res.status(400).json({ error: 'User is already a member' });
    }

    // Add the member
    await pool.query(
      'INSERT INTO group_members (group_id, user_id, role) VALUES (?, ?, ?)',
      [groupId, newUserId, 'member']
    );

    res.json({ message: 'Member added successfully' });
  } catch (error: any) {
    console.error('[Add Member] Error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Remove member from group (executives only)
router.delete('/groups/:id/members/:userId', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const requesterId = req.user!.id;
    const groupId = parseInt(req.params.id);
    const userIdToRemove = parseInt(req.params.userId);

    // Check if requester is a member and get group department
    const [requesterMembership] = await pool.query(
      'SELECT gm.role, cg.department FROM group_members gm INNER JOIN chat_groups cg ON gm.group_id = cg.id WHERE gm.group_id = ? AND gm.user_id = ?',
      [groupId, requesterId]
    ) as any;

    if (requesterMembership.length === 0) {
      return res.status(403).json({ error: 'You are not a member of this group' });
    }

    // Check if requester is a department executive (has a position in this department)
    const groupDepartment = requesterMembership[0].department;
    const [executive] = await pool.query(
      'SELECT id, executive_position FROM users WHERE id = ? AND is_executive = 1 AND department = ?',
      [requesterId, groupDepartment]
    ) as any;

    if (executive.length === 0) {
      return res.status(403).json({ error: 'Only department executives can remove members' });
    }

    // Don't allow removing admins
    const [targetMembership] = await pool.query(
      'SELECT role FROM group_members WHERE group_id = ? AND user_id = ?',
      [groupId, userIdToRemove]
    ) as any;

    if (targetMembership.length > 0 && targetMembership[0].role === 'admin') {
      return res.status(403).json({ error: 'Cannot remove admin from group' });
    }

    // Remove the member
    await pool.query(
      'DELETE FROM group_members WHERE group_id = ? AND user_id = ?',
      [groupId, userIdToRemove]
    );

    res.json({ message: 'Member removed successfully' });
  } catch (error: any) {
    console.error('[Remove Member] Error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Update group settings (executives only)
router.put('/groups/:id/settings', authenticate, upload.single('photo'), async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const groupId = parseInt(req.params.id);

    // Check if user is an executive
    const [membership] = await pool.query(
      'SELECT role FROM group_members WHERE group_id = ? AND user_id = ?',
      [groupId, userId]
    ) as any;

    if (membership.length === 0) {
      return res.status(403).json({ error: 'You are not a member of this group' });
    }

    if (membership[0].role !== 'admin' && membership[0].role !== 'executive') {
      return res.status(403).json({ error: 'Only executives can update group settings' });
    }

    const updates: any = {};
    
    if (req.body.name) updates.name = req.body.name;
    if (req.body.description) updates.description = req.body.description;
    if (req.file) {
      updates.photo = `/uploads/groups/${req.file.filename}`;
    }

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ error: 'No updates provided' });
    }

    const setClause = Object.keys(updates).map(key => `${key} = ?`).join(', ');
    const values = [...Object.values(updates), groupId];

    await pool.query(
      `UPDATE chat_groups SET ${setClause}, updated_at = NOW() WHERE id = ?`,
      values
    );

    res.json({ message: 'Group updated successfully', updates });
  } catch (error: any) {
    console.error('[Update Group] Error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Leave group
router.post('/groups/:id/leave', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const groupId = parseInt(req.params.id);

    // Check if user is the last admin
    const [admins] = await pool.query(
      'SELECT COUNT(*) as adminCount FROM group_members WHERE group_id = ? AND role = ?',
      [groupId, 'admin']
    ) as any;

    const [userRole] = await pool.query(
      'SELECT role FROM group_members WHERE group_id = ? AND user_id = ?',
      [groupId, userId]
    ) as any;

    if (userRole.length > 0 && userRole[0].role === 'admin' && admins[0].adminCount === 1) {
      return res.status(400).json({ error: 'Cannot leave group as the last admin. Please assign another admin first.' });
    }

    // Remove the user
    await pool.query(
      'DELETE FROM group_members WHERE group_id = ? AND user_id = ?',
      [groupId, userId]
    );

    res.json({ message: 'Left group successfully' });
  } catch (error: any) {
    console.error('[Leave Group] Error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get group info
router.get('/groups/:id/info', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const groupId = parseInt(req.params.id);

    // Check if user is a member
    const [membership] = await pool.query(
      'SELECT * FROM group_members WHERE group_id = ? AND user_id = ?',
      [groupId, userId]
    ) as any;

    if (membership.length === 0) {
      return res.status(403).json({ error: 'Not a member of this group' });
    }

    // Get group info with member count
    const [groupInfo] = await pool.query(`
      SELECT 
        cg.*,
        COUNT(gm.id) as memberCount,
        u.first_name as creator_first_name,
        u.last_name as creator_last_name
      FROM chat_groups cg
      LEFT JOIN group_members gm ON cg.id = gm.group_id
      LEFT JOIN users u ON cg.created_by = u.id
      WHERE cg.id = ?
      GROUP BY cg.id
    `, [groupId]) as any;

    if (groupInfo.length === 0) {
      return res.status(404).json({ error: 'Group not found' });
    }

    res.json({ group: groupInfo[0] });
  } catch (error: any) {
    console.error('[Group Info] Error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Add reaction to message
router.post('/messages/:messageId/reactions', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const messageId = parseInt(req.params.messageId);
    const { reaction } = req.body;

    if (!reaction) {
      return res.status(400).json({ error: 'Reaction emoji is required' });
    }

    // Check if user already reacted with this emoji
    const [existing] = await pool.query(
      'SELECT id FROM message_reactions WHERE message_id = ? AND user_id = ? AND reaction = ?',
      [messageId, userId, reaction]
    ) as any;

    if (existing.length > 0) {
      // Remove reaction (toggle off)
      await pool.query(
        'DELETE FROM message_reactions WHERE message_id = ? AND user_id = ? AND reaction = ?',
        [messageId, userId, reaction]
      );
      res.json({ message: 'Reaction removed', removed: true });
    } else {
      // Add reaction
      await pool.query(
        'INSERT INTO message_reactions (message_id, user_id, reaction) VALUES (?, ?, ?)',
        [messageId, userId, reaction]
      );
      res.json({ message: 'Reaction added', removed: false });
    }
  } catch (error: any) {
    console.error('[Add Reaction] Error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get reactions for a message
router.get('/messages/:messageId/reactions', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const messageId = parseInt(req.params.messageId);

    // Get all reactions grouped by emoji
    const [reactions] = await pool.query(`
      SELECT 
        reaction,
        COUNT(*) as count,
        GROUP_CONCAT(CONCAT(u.first_name, ' ', u.last_name) SEPARATOR ', ') as users
      FROM message_reactions mr
      JOIN users u ON mr.user_id = u.id
      WHERE mr.message_id = ?
      GROUP BY reaction
    `, [messageId]) as any;

    res.json({ reactions });
  } catch (error: any) {
    console.error('[Get Reactions] Error:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
