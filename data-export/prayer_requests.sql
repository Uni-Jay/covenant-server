-- Data export for prayer_requests
-- Exported on 2026-03-12T19:16:15.542Z
-- Total rows: 1

-- Disable foreign key checks temporarily
SET FOREIGN_KEY_CHECKS = 0;

INSERT IGNORE INTO prayer_requests (`id`, `name`, `email`, `phone`, `request`, `category`, `status`, `is_anonymous`, `created_at`, `updated_at`, `user_id`, `is_urgent`, `prayer_count`, `testimony`) VALUES
(1, 'Idowu Micheal1', 'idowutimilehin201@gmail.com', '09086275131', 'I need God to provide a Job for me', 'Work', 'answered', 0, '2026-02-05 12:10:51', '2026-03-11 15:28:46', NULL, 0, 0, NULL);

-- Re-enable foreign key checks
SET FOREIGN_KEY_CHECKS = 1;
