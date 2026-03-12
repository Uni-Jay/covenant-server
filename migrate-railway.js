/**
 * Standalone database migration script for Railway
 * 
 * This script can be run manually to create all necessary database tables.
 * 
 * Usage:
 *   node migrate-railway.js
 * 
 * Or via Railway CLI:
 *   railway run node migrate-railway.js
 */

require('dotenv').config();
const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');

async function migrateDatabase() {
  let connection;
  
  try {
    console.log('🔄 Starting Railway database migration...');
    console.log('📍 Database:', process.env.DB_NAME || 'railway');
    console.log('📍 Host:', process.env.DB_HOST || 'localhost');
    
    // Connect to the database
    connection = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || 'railway',
      port: parseInt(process.env.DB_PORT || '3306'),
      multipleStatements: true,
      connectTimeout: 60000 // 60 seconds timeout for Railway
    });

    console.log('✅ Connected to database successfully');

    // Check existing tables
    console.log('\n🔍 Checking existing tables...');
    const [existingTables] = await connection.query('SHOW TABLES');
    
    if (existingTables.length > 0) {
      console.log(`📋 Found ${existingTables.length} existing tables:`);
      existingTables.forEach(row => {
        const tableName = Object.values(row)[0];
        console.log(`   - ${tableName}`);
      });
      
      console.log('\n⚠️  WARNING: Tables already exist!');
      console.log('   The schema uses "IF NOT EXISTS" so it\'s safe to continue.');
      console.log('   Existing data will NOT be affected.\n');
    } else {
      console.log('📋 No tables found. Will create all tables.\n');
    }

    // Read and execute schema file
    const schemaPath = path.join(__dirname, 'src', 'database', 'schema.sql');
    
    if (!fs.existsSync(schemaPath)) {
      console.error('❌ Schema file not found at:', schemaPath);
      console.error('   Make sure you run this from the server directory');
      process.exit(1);
    }
    
    console.log('📖 Reading schema file...');
    const schema = fs.readFileSync(schemaPath, 'utf8');

    console.log('🔄 Executing schema...');
    await connection.query(schema);

    console.log('✅ Schema executed successfully!\n');

    // Verify tables were created
    const [tables] = await connection.query('SHOW TABLES');
    console.log(`📊 Total tables in database: ${tables.length}`);
    
    const requiredTables = [
      'users', 'sermons', 'events', 'gallery', 'blog_posts',
      'prayer_requests', 'donations', 'ministries', 'contact_messages',
      'chat_groups', 'group_members', 'chat_messages', 'message_reactions',
      'feed_posts', 'post_likes', 'post_comments', 'post_tags',
      'password_resets', 'notifications', 'notification_preferences',
      'first_timers', 'attendance', 'documents', 'hymns'
    ];

    console.log('\n✅ Verification:');
    const tableNames = tables.map(row => Object.values(row)[0]);
    
    requiredTables.forEach(tableName => {
      const exists = tableNames.includes(tableName);
      console.log(`   ${exists ? '✅' : '❌'} ${tableName}`);
    });

    const missingTables = requiredTables.filter(t => !tableNames.includes(t));
    if (missingTables.length > 0) {
      console.log('\n⚠️  Missing tables:', missingTables.join(', '));
    } else {
      console.log('\n🎉 All required tables exist!');
    }

    // Check admin user
    const [adminCheck] = await connection.query(
      "SELECT email FROM users WHERE role = 'admin' LIMIT 1"
    );
    
    if (adminCheck.length > 0) {
      console.log('\n👤 Admin user found:', adminCheck[0].email);
    } else {
      console.log('\n⚠️  No admin user found. You may need to create one.');
    }

    console.log('\n✅ Migration completed successfully!');
    console.log('🚀 Your Railway database is ready to use.');
    
    await connection.end();
    process.exit(0);
    
  } catch (error) {
    console.error('\n❌ Migration failed:', error.message);
    console.error('\n📝 Error details:', error);
    
    if (error.code === 'ER_ACCESS_DENIED_ERROR') {
      console.error('\n🔐 Access denied. Check your database credentials:');
      console.error('   DB_HOST:', process.env.DB_HOST);
      console.error('   DB_USER:', process.env.DB_USER);
      console.error('   DB_NAME:', process.env.DB_NAME);
    } else if (error.code === 'ECONNREFUSED') {
      console.error('\n🔌 Connection refused. Check:');
      console.error('   - Is the database host correct?');
      console.error('   - Is the database port correct?');
      console.error('   - Is Railway MySQL service running?');
    } else if (error.code === 'PROTOCOL_CONNECTION_LOST') {
      console.error('\n📡 Connection lost. The database might be:');
      console.error('   - Restarting');
      console.error('   - Timing out');
      console.error('   - Unreachable from your network');
    }
    
    if (connection) {
      await connection.end();
    }
    process.exit(1);
  }
}

// Run migration
migrateDatabase();
