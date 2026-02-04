import { Router } from 'express';
import pool from '../config/database';
import { authenticate, isAdmin } from '../middleware/auth.middleware';
import { upload } from '../middleware/upload.middleware';

const router = Router();

router.get('/', async (req, res) => {
  try {
    const [gallery]: any = await pool.execute('SELECT * FROM gallery ORDER BY upload_date DESC');
    // Convert snake_case to camelCase for frontend
    const formattedGallery = gallery.map((item: any) => ({
      id: item.id,
      title: item.title,
      description: item.description,
      imageUrl: item.image_url,
      category: item.category,
      uploadDate: item.upload_date
    }));
    res.json(formattedGallery);
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch gallery' });
  }
});

router.get('/category/:category', async (req, res) => {
  try {
    const [gallery]: any = await pool.execute('SELECT * FROM gallery WHERE category = ? ORDER BY upload_date DESC', [req.params.category]);
    // Convert snake_case to camelCase for frontend
    const formattedGallery = gallery.map((item: any) => ({
      id: item.id,
      title: item.title,
      description: item.description,
      imageUrl: item.image_url,
      category: item.category,
      uploadDate: item.upload_date
    }));
    res.json(formattedGallery);
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch gallery' });
  }
});

router.post('/', authenticate, isAdmin, upload.single('image'), async (req: any, res) => {
  try {
    const { title, description, category } = req.body;
    const imageUrl = req.file ? `/uploads/gallery/${req.file.filename}` : null;

    const [result]: any = await pool.execute(
      'INSERT INTO gallery (title, description, image_url, category) VALUES (?, ?, ?, ?)',
      [title, description, imageUrl, category]
    );

    res.status(201).json({ message: 'Image uploaded', id: result.insertId });
  } catch (error) {
    res.status(500).json({ message: 'Failed to upload image' });
  }
});

router.delete('/:id', authenticate, isAdmin, async (req, res) => {
  try {
    await pool.execute('DELETE FROM gallery WHERE id = ?', [req.params.id]);
    res.json({ message: 'Image deleted' });
  } catch (error) {
    res.status(500).json({ message: 'Failed to delete image' });
  }
});

export default router;
