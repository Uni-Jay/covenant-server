-- Data export for sermons
-- Exported on 2026-03-12T19:16:15.491Z
-- Total rows: 1

-- Disable foreign key checks temporarily
SET FOREIGN_KEY_CHECKS = 0;

INSERT IGNORE INTO sermons (`id`, `title`, `description`, `preacher`, `date`, `video_url`, `audio_url`, `pdf_url`, `thumbnail_url`, `views`, `category`, `created_at`, `updated_at`) VALUES
(2, 'Prayer', 'Understanding rule of prayer ', 'Apostle Joshua A. Ogiriosa ', '2026-03-07 23:00:00', '/uploads/sermons/video-1773087318074-542015996.mp4', NULL, NULL, NULL, 7, 'Sunday Service', '2026-03-09 20:15:31', '2026-03-12 11:35:52');

-- Re-enable foreign key checks
SET FOREIGN_KEY_CHECKS = 1;
