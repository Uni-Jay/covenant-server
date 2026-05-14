import { Request, Response, NextFunction } from 'express';
import pool from '../config/database';

export interface AuthRequest extends Request {
  user?: {
    id: number;
    email: string;
    role: string;
    departments?: string[];
  };
}

const roleAliases: Record<string, string> = {
  head_media: 'media',
  media_head: 'media',
  head_admin: 'admin',
  church_admin: 'admin',
  super_admin: 'admin'
};

export const normalizeRole = (role?: string): string => {
  if (!role) return '';
  const normalized = role.toLowerCase().trim();
  return roleAliases[normalized] || normalized;
};

export const hasUnifiedLeadershipAccess = (role?: string): boolean => {
  const normalized = normalizeRole(role);
  return ['super_admin', 'admin', 'gen_overseer', 'senior_pastor', 'pastor', 'church_committee_chairman'].includes(normalized);
};

// Role hierarchy (higher roles have all permissions of lower roles)
// Church-wide roles
export const roleHierarchy = {
  'super_admin': 12,                // Super administrator (highest level - has all admin & media permissions)
  'admin': 11,                      // System administrator (highest technical level)
  'head_admin': 11,                 // Alias
  'gen_overseer': 10,               // General Overseer (highest church authority)
  'senior_pastor': 9,               // Senior Pastor
  'pastor': 8,                      // Pastor
  'church_committee_chairman': 7,   // Church committee chairman
  'church_committee_secretary': 6,  // Church committee secretary
  'treasurer': 5,                   // Treasurer
  'pro': 4,                         // Public Relation Officer
  'secretary': 3,                   // Secretary
  'media': 2,                       // Media officer
  'coordinator': 1.5,               // Department coordinator
  'assistant_coordinator': 1.2,     // Assistant coordinator
  'member': 1                       // Default member (no special access)
};

