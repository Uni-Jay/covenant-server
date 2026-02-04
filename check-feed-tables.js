const mysql = require('mysql2/promise');

const config = {
  host: 'localhost',
  user: 'root',
  password: '',
  database: 'word_of_covenant_db'
};

async function checkFeedTables() {
  let connection;
  
  try {
    connection = await mysql.createConnection(config);
    console.log('✓ Connected to database\n');

    const tables = ['feed_posts', 'post_likes', 'post_comments'];
    
    for (const tableName of tables) {
      console.log(`📋 Checking ${tableName}...`);
      
      const [tableExists] = await connection.execute(`
        SELECT COUNT(*) as count 
        FROM INFORMATION_SCHEMA.TABLES 
        WHERE TABLE_SCHEMA = 'word_of_covenant_db' 
        AND TABLE_NAME = ?
      `, [tableName]);

      if (tableExists[0].count > 0) {
        console.log(`✅ ${tableName} exists`);
        
        // Get column structure
        const [columns] = await connection.execute(`
          SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE
          FROM INFORMATION_SCHEMA.COLUMNS 
          WHERE TABLE_SCHEMA = 'word_of_covenant_db' 
          AND TABLE_NAME = ?
        `, [tableName]);
        
        console.log(`   Columns: ${columns.map(c => c.COLUMN_NAME).join(', ')}`);
        
        // Get row count
        const [countResult] = await connection.execute(`SELECT COUNT(*) as count FROM ${tableName}`);
        console.log(`   Rows: ${countResult[0].count}\n`);
      } else {
        console.log(`❌ ${tableName} does NOT exist\n`);
      }
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

checkFeedTables();
