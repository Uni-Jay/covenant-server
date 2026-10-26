/**
 * Church management system (CMS) tables. Kept separate from the website/app tables (users,
 * attendance, first_timers, donations) so the website and mobile app keep working unchanged.
 * Created on every start if missing.
 */
const T = 'DEFAULT CHARSET=utf8mb4';

const TABLES: string[] = [
  `CREATE TABLE IF NOT EXISTS cms_families (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(120) NOT NULL,
    address TEXT,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  ) ${T}`,
  `CREATE TABLE IF NOT EXISTS cms_members (
    id INT AUTO_INCREMENT PRIMARY KEY,
    studio_id VARCHAR(40) NULL UNIQUE,
    studio_sig VARCHAR(64) NULL,
    user_id INT NULL UNIQUE,
    first_name VARCHAR(80) NOT NULL,
    last_name VARCHAR(80) NOT NULL DEFAULT '',
    title VARCHAR(40) NOT NULL DEFAULT '',
    gender ENUM('male','female','') NOT NULL DEFAULT '',
    phone VARCHAR(30) NOT NULL DEFAULT '',
    phone_key VARCHAR(10) NOT NULL DEFAULT '',
    email VARCHAR(160) NOT NULL DEFAULT '',
    address TEXT,
    birth_day TINYINT NULL, birth_month TINYINT NULL, birth_year SMALLINT NULL,
    ann_day TINYINT NULL, ann_month TINYINT NULL,
    marital_status ENUM('single','married','widowed','divorced','') NOT NULL DEFAULT '',
    spouse_name VARCHAR(120) NOT NULL DEFAULT '',
    family_id INT NULL,
    family_role ENUM('head','spouse','child','relative','') NOT NULL DEFAULT '',
    photo_url VARCHAR(500) NOT NULL DEFAULT '',
    status ENUM('member','worker','visitor','inactive') NOT NULL DEFAULT 'member',
    occupation VARCHAR(120) NOT NULL DEFAULT '',
    join_date DATE NULL, baptism_date DATE NULL,
    department_text VARCHAR(120) NOT NULL DEFAULT '',
    consent_screen TINYINT(1) NOT NULL DEFAULT 0,
    source ENUM('studio','manual','first_timer','self','account') NOT NULL DEFAULT 'manual',
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX (phone_key), INDEX (family_id), INDEX (birth_month, birth_day), INDEX (ann_month, ann_day)
  ) ${T}`,
  `CREATE TABLE IF NOT EXISTS cms_groups (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(120) NOT NULL,
    type ENUM('department','cell','ministry','other') NOT NULL DEFAULT 'department',
    leader_id INT NULL,
    meets VARCHAR(120) NOT NULL DEFAULT '',
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  ) ${T}`,
  `CREATE TABLE IF NOT EXISTS cms_group_members (
    group_id INT NOT NULL, member_id INT NOT NULL,
    role VARCHAR(60) NOT NULL DEFAULT '',
    PRIMARY KEY (group_id, member_id), INDEX (member_id)
  ) ${T}`,
  `CREATE TABLE IF NOT EXISTS cms_services (
    id INT AUTO_INCREMENT PRIMARY KEY,
    date DATE NOT NULL,
    type VARCHAR(40) NOT NULL DEFAULT 'sunday_service',
    title VARCHAR(160) NOT NULL DEFAULT '',
    men INT NOT NULL DEFAULT 0, women INT NOT NULL DEFAULT 0, children INT NOT NULL DEFAULT 0,
    online INT NOT NULL DEFAULT 0,
    checkin_code VARCHAR(12) NOT NULL DEFAULT '',
    checkin_open TINYINT(1) NOT NULL DEFAULT 0,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX (date)
  ) ${T}`,
  `CREATE TABLE IF NOT EXISTS cms_attendance (
    service_id INT NOT NULL, member_id INT NOT NULL,
    method ENUM('staff','self','family') NOT NULL DEFAULT 'staff',
    at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (service_id, member_id), INDEX (member_id)
  ) ${T}`,
  `CREATE TABLE IF NOT EXISTS cms_first_timers (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(120) NOT NULL,
    phone VARCHAR(30) NOT NULL DEFAULT '',
    email VARCHAR(160) NOT NULL DEFAULT '',
    address TEXT,
    gender ENUM('male','female','') NOT NULL DEFAULT '',
    visit_date DATE NOT NULL,
    service_id INT NULL,
    invited_by VARCHAR(120) NOT NULL DEFAULT '',
    how_heard VARCHAR(120) NOT NULL DEFAULT '',
    wants VARCHAR(200) NOT NULL DEFAULT '',
    prayer TEXT,
    status ENUM('new','contacted','returned','member','not_interested') NOT NULL DEFAULT 'new',
    assigned_to INT NULL,
    member_id INT NULL,
    source ENUM('form','staff') NOT NULL DEFAULT 'staff',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX (visit_date), INDEX (status)
  ) ${T}`,
  `CREATE TABLE IF NOT EXISTS cms_followups (
    id INT AUTO_INCREMENT PRIMARY KEY,
    first_timer_id INT NOT NULL,
    note TEXT,
    by_user INT NULL, by_name VARCHAR(120) NOT NULL DEFAULT '',
    at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX (first_timer_id)
  ) ${T}`,
  `CREATE TABLE IF NOT EXISTS cms_pledges (
    id INT AUTO_INCREMENT PRIMARY KEY,
    member_id INT NULL,
    name VARCHAR(120) NOT NULL DEFAULT '',
    purpose VARCHAR(160) NOT NULL,
    amount DECIMAL(14,2) NOT NULL,
    due_date DATE NULL,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX (member_id)
  ) ${T}`,
  `CREATE TABLE IF NOT EXISTS cms_giving (
    id INT AUTO_INCREMENT PRIMARY KEY,
    date DATE NOT NULL,
    member_id INT NULL,
    name VARCHAR(120) NOT NULL DEFAULT '',
    type VARCHAR(40) NOT NULL DEFAULT 'offering',
    amount DECIMAL(14,2) NOT NULL,
    method ENUM('cash','transfer','pos','online','cheque','other') NOT NULL DEFAULT 'cash',
    reference VARCHAR(120) NOT NULL DEFAULT '',
    service_id INT NULL,
    pledge_id INT NULL,
    notes TEXT,
    recorded_by INT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX (date), INDEX (member_id), INDEX (type)
  ) ${T}`,
  `CREATE TABLE IF NOT EXISTS cms_expenses (
    id INT AUTO_INCREMENT PRIMARY KEY,
    date DATE NOT NULL,
    category VARCHAR(60) NOT NULL DEFAULT 'Other',
    description VARCHAR(255) NOT NULL DEFAULT '',
    amount DECIMAL(14,2) NOT NULL,
    paid_to VARCHAR(120) NOT NULL DEFAULT '',
    method ENUM('cash','transfer','pos','cheque','other') NOT NULL DEFAULT 'cash',
    approved_by VARCHAR(120) NOT NULL DEFAULT '',
    recorded_by INT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX (date)
  ) ${T}`,
  `CREATE TABLE IF NOT EXISTS cms_messages (
    id INT AUTO_INCREMENT PRIMARY KEY,
    channel ENUM('email','whatsapp') NOT NULL,
    subject VARCHAR(200) NOT NULL DEFAULT '',
    body TEXT,
    audience VARCHAR(200) NOT NULL DEFAULT '',
    recipients INT NOT NULL DEFAULT 0,
    delivered INT NOT NULL DEFAULT 0,
    sent_by INT NULL,
    at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  ) ${T}`,
  // birthday register filled on the website (hocfam.org/birthday): waits here until Church Studio collects it
  `CREATE TABLE IF NOT EXISTS cms_form_queue (
    id INT AUTO_INCREMENT PRIMARY KEY,
    member_id INT NOT NULL,
    kind VARCHAR(10) NOT NULL DEFAULT 'new',
    photo MEDIUMBLOB NULL,
    at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX (member_id)
  ) ${T}`,
  // prayer requests, testimonies and visitor cards sent with the church screen's QR code (hocfam.org/message)
  `CREATE TABLE IF NOT EXISTS cms_inbox (
    id INT AUTO_INCREMENT PRIMARY KEY,
    type VARCHAR(12) NOT NULL,
    name VARCHAR(80) NOT NULL DEFAULT '',
    from_place VARCHAR(80) NOT NULL DEFAULT '',
    phone VARCHAR(30) NOT NULL DEFAULT '',
    text TEXT,
    first_time TINYINT(1) NOT NULL DEFAULT 0,
    private_req TINYINT(1) NOT NULL DEFAULT 0,
    pulled TINYINT(1) NOT NULL DEFAULT 0,
    at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX (pulled)
  ) ${T}`,
  `CREATE TABLE IF NOT EXISTS cms_audit (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NULL, user_name VARCHAR(120) NOT NULL DEFAULT '',
    action VARCHAR(60) NOT NULL, detail VARCHAR(500) NOT NULL DEFAULT '',
    at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX (at)
  ) ${T}`,
];

export async function ensureCmsTables(connection: any) {
  for (const sql of TABLES) {
    try { await connection.query(sql); }
    catch (e: any) { console.warn('⚠️  CMS table:', e.message); }
  }
}
