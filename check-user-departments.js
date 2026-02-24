const mysql = require('mysql2/promise');
require('dotenv').config();

async function checkUserDepartments() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'word_of_covenant_db',
    port: parseInt(process.env.DB_PORT || '3306')
  });

  try {
    console.log('🔍 Checking user departments...\n');
    
    // Get all users with their departments
    const [users] = await connection.execute(
      `SELECT id, email, role, departments FROM users ORDER BY id DESC LIMIT 10`
    );
    
    console.log('📋 Recent users:\n');
    users.forEach(user => {
      console.log(`User: ${user.email}`);
      console.log(`  ID: ${user.id}`);
      console.log(`  Role: ${user.role}`);
      console.log(`  Departments (raw): ${user.departments}`);
      console.log(`  Departments (type): ${typeof user.departments}`);
      
      // Try to parse if it's a string
      try {
        if (typeof user.departments === 'string') {
          const parsed = JSON.parse(user.departments);
          console.log(`  Departments (parsed): ${JSON.stringify(parsed)}`);
        } else {
          console.log(`  Departments (value): ${JSON.stringify(user.departments)}`);
        }
      } catch (e) {
        console.log(`  Departments (parse error): ${e.message}`);
      }
      console.log('---\n');
    });
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await connection.end();
  }
}

checkUserDepartments();
