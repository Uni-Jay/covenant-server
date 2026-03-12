-- Data export for password_resets
-- Exported on 2026-03-12T19:16:15.647Z
-- Total rows: 2

-- Disable foreign key checks temporarily
SET FOREIGN_KEY_CHECKS = 0;

INSERT IGNORE INTO password_resets (`id`, `user_id`, `email`, `token`, `expires_at`, `used`, `created_at`) VALUES
(4, 1, 'admin@wordofcovenant.org', '46a89290ee0f551813053fdb4084a496a4e68b29d8a452ba9cd95a7faabbc97d', '2026-03-12 12:01:20', 0, '2026-03-12 11:01:20'),
(6, 4, 'gbemiadura323@gmail.com', 'dccab0d66e369d4fd8cab18262e7593fc9be2623fbb8a1e3634512c785c0996a', '2026-03-12 12:50:24', 0, '2026-03-12 11:50:24');

-- Re-enable foreign key checks
SET FOREIGN_KEY_CHECKS = 1;
