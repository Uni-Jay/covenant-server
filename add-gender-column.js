const mysql = require('mysql2/promise');

async function addGenderColumn() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'word_of_covenant_db',
  });

  try {
    console.log('Checking if gender column exists...');
    
    // Check if column exists
    const [columns] = await connection.execute(
      "SHOW COLUMNS FROM users LIKE 'gender'"
    );

    if (columns.length === 0) {
      console.log('Adding gender column...');
      await connection.execute(
        "ALTER TABLE users ADD COLUMN gender ENUM('male', 'female') AFTER phone"
      );
      console.log('✅ Gender column added successfully');
    } else {
      console.log('✅ Gender column already exists');
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
    throw error;
  } finally {
    await connection.end();
  }
}

addGenderColumn()
  .then(() => {
    console.log('Migration completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Migration failed:', error);
    process.exit(1);
  });
