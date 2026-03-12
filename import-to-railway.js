/**
 * Import data to Railway MySQL database
 * 
 * This script imports the exported data from local MySQL to Railway.
 * Make sure you've run export-local-data.js first.
 * 
 * Usage: node import-to-railway.js
 * Or: railway run node import-to-railway.js
 */

require('dotenv').config();
const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');

const EXPORT_DIR = path.join(__dirname, 'data-export');
const COMBINED_FILE = path.join(EXPORT_DIR, 'all-data.sql');

async function importData() {
  let connection;
  
  try {
    console.log('🔄 Starting data import to Railway...');
    
    // Check if export file exists
    if (!fs.existsSync(COMBINED_FILE)) {
      console.error('❌ Export file not found:', COMBINED_FILE);
      console.error('\n📝 Please run export-local-data.js first to export your local data.');
      process.exit(1);
    }

    console.log('📖 Reading export file...');
    const sqlContent = fs.readFileSync(COMBINED_FILE, 'utf8');
    
    console.log('\n🔄 Connecting to Railway database...');
    console.log('   Host:', process.env.DB_HOST);
    console.log('   Database:', process.env.DB_NAME || 'railway');
    
    connection = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || 'railway',
      port: parseInt(process.env.DB_PORT || '3306'),
      multipleStatements: true,
      connectTimeout: 60000 // 60 seconds for Railway
    });

    console.log('✅ Connected to Railway database\n');

    // Check if tables exist
    console.log('🔍 Checking if tables exist...');
    const [tables] = await connection.query('SHOW TABLES');
    
    if (tables.length === 0) {
      console.log('⚠️  No tables found. Running schema setup first...\n');
      
      const schemaPath = path.join(__dirname, 'src', 'database', 'schema.sql');
      if (fs.existsSync(schemaPath)) {
        console.log('📖 Reading schema file...');
        const schema = fs.readFileSync(schemaPath, 'utf8');
        
        console.log('🔄 Creating tables...');
        await connection.query(schema);
        console.log('✅ Tables created\n');
      } else {
        console.error('❌ Schema file not found. Please ensure tables exist first.');
        process.exit(1);
      }
    } else {
      console.log(`✅ Found ${tables.length} tables\n`);
    }

    // Get row counts before import
    console.log('📊 Checking existing data...');
    const beforeCounts = {};
    const tableNames = tables.map(row => Object.values(row)[0]);
    
    for (const tableName of tableNames) {
      try {
        const [result] = await connection.query(`SELECT COUNT(*) as count FROM \`${tableName}\``);
        beforeCounts[tableName] = result[0].count;
      } catch (err) {
        beforeCounts[tableName] = 0;
      }
    }

    // Import data
    console.log('\n🔄 Importing data...');
    console.log('⏱️  This may take a few minutes...\n');
    
    await connection.query(sqlContent);
    
    console.log('✅ Data imported successfully!\n');

    // Get row counts after import
    console.log('📊 Verifying import...');
    const afterCounts = {};
    
    for (const tableName of tableNames) {
      try {
        const [result] = await connection.query(`SELECT COUNT(*) as count FROM \`${tableName}\``);
        afterCounts[tableName] = result[0].count;
      } catch (err) {
        afterCounts[tableName] = 0;
      }
    }

    // Print summary
    console.log('\n' + '='.repeat(70));
    console.log('📊 IMPORT SUMMARY');
    console.log('='.repeat(70));
    console.log('Table Name'.padEnd(30) + 'Before'.padStart(10) + 'After'.padStart(10) + 'Added'.padStart(10));
    console.log('-'.repeat(70));
    
    let totalBefore = 0;
    let totalAfter = 0;
    
    for (const tableName of tableNames) {
      const before = beforeCounts[tableName] || 0;
      const after = afterCounts[tableName] || 0;
      const added = after - before;
      
      totalBefore += before;
      totalAfter += after;
      
      if (added > 0) {
        console.log(
          `✅ ${tableName.padEnd(27)}${before.toString().padStart(10)}${after.toString().padStart(10)}${('+' + added).padStart(10)}`
        );
      } else if (after > 0) {
        console.log(
          `ℹ️  ${tableName.padEnd(27)}${before.toString().padStart(10)}${after.toString().padStart(10)}${added.toString().padStart(10)}`
        );
      }
    }
    
    console.log('-'.repeat(70));
    console.log(
      `TOTAL:`.padEnd(30) + 
      totalBefore.toString().padStart(10) + 
      totalAfter.toString().padStart(10) + 
      ('+' + (totalAfter - totalBefore)).padStart(10)
    );
    console.log('='.repeat(70));

    console.log('\n🎉 Import completed successfully!');
    console.log(`📊 Total rows in database: ${totalAfter}`);
    console.log(`📈 Rows added: ${totalAfter - totalBefore}\n`);

    await connection.end();
    process.exit(0);

  } catch (error) {
    console.error('\n❌ Import failed:', error.message);
    console.error('\n📝 Error details:', error);
    
    if (error.code === 'ER_ACCESS_DENIED_ERROR') {
      console.error('\n🔐 Access denied. Check your Railway database credentials.');
      console.error('   Make sure .env has correct Railway MySQL credentials.');
    } else if (error.code === 'ECONNREFUSED') {
      console.error('\n🔌 Connection refused. Check:');
      console.error('   - DB_HOST is correct');
      console.error('   - DB_PORT is correct');
      console.error('   - Railway MySQL service is running');
    } else if (error.code === 'ER_DUP_ENTRY') {
      console.error('\n⚠️  Duplicate entry found. Some data may already exist.');
      console.error('   The script uses INSERT IGNORE, so duplicates are skipped.');
      console.error('   This is expected if you run the import multiple times.');
    } else if (error.code === 'ER_NO_SUCH_TABLE') {
      console.error('\n📋 Table not found. Make sure tables are created first.');
      console.error('   Run: node migrate-railway.js');
    }

    if (connection) {
      await connection.end();
    }
    process.exit(1);
  }
}

// Run import
importData();
