const mysql = require('mysql2/promise');
require('dotenv').config();

async function approveAllUsers() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'word_of_covenant_db',
    port: parseInt(process.env.DB_PORT || '3306')
  });

  try {
    console.log('🔄 Approving all users...\n');
    
    // Update all users to approved
    const [result] = await connection.execute(
      `UPDATE users SET is_approved = 1 WHERE is_approved IS NULL OR is_approved = 0`
    );
    
    console.log(`✅ Updated ${result.affectedRows} users to approved status\n`);
    
    // Verify the update
    const [users] = await connection.execute(
      `SELECT id, email, first_name, last_name, is_approved FROM users ORDER BY id`
    );
    
    console.log('📋 All users after update:\n');
    users.forEach(user => {
      const status = user.is_approved === 1 ? '✅ APPROVED' : '❌ NOT APPROVED';
      console.log(`${status} - ID: ${user.id}, Email: ${user.email}`);
    });
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await connection.end();
  }
}

approveAllUsers();
