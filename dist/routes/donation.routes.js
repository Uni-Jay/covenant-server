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
router.post('/', async (req, res) => {
    try {
        const { name, email, phone, amount, purpose, paymentMethod } = req.body;
        const [result] = await database_1.default.execute('INSERT INTO donations (name, email, phone, amount, purpose, payment_method, status) VALUES (?, ?, ?, ?, ?, ?, ?)', [name, email, phone, amount, purpose, paymentMethod, 'pending']);
        res.status(201).json({ message: 'Donation recorded', id: result.insertId });
    }
    catch (error) {
        res.status(500).json({ message: 'Failed to record donation' });
    }
});
exports.default = router;
