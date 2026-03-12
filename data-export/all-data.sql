-- Combined data export for Railway import
-- Exported on 2026-03-12T19:16:15.767Z
-- Total rows: 132

SET FOREIGN_KEY_CHECKS = 0;
SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";

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


-- Data export for sermons
-- Exported on 2026-03-12T19:16:15.491Z
-- Total rows: 1

-- Disable foreign key checks temporarily
SET FOREIGN_KEY_CHECKS = 0;

INSERT IGNORE INTO sermons (`id`, `title`, `description`, `preacher`, `date`, `video_url`, `audio_url`, `pdf_url`, `thumbnail_url`, `views`, `category`, `created_at`, `updated_at`) VALUES
(2, 'Prayer', 'Understanding rule of prayer ', 'Apostle Joshua A. Ogiriosa ', '2026-03-07 23:00:00', '/uploads/sermons/video-1773087318074-542015996.mp4', NULL, NULL, NULL, 7, 'Sunday Service', '2026-03-09 20:15:31', '2026-03-12 11:35:52');

-- Re-enable foreign key checks
SET FOREIGN_KEY_CHECKS = 1;


-- Data export for events
-- Exported on 2026-03-12T19:16:15.500Z
-- Total rows: 1

-- Disable foreign key checks temporarily
SET FOREIGN_KEY_CHECKS = 0;

INSERT IGNORE INTO events (`id`, `title`, `description`, `date`, `time`, `location`, `image_url`, `category`, `created_at`, `updated_at`) VALUES
(1, 'CHRISTMAS CAROL', 'WE ARE INVITING YOU ALL TO OUR CHRISTMAS CAROL', '2026-12-18 23:00:00', '16:00', 'CHURCH AUDITORIUM', '/uploads/events/image-1768946094784-898632315.jpeg', 'Service', '2026-01-20 21:54:54', '2026-01-20 21:54:54');

-- Re-enable foreign key checks
SET FOREIGN_KEY_CHECKS = 1;


-- Data export for prayer_requests
-- Exported on 2026-03-12T19:16:15.542Z
-- Total rows: 1

-- Disable foreign key checks temporarily
SET FOREIGN_KEY_CHECKS = 0;

INSERT IGNORE INTO prayer_requests (`id`, `name`, `email`, `phone`, `request`, `category`, `status`, `is_anonymous`, `created_at`, `updated_at`, `user_id`, `is_urgent`, `prayer_count`, `testimony`) VALUES
(1, 'Idowu Micheal1', 'idowutimilehin201@gmail.com', '09086275131', 'I need God to provide a Job for me', 'Work', 'answered', 0, '2026-02-05 12:10:51', '2026-03-11 15:28:46', NULL, 0, 0, NULL);

-- Re-enable foreign key checks
SET FOREIGN_KEY_CHECKS = 1;


-- Data export for ministries
-- Exported on 2026-03-12T19:16:15.554Z
-- Total rows: 17

-- Disable foreign key checks temporarily
SET FOREIGN_KEY_CHECKS = 0;

