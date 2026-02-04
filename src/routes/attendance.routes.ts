import express from 'express';
import { authenticate } from '../middleware/auth.middleware';
import { requirePermission } from '../middleware/permissions.middleware';
import pool from '../config/database';
import { v4 as uuidv4 } from 'uuid';

const router = express.Router();

// Generate QR code for service/event
router.post('/generate-service-qr', authenticate, requirePermission('event:attendance'), async (req, res) => {
  const { serviceType, serviceDate, eventId } = req.body;

  try {
    // Generate unique QR code for this service
    const qrCode = `SVC-${serviceType}-${serviceDate}-${uuidv4().slice(0, 8)}`;

    res.json({ 
      qrCode,
      serviceType,
      serviceDate,
      eventId,
      checkInUrl: `${process.env.APP_URL || 'https://wordofcovenant.org'}/attendance/check-in/${qrCode}`
    });
  } catch (error: any) {
    console.error('Generate service QR error:', error);
    res.status(500).json({ message: 'Failed to generate QR code', error: error.message });
  }
});

// Check-in member/first-timer with QR code
router.post('/check-in', authenticate, async (req, res) => {
  const { qrCode, serviceType, eventId } = req.body;
  const userId = (req as any).user.id;

  if (!qrCode || !serviceType) {
    return res.status(400).json({ message: 'QR code and service type are required' });
  }

  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    // Check if already checked in today for this service
    const [existing] = await connection.execute(
      `SELECT id FROM attendance 
       WHERE user_id = ? 
       AND service_type = ? 
       AND service_date = CURDATE()`,
      [userId, serviceType]
    ) as any;

    if (existing && existing.length > 0) {
      await connection.rollback();
      return res.status(400).json({ message: 'Already checked in for this service today' });
    }

    // Record attendance
    await connection.execute(
      `INSERT INTO attendance 
       (user_id, service_type, service_date, event_id, qr_code) 
       VALUES (?, ?, CURDATE(), ?, ?)`,
      [userId, serviceType, eventId, qrCode]
    );

    await connection.commit();

    res.json({ 
      message: 'Check-in successful',
      serviceType,
      serviceDate: new Date().toISOString().split('T')[0]
    });
  } catch (error: any) {
    await connection.rollback();
    console.error('Check-in error:', error);
    res.status(500).json({ message: 'Failed to check in', error: error.message });
  } finally {
    connection.release();
  }
});

// Get user's attendance history
router.get('/my-attendance', authenticate, async (req, res) => {
  const userId = (req as any).user.id;
  const { startDate, endDate, serviceType } = req.query;

  try {
    let query = `
      SELECT a.*, e.title as event_title
      FROM attendance a
      LEFT JOIN events e ON a.event_id = e.id
      WHERE a.user_id = ?
    `;

    const params: any[] = [userId];

    if (startDate) {
      query += ' AND a.service_date >= ?';
      params.push(startDate);
    }

    if (endDate) {
      query += ' AND a.service_date <= ?';
      params.push(endDate);
    }

    if (serviceType) {
      query += ' AND a.service_type = ?';
      params.push(serviceType);
    }

    query += ' ORDER BY a.service_date DESC, a.check_in_time DESC';

    const [attendance] = await pool.execute(query, params) as any;

    // Get summary
    const [summary] = await pool.execute(
      `SELECT 
        COUNT(*) as total_attendance,
        COUNT(DISTINCT service_date) as unique_days,
        service_type,
        COUNT(*) as count
       FROM attendance
       WHERE user_id = ?
       GROUP BY service_type`,
      [userId]
    ) as any;

    res.json({
      attendance,
      summary: {
        total: attendance.length,
        byServiceType: summary
      }
    });
  } catch (error: any) {
    console.error('Get attendance error:', error);
    res.status(500).json({ message: 'Failed to get attendance', error: error.message });
  }
});

// Get attendance report (admin)
router.get('/report', authenticate, requirePermission('view_attendance'), async (req, res) => {
  const { startDate, endDate, serviceType, department } = req.query;

  try {
    let query = `
      SELECT 
        a.*,
        u.first_name,
        u.last_name,
        u.email,
        u.role,
        u.departments,
        e.title as event_title
      FROM attendance a
      LEFT JOIN users u ON a.user_id = u.id
      LEFT JOIN first_timers ft ON a.first_timer_id = ft.id
      LEFT JOIN events e ON a.event_id = e.id
      WHERE 1=1
    `;

    const params: any[] = [];

    if (startDate) {
      query += ' AND a.service_date >= ?';
      params.push(startDate);
    } else {
      query += ' AND a.service_date >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)';
    }

    if (endDate) {
      query += ' AND a.service_date <= ?';
      params.push(endDate);
    }

    if (serviceType) {
      query += ' AND a.service_type = ?';
      params.push(serviceType);
    }

    if (department) {
      query += ' AND u.departments LIKE ?';
      params.push(`%${department}%`);
    }

    query += ' ORDER BY a.service_date DESC, a.check_in_time DESC';

    const [attendance] = await pool.execute(query, params) as any;

    // Get statistics
    const [stats] = await pool.execute(
      `SELECT 
        service_date,
        service_type,
        COUNT(DISTINCT user_id) as member_count,
        COUNT(DISTINCT first_timer_id) as first_timer_count,
        COUNT(*) as total_count
       FROM attendance
       WHERE service_date >= ? ${serviceType ? 'AND service_type = ?' : ''}
       GROUP BY service_date, service_type
       ORDER BY service_date DESC`,
      serviceType 
        ? [startDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], serviceType]
        : [startDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]]
    ) as any;

    res.json({
      attendance,
      statistics: stats,
      totalRecords: attendance.length
    });
  } catch (error: any) {
    console.error('Get report error:', error);
    res.status(500).json({ message: 'Failed to get attendance report', error: error.message });
  }
});

