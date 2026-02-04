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
        const [requests] = await database_1.default.execute('SELECT * FROM prayer_requests ORDER BY created_at DESC');
        res.json(requests);
    }
    catch (error) {
        res.status(500).json({ message: 'Failed to fetch prayer requests' });
    }
});
router.post('/', async (req, res) => {
    try {
        const { name, email, phone, request, category, isAnonymous } = req.body;
        const [result] = await database_1.default.execute('INSERT INTO prayer_requests (name, email, phone, request, category, is_anonymous) VALUES (?, ?, ?, ?, ?, ?)', [isAnonymous ? null : name, isAnonymous ? null : email, isAnonymous ? null : phone, request, category, isAnonymous]);
        res.status(201).json({ message: 'Prayer request submitted', id: result.insertId });
    }
    catch (error) {
        res.status(500).json({ message: 'Failed to submit prayer request' });
    }
});
router.patch('/:id', auth_middleware_1.authenticate, auth_middleware_1.isAdmin, async (req, res) => {
    try {
        const { status } = req.body;
        await database_1.default.execute('UPDATE prayer_requests SET status = ? WHERE id = ?', [status, req.params.id]);
        res.json({ message: 'Status updated' });
    }
    catch (error) {
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
