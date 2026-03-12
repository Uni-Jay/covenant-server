-- Data export for post_likes
-- Exported on 2026-03-12T19:16:15.735Z
-- Total rows: 15

-- Disable foreign key checks temporarily
SET FOREIGN_KEY_CHECKS = 0;

INSERT IGNORE INTO post_likes (`id`, `post_id`, `user_id`, `reaction_type`, `created_at`) VALUES
(5, 3, 1, 'like', '2026-02-05 07:52:20'),
(8, 1, 1, 'like', '2026-02-05 07:52:32'),
(9, 3, 4, 'like', '2026-02-06 19:13:40'),
(10, 2, 4, 'like', '2026-02-06 19:13:43'),
(11, 1, 4, 'like', '2026-02-06 19:13:46'),
(12, 2, 1, 'like', '2026-02-06 20:34:23'),
(13, 3, 3, 'like', '2026-02-07 16:09:23'),
(14, 2, 3, 'like', '2026-02-07 16:09:25'),
(15, 1, 3, 'like', '2026-02-07 16:09:27'),
(16, 2, 5, 'like', '2026-02-24 15:41:41'),
(17, 3, 5, 'like', '2026-02-24 15:41:45'),
(18, 1, 5, 'like', '2026-02-24 15:41:49'),
(20, 4, 5, 'like', '2026-02-24 15:42:26'),
(23, 5, 5, 'like', '2026-03-09 15:37:38'),
(24, 8, 1, 'like', '2026-03-09 19:26:24');

-- Re-enable foreign key checks
SET FOREIGN_KEY_CHECKS = 1;
