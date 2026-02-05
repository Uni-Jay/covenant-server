const mysql = require('mysql2/promise');
require('dotenv').config();

async function addPostTagsTable() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'covenant_db'
  });

  try {
    console.log('Creating post_tags table...');
    
    // Create post_tags table
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS post_tags (
        id INT PRIMARY KEY AUTO_INCREMENT,
        post_id INT NOT NULL,
        user_id INT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (post_id) REFERENCES feed_posts(id) ON DELETE CASCADE,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        UNIQUE KEY unique_post_tag (post_id, user_id)
      )
    `);
    
    console.log('✓ post_tags table created successfully');
    
  } catch (error) {
    console.error('Error:', error.message);
    throw error;
  } finally {
    await connection.end();
  }
}

addPostTagsTable()
  .then(() => {
    console.log('✓ Migration completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('✗ Migration failed:', error);
    process.exit(1);
  });
