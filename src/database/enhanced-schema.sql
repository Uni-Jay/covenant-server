-- Enhanced Word of Covenant Church Database Schema with All Features

USE word_of_covenant_db;

-- Update users table with enhanced roles and fields
ALTER TABLE users 
MODIFY COLUMN role ENUM(
  'member', 'pastor', 'elder', 'deacon', 'secretary', 
  'media', 'media_head', 'finance', 'choir', 'department_head', 'super_admin'
) DEFAULT 'member';

-- Add new columns to users table (ignoring errors if they exist)
SET @sql1 = IF((SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE table_schema = 'word_of_covenant_db' AND table_name = 'users' AND column_name = 'is_active') = 0, 'ALTER TABLE users ADD COLUMN is_active BOOLEAN DEFAULT TRUE', 'SELECT "is_active exists"');
PREPARE stmt1 FROM @sql1; EXECUTE stmt1; DEALLOCATE PREPARE stmt1;

SET @sql2 = IF((SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE table_schema = 'word_of_covenant_db' AND table_name = 'users' AND column_name = 'is_approved') = 0, 'ALTER TABLE users ADD COLUMN is_approved BOOLEAN DEFAULT FALSE', 'SELECT "is_approved exists"');
PREPARE stmt2 FROM @sql2; EXECUTE stmt2; DEALLOCATE PREPARE stmt2;

SET @sql3 = IF((SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE table_schema = 'word_of_covenant_db' AND table_name = 'users' AND column_name = 'profile_image') = 0, 'ALTER TABLE users ADD COLUMN profile_image VARCHAR(500)', 'SELECT "profile_image exists"');
PREPARE stmt3 FROM @sql3; EXECUTE stmt3; DEALLOCATE PREPARE stmt3;

SET @sql4 = IF((SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE table_schema = 'word_of_covenant_db' AND table_name = 'users' AND column_name = 'baptism_date') = 0, 'ALTER TABLE users ADD COLUMN baptism_date DATE', 'SELECT "baptism_date exists"');
PREPARE stmt4 FROM @sql4; EXECUTE stmt4; DEALLOCATE PREPARE stmt4;

SET @sql5 = IF((SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE table_schema = 'word_of_covenant_db' AND table_name = 'users' AND column_name = 'join_date') = 0, 'ALTER TABLE users ADD COLUMN join_date DATE DEFAULT (CURRENT_DATE)', 'SELECT "join_date exists"');
PREPARE stmt5 FROM @sql5; EXECUTE stmt5; DEALLOCATE PREPARE stmt5;

SET @sql6 = IF((SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE table_schema = 'word_of_covenant_db' AND table_name = 'users' AND column_name = 'church_email') = 0, 'ALTER TABLE users ADD COLUMN church_email VARCHAR(255) UNIQUE', 'SELECT "church_email exists"');
PREPARE stmt6 FROM @sql6; EXECUTE stmt6; DEALLOCATE PREPARE stmt6;

SET @sql7 = IF((SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE table_schema = 'word_of_covenant_db' AND table_name = 'users' AND column_name = 'is_executive') = 0, 'ALTER TABLE users ADD COLUMN is_executive BOOLEAN DEFAULT FALSE', 'SELECT "is_executive exists"');
PREPARE stmt7 FROM @sql7; EXECUTE stmt7; DEALLOCATE PREPARE stmt7;

SET @sql8 = IF((SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE table_schema = 'word_of_covenant_db' AND table_name = 'users' AND column_name = 'executive_position') = 0, 'ALTER TABLE users ADD COLUMN executive_position VARCHAR(100)', 'SELECT "executive_position exists"');
PREPARE stmt8 FROM @sql8; EXECUTE stmt8; DEALLOCATE PREPARE stmt8;

SET @sql9 = IF((SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE table_schema = 'word_of_covenant_db' AND table_name = 'users' AND column_name = 'birthday') = 0, 'ALTER TABLE users ADD COLUMN birthday DATE', 'SELECT "birthday exists"');
PREPARE stmt9 FROM @sql9; EXECUTE stmt9; DEALLOCATE PREPARE stmt9;

