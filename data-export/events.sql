-- Data export for events
-- Exported on 2026-03-12T19:16:15.500Z
-- Total rows: 1

-- Disable foreign key checks temporarily
SET FOREIGN_KEY_CHECKS = 0;

INSERT IGNORE INTO events (`id`, `title`, `description`, `date`, `time`, `location`, `image_url`, `category`, `created_at`, `updated_at`) VALUES
(1, 'CHRISTMAS CAROL', 'WE ARE INVITING YOU ALL TO OUR CHRISTMAS CAROL', '2026-12-18 23:00:00', '16:00', 'CHURCH AUDITORIUM', '/uploads/events/image-1768946094784-898632315.jpeg', 'Service', '2026-01-20 21:54:54', '2026-01-20 21:54:54');

-- Re-enable foreign key checks
SET FOREIGN_KEY_CHECKS = 1;
