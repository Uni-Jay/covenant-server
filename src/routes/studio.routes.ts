import { Router, Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import multer from 'multer';
import pool from '../config/database';
import { saveToCloud, cloudOn } from '../services/media.service';

/**
 * Church Studio (the church's media software) publishes to the website with a private key:
 * STUDIO_KEY on the server = "Website key" in Church Studio → Settings → Website.
 */
const router = Router();
const UPLOADS = path.join(__dirname, '../../uploads');

function keyOk(req: Request, res: Response, next: NextFunction) {
  const want = process.env.STUDIO_KEY || '';
  const got = String(req.headers['x-studio-key'] || '');
  if (want.length < 16 || got.length !== want.length || !crypto.timingSafeEqual(Buffer.from(got), Buffer.from(want))) {
    return res.status(401).json({ ok: false, message: 'The website key is not right. Copy it again from the website settings.' });
  }
  next();
}
router.use(keyOk);

const store = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => { const d = path.join(UPLOADS, file.fieldname === 'audio' ? 'sermons' : file.fieldname === 'image' ? 'gallery' : 'events'); fs.mkdirSync(d, { recursive: true }); cb(null, d); },
    filename: (req, file, cb) => cb(null, `studio-${file.fieldname}-${Date.now()}-${Math.round(Math.random() * 1e6)}${path.extname(file.originalname || '').toLowerCase() || (file.fieldname === 'audio' ? '.mp3' : '.jpg')}`),
  }),
  limits: { fileSize: 95 * 1024 * 1024 },
});

/** Keep the file for good (Cloudinary) and return the address to store in the database. */
async function keep(f?: Express.Multer.File): Promise<string | null> {
  if (!f) return null;
  const local = '/uploads/' + path.relative(UPLOADS, f.path).replace(/\\/g, '/');
  try { const u = await saveToCloud(f.path); return u || local; } catch (e: any) { console.error('☁️  Could not save', f.originalname, e.message); return local; }
}
async function setting(k: string, v: string) {
  await pool.query('INSERT INTO site_settings (k, v) VALUES (?, ?) ON DUPLICATE KEY UPDATE v = VALUES(v)', [k, v]);
}

router.get('/ping', async (_req, res) => {
  const [[s]]: any = await pool.query('SELECT COUNT(*) AS n FROM sermons');
  const [[e]]: any = await pool.query('SELECT COUNT(*) AS n FROM events');
  res.json({ ok: true, sermons: s.n, events: e.n, storage: cloudOn ? 'permanent' : 'temporary' });
});

/** A sermon from the sermon library, with its MP3. The same studioId updates the same sermon. */
router.post('/sermons', store.fields([{ name: 'audio', maxCount: 1 }, { name: 'thumbnail', maxCount: 1 }]), async (req: any, res) => {
  try {
    const b = req.body || {}, f = req.files || {};
    if (!b.title || !b.date) return res.status(400).json({ ok: false, message: 'A sermon needs a title and a date.' });
    const audio = await keep(f.audio && f.audio[0]), thumb = await keep(f.thumbnail && f.thumbnail[0]);
    const studioId = String(b.studioId || '').slice(0, 80) || null;
    const [found]: any = studioId ? await pool.query('SELECT id, audio_url, thumbnail_url FROM sermons WHERE studio_id = ?', [studioId]) : [[]];
    const fields = { title: String(b.title).slice(0, 255), description: String(b.description || '').slice(0, 5000), preacher: String(b.preacher || 'Guest minister').slice(0, 100),
      date: String(b.date).slice(0, 10), category: String(b.category || 'Sunday Service').slice(0, 50) };
    if (found.length) {
      const cur = found[0];
      await pool.query('UPDATE sermons SET title=?, description=?, preacher=?, date=?, category=?, audio_url=?, thumbnail_url=?, video_url=COALESCE(?, video_url) WHERE id=?',
        [fields.title, fields.description, fields.preacher, fields.date, fields.category, audio || cur.audio_url, thumb || cur.thumbnail_url, b.videoUrl || null, cur.id]);
      return res.json({ ok: true, id: cur.id, updated: true });
    }
    const [r]: any = await pool.query('INSERT INTO sermons (title, description, preacher, date, category, audio_url, thumbnail_url, video_url, studio_id) VALUES (?,?,?,?,?,?,?,?,?)',
      [fields.title, fields.description, fields.preacher, fields.date, fields.category, audio, thumb, b.videoUrl || null, studioId]);
    res.json({ ok: true, id: r.insertId, created: true });
  } catch (e: any) { console.error('studio/sermons', e); res.status(500).json({ ok: false, message: e.message }); }
});

