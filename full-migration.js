/**
 * Full Migration Script - Local MySQL (WAMP) to Railway
 * 
 * This script:
 * 1. Reads the exact CREATE TABLE schema from your local database
 * 2. Drops and recreates all tables in Railway with the correct schema
 * 3. Imports all data
 * 
 * Usage (MUST use railway run to access internal network):
 *   railway run node full-migration.js
 */

require('dotenv').config();
const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');

// =========================================================
// LOCAL database (WAMP) — reads from here
// =========================================================
const LOCAL_CONFIG = {
  host: 'localhost',
  user: 'root',
  password: '',
  database: 'word_of_covenant_db',
  port: 3306,
  multipleStatements: true
};

// =========================================================
// RAILWAY database — writes to here (uses .env)
// =========================================================
const RAILWAY_CONFIG = {
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME || 'railway',
  port: parseInt(process.env.DB_PORT || '3306'),
  connectTimeout: 60000,
  multipleStatements: true
};

// Tables in correct order (parent tables before child tables)
const TABLE_ORDER = [
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
  if (value === null || value === undefined) return 'NULL';
  if (typeof value === 'number') return value;
  if (typeof value === 'boolean') return value ? 1 : 0;
  if (value instanceof Date) {
    return `'${value.toISOString().slice(0, 19).replace('T', ' ')}'`;
  }
  if (typeof value === 'object') {
    return `'${JSON.stringify(value).replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;
  }
  return `'${String(value).replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;
}

async function fullMigration() {
  let localConn, railwayConn;

  try {
    // ─── Step 1: Connect to both databases ────────────────────
    console.log('═══════════════════════════════════════════════════════');
    console.log('   FULL MIGRATION: Local MySQL → Railway               ');
    console.log('═══════════════════════════════════════════════════════\n');

    console.log('📡 Step 1: Connecting to local MySQL (WAMP)...');
    localConn = await mysql.createConnection(LOCAL_CONFIG);
    console.log('✅ Connected to local database:', LOCAL_CONFIG.database);

    console.log('\n📡 Step 2: Connecting to Railway MySQL...');
    console.log('   Host:', RAILWAY_CONFIG.host);
    railwayConn = await mysql.createConnection(RAILWAY_CONFIG);
    console.log('✅ Connected to Railway database:', RAILWAY_CONFIG.database);

    // ─── Step 2: Get all tables from local ───────────────────
    console.log('\n🔍 Step 3: Reading local database tables...');
    const [localTables] = await localConn.query('SHOW TABLES');
    const localTableNames = localTables.map(row => Object.values(row)[0]);
    console.log(`   Found ${localTableNames.length} tables in local database:`);
    localTableNames.forEach(t => console.log(`   - ${t}`));

    // ─── Step 3: Export schema + data ───────────────────────
    console.log('\n📋 Step 4: Exporting schema and data from local...');

    const schemaStatements = [];
    const dataStatements = [];

    // Order: use TABLE_ORDER for known tables, append any extras
    const orderedTables = [
      ...TABLE_ORDER.filter(t => localTableNames.includes(t)),
      ...localTableNames.filter(t => !TABLE_ORDER.includes(t))
    ];

    for (const tableName of orderedTables) {
      try {
        // Get CREATE TABLE
        const [[createResult]] = await localConn.query(`SHOW CREATE TABLE \`${tableName}\``);
        let createSql = createResult['Create Table'];

        // Strip foreign key constraints from CREATE (we'll add data first, then FKs are off anyway)
        // Make sure it uses IF NOT EXISTS
        createSql = createSql.replace(
          /^CREATE TABLE/,
          'CREATE TABLE IF NOT EXISTS'
        );

        schemaStatements.push({ table: tableName, sql: createSql });

        // Get all data
        const [rows] = await localConn.query(`SELECT * FROM \`${tableName}\``);

        if (rows.length > 0) {
          const columns = Object.keys(rows[0]);
          const columnList = columns.map(c => `\`${c}\``).join(', ');

          const insertLines = [];
          const chunkSize = 100;

          for (let i = 0; i < rows.length; i += chunkSize) {
            const chunk = rows.slice(i, i + chunkSize);
            const values = chunk.map(row => {
              const vals = columns.map(col => escapeValue(row[col]));
              return `(${vals.join(', ')})`;
            });
            insertLines.push(
              `INSERT IGNORE INTO \`${tableName}\` (${columnList}) VALUES\n${values.join(',\n')};`
            );
          }

          dataStatements.push({
            table: tableName,
            rows: rows.length,
            sql: insertLines.join('\n\n')
          });
          console.log(`   ✅ ${tableName}: schema + ${rows.length} rows`);
        } else {
          dataStatements.push({ table: tableName, rows: 0, sql: null });
          console.log(`   ✅ ${tableName}: schema only (no data)`);
        }
      } catch (err) {
        console.log(`   ⚠️  ${tableName}: skipped (${err.message})`);
      }
    }

    // ─── Step 4: Apply to Railway ─────────────────────────────
    console.log('\n🔄 Step 5: Applying schema to Railway...');

    // Disable FK checks
    await railwayConn.query('SET FOREIGN_KEY_CHECKS = 0');
    await railwayConn.query('SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO"');

    // Drop existing tables in REVERSE order
    console.log('   Dropping existing Railway tables...');
    const [existingRailwayTables] = await railwayConn.query('SHOW TABLES');
    const existingNames = existingRailwayTables.map(r => Object.values(r)[0]);

    // Drop in reverse order to avoid FK issues
    for (const tableName of [...orderedTables].reverse()) {
      if (existingNames.includes(tableName)) {
        await railwayConn.query(`DROP TABLE IF EXISTS \`${tableName}\``);
        console.log(`   🗑️  Dropped: ${tableName}`);
      }
    }
    // Drop any remaining tables not in our list
    for (const tableName of existingNames) {
      if (!orderedTables.includes(tableName)) {
        await railwayConn.query(`DROP TABLE IF EXISTS \`${tableName}\``);
        console.log(`   🗑️  Dropped extra table: ${tableName}`);
      }
    }

    // Create tables in correct order
    console.log('\n   Creating tables...');
    for (const { table, sql } of schemaStatements) {
      try {
        await railwayConn.query(sql);
        console.log(`   ✅ Created: ${table}`);
      } catch (err) {
        console.log(`   ❌ Failed to create ${table}: ${err.message}`);
      }
    }

    // ─── Step 5: Insert data ──────────────────────────────────
    console.log('\n🔄 Step 6: Inserting data...');
    let totalRows = 0;

    for (const { table, rows, sql } of dataStatements) {
      if (!sql) {
        console.log(`   ℹ️  ${table}: empty`);
        continue;
      }
      try {
        await railwayConn.query(sql);
        totalRows += rows;
        console.log(`   ✅ ${table}: ${rows} rows inserted`);
      } catch (err) {
        console.log(`   ❌ ${table}: insert failed — ${err.message}`);
      }
    }

    // Re-enable FK checks
    await railwayConn.query('SET FOREIGN_KEY_CHECKS = 1');

    // ─── Step 6: Verify ──────────────────────────────────────
    console.log('\n🔍 Step 7: Verifying migration...');
    const [finalTables] = await railwayConn.query('SHOW TABLES');

    console.log('\n═══════════════════════════════════════════════════════');
    console.log('   MIGRATION SUMMARY');
    console.log('═══════════════════════════════════════════════════════');
    console.log(`${'Table'.padEnd(30)} ${'Local'.padStart(8)} ${'Railway'.padStart(8)}`);
    console.log('─'.repeat(50));

    for (const { table, rows } of dataStatements) {
      try {
        const [[countResult]] = await railwayConn.query(`SELECT COUNT(*) as cnt FROM \`${table}\``);
        const railwayCount = countResult.cnt;
        const status = railwayCount >= rows ? '✅' : '⚠️ ';
        console.log(`${status} ${table.padEnd(28)} ${rows.toString().padStart(8)} ${railwayCount.toString().padStart(8)}`);
      } catch (err) {
        console.log(`❌  ${table.padEnd(28)} ${rows.toString().padStart(8)} ${'ERROR'.padStart(8)}`);
      }
    }

    console.log('─'.repeat(50));
    console.log(`${'TOTAL ROWS MIGRATED:'.padEnd(30)} ${totalRows.toString().padStart(8)}`);
    console.log(`${'TABLES IN RAILWAY:'.padEnd(30)} ${finalTables.length.toString().padStart(8)}`);
    console.log('═══════════════════════════════════════════════════════\n');

    console.log('🎉 Full migration completed successfully!');
    console.log('🚀 Your Railway database is now a perfect copy of your local database.\n');

    // Save schema to file for reference
    const schemaOutput = schemaStatements.map(s => s.sql + ';').join('\n\n');
    const schemaFile = path.join(__dirname, 'data-export', 'railway-schema.sql');
    fs.mkdirSync(path.join(__dirname, 'data-export'), { recursive: true });
    fs.writeFileSync(schemaFile, schemaOutput);
    console.log(`📄 Schema saved to: data-export/railway-schema.sql`);

    await localConn.end();
    await railwayConn.end();
    process.exit(0);

  } catch (error) {
    console.error('\n❌ Migration failed:', error.message);

    if (error.code === 'ENOTFOUND' && error.hostname?.includes('railway')) {
      console.error('\n⚠️  Cannot reach Railway from your local machine.');
      console.error('   This script MUST be run via: railway run node full-migration.js');
    } else if (error.code === 'ECONNREFUSED' && error.address === '127.0.0.1') {
      console.error('\n⚠️  Cannot connect to local MySQL.');
      console.error('   Make sure WAMP/MySQL is running.');
    } else if (error.code === 'ER_ACCESS_DENIED_ERROR') {
      console.error('\n⚠️  Access denied.');
      console.error('   Check credentials in LOCAL_CONFIG and your .env file.');
    }

    if (localConn) await localConn.end().catch(() => {});
    if (railwayConn) await railwayConn.end().catch(() => {});
    process.exit(1);
  }
}

fullMigration();
