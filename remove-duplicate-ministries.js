const mysql = require('mysql2/promise');

async function removeDuplicateMinistries() {
  const connection = await mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: '',
    database: 'word_of_covenant_db'
  });

  try {
    console.log('Removing duplicate ministries...\n');

    // Keep only the first occurrence of each ministry name
    await connection.execute(`
      DELETE m1 FROM ministries m1
      INNER JOIN ministries m2 
      WHERE m1.id > m2.id 
      AND m1.name = m2.name
    `);

    console.log('✅ Duplicates removed!\n');

    // Show remaining ministries
    const [ministries] = await connection.execute('SELECT * FROM ministries ORDER BY name');
    
    console.log(`📋 Ministries in Database (${ministries.length} unique):\n`);
    
    ministries.forEach((m, index) => {
      console.log(`${index + 1}. ${m.name}`);
      console.log(`   Leader: ${m.leader}`);
      console.log(`   Schedule: ${m.schedule}`);
      console.log('');
    });

  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await connection.end();
  }
}

removeDuplicateMinistries();
