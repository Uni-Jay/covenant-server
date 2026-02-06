"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const database_1 = __importDefault(require("../config/database"));
const auth_middleware_1 = require("../middleware/auth.middleware");
const upload_middleware_1 = require("../middleware/upload.middleware");
const chat_service_1 = require("../services/chat.service");
const router = express_1.default.Router();
// Get user's chat groups
router.get('/groups', auth_middleware_1.authenticate, async (req, res) => {
    try {
        const userId = req.user.id;
        console.log(`[Chat Groups] Request from user ${userId}`);
        // First, get user's departments
        const [users] = await database_1.default.execute('SELECT departments FROM users WHERE id = ?', [userId]);
        if (users.length > 0 && users[0].departments) {
            let departments = [];
            try {
                departments = typeof users[0].departments === 'string'
                    ? JSON.parse(users[0].departments)
                    : (Array.isArray(users[0].departments) ? users[0].departments : []);
            }
            catch (e) {
                console.error(`[Chat Groups] Error parsing departments for user ${userId}:`, e);
                departments = [];
            }
            // Sync user to department groups (ensure they're added) - MUST AWAIT
            if (departments.length > 0) {
                console.log(`[Chat Groups] Syncing departments for user ${userId}:`, departments);
                try {
                    await (0, chat_service_1.syncUserDepartmentGroups)(userId, departments);
                    console.log(`[Chat Groups] Successfully synced departments for user ${userId}`);
                }
                catch (syncError) {
                    console.error(`[Chat Groups] Failed to sync departments for user ${userId}:`, syncError);
                    // Continue anyway to show existing groups
                }
            }
            else {
                console.log(`[Chat Groups] User ${userId} has no departments`);
            }
        }
        // Now get all groups user is a member of
        const [groups] = await database_1.default.execute(`
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
        console.log(`[Chat Groups] Found ${groups.length} groups for user ${userId}`);
        res.json({ groups });
    }
    catch (error) {
        console.error('[Chat Groups] Error:', error);
        res.status(500).json({ error: error.message || 'Failed to load groups' });
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
        const groupId = parseInt(req.params.id);
        const userId = req.user.id;
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 50;
        const offset = (page - 1) * limit;
        if (isNaN(groupId)) {
            return res.status(400).json({ error: 'Invalid group ID' });
        }
        console.log(`[Chat Messages] Loading messages for group ${groupId}, user ${userId}, limit ${limit}, offset ${offset}`);
        // Check membership
        const [membership] = await database_1.default.execute('SELECT id FROM group_members WHERE group_id = ? AND user_id = ?', [groupId, userId]);
        if (membership.length === 0) {
            return res.status(403).json({ error: 'You are not a member of this group' });
        }
        // Get messages
        let messages = [];
        try {
            console.log(`[Chat Messages] Query params: groupId=${groupId} (${typeof groupId}), limit=${limit} (${typeof limit}), offset=${offset} (${typeof offset})`);
            const [result] = await database_1.default.query(`
        SELECT 
          cm.*,
          u.first_name, u.last_name, u.role
        FROM chat_messages cm
        JOIN users u ON cm.sender_id = u.id
        WHERE cm.group_id = ?
        ORDER BY cm.created_at DESC
        LIMIT ? OFFSET ?
      `, [groupId, limit, offset]);
            messages = result;
            console.log(`[Chat Messages] Found ${messages.length} messages`);
        }
        catch (queryError) {
            // If table doesn't exist, return empty array
            console.log('[Chat Messages] Query error:', queryError.message);
            console.log('[Chat Messages] Full error:', queryError);
            messages = [];
        }
        // Mark messages as read
        if (messages.length > 0) {
            try {
                await database_1.default.execute('UPDATE chat_messages SET is_read = TRUE WHERE group_id = ? AND sender_id != ?', [groupId, userId]);
            }
            catch (updateError) {
                console.log('[Chat Messages] Error marking as read:', updateError);
            }
        }
        res.json({ messages: messages.reverse() }); // Return in chronological order
    }
    catch (error) {
        console.error('[Chat Messages] Error loading messages for group', req.params.id, ':', error);
        res.status(500).json({ error: error.message });
    }
});
// Send message to group
router.post('/groups/:id/messages', auth_middleware_1.authenticate, upload_middleware_1.upload.single('media'), async (req, res) => {
    try {
        const groupId = parseInt(req.params.id);
        const { message } = req.body;
        const userId = req.user.id;
        if (isNaN(groupId)) {
            return res.status(400).json({ error: 'Invalid group ID' });
        }
        if (!message && !req.file) {
            return res.status(400).json({ error: 'Message or media is required' });
        }
        // Check membership and role
        const [membership] = await database_1.default.query(`SELECT gm.*, cg.type, u.role as user_role 
       FROM group_members gm
       JOIN chat_groups cg ON gm.group_id = cg.id
       JOIN users u ON gm.user_id = u.id
       WHERE gm.group_id = ? AND gm.user_id = ?`, [groupId, userId]);
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
        const [result] = await database_1.default.query(`INSERT INTO chat_messages (sender_id, group_id, message, media_url, media_type)
       VALUES (?, ?, ?, ?, ?)`, [userId, groupId, message || '', mediaUrl, mediaType]);
        // Get the created message with user details
        const [newMessage] = await database_1.default.query(`
      SELECT 
        cm.*,
        u.first_name, u.last_name, u.role
      FROM chat_messages cm
      JOIN users u ON cm.sender_id = u.id
      WHERE cm.id = ?
    `, [result.insertId]);
        res.status(201).json({ message: newMessage[0] });
    }
    catch (error) {
        console.error('[Chat Send] Error:', error);
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
// Mark messages as read in a group
router.put('/groups/:id/messages/read', auth_middleware_1.authenticate, async (req, res) => {
    try {
        const groupId = parseInt(req.params.id);
        const userId = req.user.id;
        if (isNaN(groupId)) {
            return res.status(400).json({ error: 'Invalid group ID' });
        }
        await database_1.default.query('UPDATE chat_messages SET is_read = TRUE WHERE group_id = ? AND sender_id != ?', [groupId, userId]);
        res.json({ message: 'Messages marked as read' });
    }
    catch (error) {
        console.error('[Chat Messages] Error marking as read:', error);
        res.status(500).json({ error: error.message });
    }
});
// Upload file/media to group chat
router.post('/groups/:id/upload', auth_middleware_1.authenticate, upload_middleware_1.upload.single('file'), async (req, res) => {
    try {
        const groupId = parseInt(req.params.id);
        const { messageType } = req.body;
        const userId = req.user.id;
        if (isNaN(groupId)) {
            return res.status(400).json({ error: 'Invalid group ID' });
        }
        if (!req.file) {
            return res.status(400).json({ error: 'File is required' });
        }
        // Check membership
        const [membership] = await database_1.default.query('SELECT id FROM group_members WHERE group_id = ? AND user_id = ?', [groupId, userId]);
        if (membership.length === 0) {
            return res.status(403).json({ error: 'You are not a member of this group' });
        }
        const fileUrl = `/uploads/chat/${req.file.filename}`;
        // Insert message with file
        const [result] = await database_1.default.query(`INSERT INTO chat_messages (sender_id, group_id, message, media_type, media_url)
       VALUES (?, ?, ?, ?, ?)`, [userId, groupId, req.file.originalname, messageType, fileUrl]);
        res.status(201).json({
            messageId: result.insertId,
            fileUrl,
            message: 'File uploaded successfully'
        });
    }
    catch (error) {
        console.error('[Chat Upload] Error:', error);
        res.status(500).json({ error: error.message });
    }
});
// Delete message
router.delete('/messages/:messageId', auth_middleware_1.authenticate, async (req, res) => {
    try {
        const messageId = parseInt(req.params.messageId);
        const userId = req.user.id;
        if (isNaN(messageId)) {
            return res.status(400).json({ error: 'Invalid message ID' });
        }
        // Check if message exists and belongs to user
        const [messages] = await database_1.default.query('SELECT id, sender_id, media_url FROM chat_messages WHERE id = ?', [messageId]);
        if (messages.length === 0) {
            return res.status(404).json({ error: 'Message not found' });
        }
        const message = messages[0];
        if (message.sender_id !== userId) {
            return res.status(403).json({ error: 'You can only delete your own messages' });
        }
        // Delete the message
        await database_1.default.query('DELETE FROM chat_messages WHERE id = ?', [messageId]);
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
    }
    catch (error) {
        console.error('[Chat Delete] Error:', error);
        res.status(500).json({ error: error.message });
    }
});
// Sync current user's department groups
router.post('/sync-my-groups', auth_middleware_1.authenticate, async (req, res) => {
    try {
        const userId = req.user.id;
        // Get user's departments
        const [users] = await database_1.default.execute('SELECT departments FROM users WHERE id = ?', [userId]);
        if (users.length === 0) {
            return res.status(404).json({ error: 'User not found' });
        }
        let departments = [];
        if (users[0].departments) {
            try {
                departments = JSON.parse(users[0].departments);
            }
            catch (e) {
                departments = users[0].departments.split(',').map((d) => d.trim()).filter((d) => d);
            }
        }
        if (departments.length === 0) {
            return res.json({ message: 'No departments found', groups: [] });
        }
        // Sync department groups
        await (0, chat_service_1.syncUserDepartmentGroups)(userId, departments);
        // Get updated groups list
        const [groups] = await database_1.default.execute(`
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
    }
    catch (error) {
        console.error('Sync groups error:', error);
        res.status(500).json({ error: error.message });
    }
});
// Get group members
router.get('/groups/:id/members', auth_middleware_1.authenticate, async (req, res) => {
    try {
        const userId = req.user.id;
        const groupId = parseInt(req.params.id);
        // Check if user is a member
        const [membership] = await database_1.default.query('SELECT * FROM group_members WHERE group_id = ? AND user_id = ?', [groupId, userId]);
        if (membership.length === 0) {
            return res.status(403).json({ error: 'Not a member of this group' });
        }
        // Get all members with their details
        const [members] = await database_1.default.query(`
      SELECT 
        u.id, 
        u.first_name, 
        u.last_name, 
        u.email, 
        gm.role,
        gm.joined_at
      FROM group_members gm
      INNER JOIN users u ON gm.user_id = u.id
      WHERE gm.group_id = ?
      ORDER BY gm.joined_at ASC
    `, [groupId]);
        res.json({ members });
    }
    catch (error) {
        console.error('[Group Members] Error:', error);
        res.status(500).json({ error: error.message });
    }
});
// Add member to group (executives only)
router.post('/groups/:id/members', auth_middleware_1.authenticate, async (req, res) => {
    try {
        const userId = req.user.id;
        const groupId = parseInt(req.params.id);
        const { newUserId } = req.body;
        if (!newUserId) {
            return res.status(400).json({ error: 'newUserId is required' });
        }
        // Check if requester is an executive (admin/executive role in group_members)
        const [requesterMembership] = await database_1.default.query('SELECT role FROM group_members WHERE group_id = ? AND user_id = ?', [groupId, userId]);
        if (requesterMembership.length === 0) {
            return res.status(403).json({ error: 'You are not a member of this group' });
        }
        if (requesterMembership[0].role !== 'admin' && requesterMembership[0].role !== 'executive') {
            return res.status(403).json({ error: 'Only executives can add members' });
        }
        // Check if new user already exists
        const [existing] = await database_1.default.query('SELECT * FROM group_members WHERE group_id = ? AND user_id = ?', [groupId, newUserId]);
        if (existing.length > 0) {
            return res.status(400).json({ error: 'User is already a member' });
        }
        // Add the member
        await database_1.default.query('INSERT INTO group_members (group_id, user_id, role) VALUES (?, ?, ?)', [groupId, newUserId, 'member']);
        res.json({ message: 'Member added successfully' });
    }
    catch (error) {
        console.error('[Add Member] Error:', error);
        res.status(500).json({ error: error.message });
    }
});
// Remove member from group (executives only)
router.delete('/groups/:id/members/:userId', auth_middleware_1.authenticate, async (req, res) => {
    try {
        const requesterId = req.user.id;
        const groupId = parseInt(req.params.id);
        const userIdToRemove = parseInt(req.params.userId);
        // Check if requester is an executive
        const [requesterMembership] = await database_1.default.query('SELECT role FROM group_members WHERE group_id = ? AND user_id = ?', [groupId, requesterId]);
        if (requesterMembership.length === 0) {
            return res.status(403).json({ error: 'You are not a member of this group' });
        }
        if (requesterMembership[0].role !== 'admin' && requesterMembership[0].role !== 'executive') {
            return res.status(403).json({ error: 'Only executives can remove members' });
        }
        // Don't allow removing admins
        const [targetMembership] = await database_1.default.query('SELECT role FROM group_members WHERE group_id = ? AND user_id = ?', [groupId, userIdToRemove]);
        if (targetMembership.length > 0 && targetMembership[0].role === 'admin') {
            return res.status(403).json({ error: 'Cannot remove admin from group' });
        }
        // Remove the member
        await database_1.default.query('DELETE FROM group_members WHERE group_id = ? AND user_id = ?', [groupId, userIdToRemove]);
        res.json({ message: 'Member removed successfully' });
    }
    catch (error) {
        console.error('[Remove Member] Error:', error);
        res.status(500).json({ error: error.message });
    }
});
// Update group settings (executives only)
router.put('/groups/:id/settings', auth_middleware_1.authenticate, upload_middleware_1.upload.single('photo'), async (req, res) => {
    try {
        const userId = req.user.id;
        const groupId = parseInt(req.params.id);
        // Check if user is an executive
        const [membership] = await database_1.default.query('SELECT role FROM group_members WHERE group_id = ? AND user_id = ?', [groupId, userId]);
        if (membership.length === 0) {
            return res.status(403).json({ error: 'You are not a member of this group' });
        }
        if (membership[0].role !== 'admin' && membership[0].role !== 'executive') {
            return res.status(403).json({ error: 'Only executives can update group settings' });
        }
        const updates = {};
        if (req.body.name)
            updates.name = req.body.name;
        if (req.body.description)
            updates.description = req.body.description;
        if (req.file) {
            updates.photo = `/uploads/groups/${req.file.filename}`;
        }
        if (Object.keys(updates).length === 0) {
            return res.status(400).json({ error: 'No updates provided' });
        }
        const setClause = Object.keys(updates).map(key => `${key} = ?`).join(', ');
        const values = [...Object.values(updates), groupId];
        await database_1.default.query(`UPDATE chat_groups SET ${setClause}, updated_at = NOW() WHERE id = ?`, values);
        res.json({ message: 'Group updated successfully', updates });
    }
    catch (error) {
        console.error('[Update Group] Error:', error);
        res.status(500).json({ error: error.message });
    }
});
// Leave group
router.post('/groups/:id/leave', auth_middleware_1.authenticate, async (req, res) => {
    try {
        const userId = req.user.id;
        const groupId = parseInt(req.params.id);
        // Check if user is the last admin
        const [admins] = await database_1.default.query('SELECT COUNT(*) as adminCount FROM group_members WHERE group_id = ? AND role = ?', [groupId, 'admin']);
        const [userRole] = await database_1.default.query('SELECT role FROM group_members WHERE group_id = ? AND user_id = ?', [groupId, userId]);
        if (userRole.length > 0 && userRole[0].role === 'admin' && admins[0].adminCount === 1) {
            return res.status(400).json({ error: 'Cannot leave group as the last admin. Please assign another admin first.' });
        }
        // Remove the user
        await database_1.default.query('DELETE FROM group_members WHERE group_id = ? AND user_id = ?', [groupId, userId]);
        res.json({ message: 'Left group successfully' });
    }
    catch (error) {
        console.error('[Leave Group] Error:', error);
        res.status(500).json({ error: error.message });
    }
});
// Get group info
router.get('/groups/:id/info', auth_middleware_1.authenticate, async (req, res) => {
    try {
        const userId = req.user.id;
        const groupId = parseInt(req.params.id);
        // Check if user is a member
        const [membership] = await database_1.default.query('SELECT * FROM group_members WHERE group_id = ? AND user_id = ?', [groupId, userId]);
        if (membership.length === 0) {
            return res.status(403).json({ error: 'Not a member of this group' });
        }
        // Get group info with member count
        const [groupInfo] = await database_1.default.query(`
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
    `, [groupId]);
        if (groupInfo.length === 0) {
            return res.status(404).json({ error: 'Group not found' });
        }
        res.json({ group: groupInfo[0] });
    }
    catch (error) {
        console.error('[Group Info] Error:', error);
        res.status(500).json({ error: error.message });
    }
});
exports.default = router;
