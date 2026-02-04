const mysql = require('mysql2/promise');

async function addDepartmentsColumn() {
  const connection = await mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: '',
    database: 'word_of_covenant_db',
  });

  try {
    console.log('Checking if departments column exists...');
    
    // Check if column exists
    const [columns] = await connection.execute(
      "SHOW COLUMNS FROM users LIKE 'departments'"
    );

    if (columns.length === 0) {
      console.log('Adding departments column...');
      await connection.execute(
        "ALTER TABLE users ADD COLUMN departments JSON AFTER department"
      );
      console.log('✅ Departments column added successfully');
    } else {
      console.log('✅ Departments column already exists');
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
    throw error;
  } finally {
    await connection.end();
  }
}

addDepartmentsColumn()
  .then(() => {
    console.log('Migration completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Migration failed:', error);
    process.exit(1);
  });
