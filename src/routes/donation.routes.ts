import { Router } from 'express';
import pool from '../config/database';
import { authenticate, isAdmin } from '../middleware/auth.middleware';

const router = Router();

router.get('/', authenticate, isAdmin, async (req, res) => {
  try {
    const [donations] = await pool.execute('SELECT * FROM donations ORDER BY created_at DESC');
    res.json(donations);
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch donations' });
  }
});

// Get user's own donation history
router.get('/history', authenticate, async (req: any, res) => {
  try {
    const userEmail = req.user.email;
    
    const [donations]: any = await pool.execute(
      `SELECT 
        id,
        name,
        email,
        amount,
        purpose,
        payment_method as paymentMethod,
        status,
        created_at as date,
        CONCAT('REF', LPAD(id, 6, '0')) as reference
      FROM donations 
      WHERE email = ? 
      ORDER BY created_at DESC`,
      [userEmail]
    );
    
    res.json({ donations });
  } catch (error: any) {
    console.error('Failed to fetch donation history:', error);
    res.status(500).json({ message: 'Failed to fetch donation history' });
  }
});

router.post('/', async (req, res) => {
  try {
    const { name, email, phone, amount, purpose, paymentMethod, donorName, donorEmail, isAnonymous } = req.body;
    
    // Handle both field name formats (name/donorName, email/donorEmail)
    const finalName = isAnonymous ? 'Anonymous' : (name || donorName);
    const finalEmail = email || donorEmail;
    
    // Validate required fields
    if (!finalName || !finalEmail || !amount || !purpose) {
      console.error('Missing required fields:', { finalName, finalEmail, amount, purpose });
      return res.status(400).json({ 
        message: 'Missing required fields: name, email, amount, and purpose are required' 
      });
    }

    const [result]: any = await pool.execute(
      'INSERT INTO donations (name, email, phone, amount, purpose, payment_method, status) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [finalName, finalEmail, phone || null, amount, purpose, paymentMethod || 'Bank Transfer', 'pending']
    );
    
    console.log('Donation recorded successfully:', { id: result.insertId, name: finalName, amount });
    res.status(201).json({ message: 'Donation recorded', id: result.insertId });
  } catch (error: any) {
    console.error('Failed to record donation:', error);
    res.status(500).json({ message: 'Failed to record donation', error: error?.message || 'Unknown error' });
  }
});

export default router;
