-- Data export for feed_posts
-- Exported on 2026-03-12T19:16:15.718Z
-- Total rows: 8

-- Disable foreign key checks temporarily
SET FOREIGN_KEY_CHECKS = 0;

INSERT IGNORE INTO feed_posts (`id`, `user_id`, `content`, `media_url`, `media_type`, `post_type`, `is_pinned`, `likes_count`, `comments_count`, `shares_count`, `created_at`, `updated_at`) VALUES
(1, 1, 'Welcome to Word of Covenant Family', NULL, NULL, 'general', 0, 0, 0, 0, '2026-02-02 10:36:01', '2026-02-02 10:36:01'),
(2, 1, 'I am a winner', NULL, NULL, 'general', 0, 0, 0, 0, '2026-02-02 18:29:46', '2026-02-02 18:29:46'),
(3, 1, 'Welcome', NULL, NULL, 'general', 0, 0, 0, 0, '2026-02-04 15:48:19', '2026-02-04 15:48:19'),
(4, 5, 'Happy Birthday ', NULL, NULL, 'general', 0, 0, 0, 0, '2026-02-24 15:11:15', '2026-02-24 15:11:15'),
(5, 5, 'Happy birthday ', NULL, NULL, 'general', 0, 0, 0, 0, '2026-02-24 15:11:54', '2026-02-24 15:11:54'),
(6, 5, 'The Lord is my shepherd ', '/uploads/media-1771977866572-333825428.jpeg', 'image', 'scripture', 0, 0, 0, 0, '2026-02-25 00:04:26', '2026-02-25 00:04:26'),
(7, 5, '', '/uploads/feed/media-1773070571864-311997788.jpeg', 'image', 'general', 0, 0, 0, 0, '2026-03-09 15:36:12', '2026-03-09 15:36:12'),
(8, 5, 'In mood of drama', '/uploads/feed/media-1773070617682-733970449.jpeg', 'image', 'general', 0, 0, 0, 0, '2026-03-09 15:36:57', '2026-03-09 15:36:57');

-- Re-enable foreign key checks
SET FOREIGN_KEY_CHECKS = 1;
