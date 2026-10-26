import mysql from 'mysql2/promise';
import { dbConfig } from '../config/database';

/**
 * One-time copy of the church's data from the old database (OLD_DB_*) into the new one (DB_*).
 * Runs at start-up only when OLD_DB_HOST is set and the copy hasn't been done yet.
 * Safe to run again: it creates missing tables and inserts missing rows only (INSERT IGNORE).
 */
export async function migrateFromOldDatabase(): Promise<void> {
  if (!process.env.OLD_DB_HOST) return;
  let oldDb: mysql.Connection | null = null, newDb: mysql.Connection | null = null;
  try {
    const target = dbConfig('DB');
    // the new database may not exist yet (TiDB starts with "test")
    const boot = await mysql.createConnection({ ...target, database: undefined as any, connectTimeout: 60000 });
    await boot.query(`CREATE DATABASE IF NOT EXISTS \`${target.database}\``);
    await boot.end();
    newDb = await mysql.createConnection({ ...target, connectTimeout: 60000, multipleStatements: true });
    await newDb.query('CREATE TABLE IF NOT EXISTS _data_migration (id INT PRIMARY KEY, done_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, note TEXT)');
    const [done]: any = await newDb.query('SELECT * FROM _data_migration WHERE id = 1');
    if (done.length) { console.log('ℹ️  Data was already copied from the old database on', done[0].done_at); return; }

    console.log('🚚 Copying data from the old database…');
    oldDb = await mysql.createConnection({ ...dbConfig('OLD_DB'), connectTimeout: 60000 });
    await newDb.query('SET FOREIGN_KEY_CHECKS = 0');
    const [tables]: any = await oldDb.query('SHOW FULL TABLES WHERE Table_type = "BASE TABLE"');
    const names: string[] = tables.map((t: any) => Object.values(t)[0] as string).filter((n: string) => n !== '_data_migration');
    let total = 0;
    for (const name of names) {
      const [[create]]: any = await oldDb.query(`SHOW CREATE TABLE \`${name}\``);
      let sql: string = create['Create Table'];
      sql = sql.replace(/^CREATE TABLE/, 'CREATE TABLE IF NOT EXISTS').replace(/ AUTO_INCREMENT=\d+/, '');
      try { await newDb.query(sql); } catch (e: any) { console.error(`   ⚠️  ${name}: could not create table (${e.message})`); continue; }
      let offset = 0, copied = 0;
      for (;;) {
        const [rows]: any = await oldDb.query(`SELECT * FROM \`${name}\` LIMIT 500 OFFSET ${offset}`);
        if (!rows.length) break;
        const cols = Object.keys(rows[0]);
        const values = rows.map((r: any) => cols.map(c => r[c]));
        await newDb.query(`INSERT IGNORE INTO \`${name}\` (${cols.map(c => '`' + c + '`').join(',')}) VALUES ?`, [values]);
        copied += rows.length; offset += rows.length;
        if (rows.length < 500) break;
      }
      // keep new ids after the old ones
      try { const [[mx]]: any = await newDb.query(`SELECT MAX(id) AS m FROM \`${name}\``); if (mx && mx.m) await newDb.query(`ALTER TABLE \`${name}\` AUTO_INCREMENT = ${Number(mx.m) + 1}`); } catch (e) { /* table without id */ }
      total += copied;
      console.log(`   ✅ ${name}: ${copied} rows`);
    }
    await newDb.query('SET FOREIGN_KEY_CHECKS = 1');
    await newDb.query('INSERT INTO _data_migration (id, note) VALUES (1, ?)', [`${names.length} tables, ${total} rows`]);
    console.log(`🎉 Copied ${names.length} tables and ${total} rows from the old database.`);
  } catch (e: any) {
    console.error('❌ Copying from the old database failed:', e.message);
  } finally {
    try { await oldDb?.end(); } catch (e) { /* ignore */ }
    try { await newDb?.end(); } catch (e) { /* ignore */ }
  }
}
