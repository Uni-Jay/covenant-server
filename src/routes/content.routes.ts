import { Router } from 'express';
import pool from '../config/database';
import { authenticate, isAdminOrMedia } from '../middleware/auth.middleware';
import { upload } from '../middleware/upload.middleware';
import { notifyPublicSubmission, savePublicSubmission } from '../utils/publicSubmission';

const router = Router();

type WeeklyStudyRow = {
  id: number;
  title: string;
  scripture: string;
  time: string;
  location: string;
  is_active: number;
};

type StudySeriesRow = {
  id: number;
  title: string;
  description: string;
  duration: string;
  level: string;
  sort_order: number;
  is_active: number;
};

type StudyResourceRow = {
  id: number;
  title: string;
  type: string;
  size: string;
  url: string;
  sort_order: number;
  is_active: number;
};

let bibleStudyTablesReady = false;

const ensureBibleStudyTables = async () => {
  if (bibleStudyTablesReady) {
    return;
  }

  await pool.execute(`
    CREATE TABLE IF NOT EXISTS bible_study_weekly (
      id INT AUTO_INCREMENT PRIMARY KEY,
      title VARCHAR(255) NOT NULL,
      scripture VARCHAR(255) NOT NULL,
      time VARCHAR(100) NOT NULL,
      location VARCHAR(255) NOT NULL,
      is_active TINYINT(1) DEFAULT 1,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await pool.execute(`
    CREATE TABLE IF NOT EXISTS bible_study_series (
      id INT AUTO_INCREMENT PRIMARY KEY,
      title VARCHAR(255) NOT NULL,
      description TEXT,
      duration VARCHAR(100),
      level VARCHAR(50),
      sort_order INT DEFAULT 0,
      is_active TINYINT(1) DEFAULT 1,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await pool.execute(`
    CREATE TABLE IF NOT EXISTS bible_study_resources (
      id INT AUTO_INCREMENT PRIMARY KEY,
      title VARCHAR(255) NOT NULL,
      type VARCHAR(100),
      size VARCHAR(50),
      url VARCHAR(500) NOT NULL,
      sort_order INT DEFAULT 0,
      is_active TINYINT(1) DEFAULT 1,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  bibleStudyTablesReady = true;
};

const parseBoolean = (value: unknown, defaultValue = true): boolean => {
  if (typeof value === 'boolean') {
    return value;
  }

  if (typeof value === 'string') {
    return value.toLowerCase() === 'true';
  }

  return defaultValue;
};

const formatBytes = (bytes: number) => {
  if (!bytes || bytes <= 0) {
    return '0 B';
  }

  const units = ['B', 'KB', 'MB', 'GB'];
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const value = bytes / Math.pow(1024, index);
  return `${value.toFixed(index === 0 ? 0 : 1)} ${units[index]}`;
};

const getBibleStudyContent = async () => {
  await ensureBibleStudyTables();

  const [weeklyRows] = await pool.execute(
    'SELECT id, title, scripture, time, location, is_active FROM bible_study_weekly WHERE is_active = 1 ORDER BY updated_at DESC LIMIT 1'
  ) as [WeeklyStudyRow[], any];

  const [studyRows] = await pool.execute(
    'SELECT id, title, description, duration, level, sort_order, is_active FROM bible_study_series WHERE is_active = 1 ORDER BY sort_order ASC, updated_at DESC'
  ) as [StudySeriesRow[], any];

  const [resourceRows] = await pool.execute(
    'SELECT id, title, type, size, url, sort_order, is_active FROM bible_study_resources WHERE is_active = 1 ORDER BY sort_order ASC, updated_at DESC'
  ) as [StudyResourceRow[], any];

  const weeklyStudy = weeklyRows[0]
    ? {
        id: weeklyRows[0].id,
        title: weeklyRows[0].title,
        scripture: weeklyRows[0].scripture,
        time: weeklyRows[0].time,
        location: weeklyRows[0].location,
      }
    : null;

  const studies = studyRows.length
    ? studyRows.map((study) => ({
        id: study.id,
        title: study.title,
        description: study.description,
        duration: study.duration,
        level: study.level,
      }))
    : [];

  const resources = resourceRows.length
    ? resourceRows.map((resource) => ({
        id: resource.id,
        title: resource.title,
        type: resource.type,
        size: resource.size,
        url: resource.url,
      }))
    : [];

  return {
    weeklyStudy,
    studies,
    resources,
  };
};

router.get('/bible-study', async (_req, res) => {
  try {
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.set('Pragma', 'no-cache');
    res.set('Expires', '0');
    res.set('Surrogate-Control', 'no-store');
    const payload = await getBibleStudyContent();
    res.json(payload);
  } catch (error) {
    console.error('Failed to fetch Bible Study content:', error);
    res.status(500).json({ message: 'Failed to fetch Bible Study content' });
  }
});

router.get('/admin/bible-study', authenticate, isAdminOrMedia, async (_req, res) => {
  try {
    await ensureBibleStudyTables();

    const [weeklyRows] = await pool.execute(
      'SELECT id, title, scripture, time, location, is_active FROM bible_study_weekly ORDER BY updated_at DESC LIMIT 1'
    ) as [WeeklyStudyRow[], any];

    const [studyRows] = await pool.execute(
      'SELECT id, title, description, duration, level, sort_order, is_active FROM bible_study_series ORDER BY sort_order ASC, updated_at DESC'
    ) as [StudySeriesRow[], any];

    const [resourceRows] = await pool.execute(
      'SELECT id, title, type, size, url, sort_order, is_active FROM bible_study_resources ORDER BY sort_order ASC, updated_at DESC'
    ) as [StudyResourceRow[], any];

    res.json({
      weeklyStudy: weeklyRows[0] || null,
      studies: studyRows.map((study) => ({
        id: study.id,
        title: study.title,
        description: study.description,
        duration: study.duration,
        level: study.level,
        sortOrder: study.sort_order,
        isActive: Boolean(study.is_active),
      })),
      resources: resourceRows.map((resource) => ({
        id: resource.id,
        title: resource.title,
        type: resource.type,
        size: resource.size,
        url: resource.url,
        sortOrder: resource.sort_order,
        isActive: Boolean(resource.is_active),
      })),
    });
  } catch (error) {
    console.error('Failed to fetch admin Bible Study content:', error);
    res.status(500).json({ message: 'Failed to fetch admin Bible Study content' });
  }
});

router.put('/admin/bible-study/weekly', authenticate, isAdminOrMedia, async (req, res) => {
  try {
    await ensureBibleStudyTables();
    const { title, scripture, time, location, isActive } = req.body;

    if (!title || !scripture || !time || !location) {
      return res.status(400).json({ message: 'title, scripture, time and location are required' });
    }

    const [existingRows] = await pool.execute(
      'SELECT id FROM bible_study_weekly ORDER BY updated_at DESC LIMIT 1'
    ) as [{ id: number }[], any];

    const activeFlag = isActive === false ? 0 : 1;

    if (existingRows.length) {
      await pool.execute(
        'UPDATE bible_study_weekly SET title = ?, scripture = ?, time = ?, location = ?, is_active = ? WHERE id = ?',
        [title, scripture, time, location, activeFlag, existingRows[0].id]
      );
    } else {
      await pool.execute(
        'INSERT INTO bible_study_weekly (title, scripture, time, location, is_active) VALUES (?, ?, ?, ?, ?)',
        [title, scripture, time, location, activeFlag]
      );
    }

    res.json({ message: 'Weekly Bible Study content updated successfully' });
  } catch (error) {
    console.error('Failed to update weekly Bible Study content:', error);
    res.status(500).json({ message: 'Failed to update weekly Bible Study content' });
  }
});

router.post('/admin/bible-study/series', authenticate, isAdminOrMedia, async (req, res) => {
  try {
    await ensureBibleStudyTables();
    const { title, description, duration, level, sortOrder, isActive } = req.body;

    if (!title) {
      return res.status(400).json({ message: 'title is required' });
    }

    const [result] = await pool.execute(
      'INSERT INTO bible_study_series (title, description, duration, level, sort_order, is_active) VALUES (?, ?, ?, ?, ?, ?)',
      [
        title,
        description || null,
        duration || null,
        level || null,
        Number.isFinite(Number(sortOrder)) ? Number(sortOrder) : 0,
        isActive === false ? 0 : 1,
      ]
    ) as [{ insertId: number }, any];

    res.status(201).json({ message: 'Bible Study series created successfully', id: result.insertId });
  } catch (error) {
    console.error('Failed to create Bible Study series:', error);
    res.status(500).json({ message: 'Failed to create Bible Study series' });
  }
});

router.put('/admin/bible-study/series/:id', authenticate, isAdminOrMedia, async (req, res) => {
  try {
    await ensureBibleStudyTables();
    const { id } = req.params;
    const { title, description, duration, level, sortOrder, isActive } = req.body;

    if (!title) {
      return res.status(400).json({ message: 'title is required' });
    }

    await pool.execute(
      'UPDATE bible_study_series SET title = ?, description = ?, duration = ?, level = ?, sort_order = ?, is_active = ? WHERE id = ?',
      [
        title,
        description || null,
        duration || null,
        level || null,
        Number.isFinite(Number(sortOrder)) ? Number(sortOrder) : 0,
        isActive === false ? 0 : 1,
        id,
      ]
    );

    res.json({ message: 'Bible Study series updated successfully' });
  } catch (error) {
    console.error('Failed to update Bible Study series:', error);
    res.status(500).json({ message: 'Failed to update Bible Study series' });
  }
});

router.delete('/admin/bible-study/series/:id', authenticate, isAdminOrMedia, async (req, res) => {
  try {
    await ensureBibleStudyTables();
    const { id } = req.params;
    await pool.execute('DELETE FROM bible_study_series WHERE id = ?', [id]);
    res.json({ message: 'Bible Study series deleted successfully' });
  } catch (error) {
    console.error('Failed to delete Bible Study series:', error);
    res.status(500).json({ message: 'Failed to delete Bible Study series' });
  }
});

router.post('/admin/bible-study/resources', authenticate, isAdminOrMedia, upload.single('resourceFile'), async (req: any, res) => {
  try {
    await ensureBibleStudyTables();
    const { title, type, size, url, sortOrder, isActive } = req.body;
    const file = req.file;

    if (!title) {
      return res.status(400).json({ message: 'title is required' });
    }

    const resolvedUrl = file ? `/uploads/others/${file.filename}` : url;
    const resolvedSize = size || (file ? formatBytes(file.size) : null);
    const resolvedType = type || (file?.mimetype || 'PDF');

    if (!resolvedUrl) {
      return res.status(400).json({ message: 'Provide a resource URL or upload a file' });
    }

    const [result] = await pool.execute(
      'INSERT INTO bible_study_resources (title, type, size, url, sort_order, is_active) VALUES (?, ?, ?, ?, ?, ?)',
      [
        title,
        resolvedType,
        resolvedSize,
        resolvedUrl,
        Number.isFinite(Number(sortOrder)) ? Number(sortOrder) : 0,
        parseBoolean(isActive, true) ? 1 : 0,
      ]
    ) as [{ insertId: number }, any];

    res.status(201).json({ message: 'Bible Study resource created successfully', id: result.insertId });
  } catch (error) {
    console.error('Failed to create Bible Study resource:', error);
    res.status(500).json({ message: 'Failed to create Bible Study resource' });
  }
});

router.put('/admin/bible-study/resources/:id', authenticate, isAdminOrMedia, upload.single('resourceFile'), async (req: any, res) => {
  try {
    await ensureBibleStudyTables();
    const { id } = req.params;
    const { title, type, size, url, sortOrder, isActive } = req.body;
    const file = req.file;

    if (!title) {
      return res.status(400).json({ message: 'title is required' });
    }

    const [existingRows] = await pool.execute(
      'SELECT url, size, type FROM bible_study_resources WHERE id = ?',
      [id]
    ) as [{ url: string; size: string; type: string }[], any];

    if (!existingRows.length) {
      return res.status(404).json({ message: 'Resource not found' });
    }

    const existing = existingRows[0];
    const resolvedUrl = file ? `/uploads/others/${file.filename}` : (url || existing.url);
    const resolvedSize = size || (file ? formatBytes(file.size) : existing.size);
    const resolvedType = type || (file?.mimetype || existing.type || 'PDF');

    await pool.execute(
      'UPDATE bible_study_resources SET title = ?, type = ?, size = ?, url = ?, sort_order = ?, is_active = ? WHERE id = ?',
      [
        title,
        resolvedType,
        resolvedSize,
        resolvedUrl,
        Number.isFinite(Number(sortOrder)) ? Number(sortOrder) : 0,
        parseBoolean(isActive, true) ? 1 : 0,
        id,
      ]
    );

    res.json({ message: 'Bible Study resource updated successfully' });
  } catch (error) {
    console.error('Failed to update Bible Study resource:', error);
    res.status(500).json({ message: 'Failed to update Bible Study resource' });
  }
});

router.delete('/admin/bible-study/resources/:id', authenticate, isAdminOrMedia, async (req, res) => {
  try {
    await ensureBibleStudyTables();
    const { id } = req.params;
    await pool.execute('DELETE FROM bible_study_resources WHERE id = ?', [id]);
    res.json({ message: 'Bible Study resource deleted successfully' });
  } catch (error) {
    console.error('Failed to delete Bible Study resource:', error);
    res.status(500).json({ message: 'Failed to delete Bible Study resource' });
  }
});

router.post('/bible-study/join-week', async (req, res) => {
  try {
    const { name, email, phone } = req.body;
    const subject = 'Bible Study Weekly Registration';
    const html = `
      <h2>New Bible Study Weekly Registration</h2>
      <p><strong>Name:</strong> ${name}</p>
      <p><strong>Email:</strong> ${email}</p>
      <p><strong>Phone:</strong> ${phone || 'Not provided'}</p>
    `;

    const id = await savePublicSubmission({ name, email, phone, subject, message: 'Bible Study weekly registration' });
    const emailDelivered = await notifyPublicSubmission({ name, email, phone, subject, message: html });

    res.status(emailDelivered ? 201 : 202).json({ id, message: 'Registration submitted', emailDelivered });
  } catch (error) {
    res.status(500).json({ message: 'Failed to submit Bible Study registration' });
  }
});

router.post('/bible-study/enroll', async (req, res) => {
  try {
    const { name, email, phone, studyTitle } = req.body;
    const subject = `Bible Study Enrollment - ${studyTitle}`;
    const html = `
      <h2>New Bible Study Enrollment</h2>
      <p><strong>Study:</strong> ${studyTitle}</p>
      <p><strong>Name:</strong> ${name}</p>
      <p><strong>Email:</strong> ${email}</p>
      <p><strong>Phone:</strong> ${phone || 'Not provided'}</p>
    `;

    const id = await savePublicSubmission({ name, email, phone, subject, message: `Bible Study enrollment for ${studyTitle}` });
    const emailDelivered = await notifyPublicSubmission({ name, email, phone, subject, message: html });

    res.status(emailDelivered ? 201 : 202).json({ id, message: 'Enrollment submitted', emailDelivered });
  } catch (error) {
    res.status(500).json({ message: 'Failed to submit Bible Study enrollment' });
  }
});

router.get('/livestream', async (_req, res) => {
  res.json({
    isLive: (process.env.LIVESTREAM_IS_LIVE || 'false') === 'true',
    liveStreamUrl: process.env.LIVESTREAM_URL || 'https://www.youtube.com/channel/YOUR_CHANNEL_ID/live',
    currentService: {
      title: process.env.LIVESTREAM_TITLE || 'Sunday Service',
      description: process.env.LIVESTREAM_DESCRIPTION || 'Join us for an inspiring time of worship, praise, and powerful Word.',
      viewers: parseInt(process.env.LIVESTREAM_VIEWERS || '245'),
    },
    serviceTimes: [
      { title: 'Sunday School', time: '8:00 AM - 9:00 AM' },
      { title: 'Sunday Service', time: '9:00 AM - 11:00 AM' },
      { title: 'Prayer Hour', time: 'Tuesday 6:00 PM - 7:00 PM' },
      { title: 'Bible Study', time: 'Thursday 6:00 PM - 7:00 PM' },
      { title: 'Monthly Vigil', time: 'Last Friday 11:00 PM - 4:00 AM' },
    ],
    previousServices: [
      { id: 1, title: 'Sunday Service', date: '2026-01-20', imageUrl: 'https://images.unsplash.com/photo-1438232992991-995b7058bbb3?w=400' },
      { id: 2, title: 'Sunday Service', date: '2026-01-19', imageUrl: 'https://images.unsplash.com/photo-1438232992991-995b7058bbb3?w=400' },
      { id: 3, title: 'Sunday Service', date: '2026-01-18', imageUrl: 'https://images.unsplash.com/photo-1438232992991-995b7058bbb3?w=400' },
    ],
  });
});

export default router;