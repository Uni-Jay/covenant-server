-- Data export for chat_messages
-- Exported on 2026-03-12T19:16:15.704Z
-- Total rows: 37

-- Disable foreign key checks temporarily
SET FOREIGN_KEY_CHECKS = 0;

INSERT IGNORE INTO chat_messages (`id`, `sender_id`, `receiver_id`, `group_id`, `message`, `media_url`, `media_type`, `is_read`, `created_at`) VALUES
(1, 1, NULL, 52, 'hello', NULL, NULL, 1, '2026-02-03 10:49:11'),
(2, 1, NULL, 52, 'upload_1770116288568.jpg', '/uploads/chat/file-1770116301901-500835213.jpg', 'image', 1, '2026-02-03 10:58:29'),
(3, 1, NULL, 52, 'wassup', NULL, NULL, 1, '2026-02-03 11:48:04'),
(4, 1, NULL, 51, 'hello', NULL, NULL, 1, '2026-02-03 12:25:11'),
(6, 1, NULL, 51, '@timi', NULL, NULL, 1, '2026-02-05 07:50:36'),
(7, 1, NULL, 51, '@Joshua Ogiriosa , how are you doing', NULL, NULL, 1, '2026-02-06 20:33:38'),
(8, 4, NULL, 51, '@Tolu Seyi, i am good jawe', NULL, NULL, 1, '2026-02-06 21:08:08'),
(9, 3, NULL, 52, '1770480156024.mp4', '/uploads/chat/file-1770480155305-353592047.mp4', 'video', 1, '2026-02-07 16:02:36'),
(10, 1, NULL, 52, '1771937972491.jpg', '/uploads/chat/file-1771937973332-962087131.jpg', 'image', 0, '2026-02-24 12:59:33'),
(11, 5, NULL, 59, 'Hello', NULL, NULL, 0, '2026-02-25 00:14:44'),
(12, 5, NULL, 59, 'H', NULL, NULL, 0, '2026-02-25 00:19:49'),
(13, 5, NULL, 59, '1771978809864.mp4', '/uploads/chat/file-1771978810681-67409675.mp4', 'video', 0, '2026-02-25 00:20:13'),
(14, 5, NULL, 59, '1772004746311.jpg', '/uploads/chat/file-1772004746504-510296889.jpg', 'image', 0, '2026-02-25 07:32:26'),
(15, 5, NULL, 59, 'Hi', NULL, NULL, 0, '2026-02-25 08:05:17'),
(16, 5, NULL, 59, 'Hi', NULL, NULL, 0, '2026-02-25 09:23:49'),
(17, 5, NULL, 59, 'voice_28s.m4a', '/uploads/chat/file-1772011569158-197195825.m4a', 'audio', 0, '2026-02-25 09:26:09'),
(18, 5, NULL, 60, '/uploads/chat/file-1772011569158-197195825.m4a', 'uploads//uploads/chat/file-1772011569158-197195825.m4a', 'audio', 1, '2026-02-25 09:29:01'),
(19, 5, NULL, 60, '➡ _Forwarded:_
H', NULL, NULL, 1, '2026-02-25 09:30:03'),
(20, 5, NULL, 60, '[FWD]', NULL, NULL, 1, '2026-02-25 09:37:40'),
(21, 5, NULL, 60, '[FWD]
H', NULL, NULL, 1, '2026-02-25 09:40:03'),
(22, 5, NULL, 59, 'Hi', NULL, NULL, 0, '2026-02-25 09:53:26'),
(23, 5, NULL, 60, '[FWD]', NULL, NULL, 1, '2026-02-25 09:53:48'),
(24, 5, NULL, 60, '[FWD]', NULL, NULL, 1, '2026-02-25 10:00:57'),
(25, 5, NULL, 59, 'voice_10s.m4a', '/uploads/chat/file-1772013763527-706953523.m4a', 'audio', 0, '2026-02-25 10:02:43'),
(26, 5, NULL, 60, '[FWD]
voice_10s.m4a', 'uploads/[FWD]
voice_10s.m4a', 'audio', 1, '2026-02-25 10:03:01'),
(27, 5, NULL, 60, '[FWD]
voice_10s.m4a', 'uploads/[FWD]
voice_10s.m4a', 'audio', 1, '2026-02-25 10:06:42'),
(28, 5, NULL, 60, 'voice_8s.m4a', '/uploads/chat/file-1772014031104-441156010.m4a', 'audio', 1, '2026-02-25 10:07:11'),
(29, 5, NULL, 59, '[FWD]
voice_8s.m4a', 'uploads/[FWD]
voice_8s.m4a', 'audio', 0, '2026-02-25 10:07:22'),
(30, 5, NULL, 60, 'voice_4s.m4a', '/uploads/chat/file-1772015485631-114288187.m4a', 'audio', 1, '2026-02-25 10:31:25'),
(31, 5, NULL, 59, '[FWD]
voice_4s.m4a', '/uploads/chat/file-1772015485631-114288187.m4a', 'audio', 0, '2026-02-25 10:31:31'),
(32, 5, NULL, 59, 'Hi', NULL, NULL, 0, '2026-02-25 10:35:56'),
(33, 5, NULL, 59, 'Hi', NULL, NULL, 0, '2026-02-25 10:36:07'),
(34, 5, NULL, 59, 'direct%20assessment%20print.xlsx', '/uploads/chat/file-1772020071707-886201415.xlsx', '', 0, '2026-02-25 11:47:51'),
(35, 5, NULL, 59, 'direct%20assessment%20print.xlsx', '/uploads/chat/file-1772020707221-740171204.xlsx', '', 0, '2026-02-25 11:58:27'),
(36, 5, NULL, 59, 'direct%20assessment%20print.xlsx', '/uploads/chat/file-1772020781468-631295442.xlsx', '', 0, '2026-02-25 11:59:41'),
(37, 1, NULL, 60, 'Hi', NULL, NULL, 1, '2026-03-09 14:50:04'),
(38, 1, NULL, 60, 'voice_12s.m4a', '/uploads/chat/file-1773068002963-994654277.m4a', 'audio', 1, '2026-03-09 14:53:23');

-- Re-enable foreign key checks
SET FOREIGN_KEY_CHECKS = 1;
