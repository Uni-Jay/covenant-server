"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const database_1 = __importDefault(require("../config/database"));
const auth_middleware_1 = require("../middleware/auth.middleware");
const router = express_1.default.Router();
// Get all Bible translations
router.get('/translations', async (req, res) => {
    try {
        const [translations] = await database_1.default.execute(`
      SELECT * FROM bible_translations 
      WHERE is_active = TRUE 
      ORDER BY name
    `);
        res.json({ translations });
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
// Get Bible books structure (commonly used books)
router.get('/books', async (req, res) => {
    try {
        const books = [
            // Old Testament
            { name: 'Genesis', testament: 'Old', chapters: 50 },
            { name: 'Exodus', testament: 'Old', chapters: 40 },
            { name: 'Leviticus', testament: 'Old', chapters: 27 },
            { name: 'Numbers', testament: 'Old', chapters: 36 },
            { name: 'Deuteronomy', testament: 'Old', chapters: 34 },
            { name: 'Joshua', testament: 'Old', chapters: 24 },
            { name: 'Judges', testament: 'Old', chapters: 21 },
            { name: 'Ruth', testament: 'Old', chapters: 4 },
            { name: '1 Samuel', testament: 'Old', chapters: 31 },
            { name: '2 Samuel', testament: 'Old', chapters: 24 },
            { name: '1 Kings', testament: 'Old', chapters: 22 },
            { name: '2 Kings', testament: 'Old', chapters: 25 },
            { name: 'Psalms', testament: 'Old', chapters: 150 },
            { name: 'Proverbs', testament: 'Old', chapters: 31 },
            { name: 'Isaiah', testament: 'Old', chapters: 66 },
            { name: 'Jeremiah', testament: 'Old', chapters: 52 },
            { name: 'Daniel', testament: 'Old', chapters: 12 },
            // New Testament
            { name: 'Matthew', testament: 'New', chapters: 28 },
            { name: 'Mark', testament: 'New', chapters: 16 },
            { name: 'Luke', testament: 'New', chapters: 24 },
            { name: 'John', testament: 'New', chapters: 21 },
            { name: 'Acts', testament: 'New', chapters: 28 },
            { name: 'Romans', testament: 'New', chapters: 16 },
            { name: '1 Corinthians', testament: 'New', chapters: 16 },
            { name: '2 Corinthians', testament: 'New', chapters: 13 },
            { name: 'Galatians', testament: 'New', chapters: 6 },
            { name: 'Ephesians', testament: 'New', chapters: 6 },
            { name: 'Philippians', testament: 'New', chapters: 4 },
            { name: 'Colossians', testament: 'New', chapters: 4 },
            { name: '1 Thessalonians', testament: 'New', chapters: 5 },
            { name: '2 Thessalonians', testament: 'New', chapters: 3 },
            { name: '1 Timothy', testament: 'New', chapters: 6 },
            { name: '2 Timothy', testament: 'New', chapters: 4 },
            { name: 'Titus', testament: 'New', chapters: 3 },
            { name: 'Hebrews', testament: 'New', chapters: 13 },
            { name: 'James', testament: 'New', chapters: 5 },
            { name: '1 Peter', testament: 'New', chapters: 5 },
            { name: '2 Peter', testament: 'New', chapters: 3 },
            { name: '1 John', testament: 'New', chapters: 5 },
            { name: '2 John', testament: 'New', chapters: 1 },
            { name: '3 John', testament: 'New', chapters: 1 },
            { name: 'Jude', testament: 'New', chapters: 1 },
            { name: 'Revelation', testament: 'New', chapters: 22 },
        ];
        res.json({ books });
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
// Search Bible verses
router.get('/search', async (req, res) => {
    try {
        const { query, translation = 'KJV' } = req.query;
        if (!query) {
            return res.status(400).json({ error: 'Search query is required' });
        }
        // Get translation ID
        const [translations] = await database_1.default.execute('SELECT id FROM bible_translations WHERE abbreviation = ?', [translation]);
        if (translations.length === 0) {
            return res.status(404).json({ error: 'Translation not found' });
        }
        const translationId = translations[0].id;
        // Search verses (if verses exist in DB)
        const [verses] = await database_1.default.execute(`
      SELECT * FROM bible_verses 
      WHERE translation_id = ? AND text LIKE ?
      LIMIT 50
    `, [translationId, `%${query}%`]);
        res.json({
            verses,
            message: verses.length === 0 ? 'Note: Bible verses database is empty. Consider using external Bible API for full functionality.' : undefined
        });
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
// Get user's Bible notes and highlights
router.get('/notes', auth_middleware_1.authenticate, async (req, res) => {
    try {
        const userId = req.user.id;
        const [notes] = await database_1.default.execute(`
      SELECT 
        bn.*,
        bt.name as translation_name,
        bt.abbreviation as translation_abbr
      FROM bible_notes bn
      JOIN bible_translations bt ON bn.translation_id = bt.id
      WHERE bn.user_id = ?
      ORDER BY bn.updated_at DESC
    `, [userId]);
        res.json({ notes });
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
// Create or update Bible note
router.post('/notes', auth_middleware_1.authenticate, async (req, res) => {
    try {
        const { translationId, book, chapter, verse, note, highlightColor } = req.body;
        const userId = req.user.id;
        if (!translationId || !book || !chapter || !verse) {
            return res.status(400).json({ error: 'Translation, book, chapter, and verse are required' });
        }
        // Check if note exists
        const [existing] = await database_1.default.execute(`SELECT id FROM bible_notes 
       WHERE user_id = ? AND translation_id = ? AND book = ? AND chapter = ? AND verse = ?`, [userId, translationId, book, chapter, verse]);
        if (existing.length > 0) {
            // Update existing note
            await database_1.default.execute(`UPDATE bible_notes 
         SET note = ?, highlight_color = ?
         WHERE id = ?`, [note || null, highlightColor || null, existing[0].id]);
            res.json({ message: 'Note updated successfully', noteId: existing[0].id });
        }
        else {
            // Create new note
            const [result] = await database_1.default.execute(`INSERT INTO bible_notes (user_id, translation_id, book, chapter, verse, note, highlight_color)
         VALUES (?, ?, ?, ?, ?, ?, ?)`, [userId, translationId, book, chapter, verse, note || null, highlightColor || null]);
            res.status(201).json({ message: 'Note created successfully', noteId: result.insertId });
        }
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
// Delete Bible note
router.delete('/notes/:id', auth_middleware_1.authenticate, async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user.id;
        // Verify ownership
        const [notes] = await database_1.default.execute('SELECT id FROM bible_notes WHERE id = ? AND user_id = ?', [id, userId]);
        if (notes.length === 0) {
            return res.status(404).json({ error: 'Note not found or unauthorized' });
        }
        await database_1.default.execute('DELETE FROM bible_notes WHERE id = ?', [id]);
        res.json({ message: 'Note deleted successfully' });
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
// Get verse of the day (random inspiring verse)
router.get('/verse-of-the-day', async (req, res) => {
    try {
        // Predefined inspiring verses
        const inspiringVerses = [
            {
                book: 'John',
                chapter: 3,
                verse: 16,
                text: 'For God so loved the world, that he gave his only begotten Son, that whosoever believeth in him should not perish, but have everlasting life.',
                translation: 'KJV'
            },
            {
                book: 'Philippians',
                chapter: 4,
                verse: 13,
                text: 'I can do all things through Christ which strengtheneth me.',
                translation: 'KJV'
            },
            {
                book: 'Proverbs',
                chapter: 3,
                verse: 5,
                text: 'Trust in the LORD with all thine heart; and lean not unto thine own understanding.',
                translation: 'KJV'
            },
            {
                book: 'Psalm',
                chapter: 23,
                verse: 1,
                text: 'The LORD is my shepherd; I shall not want.',
                translation: 'KJV'
            },
            {
                book: 'Romans',
                chapter: 8,
                verse: 28,
                text: 'And we know that all things work together for good to them that love God, to them who are the called according to his purpose.',
                translation: 'KJV'
            },
            {
                book: 'Jeremiah',
                chapter: 29,
                verse: 11,
                text: 'For I know the thoughts that I think toward you, saith the LORD, thoughts of peace, and not of evil, to give you an expected end.',
                translation: 'KJV'
            }
        ];
        // Select based on day of year
        const dayOfYear = Math.floor((new Date().getTime() - new Date(new Date().getFullYear(), 0, 0).getTime()) / 86400000);
        const verseIndex = dayOfYear % inspiringVerses.length;
        res.json({ verse: inspiringVerses[verseIndex] });
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
exports.default = router;
