"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const database_1 = __importDefault(require("../config/database"));
const auth_middleware_1 = require("../middleware/auth.middleware");
const permissions_middleware_1 = require("../middleware/permissions.middleware");
const chat_service_1 = require("../services/chat.service");
const router = (0, express_1.Router)();
// Middleware to check if user has Media department
const requireMedia = async (req, res, next) => {
    try {
        const isMedia = await (0, permissions_middleware_1.hasMediaDepartment)(req.user.id);
        if (!isMedia) {
            return res.status(403).json({
                error: 'Forbidden',
                message: 'Only Media department members can assign roles'
            });
        }
        next();
    }
    catch (error) {
        res.status(500).json({ message: 'Failed to verify permissions' });
    }
};
// Get all department executives (with optional department filter)
router.get('/executives', auth_middleware_1.authenticate, async (req, res) => {
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
        const params = [];
        if (department) {
            query += ' AND department = ?';
            params.push(department);
        }
        query += ' ORDER BY department, executive_position';
        const [executives] = await database_1.default.execute(query, params);
        res.json(executives);
    }
    catch (error) {
        console.error('Get executives error:', error);
        res.status(500).json({ message: 'Failed to fetch executives' });
    }
});
// Get all church leaders (pastors, apostles, etc.)
router.get('/leaders', auth_middleware_1.authenticate, async (req, res) => {
    try {
        const [leaders] = await database_1.default.execute(`
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
    `);
        res.json(leaders);
    }
    catch (error) {
        console.error('Get leaders error:', error);
        res.status(500).json({ message: 'Failed to fetch leaders' });
    }
});
// Add department executive
router.post('/executives', auth_middleware_1.authenticate, requireMedia, async (req, res) => {
    try {
        const { userId, department, position } = req.body;
        if (!userId || !department || !position) {
            return res.status(400).json({ message: 'userId, department, and position are required' });
        }
        // Check if user exists
        const [users] = await database_1.default.execute('SELECT id, first_name, last_name, email, photo FROM users WHERE id = ?', [userId]);
        if (users.length === 0) {
            return res.status(404).json({ message: 'User not found' });
        }
        const user = users[0];
        // Check if position is already filled
        const [existing] = await database_1.default.execute('SELECT id FROM users WHERE department = ? AND executive_position = ? AND is_executive = 1', [department, position]);
        if (existing.length > 0) {
            return res.status(400).json({ message: 'This position is already filled' });
        }
        // Update user to be executive with this position
        await database_1.default.execute(`UPDATE users 
       SET is_executive = 1, 
           department = ?, 
           executive_position = ?
       WHERE id = ?`, [department, position, userId]);
        // Also add department to departments JSON array if not exists
        const [currentUser] = await database_1.default.execute('SELECT departments FROM users WHERE id = ?', [userId]);
        const currentDepts = currentUser[0].departments ? JSON.parse(currentUser[0].departments) : [];
        if (!currentDepts.includes(department)) {
            currentDepts.push(department);
            await database_1.default.execute('UPDATE users SET departments = ? WHERE id = ?', [JSON.stringify(currentDepts), userId]);
            // Sync department group chats (async, don't wait)
            (0, chat_service_1.syncUserDepartmentGroups)(userId, currentDepts).catch(err => console.error('Failed to sync department groups:', err));
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
    }
    catch (error) {
        console.error('Add executive error:', error);
        res.status(500).json({ message: 'Failed to add executive' });
    }
});
// Add church leader
router.post('/leaders', auth_middleware_1.authenticate, requireMedia, async (req, res) => {
    try {
        const { email, title, role } = req.body;
        if (!email || !title) {
            return res.status(400).json({ message: 'Email and title are required' });
        }
        // Check if user exists
        const [users] = await database_1.default.execute('SELECT id, first_name, last_name FROM users WHERE email = ?', [email]);
        if (users.length === 0) {
            return res.status(404).json({ message: 'User not found with this email' });
        }
        // Update user with leadership title
        const updateRole = role || 'pastor';
        await database_1.default.execute(`UPDATE users 
       SET executive_position = ?, 
           role = ?,
           is_executive = 1
       WHERE email = ?`, [title, updateRole, email]);
        // Add to ministers group if applicable
        const isMinister = title.toLowerCase().includes('pastor') ||
            title.toLowerCase().includes('apostle') ||
            title.toLowerCase().includes('prophet') ||
            title.toLowerCase().includes('evangelist') ||
            updateRole === 'pastor' ||
            updateRole === 'elder';
        if (isMinister) {
            try {
                // Get ministers group
                const [groups] = await database_1.default.execute("SELECT id FROM chat_groups WHERE type = 'ministers'");
                if (groups.length > 0) {
                    const groupId = groups[0].id;
                    // Add user to ministers group
                    await database_1.default.execute(`INSERT IGNORE INTO group_members (group_id, user_id, role)
             VALUES (?, ?, 'member')`, [groupId, users[0].id]);
                }
            }
            catch (groupError) {
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
    }
    catch (error) {
        console.error('Add leader error:', error);
        res.status(500).json({ message: 'Failed to add leader' });
    }
});
// Remove executive
router.delete('/executives/:id', auth_middleware_1.authenticate, requireMedia, async (req, res) => {
    try {
        const { id } = req.params;
        await database_1.default.execute(`UPDATE users 
       SET is_executive = 0, 
           executive_position = NULL
       WHERE id = ?`, [id]);
        res.json({ message: 'Executive removed successfully' });
    }
    catch (error) {
        console.error('Remove executive error:', error);
        res.status(500).json({ message: 'Failed to remove executive' });
    }
});
// Remove leader
router.delete('/leaders/:id', auth_middleware_1.authenticate, requireMedia, async (req, res) => {
    try {
        const { id } = req.params;
        await database_1.default.execute(`UPDATE users 
       SET is_executive = 0, 
           executive_position = NULL
       WHERE id = ?`, [id]);
        res.json({ message: 'Leader removed successfully' });
    }
    catch (error) {
        console.error('Remove leader error:', error);
        res.status(500).json({ message: 'Failed to remove leader' });
    }
});
exports.default = router;