/** The church calendar: programmes added, changed or removed in Church Studio. */
router.post('/events/sync', store.any(), async (req: any, res) => {
  try {
    let list: any[] = [];
    try { list = JSON.parse(req.body.events || '[]'); } catch (e) { return res.status(400).json({ ok: false, message: 'Bad calendar data.' }); }
    const flyers: Record<string, Express.Multer.File> = {};
    (req.files || []).forEach((f: Express.Multer.File) => { flyers[f.fieldname.replace(/^flyer_/, '')] = f; });
    const ids: string[] = [];
    for (const ev of list.slice(0, 200)) {
      const sid = String(ev.studioId || '').slice(0, 64); if (!sid || !ev.title || !ev.start) continue;
      ids.push(sid);
      const img = flyers[sid] ? await keep(flyers[sid]) : null;
      const desc = [ev.note, ev.venue ? 'Venue: ' + ev.venue : ''].filter(Boolean).join('\n');
      const [found]: any = await pool.query('SELECT id FROM events WHERE studio_id = ?', [sid]);
      if (found.length) {
        await pool.query('UPDATE events SET title=?, description=?, date=?, end_date=?, time=?, location=?, image_url=COALESCE(?, image_url), category=? WHERE id=?',
          [String(ev.title).slice(0, 255), desc, ev.start, ev.end || null, String(ev.time || '').slice(0, 50), String(ev.venue || '').slice(0, 255), img, 'Church programme', found[0].id]);
      } else {
        await pool.query('INSERT INTO events (title, description, date, end_date, time, location, image_url, category, studio_id) VALUES (?,?,?,?,?,?,?,?,?)',
          [String(ev.title).slice(0, 255), desc, ev.start, ev.end || null, String(ev.time || '').slice(0, 50), String(ev.venue || '').slice(0, 255), img, 'Church programme', sid]);
      }
    }
    // programmes deleted in Church Studio (only upcoming ones; past programmes stay on the website)
    const today = new Date().toISOString().slice(0, 10);
    const [mine]: any = await pool.query('SELECT id, studio_id FROM events WHERE studio_id IS NOT NULL AND date >= ?', [today]);
    let removed = 0;
    for (const m of mine) if (!ids.includes(m.studio_id)) { await pool.query('DELETE FROM events WHERE id = ?', [m.id]); removed++; }
    res.json({ ok: true, saved: ids.length, removed });
  } catch (e: any) { console.error('studio/events', e); res.status(500).json({ ok: false, message: e.message }); }
});

/** "We're live" on the website's Live page. */
router.post('/live', async (req, res) => {
  try {
    const b = req.body || {};
    await setting('live_on', b.isLive ? 'true' : 'false');
    if (b.url) await setting('live_url', String(b.url).slice(0, 500));
    if (b.title) await setting('live_title', String(b.title).slice(0, 200));
    if (b.description != null) await setting('live_description', String(b.description).slice(0, 500));
    await setting('live_changed', new Date().toISOString());
    res.json({ ok: true });
  } catch (e: any) { res.status(500).json({ ok: false, message: e.message }); }
});

/** A flyer or picture for the gallery. */
router.post('/gallery', store.single('image'), async (req: any, res) => {
  try {
    if (!req.file) return res.status(400).json({ ok: false, message: 'No picture.' });
    const url = await keep(req.file);
    const cat = ['building', 'pastor', 'events', 'worship', 'youth', 'children'].includes(req.body.category) ? req.body.category : 'events';
    const [r]: any = await pool.query('INSERT INTO gallery (title, description, image_url, category) VALUES (?,?,?,?)', [String(req.body.title || 'Church programme').slice(0, 255), String(req.body.description || ''), url, cat]);
    res.json({ ok: true, id: r.insertId, url });
  } catch (e: any) { res.status(500).json({ ok: false, message: e.message }); }
});

export default router;
