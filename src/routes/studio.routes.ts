import { Router, Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import multer from 'multer';
import pool from '../config/database';
import { saveToCloud, cloudOn } from '../services/media.service';
import { phoneKey, splitName } from './cms.routes';

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
    destination: (req, file, cb) => { const d = path.join(UPLOADS, file.fieldname === 'audio' ? 'sermons' : file.fieldname === 'image' ? 'gallery' : file.fieldname.startsWith('photo_') ? 'members' : 'events'); fs.mkdirSync(d, { recursive: true }); cb(null, d); },
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
        // keepFlyer false = the flyer was removed in Church Studio
        const keepOld = ev.keepFlyer === undefined || !!ev.keepFlyer;
        await pool.query('UPDATE events SET title=?, description=?, date=?, end_date=?, time=?, location=?, image_url=IF(?, COALESCE(?, image_url), NULL), category=? WHERE id=?',
          [String(ev.title).slice(0, 255), desc, ev.start, ev.end || null, String(ev.time || '').slice(0, 50), String(ev.venue || '').slice(0, 255), keepOld ? 1 : 0, img, 'Church programme', found[0].id]);
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

/**
 * Church Studio's birthday register → the church management system's members.
 * Only people whose details changed are sent (each has a signature). Details edited in the
 * management system stay, unless the person changes them again in Church Studio.
 */
router.post('/members/sync', store.any(), async (req: any, res) => {
  try {
    let people: any[] = [];
    try { people = JSON.parse(req.body.people || '[]'); } catch (e) { return res.status(400).json({ ok: false, message: 'Bad member data.' }); }
    const photos: Record<string, Express.Multer.File> = {};
    (req.files || []).forEach((f: Express.Multer.File) => { photos[f.fieldname.replace(/^photo_/, '')] = f; });
    const n = (v: any, lo: number, hi: number) => { const x = parseInt(v, 10); return x >= lo && x <= hi ? x : null; };
    let added = 0, updated = 0, linked = 0;
    for (const p of people.slice(0, 2000)) {
      const sid = String(p.id || '').slice(0, 40); if (!sid || !p.name) continue;
      const sig = String(p.sig || '').slice(0, 64);
      const nm = splitName(String(p.name));
      const pk = phoneKey(p.phone);
      const bd = n(p.day, 1, 31), bm = n(p.month, 1, 12), by = n(p.year, 1900, 2100), ad = n(p.annDay, 1, 31), am = n(p.annMonth, 1, 12);
      const photo = photos[sid] ? await keep(photos[sid]) : null;
      let [cur]: any = await pool.query('SELECT id, studio_sig FROM cms_members WHERE studio_id = ?', [sid]);
      if (!cur.length && pk.length === 10 && bd && bm) {
        // someone already typed into the management system: link them instead of adding twice
        [cur] = await pool.query('SELECT id, studio_sig FROM cms_members WHERE studio_id IS NULL AND phone_key = ? AND birth_day = ? AND birth_month = ?', [pk, bd, bm]) as any;
        if (cur.length) { await pool.query('UPDATE cms_members SET studio_id = ? WHERE id = ?', [sid, cur[0].id]); linked++; }
      }
      const vals = [nm.title, nm.first, nm.last, String(p.phone || '').slice(0, 30), pk, bd && bm ? bd : null, bd && bm ? bm : null, by,
        ad && am ? ad : null, ad && am ? am : null, String(p.spouse || '').slice(0, 120), String(p.dept || '').slice(0, 120), p.consent ? 1 : 0, sig];
      if (cur.length) {
        if (cur[0].studio_sig === sig && !photo) continue;
        await pool.query(`UPDATE cms_members SET title = ?, first_name = ?, last_name = ?, phone = ?, phone_key = ?, birth_day = ?, birth_month = ?, birth_year = ?,
          ann_day = ?, ann_month = ?, spouse_name = IF(? = '', spouse_name, ?), department_text = ?, consent_screen = ?, studio_sig = ?,
          marital_status = IF(ann_day IS NOT NULL AND marital_status = '', 'married', marital_status), gender = IF(gender = '', ?, gender), photo_url = COALESCE(?, photo_url) WHERE id = ?`,
          [...vals.slice(0, 10), vals[10], vals[10], ...vals.slice(11), nm.gender, photo, cur[0].id]);
        updated++;
        await joinDept(cur[0].id, p.dept);
      } else {
        const [r]: any = await pool.query(`INSERT INTO cms_members (title, first_name, last_name, phone, phone_key, birth_day, birth_month, birth_year, ann_day, ann_month,
          spouse_name, department_text, consent_screen, studio_sig, studio_id, photo_url, marital_status, gender, source) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?, 'studio')`,
          [...vals, sid, photo || '', ad && am ? 'married' : '', nm.gender]);
        added++;
        await joinDept(r.insertId, p.dept);
      }
    }
    const [[tot]]: any = await pool.query("SELECT COUNT(*) n FROM cms_members WHERE studio_id IS NOT NULL");
    res.json({ ok: true, added, updated, linked, total: tot.n });
  } catch (e: any) { console.error('studio/members', e); res.status(500).json({ ok: false, message: e.message }); }
});
/** The department typed in the birthday form becomes a group in the management system */
async function joinDept(memberId: number, dept: any) {
  const name = String(dept || '').trim().replace(/\s+/g, ' ').slice(0, 120);
  if (!name || /^(none|nil|no|n\/a|-)$/i.test(name)) return;
  let [g]: any = await pool.query('SELECT id FROM cms_groups WHERE LOWER(name) = LOWER(?)', [name]);
  let gid = g[0] && g[0].id;
  if (!gid) { const [r]: any = await pool.query("INSERT INTO cms_groups (name, type) VALUES (?, 'department')", [name]); gid = r.insertId; }
  await pool.query('INSERT IGNORE INTO cms_group_members (group_id, member_id) VALUES (?, ?)', [gid, memberId]);
}

/** Birthday registrations and new photos sent on the website, for Church Studio to collect */
router.get('/birthdays/pending', async (_req, res) => {
  try {
    const [rows]: any = await pool.query(`SELECT q.id qid, q.kind, q.at, q.member_id, q.photo IS NOT NULL has_photo, m.title, m.first_name, m.last_name, m.phone, m.birth_day, m.birth_month, m.birth_year,
      m.ann_day, m.ann_month, m.spouse_name, m.department_text, m.consent_screen, m.studio_id FROM cms_form_queue q JOIN cms_members m ON m.id = q.member_id ORDER BY q.id`);
    const by: Record<number, any> = {};
    for (const r of rows) {
      const it = by[r.member_id] || (by[r.member_id] = { qids: [], kind: 'photo', studioId: r.studio_id || 'w' + r.member_id, name: [r.title, r.first_name, r.last_name].filter(Boolean).join(' '),
        day: r.birth_day, month: r.birth_month, year: r.birth_year || '', phone: r.phone, dept: r.department_text, spouse: r.spouse_name, consent: !!r.consent_screen,
        annDay: r.ann_day || '', annMonth: r.ann_month || '', photoQid: null });
      it.qids.push(r.qid); if (r.kind === 'new') it.kind = 'new'; if (r.has_photo) it.photoQid = r.qid;
    }
    res.json({ ok: true, items: Object.values(by).slice(0, 300) });
  } catch (e: any) { res.status(500).json({ ok: false, message: e.message }); }
});
router.get('/birthdays/photo/:qid', async (req, res) => {
  const [rows]: any = await pool.query('SELECT photo FROM cms_form_queue WHERE id = ?', [req.params.qid]);
  if (!rows[0] || !rows[0].photo) return res.status(404).end();
  res.setHeader('Content-Type', 'image/jpeg'); res.send(rows[0].photo);
});
/** Church Studio has them now. If it already had the person under another id, the two are joined. */
router.post('/birthdays/ack', async (req, res) => {
  try {
    const done: any[] = Array.isArray(req.body?.done) ? req.body.done.slice(0, 600) : [];
    for (const d of done) {
      const qid = parseInt(d.qid, 10); if (!qid) continue;
      const [[row]]: any = await pool.query('SELECT member_id FROM cms_form_queue WHERE id = ?', [qid]);
      await pool.query('DELETE FROM cms_form_queue WHERE id = ?', [qid]);
      const sid = String(d.studioId || '').slice(0, 40);
      if (!row || !sid) continue;
      const [[m]]: any = await pool.query('SELECT id, studio_id FROM cms_members WHERE id = ?', [row.member_id]);
      if (!m || m.studio_id === sid) continue;
      const [[other]]: any = await pool.query('SELECT id FROM cms_members WHERE studio_id = ? AND id <> ?', [sid, m.id]);
      if (other) {   // the same person already came from Church Studio: keep that one
        const [[left]]: any = await pool.query('SELECT COUNT(*) n FROM cms_form_queue WHERE member_id = ?', [m.id]);
        if (!left.n) { await pool.query('DELETE FROM cms_group_members WHERE member_id = ?', [m.id]); await pool.query('DELETE FROM cms_members WHERE id = ? AND user_id IS NULL', [m.id]); }
      } else await pool.query('UPDATE cms_members SET studio_id = ? WHERE id = ?', [sid, m.id]);
    }
    res.json({ ok: true });
  } catch (e: any) { res.status(500).json({ ok: false, message: e.message }); }
});

/** Messages sent with the church screen's QR code, for Church Studio's Messages tab */
router.get('/inbox/pending', async (_req, res) => {
  try {
    const [rows]: any = await pool.query('SELECT id, type, name, from_place, phone, text, first_time, private_req, at FROM cms_inbox WHERE pulled = 0 ORDER BY id LIMIT 200');
    res.json({ ok: true, items: rows.map((r: any) => ({ id: r.id, type: r.type, name: r.name, from: r.from_place, phone: r.phone, text: r.text || '', first: !!r.first_time, private: !!r.private_req, t: new Date(r.at).getTime() })) });
  } catch (e: any) { res.status(500).json({ ok: false, message: e.message }); }
});
router.post('/inbox/ack', async (req, res) => {
  try {
    const ids = (Array.isArray(req.body?.ids) ? req.body.ids : []).map((x: any) => parseInt(x, 10)).filter((x: number) => x > 0).slice(0, 500);
    if (ids.length) await pool.query(`UPDATE cms_inbox SET pulled = 1 WHERE id IN (${ids.map(() => '?').join(',')})`, ids);
    await pool.query('DELETE FROM cms_inbox WHERE pulled = 1 AND at < DATE_SUB(NOW(), INTERVAL 60 DAY)');
    res.json({ ok: true });
  } catch (e: any) { res.status(500).json({ ok: false, message: e.message }); }
});

/** "We're live" on the website's Live page. */
router.post('/live', async (req, res) => {
  try {
    const b = req.body || {};
    await setting('live_on', b.isLive ? 'true' : 'false');
    if (b.isLive) await setting('live_url', String(b.url || '').slice(0, 500));
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
