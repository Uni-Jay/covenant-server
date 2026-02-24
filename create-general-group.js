const mysql = require('mysql2/promise');

async function createGeneralGroup() {
  let connection;

  try {
    connection = await mysql.createConnection({
      host: 'localhost',
      user: 'root',
      password: '',
      database: 'word_of_covenant_db',
    });

    console.log('✓ Connected to database');

    // Check if General group already exists
    const [existing] = await connection.execute(
      "SELECT id FROM chat_groups WHERE type = 'general' AND name = 'General'"
    );

    let groupId;

    if (existing.length > 0) {
      groupId = existing[0].id;
      console.log(`✓ General group already exists (ID: ${groupId})`);
    } else {
      // Get first admin/super_admin as creator
      const [admins] = await connection.execute(
        "SELECT id FROM users WHERE role IN ('super_admin', 'admin', 'pastor') ORDER BY id LIMIT 1"
      );

      if (admins.length === 0) {
        console.log('⚠ No admin user found. Using first user as creator.');
        const [anyUser] = await connection.execute('SELECT id FROM users ORDER BY id LIMIT 1');
        if (anyUser.length === 0) {
          console.log('✗ No users found. Register a user first.');
          return;
        }
        admins.push(anyUser[0]);
      }

      const creatorId = admins[0].id;

      const [result] = await connection.execute(
        `INSERT INTO chat_groups (name, description, type, department, created_by)
         VALUES (?, ?, ?, ?, ?)`,
        [
          'General',
          'General church-wide group for all members',
          'general',
          null,
          creatorId,
        ]
      );

      groupId = result.insertId;
      console.log(`✓ General group created (ID: ${groupId})`);
    }

    // Add ALL approved users to the group (using INSERT IGNORE to skip duplicates)
    const [addResult] = await connection.execute(
      `INSERT IGNORE INTO group_members (group_id, user_id, role)
       SELECT ?, id, 'member' FROM users WHERE is_approved = 1`,
      [groupId]
    );

    console.log(`✓ Added/verified ${addResult.affectedRows} users to General group`);

    // Count total members
    const [memberCount] = await connection.execute(
      'SELECT COUNT(*) as count FROM group_members WHERE group_id = ?',
      [groupId]
    );

    console.log(`✓ Total members in General group: ${memberCount[0].count}`);

    // Send a welcome message if newly created
    if (existing.length === 0) {
      const [adminsForMsg] = await connection.execute(
        "SELECT id FROM users WHERE role IN ('super_admin', 'admin', 'pastor') ORDER BY id LIMIT 1"
      );
      const senderId = adminsForMsg.length > 0 ? adminsForMsg[0].id : null;

      if (senderId) {
        await connection.execute(
          `INSERT INTO chat_messages (group_id, sender_id, message)
           VALUES (?, ?, ?)`,
          [
            groupId,
            senderId,
            '🙏 Welcome to the General group! This is a space for all church members to connect, share announcements, and stay updated.',
          ]
        );
        console.log('✓ Welcome message sent');
      }
    }
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

createGeneralGroup()
  .then(() => {
    console.log('\n✅ General group setup completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Setup failed:', error);
    process.exit(1);
  });
