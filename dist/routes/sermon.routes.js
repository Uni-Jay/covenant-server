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
// Get all sermons
router.get('/', async (req, res) => {
    try {
        const [sermons] = await database_1.default.execute('SELECT * FROM sermons ORDER BY date DESC');
        // Convert snake_case to camelCase for frontend
        const formattedSermons = sermons.map((sermon) => ({
            id: sermon.id,
            title: sermon.title,
            description: sermon.description,
            preacher: sermon.preacher,
            date: sermon.date,
            videoUrl: sermon.video_url,
            audioUrl: sermon.audio_url,
            pdfUrl: sermon.pdf_url,
            thumbnailUrl: sermon.thumbnail_url,
            views: sermon.views,
            category: sermon.category,
            createdAt: sermon.created_at
        }));
        res.json(formattedSermons);
    }
    catch (error) {
        res.status(500).json({ message: 'Failed to fetch sermons' });
    }
});
// Get sermon by ID
router.get('/:id', async (req, res) => {
    try {
        const [sermons] = await database_1.default.execute('SELECT * FROM sermons WHERE id = ?', [req.params.id]);
        if (sermons.length === 0) {
            return res.status(404).json({ message: 'Sermon not found' });
        }
        // Increment views
        await database_1.default.execute('UPDATE sermons SET views = views + 1 WHERE id = ?', [req.params.id]);
        res.json(sermons[0]);
    }
    catch (error) {
        res.status(500).json({ message: 'Failed to fetch sermon' });
    }
});
// Create sermon (admin only)
router.post('/', auth_middleware_1.authenticate, auth_middleware_1.isAdmin, upload_middleware_1.upload.fields([
    { name: 'video', maxCount: 1 },
    { name: 'audio', maxCount: 1 },
    { name: 'pdf', maxCount: 1 },
    { name: 'thumbnail', maxCount: 1 }
]), async (req, res) => {
    try {
        const { title, description, preacher, date, category } = req.body;
        const files = req.files;
        const videoUrl = files?.video ? `/uploads/sermons/${files.video[0].filename}` : null;
        const audioUrl = files?.audio ? `/uploads/sermons/${files.audio[0].filename}` : null;
        const pdfUrl = files?.pdf ? `/uploads/sermons/${files.pdf[0].filename}` : null;
        const thumbnailUrl = files?.thumbnail ? `/uploads/sermons/${files.thumbnail[0].filename}` : null;
        const [result] = await database_1.default.execute('INSERT INTO sermons (title, description, preacher, date, video_url, audio_url, pdf_url, thumbnail_url, category) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)', [title, description, preacher, date, videoUrl, audioUrl, pdfUrl, thumbnailUrl, category]);
        res.status(201).json({ message: 'Sermon created', id: result.insertId });
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Failed to create sermon' });
    }
});
// Update sermon
router.put('/:id', auth_middleware_1.authenticate, auth_middleware_1.isAdmin, async (req, res) => {
    try {
        const { title, description, preacher, date, category } = req.body;
        await database_1.default.execute('UPDATE sermons SET title = ?, description = ?, preacher = ?, date = ?, category = ? WHERE id = ?', [title, description, preacher, date, category, req.params.id]);
        res.json({ message: 'Sermon updated' });
    }
    catch (error) {
        res.status(500).json({ message: 'Failed to update sermon' });
    }
});
// Delete sermon
router.delete('/:id', auth_middleware_1.authenticate, auth_middleware_1.isAdmin, async (req, res) => {
    try {
        await database_1.default.execute('DELETE FROM sermons WHERE id = ?', [req.params.id]);
        res.json({ message: 'Sermon deleted' });
    }
    catch (error) {
        res.status(500).json({ message: 'Failed to delete sermon' });
    }
});
exports.default = router;
