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
