const mysql = require('mysql2/promise');
require('dotenv').config();

async function addNotificationPreferences() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'church_db'
  });

  try {
    console.log('Adding notification preference columns to users table...');

    // Check if columns exist
    const [columns] = await connection.execute(`
      SELECT COLUMN_NAME 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'users' 
      AND COLUMN_NAME IN ('push_notifications', 'email_updates', 'event_reminders')
    `, [process.env.DB_NAME || 'church_db']);

    const existingColumns = columns.map((col) => col.COLUMN_NAME);

    // Add push_notifications column
    if (!existingColumns.includes('push_notifications')) {
      await connection.execute(`
        ALTER TABLE users 
        ADD COLUMN push_notifications BOOLEAN DEFAULT TRUE
      `);
      console.log('✓ Added push_notifications column');
    } else {
      console.log('✓ push_notifications column already exists');
    }

    // Add email_updates column
    if (!existingColumns.includes('email_updates')) {
      await connection.execute(`
        ALTER TABLE users 
        ADD COLUMN email_updates BOOLEAN DEFAULT TRUE
      `);
      console.log('✓ Added email_updates column');
    } else {
      console.log('✓ email_updates column already exists');
    }

    // Add event_reminders column
    if (!existingColumns.includes('event_reminders')) {
      await connection.execute(`
        ALTER TABLE users 
        ADD COLUMN event_reminders BOOLEAN DEFAULT TRUE
      `);
      console.log('✓ Added event_reminders column');
    } else {
      console.log('✓ event_reminders column already exists');
    }

    console.log('\n✅ Notification preference columns setup complete!');

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await connection.end();
  }
}

addNotificationPreferences();