// Permission definitions
// New role structure:
// - admin: System administrator
// - gen_overseer, senior_pastor, pastor: Church leadership
// - church_committee_chairman, church_committee_secretary, secretary, treasurer, pro, media: Church officers
// - coordinator, assistant_coordinator: Department officers
// - member: Default (no permissions)
export const permissions = {
  // User management
  'user:create': ['super_admin', 'admin', 'gen_overseer', 'senior_pastor', 'pastor'],
  'user:read': ['super_admin', 'admin', 'gen_overseer', 'senior_pastor', 'pastor', 'church_committee_chairman', 'secretary'],
  'user:update': ['super_admin', 'admin', 'gen_overseer', 'senior_pastor', 'pastor'],
  'user:delete': ['super_admin', 'admin', 'gen_overseer'],
  'user:approve': ['super_admin', 'admin', 'gen_overseer', 'senior_pastor', 'pastor'],
  
  // Church email management (executives only)
  'church_email:create': ['super_admin', 'admin', 'gen_overseer', 'senior_pastor', 'pastor', 'media'],
  'church_email:reset': ['super_admin', 'admin', 'gen_overseer', 'senior_pastor', 'pastor', 'media'],
  'church_email:delete': ['super_admin', 'admin', 'gen_overseer', 'senior_pastor', 'pastor', 'media'],
  'church_email:view': ['super_admin', 'admin', 'gen_overseer', 'senior_pastor', 'pastor', 'media'],
  
  // Blog management
  'blog:create': ['super_admin', 'admin', 'gen_overseer', 'senior_pastor', 'pastor', 'media', 'pro'],
  'blog:update': ['super_admin', 'admin', 'gen_overseer', 'senior_pastor', 'pastor', 'media', 'pro'],
  'blog:delete': ['super_admin', 'admin', 'gen_overseer', 'senior_pastor', 'pastor', 'media'],
  'blog:publish': ['super_admin', 'admin', 'gen_overseer', 'senior_pastor', 'pastor', 'media'],
  
  // Event management
  'event:create': ['super_admin', 'admin', 'gen_overseer', 'senior_pastor', 'pastor', 'secretary', 'coordinator'],
  'event:update': ['super_admin', 'admin', 'gen_overseer', 'senior_pastor', 'pastor', 'secretary', 'coordinator'],
  'event:delete': ['super_admin', 'admin', 'gen_overseer', 'senior_pastor', 'pastor'],
  'event:attendance': ['super_admin', 'admin', 'gen_overseer', 'senior_pastor', 'pastor', 'secretary', 'coordinator'],
  
  // Financial management
  'finance:view': ['super_admin', 'admin', 'gen_overseer', 'senior_pastor', 'pastor', 'treasurer'],
  'finance:create': ['super_admin', 'admin', 'gen_overseer', 'senior_pastor', 'pastor', 'treasurer'],
  'finance:update': ['super_admin', 'admin', 'gen_overseer', 'senior_pastor', 'pastor', 'treasurer'],
  'finance:delete': ['super_admin', 'admin', 'gen_overseer', 'senior_pastor', 'pastor', 'treasurer'],
  'finance:report': ['super_admin', 'admin', 'gen_overseer', 'senior_pastor', 'pastor', 'treasurer'],
  
  // Media management
  'media:upload': ['super_admin', 'admin', 'gen_overseer', 'senior_pastor', 'pastor', 'media'],
  'media:delete': ['super_admin', 'admin', 'gen_overseer', 'senior_pastor', 'pastor', 'media'],
  'media:livestream': ['super_admin', 'admin', 'gen_overseer', 'senior_pastor', 'pastor', 'media'],
  'media:sermon_upload': ['super_admin', 'admin', 'gen_overseer', 'senior_pastor', 'pastor', 'media'],
  'media:gallery_upload': ['super_admin', 'admin', 'gen_overseer', 'senior_pastor', 'pastor', 'media'],
  'media:event_upload': ['super_admin', 'admin', 'gen_overseer', 'senior_pastor', 'pastor', 'media'],
  
  // Department management
  'department:create': ['super_admin', 'admin', 'gen_overseer', 'senior_pastor', 'pastor'],
  'department:update': ['super_admin', 'admin', 'gen_overseer', 'senior_pastor', 'pastor', 'coordinator'],
  'department:view': ['super_admin', 'admin', 'gen_overseer', 'senior_pastor', 'pastor', 'secretary', 'coordinator', 'assistant_coordinator'],
  
  // Sermon management
  'sermon:create': ['super_admin', 'admin', 'gen_overseer', 'senior_pastor', 'pastor', 'media'],
  'sermon:update': ['super_admin', 'admin', 'gen_overseer', 'senior_pastor', 'pastor', 'media'],
  'sermon:delete': ['super_admin', 'admin', 'gen_overseer', 'senior_pastor', 'pastor'],
  
  // Prayer requests
  'prayer:moderate': ['super_admin', 'admin', 'gen_overseer', 'senior_pastor', 'pastor', 'media'],
  'prayer:delete': ['super_admin', 'admin', 'gen_overseer', 'senior_pastor', 'pastor'],
  
  // Counseling
  'counseling:schedule': ['super_admin', 'admin', 'gen_overseer', 'senior_pastor', 'pastor'],
  'counseling:view': ['super_admin', 'admin', 'gen_overseer', 'senior_pastor', 'pastor'],
  
  // Documents & Letterheads
  'document:create': ['super_admin', 'admin', 'gen_overseer', 'senior_pastor', 'pastor', 'secretary', 'treasurer'],
  'document:delete': ['super_admin', 'admin', 'gen_overseer', 'senior_pastor', 'pastor'],
  'document:download': ['super_admin', 'admin', 'gen_overseer', 'senior_pastor', 'pastor', 'church_committee_chairman', 'church_committee_secretary', 'secretary', 'treasurer', 'pro', 'media', 'coordinator'],
  'document:view': ['super_admin', 'admin', 'gen_overseer', 'senior_pastor', 'pastor', 'church_committee_chairman', 'church_committee_secretary', 'secretary', 'treasurer', 'pro', 'media', 'coordinator', 'assistant_coordinator'],
  
  // Feed/Posts
  'feed:moderate': ['super_admin', 'admin', 'gen_overseer', 'senior_pastor', 'pastor', 'media', 'pro'],
  'feed:pin': ['super_admin', 'admin', 'gen_overseer', 'senior_pastor', 'pastor', 'media'],
  'feed:post': ['all'], // Everyone can post
  
  // Hymns
  'hymn:create': ['super_admin', 'admin', 'gen_overseer', 'senior_pastor', 'pastor', 'media', 'coordinator'],
  'hymn:setlist': ['super_admin', 'admin', 'gen_overseer', 'senior_pastor', 'pastor', 'media'],
  
  // Attendance
  'attendance:view': ['super_admin', 'admin', 'gen_overseer', 'senior_pastor', 'pastor', 'secretary', 'coordinator'],
  'attendance:export': ['super_admin', 'admin', 'gen_overseer', 'senior_pastor', 'pastor', 'secretary'],

  // Dashboard
  'view_dashboard': ['super_admin', 'admin', 'gen_overseer', 'senior_pastor', 'pastor', 'church_committee_chairman', 'church_committee_secretary', 'secretary', 'treasurer', 'pro', 'media', 'coordinator'],
  
  // Audit logs
  'audit:view': ['super_admin', 'admin', 'gen_overseer', 'senior_pastor', 'pastor', 'media']
};

