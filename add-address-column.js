const mysql = require('mysql2/promise');

const config = {
  host: 'localhost',
  user: 'root',
  password: '',
  database: 'word_of_covenant_db'
};

async function addAddressColumn() {
  let connection;
  
  try {
    connection = await mysql.createConnection(config);
    console.log('✓ Connected to database');

    // Check if column already exists
    const [columns] = await connection.execute(`
      SELECT COLUMN_NAME 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = 'word_of_covenant_db' 
      AND TABLE_NAME = 'users' 
      AND COLUMN_NAME = 'address'
    `);

    if (columns.length > 0) {
      console.log('⚠ address column already exists');
      return;
    }

    // Add address column
    await connection.execute(`
      ALTER TABLE users 
      ADD COLUMN address TEXT NULL
      AFTER phone
    `);

    console.log('✅ Successfully added address column to users table');

    // Verify the column was added
    const [result] = await connection.execute(`
      SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = 'word_of_covenant_db' 
      AND TABLE_NAME = 'users' 
      AND COLUMN_NAME = 'address'
    `);

    console.log('✓ Verification:', result[0]);

  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

addAddressColumn();
