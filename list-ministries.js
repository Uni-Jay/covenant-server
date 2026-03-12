const mysql = require('mysql2/promise');

async function listMinistries() {
  const connection = await mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: '',
    database: 'word_of_covenant_db'
  });

  try {
    const [ministries] = await connection.execute('SELECT * FROM ministries ORDER BY name');
    
    console.log(`\n📋 Total Ministries in Database: ${ministries.length}\n`);
    
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

listMinistries();
