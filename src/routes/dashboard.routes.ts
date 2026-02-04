import express from 'express';
import { authenticate } from '../middleware/auth.middleware';
import { requirePermission } from '../middleware/permissions.middleware';
import pool from '../config/database';

const router = express.Router();

// Get overall statistics
router.get('/stats', authenticate, requirePermission('view_dashboard'), async (req, res) => {
  try {
    // Total members by role (handle is_approved column that may not exist)
    let members = [];
    try {
      const [membersResult] = await pool.execute(
        `SELECT role, COUNT(*) as count 
         FROM users 
         WHERE is_approved = TRUE 
         GROUP BY role`
      ) as any;
      members = membersResult;
    } catch (columnError: any) {
      // If is_approved column doesn't exist, get all users
      if (columnError.code === 'ER_BAD_FIELD_ERROR') {
        console.log('is_approved column not found, querying all users');
        const [membersResult] = await pool.execute(
          `SELECT role, COUNT(*) as count 
           FROM users 
           GROUP BY role`
        ) as any;
        members = membersResult;
      } else {
        throw columnError;
      }
    }

    // Total first-timers (wrapped in try-catch)
    let firstTimersTotal = 0;
    let convertedTotal = 0;
    try {
      const [firstTimersResult] = await pool.execute(
        'SELECT COUNT(*) as total FROM first_timers WHERE is_converted_to_member = FALSE'
      ) as any;
      firstTimersTotal = firstTimersResult[0]?.total || 0;

      const [convertedResult] = await pool.execute(
        `SELECT COUNT(*) as total FROM first_timers 
         WHERE is_converted_to_member = TRUE 
         AND MONTH(last_visit_date) = MONTH(CURDATE()) 
         AND YEAR(last_visit_date) = YEAR(CURDATE())`
      ) as any;
      convertedTotal = convertedResult[0]?.total || 0;
    } catch (e) {
      console.log('First timers table not accessible');
    }

    // Total attendance this month (wrapped in try-catch)
    let attendanceTotal = 0;
    let sundayAverage = 0;
    try {
      const [attendanceResult] = await pool.execute(
        `SELECT COUNT(*) as total FROM attendance 
         WHERE MONTH(service_date) = MONTH(CURDATE()) 
         AND YEAR(service_date) = YEAR(CURDATE())`
      ) as any;
      attendanceTotal = attendanceResult[0]?.total || 0;

      const [sundayAvgResult] = await pool.execute(
        `SELECT AVG(daily_count) as average FROM (
          SELECT COUNT(*) as daily_count 
          FROM attendance 
          WHERE service_type = 'sunday_service' 
          AND MONTH(service_date) = MONTH(CURDATE())
          GROUP BY service_date
        ) as daily_attendance`
      ) as any;
      sundayAverage = Math.round(sundayAvgResult[0]?.average || 0);
    } catch (e) {
      console.log('Attendance table not accessible');
    }

    // Total donations this month (wrapped in try-catch)
    let donationsTotal = 0;
    try {
      const [donationsResult] = await pool.execute(
        `SELECT SUM(amount) as total FROM donations 
         WHERE MONTH(created_at) = MONTH(CURDATE()) 
         AND YEAR(created_at) = YEAR(CURDATE())`
      ) as any;
      donationsTotal = donationsResult[0]?.total || 0;
    } catch (e) {
      console.log('Donations table not accessible');
    }

    // Upcoming events (wrapped in try-catch)
    let upcomingEventsTotal = 0;
    try {
      const [upcomingEvents] = await pool.execute(
        `SELECT COUNT(*) as total FROM events 
         WHERE date >= CURDATE() 
         AND date <= DATE_ADD(CURDATE(), INTERVAL 30 DAY)`
      ) as any;
      upcomingEventsTotal = upcomingEvents[0]?.total || 0;
    } catch (e) {
      console.log('Events table not accessible');
    }

    // Active prayer requests (wrapped in try-catch)
    let activePrayersTotal = 0;
    try {
      const [activePrayers] = await pool.execute(
        `SELECT COUNT(*) as total FROM prayer_requests 
         WHERE status = 'open'`
      ) as any;
      activePrayersTotal = activePrayers[0]?.total || 0;
    } catch (e) {
      console.log('Prayer requests table not accessible');
    }

    // Total posts this month
    let postsTotal = 0;
    try {
      const [postsResult] = await pool.execute(
        `SELECT COUNT(*) as total FROM feed_posts 
         WHERE MONTH(created_at) = MONTH(CURDATE()) 
         AND YEAR(created_at) = YEAR(CURDATE())`
      ) as any;
      postsTotal = postsResult[0]?.total || 0;
    } catch (e) {
      console.log('Feed posts table not accessible');
    }

    // Active chat groups (wrapped in try-catch)
    let groupsTotal = 0;
    try {
      const [groupsResult] = await pool.execute(
        'SELECT COUNT(*) as total FROM chat_groups WHERE is_active = TRUE'
      ) as any;
      groupsTotal = groupsResult[0]?.total || 0;
    } catch (e) {
      console.log('Chat groups table not accessible');
    }

    res.json({
      members: {
        byRole: members,
        total: members.reduce((sum: number, m: any) => sum + m.count, 0)
      },
      firstTimers: {
        active: firstTimersTotal,
        convertedThisMonth: convertedTotal
      },
      attendance: {
        totalThisMonth: attendanceTotal,
        sundayAverage: sundayAverage
      },
      donations: {
        totalThisMonth: donationsTotal
      },
      events: {
        upcoming: upcomingEventsTotal
      },
      prayers: {
        active: activePrayersTotal
      },
      community: {
        postsThisMonth: postsTotal,
        activeGroups: groupsTotal
      }
    });
  } catch (error: any) {
    console.error('Get stats error:', error);
    res.status(500).json({ message: 'Failed to get statistics', error: error.message });
  }
});

