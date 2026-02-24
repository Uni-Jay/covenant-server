const mysql = require('mysql2/promise');
require('dotenv').config();

async function addDonationTypeColumn() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'church_db'
  });

  try {
    console.log('Adding donation_type column to donations table...');

    // Check if column exists
    const [columns] = await connection.execute(`
      SELECT COLUMN_NAME 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'donations' 
      AND COLUMN_NAME = 'donation_type'
    `, [process.env.DB_NAME || 'church_db']);

    if (columns.length === 0) {
      // Add donation_type column
      await connection.execute(`
        ALTER TABLE donations 
        ADD COLUMN donation_type VARCHAR(50) DEFAULT 'General' AFTER purpose
      `);
      console.log('✓ Added donation_type column');
      
      // Update existing records with default value
      await connection.execute(`
        UPDATE donations 
        SET donation_type = COALESCE(purpose, 'General')
        WHERE donation_type IS NULL
      `);
      console.log('✓ Updated existing records with default donation_type');
    } else {
      console.log('✓ donation_type column already exists');
    }

    console.log('\n✅ Donation type column setup complete!');

  } catch (error) {
    console.error('❌ Error adding donation_type column:', error);
    throw error;
  } finally {
    await connection.end();
  }
}

// Run the migration
addDonationTypeColumn().catch(error => {
  console.error('Migration failed:', error);
  process.exit(1);
});
