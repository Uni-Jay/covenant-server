"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const database_1 = __importDefault(require("../config/database"));
const auth_middleware_1 = require("../middleware/auth.middleware");
const router = (0, express_1.Router)();
router.get('/', async (req, res) => {
    try {
        const [posts] = await database_1.default.execute('SELECT * FROM blog_posts ORDER BY date DESC');
        // Convert snake_case to camelCase for frontend
        const formattedPosts = posts.map((post) => ({
            id: post.id,
            title: post.title,
            content: post.content,
            excerpt: post.excerpt,
            author: post.author,
            date: post.date,
            imageUrl: post.image_url,
            category: post.category,
            createdAt: post.created_at
        }));
        res.json(formattedPosts);
    }
    catch (error) {
        res.status(500).json({ message: 'Failed to fetch blog posts' });
    }
});
router.post('/', auth_middleware_1.authenticate, auth_middleware_1.isAdmin, async (req, res) => {
    try {
        const { title, content, excerpt, author, date, imageUrl, category } = req.body;
        const [result] = await database_1.default.execute('INSERT INTO blog_posts (title, content, excerpt, author, date, image_url, category) VALUES (?, ?, ?, ?, ?, ?, ?)', [title, content, excerpt, author, date, imageUrl, category]);
        res.status(201).json({ message: 'Blog post created', id: result.insertId });
    }
    catch (error) {
        res.status(500).json({ message: 'Failed to create blog post' });
    }
});
router.delete('/:id', auth_middleware_1.authenticate, auth_middleware_1.isAdmin, async (req, res) => {
    try {
        await database_1.default.execute('DELETE FROM blog_posts WHERE id = ?', [req.params.id]);
        res.json({ message: 'Blog post deleted' });
    }
    catch (error) {
        res.status(500).json({ message: 'Failed to delete blog post' });
    }
});
exports.default = router;
