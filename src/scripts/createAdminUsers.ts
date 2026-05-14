import bcrypt from 'bcryptjs';
import pool from '../config/database';
import dotenv from 'dotenv';

dotenv.config();

async function createAdminUsers() {
  try {
    const adminUsers = [
      {
        email: 'admin@hocfam.org',
        password: 'admin123', // Change this to a strong password
        firstName: 'Admin',
        lastName: 'Account',
        phone: '+1234567890',
        dateOfBirth: '1990-01-01'
      },
      {
        email: 'info@hocfam.org',
        password: 'info123', // Change this to a strong password
        firstName: 'Info',
        lastName: 'Account',
        phone: '+1234567891',
        dateOfBirth: '1990-01-01'
      }
    ];

    for (const user of adminUsers) {
      // Check if user already exists
      const [existingUser]: any = await pool.execute(
        'SELECT id, role FROM users WHERE email = ?',
        [user.email]
      );

      if (existingUser.length > 0) {
        // User exists, update role to super_admin if not already
        const userId = existingUser[0].id;
        const currentRole = existingUser[0].role;
        
        if (currentRole !== 'super_admin') {
          await pool.execute(
            `UPDATE users SET role = ? WHERE id = ?`,
            ['super_admin', userId]
          );
          console.log(`✅ Updated ${user.email} role from '${currentRole}' to 'super_admin'`);
        } else {
          console.log(`✅ User ${user.email} already has super_admin role`);
        }
        continue;
      }

      // Hash password
      const hashedPassword = await bcrypt.hash(user.password, 10);

      // Insert user without role (defaults to 'member')
      const [result]: any = await pool.execute(
        'INSERT INTO users (email, password, first_name, last_name, phone, date_of_birth, is_approved) VALUES (?, ?, ?, ?, ?, ?, 1)',
        [user.email, hashedPassword, user.firstName, user.lastName, user.phone, user.dateOfBirth]
      );

      // Update role to super_admin
      await pool.query(
        `UPDATE users SET role = 'super_admin' WHERE id = ${result.insertId}`
      );

      console.log(`✅ Created admin user: ${user.email}`);
    }

    console.log('\n✨ Admin users created successfully!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error creating admin users:', error);
    process.exit(1);
  }
}

createAdminUsers();
