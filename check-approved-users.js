const mysql = require('mysql2/promise');
require('dotenv').config();

async function checkApprovedUsers() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'word_of_covenant_db',
    port: parseInt(process.env.DB_PORT || '3306')
  });

  try {
    console.log('🔍 Checking user approval status...\n');
    
    // Get all users with their approval status
    const [users] = await connection.execute(
      `SELECT id, email, first_name, last_name, is_approved FROM users ORDER BY id`
    );
    
    console.log('📋 All users:\n');
    users.forEach(user => {
      const status = user.is_approved === 1 ? '✅ APPROVED' : '❌ NOT APPROVED';
      console.log(`${status} - ID: ${user.id}, Email: ${user.email}, Name: ${user.first_name} ${user.last_name}`);
    });
    
    const approvedCount = users.filter(u => u.is_approved === 1).length;
    const notApprovedCount = users.filter(u => u.is_approved !== 1).length;
    
    console.log(`\n📊 Summary:`);
    console.log(`   Total users: ${users.length}`);
    console.log(`   ✅ Approved: ${approvedCount}`);
    console.log(`   ❌ Not approved: ${notApprovedCount}`);
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await connection.end();
  }
}

checkApprovedUsers();