INSERT IGNORE INTO ministries (`id`, `name`, `description`, `leader`, `image_url`, `schedule`, `created_at`) VALUES
(1, 'Children Ministry', 'Nurturing young hearts to know and love Jesus', 'Sister Grace Ade', NULL, 'Sunday 9:00 AM', '2026-01-20 21:09:58'),
(2, 'Youth Ministry', 'Empowering young people to live boldly for Christ', 'Pastor David Okon', NULL, 'Saturday 4:00 PM', '2026-01-20 21:09:58'),
(3, 'Women Ministry', 'Building godly women of faith, purpose, and strength', 'Sis. Sarah Johnson', NULL, 'First Saturday 10:00 AM', '2026-01-20 21:09:58'),
(4, 'Men Ministry', 'Equipping men to be spiritual leaders', 'Elder Michael Brown', NULL, 'Second Saturday 2:00 PM', '2026-01-20 21:09:58'),
(5, 'Choir & Music', 'Using our voices and instruments to worship God', 'Minister Emmanuel Nwankwo', NULL, 'Thursday 6:00 PM', '2026-01-20 21:09:58'),
(6, 'Media Department', 'Broadcasting the Gospel through technology', 'Bro. James Okafor', NULL, 'All Services', '2026-01-20 21:09:58'),
(7, 'Ushering', 'Welcoming and serving with excellence', 'Sis. Blessing Adeyemi', NULL, 'All Services', '2026-01-20 21:09:58'),
(8, 'Evangelism', 'Reaching the lost with the Gospel', 'Pastor Daniel Okeke', NULL, 'Saturday 3:00 PM', '2026-01-20 21:09:58'),
(17, 'Drama Ministry', 'Bringing biblical stories and messages to life through creative theatrical performances and skits.', 'Bro. David Adebayo', 'https://images.unsplash.com/photo-1507676184212-d03ab07a01bf?w=400', 'Wednesday 5:00 PM', '2026-03-11 15:31:50'),
(18, 'Children Ministry', 'Nurturing young hearts to know and love Jesus', 'Sister Grace Ade', NULL, 'Sunday 9:00 AM', '2026-03-12 14:57:28'),
(19, 'Youth Ministry', 'Empowering young people to live boldly for Christ', 'Pastor David Okon', NULL, 'Saturday 4:00 PM', '2026-03-12 14:57:28'),
(20, 'Women Ministry', 'Building godly women of faith, purpose, and strength', 'Sis. Sarah Johnson', NULL, 'First Saturday 10:00 AM', '2026-03-12 14:57:28'),
(21, 'Men Ministry', 'Equipping men to be spiritual leaders', 'Elder Michael Brown', NULL, 'Second Saturday 2:00 PM', '2026-03-12 14:57:28'),
(22, 'Choir & Music', 'Using our voices and instruments to worship God', 'Minister Emmanuel Nwankwo', NULL, 'Thursday 6:00 PM', '2026-03-12 14:57:28'),
(23, 'Media Department', 'Broadcasting the Gospel through technology', 'Bro. James Okafor', NULL, 'All Services', '2026-03-12 14:57:28'),
(24, 'Ushering', 'Welcoming and serving with excellence', 'Sis. Blessing Adeyemi', NULL, 'All Services', '2026-03-12 14:57:28'),
(25, 'Evangelism', 'Reaching the lost with the Gospel', 'Pastor Daniel Okeke', NULL, 'Saturday 3:00 PM', '2026-03-12 14:57:28');

-- Re-enable foreign key checks
SET FOREIGN_KEY_CHECKS = 1;


-- Data export for hymns
-- Exported on 2026-03-12T19:16:15.622Z
-- Total rows: 9

-- Disable foreign key checks temporarily
SET FOREIGN_KEY_CHECKS = 0;

