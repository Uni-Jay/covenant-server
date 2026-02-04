"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const auth_middleware_1 = require("../middleware/auth.middleware");
const permissions_middleware_1 = require("../middleware/permissions.middleware");
const database_1 = __importDefault(require("../config/database"));
const router = express_1.default.Router();
// Get overall statistics
router.get('/stats', auth_middleware_1.authenticate, (0, permissions_middleware_1.requirePermission)('view_dashboard'), async (req, res) => {
    try {
        // Total members by role
        const [members] = await database_1.default.execute(`SELECT role, COUNT(*) as count 
       FROM users 
       WHERE is_approved = TRUE 
       GROUP BY role`);
        // Total first-timers
        const [firstTimersResult] = await database_1.default.execute('SELECT COUNT(*) as total FROM first_timers WHERE is_converted_to_member = FALSE');
        // Converted first-timers this month
        const [convertedResult] = await database_1.default.execute(`SELECT COUNT(*) as total FROM first_timers 
       WHERE is_converted_to_member = TRUE 
       AND MONTH(last_visit_date) = MONTH(CURDATE()) 
       AND YEAR(last_visit_date) = YEAR(CURDATE())`);
        // Total attendance this month
        const [attendanceResult] = await database_1.default.execute(`SELECT COUNT(*) as total FROM attendance 
       WHERE MONTH(service_date) = MONTH(CURDATE()) 
       AND YEAR(service_date) = YEAR(CURDATE())`);
        // Sunday service attendance average
        const [sundayAvgResult] = await database_1.default.execute(`SELECT AVG(daily_count) as average FROM (
        SELECT COUNT(*) as daily_count 
        FROM attendance 
        WHERE service_type = 'sunday_service' 
        AND MONTH(service_date) = MONTH(CURDATE())
        GROUP BY service_date
      ) as daily_attendance`);
        // Total donations this month
        const [donationsResult] = await database_1.default.execute(`SELECT SUM(amount) as total FROM donations 
       WHERE MONTH(created_at) = MONTH(CURDATE()) 
       AND YEAR(created_at) = YEAR(CURDATE())`);
        // Upcoming events
        const [upcomingEvents] = await database_1.default.execute(`SELECT COUNT(*) as total FROM events 
       WHERE date >= CURDATE() 
       AND date <= DATE_ADD(CURDATE(), INTERVAL 30 DAY)`);
        // Active prayer requests
        const [activePrayers] = await database_1.default.execute(`SELECT COUNT(*) as total FROM prayer_requests 
       WHERE status = 'open'`);
        // Total posts this month
        const [postsResult] = await database_1.default.execute(`SELECT COUNT(*) as total FROM feed_posts 
       WHERE MONTH(created_at) = MONTH(CURDATE()) 
       AND YEAR(created_at) = YEAR(CURDATE())`);
        // Active chat groups
        const [groupsResult] = await database_1.default.execute('SELECT COUNT(*) as total FROM chat_groups WHERE is_active = TRUE');
        res.json({
            members: {
                byRole: members,
                total: members.reduce((sum, m) => sum + m.count, 0)
            },
            firstTimers: {
                active: firstTimersResult[0].total,
                convertedThisMonth: convertedResult[0].total
            },
            attendance: {
                totalThisMonth: attendanceResult[0].total,
                sundayAverage: Math.round(sundayAvgResult[0].average || 0)
            },
            donations: {
                totalThisMonth: donationsResult[0].total || 0
            },
            events: {
                upcoming: upcomingEvents[0].total
            },
            prayers: {
                active: activePrayers[0].total
            },
            community: {
                postsThisMonth: postsResult[0].total,
                activeGroups: groupsResult[0].total
            }
        });
    }
    catch (error) {
        console.error('Get stats error:', error);
        res.status(500).json({ message: 'Failed to get statistics', error: error.message });
    }
});
// Get event statistics
router.get('/events', auth_middleware_1.authenticate, (0, permissions_middleware_1.requirePermission)('view_dashboard'), async (req, res) => {
    try {
        // Upcoming events with registration counts
        const [upcomingEvents] = await database_1.default.execute(`SELECT e.*, 
       COUNT(DISTINCT er.id) as total_registrations,
       COUNT(DISTINCT CASE WHEN er.status = 'attended' THEN er.id END) as total_attended
       FROM events e
       LEFT JOIN event_registrations er ON e.id = er.event_id
       WHERE e.date >= CURDATE()
       GROUP BY e.id
       ORDER BY e.date ASC
       LIMIT 10`);
        // Past events with attendance
        const [pastEvents] = await database_1.default.execute(`SELECT e.*, 
       COUNT(DISTINCT er.id) as total_registrations,
       COUNT(DISTINCT CASE WHEN er.status = 'attended' THEN er.id END) as total_attended
       FROM events e
       LEFT JOIN event_registrations er ON e.id = er.event_id
       WHERE e.date < CURDATE()
       GROUP BY e.id
       ORDER BY e.date DESC
       LIMIT 10`);
        // Events by category
        const [eventsByCategory] = await database_1.default.execute(`SELECT category, COUNT(*) as count 
       FROM events 
       GROUP BY category`);
        res.json({
            upcoming: upcomingEvents,
            past: pastEvents,
            byCategory: eventsByCategory
        });
    }
    catch (error) {
        console.error('Get event stats error:', error);
        res.status(500).json({ message: 'Failed to get event statistics', error: error.message });
    }
});
// Get attendance statistics
router.get('/attendance', auth_middleware_1.authenticate, (0, permissions_middleware_1.requirePermission)('view_attendance'), async (req, res) => {
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
        const params = [];
        if (startDate) {
            query += ' AND service_date >= ?';
            params.push(startDate);
        }
        else {
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
        const [attendance] = await database_1.default.execute(query, params);
        // Get totals by service type
        const [byServiceType] = await database_1.default.execute(`SELECT service_type, COUNT(*) as count 
       FROM attendance 
       WHERE service_date >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)
       GROUP BY service_type`);
        // Get attendance trends (last 12 weeks)
        const [trends] = await database_1.default.execute(`SELECT 
        YEARWEEK(service_date) as week,
        COUNT(*) as count
       FROM attendance
       WHERE service_date >= DATE_SUB(CURDATE(), INTERVAL 12 WEEK)
       GROUP BY week
       ORDER BY week ASC`);
        res.json({
            attendance,
            byServiceType,
            trends
        });
    }
    catch (error) {
        console.error('Get attendance stats error:', error);
        res.status(500).json({ message: 'Failed to get attendance statistics', error: error.message });
    }
});
// Get giving/donation statistics
router.get('/giving', auth_middleware_1.authenticate, (0, permissions_middleware_1.requirePermission)('view_reports'), async (req, res) => {
    try {
        // Total donations by month (last 6 months)
        const [monthlyDonations] = await database_1.default.execute(`SELECT 
        DATE_FORMAT(created_at, '%Y-%m') as month,
        SUM(amount) as total,
        COUNT(*) as count
       FROM donations
       WHERE created_at >= DATE_SUB(CURDATE(), INTERVAL 6 MONTH)
       GROUP BY month
       ORDER BY month ASC`);
        // Donations by type
        const [donationsByType] = await database_1.default.execute(`SELECT donation_type, SUM(amount) as total, COUNT(*) as count 
       FROM donations 
       WHERE YEAR(created_at) = YEAR(CURDATE())
       GROUP BY donation_type`);
        // Top donors this year
        const [topDonors] = await database_1.default.execute(`SELECT 
        u.id,
        CONCAT(u.first_name, ' ', u.last_name) as name,
        SUM(d.amount) as total_given,
        COUNT(d.id) as donation_count
       FROM donations d
       JOIN users u ON d.user_id = u.id
       WHERE YEAR(d.created_at) = YEAR(CURDATE())
       GROUP BY u.id
       ORDER BY total_given DESC
       LIMIT 10`);
        // This month summary
        const [thisMonth] = await database_1.default.execute(`SELECT 
        SUM(amount) as total,
        COUNT(*) as count,
        AVG(amount) as average
       FROM donations
       WHERE MONTH(created_at) = MONTH(CURDATE())
       AND YEAR(created_at) = YEAR(CURDATE())`);
        res.json({
            monthlyTrends: monthlyDonations,
            byType: donationsByType,
            topDonors,
            thisMonth: thisMonth[0]
        });
    }
    catch (error) {
        console.error('Get giving stats error:', error);
        res.status(500).json({ message: 'Failed to get giving statistics', error: error.message });
    }
});
// Get department statistics
router.get('/departments', auth_middleware_1.authenticate, (0, permissions_middleware_1.requirePermission)('view_dashboard'), async (req, res) => {
    try {
        // Members by department
        const [departmentMembers] = await database_1.default.execute(`SELECT 
        departments,
        COUNT(*) as member_count
       FROM users
       WHERE departments IS NOT NULL
       AND is_approved = TRUE
       GROUP BY departments`);
        // Department groups activity
        const [groupActivity] = await database_1.default.execute(`SELECT 
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
       ORDER BY message_count DESC`);
        res.json({
            membersByDepartment: departmentMembers,
            groupActivity
        });
    }
    catch (error) {
        console.error('Get department stats error:', error);
        res.status(500).json({ message: 'Failed to get department statistics', error: error.message });
    }
});
// Get recent activity feed
router.get('/recent-activity', auth_middleware_1.authenticate, (0, permissions_middleware_1.requirePermission)('view_dashboard'), async (req, res) => {
    try {
        // Recent registrations
        const [recentRegistrations] = await database_1.default.execute(`SELECT 
        CONCAT(first_name, ' ', last_name) as name,
        role,
        created_at,
        'registration' as activity_type
       FROM users
       WHERE is_approved = TRUE
       ORDER BY created_at DESC
       LIMIT 5`);
        // Recent first-timers
        const [recentFirstTimers] = await database_1.default.execute(`SELECT 
        CONCAT(first_name, ' ', last_name) as name,
        first_visit_date as created_at,
        sunday_attendance_count,
        'first_timer' as activity_type
       FROM first_timers
       ORDER BY first_visit_date DESC
       LIMIT 5`);
        // Recent posts
        const [recentPosts] = await database_1.default.execute(`SELECT 
        fp.id,
        CONCAT(u.first_name, ' ', u.last_name) as name,
        fp.post_type,
        fp.created_at,
        'post' as activity_type
       FROM feed_posts fp
       JOIN users u ON fp.user_id = u.id
       ORDER BY fp.created_at DESC
       LIMIT 5`);
        // Recent prayer requests
        const [recentPrayers] = await database_1.default.execute(`SELECT 
        pr.id,
        CONCAT(u.first_name, ' ', u.last_name) as name,
        pr.status,
        pr.created_at,
        'prayer' as activity_type
       FROM prayer_requests pr
       LEFT JOIN users u ON pr.user_id = u.id
       ORDER BY pr.created_at DESC
       LIMIT 5`);
        // Recent donations
        const [recentDonations] = await database_1.default.execute(`SELECT 
        d.amount,
        d.donation_type,
        d.created_at,
        CONCAT(u.first_name, ' ', u.last_name) as name,
        'donation' as activity_type
       FROM donations d
       JOIN users u ON d.user_id = u.id
       ORDER BY d.created_at DESC
       LIMIT 5`);
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
    }
    catch (error) {
        console.error('Get recent activity error:', error);
        res.status(500).json({ message: 'Failed to get recent activity', error: error.message });
    }
});
// Get growth metrics
router.get('/growth', auth_middleware_1.authenticate, (0, permissions_middleware_1.requirePermission)('view_dashboard'), async (req, res) => {
    try {
        // Member growth (last 12 months)
        const [memberGrowth] = await database_1.default.execute(`SELECT 
        DATE_FORMAT(created_at, '%Y-%m') as month,
        COUNT(*) as new_members
       FROM users
       WHERE is_approved = TRUE
       AND created_at >= DATE_SUB(CURDATE(), INTERVAL 12 MONTH)
       GROUP BY month
       ORDER BY month ASC`);
        // First-timer conversion rate
        const [conversionRate] = await database_1.default.execute(`SELECT 
        COUNT(CASE WHEN is_converted_to_member = TRUE THEN 1 END) as converted,
        COUNT(*) as total,
        (COUNT(CASE WHEN is_converted_to_member = TRUE THEN 1 END) / COUNT(*) * 100) as rate
       FROM first_timers`);
        // Attendance growth
        const [attendanceGrowth] = await database_1.default.execute(`SELECT 
        DATE_FORMAT(service_date, '%Y-%m') as month,
        COUNT(*) as count
       FROM attendance
       WHERE service_date >= DATE_SUB(CURDATE(), INTERVAL 12 MONTH)
       GROUP BY month
       ORDER BY month ASC`);
        // Donation growth
        const [donationGrowth] = await database_1.default.execute(`SELECT 
        DATE_FORMAT(created_at, '%Y-%m') as month,
        SUM(amount) as total
       FROM donations
       WHERE created_at >= DATE_SUB(CURDATE(), INTERVAL 12 MONTH)
       GROUP BY month
       ORDER BY month ASC`);
        res.json({
            memberGrowth,
            conversionRate: conversionRate[0],
            attendanceGrowth,
            donationGrowth
        });
    }
    catch (error) {
        console.error('Get growth metrics error:', error);
        res.status(500).json({ message: 'Failed to get growth metrics', error: error.message });
    }
});
exports.default = router;
