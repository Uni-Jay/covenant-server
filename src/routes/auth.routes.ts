import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import pool from '../config/database';
import { authenticate } from '../middleware/auth.middleware';
import { sendWelcomeEmail, sendWelcomeSMS } from '../services/notification.service';
import { syncUserDepartmentGroups } from '../services/chat.service';
import { OAuth2Client } from 'google-auth-library';

const router = Router();
const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

// Register
router.post('/register', async (req, res) => {
  try {
    const { email, password, firstName, lastName, phone, gender, dateOfBirth } = req.body;

    // Validate required fields
    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required' });
    }

    if (!phone) {
      return res.status(400).json({ message: 'Phone number is required' });
    }

    if (!dateOfBirth) {
      return res.status(400).json({ message: 'Date of birth is required' });
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
    const safeFirstName = firstName || null;
    const safeLastName = lastName || null;
    const safeGender = gender || null;

    // Insert user with date_of_birth
    const [result]: any = await pool.execute(
      'INSERT INTO users (email, password, first_name, last_name, phone, gender, date_of_birth) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [email, hashedPassword, safeFirstName, safeLastName, phone, safeGender, dateOfBirth]
    );

    // Generate token
    const jwtSecret = process.env.JWT_SECRET || 'your-secret-key-change-in-production';
    const token = jwt.sign(
      { id: result.insertId, email, role: 'member' },
      jwtSecret,
      { expiresIn: '7d' }
    );

    // Send welcome email and SMS immediately
    const fullName = safeFirstName || 'Friend';
    
    // Send welcome email
    if (email) {
      sendWelcomeEmail(email, fullName, 'member').catch(err => 
        console.error('Failed to send welcome email:', err)
      );
    }
    
    // Send welcome SMS
    if (phone) {
      sendWelcomeSMS(phone, fullName, 'member').catch(err => 
        console.error('Failed to send welcome SMS:', err)
      );
    }

    res.status(201).json({
      message: 'Welcome to Word of Covenant Church! Check your email and phone for a welcome message.',
      token,
      user: { 
        id: result.insertId, 
        email, 
        firstName: safeFirstName, 
        lastName: safeLastName, 
        fullName: `${safeFirstName || ''} ${safeLastName || ''}`.trim() || 'User',
        phone,
        gender: safeGender,
        dateOfBirth, 
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

// Google Authentication
router.post('/google', async (req, res) => {
  try {
    const { idToken, user: googleUser } = req.body;

    // Verify the Google ID token
    const ticket = await googleClient.verifyIdToken({
      idToken,
      audience: process.env.GOOGLE_CLIENT_ID,
    });

    const payload = ticket.getPayload();
    if (!payload || !payload.email) {
      return res.status(400).json({ message: 'Invalid Google token' });
    }

    const email = payload.email;
    const firstName = googleUser.firstName || payload.given_name || '';
    const lastName = googleUser.lastName || payload.family_name || '';
    const photo = googleUser.photo || payload.picture || null;
    const googleId = googleUser.googleId || payload.sub;

    // Check if user exists
    const [existingUsers]: any = await pool.execute(
      'SELECT * FROM users WHERE email = ? OR google_id = ?',
      [email, googleId]
    );

    let userId: number;
    let userRole = 'member';
    let userDepartments: string[] = [];

    if (existingUsers.length > 0) {
      // User exists - update Google ID and photo if not set
      const existingUser = existingUsers[0];
      userId = existingUser.id;
      userRole = existingUser.role;

      // Parse departments
      if (existingUser.departments) {
        if (Array.isArray(existingUser.departments)) {
          userDepartments = existingUser.departments;
        } else if (typeof existingUser.departments === 'string') {
          try {
            userDepartments = JSON.parse(existingUser.departments);
          } catch (parseError) {
            userDepartments = existingUser.departments.split(',').map((d: string) => d.trim()).filter((d: string) => d);
          }
        }
      }

      // Update Google ID and photo if not already set
      if (!existingUser.google_id || !existingUser.photo) {
        await pool.execute(
          'UPDATE users SET google_id = ?, photo = ? WHERE id = ?',
          [googleId, photo, userId]
        );
      }
    } else {
      // Create new user
      const [result]: any = await pool.execute(
        'INSERT INTO users (email, first_name, last_name, google_id, photo, role) VALUES (?, ?, ?, ?, ?, ?)',
        [email, firstName, lastName, googleId, photo, 'member']
      );

      userId = result.insertId;

      // Send welcome notifications (async)
      const fullName = firstName || 'Friend';
      if (email) {
        sendWelcomeEmail(email, fullName, 'member').catch(err => 
          console.error('Failed to send welcome email:', err)
        );
      }
    }

    // Generate JWT token
    const jwtSecret = process.env.JWT_SECRET || 'your-secret-key-change-in-production';
    const token = jwt.sign(
      { id: userId, email, role: userRole },
      jwtSecret,
      { expiresIn: '7d' }
    );

    res.json({
      message: 'Google authentication successful',
      token,
      user: {
        id: userId,
        email,
        firstName,
        lastName,
        fullName: `${firstName} ${lastName}`.trim() || email,
        photo,
        role: userRole,
        departments: userDepartments
      }
    });
  } catch (error) {
    console.error('Google authentication error:', error);
    res.status(500).json({ message: 'Google authentication failed' });
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

// Get all users (for tagging functionality)
router.get('/users', authenticate, async (req, res) => {
  try {
    const [users]: any = await pool.execute(
      'SELECT id, first_name, last_name, email, profile_image, role FROM users WHERE is_approved = 1 ORDER BY first_name, last_name'
    );

    res.json({ users });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Failed to fetch users' });
  }
});

// Update notification preferences
router.put('/notification-preferences', authenticate, async (req: any, res) => {
  try {
    const { pushNotifications, emailUpdates, eventReminders } = req.body;
    const userId = req.user.id;

    // Validate boolean values
    const push = pushNotifications === true || pushNotifications === false ? pushNotifications : true;
    const email = emailUpdates === true || emailUpdates === false ? emailUpdates : true;
    const event = eventReminders === true || eventReminders === false ? eventReminders : true;

    // Update preferences
    await pool.execute(
      'UPDATE users SET push_notifications = ?, email_updates = ?, event_reminders = ? WHERE id = ?',
      [push, email, event, userId]
    );

    console.log(`User ${userId} notification preferences updated:`, { push, email, event });

    res.json({
      message: 'Notification preferences updated successfully',
      preferences: {
        pushNotifications: push,
        emailUpdates: email,
        eventReminders: event
      }
    });
  } catch (error) {
    console.error('Error updating notification preferences:', error);
    res.status(500).json({ message: 'Failed to update notification preferences' });
  }
});

// Get notification preferences
router.get('/notification-preferences', authenticate, async (req: any, res) => {
  try {
    const userId = req.user.id;

    const [users]: any = await pool.execute(
      'SELECT push_notifications, email_updates, event_reminders FROM users WHERE id = ?',
      [userId]
    );

    if (users.length === 0) {
      return res.status(404).json({ message: 'User not found' });
    }

    const user = users[0];

    res.json({
      preferences: {
        pushNotifications: user.push_notifications !== 0,
        emailUpdates: user.email_updates !== 0,
        eventReminders: user.event_reminders !== 0
      }
    });
  } catch (error) {
    console.error('Error fetching notification preferences:', error);
    res.status(500).json({ message: 'Failed to fetch notification preferences' });
  }
});

export default router;