INSERT IGNORE INTO hymns (`id`, `title`, `number`, `lyrics`, `audio_url`, `category`, `is_favorite`, `created_at`) VALUES
(1, 'Amazing Grace', 1, 'Amazing grace! how sweet the sound
That saved a wretch like me;
I once was lost, but now am found;
Was blind, but now I see.', NULL, 'Classic', 0, '2026-01-24 22:40:56'),
(2, 'How Great Thou Art', 2, 'O Lord my God, when I in awesome wonder
Consider all the worlds Thy hands have made;
I see the stars, I hear the rolling thunder,
Thy power throughout the universe displayed.', NULL, 'Worship', 0, '2026-01-24 22:40:56'),
(3, 'Blessed Assurance', 3, 'Blessed assurance, Jesus is mine!
O what a foretaste of glory divine!
Heir of salvation, purchase of God,
Born of His Spirit, washed in His blood.', NULL, 'Assurance', 0, '2026-01-24 22:40:56'),
(4, 'Amazing Grace', 1, 'Amazing grace! how sweet the sound
That saved a wretch like me;
I once was lost, but now am found;
Was blind, but now I see.', NULL, 'Classic', 0, '2026-01-24 23:01:50'),
(5, 'How Great Thou Art', 2, 'O Lord my God, when I in awesome wonder
Consider all the worlds Thy hands have made;
I see the stars, I hear the rolling thunder,
Thy power throughout the universe displayed.', NULL, 'Worship', 0, '2026-01-24 23:01:50'),
(6, 'Blessed Assurance', 3, 'Blessed assurance, Jesus is mine!
O what a foretaste of glory divine!
Heir of salvation, purchase of God,
Born of His Spirit, washed in His blood.', NULL, 'Assurance', 0, '2026-01-24 23:01:50'),
(7, 'Amazing Grace', 1, 'Amazing grace! how sweet the sound
That saved a wretch like me;
I once was lost, but now am found;
Was blind, but now I see.', NULL, 'Classic', 0, '2026-01-24 23:19:11'),
(8, 'How Great Thou Art', 2, 'O Lord my God, when I in awesome wonder
Consider all the worlds Thy hands have made;
I see the stars, I hear the rolling thunder,
Thy power throughout the universe displayed.', NULL, 'Worship', 0, '2026-01-24 23:19:11'),
(9, 'Blessed Assurance', 3, 'Blessed assurance, Jesus is mine!
O what a foretaste of glory divine!
Heir of salvation, purchase of God,
Born of His Spirit, washed in His blood.', NULL, 'Assurance', 0, '2026-01-24 23:19:11');

-- Re-enable foreign key checks
SET FOREIGN_KEY_CHECKS = 1;


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


-- Data export for group_members
-- Exported on 2026-03-12T19:16:15.692Z
-- Total rows: 23

-- Disable foreign key checks temporarily
SET FOREIGN_KEY_CHECKS = 0;

INSERT IGNORE INTO group_members (`id`, `group_id`, `user_id`, `role`, `joined_at`) VALUES
(1, 51, 1, 'member', '2026-02-02 18:27:00'),
(2, 57, 1, 'member', '2026-02-02 18:27:01'),
(3, 56, 1, 'member', '2026-02-02 18:27:01'),
(4, 55, 1, 'member', '2026-02-02 18:27:01'),
(5, 54, 1, 'member', '2026-02-02 18:27:01'),
(6, 53, 1, 'member', '2026-02-02 18:27:01'),
(7, 52, 1, 'member', '2026-02-02 18:27:01'),
(8, 51, 3, 'member', '2026-02-05 09:49:32'),
(9, 52, 3, 'member', '2026-02-05 09:49:32'),
(10, 53, 3, 'member', '2026-02-05 09:49:32'),
(11, 56, 3, 'member', '2026-02-05 09:49:32'),
(12, 57, 3, 'member', '2026-02-05 09:49:32'),
(13, 54, 3, 'member', '2026-02-05 09:49:32'),
(14, 55, 3, 'member', '2026-02-05 09:49:32'),
(16, 51, 4, 'member', '2026-02-06 20:25:21'),
(17, 58, 1, 'member', '2026-02-24 13:57:58'),
(18, 59, 5, 'member', '2026-02-24 13:58:40'),
(19, 60, 1, 'member', '2026-02-24 15:15:55'),
(20, 60, 3, 'member', '2026-02-24 15:15:55'),
(21, 60, 4, 'member', '2026-02-24 15:15:55'),
(22, 60, 5, 'member', '2026-02-24 15:15:55'),
(23, 58, 4, 'member', '2026-03-09 15:47:05'),
(24, 61, 4, 'member', '2026-03-09 15:47:05');

-- Re-enable foreign key checks
SET FOREIGN_KEY_CHECKS = 1;


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


SET FOREIGN_KEY_CHECKS = 1;
