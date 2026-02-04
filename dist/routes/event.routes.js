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
        const [events] = await database_1.default.execute('SELECT * FROM events ORDER BY date DESC');
        // Convert snake_case to camelCase for frontend
        const formattedEvents = events.map((event) => ({
            id: event.id,
            title: event.title,
            description: event.description,
            date: event.date,
            time: event.time,
            location: event.location,
            imageUrl: event.image_url,
            category: event.category,
            createdAt: event.created_at,
            updatedAt: event.updated_at
        }));
        res.json(formattedEvents);
    }
    catch (error) {
        res.status(500).json({ message: 'Failed to fetch events' });
    }
});
router.post('/', auth_middleware_1.authenticate, auth_middleware_1.isAdmin, upload_middleware_1.upload.single('image'), async (req, res) => {
    try {
        const { title, description, date, time, location, category } = req.body;
        const imageUrl = req.file ? `/uploads/events/${req.file.filename}` : null;
        const [result] = await database_1.default.execute('INSERT INTO events (title, description, date, time, location, image_url, category) VALUES (?, ?, ?, ?, ?, ?, ?)', [title, description, date, time, location, imageUrl, category]);
        res.status(201).json({ message: 'Event created', id: result.insertId });
    }
    catch (error) {
        res.status(500).json({ message: 'Failed to create event' });
    }
});
router.put('/:id', auth_middleware_1.authenticate, auth_middleware_1.isAdmin, upload_middleware_1.upload.single('image'), async (req, res) => {
    try {
        const { title, description, date, time, location, category } = req.body;
        let imageUrl = null;
        if (req.file) {
            imageUrl = `/uploads/events/${req.file.filename}`;
        }
        if (imageUrl) {
            await database_1.default.execute('UPDATE events SET title = ?, description = ?, date = ?, time = ?, location = ?, image_url = ?, category = ? WHERE id = ?', [title, description, date, time, location, imageUrl, category, req.params.id]);
        }
        else {
            await database_1.default.execute('UPDATE events SET title = ?, description = ?, date = ?, time = ?, location = ?, category = ? WHERE id = ?', [title, description, date, time, location, category, req.params.id]);
        }
        res.json({ message: 'Event updated' });
    }
    catch (error) {
        res.status(500).json({ message: 'Failed to update event' });
    }
});
router.delete('/:id', auth_middleware_1.authenticate, auth_middleware_1.isAdmin, async (req, res) => {
    try {
        await database_1.default.execute('DELETE FROM events WHERE id = ?', [req.params.id]);
        res.json({ message: 'Event deleted' });
    }
    catch (error) {
        res.status(500).json({ message: 'Failed to delete event' });
    }
});
exports.default = router;