-- Chat messages table
CREATE TABLE IF NOT EXISTS chat_messages (
  id INT AUTO_INCREMENT PRIMARY KEY,
  sender_id INT NOT NULL,
  receiver_id INT,
  group_id INT,
  message TEXT NOT NULL,
  media_url VARCHAR(500),
  media_type ENUM('image', 'video', 'audio', 'document'),
  is_read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (sender_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (receiver_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Chat groups table
CREATE TABLE IF NOT EXISTS chat_groups (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  description TEXT,
  type ENUM('department', 'leadership', 'announcement', 'general') DEFAULT 'general',
  department VARCHAR(100),
  is_auto_join BOOLEAN DEFAULT FALSE,
  created_by INT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Group members table
CREATE TABLE IF NOT EXISTS group_members (
  id INT AUTO_INCREMENT PRIMARY KEY,
  group_id INT NOT NULL,
  user_id INT NOT NULL,
  role ENUM('admin', 'member') DEFAULT 'member',
  joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (group_id) REFERENCES chat_groups(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE KEY unique_group_member (group_id, user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Bible translations table
CREATE TABLE IF NOT EXISTS bible_translations (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  abbreviation VARCHAR(10) NOT NULL UNIQUE,
  language VARCHAR(50) NOT NULL,
  description TEXT,
  is_active BOOLEAN DEFAULT TRUE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Bible verses (simplified - in production use external API)
CREATE TABLE IF NOT EXISTS bible_verses (
  id INT AUTO_INCREMENT PRIMARY KEY,
  translation_id INT NOT NULL,
  book VARCHAR(50) NOT NULL,
  chapter INT NOT NULL,
  verse INT NOT NULL,
  text TEXT NOT NULL,
  FOREIGN KEY (translation_id) REFERENCES bible_translations(id) ON DELETE CASCADE,
  INDEX idx_book_chapter_verse (book, chapter, verse)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- User bible highlights and notes
CREATE TABLE IF NOT EXISTS bible_notes (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  translation_id INT NOT NULL,
  book VARCHAR(50) NOT NULL,
  chapter INT NOT NULL,
  verse INT NOT NULL,
  note TEXT,
  highlight_color VARCHAR(20),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (translation_id) REFERENCES bible_translations(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Hymns table
CREATE TABLE IF NOT EXISTS hymns (
  id INT AUTO_INCREMENT PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  number INT,
  lyrics TEXT NOT NULL,
  audio_url VARCHAR(500),
  category VARCHAR(50),
  is_favorite BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- User favorite hymns
CREATE TABLE IF NOT EXISTS user_hymn_favorites (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  hymn_id INT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (hymn_id) REFERENCES hymns(id) ON DELETE CASCADE,
  UNIQUE KEY unique_user_hymn (user_id, hymn_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Worship setlists
CREATE TABLE IF NOT EXISTS worship_setlists (
  id INT AUTO_INCREMENT PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  date DATE NOT NULL,
  created_by INT NOT NULL,
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Setlist hymns
CREATE TABLE IF NOT EXISTS setlist_hymns (
  id INT AUTO_INCREMENT PRIMARY KEY,
  setlist_id INT NOT NULL,
  hymn_id INT NOT NULL,
  order_index INT NOT NULL,
  FOREIGN KEY (setlist_id) REFERENCES worship_setlists(id) ON DELETE CASCADE,
  FOREIGN KEY (hymn_id) REFERENCES hymns(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Counseling sessions
CREATE TABLE IF NOT EXISTS counseling_sessions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  counselor_id INT,
  title VARCHAR(255),
  description TEXT,
  session_date DATETIME,
  status ENUM('requested', 'scheduled', 'completed', 'cancelled') DEFAULT 'requested',
  is_confidential BOOLEAN DEFAULT TRUE,
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (counselor_id) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Update prayer_requests table
SET @sql10 = IF((SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE table_schema = 'word_of_covenant_db' AND table_name = 'prayer_requests' AND column_name = 'user_id') = 0, 'ALTER TABLE prayer_requests ADD COLUMN user_id INT, ADD FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL', 'SELECT "user_id exists in prayer_requests"');
PREPARE stmt10 FROM @sql10; EXECUTE stmt10; DEALLOCATE PREPARE stmt10;

SET @sql11 = IF((SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE table_schema = 'word_of_covenant_db' AND table_name = 'prayer_requests' AND column_name = 'is_urgent') = 0, 'ALTER TABLE prayer_requests ADD COLUMN is_urgent BOOLEAN DEFAULT FALSE', 'SELECT "is_urgent exists"');
PREPARE stmt11 FROM @sql11; EXECUTE stmt11; DEALLOCATE PREPARE stmt11;

SET @sql12 = IF((SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE table_schema = 'word_of_covenant_db' AND table_name = 'prayer_requests' AND column_name = 'prayer_count') = 0, 'ALTER TABLE prayer_requests ADD COLUMN prayer_count INT DEFAULT 0', 'SELECT "prayer_count exists"');
PREPARE stmt12 FROM @sql12; EXECUTE stmt12; DEALLOCATE PREPARE stmt12;

SET @sql13 = IF((SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE table_schema = 'word_of_covenant_db' AND table_name = 'prayer_requests' AND column_name = 'testimony') = 0, 'ALTER TABLE prayer_requests ADD COLUMN testimony TEXT', 'SELECT "testimony exists"');
PREPARE stmt13 FROM @sql13; EXECUTE stmt13; DEALLOCATE PREPARE stmt13;

-- User prayers (who prayed for which request)
CREATE TABLE IF NOT EXISTS user_prayers (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  prayer_request_id INT NOT NULL,
  prayed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (prayer_request_id) REFERENCES prayer_requests(id) ON DELETE CASCADE,
  UNIQUE KEY unique_user_prayer (user_id, prayer_request_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Event registrations
CREATE TABLE IF NOT EXISTS event_registrations (
  id INT AUTO_INCREMENT PRIMARY KEY,
  event_id INT NOT NULL,
  user_id INT NOT NULL,
  status ENUM('registered', 'attended', 'cancelled') DEFAULT 'registered',
  registration_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  attendance_time TIMESTAMP NULL,
  FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE KEY unique_event_registration (event_id, user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Documents/Letterheads
CREATE TABLE IF NOT EXISTS documents (
  id INT AUTO_INCREMENT PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  file_url VARCHAR(500) NOT NULL,
  document_type ENUM('letterhead', 'form', 'policy', 'minutes', 'certificate') NOT NULL,
  required_role ENUM(
    'member', 'pastor', 'elder', 'deacon', 'secretary', 
    'media', 'finance', 'choir', 'department_head', 'super_admin'
  ),
  is_public BOOLEAN DEFAULT FALSE,
  created_by INT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Document downloads log
CREATE TABLE IF NOT EXISTS document_downloads (
  id INT AUTO_INCREMENT PRIMARY KEY,
  document_id INT NOT NULL,
  user_id INT NOT NULL,
  downloaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Update donations table
SET @sql14 = IF((SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE table_schema = 'word_of_covenant_db' AND table_name = 'donations' AND column_name = 'user_id') = 0, 'ALTER TABLE donations ADD COLUMN user_id INT, ADD FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL', 'SELECT "user_id exists in donations"');
PREPARE stmt14 FROM @sql14; EXECUTE stmt14; DEALLOCATE PREPARE stmt14;

SET @sql15 = IF((SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE table_schema = 'word_of_covenant_db' AND table_name = 'donations' AND column_name = 'reference') = 0, 'ALTER TABLE donations ADD COLUMN reference VARCHAR(100)', 'SELECT "reference exists"');
PREPARE stmt15 FROM @sql15; EXECUTE stmt15; DEALLOCATE PREPARE stmt15;

SET @sql16 = IF((SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE table_schema = 'word_of_covenant_db' AND table_name = 'donations' AND column_name = 'payment_date') = 0, 'ALTER TABLE donations ADD COLUMN payment_date TIMESTAMP NULL', 'SELECT "payment_date exists"');
PREPARE stmt16 FROM @sql16; EXECUTE stmt16; DEALLOCATE PREPARE stmt16;

-- Department tasks
CREATE TABLE IF NOT EXISTS department_tasks (
  id INT AUTO_INCREMENT PRIMARY KEY,
  department VARCHAR(100) NOT NULL,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  assigned_to INT,
  due_date DATE,
  status ENUM('pending', 'in_progress', 'completed') DEFAULT 'pending',
  created_by INT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  completed_at TIMESTAMP NULL,
  FOREIGN KEY (assigned_to) REFERENCES users(id) ON DELETE SET NULL,
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Attendance tracking
CREATE TABLE IF NOT EXISTS attendance (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NULL,
  first_timer_id INT NULL,
  service_type ENUM('sunday_school', 'sunday_service', 'tuesday_prayer', 'thursday_bible_study', 'vigil', 'event', 'department') NOT NULL,
  service_date DATE NOT NULL,
  check_in_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  event_id INT NULL,
  department VARCHAR(100),
  qr_code VARCHAR(255),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (first_timer_id) REFERENCES first_timers(id) ON DELETE CASCADE,
  FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE SET NULL,
  INDEX idx_qr_code (qr_code),
  INDEX idx_service_date (service_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Feed posts
CREATE TABLE IF NOT EXISTS feed_posts (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  content TEXT NOT NULL,
  media_url VARCHAR(500),
  media_type ENUM('image', 'video'),
  post_type ENUM('announcement', 'testimony', 'sermon_clip', 'scripture', 'general') DEFAULT 'general',
  is_pinned BOOLEAN DEFAULT FALSE,
  likes_count INT DEFAULT 0,
  comments_count INT DEFAULT 0,
  shares_count INT DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Post likes
CREATE TABLE IF NOT EXISTS post_likes (
  id INT AUTO_INCREMENT PRIMARY KEY,
  post_id INT NOT NULL,
  user_id INT NOT NULL,
  reaction_type VARCHAR(20) DEFAULT 'like',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (post_id) REFERENCES feed_posts(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE KEY unique_post_like (post_id, user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Post comments
CREATE TABLE IF NOT EXISTS post_comments (
  id INT AUTO_INCREMENT PRIMARY KEY,
  post_id INT NOT NULL,
  user_id INT NOT NULL,
  comment TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (post_id) REFERENCES feed_posts(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Notifications
CREATE TABLE IF NOT EXISTS notifications (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  title VARCHAR(255) NOT NULL,
  message TEXT NOT NULL,
  type VARCHAR(50) NOT NULL,
  related_id INT,
  is_read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Audit logs
CREATE TABLE IF NOT EXISTS audit_logs (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT,
  action VARCHAR(100) NOT NULL,
  entity_type VARCHAR(50),
  entity_id INT,
  details JSON,
  ip_address VARCHAR(45),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Church email accounts (for executives)
CREATE TABLE IF NOT EXISTS church_emails (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  department VARCHAR(100),
  position VARCHAR(100),
  is_active BOOLEAN DEFAULT TRUE,
  created_by INT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  last_password_reset TIMESTAMP NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Birthdays reminder table (for notifications)
CREATE TABLE IF NOT EXISTS birthday_notifications (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  notification_date DATE NOT NULL,
  is_sent BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_notification_date (notification_date, is_sent)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- First timers table
CREATE TABLE IF NOT EXISTS first_timers (
  id INT AUTO_INCREMENT PRIMARY KEY,
  first_name VARCHAR(100) NOT NULL,
  last_name VARCHAR(100) NOT NULL,
  email VARCHAR(255),
  phone VARCHAR(20),
  address TEXT,
  qr_code VARCHAR(255) UNIQUE NOT NULL,
  sunday_attendance_count INT DEFAULT 0,
  is_converted_to_member BOOLEAN DEFAULT FALSE,
  converted_user_id INT NULL,
  first_visit_date DATE NOT NULL,
  last_visit_date DATE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (converted_user_id) REFERENCES users(id) ON DELETE SET NULL,
  INDEX idx_qr_code (qr_code),
  INDEX idx_converted (is_converted_to_member)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Notification queue (for email and SMS)
CREATE TABLE IF NOT EXISTS notification_queue (
  id INT AUTO_INCREMENT PRIMARY KEY,
  recipient_type ENUM('user', 'first_timer', 'all', 'role') NOT NULL,
  recipient_id INT,
  recipient_role VARCHAR(50),
  notification_type ENUM('email', 'sms', 'both') NOT NULL,
  subject VARCHAR(255),
  message TEXT NOT NULL,
  email_to VARCHAR(255),
  phone_to VARCHAR(20),
  event_id INT,
  status ENUM('pending', 'sent', 'failed') DEFAULT 'pending',
  sent_at TIMESTAMP NULL,
  error_message TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE SET NULL,
  INDEX idx_status (status),
  INDEX idx_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Event notifications tracking
CREATE TABLE IF NOT EXISTS event_notifications (
  id INT AUTO_INCREMENT PRIMARY KEY,
  event_id INT NOT NULL,
  notification_date DATETIME NOT NULL,
  is_sent BOOLEAN DEFAULT FALSE,
  notification_type ENUM('reminder_7days', 'reminder_1day', 'reminder_3hours') NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE,
  INDEX idx_notification_date (notification_date, is_sent)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Analytics/Statistics table (for dashboard)
CREATE TABLE IF NOT EXISTS church_statistics (
  id INT AUTO_INCREMENT PRIMARY KEY,
  stat_date DATE NOT NULL UNIQUE,
  total_members INT DEFAULT 0,
  total_first_timers INT DEFAULT 0,
  sunday_attendance INT DEFAULT 0,
  midweek_attendance INT DEFAULT 0,
  total_donations DECIMAL(10, 2) DEFAULT 0,
  active_groups INT DEFAULT 0,
  total_posts INT DEFAULT 0,
  total_prayers INT DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_stat_date (stat_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Insert default Bible translations
INSERT IGNORE INTO bible_translations (name, abbreviation, language) VALUES
('King James Version', 'KJV', 'English'),
('New International Version', 'NIV', 'English'),
('English Standard Version', 'ESV', 'English'),
('New Living Translation', 'NLT', 'English');

-- Insert sample hymns
INSERT IGNORE INTO hymns (title, number, lyrics, category) VALUES
('Amazing Grace', 1, 'Amazing grace! how sweet the sound\nThat saved a wretch like me;\nI once was lost, but now am found;\nWas blind, but now I see.', 'Classic'),
('How Great Thou Art', 2, 'O Lord my God, when I in awesome wonder\nConsider all the worlds Thy hands have made;\nI see the stars, I hear the rolling thunder,\nThy power throughout the universe displayed.', 'Worship'),
('Blessed Assurance', 3, 'Blessed assurance, Jesus is mine!\nO what a foretaste of glory divine!\nHeir of salvation, purchase of God,\nBorn of His Spirit, washed in His blood.', 'Assurance');
