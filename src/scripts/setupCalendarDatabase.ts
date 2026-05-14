/**
 * Database Migration for Calendar System
 * Run this to set up calendar tables and reminders infrastructure
 */

import pool from '../config/database';

export const setupCalendarDatabase = async () => {
  try {
    console.log('📅 Setting up calendar database tables...');

    // Create calendar_events table
    await pool.execute(`
      CREATE TABLE IF NOT EXISTS calendar_events (
        id INT AUTO_INCREMENT PRIMARY KEY,
        title VARCHAR(255) NOT NULL,
        description LONGTEXT,
        event_date DATETIME NOT NULL,
        event_type ENUM('activity', 'birthday', 'service', 'meeting', 'anniversary') DEFAULT 'activity',
        notes LONGTEXT,
        created_by INT NOT NULL,
        is_active TINYINT(1) DEFAULT 1,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (created_by) REFERENCES users(id),
        INDEX idx_event_date (event_date),
        INDEX idx_event_type (event_type),
        INDEX idx_is_active (is_active),
        INDEX idx_created_by (created_by)
      );
    `);

    console.log('✅ calendar_events table created');

    // Create reminder_logs table
    await pool.execute(`
      CREATE TABLE IF NOT EXISTS reminder_logs (
        id INT AUTO_INCREMENT PRIMARY KEY,
        event_id INT NOT NULL,
        user_id INT NOT NULL,
        reminder_type ENUM('event', 'birthday') DEFAULT 'event',
        days_remaining INT,
        sent_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (event_id) REFERENCES calendar_events(id),
        FOREIGN KEY (user_id) REFERENCES users(id),
        INDEX idx_event_id (event_id),
        INDEX idx_user_id (user_id),
        INDEX idx_sent_at (sent_at),
        UNIQUE KEY unique_daily_reminder (event_id, user_id, DATE(sent_at))
      );
    `);

    console.log('✅ reminder_logs table created');

    // Create birthday_greetings_sent table
    await pool.execute(`
      CREATE TABLE IF NOT EXISTS birthday_greetings_sent (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        sent_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id),
        INDEX idx_user_id (user_id),
        INDEX idx_sent_at (sent_at),
        UNIQUE KEY unique_daily_birthday (user_id, DATE(sent_at))
      );
    `);

    console.log('✅ birthday_greetings_sent table created');

    // Create user_settings table (for birthday visibility)
    await pool.execute(`
      CREATE TABLE IF NOT EXISTS user_settings (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT UNIQUE NOT NULL,
        show_birthday TINYINT(1) DEFAULT 1,
        notification_email TINYINT(1) DEFAULT 1,
        notification_whatsapp TINYINT(1) DEFAULT 1,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id),
        INDEX idx_user_id (user_id)
      );
    `);

    console.log('✅ user_settings table created');

    // Create whatsapp_logs table
    await pool.execute(`
      CREATE TABLE IF NOT EXISTS whatsapp_logs (
        id INT AUTO_INCREMENT PRIMARY KEY,
        phone_number VARCHAR(20) NOT NULL,
        message TEXT NOT NULL,
        status ENUM('sent', 'pending', 'failed') DEFAULT 'pending',
        message_id VARCHAR(100),
        error_message TEXT,
        sent_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_phone_number (phone_number),
        INDEX idx_status (status),
        INDEX idx_sent_at (sent_at)
      );
    `);

    console.log('✅ whatsapp_logs table created');

    console.log('✅ All calendar tables created successfully!');
    return true;

  } catch (error) {
    console.error('❌ Error setting up calendar database:', error);
    throw error;
  }
};
