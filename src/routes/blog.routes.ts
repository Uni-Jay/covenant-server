import { Router } from 'express';
import pool from '../config/database';
import { authenticate, isAdmin } from '../middleware/auth.middleware';

const router = Router();

router.get('/', async (req, res) => {
  try {
    const [posts]: any = await pool.execute('SELECT * FROM blog_posts ORDER BY date DESC');
    // Convert snake_case to camelCase for frontend
    const formattedPosts = posts.map((post: any) => ({
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
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch blog posts' });
  }
});

router.post('/', authenticate, isAdmin, async (req, res) => {
  try {
    const { title, content, excerpt, author, date, imageUrl, category } = req.body;
    const [result]: any = await pool.execute(
      'INSERT INTO blog_posts (title, content, excerpt, author, date, image_url, category) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [title, content, excerpt, author, date, imageUrl, category]
    );
    res.status(201).json({ message: 'Blog post created', id: result.insertId });
  } catch (error) {
    res.status(500).json({ message: 'Failed to create blog post' });
  }
});

router.delete('/:id', authenticate, isAdmin, async (req, res) => {
  try {
    await pool.execute('DELETE FROM blog_posts WHERE id = ?', [req.params.id]);
    res.json({ message: 'Blog post deleted' });
  } catch (error) {
    res.status(500).json({ message: 'Failed to delete blog post' });
  }
});

export default router;
