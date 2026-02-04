const mysql = require('mysql2/promise');

async function checkUsersTable() {
  const connection = await mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: '',
    database: 'word_of_covenant_db',
  });

  try {
    const [columns] = await connection.execute('DESCRIBE users');
    
    console.log('\n📋 Users Table Structure:');
    console.log('═══════════════════════════════════════════════════\n');
    
    columns.forEach(col => {
      console.log(`✓ ${col.Field.padEnd(20)} | ${col.Type.padEnd(30)} | ${col.Null === 'YES' ? 'NULL' : 'NOT NULL'}`);
    });
    
    console.log('\n═══════════════════════════════════════════════════\n');
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await connection.end();
  }
}

checkUsersTable();
