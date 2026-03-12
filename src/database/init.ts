import mysql from 'mysql2/promise';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

dotenv.config();

export async function initializeDatabase() {
  let connection;
  
  try {
    console.log('🔄 Checking database tables...');
    
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
      console.log('👤 Default admin: admin@wordofcovenant.org / admin123');
    } else {
      console.log('✅ Database tables already exist');
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
