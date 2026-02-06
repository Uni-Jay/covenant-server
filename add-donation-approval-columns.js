const mysql = require('mysql2/promise');
require('dotenv').config();

async function addDonationApprovalColumns() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'church_db'
  });

  try {
    console.log('Adding approval columns to donations table...');

    // Check if columns exist
    const [columns] = await connection.execute(`
      SELECT COLUMN_NAME 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'donations' 
      AND COLUMN_NAME IN ('approved_by', 'approved_at')
    `, [process.env.DB_NAME || 'church_db']);

    const existingColumns = columns.map((col) => col.COLUMN_NAME);

    // Add approved_by column
    if (!existingColumns.includes('approved_by')) {
      await connection.execute(`
        ALTER TABLE donations 
        ADD COLUMN approved_by INT NULL,
        ADD FOREIGN KEY (approved_by) REFERENCES users(id) ON DELETE SET NULL
      `);
      console.log('✓ Added approved_by column');
    } else {
      console.log('✓ approved_by column already exists');
    }

    // Add approved_at column
    if (!existingColumns.includes('approved_at')) {
      await connection.execute(`
        ALTER TABLE donations 
        ADD COLUMN approved_at DATETIME NULL
      `);
      console.log('✓ Added approved_at column');
    } else {
      console.log('✓ approved_at column already exists');
    }

    console.log('\n✅ Donation approval columns setup complete!');

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await connection.end();
  }
}

addDonationApprovalColumns();
