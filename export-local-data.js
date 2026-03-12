/**
 * Export all data from local MySQL/WAMP database
 * 
 * This script exports all data from your local database to SQL files
 * that can then be imported into Railway.
 * 
 * Usage: node export-local-data.js
 */

require('dotenv').config();
const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');

// Local database configuration (WAMP/MySQL)
const LOCAL_CONFIG = {
  host: 'localhost',
  user: 'root',
  password: '', // Your local MySQL password
  database: 'word_of_covenant_db', // Your local database name
  port: 3306
};

const EXPORT_DIR = path.join(__dirname, 'data-export');

// Tables to export (order matters due to foreign keys)
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

function escapeValue(value) {
  if (value === null || value === undefined) {
    return 'NULL';
  }
  if (typeof value === 'number') {
    return value;
  }
  if (typeof value === 'boolean') {
    return value ? 1 : 0;
  }
  if (value instanceof Date) {
    return `'${value.toISOString().slice(0, 19).replace('T', ' ')}'`;
  }
  if (typeof value === 'object') {
    // Handle JSON columns
    return `'${JSON.stringify(value).replace(/'/g, "''")}'`;
  }
  // Escape strings
  return `'${String(value).replace(/'/g, "''").replace(/\\/g, '\\\\')}'`;
}

async function exportData() {
  let connection;
  
  try {
    console.log('🔄 Connecting to local MySQL database...');
    console.log('   Host:', LOCAL_CONFIG.host);
    console.log('   Database:', LOCAL_CONFIG.database);
    
    connection = await mysql.createConnection(LOCAL_CONFIG);
    console.log('✅ Connected to local database\n');

    // Create export directory
    if (!fs.existsSync(EXPORT_DIR)) {
      fs.mkdirSync(EXPORT_DIR, { recursive: true });
    }

    const exportSummary = [];
    let totalRows = 0;

    // Export each table
    for (const tableName of TABLES) {
      try {
        console.log(`📋 Exporting ${tableName}...`);
        
        // Check if table exists
        const [tables] = await connection.query(`SHOW TABLES LIKE '${tableName}'`);
        if (tables.length === 0) {
          console.log(`   ⚠️  Table ${tableName} not found, skipping\n`);
          continue;
        }

        // Get all data
        const [rows] = await connection.query(`SELECT * FROM ${tableName}`);
        
        if (rows.length === 0) {
          console.log(`   ℹ️  Table ${tableName} is empty\n`);
          exportSummary.push({ table: tableName, rows: 0, status: 'empty' });
          continue;
        }

        // Get column names
        const columns = Object.keys(rows[0]);

        // Generate INSERT statements
        let sql = `-- Data export for ${tableName}\n`;
        sql += `-- Exported on ${new Date().toISOString()}\n`;
        sql += `-- Total rows: ${rows.length}\n\n`;
        
        // Use INSERT IGNORE to avoid duplicate key errors
        sql += `-- Disable foreign key checks temporarily\n`;
        sql += `SET FOREIGN_KEY_CHECKS = 0;\n\n`;

        // Split into chunks of 100 rows for better handling
        const chunkSize = 100;
        for (let i = 0; i < rows.length; i += chunkSize) {
          const chunk = rows.slice(i, i + chunkSize);
          
          sql += `INSERT IGNORE INTO ${tableName} (${columns.map(c => `\`${c}\``).join(', ')}) VALUES\n`;
          
          const values = chunk.map(row => {
            const rowValues = columns.map(col => escapeValue(row[col]));
            return `(${rowValues.join(', ')})`;
          });
          
          sql += values.join(',\n');
          sql += ';\n\n';
        }

        sql += `-- Re-enable foreign key checks\n`;
        sql += `SET FOREIGN_KEY_CHECKS = 1;\n`;

        // Write to file
        const filename = path.join(EXPORT_DIR, `${tableName}.sql`);
        fs.writeFileSync(filename, sql, 'utf8');

        console.log(`   ✅ Exported ${rows.length} rows to ${tableName}.sql\n`);
        exportSummary.push({ table: tableName, rows: rows.length, status: 'success' });
        totalRows += rows.length;

      } catch (error) {
        console.error(`   ❌ Error exporting ${tableName}:`, error.message, '\n');
        exportSummary.push({ table: tableName, rows: 0, status: 'error', error: error.message });
      }
    }

    // Create a combined import file
    console.log('📦 Creating combined import file...');
    let combinedSql = `-- Combined data export for Railway import\n`;
    combinedSql += `-- Exported on ${new Date().toISOString()}\n`;
    combinedSql += `-- Total rows: ${totalRows}\n\n`;
    combinedSql += `SET FOREIGN_KEY_CHECKS = 0;\n`;
    combinedSql += `SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";\n\n`;

    for (const tableName of TABLES) {
      const filename = path.join(EXPORT_DIR, `${tableName}.sql`);
      if (fs.existsSync(filename)) {
        const content = fs.readFileSync(filename, 'utf8');
        combinedSql += content + '\n\n';
      }
    }

    combinedSql += `SET FOREIGN_KEY_CHECKS = 1;\n`;
    
    const combinedFile = path.join(EXPORT_DIR, 'all-data.sql');
    fs.writeFileSync(combinedFile, combinedSql, 'utf8');
    console.log(`✅ Created combined file: all-data.sql\n`);

    // Print summary
    console.log('=' .repeat(60));
    console.log('📊 EXPORT SUMMARY');
    console.log('='.repeat(60));
    
    exportSummary.forEach(({ table, rows, status, error }) => {
      const statusIcon = status === 'success' ? '✅' : status === 'empty' ? 'ℹ️' : '❌';
      const errorMsg = error ? ` (${error})` : '';
      console.log(`${statusIcon} ${table.padEnd(30)} ${rows.toString().padStart(6)} rows${errorMsg}`);
    });
    
    console.log('='.repeat(60));
    console.log(`📦 Total rows exported: ${totalRows}`);
    console.log(`📁 Files saved to: ${EXPORT_DIR}`);
    console.log('='.repeat(60));
    
    console.log('\n✅ Export completed successfully!');
    console.log('\n📝 Next steps:');
    console.log('   1. Review the exported files in:', EXPORT_DIR);
    console.log('   2. Run: node import-to-railway.js');
    console.log('   Or manually upload all-data.sql to Railway\n');

    await connection.end();
    process.exit(0);

  } catch (error) {
    console.error('\n❌ Export failed:', error.message);
    console.error('\n📝 Error details:', error);
    
    if (error.code === 'ER_ACCESS_DENIED_ERROR') {
      console.error('\n🔐 Access denied. Check your local database credentials in this script.');
    } else if (error.code === 'ECONNREFUSED') {
      console.error('\n🔌 Connection refused. Make sure:');
      console.error('   - WAMP/MySQL is running');
      console.error('   - Database name is correct');
    } else if (error.code === 'ER_BAD_DB_ERROR') {
      console.error('\n📂 Database not found. Update LOCAL_CONFIG.database in this script.');
    }

    if (connection) {
      await connection.end();
    }
    process.exit(1);
  }
}

// Run export
exportData();
