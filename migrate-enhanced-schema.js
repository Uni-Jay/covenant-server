const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');

const config = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'word_of_covenant_db',
  multipleStatements: true
};

async function migrate() {
  let connection;
  
  try {
    console.log('Connecting to database...');
    connection = await mysql.createConnection(config);
    
    console.log('Reading enhanced schema file...');
    const schemaPath = path.join(__dirname, 'src', 'database', 'enhanced-schema.sql');
    const schema = fs.readFileSync(schemaPath, 'utf8');
    
    console.log('Executing migration...');
    await connection.query(schema);
    
    console.log('✅ Enhanced schema migration completed successfully!');
    console.log('\nNew features added:');
    console.log('- Extended user roles (10 roles)');
    console.log('- Chat messages and groups');
    console.log('- Bible translations and verses');
    console.log('- Hymns and worship setlists');
    console.log('- Counseling sessions');
    console.log('- Event registrations');
    console.log('- Documents/letterheads');
    console.log('- Department tasks');
    console.log('- Attendance tracking');
    console.log('- Feed posts with likes/comments');
    console.log('- Notifications');
    console.log('- Audit logs');
    
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

migrate();
