import mysql from 'mysql2/promise';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import { dbConfig } from '../config/database';
import { migrateFromOldDatabase } from './migrate';
import { ensureCmsTables } from './cms';
import bcrypt from 'bcryptjs';

dotenv.config();

export async function initializeDatabase() {
  let connection;
  
  try {
    console.log('🔄 Checking database tables...');
    
    // Connect to the database
    // first start on a new database: bring the church's data across from the old one
    await migrateFromOldDatabase();

    connection = await mysql.createConnection({
      ...dbConfig('DB'),
      multipleStatements: true,
      connectTimeout: 60000
    });

    console.log('✅ Connected to database:', process.env.DB_NAME || 'railway');

    // Check if tables exist by checking for the users table
    const [tables] = await connection.query(
      "SHOW TABLES LIKE 'users'"
    );

    if (Array.isArray(tables) && tables.length === 0) {
      console.log('📋 No tables found. Running initial setup...');
      
      // Read schema file
      const schemaPath = path.join(__dirname, 'schema.sql');
      
      if (!fs.existsSync(schemaPath)) {
        console.error('❌ Schema file not found at:', schemaPath);
        return;
      }
      
      const schema = fs.readFileSync(schemaPath, 'utf8');

      console.log('🔄 Creating database tables...');
      await connection.query(schema);

      console.log('✅ Database tables created successfully!');
      console.log('⚠️  A default admin was created by the schema: log in and change its password at once.');
    } else {
      console.log('✅ Database tables already exist');
    }

    // Tables and columns used by Church Studio publishing (added safely to older databases)
    await connection.query(`CREATE TABLE IF NOT EXISTS site_settings (
      k VARCHAR(64) PRIMARY KEY, v TEXT, updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) DEFAULT CHARSET=utf8mb4`);
    await secureAccounts(connection);
    await ensureCmsTables(connection);

    for (const [table, column] of [['events', 'studio_id VARCHAR(64) NULL'], ['sermons', 'studio_id VARCHAR(80) NULL'], ['events', 'end_date DATE NULL']]) {
      try { await connection.query(`ALTER TABLE ${table} ADD COLUMN ${column}`); }
      catch (e: any) { if (!/Duplicate column|exists/i.test(e.message)) console.warn(`⚠️  ${table}: ${e.message}`); }
    }
    
    await connection.end();
  } catch (error: any) {
    console.error('❌ Database initialization error:', error.message);
    if (error.code === 'PROTOCOL_CONNECTION_LOST') {
      console.error('⚠️  Connection to database lost');
    } else if (error.code === 'ER_CON_COUNT_ERROR') {
      console.error('⚠️  Too many database connections');
    } else if (error.code === 'ECONNREFUSED') {
      console.error('⚠️  Database connection refused - check host and port');
    }
    if (connection) {
      await connection.end();
    }
    // Don't exit process, just log the error
    // The app can still start and will fail when trying to use DB
  }
}


/**
 * Account safety, on every start:
 *  - ADMIN_EMAIL (if set) is made a super admin, so the church always has a working admin.
 *  - Any admin account still using a well-known password (e.g. the old default "admin123") is switched off.
 */
async function secureAccounts(connection: any) {
  try {
    const owner = (process.env.ADMIN_EMAIL || '').trim().toLowerCase();
    if (owner) {
      const [r]: any = await connection.query("UPDATE users SET role = 'super_admin', is_approved = 1 WHERE LOWER(email) = ?", [owner]);
      if (r.affectedRows) console.log('👑 Super admin:', owner);
    }
    const weak = ['admin123', 'admin', 'password', '123456', '12345678', 'admin1234', 'church123'];
    const [admins]: any = await connection.query("SELECT id, email, password FROM users WHERE role IN ('admin', 'super_admin', 'pastor', 'media') AND is_approved = 1");
    for (const u of admins) {
      if (!u.password || (owner && String(u.email).toLowerCase() === owner)) continue;
      if (weak.some(w => { try { return bcrypt.compareSync(w, u.password); } catch (e) { return false; } })) {
        await connection.query('UPDATE users SET is_approved = 0 WHERE id = ?', [u.id]);
        console.warn('🔒 Switched off', u.email, '- it used a well-known password. Give it a new password before switching it back on.');
      }
    }
  } catch (e: any) { console.warn('⚠️  Account safety check:', e.message); }
}
