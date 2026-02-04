const mysql = require('mysql2/promise');

async function createMinistersGroup() {
  let connection;
  
  try {
    connection = await mysql.createConnection({
      host: 'localhost',
      user: 'root',
      password: '',
      database: 'word_of_covenant_db',
    });

    console.log('✓ Connected to database');

    // Check if chat_groups table exists
    const [tables] = await connection.execute(
      "SHOW TABLES LIKE 'chat_groups'"
    );

    if (tables.length === 0) {
      console.log('⚠ Creating chat_groups table...');
      await connection.execute(`
        CREATE TABLE IF NOT EXISTS chat_groups (
          id INT PRIMARY KEY AUTO_INCREMENT,
          name VARCHAR(255) NOT NULL,
          description TEXT,
          type ENUM('department', 'general', 'ministers', 'private') DEFAULT 'general',
          department VARCHAR(100),
          created_by INT,
          is_auto_join BOOLEAN DEFAULT FALSE,
          is_active BOOLEAN DEFAULT TRUE,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          FOREIGN KEY (created_by) REFERENCES users(id)
        )
      `);
      console.log('✓ chat_groups table created');
    }

    // Check if group_members table exists
    const [memberTables] = await connection.execute(
      "SHOW TABLES LIKE 'group_members'"
    );

    if (memberTables.length === 0) {
      console.log('⚠ Creating group_members table...');
      await connection.execute(`
        CREATE TABLE IF NOT EXISTS group_members (
          id INT PRIMARY KEY AUTO_INCREMENT,
          group_id INT NOT NULL,
          user_id INT NOT NULL,
          role ENUM('admin', 'moderator', 'member') DEFAULT 'member',
          joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (group_id) REFERENCES chat_groups(id) ON DELETE CASCADE,
          FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
          UNIQUE KEY unique_group_member (group_id, user_id)
        )
      `);
      console.log('✓ group_members table created');
    }

    // Check if chat_messages table exists
    const [messageTables] = await connection.execute(
      "SHOW TABLES LIKE 'chat_messages'"
    );

    if (messageTables.length === 0) {
      console.log('⚠ Creating chat_messages table...');
      await connection.execute(`
        CREATE TABLE IF NOT EXISTS chat_messages (
          id INT PRIMARY KEY AUTO_INCREMENT,
          group_id INT NOT NULL,
          user_id INT NOT NULL,
          message TEXT NOT NULL,
          message_type ENUM('text', 'image', 'file', 'audio', 'video') DEFAULT 'text',
          file_url VARCHAR(500),
          is_read BOOLEAN DEFAULT FALSE,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          FOREIGN KEY (group_id) REFERENCES chat_groups(id) ON DELETE CASCADE,
          FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        )
      `);
      console.log('✓ chat_messages table created');
    }

    // Check if ministers group already exists
    const [existing] = await connection.execute(
      "SELECT id FROM chat_groups WHERE type = 'ministers'"
    );

    if (existing.length > 0) {
      console.log('✓ Ministers group already exists');
      return;
    }

    // Get first admin/pastor to be creator
    const [admins] = await connection.execute(
      "SELECT id FROM users WHERE role IN ('super_admin', 'pastor') ORDER BY id LIMIT 1"
    );

    const creatorId = admins.length > 0 ? admins[0].id : null;

    if (!creatorId) {
      console.log('⚠ No admin/pastor user found. Please create a user first.');
      return;
    }

    // Create ministers group
    const [result] = await connection.execute(`
      INSERT INTO chat_groups (name, description, type, department, created_by)
      VALUES (?, ?, ?, ?, ?)
    `, [
      'Ministers Fellowship',
      'Group chat for all ministers - Pastors, Evangelists, Prophets, and Apostles',
      'ministers',
      'Ministers',
      creatorId
    ]);

    const groupId = result.insertId;
    console.log(`✓ Ministers group created with ID: ${groupId}`);

    // Add all ministers to the group
    await connection.execute(`
      INSERT INTO group_members (group_id, user_id, role)
      SELECT ?, id, 'member'
      FROM users 
      WHERE executive_position IS NOT NULL
      AND (
        executive_position LIKE '%Pastor%'
        OR executive_position LIKE '%Apostle%'
        OR executive_position LIKE '%Prophet%'
        OR executive_position LIKE '%Evangelist%'
        OR role IN ('pastor', 'elder')
      )
    `, [groupId]);

    const [members] = await connection.execute(
      'SELECT COUNT(*) as count FROM group_members WHERE group_id = ?',
      [groupId]
    );

    console.log(`✓ Added ${members[0].count} ministers to the group`);

    // Send welcome message
    await connection.execute(`
      INSERT INTO chat_messages (group_id, user_id, message, message_type)
      VALUES (?, ?, ?, ?)
    `, [
      groupId,
      creatorId,
      '🙏 Welcome to the Ministers Fellowship! This is a sacred space for spiritual leaders to connect, share, and pray together.',
      'text'
    ]);

    console.log('✓ Welcome message sent');

  } catch (error) {
    console.error('✗ Error:', error.message);
    throw error;
  } finally {
    if (connection) {
      await connection.end();
      console.log('✓ Connection closed');
    }
  }
}

createMinistersGroup()
  .then(() => {
    console.log('\n✅ Ministers group setup completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Setup failed:', error);
    process.exit(1);
  });
