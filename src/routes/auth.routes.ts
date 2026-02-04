import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import pool from '../config/database';
import { authenticate } from '../middleware/auth.middleware';
import { sendWelcomeEmail, sendWelcomeSMS } from '../services/notification.service';
import { syncUserDepartmentGroups } from '../services/chat.service';

const router = Router();

// Register
router.post('/register', async (req, res) => {
  try {
    const { email, password, firstName, lastName, phone, gender, departments } = req.body;

    // Validate required fields
    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required' });
    }

    // Check if user exists
    const [existingUser]: any = await pool.execute(
      'SELECT id FROM users WHERE email = ?',
      [email]
    );

    if (existingUser.length > 0) {
      return res.status(400).json({ message: 'User already exists' });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Prepare values with proper null handling
    const departmentsJson = departments && departments.length > 0 ? JSON.stringify(departments) : null;
    const safeFirstName = firstName || null;
    const safeLastName = lastName || null;
    const safePhone = phone || null;
    const safeGender = gender || null;

    // Insert user
    const [result]: any = await pool.execute(
      'INSERT INTO users (email, password, first_name, last_name, phone, gender, departments) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [email, hashedPassword, safeFirstName, safeLastName, safePhone, safeGender, departmentsJson]
    );

    // Generate token
    const jwtSecret = process.env.JWT_SECRET || 'your-secret-key-change-in-production';
    const token = jwt.sign(
      { id: result.insertId, email, role: 'member' },
      jwtSecret,
      { expiresIn: '7d' }
    );

    // Send welcome email and SMS (async, don't wait)
    const fullName = safeFirstName || 'Friend';
    if (email) {
      sendWelcomeEmail(email, fullName, 'member').catch(err => 
        console.error('Failed to send welcome email:', err)
      );
    }
    if (safePhone) {
      sendWelcomeSMS(safePhone, fullName, 'member').catch(err => 
        console.error('Failed to send welcome SMS:', err)
      );
    }

    // Auto-create department group chats and add user (async, don't wait)
    if (departments && departments.length > 0) {
      syncUserDepartmentGroups(result.insertId, departments).catch(err =>
        console.error('Failed to sync department groups:', err)
      );
    }

    res.status(201).json({
      message: 'User registered successfully',
      token,
      user: { 
        id: result.insertId, 
        email, 
        firstName: safeFirstName, 
        lastName: safeLastName, 
        fullName: `${safeFirstName || ''} ${safeLastName || ''}`.trim() || 'User',
        phone: safePhone,
        gender: safeGender, 
        departments: departments || [], 
        role: 'member' 
      }
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ message: 'Registration failed' });
  }
});

// Login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    // Find user
    const [users]: any = await pool.execute(
      'SELECT * FROM users WHERE email = ?',
      [email]
    );

    if (users.length === 0) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    const user = users[0];

    // Check password
    const isValidPassword = await bcrypt.compare(password, user.password);
    if (!isValidPassword) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    // Generate token
    const jwtSecret = process.env.JWT_SECRET || 'your-secret-key-change-in-production';
    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role },
      jwtSecret,
      { expiresIn: '7d' }
    );

    // Safely parse departments
    let userDepartments = [];
    if (user.departments) {
      if (Array.isArray(user.departments)) {
        userDepartments = user.departments;
      } else if (typeof user.departments === 'string') {
        try {
          userDepartments = JSON.parse(user.departments);
        } catch (parseError) {
          userDepartments = user.departments.split(',').map((d: string) => d.trim()).filter((d: string) => d);
        }
      }
    }

    res.json({
      message: 'Login successful',
      token,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.first_name,
        lastName: user.last_name,
        fullName: `${user.first_name} ${user.last_name}`,
        phone: user.phone,
        address: user.address,
        gender: user.gender,
        role: user.role,
        department: user.department,
        departments: userDepartments
      }
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Login failed' });
  }
});

// Get current user
router.get('/me', authenticate, async (req: any, res) => {
  try {
    const [users]: any = await pool.execute(
      'SELECT id, email, first_name, last_name, phone, address, gender, role, department, departments FROM users WHERE id = ?',
      [req.user.id]
    );

    if (users.length === 0) {
      return res.status(404).json({ message: 'User not found' });
    }

    const user = users[0];
    
    // Safely parse departments
    let userDepartments = [];
    if (user.departments) {
      if (Array.isArray(user.departments)) {
        userDepartments = user.departments;
      } else if (typeof user.departments === 'string') {
        try {
          userDepartments = JSON.parse(user.departments);
        } catch (parseError) {
          userDepartments = user.departments.split(',').map((d: string) => d.trim()).filter((d: string) => d);
        }
      }
    }

    res.json({
      id: user.id,
      email: user.email,
      firstName: user.first_name,
      lastName: user.last_name,
      phone: user.phone,
      address: user.address,
      gender: user.gender,
      role: user.role,
      department: user.department,
      departments: userDepartments
    });
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch user' });
  }
});

// Update profile
router.put('/profile', authenticate, async (req: any, res) => {
  try {
    const { firstName, lastName, phone, address, gender, departments } = req.body;
    const userId = req.user.id;

    // Get current user to check old departments
    const [currentUsers] = await pool.execute(
      'SELECT departments FROM users WHERE id = ?',
      [userId]
    ) as any;
    
    let oldDepartments: string[] = [];
    if (currentUsers[0]?.departments) {
      try {
        oldDepartments = typeof currentUsers[0].departments === 'string' 
          ? JSON.parse(currentUsers[0].departments) 
          : currentUsers[0].departments;
      } catch (e) {
        oldDepartments = [];
      }
    }

    // Prepare departments - handle both string and array formats
    let departmentsArray = [];
    if (departments) {
      if (typeof departments === 'string') {
        // If it's a comma-separated string, split it
        departmentsArray = departments.split(',').map((d: string) => d.trim()).filter((d: string) => d);
      } else if (Array.isArray(departments)) {
        departmentsArray = departments;
      }
    }
    const departmentsJson = departmentsArray.length > 0 ? JSON.stringify(departmentsArray) : null;

    // Update user
    await pool.execute(
      'UPDATE users SET first_name = ?, last_name = ?, phone = ?, address = ?, gender = ?, departments = ? WHERE id = ?',
      [firstName, lastName, phone || null, address || null, gender || null, departmentsJson, userId]
    );

    // Sync department groups (async, don't wait)
    if (departmentsArray.length > 0) {
      syncUserDepartmentGroups(userId, departmentsArray).catch(err =>
        console.error('Failed to sync department groups:', err)
      );
    }

    // Fetch updated user
    const [users] = await pool.execute(
      'SELECT id, email, first_name, last_name, phone, address, gender, role, department, departments FROM users WHERE id = ?',
      [userId]
    ) as any;

    const user = users[0];

    // Safely parse departments
    let userDepartments = [];
    if (user.departments) {
      if (Array.isArray(user.departments)) {
        userDepartments = user.departments;
      } else if (typeof user.departments === 'string') {
        try {
          userDepartments = JSON.parse(user.departments);
        } catch (parseError) {
          userDepartments = user.departments.split(',').map((d: string) => d.trim()).filter((d: string) => d);
        }
      }
    }

    res.json({
      message: 'Profile updated successfully',
      user: {
        id: user.id,
        email: user.email,
        firstName: user.first_name,
        lastName: user.last_name,
        fullName: `${user.first_name} ${user.last_name}`,
        phone: user.phone,
        address: user.address,
        gender: user.gender,
        role: user.role,
        department: user.department,
        departments: userDepartments
      }
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Failed to update profile' });
  }
});

export default router;
