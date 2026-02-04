import express from 'express';
import { authenticate } from '../middleware/auth.middleware';
import { requirePermission } from '../middleware/permissions.middleware';
import pool from '../config/database';
import { v4 as uuidv4 } from 'uuid';
import * as bcrypt from 'bcrypt';
import { sendWelcomeEmail, sendWelcomeSMS } from '../services/notification.service';

const router = express.Router();

// Generate QR code for first-timer registration
router.post('/generate-qr', authenticate, requirePermission('manage_events'), async (req, res) => {
  try {
    // Generate unique QR code
    const qrCode = `FT-${uuidv4()}`;

    res.json({ 
      qrCode,
      registrationUrl: `${process.env.APP_URL || 'https://wordofcovenant.org'}/first-timer/register/${qrCode}`
    });
  } catch (error: any) {
    console.error('Generate QR error:', error);
    res.status(500).json({ message: 'Failed to generate QR code', error: error.message });
  }
});

// Register first-timer via QR scan
router.post('/register', async (req, res) => {
  const { 
    qrCode, 
    firstName, 
    lastName, 
    email, 
    phone, 
    address 
  } = req.body;

  if (!qrCode || !firstName || !lastName) {
    return res.status(400).json({ message: 'QR code, first name, and last name are required' });
  }

  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    // Check if QR code already exists
    const [existing] = await connection.execute(
      'SELECT id FROM first_timers WHERE qr_code = ?',
      [qrCode]
    ) as any;

    if (existing && existing.length > 0) {
      await connection.rollback();
      return res.status(400).json({ message: 'This QR code has already been used. Please request a new one.' });
    }

    // Create first-timer record
    const [result] = await connection.execute(
      `INSERT INTO first_timers 
       (first_name, last_name, email, phone, address, qr_code, first_visit_date, last_visit_date) 
       VALUES (?, ?, ?, ?, ?, ?, CURDATE(), CURDATE())`,
      [firstName, lastName, email, phone, address, qrCode]
    ) as any;

    const firstTimerId = result.insertId;

    // Record first attendance (Sunday service)
    await connection.execute(
      `INSERT INTO attendance 
       (first_timer_id, service_type, service_date, qr_code) 
       VALUES (?, 'sunday_service', CURDATE(), ?)`,
      [firstTimerId, qrCode]
    );

    // Update attendance count
    await connection.execute(
      'UPDATE first_timers SET sunday_attendance_count = 1 WHERE id = ?',
      [firstTimerId]
    );

    await connection.commit();

    // Send welcome email and SMS (async, don't wait)
    const fullName = firstName;
    if (email) {
      sendWelcomeEmail(email, fullName, 'first_timer').catch(err => 
        console.error('Failed to send welcome email:', err)
      );
    }
    if (phone) {
      sendWelcomeSMS(phone, fullName, 'first_timer').catch(err => 
        console.error('Failed to send welcome SMS:', err)
      );
    }

    res.status(201).json({ 
      message: 'Welcome! You have been successfully registered as a first-timer.',
      firstTimerId,
      attendanceCount: 1,
      remainingToMembership: 5
    });
  } catch (error: any) {
    await connection.rollback();
    console.error('Register first-timer error:', error);
    res.status(500).json({ message: 'Failed to register first-timer', error: error.message });
  } finally {
    connection.release();
  }
});

// Check-in first-timer with QR code
router.post('/check-in', async (req, res) => {
  const { qrCode } = req.body;

  if (!qrCode) {
    return res.status(400).json({ message: 'QR code is required' });
  }

  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    // Get first-timer details
    const [firstTimers] = await connection.execute(
      'SELECT * FROM first_timers WHERE qr_code = ? AND is_converted_to_member = FALSE',
      [qrCode]
    ) as any;

    if (!firstTimers || firstTimers.length === 0) {
      await connection.rollback();
      return res.status(404).json({ message: 'First-timer not found or already a member' });
    }

    const firstTimer = firstTimers[0];

    // Check if already checked in today
    const [todayAttendance] = await connection.execute(
      'SELECT id FROM attendance WHERE first_timer_id = ? AND service_date = CURDATE() AND service_type = "sunday_service"',
      [firstTimer.id]
    ) as any;

    if (todayAttendance && todayAttendance.length > 0) {
      await connection.rollback();
      return res.status(400).json({ 
        message: 'Already checked in today',
        attendanceCount: firstTimer.sunday_attendance_count
      });
    }

    // Record attendance
    await connection.execute(
      `INSERT INTO attendance 
       (first_timer_id, service_type, service_date, qr_code) 
       VALUES (?, 'sunday_service', CURDATE(), ?)`,
      [firstTimer.id, qrCode]
    );

    // Update attendance count and last visit
    const newCount = firstTimer.sunday_attendance_count + 1;
    await connection.execute(
      'UPDATE first_timers SET sunday_attendance_count = ?, last_visit_date = CURDATE() WHERE id = ?',
      [newCount, firstTimer.id]
    );

    // Check if eligible for membership (6 Sundays)
    if (newCount >= 6) {
      // Auto-promote to member
      const username = `${firstTimer.first_name.toLowerCase()}.${firstTimer.last_name.toLowerCase()}`;
      const tempPassword = Math.random().toString(36).slice(-8);
      const hashedPassword = await bcrypt.hash(tempPassword, 10);

      const [userResult] = await connection.execute(
        `INSERT INTO users 
         (username, password, email, phone_number, first_name, last_name, role, is_approved) 
         VALUES (?, ?, ?, ?, ?, ?, 'member', TRUE)`,
        [username, hashedPassword, firstTimer.email, firstTimer.phone, firstTimer.first_name, firstTimer.last_name]
      ) as any;

      const userId = userResult.insertId;

      // Mark first-timer as converted
      await connection.execute(
        'UPDATE first_timers SET is_converted_to_member = TRUE, converted_user_id = ? WHERE id = ?',
        [userId, firstTimer.id]
      );

      await connection.commit();

      return res.json({ 
        message: 'Congratulations! You are now a member of Word of Covenant Church!',
        promoted: true,
        attendanceCount: newCount,
        username,
        tempPassword,
        userId
      });
    }

    await connection.commit();
    res.json({ 
      message: 'Check-in successful',
      attendanceCount: newCount,
      remainingToMembership: 6 - newCount
    });
  } catch (error: any) {
    await connection.rollback();
    console.error('Check-in error:', error);
    res.status(500).json({ message: 'Failed to check in', error: error.message });
  } finally {
    connection.release();
  }
});

