"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const database_1 = __importDefault(require("../config/database"));
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const auth_middleware_1 = require("../middleware/auth.middleware");
const permissions_middleware_1 = require("../middleware/permissions.middleware");
const router = express_1.default.Router();
// Get all church emails (media_head and super_admin only)
router.get('/', auth_middleware_1.authenticate, (0, permissions_middleware_1.requirePermission)('church_email:view'), async (req, res) => {
    try {
        const [emails] = await database_1.default.execute(`
      SELECT 
        ce.id, ce.email, ce.department, ce.position, ce.is_active,
        ce.created_at, ce.last_password_reset,
        u.first_name, u.last_name, u.id as user_id,
        creator.first_name as created_by_first_name,
        creator.last_name as created_by_last_name
      FROM church_emails ce
      JOIN users u ON ce.user_id = u.id
      JOIN users creator ON ce.created_by = creator.id
      ORDER BY ce.created_at DESC
    `);
        res.json({ emails });
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
// Get church email by user ID
router.get('/user/:userId', auth_middleware_1.authenticate, async (req, res) => {
    try {
        const { userId } = req.params;
        // Users can view their own church email, or admins can view any
        if (req.user.id !== parseInt(userId) && !['super_admin', 'media_head', 'pastor'].includes(req.user.role)) {
            return res.status(403).json({ error: 'Unauthorized' });
        }
        const [emails] = await database_1.default.execute(`
      SELECT id, email, department, position, is_active, created_at
      FROM church_emails
      WHERE user_id = ?
    `, [userId]);
        if (emails.length === 0) {
            return res.status(404).json({ error: 'No church email found for this user' });
        }
        res.json({ email: emails[0] });
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
// Create church email for executive (media_head only)
router.post('/', auth_middleware_1.authenticate, (0, permissions_middleware_1.requirePermission)('church_email:create'), async (req, res) => {
    try {
        const { userId, emailPrefix, department, position, password } = req.body;
        if (!userId || !emailPrefix || !position || !password) {
            return res.status(400).json({ error: 'User ID, email prefix, position, and password are required' });
        }
        // Verify user exists and is executive
        const [users] = await database_1.default.execute('SELECT id, role, first_name, last_name FROM users WHERE id = ?', [userId]);
        if (users.length === 0) {
            return res.status(404).json({ error: 'User not found' });
        }
        const user = users[0];
        if (!(0, permissions_middleware_1.isExecutive)(user.role)) {
            return res.status(400).json({ error: 'User must be an executive to get a church email' });
        }
        // Check if user already has a church email
        const [existing] = await database_1.default.execute('SELECT id FROM church_emails WHERE user_id = ?', [userId]);
        if (existing.length > 0) {
            return res.status(400).json({ error: 'User already has a church email' });
        }
        // Create email with format: prefix@wordofcovenant.org
        const churchEmail = `${emailPrefix.toLowerCase().replace(/\s+/g, '')}@wordofcovenant.org`;
        // Check if email already exists
        const [emailExists] = await database_1.default.execute('SELECT id FROM church_emails WHERE email = ?', [churchEmail]);
        if (emailExists.length > 0) {
            return res.status(400).json({ error: 'This church email already exists' });
        }
        // Hash password
        const hashedPassword = await bcryptjs_1.default.hash(password, 10);
        // Create church email
        const [result] = await database_1.default.execute(`INSERT INTO church_emails (user_id, email, password_hash, department, position, created_by)
       VALUES (?, ?, ?, ?, ?, ?)`, [userId, churchEmail, hashedPassword, department || null, position, req.user.id]);
        // Update user record
        await database_1.default.execute('UPDATE users SET church_email = ?, is_executive = TRUE, executive_position = ? WHERE id = ?', [churchEmail, position, userId]);
        res.status(201).json({
            message: 'Church email created successfully',
            email: {
                id: result.insertId,
                email: churchEmail,
                department,
                position,
                userName: `${user.first_name} ${user.last_name}`
            }
        });
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
// Reset church email password (media_head only)
router.put('/:id/reset-password', auth_middleware_1.authenticate, (0, permissions_middleware_1.requirePermission)('church_email:reset'), async (req, res) => {
    try {
        const { id } = req.params;
        const { newPassword } = req.body;
        if (!newPassword) {
            return res.status(400).json({ error: 'New password is required' });
        }
        // Verify email exists
        const [emails] = await database_1.default.execute('SELECT id, user_id, email FROM church_emails WHERE id = ?', [id]);
        if (emails.length === 0) {
            return res.status(404).json({ error: 'Church email not found' });
        }
        // Hash new password
        const hashedPassword = await bcryptjs_1.default.hash(newPassword, 10);
        // Update password
        await database_1.default.execute('UPDATE church_emails SET password_hash = ?, last_password_reset = NOW() WHERE id = ?', [hashedPassword, id]);
        // Log audit
        await database_1.default.execute(`INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details)
       VALUES (?, 'RESET_CHURCH_EMAIL_PASSWORD', 'church_email', ?, ?)`, [req.user.id, id, JSON.stringify({ email: emails[0].email })]);
        res.json({ message: 'Password reset successfully' });
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
// Deactivate church email (media_head only)
router.put('/:id/deactivate', auth_middleware_1.authenticate, (0, permissions_middleware_1.requirePermission)('church_email:delete'), async (req, res) => {
    try {
        const { id } = req.params;
        const [emails] = await database_1.default.execute('SELECT id, user_id, email FROM church_emails WHERE id = ?', [id]);
        if (emails.length === 0) {
            return res.status(404).json({ error: 'Church email not found' });
        }
        await database_1.default.execute('UPDATE church_emails SET is_active = FALSE WHERE id = ?', [id]);
        // Log audit
        await database_1.default.execute(`INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details)
       VALUES (?, 'DEACTIVATE_CHURCH_EMAIL', 'church_email', ?, ?)`, [req.user.id, id, JSON.stringify({ email: emails[0].email })]);
        res.json({ message: 'Church email deactivated successfully' });
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
// Delete church email (super_admin only)
router.delete('/:id', auth_middleware_1.authenticate, (0, permissions_middleware_1.requirePermission)('church_email:delete'), async (req, res) => {
    try {
        const { id } = req.params;
        // Only super_admin can permanently delete
        if (req.user.role !== 'super_admin') {
            return res.status(403).json({ error: 'Only super admin can permanently delete church emails' });
        }
        const [emails] = await database_1.default.execute('SELECT id, user_id, email FROM church_emails WHERE id = ?', [id]);
        if (emails.length === 0) {
            return res.status(404).json({ error: 'Church email not found' });
        }
        // Update user record
        await database_1.default.execute('UPDATE users SET church_email = NULL WHERE id = ?', [emails[0].user_id]);
        // Delete email
        await database_1.default.execute('DELETE FROM church_emails WHERE id = ?', [id]);
        // Log audit
        await database_1.default.execute(`INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details)
       VALUES (?, 'DELETE_CHURCH_EMAIL', 'church_email', ?, ?)`, [req.user.id, id, JSON.stringify({ email: emails[0].email })]);
        res.json({ message: 'Church email deleted successfully' });
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
// Get available email suggestions based on position
router.get('/suggestions/:position', auth_middleware_1.authenticate, (0, permissions_middleware_1.requirePermission)('church_email:create'), async (req, res) => {
    try {
        const { position } = req.params;
        const suggestions = [
            `${position.toLowerCase().replace(/\s+/g, '')}@wordofcovenant.org`,
            `${position.toLowerCase().replace(/\s+/g, '')}.woc@wordofcovenant.org`,
            `${position.toLowerCase().replace(/\s+/g, '')}.covenant@wordofcovenant.org`
        ];
        res.json({ suggestions });
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
exports.default = router;
