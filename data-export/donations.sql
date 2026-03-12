-- Data export for donations
-- Exported on 2026-03-12T19:16:15.635Z
-- Total rows: 3

-- Disable foreign key checks temporarily
SET FOREIGN_KEY_CHECKS = 0;

INSERT IGNORE INTO donations (`id`, `name`, `email`, `phone`, `amount`, `purpose`, `donation_type`, `payment_method`, `status`, `created_at`, `user_id`, `reference`, `payment_date`, `approved_by`, `approved_at`) VALUES
(1, 'Idowu Micheal1', 'idowutimilehin201@gmail.com', NULL, '20000.00', 'Tithe', 'General', 'Bank Transfer', 'completed', '2026-02-05 11:38:47', NULL, NULL, NULL, 3, '2026-02-05 11:51:35'),
(2, 'Joshua Ogiriosa', 'gbemiadura323@gmail.com', NULL, '50000.00', 'Building Fund', 'General', 'Bank Transfer', 'rejected', '2026-02-06 19:15:29', NULL, NULL, NULL, 1, '2026-02-06 20:31:17'),
(3, 'Joshua Ogiriosa', 'joshua.ogiriosa@miva.edu.ng', NULL, '5000.00', 'Tithe', 'General', 'Bank Transfer', 'completed', '2026-03-09 14:44:59', NULL, NULL, NULL, 1, '2026-03-09 14:47:00');

-- Re-enable foreign key checks
SET FOREIGN_KEY_CHECKS = 1;