// Get all first-timers (for admin/media_head)
router.get('/', authenticate, requirePermission('view_attendance'), async (req, res) => {
  try {
    const [firstTimers] = await pool.execute(
      `SELECT ft.*, 
       COUNT(a.id) as total_visits,
       u.username as converted_username
       FROM first_timers ft
       LEFT JOIN attendance a ON ft.id = a.first_timer_id
       LEFT JOIN users u ON ft.converted_user_id = u.id
       GROUP BY ft.id
       ORDER BY ft.created_at DESC`
    ) as any;

    res.json(firstTimers);
  } catch (error: any) {
    console.error('Get first-timers error:', error);
    res.status(500).json({ message: 'Failed to get first-timers', error: error.message });
  }
});

// Get first-timer attendance history
router.get('/:id/attendance', authenticate, requirePermission('view_attendance'), async (req, res) => {
  const { id } = req.params;

  try {
    const [firstTimer] = await pool.execute(
      'SELECT * FROM first_timers WHERE id = ?',
      [id]
    ) as any;

    if (!firstTimer || firstTimer.length === 0) {
      return res.status(404).json({ message: 'First-timer not found' });
    }

    const [attendance] = await pool.execute(
      `SELECT * FROM attendance 
       WHERE first_timer_id = ? 
       ORDER BY service_date DESC`,
      [id]
    ) as any;

    res.json({
      firstTimer: firstTimer[0],
      attendance
    });
  } catch (error: any) {
    console.error('Get attendance error:', error);
    res.status(500).json({ message: 'Failed to get attendance', error: error.message });
  }
});

// Manually promote first-timer to member
router.post('/:id/promote', authenticate, requirePermission('manage_users'), async (req, res) => {
  const { id } = req.params;
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    const [firstTimers] = await connection.execute(
      'SELECT * FROM first_timers WHERE id = ? AND is_converted_to_member = FALSE',
      [id]
    ) as any;

    if (!firstTimers || firstTimers.length === 0) {
      await connection.rollback();
      return res.status(404).json({ message: 'First-timer not found or already converted' });
    }

    const firstTimer = firstTimers[0];

    // Create user account
    const username = `${firstTimer.first_name.toLowerCase()}.${firstTimer.last_name.toLowerCase()}`;
    const tempPassword = Math.random().toString(36).slice(-8);
    const hashedPassword = await bcrypt.hash(tempPassword, 10);

    const [userResult] = await connection.execute(
      `INSERT INTO users 
       (username, password, email, phone_number, first_name, last_name, role, is_approved) 
       VALUES (?, ?, ?, ?, ?, ?, 'member', TRUE)`,
      [username, hashedPassword, firstTimer.email, firstTimer.phone, firstTimer.first_name, firstTimer.last_name]
    ) as any;

    const userId = userResult.insertId;

    // Mark first-timer as converted
    await connection.execute(
      'UPDATE first_timers SET is_converted_to_member = TRUE, converted_user_id = ? WHERE id = ?',
      [userId, id]
    );

    await connection.commit();

    res.json({ 
      message: 'First-timer promoted to member successfully',
      userId,
      username,
      tempPassword
    });
  } catch (error: any) {
    await connection.rollback();
    console.error('Promote error:', error);
    res.status(500).json({ message: 'Failed to promote first-timer', error: error.message });
  } finally {
    connection.release();
  }
});

// Get first-timer by QR code (for mobile app)
router.get('/by-qr/:qrCode', async (req, res) => {
  const { qrCode } = req.params;

  try {
    const [firstTimers] = await pool.execute(
      'SELECT * FROM first_timers WHERE qr_code = ?',
      [qrCode]
    ) as any;

    if (!firstTimers || firstTimers.length === 0) {
      return res.status(404).json({ message: 'First-timer not found' });
    }

    res.json(firstTimers[0]);
  } catch (error: any) {
    console.error('Get by QR error:', error);
    res.status(500).json({ message: 'Failed to get first-timer', error: error.message });
  }
});

export default router;
