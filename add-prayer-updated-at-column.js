const mysql = require('mysql2/promise');

const config = {
  host: 'localhost',
  user: 'root',
  password: '',
  database: 'word_of_covenant_db'
};

async function addUpdatedAtColumn() {
  let connection;
  
  try {
    connection = await mysql.createConnection(config);
    console.log('✓ Connected to database');

    // Check if column already exists
    const [columns] = await connection.execute(`
      SELECT COLUMN_NAME 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = 'word_of_covenant_db' 
      AND TABLE_NAME = 'prayer_requests' 
      AND COLUMN_NAME = 'updated_at'
    `);

    if (columns.length > 0) {
      console.log('⚠ updated_at column already exists');
      return;
    }

    // Add updated_at column
    await connection.execute(`
      ALTER TABLE prayer_requests 
      ADD COLUMN updated_at TIMESTAMP NULL DEFAULT NULL 
      ON UPDATE CURRENT_TIMESTAMP
      AFTER created_at
    `);

    console.log('✅ Successfully added updated_at column to prayer_requests table');

    // Verify the column was added
    const [result] = await connection.execute(`
      SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = 'word_of_covenant_db' 
      AND TABLE_NAME = 'prayer_requests' 
      AND COLUMN_NAME = 'updated_at'
    `);

    console.log('✓ Verification:', result[0]);

  } catch (error) {
    console.error('❌ Error:', error.message);
    throw error;
  } finally {
    if (connection) {
      await connection.end();
      console.log('✓ Connection closed');
    }
  }
}

addUpdatedAtColumn()
  .then(() => {
    console.log('\n✅ Migration completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Migration failed:', error);
    process.exit(1);
  });
