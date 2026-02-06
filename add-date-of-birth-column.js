const mysql = require('mysql2/promise');
require('dotenv').config();

async function addDateOfBirthColumn() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'word_of_covenant_db'
  });

  try {
    console.log('Adding date_of_birth column to users table...');
    
    // Check if column exists first
    const [columns] = await connection.execute(`
      SHOW COLUMNS FROM users LIKE 'date_of_birth'
    `);
    
    if (columns.length === 0) {
      // Add date_of_birth column if it doesn't exist
      await connection.execute(`
        ALTER TABLE users 
        ADD COLUMN date_of_birth DATE NULL AFTER gender
      `);
      console.log('✅ Successfully added date_of_birth column');
    } else {
      console.log('ℹ️  date_of_birth column already exists');
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await connection.end();
  }
}

addDateOfBirthColumn();
