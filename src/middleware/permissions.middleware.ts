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
  head_media: 'media_head',
  head_admin: 'admin',
  church_admin: 'admin'
};

export const normalizeRole = (role?: string): string => {
  if (!role) return '';
  const normalized = role.toLowerCase().trim();
  return roleAliases[normalized] || normalized;
};

export const hasUnifiedLeadershipAccess = (role?: string): boolean => {
  const normalized = normalizeRole(role);
  return ['super_admin', 'admin', 'media_head', 'media'].includes(normalized);
};

// Role hierarchy (higher roles have all permissions of lower roles)
export const roleHierarchy = {
  'super_admin': 10,
  'admin': 10,
  'head_admin': 10,
  'media_head': 10,
  'head_media': 10,
  'media': 10,
  'pastor': 9,
  'elder': 8,
  'department_head': 7,
  'secretary': 6,
  'finance': 5,
  'deacon': 4,
  'choir': 2,
  'member': 1
};

// Permission definitions
export const permissions = {
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

  // Dashboard
  'view_dashboard': ['admin', 'super_admin', 'pastor', 'elder', 'secretary', 'media_head', 'department_head', 'finance', 'deacon', 'media'],
  
  // Audit logs
  'audit:view': ['super_admin', 'pastor', 'media_head']
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

// Check if user is executive (can download letterheads)
export const isExecutive = (userRole: string): boolean => {
  if (hasUnifiedLeadershipAccess(userRole)) return true;
  const executiveRoles = ['super_admin', 'admin', 'pastor', 'elder', 'secretary', 'media_head', 'media', 'department_head', 'finance', 'deacon'];
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
export const requireAdmin = requireRole(['super_admin', 'pastor', 'elder']);

// Middleware for super admin only
export const requireSuperAdmin = requireRole('super_admin');

// Check if user can access department resources
export const canAccessDepartment = (userDepartments: string[], requiredDepartment: string): boolean => {
  return userDepartments.includes(requiredDepartment);
};
