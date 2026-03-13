import { Router } from 'express';
import { notifyPublicSubmission, savePublicSubmission } from '../utils/publicSubmission';

const router = Router();

router.get('/bible-study', async (_req, res) => {
  res.json({
    weeklyStudy: {
      title: process.env.BIBLE_STUDY_WEEKLY_TITLE || 'Walking in the Light',
      scripture: process.env.BIBLE_STUDY_WEEKLY_SCRIPTURE || '1 John 1:5-10',
      time: process.env.BIBLE_STUDY_WEEKLY_TIME || 'Wednesday, 6:00 PM',
      location: process.env.BIBLE_STUDY_WEEKLY_LOCATION || 'Main Auditorium / Zoom',
    },
    studies: [
      {
        id: 1,
        title: 'Book of Romans',
        description: 'A comprehensive study of Paul\'s letter to the Romans, exploring themes of salvation, grace, and righteousness.',
        duration: '12 weeks',
        level: 'Intermediate',
      },
      {
        id: 2,
        title: 'Foundations of Faith',
        description: 'Perfect for new believers. Learn the basics of Christian faith and practice.',
        duration: '8 weeks',
        level: 'Beginner',
      },
      {
        id: 3,
        title: 'Prophetic Books',
        description: 'Dive deep into the major and minor prophets, understanding God\'s messages to His people.',
        duration: '16 weeks',
        level: 'Advanced',
      },
    ],
    resources: [
      { id: 1, title: 'Study Guide - Book of Romans', size: '2.5 MB', type: 'PDF', url: `${process.env.APP_URL || 'https://hocfam.org'}/documents/romans-study-guide` },
      { id: 2, title: 'Sermon Notes Template', size: '1.2 MB', type: 'PDF', url: `${process.env.APP_URL || 'https://hocfam.org'}/documents/sermon-notes-template` },
      { id: 3, title: 'Bible Reading Plan (2026)', size: '850 KB', type: 'PDF', url: `${process.env.APP_URL || 'https://hocfam.org'}/documents/bible-reading-plan-2026` },
      { id: 4, title: 'Faith Foundations Workbook', size: '3.1 MB', type: 'PDF', url: `${process.env.APP_URL || 'https://hocfam.org'}/documents/faith-foundations-workbook` },
    ],
  });
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