// Get event statistics
router.get('/events', authenticate, requirePermission('view_dashboard'), async (req, res) => {
  try {
    // Upcoming events with registration counts
    const [upcomingEvents] = await pool.execute(
      `SELECT e.*, 
       COUNT(DISTINCT er.id) as total_registrations,
       COUNT(DISTINCT CASE WHEN er.status = 'attended' THEN er.id END) as total_attended
       FROM events e
       LEFT JOIN event_registrations er ON e.id = er.event_id
       WHERE e.date >= CURDATE()
       GROUP BY e.id
       ORDER BY e.date ASC
       LIMIT 10`
    ) as any;

    // Past events with attendance
    const [pastEvents] = await pool.execute(
      `SELECT e.*, 
       COUNT(DISTINCT er.id) as total_registrations,
       COUNT(DISTINCT CASE WHEN er.status = 'attended' THEN er.id END) as total_attended
       FROM events e
       LEFT JOIN event_registrations er ON e.id = er.event_id
       WHERE e.date < CURDATE()
       GROUP BY e.id
       ORDER BY e.date DESC
       LIMIT 10`
    ) as any;

    // Events by category
    const [eventsByCategory] = await pool.execute(
      `SELECT category, COUNT(*) as count 
       FROM events 
       GROUP BY category`
    ) as any;

    res.json({
      upcoming: upcomingEvents,
      past: pastEvents,
      byCategory: eventsByCategory
    });
  } catch (error: any) {
    console.error('Get event stats error:', error);
    res.status(500).json({ message: 'Failed to get event statistics', error: error.message });
  }
});

// Get attendance statistics
router.get('/attendance', authenticate, requirePermission('view_attendance'), async (req, res) => {
  const { startDate, endDate, serviceType } = req.query;

  try {
    let query = `
      SELECT 
        service_date,
        service_type,
        COUNT(DISTINCT user_id) as member_count,
        COUNT(DISTINCT first_timer_id) as first_timer_count,
        COUNT(*) as total_count
      FROM attendance
      WHERE 1=1
    `;

    const params: any[] = [];

    if (startDate) {
      query += ' AND service_date >= ?';
      params.push(startDate);
    } else {
      // Default to last 30 days
      query += ' AND service_date >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)';
    }

    if (endDate) {
      query += ' AND service_date <= ?';
      params.push(endDate);
    }

    if (serviceType) {
      query += ' AND service_type = ?';
      params.push(serviceType);
    }

    query += ' GROUP BY service_date, service_type ORDER BY service_date DESC';

    const [attendance] = await pool.execute(query, params) as any;

    // Get totals by service type
    const [byServiceType] = await pool.execute(
      `SELECT service_type, COUNT(*) as count 
       FROM attendance 
       WHERE service_date >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)
       GROUP BY service_type`
    ) as any;

    // Get attendance trends (last 12 weeks)
    const [trends] = await pool.execute(
      `SELECT 
        YEARWEEK(service_date) as week,
        COUNT(*) as count
       FROM attendance
       WHERE service_date >= DATE_SUB(CURDATE(), INTERVAL 12 WEEK)
       GROUP BY week
       ORDER BY week ASC`
    ) as any;

    res.json({
      attendance,
      byServiceType,
      trends
    });
  } catch (error: any) {
    console.error('Get attendance stats error:', error);
    res.status(500).json({ message: 'Failed to get attendance statistics', error: error.message });
  }
});

