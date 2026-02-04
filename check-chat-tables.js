const mysql = require('mysql2/promise');

async function checkAndCreateTables() {
  let connection;
  
  try {
    connection = await mysql.createConnection({
      host: 'localhost',
      user: 'root',
      password: '',
      database: 'word_of_covenant_db',
    });

    console.log('✓ Connected to database');

    // Check if chat_messages table exists
    const [tables] = await connection.execute(
      "SHOW TABLES LIKE 'chat_messages'"
    );

    if (tables.length === 0) {
      console.log('❌ chat_messages table does NOT exist');
      console.log('⚠️  Creating chat_messages table...');
      
      await connection.execute(`
        CREATE TABLE chat_messages (
          id INT PRIMARY KEY AUTO_INCREMENT,
          group_id INT,
          sender_id INT NOT NULL,
          receiver_id INT,
          message TEXT NOT NULL,
          media_url VARCHAR(500),
          media_type ENUM('image', 'video', 'audio', 'document'),
          is_read BOOLEAN DEFAULT FALSE,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          FOREIGN KEY (group_id) REFERENCES chat_groups(id) ON DELETE CASCADE,
          FOREIGN KEY (sender_id) REFERENCES users(id) ON DELETE CASCADE,
          FOREIGN KEY (receiver_id) REFERENCES users(id) ON DELETE CASCADE,
          INDEX idx_group_id (group_id),
          INDEX idx_sender_receiver (sender_id, receiver_id),
          INDEX idx_created_at (created_at)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
      `);
      
      console.log('✅ chat_messages table created successfully');
    } else {
      console.log('✅ chat_messages table exists');
      
      // Show table structure
      const [columns] = await connection.execute('DESCRIBE chat_messages');
      console.log('\nTable structure:');
      columns.forEach(col => {
        console.log(`  - ${col.Field} (${col.Type})`);
      });
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

checkAndCreateTables();
