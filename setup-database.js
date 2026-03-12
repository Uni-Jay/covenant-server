const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

async function setupDatabase() {
  try {
    console.log('🔄 Connecting to MySQL...');
    
    // Connect without database first
    const connection = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      port: parseInt(process.env.DB_PORT || '3306'),
      multipleStatements: true
    });

    console.log('✅ Connected to MySQL');

    // Read and execute schema file
    const schemaPath = path.join(__dirname, 'src', 'database', 'schema.sql');
    const schema = fs.readFileSync(schemaPath, 'utf8');

    console.log('🔄 Executing database schema...');
    await connection.query(schema);

    console.log('✅ Database setup completed successfully!');
    console.log('📊 Database:', process.env.DB_NAME || 'railway');
    console.log('👤 Default admin: admin@wordofcovenant.org / admin123');
    
    await connection.end();
  } catch (error) {
    console.error('❌ Database setup failed:', error.message);
    process.exit(1);
  }
}

setupDatabase();
