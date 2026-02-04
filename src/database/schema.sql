-- Word of Covenant Church Database Schema

CREATE DATABASE IF NOT EXISTS word_of_covenant_db;
USE word_of_covenant_db;

-- Users table
CREATE TABLE IF NOT EXISTS users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  email VARCHAR(191) UNIQUE NOT NULL,
  password VARCHAR(255) NOT NULL,
  first_name VARCHAR(100) NOT NULL,
  last_name VARCHAR(100) NOT NULL,
  phone VARCHAR(20),
  role ENUM('admin', 'member') DEFAULT 'member',
  gender ENUM('male', 'female'),
  department VARCHAR(100),
  departments JSON,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Sermons table
CREATE TABLE IF NOT EXISTS sermons (
  id INT AUTO_INCREMENT PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  preacher VARCHAR(100) NOT NULL,
  date DATE NOT NULL,
  video_url VARCHAR(500),
  audio_url VARCHAR(500),
  pdf_url VARCHAR(500),
  thumbnail_url VARCHAR(500),
  views INT DEFAULT 0,
  category VARCHAR(50),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Events table
CREATE TABLE IF NOT EXISTS events (
  id INT AUTO_INCREMENT PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  date DATE NOT NULL,
  time VARCHAR(50),
  location VARCHAR(255),
  image_url VARCHAR(500),
  category VARCHAR(50),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Gallery table
CREATE TABLE IF NOT EXISTS gallery (
  id INT AUTO_INCREMENT PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  image_url VARCHAR(500) NOT NULL,
  category ENUM('building', 'pastor', 'events', 'worship', 'youth', 'children') NOT NULL,
  upload_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Blog posts table
CREATE TABLE IF NOT EXISTS blog_posts (
  id INT AUTO_INCREMENT PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  content TEXT NOT NULL,
  excerpt TEXT,
  author VARCHAR(100) NOT NULL,
  date DATE NOT NULL,
  image_url VARCHAR(500),
  category VARCHAR(50),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Prayer requests table
CREATE TABLE IF NOT EXISTS prayer_requests (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100),
  email VARCHAR(191),
  phone VARCHAR(20),
  request TEXT NOT NULL,
  category VARCHAR(50),
  status ENUM('pending', 'prayed', 'answered') DEFAULT 'pending',
  is_anonymous BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Donations table
CREATE TABLE IF NOT EXISTS donations (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  email VARCHAR(191) NOT NULL,
  phone VARCHAR(20),
  amount DECIMAL(10, 2) NOT NULL,
  purpose VARCHAR(100),
  payment_method VARCHAR(50),
  status VARCHAR(50) DEFAULT 'pending',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Ministries table
CREATE TABLE IF NOT EXISTS ministries (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  description TEXT,
  leader VARCHAR(100),
  image_url VARCHAR(500),
  schedule VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Contact messages table
CREATE TABLE IF NOT EXISTS contact_messages (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  email VARCHAR(191) NOT NULL,
  phone VARCHAR(20),
  subject VARCHAR(255),
  message TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Insert default admin user (password: admin123)
INSERT IGNORE INTO users (email, password, first_name, last_name, role, department) 
VALUES (
  'admin@wordofcovenant.org', 
  '$2a$10$7/TiVsmwCcUPgJEc3zwKKOwitAFyQnVHA35oNncLiVfXhDu/3lGdS',
  'Admin',
  'User',
  'admin',
  'Media'
);

-- Insert sample ministries
INSERT IGNORE INTO ministries (name, description, leader, schedule) VALUES
('Children Ministry', 'Nurturing young hearts to know and love Jesus', 'Sister Grace Ade', 'Sunday 9:00 AM'),
('Youth Ministry', 'Empowering young people to live boldly for Christ', 'Pastor David Okon', 'Saturday 4:00 PM'),
('Women Ministry', 'Building godly women of faith, purpose, and strength', 'Sis. Sarah Johnson', 'First Saturday 10:00 AM'),
('Men Ministry', 'Equipping men to be spiritual leaders', 'Elder Michael Brown', 'Second Saturday 2:00 PM'),
('Choir & Music', 'Using our voices and instruments to worship God', 'Minister Emmanuel Nwankwo', 'Thursday 6:00 PM'),
('Media Department', 'Broadcasting the Gospel through technology', 'Bro. James Okafor', 'All Services'),
('Ushering', 'Welcoming and serving with excellence', 'Sis. Blessing Adeyemi', 'All Services'),
('Evangelism', 'Reaching the lost with the Gospel', 'Pastor Daniel Okeke', 'Saturday 3:00 PM');
