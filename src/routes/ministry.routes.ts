import { Router } from 'express';
import pool from '../config/database';
import { notifyPublicSubmission, savePublicSubmission } from '../utils/publicSubmission';

const router = Router();

router.get('/', async (req, res) => {
  try {
    const [ministries] = await pool.execute('SELECT * FROM ministries ORDER BY name');
    res.json(ministries);
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch ministries' });
  }
});

router.post('/:id/join', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, email, phone } = req.body;
    const [ministries]: any = await pool.execute('SELECT name, leader, schedule FROM ministries WHERE id = ?', [id]);

    if (!ministries.length) {
      return res.status(404).json({ message: 'Ministry not found' });
    }

    const ministry = ministries[0];
    const subject = `Ministry Join Request - ${ministry.name}`;
    const html = `
      <h2>New Ministry Join Request</h2>
      <p><strong>Ministry:</strong> ${ministry.name}</p>
      <p><strong>Leader:</strong> ${ministry.leader || 'Not assigned'}</p>
      <p><strong>Schedule:</strong> ${ministry.schedule || 'Not set'}</p>
      <p><strong>Name:</strong> ${name}</p>
      <p><strong>Email:</strong> ${email}</p>
      <p><strong>Phone:</strong> ${phone || 'Not provided'}</p>
    `;

    const insertId = await savePublicSubmission({
      name,
      email,
      phone,
      subject,
      message: `Ministry join request for ${ministry.name}`,
    });
    const emailDelivered = await notifyPublicSubmission({
      name,
      email,
      phone,
      subject,
      message: html,
      recipient: process.env.ORG_EMAIL_INFO || 'info@hocfam.org',
    });

    res.status(emailDelivered ? 201 : 202).json({
      id: insertId,
      message: 'Join request submitted',
      emailDelivered,
    });
  } catch (error) {
    res.status(500).json({ message: 'Failed to submit ministry join request' });
  }
});

export default router;
