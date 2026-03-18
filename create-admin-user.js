const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');
require('dotenv').config();

async function createOrUpdateAdmin() {
  const email = process.argv[2];
  const password = process.argv[3];
  const firstName = process.argv[4] || 'Admin';
  const lastName = process.argv[5] || 'HOCFAM';
  const role = process.argv[6] || 'super_admin';

  if (!email || !password) {
    console.error('Usage: node create-admin-user.js <email> <password> [firstName] [lastName] [role]');
    process.exit(1);
  }

  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'word_of_covenant_db',
    port: parseInt(process.env.DB_PORT || '3306', 10),
  });

  try {
    const hashedPassword = await bcrypt.hash(password, 10);

    const [users] = await connection.execute(
      'SELECT id FROM users WHERE email = ?',
      [email]
    );

    if (users.length > 0) {
      await connection.execute(
        'UPDATE users SET password = ?, role = ?, is_approved = 1, first_name = COALESCE(first_name, ?), last_name = COALESCE(last_name, ?) WHERE email = ?',
        [hashedPassword, role, firstName, lastName, email]
      );
      console.log(`Updated existing ${role} user: ${email}`);
    } else {
      await connection.execute(
        'INSERT INTO users (email, password, first_name, last_name, role, is_approved) VALUES (?, ?, ?, ?, ?, 1)',
        [email, hashedPassword, firstName, lastName, role]
      );
      console.log(`Created new ${role} user: ${email}`);
    }
  } finally {
    await connection.end();
  }
}

createOrUpdateAdmin().catch((error) => {
  console.error('Failed to create or update admin user:', error.message);
  process.exit(1);
});