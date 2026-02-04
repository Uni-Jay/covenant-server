"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const database_1 = __importDefault(require("../config/database"));
const auth_middleware_1 = require("../middleware/auth.middleware");
const upload_middleware_1 = require("../middleware/upload.middleware");
const router = (0, express_1.Router)();
router.get('/', async (req, res) => {
    try {
        const [gallery] = await database_1.default.execute('SELECT * FROM gallery ORDER BY upload_date DESC');
        // Convert snake_case to camelCase for frontend
        const formattedGallery = gallery.map((item) => ({
            id: item.id,
            title: item.title,
            description: item.description,
            imageUrl: item.image_url,
            category: item.category,
            uploadDate: item.upload_date
        }));
        res.json(formattedGallery);
    }
    catch (error) {
        res.status(500).json({ message: 'Failed to fetch gallery' });
    }
});
router.get('/category/:category', async (req, res) => {
    try {
        const [gallery] = await database_1.default.execute('SELECT * FROM gallery WHERE category = ? ORDER BY upload_date DESC', [req.params.category]);
        // Convert snake_case to camelCase for frontend
        const formattedGallery = gallery.map((item) => ({
            id: item.id,
            title: item.title,
            description: item.description,
            imageUrl: item.image_url,
            category: item.category,
            uploadDate: item.upload_date
        }));
        res.json(formattedGallery);
    }
    catch (error) {
        res.status(500).json({ message: 'Failed to fetch gallery' });
    }
});
router.post('/', auth_middleware_1.authenticate, auth_middleware_1.isAdmin, upload_middleware_1.upload.single('image'), async (req, res) => {
    try {
        const { title, description, category } = req.body;
        const imageUrl = req.file ? `/uploads/gallery/${req.file.filename}` : null;
        const [result] = await database_1.default.execute('INSERT INTO gallery (title, description, image_url, category) VALUES (?, ?, ?, ?)', [title, description, imageUrl, category]);
        res.status(201).json({ message: 'Image uploaded', id: result.insertId });
    }
    catch (error) {
        res.status(500).json({ message: 'Failed to upload image' });
    }
});
router.delete('/:id', auth_middleware_1.authenticate, auth_middleware_1.isAdmin, async (req, res) => {
    try {
        await database_1.default.execute('DELETE FROM gallery WHERE id = ?', [req.params.id]);
        res.json({ message: 'Image deleted' });
    }
    catch (error) {
        res.status(500).json({ message: 'Failed to delete image' });
    }
});
exports.default = router;
