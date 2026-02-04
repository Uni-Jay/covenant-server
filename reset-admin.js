const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');
require('dotenv').config();

async function resetAdmin() {
  try {
    console.log('🔄 Connecting to MySQL...');
    
    const connection = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || 'word_of_covenant_db',
      port: parseInt(process.env.DB_PORT || '3306')
    });

    console.log('✅ Connected to MySQL');

    // Generate new hash for admin123
    const newPassword = 'admin123';
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    
    console.log('🔄 Updating admin password...');
    console.log('New hash:', hashedPassword);

    // Update admin user
    await connection.execute(
      'UPDATE users SET password = ? WHERE email = ?',
      [hashedPassword, 'admin@wordofcovenant.org']
    );

    console.log('✅ Admin password updated successfully!');
    console.log('📧 Email: admin@wordofcovenant.org');
    console.log('🔑 Password: admin123');
    
    await connection.end();
  } catch (error) {
    console.error('❌ Failed:', error.message);
    process.exit(1);
  }
}

resetAdmin();