// Get giving/donation statistics
router.get('/giving', authenticate, requirePermission('view_reports'), async (req, res) => {
  try {
    // Total donations by month (last 6 months)
    const [monthlyDonations] = await pool.execute(
      `SELECT 
        DATE_FORMAT(created_at, '%Y-%m') as month,
        SUM(amount) as total,
        COUNT(*) as count
       FROM donations
       WHERE created_at >= DATE_SUB(CURDATE(), INTERVAL 6 MONTH)
       GROUP BY month
       ORDER BY month ASC`
    ) as any;

    // Donations by type
    const [donationsByType] = await pool.execute(
      `SELECT donation_type, SUM(amount) as total, COUNT(*) as count 
       FROM donations 
       WHERE YEAR(created_at) = YEAR(CURDATE())
       GROUP BY donation_type`
    ) as any;

    // Top donors this year
    const [topDonors] = await pool.execute(
      `SELECT 
        u.id,
        CONCAT(u.first_name, ' ', u.last_name) as name,
        SUM(d.amount) as total_given,
        COUNT(d.id) as donation_count
       FROM donations d
       JOIN users u ON d.user_id = u.id
       WHERE YEAR(d.created_at) = YEAR(CURDATE())
       GROUP BY u.id
       ORDER BY total_given DESC
       LIMIT 10`
    ) as any;

    // This month summary
    const [thisMonth] = await pool.execute(
      `SELECT 
        SUM(amount) as total,
        COUNT(*) as count,
        AVG(amount) as average
       FROM donations
       WHERE MONTH(created_at) = MONTH(CURDATE())
       AND YEAR(created_at) = YEAR(CURDATE())`
    ) as any;

    res.json({
      monthlyTrends: monthlyDonations,
      byType: donationsByType,
      topDonors,
      thisMonth: thisMonth[0]
    });
  } catch (error: any) {
    console.error('Get giving stats error:', error);
    res.status(500).json({ message: 'Failed to get giving statistics', error: error.message });
  }
});

// Get department statistics
router.get('/departments', authenticate, requirePermission('view_dashboard'), async (req, res) => {
  try {
    // Members by department
    const [departmentMembers] = await pool.execute(
      `SELECT 
        departments,
        COUNT(*) as member_count
       FROM users
       WHERE departments IS NOT NULL
       AND is_approved = TRUE
       GROUP BY departments`
    ) as any;

    // Department groups activity
    const [groupActivity] = await pool.execute(
      `SELECT 
        cg.name,
        cg.type,
        COUNT(DISTINCT cgm.user_id) as member_count,
        COUNT(cm.id) as message_count,
        MAX(cm.created_at) as last_activity
       FROM chat_groups cg
       LEFT JOIN chat_group_members cgm ON cg.id = cgm.group_id
       LEFT JOIN chat_messages cm ON cg.id = cm.group_id
       WHERE cg.type = 'department'
       GROUP BY cg.id
       ORDER BY message_count DESC`
    ) as any;

    res.json({
      membersByDepartment: departmentMembers,
      groupActivity
    });
  } catch (error: any) {
    console.error('Get department stats error:', error);
    res.status(500).json({ message: 'Failed to get department statistics', error: error.message });
  }
});

