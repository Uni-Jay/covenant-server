const mysql = require('mysql2/promise');
require('dotenv').config();

async function addPasswordResetsTable() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'word_of_covenant_db',
  });

  try {
    console.log('Creating password_resets table...');

    // Create password_resets table
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS password_resets (
        id INT PRIMARY KEY AUTO_INCREMENT,
        user_id INT NOT NULL,
        email VARCHAR(255) NOT NULL,
        token VARCHAR(191) NOT NULL UNIQUE,
        expires_at DATETIME NOT NULL,
        used BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        INDEX idx_email (email(100)),
        INDEX idx_expires_at (expires_at)
      )
    `);

    console.log('✓ password_resets table created successfully!');
    
    // Clean up expired tokens older than 24 hours
    await connection.execute(`
      DELETE FROM password_resets 
      WHERE expires_at < NOW() OR created_at < DATE_SUB(NOW(), INTERVAL 24 HOUR)
    `);
    
    console.log('✓ Cleaned up old reset tokens');

  } catch (error) {
    console.error('Error creating password_resets table:', error);
    throw error;
  } finally {
    await connection.end();
  }
}

addPasswordResetsTable()
  .then(() => {
    console.log('\n✅ Password resets table setup complete!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Migration failed:', error);
    process.exit(1);
  });
