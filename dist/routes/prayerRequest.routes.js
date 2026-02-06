"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const database_1 = __importDefault(require("../config/database"));
const auth_middleware_1 = require("../middleware/auth.middleware");
const router = (0, express_1.Router)();
// Get all prayer requests (admin/media only)
router.get('/all', auth_middleware_1.authenticate, async (req, res) => {
    try {
        const user = req.user;
        // Check if user is admin or media
        const isAdminOrMedia = user.role && ['super_admin', 'admin', 'media_head', 'media'].includes(user.role);
        if (!isAdminOrMedia) {
            // Check if user belongs to media or prayer team department
            let userDepartments = [];
            if (user.departments) {
                if (Array.isArray(user.departments)) {
                    userDepartments = user.departments;
                }
                else if (typeof user.departments === 'string') {
                    try {
                        userDepartments = JSON.parse(user.departments);
                    }
                    catch {
                        userDepartments = user.departments.split(',').map((d) => d.trim()).filter((d) => d);
                    }
                }
            }
            const hasAccess = userDepartments.some(dept => dept.toLowerCase().includes('media') || dept.toLowerCase().includes('prayer'));
            if (!hasAccess) {
                return res.status(403).json({ message: 'Access denied' });
            }
        }
        const [requests] = await database_1.default.execute('SELECT * FROM prayer_requests ORDER BY created_at DESC');
        res.json({ requests });
    }
    catch (error) {
        console.error('Fetch all prayer requests error:', error);
        res.status(500).json({ message: 'Failed to fetch prayer requests' });
    }
});
// Get user's own prayer requests
router.get('/my-prayers', auth_middleware_1.authenticate, async (req, res) => {
    try {
        const user = req.user;
        const [requests] = await database_1.default.execute('SELECT * FROM prayer_requests WHERE email = ? ORDER BY created_at DESC', [user.email]);
        res.json({ requests });
    }
    catch (error) {
        console.error('Fetch my prayers error:', error);
        res.status(500).json({ message: 'Failed to fetch your prayer requests' });
    }
});
router.post('/', async (req, res) => {
    try {
        const { name, email, phoneNumber, phone, requestText, request, category, isAnonymous, isUrgent } = req.body;
        // Support both field name formats
        const finalPhone = phoneNumber || phone;
        const finalRequest = requestText || request;
        const [result] = await database_1.default.execute('INSERT INTO prayer_requests (name, email, phone, request, category, is_anonymous) VALUES (?, ?, ?, ?, ?, ?)', [isAnonymous ? null : name, isAnonymous ? null : email, isAnonymous ? null : finalPhone, finalRequest, category, isAnonymous || false]);
        res.status(201).json({ message: 'Prayer request submitted', id: result.insertId });
    }
    catch (error) {
        console.error('Prayer request submission error:', error);
        res.status(500).json({ message: 'Failed to submit prayer request', error: error instanceof Error ? error.message : 'Unknown error' });
    }
});
router.patch('/:id', auth_middleware_1.authenticate, async (req, res) => {
    try {
        const user = req.user;
        const { status } = req.body;
        // Check if user is admin or media
        const isAdminOrMedia = user.role && ['super_admin', 'admin', 'media_head', 'media'].includes(user.role);
        if (!isAdminOrMedia) {
            // Check if user belongs to media or prayer team department
            let userDepartments = [];
            if (user.departments) {
                if (Array.isArray(user.departments)) {
                    userDepartments = user.departments;
                }
                else if (typeof user.departments === 'string') {
                    try {
                        userDepartments = JSON.parse(user.departments);
                    }
                    catch {
                        userDepartments = user.departments.split(',').map((d) => d.trim()).filter((d) => d);
                    }
                }
            }
            const hasAccess = userDepartments.some(dept => dept.toLowerCase().includes('media') || dept.toLowerCase().includes('prayer'));
            if (!hasAccess) {
                return res.status(403).json({ message: 'Access denied' });
            }
        }
        await database_1.default.execute('UPDATE prayer_requests SET status = ?, updated_at = NOW() WHERE id = ?', [status, req.params.id]);
        res.json({ message: 'Status updated successfully' });
    }
    catch (error) {
        console.error('Update status error:', error);
        res.status(500).json({ message: 'Failed to update status' });
    }
});
router.delete('/:id', auth_middleware_1.authenticate, auth_middleware_1.isAdmin, async (req, res) => {
    try {
        await database_1.default.execute('DELETE FROM prayer_requests WHERE id = ?', [req.params.id]);
        res.json({ message: 'Prayer request deleted' });
    }
    catch (error) {
        res.status(500).json({ message: 'Failed to delete prayer request' });
    }
});
exports.default = router;
