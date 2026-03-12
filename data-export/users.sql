-- Data export for users
-- Exported on 2026-03-12T19:16:15.480Z
-- Total rows: 4

-- Disable foreign key checks temporarily
SET FOREIGN_KEY_CHECKS = 0;

INSERT IGNORE INTO users (`id`, `email`, `password`, `google_id`, `photo`, `first_name`, `last_name`, `phone`, `address`, `gender`, `date_of_birth`, `role`, `department`, `departments`, `created_at`, `updated_at`, `is_active`, `is_approved`, `profile_image`, `baptism_date`, `join_date`, `church_email`, `is_executive`, `executive_position`, `birthday`, `push_notifications`, `email_updates`, `event_reminders`) VALUES
(1, 'admin@wordofcovenant.org', '$2a$10$7/TiVsmwCcUPgJEc3zwKKOwitAFyQnVHA35oNncLiVfXhDu/3lGdS', NULL, NULL, 'Tolu', 'Seyi', '09076052317', '123, obafemi road', 'male', NULL, 'super_admin', 'Media', '["Choir","Drama","Media","Youth","Evangelism","Prayer Team","Usher","Prayer"]', '2026-01-20 21:09:58', '2026-03-11 12:45:40', 1, 1, NULL, NULL, '2026-01-23 23:00:00', NULL, 0, NULL, NULL, 1, 1, 1),
(3, 'idowutimilehin201@gmail.com', '$2a$10$xf9Zz1HaRptJBnGRLWewqeJzd04W82GjxYqWCmHBGsrdZcCFxmF.K', NULL, NULL, 'Idowu', 'Micheal1', '08067534211', NULL, 'male', NULL, 'member', NULL, '["Choir","Drama","Usher","Media","Youth","Evangelism","Prayer Team"]', '2026-01-25 14:52:09', '2026-02-24 13:31:08', 1, 1, NULL, NULL, '2026-01-24 23:00:00', NULL, 0, NULL, NULL, 1, 1, 1),
(4, 'gbemiadura323@gmail.com', '$2a$10$71.NmYMlEVhrcHfAkO0alORRg8Ug/Pt3uZtV97DfpQwRJ.TSI2fOW', NULL, NULL, 'Joshua', 'Ogiriosa', '09076052317', NULL, 'male', '2000-02-06 23:00:00', 'member', NULL, '["Covenant Men","Prayer"]', '2026-02-06 15:50:58', '2026-03-09 15:47:13', 1, 1, NULL, NULL, '2026-02-05 23:00:00', NULL, 0, NULL, NULL, 1, 1, 1),
(5, 'joshua.ogiriosa@miva.edu.ng', NULL, '113143657493862147858', '/uploads/profiles/profile-1771946873827.jpeg', 'Joshua', 'Ogiriosa', '09076052317', '120, Reuben ', 'male', NULL, 'member', NULL, NULL, '2026-02-24 12:39:34', '2026-02-24 15:33:50', 1, 1, NULL, NULL, '2026-02-23 23:00:00', NULL, 0, NULL, NULL, 1, 1, 1);

-- Re-enable foreign key checks
SET FOREIGN_KEY_CHECKS = 1;
