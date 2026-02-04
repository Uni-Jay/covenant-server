const mysql = require('mysql2/promise');
require('dotenv').config();

async function addPhotoColumn() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'covenant_db',
  });

  try {
    console.log('Adding photo column to chat_groups table...');
    
    // Check if column exists
    const [columns] = await connection.execute(
      `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS 
       WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'chat_groups' AND COLUMN_NAME = 'photo'`,
      [process.env.DB_NAME || 'covenant_db']
    );

    if (columns.length > 0) {
      console.log('Photo column already exists in chat_groups table');
    } else {
      await connection.execute(
        'ALTER TABLE chat_groups ADD COLUMN photo VARCHAR(255) AFTER description'
      );
      console.log('Photo column added successfully');
    }

    console.log('Migration completed successfully');
  } catch (error) {
    console.error('Migration failed:', error);
    throw error;
  } finally {
    await connection.end();
  }
}

addPhotoColumn()
  .then(() => {
    console.log('Done!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Error:', error);
    process.exit(1);
  });
