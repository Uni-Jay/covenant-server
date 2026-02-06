"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.canAccessDepartment = exports.requireSuperAdmin = exports.requireAdmin = exports.requireRole = exports.requirePermission = exports.hasRoleLevel = exports.isExecutive = exports.hasPermission = exports.hasMediaDepartment = exports.permissions = exports.roleHierarchy = void 0;
const database_1 = __importDefault(require("../config/database"));
// Role hierarchy (higher roles have all permissions of lower roles)
exports.roleHierarchy = {
    'super_admin': 10,
    'pastor': 9,
    'elder': 8,
    'media_head': 7,
    'department_head': 7,
    'secretary': 6,
    'finance': 5,
    'deacon': 4,
    'media': 3,
    'choir': 2,
    'member': 1
};
// Permission definitions
exports.permissions = {
    // User management
    'user:create': ['super_admin', 'secretary'],
    'user:read': ['super_admin', 'pastor', 'elder', 'secretary', 'department_head', 'media_head'],
    'user:update': ['super_admin', 'secretary'],
    'user:delete': ['super_admin'],
    'user:approve': ['super_admin', 'pastor', 'secretary'],
    // Church email management (executives only)
    'church_email:create': ['super_admin', 'media_head'],
    'church_email:reset': ['super_admin', 'media_head'],
    'church_email:delete': ['super_admin', 'media_head'],
    'church_email:view': ['super_admin', 'pastor', 'media_head'],
    // Blog management
    'blog:create': ['super_admin', 'pastor', 'elder', 'media_head', 'media'],
    'blog:update': ['super_admin', 'pastor', 'elder', 'media_head', 'media'],
    'blog:delete': ['super_admin', 'pastor', 'media_head'],
    'blog:publish': ['super_admin', 'pastor', 'media_head'],
    // Event management
    'event:create': ['super_admin', 'pastor', 'elder', 'secretary'],
    'event:update': ['super_admin', 'pastor', 'elder', 'secretary'],
    'event:delete': ['super_admin', 'pastor'],
    'event:attendance': ['super_admin', 'pastor', 'elder', 'secretary'],
    // Financial management
    'finance:view': ['super_admin', 'pastor', 'finance'],
    'finance:create': ['super_admin', 'finance'],
    'finance:update': ['super_admin', 'finance'],
    'finance:delete': ['super_admin', 'finance'],
    'finance:report': ['super_admin', 'pastor', 'finance'],
    // Media management (media_head has admin rights, regular media limited)
    'media:upload': ['super_admin', 'media_head', 'media', 'pastor'],
    'media:delete': ['super_admin', 'media_head'],
    'media:livestream': ['super_admin', 'media_head', 'media'],
    'media:sermon_upload': ['super_admin', 'media_head', 'media', 'pastor'],
    'media:gallery_upload': ['super_admin', 'media_head', 'media'],
    'media:event_upload': ['super_admin', 'media_head', 'media'],
    // Department management
    'department:create': ['super_admin', 'pastor', 'department_head'],
    'department:update': ['super_admin', 'pastor', 'department_head'],
    'department:view': ['super_admin', 'pastor', 'elder', 'department_head', 'secretary', 'media_head'],
    // Sermon management
    'sermon:create': ['super_admin', 'pastor', 'elder'],
    'sermon:update': ['super_admin', 'pastor', 'elder'],
    'sermon:delete': ['super_admin', 'pastor'],
    // Prayer requests
    'prayer:moderate': ['super_admin', 'pastor', 'elder'],
    'prayer:delete': ['super_admin', 'pastor'],
    // Counseling
    'counseling:schedule': ['super_admin', 'pastor', 'elder'],
    'counseling:view': ['super_admin', 'pastor', 'elder'],
    // Documents & Letterheads (executives only can download)
    'document:create': ['super_admin', 'secretary'],
    'document:delete': ['super_admin', 'secretary'],
    'document:download': ['super_admin', 'pastor', 'elder', 'secretary', 'media_head', 'department_head', 'finance', 'deacon'],
    'document:view': ['super_admin', 'pastor', 'elder', 'secretary', 'media_head', 'department_head', 'finance', 'deacon'],
    // Feed/Posts (all can post, but moderation limited)
    'feed:moderate': ['super_admin', 'pastor', 'elder', 'media_head'],
    'feed:pin': ['super_admin', 'pastor', 'media_head'],
    'feed:post': ['all'], // Everyone can post
    // Hymns
    'hymn:create': ['super_admin', 'choir', 'media_head', 'media'],
    'hymn:setlist': ['super_admin', 'choir'],
    // Attendance
    'attendance:view': ['super_admin', 'pastor', 'elder', 'secretary'],
    'attendance:export': ['super_admin', 'pastor', 'secretary'],
    // Audit logs
    'audit:view': ['super_admin', 'pastor', 'media_head']
};
// Check if user has Media department (super admin access)
const hasMediaDepartment = async (userId) => {
    try {
        const [users] = await database_1.default.execute('SELECT departments FROM users WHERE id = ?', [userId]);
        if (users.length === 0)
            return false;
        const user = users[0];
        let departments = [];
        if (user.departments) {
            if (Array.isArray(user.departments)) {
                departments = user.departments;
            }
            else if (typeof user.departments === 'string') {
                try {
                    departments = JSON.parse(user.departments);
                }
                catch {
                    departments = user.departments.split(',').map((d) => d.trim());
                }
            }
        }
        return departments.some((d) => d.toLowerCase() === 'media');
    }
    catch (error) {
        return false;
    }
};
exports.hasMediaDepartment = hasMediaDepartment;
// Check if user has a specific permission
const hasPermission = (userRole, permission) => {
    const allowedRoles = exports.permissions[permission];
    if (!allowedRoles)
        return false;
    if (allowedRoles.includes('all'))
        return true; // Everyone has access
    return allowedRoles.includes(userRole);
};
exports.hasPermission = hasPermission;
// Check if user is executive (can download letterheads)
const isExecutive = (userRole) => {
    const executiveRoles = ['super_admin', 'admin', 'pastor', 'elder', 'secretary', 'media_head', 'media', 'department_head', 'finance', 'deacon'];
    return executiveRoles.includes(userRole);
};
exports.isExecutive = isExecutive;
// Check if user's role is equal or higher than required role
const hasRoleLevel = (userRole, requiredRole) => {
    const userLevel = exports.roleHierarchy[userRole] || 0;
    const requiredLevel = exports.roleHierarchy[requiredRole] || 0;
    return userLevel >= requiredLevel;
};
exports.hasRoleLevel = hasRoleLevel;
// Middleware to check if user has required permission
const requirePermission = (permission) => {
    return async (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({ error: 'Unauthorized' });
        }
        // Anyone with Media department has all permissions
        const isMedia = await (0, exports.hasMediaDepartment)(req.user.id);
        if (isMedia) {
            return next();
        }
        if (!(0, exports.hasPermission)(req.user.role, permission)) {
            return res.status(403).json({
                error: 'Forbidden',
                message: `You don't have permission to ${permission}`
            });
        }
        next();
    };
};
exports.requirePermission = requirePermission;
// Middleware to check if user has required role or higher
const requireRole = (requiredRole) => {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({ error: 'Unauthorized' });
        }
        const roles = Array.isArray(requiredRole) ? requiredRole : [requiredRole];
        const hasAccess = roles.some(role => (0, exports.hasRoleLevel)(req.user.role, role) || req.user.role === role);
        if (!hasAccess) {
            return res.status(403).json({
                error: 'Forbidden',
                message: `This action requires ${roles.join(' or ')} role`
            });
        }
        next();
    };
};
exports.requireRole = requireRole;
// Middleware for admin-only routes
exports.requireAdmin = (0, exports.requireRole)(['super_admin', 'pastor', 'elder']);
// Middleware for super admin only
exports.requireSuperAdmin = (0, exports.requireRole)('super_admin');
// Check if user can access department resources
const canAccessDepartment = (userDepartments, requiredDepartment) => {
    return userDepartments.includes(requiredDepartment);
};
exports.canAccessDepartment = canAccessDepartment;
