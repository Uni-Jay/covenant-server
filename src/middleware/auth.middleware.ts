import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

export interface AuthRequest extends Request {
  user?: any;
}

export const authenticate = (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    
    if (!token) {
      return res.status(401).json({ message: 'No token provided' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'secret');
    req.user = decoded;
    next();
  } catch (error) {
    return res.status(401).json({ message: 'Invalid token' });
  }
};

export const isAdmin = (req: AuthRequest, res: Response, next: NextFunction) => {
  if (req.user && (req.user.role === 'admin' || req.user.role === 'super_admin')) {
    next();
  } else {
    res.status(403).json({ message: 'Access denied. Admin only.' });
  }
};

export const isAdminOrMedia = (req: AuthRequest, res: Response, next: NextFunction) => {
  console.log('🔐 [isAdminOrMedia] Checking access for user:', req.user?.id);
  
  if (!req.user) {
    console.log('❌ [isAdminOrMedia] No user in request');
    return res.status(403).json({ message: 'Access denied. Authentication required.' });
  }

  const role = req.user.role?.toLowerCase();
  console.log('👤 [isAdminOrMedia] User role:', role);
  
  // Allow admin, super_admin, media_head, media
  if (role === 'admin' || role === 'super_admin' || role === 'media_head' || role === 'media') {
    console.log('✅ [isAdminOrMedia] Access granted via role:', role);
    return next();
  }

  // Check if user has Media department
  console.log('📋 [isAdminOrMedia] Checking departments:', req.user.departments);
  if (req.user.departments) {
    let departments = req.user.departments;
    
    // Parse if string
    if (typeof departments === 'string') {
      try {
        departments = JSON.parse(departments);
      } catch {
        departments = departments.split(',').map((d: string) => d.trim());
      }
    }
    
    // Check if Media department exists
    if (Array.isArray(departments)) {
      const hasMedia = departments.some((dept: any) => {
        const deptName = (typeof dept === 'string' ? dept : dept?.name || '').toLowerCase().trim();
        return deptName === 'media' || deptName.includes('media');
      });
      
      console.log('🔍 [isAdminOrMedia] Has Media department:', hasMedia);
      if (hasMedia) {
        console.log('✅ [isAdminOrMedia] Access granted via Media department');
        return next();
      }
    }
  }

  console.log('❌ [isAdminOrMedia] Access denied - no valid role or department');
  res.status(403).json({ message: 'Access denied. Media team access required.' });
};
