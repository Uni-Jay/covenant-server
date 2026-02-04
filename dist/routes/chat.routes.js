"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const database_1 = __importDefault(require("../config/database"));
const auth_middleware_1 = require("../middleware/auth.middleware");
const upload_middleware_1 = require("../middleware/upload.middleware");
const router = express_1.default.Router();
// Get user's chat groups
router.get('/groups', auth_middleware_1.authenticate, async (req, res) => {
    try {
        const userId = req.user.id;
        const [groups] = await database_1.default.execute(`
      SELECT DISTINCT
        cg.id, cg.name, cg.description, cg.type, cg.department,
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
        res.json({ groups });
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
// Get group details with members
router.get('/groups/:id', auth_middleware_1.authenticate, async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user.id;
        // Check if user is member of this group
        const [membership] = await database_1.default.execute('SELECT id FROM group_members WHERE group_id = ? AND user_id = ?', [id, userId]);
        if (membership.length === 0) {
            return res.status(403).json({ error: 'You are not a member of this group' });
        }
        // Get group details
        const [groups] = await database_1.default.execute(`
      SELECT cg.*, u.first_name as creator_first_name, u.last_name as creator_last_name
      FROM chat_groups cg
      JOIN users u ON cg.created_by = u.id
      WHERE cg.id = ?
    `, [id]);
        if (groups.length === 0) {
            return res.status(404).json({ error: 'Group not found' });
        }
        // Get members
        const [members] = await database_1.default.execute(`
      SELECT 
        u.id, u.first_name, u.last_name, u.profile_image, u.role,
        gm.role as group_role, gm.joined_at
      FROM group_members gm
      JOIN users u ON gm.user_id = u.id
      WHERE gm.group_id = ?
      ORDER BY gm.role DESC, u.first_name
    `, [id]);
        res.json({ group: groups[0], members });
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
// Get group messages
router.get('/groups/:id/messages', auth_middleware_1.authenticate, async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user.id;
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 50;
        const offset = (page - 1) * limit;
        // Check membership
        const [membership] = await database_1.default.execute('SELECT id FROM group_members WHERE group_id = ? AND user_id = ?', [id, userId]);
        if (membership.length === 0) {
            return res.status(403).json({ error: 'You are not a member of this group' });
        }
        // Get messages
        const [messages] = await database_1.default.execute(`
      SELECT 
        cm.*,
        u.first_name, u.last_name, u.profile_image, u.role
      FROM chat_messages cm
      JOIN users u ON cm.sender_id = u.id
      WHERE cm.group_id = ?
      ORDER BY cm.created_at DESC
      LIMIT ? OFFSET ?
    `, [id, limit, offset]);
        // Mark messages as read
        await database_1.default.execute('UPDATE chat_messages SET is_read = TRUE WHERE group_id = ? AND sender_id != ?', [id, userId]);
        res.json({ messages: messages.reverse() }); // Return in chronological order
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
// Send message to group
router.post('/groups/:id/messages', auth_middleware_1.authenticate, upload_middleware_1.upload.single('media'), async (req, res) => {
    try {
        const { id } = req.params;
        const { message } = req.body;
        const userId = req.user.id;
        if (!message && !req.file) {
            return res.status(400).json({ error: 'Message or media is required' });
        }
        // Check membership and role
        const [membership] = await database_1.default.execute(`SELECT gm.*, cg.type, u.role as user_role 
       FROM group_members gm
       JOIN chat_groups cg ON gm.group_id = cg.id
       JOIN users u ON gm.user_id = u.id
       WHERE gm.group_id = ? AND gm.user_id = ?`, [id, userId]);
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
            if (req.file.mimetype.startsWith('image/'))
                mediaType = 'image';
            else if (req.file.mimetype.startsWith('video/'))
                mediaType = 'video';
            else if (req.file.mimetype.startsWith('audio/'))
                mediaType = 'audio';
            else
                mediaType = 'document';
        }
        // Insert message
        const [result] = await database_1.default.execute(`INSERT INTO chat_messages (sender_id, group_id, message, media_url, media_type)
       VALUES (?, ?, ?, ?, ?)`, [userId, id, message || '', mediaUrl, mediaType]);
        // Get the created message with user details
        const [newMessage] = await database_1.default.execute(`
      SELECT 
        cm.*,
        u.first_name, u.last_name, u.profile_image, u.role
      FROM chat_messages cm
      JOIN users u ON cm.sender_id = u.id
      WHERE cm.id = ?
    `, [result.insertId]);
        res.status(201).json({ message: newMessage[0] });
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
// Create department group (auto-created, but can be manually managed)
router.post('/groups', auth_middleware_1.authenticate, async (req, res) => {
    try {
        const { name, description, type, department } = req.body;
        const userId = req.user.id;
        const userRole = req.user.role;
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
            const [existing] = await database_1.default.execute('SELECT id FROM chat_groups WHERE type = ? AND department = ?', ['department', department]);
            if (existing.length > 0) {
                return res.status(400).json({ error: 'Department group already exists' });
            }
        }
        // Create group
        const [result] = await database_1.default.execute(`INSERT INTO chat_groups (name, description, type, department, created_by, is_auto_join)
       VALUES (?, ?, ?, ?, ?, ?)`, [name, description, type, department || null, userId, type === 'department' || type === 'general']);
        const groupId = result.insertId;
        // Add creator as admin
        await database_1.default.execute('INSERT INTO group_members (group_id, user_id, role) VALUES (?, ?, ?)', [groupId, userId, 'admin']);
        // If department group, add all users from that department
        if (type === 'department' && department) {
            await database_1.default.execute(`
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
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
// Add user to group
router.post('/groups/:id/members', auth_middleware_1.authenticate, async (req, res) => {
    try {
        const { id } = req.params;
        const { userId } = req.body;
        const requesterId = req.user.id;
        // Check if requester is admin of the group
        const [membership] = await database_1.default.execute('SELECT role FROM group_members WHERE group_id = ? AND user_id = ?', [id, requesterId]);
        if (membership.length === 0 || membership[0].role !== 'admin') {
            return res.status(403).json({ error: 'Only group admins can add members' });
        }
        // Check if user is already a member
        const [existing] = await database_1.default.execute('SELECT id FROM group_members WHERE group_id = ? AND user_id = ?', [id, userId]);
        if (existing.length > 0) {
            return res.status(400).json({ error: 'User is already a member' });
        }
        // Add user
        await database_1.default.execute('INSERT INTO group_members (group_id, user_id, role) VALUES (?, ?, ?)', [id, userId, 'member']);
        res.json({ message: 'Member added successfully' });
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
// Remove user from group
router.delete('/groups/:id/members/:userId', auth_middleware_1.authenticate, async (req, res) => {
    try {
        const { id, userId } = req.params;
        const requesterId = req.user.id;
        // Check if requester is admin or removing themselves
        const [membership] = await database_1.default.execute('SELECT role FROM group_members WHERE group_id = ? AND user_id = ?', [id, requesterId]);
        const canRemove = membership.length > 0 &&
            (membership[0].role === 'admin' || requesterId === parseInt(userId));
        if (!canRemove) {
            return res.status(403).json({ error: 'Unauthorized' });
        }
        await database_1.default.execute('DELETE FROM group_members WHERE group_id = ? AND user_id = ?', [id, userId]);
        res.json({ message: 'Member removed successfully' });
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
// Get direct messages conversations
router.get('/direct', auth_middleware_1.authenticate, async (req, res) => {
    try {
        const userId = req.user.id;
        // Get unique conversations
        const [conversations] = await database_1.default.execute(`
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
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
// Get direct messages with specific user
router.get('/direct/:otherUserId', auth_middleware_1.authenticate, async (req, res) => {
    try {
        const userId = req.user.id;
        const { otherUserId } = req.params;
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 50;
        const offset = (page - 1) * limit;
        const [messages] = await database_1.default.execute(`
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
        await database_1.default.execute('UPDATE chat_messages SET is_read = TRUE WHERE sender_id = ? AND receiver_id = ?', [otherUserId, userId]);
        res.json({ messages: messages.reverse() });
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
// Send direct message
router.post('/direct/:receiverId', auth_middleware_1.authenticate, upload_middleware_1.upload.single('media'), async (req, res) => {
    try {
        const { receiverId } = req.params;
        const { message } = req.body;
        const userId = req.user.id;
        if (!message && !req.file) {
            return res.status(400).json({ error: 'Message or media is required' });
        }
        // Check if media upload is allowed (only media team for DMs)
        if (req.file) {
            const [users] = await database_1.default.execute('SELECT role FROM users WHERE id = ?', [userId]);
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
            if (req.file.mimetype.startsWith('image/'))
                mediaType = 'image';
            else if (req.file.mimetype.startsWith('video/'))
                mediaType = 'video';
            else if (req.file.mimetype.startsWith('audio/'))
                mediaType = 'audio';
            else
                mediaType = 'document';
        }
        const [result] = await database_1.default.execute(`INSERT INTO chat_messages (sender_id, receiver_id, message, media_url, media_type)
       VALUES (?, ?, ?, ?, ?)`, [userId, receiverId, message || '', mediaUrl, mediaType]);
        const [newMessage] = await database_1.default.execute(`
      SELECT 
        cm.*,
        u.first_name, u.last_name, u.profile_image, u.role
      FROM chat_messages cm
      JOIN users u ON cm.sender_id = u.id
      WHERE cm.id = ?
    `, [result.insertId]);
        res.status(201).json({ message: newMessage[0] });
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
exports.default = router;
