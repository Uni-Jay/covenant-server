"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const database_1 = __importDefault(require("../config/database"));
const auth_middleware_1 = require("../middleware/auth.middleware");
const router = (0, express_1.Router)();
router.get('/', auth_middleware_1.authenticate, auth_middleware_1.isAdmin, async (req, res) => {
    try {
        const [donations] = await database_1.default.execute('SELECT * FROM donations ORDER BY created_at DESC');
        res.json(donations);
    }
    catch (error) {
        res.status(500).json({ message: 'Failed to fetch donations' });
    }
});
// Get user's own donation history
router.get('/history', auth_middleware_1.authenticate, async (req, res) => {
    try {
        const userEmail = req.user.email;
        const [donations] = await database_1.default.execute(`SELECT 
        id,
        name,
        email,
        amount,
        purpose,
        payment_method as paymentMethod,
        status,
        created_at as date,
        CONCAT('REF', LPAD(id, 6, '0')) as reference
      FROM donations 
      WHERE email = ? 
      ORDER BY created_at DESC`, [userEmail]);
        res.json({ donations });
    }
    catch (error) {
        console.error('Failed to fetch donation history:', error);
        res.status(500).json({ message: 'Failed to fetch donation history' });
    }
});
// Get all donations (admin/media only)
router.get('/all', auth_middleware_1.authenticate, async (req, res) => {
    try {
        // Check if user is admin or media department
        const userId = req.user.id;
        const [users] = await database_1.default.execute('SELECT role, departments FROM users WHERE id = ?', [userId]);
        if (users.length === 0) {
            return res.status(403).json({ message: 'Access denied' });
        }
        const user = users[0];
        const isAdmin = user.role === 'admin';
        let isMedia = false;
        if (user.departments) {
            try {
                const departments = typeof user.departments === 'string'
                    ? JSON.parse(user.departments)
                    : user.departments;
                isMedia = departments.some((dept) => dept.toLowerCase().includes('media'));
            }
            catch (e) {
                isMedia = false;
            }
        }
        if (!isAdmin && !isMedia) {
            return res.status(403).json({ message: 'Access denied. Admin or Media department only.' });
        }
        const [donations] = await database_1.default.execute('SELECT * FROM donations ORDER BY created_at DESC');
        res.json({ donations });
    }
    catch (error) {
        console.error('Failed to fetch donations:', error);
        res.status(500).json({ message: 'Failed to fetch donations' });
    }
});
// Approve donation
router.put('/:id/approve', auth_middleware_1.authenticate, async (req, res) => {
    try {
        const donationId = req.params.id;
        const userId = req.user.id;
        await database_1.default.execute('UPDATE donations SET status = ?, approved_by = ?, approved_at = NOW() WHERE id = ?', ['completed', userId, donationId]);
        res.json({ message: 'Donation approved successfully' });
    }
    catch (error) {
        console.error('Failed to approve donation:', error);
        res.status(500).json({ message: 'Failed to approve donation' });
    }
});
// Reject donation
router.put('/:id/reject', auth_middleware_1.authenticate, async (req, res) => {
    try {
        const donationId = req.params.id;
        const userId = req.user.id;
        await database_1.default.execute('UPDATE donations SET status = ?, approved_by = ?, approved_at = NOW() WHERE id = ?', ['rejected', userId, donationId]);
        res.json({ message: 'Donation rejected' });
    }
    catch (error) {
        console.error('Failed to reject donation:', error);
        res.status(500).json({ message: 'Failed to reject donation' });
    }
});
// Get donation statistics
router.get('/stats', auth_middleware_1.authenticate, async (req, res) => {
    try {
        const year = req.query.year || new Date().getFullYear();
        // Total stats
        const [totals] = await database_1.default.execute(`SELECT 
        COUNT(*) as totalCount,
        COALESCE(SUM(amount), 0) as totalAmount
      FROM donations
      WHERE YEAR(created_at) = ?`, [year]);
        // By status
        const [byStatus] = await database_1.default.execute(`SELECT 
        status,
        COUNT(*) as count,
        COALESCE(SUM(amount), 0) as amount
      FROM donations
      WHERE YEAR(created_at) = ?
      GROUP BY status`, [year]);
        // By purpose
        const [byPurpose] = await database_1.default.execute(`SELECT 
        purpose,
        COUNT(*) as count,
        COALESCE(SUM(amount), 0) as amount
      FROM donations
      WHERE YEAR(created_at) = ? AND status = 'completed'
      GROUP BY purpose`, [year]);
        // By month
        const [byMonth] = await database_1.default.execute(`SELECT 
        DATE_FORMAT(created_at, '%Y-%m') as month,
        COUNT(*) as count,
        COALESCE(SUM(amount), 0) as amount
      FROM donations
      WHERE YEAR(created_at) = ? AND status = 'completed'
      GROUP BY month
      ORDER BY month`, [year]);
        const stats = {
            totalAmount: totals[0].totalAmount,
            totalCount: totals[0].totalCount,
            pendingAmount: 0,
            pendingCount: 0,
            completedAmount: 0,
            completedCount: 0,
            rejectedAmount: 0,
            rejectedCount: 0,
            byPurpose: {},
            byMonth: {},
        };
        // Process status data
        byStatus.forEach((row) => {
            if (row.status === 'pending') {
                stats.pendingAmount = row.amount;
                stats.pendingCount = row.count;
            }
            else if (row.status === 'completed') {
                stats.completedAmount = row.amount;
                stats.completedCount = row.count;
            }
            else if (row.status === 'rejected') {
                stats.rejectedAmount = row.amount;
                stats.rejectedCount = row.count;
            }
        });
        // Process purpose data
        byPurpose.forEach((row) => {
            stats.byPurpose[row.purpose] = {
                amount: row.amount,
                count: row.count,
            };
        });
        // Process month data
        byMonth.forEach((row) => {
            const monthName = new Date(row.month + '-01').toLocaleDateString('en-US', {
                month: 'long',
                year: 'numeric'
            });
            stats.byMonth[monthName] = {
                amount: row.amount,
                count: row.count,
            };
        });
        res.json(stats);
    }
    catch (error) {
        console.error('Failed to fetch stats:', error);
        res.status(500).json({ message: 'Failed to fetch statistics' });
    }
});
router.post('/', async (req, res) => {
    try {
        const { name, email, phone, amount, purpose, paymentMethod, donorName, donorEmail, isAnonymous } = req.body;
        // Handle both field name formats (name/donorName, email/donorEmail)
        const finalName = isAnonymous ? 'Anonymous' : (name || donorName);
        const finalEmail = email || donorEmail;
        // Validate required fields
        if (!finalName || !finalEmail || !amount || !purpose) {
            console.error('Missing required fields:', { finalName, finalEmail, amount, purpose });
            return res.status(400).json({
                message: 'Missing required fields: name, email, amount, and purpose are required'
            });
        }
        const [result] = await database_1.default.execute('INSERT INTO donations (name, email, phone, amount, purpose, payment_method, status) VALUES (?, ?, ?, ?, ?, ?, ?)', [finalName, finalEmail, phone || null, amount, purpose, paymentMethod || 'Bank Transfer', 'pending']);
        console.log('Donation recorded successfully:', { id: result.insertId, name: finalName, amount });
        res.status(201).json({ message: 'Donation recorded', id: result.insertId });
    }
    catch (error) {
        console.error('Failed to record donation:', error);
        res.status(500).json({ message: 'Failed to record donation', error: error?.message || 'Unknown error' });
    }
});
exports.default = router;