// Check if user has Media department (super admin access)
export const hasMediaDepartment = async (userId: number): Promise<boolean> => {
  try {
    console.log('🔍 hasMediaDepartment - Checking for userId:', userId);
    const [users] = await pool.execute(
      'SELECT departments FROM users WHERE id = ?',
      [userId]
    ) as any;
    
    if (users.length === 0) {
      console.log('❌ User not found');
      return false;
    }
    
    const user = users[0];
    console.log('📋 User departments (raw):', user.departments, 'Type:', typeof user.departments);
    
    let departments = [];
    
    if (user.departments) {
      if (Array.isArray(user.departments)) {
        departments = user.departments;
        console.log('✅ Already array:', departments);
      } else if (typeof user.departments === 'string') {
        try {
          departments = JSON.parse(user.departments);
          console.log('✅ Parsed JSON:', departments);
        } catch {
          departments = user.departments.split(',').map((d: string) => d.trim());
          console.log('✅ Split by comma:', departments);
        }
      }
    }
    
    console.log('🔍 Final departments array:', departments);
    
    // Check if any department includes 'media' (case-insensitive)
    const hasMedia = departments.some((d: string) => {
      const matches = d.toLowerCase().trim().includes('media');
      console.log(`  - Checking "${d}": ${matches}`);
      return matches;
    });
    
    console.log('✅ Final result - Has Media:', hasMedia);
    return hasMedia;
  } catch (error) {
    console.error('❌ Error checking media department:', error);
    return false;
  }
};

// Check if user has a specific permission
export const hasPermission = (userRole: string, permission: string): boolean => {
  const normalizedUserRole = normalizeRole(userRole);
  const allowedRoles = permissions[permission as keyof typeof permissions];
  if (!allowedRoles) return false;
  if (hasUnifiedLeadershipAccess(normalizedUserRole)) return true;
  if (allowedRoles.includes('all')) return true; // Everyone has access
  return allowedRoles.map((role) => normalizeRole(role)).includes(normalizedUserRole);
};

// Check if user is executive (can download letterheads, access admin features)
export const isExecutive = (userRole: string): boolean => {
  if (hasUnifiedLeadershipAccess(userRole)) return true;
  const executiveRoles = ['super_admin', 'admin', 'gen_overseer', 'senior_pastor', 'pastor', 'church_committee_chairman', 'church_committee_secretary', 'secretary', 'treasurer', 'pro', 'media', 'coordinator'];
  return executiveRoles.map((role) => normalizeRole(role)).includes(normalizeRole(userRole));
};

// Check if user's role is equal or higher than required role
export const hasRoleLevel = (userRole: string, requiredRole: string): boolean => {
  if (hasUnifiedLeadershipAccess(userRole)) return true;
  const normalizedUserRole = normalizeRole(userRole);
  const normalizedRequiredRole = normalizeRole(requiredRole);
  const userLevel = roleHierarchy[normalizedUserRole as keyof typeof roleHierarchy] || 0;
  const requiredLevel = roleHierarchy[normalizedRequiredRole as keyof typeof roleHierarchy] || 0;
  return userLevel >= requiredLevel;
};

// Middleware to check if user has required permission
export const requirePermission = (permission: string) => {
  return async (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Anyone with Media department has all permissions
    const isMedia = await hasMediaDepartment(req.user.id);
    if (isMedia) {
      return next();
    }

    if (!hasPermission(normalizeRole(req.user.role), permission)) {
      return res.status(403).json({ 
        error: 'Forbidden', 
        message: `You don't have permission to ${permission}` 
      });
    }

    next();
  };
};

// Middleware to check if user has required role or higher
export const requireRole = (requiredRole: string | string[]) => {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const roles = Array.isArray(requiredRole) ? requiredRole : [requiredRole];
    
    const normalizedUserRole = normalizeRole(req.user!.role);
    const hasAccess = roles.some(role => {
      const normalizedRequiredRole = normalizeRole(role);
      return hasRoleLevel(normalizedUserRole, normalizedRequiredRole) || normalizedUserRole === normalizedRequiredRole;
    }
    );

    if (!hasAccess) {
      return res.status(403).json({ 
        error: 'Forbidden', 
        message: `This action requires ${roles.join(' or ')} role` 
      });
    }

    next();
  };
};

// Middleware for admin-only routes
export const requireAdmin = requireRole(['super_admin', 'admin', 'gen_overseer', 'senior_pastor', 'pastor', 'church_committee_chairman']);

// Middleware for super admin only (now super_admin and admin with full system control)
export const requireSuperAdmin = requireRole(['super_admin', 'admin']);

// Check if user can access department resources
export const canAccessDepartment = (userDepartments: string[], requiredDepartment: string): boolean => {
  return userDepartments.includes(requiredDepartment);
};
