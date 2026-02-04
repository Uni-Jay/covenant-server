"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const database_1 = __importDefault(require("../config/database"));
const router = (0, express_1.Router)();
router.post('/', async (req, res) => {
    try {
        const { name, email, phone, subject, message } = req.body;
        const [result] = await database_1.default.execute('INSERT INTO contact_messages (name, email, phone, subject, message) VALUES (?, ?, ?, ?, ?)', [name, email, phone, subject, message]);
        res.status(201).json({ message: 'Message sent successfully', id: result.insertId });
    }
    catch (error) {
        res.status(500).json({ message: 'Failed to send message' });
    }
});
exports.default = router;
