"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const database_1 = __importDefault(require("../config/database"));
const auth_middleware_1 = require("../middleware/auth.middleware");
const router = (0, express_1.Router)();
// Search users by name (for autocomplete)
router.get('/search', auth_middleware_1.authenticate, async (req, res) => {
    try {
        const { q } = req.query;
        if (!q || typeof q !== 'string' || q.length < 2) {
            return res.status(400).json({ message: 'Search query must be at least 2 characters' });
        }
        const searchTerm = `%${q}%`;
        const [users] = await database_1.default.execute(`
      SELECT 
        id, 
        email, 
        first_name as firstName, 
        last_name as lastName,
        CONCAT(first_name, ' ', last_name) as fullName,
        photo
      FROM users 
      WHERE (first_name LIKE ? OR last_name LIKE ? OR CONCAT(first_name, ' ', last_name) LIKE ?)
      AND is_approved = 1
      ORDER BY first_name, last_name
      LIMIT 20
    `, [searchTerm, searchTerm, searchTerm]);
        res.json(users);
    }
    catch (error) {
        console.error('User search error:', error);
        res.status(500).json({ message: 'Failed to search users' });
    }
});
exports.default = router;
