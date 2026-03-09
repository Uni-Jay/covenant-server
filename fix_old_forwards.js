// Script to fix all old forwarded messages in the chat_messages table
// Usage: node fix_old_forwards.js
require('dotenv').config();
const mysql = require('mysql2/promise');

async function main() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    port: process.env.DB_PORT || 3306,
  });

  // 1. Find all messages with missing media_url/media_type but with a filename in message (likely old forwards)
  const [rows] = await connection.execute(`
    SELECT id, message
    FROM chat_messages
    WHERE (media_url IS NULL OR media_url = '' OR media_type IS NULL OR media_type = '')
      AND message REGEXP '\\.(mp3|m4a|aac|wav|ogg|mp4|mov|jpg|jpeg|png|gif|pdf|docx|xlsx|pptx|txt)$'
  `);

  let updated = 0;
  for (const row of rows) {
    const filename = row.message.trim();
    let media_type = '';
    if (filename.match(/\.(mp3|m4a|aac|wav|ogg)$/i)) media_type = 'audio';
    else if (filename.match(/\.(mp4|mov)$/i)) media_type = 'video';
    else if (filename.match(/\.(jpg|jpeg|png|gif)$/i)) media_type = 'image';
    else if (filename.match(/\.(pdf|docx|xlsx|pptx|txt)$/i)) media_type = 'file';
    else continue;
    // Assume media_url is uploads/<filename>
    const media_url = `uploads/${filename}`;
    await connection.execute(
      'UPDATE chat_messages SET media_url = ?, media_type = ? WHERE id = ?',
      [media_url, media_type, row.id]
    );
    updated++;
  }
  await connection.end();
  console.log(`Fixed ${updated} old forwarded messages!`);
}

main().catch(e => { console.error(e); process.exit(1); });
