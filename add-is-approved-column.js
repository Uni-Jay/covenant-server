const mysql = require('mysql2/promise');

async function addIsApprovedColumn() {
  let connection;
  
  try {
    connection = await mysql.createConnection({
      host: 'localhost',
      user: 'root',
      password: '',
      database: 'word_of_covenant_db',
    });

    console.log('✓ Connected to database');

    // Check if column already exists
    const [columns] = await connection.execute(
      `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS 
       WHERE TABLE_SCHEMA = 'word_of_covenant_db' 
       AND TABLE_NAME = 'users' 
       AND COLUMN_NAME = 'is_approved'`
    );

    if (columns.length > 0) {
      console.log('✓ Column is_approved already exists');
      return;
    }

    // Add the column
    await connection.execute(
      `ALTER TABLE users 
       ADD COLUMN is_approved BOOLEAN DEFAULT TRUE 
       COMMENT 'Whether user account is approved'`
    );

    console.log('✓ Added is_approved column to users table');
    console.log('✓ Default value: TRUE (all existing users auto-approved)');

  } catch (error) {
    console.error('✗ Error:', error.message);
    throw error;
  } finally {
    if (connection) {
      await connection.end();
      console.log('✓ Connection closed');
    }
  }
}

addIsApprovedColumn()
  .then(() => {
    console.log('\n✅ Migration completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Migration failed:', error);
    process.exit(1);
  });
