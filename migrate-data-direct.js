/**
 * Direct data migration from local MySQL to Railway
 * 
 * This script connects to both databases and copies data directly.
 * Faster than export/import but requires both databases to be accessible.
 * 
 * Usage: node migrate-data-direct.js
 */

require('dotenv').config();
const mysql = require('mysql2/promise');

// Local database configuration (your WAMP/MySQL)
const LOCAL_CONFIG = {
  host: 'localhost',
  user: 'root',
  password: '', // Your local MySQL password
  database: 'word_of_covenant_db', // Your local database name
  port: 3306
};

// Railway database configuration (from .env)
const RAILWAY_CONFIG = {
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME || 'railway',
  port: parseInt(process.env.DB_PORT || '3306'),
  connectTimeout: 60000
};

// Tables to migrate (order matters due to foreign keys)
const TABLES = [
  'users',
  'sermons',
  'events',
  'gallery',
  'blog_posts',
  'prayer_requests',
  'ministries',
  'contact_messages',
  'first_timers',
  'documents',
  'hymns',
  'donations',
  'password_resets',
  'attendance',
  'notification_preferences',
  'notifications',
  'chat_groups',
  'group_members',
  'chat_messages',
  'message_reactions',
  'feed_posts',
  'post_likes',
  'post_comments',
  'post_tags'
];

async function migrateDataDirect() {
  let localConn, railwayConn;
  
  try {
    console.log('🔄 Starting direct data migration...\n');

    // Connect to local database
    console.log('📡 Connecting to local MySQL (WAMP)...');
    console.log('   Host:', LOCAL_CONFIG.host);
    console.log('   Database:', LOCAL_CONFIG.database);
    
    localConn = await mysql.createConnection(LOCAL_CONFIG);
    console.log('✅ Connected to local database\n');

    // Connect to Railway database
    console.log('📡 Connecting to Railway MySQL...');
    console.log('   Host:', RAILWAY_CONFIG.host);
    console.log('   Database:', RAILWAY_CONFIG.database);
    
    railwayConn = await mysql.createConnection(RAILWAY_CONFIG);
    console.log('✅ Connected to Railway database\n');

    // Check if Railway tables exist
    const [railwayTables] = await railwayConn.query('SHOW TABLES');
    if (railwayTables.length === 0) {
      console.log('⚠️  No tables found in Railway database.');
      console.log('   Creating tables first...\n');
      
      const fs = require('fs');
      const path = require('path');
      const schemaPath = path.join(__dirname, 'src', 'database', 'schema.sql');
      
      if (fs.existsSync(schemaPath)) {
        const schema = fs.readFileSync(schemaPath, 'utf8');
        await railwayConn.query(schema);
        console.log('✅ Tables created\n');
      } else {
        console.error('❌ Schema file not found. Please create tables first.');
        process.exit(1);
      }
    }

    const migrationSummary = [];
    let totalRowsMigrated = 0;

    // Disable foreign key checks
    await railwayConn.query('SET FOREIGN_KEY_CHECKS = 0');

    // Migrate each table
    for (const tableName of TABLES) {
      try {
        console.log(`📋 Migrating ${tableName}...`);
        
        // Check if table exists in local DB
        const [localTables] = await localConn.query(`SHOW TABLES LIKE '${tableName}'`);
        if (localTables.length === 0) {
          console.log(`   ⚠️  Table ${tableName} not found in local DB, skipping\n`);
          migrationSummary.push({ table: tableName, rows: 0, status: 'not_found' });
          continue;
        }

        // Get row count from local
        const [countResult] = await localConn.query(`SELECT COUNT(*) as count FROM ${tableName}`);
        const rowCount = countResult[0].count;

        if (rowCount === 0) {
          console.log(`   ℹ️  Table ${tableName} is empty\n`);
          migrationSummary.push({ table: tableName, rows: 0, status: 'empty' });
          continue;
        }

        // Get all data from local
        const [rows] = await localConn.query(`SELECT * FROM ${tableName}`);
        
        if (rows.length === 0) {
          console.log(`   ℹ️  No data to migrate\n`);
          migrationSummary.push({ table: tableName, rows: 0, status: 'empty' });
          continue;
        }

        // Get column names
        const columns = Object.keys(rows[0]);
        const columnList = columns.map(c => `\`${c}\``).join(', ');
        const placeholders = columns.map(() => '?').join(', ');

        // Insert data in chunks (100 rows at a time)
        const chunkSize = 100;
        let insertedCount = 0;
        
        for (let i = 0; i < rows.length; i += chunkSize) {
          const chunk = rows.slice(i, i + chunkSize);
          
          for (const row of chunk) {
            try {
              const values = columns.map(col => row[col]);
              await railwayConn.query(
                `INSERT IGNORE INTO ${tableName} (${columnList}) VALUES (${placeholders})`,
                values
              );
              insertedCount++;
            } catch (insertError) {
              // Skip duplicates silently (INSERT IGNORE)
              if (insertError.code !== 'ER_DUP_ENTRY') {
                console.log(`   ⚠️  Error inserting row: ${insertError.message}`);
              }
            }
          }
          
          // Progress indicator
          const progress = Math.min(i + chunkSize, rows.length);
          process.stdout.write(`\r   Progress: ${progress}/${rows.length} rows...`);
        }
        
        console.log(`\n   ✅ Migrated ${insertedCount} rows\n`);
        migrationSummary.push({ table: tableName, rows: insertedCount, total: rows.length, status: 'success' });
        totalRowsMigrated += insertedCount;

      } catch (error) {
        console.error(`   ❌ Error migrating ${tableName}:`, error.message, '\n');
        migrationSummary.push({ table: tableName, rows: 0, status: 'error', error: error.message });
      }
    }

    // Re-enable foreign key checks
    await railwayConn.query('SET FOREIGN_KEY_CHECKS = 1');

    // Print summary
    console.log('='.repeat(70));
    console.log('📊 MIGRATION SUMMARY');
    console.log('='.repeat(70));
    
    migrationSummary.forEach(({ table, rows, total, status, error }) => {
      const statusIcon = status === 'success' ? '✅' : 
                         status === 'empty' || status === 'not_found' ? 'ℹ️' : '❌';
      const rowInfo = total ? `${rows}/${total}` : rows;
      const errorMsg = error ? ` (${error})` : '';
      console.log(`${statusIcon} ${table.padEnd(30)} ${rowInfo.toString().padStart(10)} rows${errorMsg}`);
    });
    
    console.log('='.repeat(70));
    console.log(`📦 Total rows migrated: ${totalRowsMigrated}`);
    console.log('='.repeat(70));
    
    console.log('\n🎉 Migration completed successfully!');
    console.log('🚀 Your Railway database now has all your local data!\n');

    await localConn.end();
    await railwayConn.end();
    process.exit(0);

  } catch (error) {
    console.error('\n❌ Migration failed:', error.message);
    console.error('\n📝 Error details:', error);
    
    if (error.code === 'ER_ACCESS_DENIED_ERROR') {
      console.error('\n🔐 Access denied. Check database credentials.');
    } else if (error.code === 'ECONNREFUSED') {
      console.error('\n🔌 Connection refused. Check:');
      console.error('   - Local: Is WAMP/MySQL running?');
      console.error('   - Railway: Are credentials correct?');
    } else if (error.code === 'ER_BAD_DB_ERROR') {
      console.error('\n📂 Database not found. Check database names.');
    }

    if (localConn) await localConn.end();
    if (railwayConn) await railwayConn.end();
    process.exit(1);
  }
}

// Run migration
migrateDataDirect();