// Get attendance by service date (admin)
router.get('/by-date/:date', authenticate, requirePermission('view_attendance'), async (req, res) => {
  const { date } = req.params;
  const { serviceType } = req.query;

  try {
    let query = `
      SELECT 
        a.*,
        u.first_name,
        u.last_name,
        u.email,
        u.role,
        ft.first_name as ft_first_name,
        ft.last_name as ft_last_name,
        e.title as event_title
      FROM attendance a
      LEFT JOIN users u ON a.user_id = u.id
      LEFT JOIN first_timers ft ON a.first_timer_id = ft.id
      LEFT JOIN events e ON a.event_id = e.id
      WHERE a.service_date = ?
    `;

    const params: any[] = [date];

    if (serviceType) {
      query += ' AND a.service_type = ?';
      params.push(serviceType);
    }

    query += ' ORDER BY a.check_in_time ASC';

    const [attendance] = await pool.execute(query, params) as any;

    res.json({
      date,
      serviceType: serviceType || 'all',
      totalAttendance: attendance.length,
      members: attendance.filter((a: any) => a.user_id).length,
      firstTimers: attendance.filter((a: any) => a.first_timer_id).length,
      attendance
    });
  } catch (error: any) {
    console.error('Get by date error:', error);
    res.status(500).json({ message: 'Failed to get attendance', error: error.message });
  }
});

// Mark attendance manually (admin)
router.post('/manual', authenticate, requirePermission('manage_attendance'), async (req, res) => {
  const { userId, serviceType, serviceDate, eventId, department } = req.body;

  if (!userId || !serviceType || !serviceDate) {
    return res.status(400).json({ message: 'User ID, service type, and date are required' });
  }

  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    // Check if already exists
    const [existing] = await connection.execute(
      `SELECT id FROM attendance 
       WHERE user_id = ? 
       AND service_type = ? 
       AND service_date = ?`,
      [userId, serviceType, serviceDate]
    ) as any;

    if (existing && existing.length > 0) {
      await connection.rollback();
      return res.status(400).json({ message: 'Attendance already recorded for this user and service' });
    }

    // Insert attendance
    await connection.execute(
      `INSERT INTO attendance 
       (user_id, service_type, service_date, event_id, department, qr_code) 
       VALUES (?, ?, ?, ?, ?, 'MANUAL')`,
      [userId, serviceType, serviceDate, eventId, department]
    );

    await connection.commit();

    res.json({ 
      message: 'Attendance recorded successfully',
      userId,
      serviceType,
      serviceDate
    });
  } catch (error: any) {
    await connection.rollback();
    console.error('Manual attendance error:', error);
    res.status(500).json({ message: 'Failed to record attendance', error: error.message });
  } finally {
    connection.release();
  }
});

// Delete attendance record (admin)
router.delete('/:id', authenticate, requirePermission('manage_attendance'), async (req, res) => {
  const { id } = req.params;

  try {
    await pool.execute('DELETE FROM attendance WHERE id = ?', [id]);
    res.json({ message: 'Attendance record deleted successfully' });
  } catch (error: any) {
    console.error('Delete attendance error:', error);
    res.status(500).json({ message: 'Failed to delete attendance', error: error.message });
  }
});

// Get attendance statistics summary
router.get('/statistics', authenticate, requirePermission('view_attendance'), async (req, res) => {
  try {
    // Total attendance this month
    const [thisMonth] = await pool.execute(
      `SELECT COUNT(*) as total FROM attendance 
       WHERE MONTH(service_date) = MONTH(CURDATE()) 
       AND YEAR(service_date) = YEAR(CURDATE())`
    ) as any;

    // By service type this month
    const [byType] = await pool.execute(
      `SELECT service_type, COUNT(*) as count 
       FROM attendance 
       WHERE MONTH(service_date) = MONTH(CURDATE())
       GROUP BY service_type`
    ) as any;

    // Average by day of week
    const [byDayOfWeek] = await pool.execute(
      `SELECT 
        DAYNAME(service_date) as day_name,
        AVG(daily_count) as average
       FROM (
         SELECT service_date, COUNT(*) as daily_count
         FROM attendance
         WHERE service_date >= DATE_SUB(CURDATE(), INTERVAL 3 MONTH)
         GROUP BY service_date
       ) as daily
       GROUP BY DAYNAME(service_date)
       ORDER BY FIELD(DAYNAME(service_date), 'Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday')`
    ) as any;

    // Top attendees this month
    const [topAttendees] = await pool.execute(
      `SELECT 
        u.id,
        CONCAT(u.first_name, ' ', u.last_name) as name,
        COUNT(*) as attendance_count
       FROM attendance a
       JOIN users u ON a.user_id = u.id
       WHERE MONTH(a.service_date) = MONTH(CURDATE())
       GROUP BY u.id
       ORDER BY attendance_count DESC
       LIMIT 10`
    ) as any;

    res.json({
      thisMonth: thisMonth[0].total,
      byServiceType: byType,
      byDayOfWeek,
      topAttendees
    });
  } catch (error: any) {
    console.error('Get statistics error:', error);
    res.status(500).json({ message: 'Failed to get statistics', error: error.message });
  }
});

export default router;
