-- Data export for chat_groups
-- Exported on 2026-03-12T19:16:15.683Z
-- Total rows: 11

-- Disable foreign key checks temporarily
SET FOREIGN_KEY_CHECKS = 0;

INSERT IGNORE INTO chat_groups (`id`, `name`, `description`, `photo`, `type`, `department`, `created_by`, `created_at`) VALUES
(51, 'Choir Department', 'Official chat group for Choir department members', NULL, 'department', 'Choir', 1, '2026-02-02 18:26:59'),
(52, 'Drama Department', 'Official chat group for Drama department members', NULL, 'department', 'Drama', 1, '2026-02-02 18:27:00'),
(53, 'Media Department', 'Official chat group for Media department members', NULL, 'department', 'Media', 1, '2026-02-02 18:27:00'),
(54, 'Youth Department', 'Official chat group for Youth department members', NULL, 'department', 'Youth', 1, '2026-02-02 18:27:00'),
(55, 'Evangelism Department', 'Official chat group for Evangelism department members', NULL, 'department', 'Evangelism', 1, '2026-02-02 18:27:00'),
(56, 'Prayer Team Department', 'Official chat group for Prayer Team department members', NULL, 'department', 'Prayer Team', 1, '2026-02-02 18:27:00'),
(57, 'Usher Department', 'Official chat group for Usher department members', NULL, 'department', 'Usher', 1, '2026-02-02 18:27:01'),
(58, 'Prayer Department', 'Official chat group for Prayer department members', NULL, 'department', 'Prayer', 1, '2026-02-24 13:57:58'),
(59, 'Protocol Department', 'Official chat group for Protocol department members', '/uploads/chat/photo-1772010370477-577261753.jpeg', 'department', 'Protocol', 5, '2026-02-24 13:58:40'),
(60, 'General', 'General church-wide group for all members', NULL, 'general', NULL, 1, '2026-02-24 15:15:55'),
(61, 'Covenant Men Department', 'Official chat group for Covenant Men department members', NULL, 'department', 'Covenant Men', 4, '2026-03-09 15:47:05');

-- Re-enable foreign key checks
SET FOREIGN_KEY_CHECKS = 1;
