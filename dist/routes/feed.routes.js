"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const database_1 = __importDefault(require("../config/database"));
const auth_middleware_1 = require("../middleware/auth.middleware");
const permissions_middleware_1 = require("../middleware/permissions.middleware");
const upload_middleware_1 = require("../middleware/upload.middleware");
const router = express_1.default.Router();
// Get feed posts (paginated)
router.get('/', auth_middleware_1.authenticate, async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const offset = (page - 1) * limit;
        const type = req.query.type;
        let query = `
      SELECT 
        fp.*,
        u.first_name, u.last_name, u.profile_image, u.role,
        (SELECT COUNT(*) > 0 FROM post_likes WHERE post_id = fp.id AND user_id = ?) as user_liked
      FROM feed_posts fp
      JOIN users u ON fp.user_id = u.id
    `;
        const params = [req.user.id];
        if (type && type !== 'all') {
            query += ' WHERE fp.post_type = ?';
            params.push(type);
        }
        query += ` ORDER BY fp.is_pinned DESC, fp.created_at DESC LIMIT ${limit} OFFSET ${offset}`;
        console.log('[Feed] Query:', query);
        console.log('[Feed] Params:', params);
        console.log('[Feed] Params count:', params.length);
        const [posts] = await database_1.default.execute(query, params);
        // Get total count
        let countQuery = 'SELECT COUNT(*) as total FROM feed_posts';
        if (type && type !== 'all') {
            countQuery += ' WHERE post_type = ?';
        }
        const [countResult] = await database_1.default.execute(countQuery, type && type !== 'all' ? [type] : []);
        res.json({
            posts,
            pagination: {
                page,
                limit,
                total: countResult[0].total,
                totalPages: Math.ceil(countResult[0].total / limit)
            }
        });
    }
    catch (error) {
        console.error('Feed error:', error);
        res.status(500).json({ error: error.message });
    }
});
// Get single post with comments
router.get('/:id', auth_middleware_1.authenticate, async (req, res) => {
    try {
        const { id } = req.params;
        const [posts] = await database_1.default.execute(`
      SELECT 
        fp.*,
        u.first_name, u.last_name, u.profile_image, u.role,
        (SELECT COUNT(*) > 0 FROM post_likes WHERE post_id = fp.id AND user_id = ?) as user_liked
      FROM feed_posts fp
      JOIN users u ON fp.user_id = u.id
      WHERE fp.id = ?
    `, [req.user.id, id]);
        if (posts.length === 0) {
            return res.status(404).json({ error: 'Post not found' });
        }
        // Get comments
        const [comments] = await database_1.default.execute(`
      SELECT 
        pc.*,
        u.first_name, u.last_name, u.profile_image, u.role
      FROM post_comments pc
      JOIN users u ON pc.user_id = u.id
      WHERE pc.post_id = ?
      ORDER BY pc.created_at DESC
    `, [id]);
        res.json({ post: posts[0], comments });
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
// Create post
router.post('/', auth_middleware_1.authenticate, upload_middleware_1.upload.single('media'), async (req, res) => {
    try {
        const { content, postType = 'general', taggedUsers } = req.body;
        const userId = req.user.id;
        if (!content || content.trim().length === 0) {
            return res.status(400).json({ error: 'Content is required' });
        }
        let mediaUrl = null;
        let mediaType = null;
        // Everyone can upload media in feed posts
        if (req.file) {
            mediaUrl = `/uploads/${req.file.filename}`;
            mediaType = req.file.mimetype.startsWith('image/') ? 'image' : 'video';
        }
        const [result] = await database_1.default.execute(`INSERT INTO feed_posts (user_id, content, media_url, media_type, post_type) 
       VALUES (?, ?, ?, ?, ?)`, [userId, content, mediaUrl, mediaType, postType]);
        const postId = result.insertId;
        // Handle tagged users
        if (taggedUsers) {
            try {
                const userIds = typeof taggedUsers === 'string' ? JSON.parse(taggedUsers) : taggedUsers;
                if (Array.isArray(userIds) && userIds.length > 0) {
                    const tagValues = userIds.map((taggedUserId) => [postId, taggedUserId]);
                    await database_1.default.query('INSERT INTO post_tags (post_id, user_id) VALUES ?', [tagValues]);
                }
            }
            catch (tagError) {
                console.error('Error tagging users:', tagError);
            }
        }
        const [post] = await database_1.default.execute(`
      SELECT 
        fp.*,
        u.first_name, u.last_name, u.profile_image, u.role
      FROM feed_posts fp
      JOIN users u ON fp.user_id = u.id
      WHERE fp.id = ?
    `, [postId]);
        res.status(201).json({ post: post[0] });
    }
    catch (error) {
        console.error('Create post error:', error);
        res.status(500).json({ error: error.message });
    }
});
// Update post
router.put('/:id', auth_middleware_1.authenticate, async (req, res) => {
    try {
        const { id } = req.params;
        const { content } = req.body;
        const userId = req.user.id;
        // Check ownership
        const [posts] = await database_1.default.execute('SELECT * FROM feed_posts WHERE id = ?', [id]);
        if (posts.length === 0) {
            return res.status(404).json({ error: 'Post not found' });
        }
        if (posts[0].user_id !== userId) {
            return res.status(403).json({ error: 'You can only edit your own posts' });
        }
        await database_1.default.execute('UPDATE feed_posts SET content = ? WHERE id = ?', [content, id]);
        const [updatedPost] = await database_1.default.execute(`
      SELECT 
        fp.*,
        u.first_name, u.last_name, u.profile_image, u.role
      FROM feed_posts fp
      JOIN users u ON fp.user_id = u.id
      WHERE fp.id = ?
    `, [id]);
        res.json({ post: updatedPost[0] });
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
// Delete post
router.delete('/:id', auth_middleware_1.authenticate, async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user.id;
        const userRole = req.user.role;
        const [posts] = await database_1.default.execute('SELECT * FROM feed_posts WHERE id = ?', [id]);
        if (posts.length === 0) {
            return res.status(404).json({ error: 'Post not found' });
        }
        // Allow deletion if owner or has moderation permission
        const canModerate = ['super_admin', 'pastor', 'elder', 'media_head'].includes(userRole);
        if (posts[0].user_id !== userId && !canModerate) {
            return res.status(403).json({ error: 'Unauthorized to delete this post' });
        }
        await database_1.default.execute('DELETE FROM feed_posts WHERE id = ?', [id]);
        res.json({ message: 'Post deleted successfully' });
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
// Like/Unlike post
router.post('/:id/like', auth_middleware_1.authenticate, async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user.id;
        // Check if already liked
        const [existing] = await database_1.default.execute('SELECT * FROM post_likes WHERE post_id = ? AND user_id = ?', [id, userId]);
        if (existing.length > 0) {
            // Unlike
            await database_1.default.execute('DELETE FROM post_likes WHERE post_id = ? AND user_id = ?', [id, userId]);
            res.json({ message: 'Post unliked', liked: false });
        }
        else {
            // Like
            await database_1.default.execute('INSERT INTO post_likes (post_id, user_id) VALUES (?, ?)', [id, userId]);
            res.json({ message: 'Post liked', liked: true });
        }
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
// Add comment
router.post('/:id/comment', auth_middleware_1.authenticate, async (req, res) => {
    try {
        const { id } = req.params;
        const { comment } = req.body;
        const userId = req.user.id;
        if (!comment || comment.trim().length === 0) {
            return res.status(400).json({ error: 'Comment is required' });
        }
        const [result] = await database_1.default.execute('INSERT INTO post_comments (post_id, user_id, comment) VALUES (?, ?, ?)', [id, userId, comment]);
        const [newComment] = await database_1.default.execute(`
      SELECT 
        pc.*,
        u.first_name, u.last_name, u.profile_image, u.role
      FROM post_comments pc
      JOIN users u ON pc.user_id = u.id
      WHERE pc.id = ?
    `, [result.insertId]);
        res.status(201).json({ comment: newComment[0] });
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
// Delete comment
router.delete('/:postId/comment/:commentId', auth_middleware_1.authenticate, async (req, res) => {
    try {
        const { commentId } = req.params;
        const userId = req.user.id;
        const userRole = req.user.role;
        const [comments] = await database_1.default.execute('SELECT * FROM post_comments WHERE id = ?', [commentId]);
        if (comments.length === 0) {
            return res.status(404).json({ error: 'Comment not found' });
        }
        const canModerate = ['super_admin', 'pastor', 'elder', 'media_head'].includes(userRole);
        if (comments[0].user_id !== userId && !canModerate) {
            return res.status(403).json({ error: 'Unauthorized to delete this comment' });
        }
        await database_1.default.execute('DELETE FROM post_comments WHERE id = ?', [commentId]);
        res.json({ message: 'Comment deleted successfully' });
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
// Pin/Unpin post (moderators only)
router.post('/:id/pin', auth_middleware_1.authenticate, (0, permissions_middleware_1.requirePermission)('feed:pin'), async (req, res) => {
    try {
        const { id } = req.params;
        const [posts] = await database_1.default.execute('SELECT is_pinned FROM feed_posts WHERE id = ?', [id]);
        if (posts.length === 0) {
            return res.status(404).json({ error: 'Post not found' });
        }
        const newPinnedState = !posts[0].is_pinned;
        await database_1.default.execute('UPDATE feed_posts SET is_pinned = ? WHERE id = ?', [newPinnedState, id]);
        res.json({ message: `Post ${newPinnedState ? 'pinned' : 'unpinned'} successfully`, pinned: newPinnedState });
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
exports.default = router;