// Get recent activity feed
router.get('/recent-activity', authenticate, requirePermission('view_dashboard'), async (req, res) => {
  try {
    // Recent registrations
    const [recentRegistrations] = await pool.execute(
      `SELECT 
        CONCAT(first_name, ' ', last_name) as name,
        role,
        created_at,
        'registration' as activity_type
       FROM users
       WHERE is_approved = TRUE
       ORDER BY created_at DESC
       LIMIT 5`
    ) as any;

    // Recent first-timers
    const [recentFirstTimers] = await pool.execute(
      `SELECT 
        CONCAT(first_name, ' ', last_name) as name,
        first_visit_date as created_at,
        sunday_attendance_count,
        'first_timer' as activity_type
       FROM first_timers
       ORDER BY first_visit_date DESC
       LIMIT 5`
    ) as any;

    // Recent posts
    const [recentPosts] = await pool.execute(
      `SELECT 
        fp.id,
        CONCAT(u.first_name, ' ', u.last_name) as name,
        fp.post_type,
        fp.created_at,
        'post' as activity_type
       FROM feed_posts fp
       JOIN users u ON fp.user_id = u.id
       ORDER BY fp.created_at DESC
       LIMIT 5`
    ) as any;

    // Recent prayer requests
    const [recentPrayers] = await pool.execute(
      `SELECT 
        pr.id,
        CONCAT(u.first_name, ' ', u.last_name) as name,
        pr.status,
        pr.created_at,
        'prayer' as activity_type
       FROM prayer_requests pr
       LEFT JOIN users u ON pr.user_id = u.id
       ORDER BY pr.created_at DESC
       LIMIT 5`
    ) as any;

    // Recent donations
    const [recentDonations] = await pool.execute(
      `SELECT 
        d.amount,
        d.donation_type,
        d.created_at,
        CONCAT(u.first_name, ' ', u.last_name) as name,
        'donation' as activity_type
       FROM donations d
       JOIN users u ON d.user_id = u.id
       ORDER BY d.created_at DESC
       LIMIT 5`
    ) as any;

    // Combine and sort all activities
    const allActivities = [
      ...recentRegistrations,
      ...recentFirstTimers,
      ...recentPosts,
      ...recentPrayers,
      ...recentDonations
    ].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .slice(0, 20);

    res.json(allActivities);
  } catch (error: any) {
    console.error('Get recent activity error:', error);
    res.status(500).json({ message: 'Failed to get recent activity', error: error.message });
  }
});

// Get growth metrics
router.get('/growth', authenticate, requirePermission('view_dashboard'), async (req, res) => {
  try {
    // Member growth (last 12 months)
    const [memberGrowth] = await pool.execute(
      `SELECT 
        DATE_FORMAT(created_at, '%Y-%m') as month,
        COUNT(*) as new_members
       FROM users
       WHERE is_approved = TRUE
       AND created_at >= DATE_SUB(CURDATE(), INTERVAL 12 MONTH)
       GROUP BY month
       ORDER BY month ASC`
    ) as any;

    // First-timer conversion rate
    const [conversionRate] = await pool.execute(
      `SELECT 
        COUNT(CASE WHEN is_converted_to_member = TRUE THEN 1 END) as converted,
        COUNT(*) as total,
        (COUNT(CASE WHEN is_converted_to_member = TRUE THEN 1 END) / COUNT(*) * 100) as rate
       FROM first_timers`
    ) as any;

    // Attendance growth
    const [attendanceGrowth] = await pool.execute(
      `SELECT 
        DATE_FORMAT(service_date, '%Y-%m') as month,
        COUNT(*) as count
       FROM attendance
       WHERE service_date >= DATE_SUB(CURDATE(), INTERVAL 12 MONTH)
       GROUP BY month
       ORDER BY month ASC`
    ) as any;

    // Donation growth
    const [donationGrowth] = await pool.execute(
      `SELECT 
        DATE_FORMAT(created_at, '%Y-%m') as month,
        SUM(amount) as total
       FROM donations
       WHERE created_at >= DATE_SUB(CURDATE(), INTERVAL 12 MONTH)
       GROUP BY month
       ORDER BY month ASC`
    ) as any;

    res.json({
      memberGrowth,
      conversionRate: conversionRate[0],
      attendanceGrowth,
      donationGrowth
    });
  } catch (error: any) {
    console.error('Get growth metrics error:', error);
    res.status(500).json({ message: 'Failed to get growth metrics', error: error.message });
  }
});

export default router;
