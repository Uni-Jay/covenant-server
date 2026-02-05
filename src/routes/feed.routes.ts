import express, { Request, Response } from 'express';
import pool from '../config/database';
import { authenticate } from '../middleware/auth.middleware';
import { requirePermission } from '../middleware/permissions.middleware';
import { upload } from '../middleware/upload.middleware';

const router = express.Router();

interface AuthRequest extends Request {
  user?: {
    id: number;
    email: string;
    role: string;
  };
}

// Get feed posts (paginated)
router.get('/', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const offset = (page - 1) * limit;
    const type = req.query.type as string;

    let query = `
      SELECT 
        fp.*,
        u.first_name, u.last_name, u.profile_image, u.role,
        (SELECT COUNT(*) > 0 FROM post_likes WHERE post_id = fp.id AND user_id = ?) as user_liked
      FROM feed_posts fp
      JOIN users u ON fp.user_id = u.id
    `;

    const params: any[] = [req.user!.id];

    if (type && type !== 'all') {
      query += ' WHERE fp.post_type = ?';
      params.push(type);
    }

    query += ` ORDER BY fp.is_pinned DESC, fp.created_at DESC LIMIT ${limit} OFFSET ${offset}`;

    console.log('[Feed] Query:', query);
    console.log('[Feed] Params:', params);
    console.log('[Feed] Params count:', params.length);

    const [posts] = await pool.execute(query, params);

    // Get total count
    let countQuery = 'SELECT COUNT(*) as total FROM feed_posts';
    if (type && type !== 'all') {
      countQuery += ' WHERE post_type = ?';
    }
    const [countResult] = await pool.execute(
      countQuery, 
      type && type !== 'all' ? [type] : []
    ) as any;

    res.json({
      posts,
      pagination: {
        page,
        limit,
        total: countResult[0].total,
        totalPages: Math.ceil(countResult[0].total / limit)
      }
    });
  } catch (error: any) {
    console.error('Feed error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get single post with comments
router.get('/:id', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    const [posts] = await pool.execute(`
      SELECT 
        fp.*,
        u.first_name, u.last_name, u.profile_image, u.role,
        (SELECT COUNT(*) > 0 FROM post_likes WHERE post_id = fp.id AND user_id = ?) as user_liked
      FROM feed_posts fp
      JOIN users u ON fp.user_id = u.id
      WHERE fp.id = ?
    `, [req.user!.id, id]) as any;

    if (posts.length === 0) {
      return res.status(404).json({ error: 'Post not found' });
    }

    // Get comments
    const [comments] = await pool.execute(`
      SELECT 
        pc.*,
        u.first_name, u.last_name, u.profile_image, u.role
      FROM post_comments pc
      JOIN users u ON pc.user_id = u.id
      WHERE pc.post_id = ?
      ORDER BY pc.created_at DESC
    `, [id]);

    res.json({ post: posts[0], comments });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Create post
router.post('/', authenticate, upload.single('media'), async (req: AuthRequest, res: Response) => {
  try {
    const { content, postType = 'general', taggedUsers } = req.body;
    const userId = req.user!.id;

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

    const [result] = await pool.execute(
      `INSERT INTO feed_posts (user_id, content, media_url, media_type, post_type) 
       VALUES (?, ?, ?, ?, ?)`,
      [userId, content, mediaUrl, mediaType, postType]
    ) as any;

    const postId = result.insertId;

    // Handle tagged users
    if (taggedUsers) {
      try {
        const userIds = typeof taggedUsers === 'string' ? JSON.parse(taggedUsers) : taggedUsers;
        if (Array.isArray(userIds) && userIds.length > 0) {
          const tagValues = userIds.map((taggedUserId: number) => [postId, taggedUserId]);
          await pool.query(
            'INSERT INTO post_tags (post_id, user_id) VALUES ?',
            [tagValues]
          );
        }
      } catch (tagError) {
        console.error('Error tagging users:', tagError);
      }
    }

    const [post] = await pool.execute(`
      SELECT 
        fp.*,
        u.first_name, u.last_name, u.profile_image, u.role
      FROM feed_posts fp
      JOIN users u ON fp.user_id = u.id
      WHERE fp.id = ?
    `, [postId]) as any;

    res.status(201).json({ post: post[0] });
  } catch (error: any) {
    console.error('Create post error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Update post
router.put('/:id', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { content } = req.body;
    const userId = req.user!.id;

    // Check ownership
    const [posts] = await pool.execute(
      'SELECT * FROM feed_posts WHERE id = ?',
      [id]
    ) as any;

    if (posts.length === 0) {
      return res.status(404).json({ error: 'Post not found' });
    }

    if (posts[0].user_id !== userId) {
      return res.status(403).json({ error: 'You can only edit your own posts' });
    }

    await pool.execute(
      'UPDATE feed_posts SET content = ? WHERE id = ?',
      [content, id]
    );

    const [updatedPost] = await pool.execute(`
      SELECT 
        fp.*,
        u.first_name, u.last_name, u.profile_image, u.role
      FROM feed_posts fp
      JOIN users u ON fp.user_id = u.id
      WHERE fp.id = ?
    `, [id]) as any;

    res.json({ post: updatedPost[0] });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Delete post
router.delete('/:id', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.user!.id;
    const userRole = req.user!.role;

    const [posts] = await pool.execute(
      'SELECT * FROM feed_posts WHERE id = ?',
      [id]
    ) as any;

    if (posts.length === 0) {
      return res.status(404).json({ error: 'Post not found' });
    }

    // Allow deletion if owner or has moderation permission
    const canModerate = ['super_admin', 'pastor', 'elder', 'media_head'].includes(userRole);
    if (posts[0].user_id !== userId && !canModerate) {
      return res.status(403).json({ error: 'Unauthorized to delete this post' });
    }

    await pool.execute('DELETE FROM feed_posts WHERE id = ?', [id]);
    res.json({ message: 'Post deleted successfully' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Like/Unlike post
router.post('/:id/like', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.user!.id;

    // Check if already liked
    const [existing] = await pool.execute(
      'SELECT * FROM post_likes WHERE post_id = ? AND user_id = ?',
      [id, userId]
    ) as any;

    if (existing.length > 0) {
      // Unlike
      await pool.execute(
        'DELETE FROM post_likes WHERE post_id = ? AND user_id = ?',
        [id, userId]
      );
      res.json({ message: 'Post unliked', liked: false });
    } else {
      // Like
      await pool.execute(
        'INSERT INTO post_likes (post_id, user_id) VALUES (?, ?)',
        [id, userId]
      );
      res.json({ message: 'Post liked', liked: true });
    }
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Add comment
router.post('/:id/comment', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { comment } = req.body;
    const userId = req.user!.id;

    if (!comment || comment.trim().length === 0) {
      return res.status(400).json({ error: 'Comment is required' });
    }

    const [result] = await pool.execute(
      'INSERT INTO post_comments (post_id, user_id, comment) VALUES (?, ?, ?)',
      [id, userId, comment]
    ) as any;

    const [newComment] = await pool.execute(`
      SELECT 
        pc.*,
        u.first_name, u.last_name, u.profile_image, u.role
      FROM post_comments pc
      JOIN users u ON pc.user_id = u.id
      WHERE pc.id = ?
    `, [result.insertId]) as any;

    res.status(201).json({ comment: newComment[0] });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Delete comment
router.delete('/:postId/comment/:commentId', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { commentId } = req.params;
    const userId = req.user!.id;
    const userRole = req.user!.role;

    const [comments] = await pool.execute(
      'SELECT * FROM post_comments WHERE id = ?',
      [commentId]
    ) as any;

    if (comments.length === 0) {
      return res.status(404).json({ error: 'Comment not found' });
    }

    const canModerate = ['super_admin', 'pastor', 'elder', 'media_head'].includes(userRole);
    if (comments[0].user_id !== userId && !canModerate) {
      return res.status(403).json({ error: 'Unauthorized to delete this comment' });
    }

    await pool.execute('DELETE FROM post_comments WHERE id = ?', [commentId]);
    res.json({ message: 'Comment deleted successfully' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Pin/Unpin post (moderators only)
router.post('/:id/pin', authenticate, requirePermission('feed:pin'), async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    
    const [posts] = await pool.execute(
      'SELECT is_pinned FROM feed_posts WHERE id = ?',
      [id]
    ) as any;

    if (posts.length === 0) {
      return res.status(404).json({ error: 'Post not found' });
    }

    const newPinnedState = !posts[0].is_pinned;
    await pool.execute(
      'UPDATE feed_posts SET is_pinned = ? WHERE id = ?',
      [newPinnedState, id]
    );

    res.json({ message: `Post ${newPinnedState ? 'pinned' : 'unpinned'} successfully`, pinned: newPinnedState });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
