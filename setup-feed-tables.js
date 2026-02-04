const mysql = require('mysql2/promise');

const config = {
  host: 'localhost',
  user: 'root',
  password: '',
  database: 'word_of_covenant_db'
};

async function setupFeedTables() {
  let connection;
  
  try {
    connection = await mysql.createConnection(config);
    console.log('✓ Connected to database');

    // Create feed_posts table
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS feed_posts (
        id INT PRIMARY KEY AUTO_INCREMENT,
        user_id INT NOT NULL,
        content TEXT NOT NULL,
        post_type ENUM('announcement', 'event', 'prayer', 'testimony', 'general') DEFAULT 'general',
        media_url VARCHAR(500),
        media_type ENUM('image', 'video', 'document'),
        is_pinned TINYINT(1) DEFAULT 0,
        visibility ENUM('public', 'members_only', 'leaders_only') DEFAULT 'members_only',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        INDEX idx_post_type (post_type),
        INDEX idx_created_at (created_at),
        INDEX idx_pinned (is_pinned)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    console.log('✓ Created feed_posts table');

    // Create post_likes table
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS post_likes (
        id INT PRIMARY KEY AUTO_INCREMENT,
        post_id INT NOT NULL,
        user_id INT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (post_id) REFERENCES feed_posts(id) ON DELETE CASCADE,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        UNIQUE KEY unique_post_user (post_id, user_id),
        INDEX idx_post_id (post_id),
        INDEX idx_user_id (user_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    console.log('✓ Created post_likes table');

    // Create post_comments table
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS post_comments (
        id INT PRIMARY KEY AUTO_INCREMENT,
        post_id INT NOT NULL,
        user_id INT NOT NULL,
        comment TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (post_id) REFERENCES feed_posts(id) ON DELETE CASCADE,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        INDEX idx_post_id (post_id),
        INDEX idx_created_at (created_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    console.log('✓ Created post_comments table');

    console.log('\n✅ All feed tables created successfully!');

  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

setupFeedTables();
