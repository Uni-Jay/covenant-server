require('dotenv').config();
const mysql = require('mysql2/promise');

async function addGoogleAuthColumns() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'word_of_covenant'
  });

  try {
    console.log('Connected to database');

    // Check if google_id column exists
    const [googleIdColumns] = await connection.execute(
      `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS 
       WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'users' AND COLUMN_NAME = 'google_id'`,
      [process.env.DB_NAME || 'word_of_covenant']
    );

    if (googleIdColumns.length === 0) {
      console.log('Adding google_id column...');
      await connection.execute(
        'ALTER TABLE users ADD COLUMN google_id VARCHAR(255) NULL UNIQUE AFTER password'
      );
      console.log('✅ google_id column added successfully');
    } else {
      console.log('✅ google_id column already exists');
    }

    // Check if photo column exists (for profile pictures from Google)
    const [photoColumns] = await connection.execute(
      `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS 
       WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'users' AND COLUMN_NAME = 'photo'`,
      [process.env.DB_NAME || 'word_of_covenant']
    );

    if (photoColumns.length === 0) {
      console.log('Adding photo column...');
      await connection.execute(
        'ALTER TABLE users ADD COLUMN photo VARCHAR(500) NULL AFTER google_id'
      );
      console.log('✅ photo column added successfully');
    } else {
      console.log('✅ photo column already exists');
    }

    // Update password column to allow NULL (for Google sign-in users)
    console.log('Updating password column to allow NULL...');
    await connection.execute(
      'ALTER TABLE users MODIFY COLUMN password VARCHAR(255) NULL'
    );
    console.log('✅ password column updated successfully');

    console.log('\n🎉 Google authentication columns setup complete!');
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  } finally {
    await connection.end();
  }
}

addGoogleAuthColumns();
