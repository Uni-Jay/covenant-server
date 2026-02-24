const mysql = require('mysql2/promise');

async function addNotificationInboxColumns() {
  const connection = await mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: '',
    database: 'word_of_covenant_db'
  });

  try {
    console.log('Adding is_read column to notification_queue...');
    
    // Check if is_read column exists
    const [columns] = await connection.execute(
      "SHOW COLUMNS FROM notification_queue LIKE 'is_read'"
    );

    if (columns.length === 0) {
      // Add is_read column
      await connection.execute(`
        ALTER TABLE notification_queue 
        ADD COLUMN is_read BOOLEAN DEFAULT FALSE AFTER status
      `);
      console.log('✅ Added is_read column');
    } else {
      console.log('ℹ️  is_read column already exists');
    }

    console.log('✅ Notification inbox columns updated successfully');
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await connection.end();
  }
}

addNotificationInboxColumns();
