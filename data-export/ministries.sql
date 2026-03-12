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
