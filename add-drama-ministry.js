const mysql = require('mysql2/promise');

async function addDramaMinistry() {
  const connection = await mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: '',
    database: 'word_of_covenant_db'
  });

  try {
    console.log('Adding Drama Ministry to database...');

    // Check if Drama Ministry already exists
    const [existing] = await connection.execute(
      'SELECT * FROM ministries WHERE name = ?',
      ['Drama Ministry']
    );

    if (existing.length > 0) {
      console.log('Drama Ministry already exists in database');
      return;
    }

    // Insert Drama Ministry
    await connection.execute(
      `INSERT INTO ministries (name, description, leader, image_url, schedule, created_at) 
       VALUES (?, ?, ?, ?, ?, NOW())`,
      [
        'Drama Ministry',
        'Bringing biblical stories and messages to life through creative theatrical performances and skits.',
        'Bro. David Adebayo',
        'https://images.unsplash.com/photo-1507676184212-d03ab07a01bf?w=400',
        'Wednesday 5:00 PM'
      ]
    );

    console.log('✅ Drama Ministry added successfully!');

    // Show all ministries
    const [ministries] = await connection.execute('SELECT * FROM ministries ORDER BY name');
    console.log('\nAll ministries in database:');
    ministries.forEach(m => {
      console.log(`- ${m.name} (Leader: ${m.leader})`);
    });

  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await connection.end();
  }
}

addDramaMinistry();
