import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config();

// TiDB Cloud (and most hosted MySQL) require an encrypted connection: DB_SSL=true
export function dbSsl(prefix = 'DB'): any {
  const on = (process.env[`${prefix}_SSL`] || '').toLowerCase();
  if (on === 'true' || on === '1' || on === 'required') return { minVersion: 'TLSv1.2', rejectUnauthorized: true };
  return undefined;
}

export function dbConfig(prefix = 'DB') {
  return {
    host: process.env[`${prefix}_HOST`] || 'localhost',
    user: process.env[`${prefix}_USER`] || 'root',
    password: process.env[`${prefix}_PASSWORD`] || '',
    database: process.env[`${prefix}_NAME`] || 'word_of_covenant_db',
    port: parseInt(process.env[`${prefix}_PORT`] || '3306'),
    ssl: dbSsl(prefix),
  };
}

const pool = mysql.createPool({
  ...dbConfig('DB'),
  waitForConnections: true,
  // the free database allows 5 connections in total; keep room for the setup step and for the next deploy
  connectionLimit: Number(process.env.DB_POOL_SIZE) || 3,
  queueLimit: 0,
  connectTimeout: 30000,
  enableKeepAlive: true,
  keepAliveInitialDelay: 0
});

// Test connection
pool.getConnection()
  .then(connection => {
    console.log('✅ MySQL Database connected successfully');
    connection.release();
  })
  .catch(err => {
    console.error('❌ MySQL connection failed:', err.message);
  });

export default pool;
