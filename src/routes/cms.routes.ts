import { Router, Response, NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import pool from '../config/database';
import { authenticate, AuthRequest } from '../middleware/auth.middleware';
import { upload } from '../middleware/upload.middleware';
import { sendBrevoTransactionalEmail } from '../services/email.service';

/**
 * Church management system: members, families, groups, attendance, first timers, giving,
 * expenses, reports and messages for staff, plus a member portal ("/me").
 * Staff sign in with their website account; what they see depends on their role.
 */
const router = Router();

// ------------------------------------------------------------------ helpers
const FULL = ['super_admin', 'admin', 'head_admin', 'church_admin', 'gen_overseer', 'senior_pastor', 'pastor'];
const PEOPLE = [...FULL, 'secretary', 'elder', 'deacon', 'department_head', 'church_committee_chairman'];
const MONEY = [...FULL, 'finance'];
type Area = 'people' | 'money' | 'admin';
const role = (req: AuthRequest) => String(req.user?.role || '').toLowerCase();
const allowed = (r: string, area: Area) => (area === 'admin' ? FULL : area === 'money' ? MONEY : PEOPLE).includes(r);
const can = (area: Area) => (req: AuthRequest, res: Response, next: NextFunction) =>
  allowed(role(req), area) ? next() : res.status(403).json({ message: 'Your account doesn’t have access to this part. Ask the church admin.' });

// DATE columns come back as 'YYYY-MM-DD' text (no time-zone shifts); money as numbers
const typeCast = (field: any, next: any) => {
  if (field.type === 'DATE') return field.string();
  if (field.type === 'NEWDECIMAL') { const v = field.string(); return v == null ? null : Number(v); }
  return next();
};
async function q(sql: string, values: any[] = []): Promise<any> {
  const [rows] = await pool.query({ sql, values, typeCast } as any);
  return rows;
}
const s = (v: any, n = 200) => String(v ?? '').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '').trim().slice(0, n);
const int = (v: any) => { const n = parseInt(v, 10); return Number.isFinite(n) ? n : null; };
const money = (v: any) => { const n = Number(String(v ?? '').replace(/[,\s₦]/g, '')); return Number.isFinite(n) ? Math.round(n * 100) / 100 : NaN; };
const day = (v: any) => (/^\d{4}-\d{2}-\d{2}$/.test(String(v || '')) ? String(v) : null);
const today = () => { const d = new Date(Date.now() + 3600e3); return d.toISOString().slice(0, 10); }; // Lagos
export const phoneKey = (p: any) => String(p || '').replace(/\D/g, '').slice(-10);
const pick = <T extends string>(v: any, list: readonly T[], d: T): T => (list.includes(v) ? v : d);
const wrap = (fn: (req: AuthRequest, res: Response) => Promise<any>) => (req: AuthRequest, res: Response) =>
  fn(req, res).catch((e: any) => { console.error('cms', req.method, req.path, e); res.status(500).json({ message: 'Something went wrong. Please try again.' }); });

async function audit(req: AuthRequest, action: string, detail = '') {
  try {
    const u: any = (await q('SELECT first_name, last_name FROM users WHERE id = ?', [req.user?.id]))[0] || {};
    await q('INSERT INTO cms_audit (user_id, user_name, action, detail) VALUES (?,?,?,?)', [req.user?.id || null, s(`${u.first_name || ''} ${u.last_name || ''}`, 120), action, s(detail, 500)]);
  } catch (e) { /* never block the work for the log */ }
}

const TITLES = /^(apostle|pastor|pst\.?|deacon|deaconess|dcns\.?|elder|evang(elist)?\.?|prophet(ess)?|rev(erend)?\.?|bishop|mr\.?|mrs\.?|miss|ms\.?|dr\.?|bro(ther)?\.?|sis(ter)?\.?|engr\.?|chief|prof\.?|barr\.?|mummy|daddy|mama|baba)$/i;
export function splitName(full: string) {
  const parts = s(full, 120).split(/\s+/).filter(Boolean);
  const titles: string[] = [];
  // titles can be in brackets too: "Pastor (Mrs) Bisi …"
  while (parts.length > 1 && TITLES.test(parts[0].replace(/^\((.*)\)$/, '$1'))) titles.push(parts.shift() as string);
  const t = titles.join(' ').toLowerCase().replace(/\./g, '');
  const gender: 'male' | 'female' | '' = /\b(mrs|miss|ms|deaconess|dcns|sis|sister|prophetess|mummy|mama)\b/.test(t) ? 'female'
    : /\b(mr|bro|brother|deacon|daddy|baba)\b/.test(t) ? 'male' : '';
  return { title: titles.join(' '), first: parts.shift() || s(full, 80) || 'Member', last: parts.join(' '), gender };
}
const fullName = (m: any) => [m.title, m.first_name, m.last_name].filter(Boolean).join(' ');

function photoOf(req: any): string {
  const f = (req.files || []).find((x: any) => x.fieldname === 'photo' && /^image\//.test(x.mimetype)) || (req.file && /^image\//.test(req.file.mimetype) ? req.file : null);
  return f ? `/uploads/others/${f.filename}` : '';
}

const MEMBER_FIELDS = `m.id, m.title, m.first_name, m.last_name, m.gender, m.phone, m.email, m.address, m.birth_day, m.birth_month, m.birth_year,
  m.ann_day, m.ann_month, m.marital_status, m.spouse_name, m.family_id, m.family_role, m.photo_url, m.status, m.occupation,
  m.join_date, m.baptism_date, m.department_text, m.consent_screen, m.source, m.notes, m.user_id, m.studio_id, m.created_at, m.updated_at`;

function memberInput(b: any) {
  const o: any = {
    title: s(b.title, 40), first_name: s(b.first_name, 80), last_name: s(b.last_name, 80),
    gender: pick(b.gender, ['male', 'female', ''] as const, ''), phone: s(b.phone, 30), email: s(b.email, 160).toLowerCase(),
    address: s(b.address, 500), occupation: s(b.occupation, 120), notes: s(b.notes, 4000),
    birth_day: int(b.birth_day), birth_month: int(b.birth_month), birth_year: int(b.birth_year),
    ann_day: int(b.ann_day), ann_month: int(b.ann_month),
    marital_status: pick(b.marital_status, ['single', 'married', 'widowed', 'divorced', ''] as const, ''), spouse_name: s(b.spouse_name, 120),
    family_id: int(b.family_id), family_role: pick(b.family_role, ['head', 'spouse', 'child', 'relative', ''] as const, ''),
    status: pick(b.status, ['member', 'worker', 'visitor', 'inactive'] as const, 'member'),
    join_date: day(b.join_date), baptism_date: day(b.baptism_date), consent_screen: b.consent_screen === true || b.consent_screen === '1' || b.consent_screen === 'true' ? 1 : 0,
  };
  if (!(o.birth_month >= 1 && o.birth_month <= 12)) { o.birth_month = null; o.birth_day = null; }
  if (!(o.birth_day >= 1 && o.birth_day <= 31)) o.birth_day = null;
  if (!(o.birth_year >= 1900 && o.birth_year <= 2100)) o.birth_year = null;
  if (!(o.ann_month >= 1 && o.ann_month <= 12) || !(o.ann_day >= 1 && o.ann_day <= 31)) { o.ann_month = null; o.ann_day = null; }
  o.phone_key = phoneKey(o.phone);
  return o;
}

// ------------------------------------------------------------------ public (no sign-in)
const formHits: Record<string, number[]> = {};
function tooMany(req: any, max: number) {
  const ip = String(req.headers['x-forwarded-for'] || req.ip || '').split(',')[0].trim();
  const list = (formHits[ip] = (formHits[ip] || []).filter((t) => Date.now() - t < 3600e3));
  if (list.length >= max) return true;
  list.push(Date.now()); return false;
}

/** First-timer card, filled on a phone at church (QR code) */
router.post('/public/first-timer', wrap(async (req, res) => {
  if (tooMany(req, 8)) return res.status(429).json({ message: 'Too many forms from this phone. Please ask an usher.' });
  const b = req.body || {};
  const name = s(b.name, 120);
  if (!name || (!phoneKey(b.phone) && !s(b.email))) return res.status(400).json({ message: 'Please type your name and your phone number.' });
  const svc = (await q('SELECT id FROM cms_services WHERE date = ? ORDER BY id DESC LIMIT 1', [today()]))[0];
  await q(`INSERT INTO cms_first_timers (name, phone, email, address, gender, visit_date, service_id, invited_by, how_heard, wants, prayer, source)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,'form')`, [name, s(b.phone, 30), s(b.email, 160), s(b.address, 500), pick(b.gender, ['male', 'female', ''] as const, ''),
    today(), svc ? svc.id : null, s(b.invited_by, 120), s(b.how_heard, 120), s(b.wants, 200), s(b.prayer, 2000)]);
  res.json({ ok: true });
}));

// ------------------------------------------------------------------ birthday register on the website (always on, one link)
const BDAY_TITLES = /^[\w .()'-]{0,30}$/;
const jpegOf = (v: any): Buffer | null => {
  const m = /^data:image\/jpeg;base64,([A-Za-z0-9+/=]+)$/.exec(String(v || ''));
  if (!m || m[1].length > 2.2e6) return null;
  const b = Buffer.from(m[1], 'base64'); return b.length > 1000 ? b : null;
};
async function joinDeptGroup(memberId: number, dept: any) {
  const name = s(dept, 120).replace(/\s+/g, ' ');
  if (!name || /^(none|nil|no|n\/a|-)$/i.test(name)) return;
  let g = (await q('SELECT id FROM cms_groups WHERE LOWER(name) = LOWER(?)', [name]))[0];
  if (!g) { const r: any = await q("INSERT INTO cms_groups (name, type) VALUES (?, 'department')", [name]); g = { id: r.insertId }; }
  await q('INSERT IGNORE INTO cms_group_members (group_id, member_id) VALUES (?, ?)', [g.id, memberId]);
}
const lastBday: Record<string, number> = {};
router.post('/public/birthday', wrap(async (req, res) => {
  const ip = String(req.headers['x-forwarded-for'] || req.ip || '').split(',')[0].trim();
  if (lastBday[ip] && Date.now() - lastBday[ip] < 4000) return res.status(429).json({ message: 'Please wait a few seconds and send again.' });
  if (tooMany(req, 80)) return res.status(429).json({ message: 'Too many forms from this connection. Please try again later.' });
  const b = req.body || {};
  const title = BDAY_TITLES.test(String(b.title || '')) ? s(b.title, 30) : '';
  const raw = s(b.name, 70), day = int(b.day), month = int(b.month);
  if (!raw || !(day! >= 1 && day! <= 31) || !(month! >= 1 && month! <= 12)) return res.status(400).json({ message: 'Please type your name and choose your birthday.' });
  const full = (title ? title + ' ' : '') + raw;
  const n = splitName(full), pk = phoneKey(b.phone), year = int(b.year);
  const annDay = int(b.annDay), annMonth = int(b.annMonth);
  const photo = jpegOf(b.photo);
  // the same person sending again (same name or same phone, same birthday) updates their earlier entry
  const all = await q(`SELECT id, title, first_name, last_name, phone_key, studio_id FROM cms_members WHERE birth_day = ? AND birth_month = ?`, [day, month]);
  const same = all.find((m: any) => fullName(m).toLowerCase() === full.toLowerCase() || [m.first_name, m.last_name].join(' ').trim().toLowerCase() === raw.toLowerCase())
    || (pk.length === 10 ? all.find((m: any) => m.phone_key === pk) : null);
  const vals = { title: n.title, first_name: n.first, last_name: n.last, gender: n.gender, phone: s(b.phone, 30), phone_key: pk, birth_day: day, birth_month: month,
    birth_year: year && year >= 1900 && year <= 2100 ? year : null, ann_day: annDay && annMonth ? annDay : null, ann_month: annDay && annMonth ? annMonth : null,
    spouse_name: s(b.spouse, 120), department_text: s(b.dept, 120), consent_screen: b.consent ? 1 : 0 };
  let id: number;
  if (same) {
    id = same.id;
    await q(`UPDATE cms_members SET title = ?, first_name = ?, last_name = ?, gender = IF(gender = '', ?, gender), phone = ?, phone_key = ?, birth_day = ?, birth_month = ?,
      birth_year = COALESCE(?, birth_year), ann_day = ?, ann_month = ?, spouse_name = ?, department_text = ?, consent_screen = ?,
      marital_status = IF(? IS NOT NULL AND marital_status = '', 'married', marital_status), studio_id = COALESCE(studio_id, ?) WHERE id = ?`,
      [vals.title, vals.first_name, vals.last_name, vals.gender, vals.phone, vals.phone_key, day, month, vals.birth_year, vals.ann_day, vals.ann_month,
        vals.spouse_name, vals.department_text, vals.consent_screen, vals.ann_day, 'w' + id, id]);
  } else {
    const r: any = await q(`INSERT INTO cms_members (title, first_name, last_name, gender, phone, phone_key, birth_day, birth_month, birth_year, ann_day, ann_month,
      spouse_name, department_text, consent_screen, marital_status, status, source) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?, 'member', 'self')`,
      [vals.title, vals.first_name, vals.last_name, vals.gender, vals.phone, vals.phone_key, day, month, vals.birth_year, vals.ann_day, vals.ann_month,
        vals.spouse_name, vals.department_text, vals.consent_screen, vals.ann_day ? 'married' : '']);
    id = r.insertId;
    await q('UPDATE cms_members SET studio_id = ? WHERE id = ?', ['w' + id, id]);
  }
  await joinDeptGroup(id, b.dept);
  await q('DELETE FROM cms_form_queue WHERE member_id = ?', [id]);
  await q('INSERT INTO cms_form_queue (member_id, kind, photo) VALUES (?, ?, ?)', [id, 'new', photo]);
  if (photo) await q('UPDATE cms_members SET photo_url = ? WHERE id = ?', [`/api/cms/public/photo/${id}?v=${Date.now()}`, id]);
  lastBday[ip] = Date.now();
  res.json({ ok: true });
}));
/** The church screen's QR code: prayer request, testimony or "I'm visiting" card. Church Studio shows them in Messages. */
const lastMsg: Record<string, number> = {};
router.post('/public/message', wrap(async (req, res) => {
  const ip = String(req.headers['x-forwarded-for'] || req.ip || '').split(',')[0].trim();
  if (lastMsg[ip] && Date.now() - lastMsg[ip] < 3000) return res.status(429).json({ message: 'Please wait a moment and send again.' });
  if (tooMany(req, 120)) return res.status(429).json({ message: 'Too many messages from this connection. Please try again later.' });
  const b = req.body || {}, type = String(b.type || '');
  if (!/^(prayer|testimony|visitor)$/.test(type)) return res.status(400).json({ message: 'Something was missing.' });
  const m = { name: s(b.name, 60), from: s(b.from, 60), phone: s(b.phone, 30), text: s(b.text, 1200), first: !!b.first, priv: !!b.private };
  if (type !== 'visitor' && !m.text) return res.status(400).json({ message: 'Please type your message.' });
  if (type === 'visitor' && !m.name) return res.status(400).json({ message: 'Please type your name.' });
  await q('INSERT INTO cms_inbox (type, name, from_place, phone, text, first_time, private_req) VALUES (?,?,?,?,?,?,?)', [type, m.name, m.from, m.phone, m.text, m.first ? 1 : 0, m.priv ? 1 : 0]);
  // also where the church office already looks: prayer requests in the website admin, first timers in the church office
  try {
    if (type === 'prayer') await q('INSERT INTO prayer_requests (name, phone, request, category, is_anonymous) VALUES (?,?,?,?,?)', [m.name || null, m.phone || null, m.text, 'church-service', m.name ? 0 : 1]);
    if (type === 'visitor' && m.first) {
      const svc = (await q('SELECT id FROM cms_services WHERE date = ? ORDER BY id DESC LIMIT 1', [today()]))[0];
      await q(`INSERT INTO cms_first_timers (name, phone, address, visit_date, service_id, source) VALUES (?,?,?,?,?,'form')`, [m.name, m.phone, m.from, today(), svc ? svc.id : null]);
    }
  } catch (e) { /* the message itself is saved */ }
  lastMsg[ip] = Date.now();
  res.json({ ok: true });
}));
/** A member changes their photo: they prove it's them with the phone number and birthday they registered with */
router.post('/public/birthday/update', wrap(async (req, res) => {
  if (tooMany(req, 20)) return res.status(429).json({ message: 'Too many tries. Please wait a while, or ask the media team to change your photo.' });
  const b = req.body || {}, pk = phoneKey(b.phone), day = int(b.day), month = int(b.month);
  if (pk.length < 10 || !day || !month) return res.status(400).json({ message: 'Type the phone number and choose the birthday you registered with.' });
  let found = await q(`SELECT id, title, first_name, last_name, photo_url FROM cms_members WHERE phone_key = ? AND birth_day = ? AND birth_month = ? AND status <> 'inactive'`, [pk, day, month]);
  if (!found.length) return res.status(404).json({ message: 'We couldn’t find you with that phone number and birthday. Check them, or register as new.' });
  if (found.length > 1) {
    if (!b.who) return res.json({ ok: false, choose: found.map((m: any) => ({ id: m.id, name: fullName(m) })) });
    found = found.filter((m: any) => String(m.id) === String(b.who));
    if (!found.length) return res.status(400).json({ message: 'Please choose your name.' });
  }
  const m = found[0];
  if (b.check) return res.json({ ok: true, name: fullName(m), hasPhoto: !!m.photo_url });
  const photo = jpegOf(b.photo);
  if (!photo) return res.status(400).json({ message: 'Please choose your new photo.' });
  if (b.consent != null) await q('UPDATE cms_members SET consent_screen = ? WHERE id = ?', [b.consent ? 1 : 0, m.id]);
  await q(`DELETE FROM cms_form_queue WHERE member_id = ? AND kind = 'photo'`, [m.id]);
  await q('INSERT INTO cms_form_queue (member_id, kind, photo) VALUES (?, ?, ?)', [m.id, 'photo', photo]);
  await q('UPDATE cms_members SET photo_url = ?, studio_id = COALESCE(studio_id, ?) WHERE id = ?', [`/api/cms/public/photo/${m.id}?v=${Date.now()}`, 'w' + m.id, m.id]);
  res.json({ ok: true, name: fullName(m) });
}));
/** Photos sent on the website, until Church Studio has collected them */
router.get('/public/photo/:id', wrap(async (req, res) => {
  const r = (await q('SELECT photo FROM cms_form_queue WHERE member_id = ? AND photo IS NOT NULL ORDER BY id DESC LIMIT 1', [req.params.id]))[0];
  if (!r) return res.status(404).end();
  res.setHeader('Content-Type', 'image/jpeg'); res.setHeader('Cache-Control', 'public, max-age=86400');
  res.setHeader('Access-Control-Allow-Origin', '*'); res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
  res.send(r.photo);
}));

// ------------------------------------------------------------------ member portal sign-up (website account + link to the church register)
async function tryLink(userId: number, phone: string, bd: number | null, bm: number | null, email: string) {
  const pk = phoneKey(phone);
  let found: any[] = [];
  if (pk.length === 10 && bd && bm) found = await q('SELECT id FROM cms_members WHERE phone_key = ? AND birth_day = ? AND birth_month = ? AND user_id IS NULL', [pk, bd, bm]);
  if (found.length !== 1 && email) found = await q('SELECT id FROM cms_members WHERE email = ? AND email <> "" AND user_id IS NULL', [email]);
  if (found.length === 1) { await q('UPDATE cms_members SET user_id = ? WHERE id = ?', [userId, found[0].id]); return found[0].id; }
  return null;
}

router.post('/portal/register', wrap(async (req, res) => {
  if (tooMany(req, 10)) return res.status(429).json({ message: 'Too many tries. Please wait a while.' });
  const b = req.body || {};
  const email = s(b.email, 160).toLowerCase(), pw = String(b.password || '');
  const first = s(b.first_name, 80), last = s(b.last_name, 80), phone = s(b.phone, 30);
  const bd = int(b.birth_day), bm = int(b.birth_month);
  if (!first || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return res.status(400).json({ message: 'Type your name and a correct email address.' });
  if (pw.length < 8) return res.status(400).json({ message: 'Choose a password of at least 8 characters.' });
  if (phoneKey(phone).length < 10) return res.status(400).json({ message: 'Type your phone number.' });
  if ((await q('SELECT id FROM users WHERE email = ?', [email])).length) return res.status(409).json({ message: 'This email already has an account. Sign in instead (or use “Forgot password”).' });
  const hash = await bcrypt.hash(pw, 10);
  const dob = bd && bm ? `2000-${String(bm).padStart(2, '0')}-${String(bd).padStart(2, '0')}` : null;
  const r: any = await q('INSERT INTO users (email, password, first_name, last_name, phone, role, is_approved, birthday) VALUES (?,?,?,?,?,?,1,?)', [email, hash, first, last || '-', phone, 'member', dob]);
  const userId = r.insertId;
  const memberId = await tryLink(userId, phone, bd, bm, email);
  const token = jwt.sign({ id: userId, email, role: 'member' }, process.env.JWT_SECRET || 'your-secret-key-change-in-production', { expiresIn: '7d' });
  res.json({ token, user: { id: userId, email, firstName: first, lastName: last, role: 'member' }, linked: !!memberId });
}));

// ------------------------------------------------------------------ everything below needs sign-in
router.use(authenticate);

router.get('/whoami', wrap(async (req, res) => {
  const u = (await q('SELECT id, email, first_name, last_name, role, photo FROM users WHERE id = ?', [req.user?.id]))[0];
  if (!u) return res.status(401).json({ message: 'Please sign in again.' });
  const m = (await q('SELECT id FROM cms_members WHERE user_id = ?', [u.id]))[0];
  const r = String(u.role || '').toLowerCase();
  res.json({
    user: { id: u.id, email: u.email, name: `${u.first_name || ''} ${u.last_name || ''}`.trim(), role: r, photo: u.photo || '' },
    memberId: m ? m.id : null,
    can: { people: allowed(r, 'people'), money: allowed(r, 'money'), admin: allowed(r, 'admin') },
  });
}));

// ================================================================== MEMBER PORTAL
async function myMember(req: AuthRequest) {
  return (await q(`SELECT ${MEMBER_FIELDS} FROM cms_members m WHERE m.user_id = ?`, [req.user?.id]))[0] || null;
}
router.get('/me', wrap(async (req, res) => {
  const m = await myMember(req);
  if (!m) return res.json({ member: null });
  const family = m.family_id ? await q(`SELECT id, title, first_name, last_name, family_role, photo_url FROM cms_members WHERE family_id = ? AND id <> ?`, [m.family_id, m.id]) : [];
  const fam = m.family_id ? (await q('SELECT id, name FROM cms_families WHERE id = ?', [m.family_id]))[0] : null;
  const groups = await q('SELECT g.id, g.name, g.type, gm.role FROM cms_group_members gm JOIN cms_groups g ON g.id = gm.group_id WHERE gm.member_id = ?', [m.id]);
  const att = (await q(`SELECT COUNT(*) n FROM cms_attendance a JOIN cms_services s ON s.id = a.service_id WHERE a.member_id = ? AND s.date >= DATE_SUB(CURDATE(), INTERVAL 90 DAY)`, [m.id]))[0].n;
  const open = await q('SELECT id, date, title, type FROM cms_services WHERE checkin_open = 1 AND date >= DATE_SUB(CURDATE(), INTERVAL 1 DAY) ORDER BY date DESC LIMIT 1');
  let checkedIn = false;
  if (open[0]) checkedIn = (await q('SELECT 1 FROM cms_attendance WHERE service_id = ? AND member_id = ?', [open[0].id, m.id])).length > 0;
  res.json({ member: m, family: fam ? { ...fam, members: family } : null, groups, attended90: att, openService: open[0] ? { ...open[0], checkedIn } : null });
}));

router.post('/me/link', wrap(async (req, res) => {
  if (tooMany(req, 12)) return res.status(429).json({ message: 'Too many tries. Please wait a while, or ask the church office.' });
  if (await myMember(req)) return res.json({ ok: true });
  const u = (await q('SELECT email FROM users WHERE id = ?', [req.user?.id]))[0] || {};
  const id = await tryLink(req.user!.id, s(req.body.phone, 30), int(req.body.birth_day), int(req.body.birth_month), u.email || '');
  if (!id) return res.status(404).json({ message: 'We couldn’t find you in the church register with that phone number and birthday. The church office will link your account for you.' });
  res.json({ ok: true });
}));

router.put('/me', upload.any(), wrap(async (req: any, res) => {
  const m = await myMember(req);
  if (!m) return res.status(404).json({ message: 'Your account isn’t linked to the church register yet.' });
  const b = req.body || {};
  const photo = photoOf(req);
  await q(`UPDATE cms_members SET phone = ?, phone_key = ?, email = ?, address = ?, occupation = ?, gender = ?, marital_status = ?, spouse_name = ?,
    ann_day = ?, ann_month = ?, photo_url = IF(? = '', photo_url, ?) WHERE id = ?`,
    [s(b.phone, 30), phoneKey(b.phone), s(b.email, 160).toLowerCase(), s(b.address, 500), s(b.occupation, 120), pick(b.gender, ['male', 'female', ''] as const, m.gender),
      pick(b.marital_status, ['single', 'married', 'widowed', 'divorced', ''] as const, m.marital_status), s(b.spouse_name, 120),
      int(b.ann_day), int(b.ann_month), photo, photo, m.id]);
  res.json({ ok: true });
}));

/** Change my password (staff and members) */
router.post('/me/password', wrap(async (req, res) => {
  if (tooMany(req, 10)) return res.status(429).json({ message: 'Too many tries. Please wait a while.' });
  const cur = String(req.body.current || ''), next = String(req.body.next || '');
  if (next.length < 8) return res.status(400).json({ message: 'The new password needs at least 8 characters.' });
  const u = (await q('SELECT id, password FROM users WHERE id = ?', [req.user?.id]))[0];
  if (!u) return res.status(401).json({ message: 'Please sign in again.' });
  if (u.password && !(await bcrypt.compare(cur, u.password))) return res.status(400).json({ message: 'Your current password is not right.' });
  await q('UPDATE users SET password = ? WHERE id = ?', [await bcrypt.hash(next, 10), u.id]);
  res.json({ ok: true });
}));

router.get('/me/giving', wrap(async (req, res) => {
  const m = await myMember(req);
  if (!m) return res.json({ items: [], total: 0 });
  const year = int(req.query.year) || new Date().getFullYear();
  const items = await q('SELECT id, date, type, amount, method, reference FROM cms_giving WHERE member_id = ? AND YEAR(date) = ? ORDER BY date DESC', [m.id, year]);
  const pledges = await q(`SELECT p.id, p.purpose, p.amount, p.due_date, (SELECT COALESCE(SUM(amount),0) FROM cms_giving g WHERE g.pledge_id = p.id) paid FROM cms_pledges p WHERE p.member_id = ?`, [m.id]);
  res.json({ year, items, total: items.reduce((a: number, x: any) => a + Number(x.amount), 0), pledges, name: fullName(m) });
}));

router.get('/me/attendance', wrap(async (req, res) => {
  const m = await myMember(req);
  if (!m) return res.json({ items: [] });
  const items = await q(`SELECT s.date, s.title, s.type, a.method FROM cms_attendance a JOIN cms_services s ON s.id = a.service_id WHERE a.member_id = ? ORDER BY s.date DESC LIMIT 60`, [m.id]);
  res.json({ items });
}));

router.post('/me/checkin', wrap(async (req, res) => {
  const m = await myMember(req);
  if (!m) return res.status(404).json({ message: 'Your account isn’t linked to the church register yet.' });
  const code = s(req.body.code, 12).toUpperCase();
  const svc = (await q('SELECT id, title, date, type FROM cms_services WHERE checkin_code = ? AND checkin_open = 1', [code]))[0];
  if (!svc) return res.status(404).json({ message: 'This check-in code isn’t open. Ask an usher.' });
  await q('INSERT IGNORE INTO cms_attendance (service_id, member_id, method) VALUES (?,?,"self")', [svc.id, m.id]);
  if (req.body.family && m.family_id) {
    await q(`INSERT IGNORE INTO cms_attendance (service_id, member_id, method) SELECT ?, id, 'family' FROM cms_members WHERE family_id = ? AND status <> 'inactive'`, [svc.id, m.family_id]);
  }
  res.json({ ok: true, service: svc });
}));

// ================================================================== STAFF
router.get('/dashboard', can('people'), wrap(async (req, res) => {
  const r = role(req);
  const counts = (await q(`SELECT
    SUM(status <> 'inactive') total, SUM(status = 'member') members, SUM(status = 'worker') workers, SUM(status = 'visitor') visitors,
    SUM(status <> 'inactive' AND gender = 'male') male, SUM(status <> 'inactive' AND gender = 'female') female,
    SUM(created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)) new30 FROM cms_members`))[0];
  const families = (await q('SELECT COUNT(*) n FROM cms_families'))[0].n;
  const groups = (await q('SELECT COUNT(*) n FROM cms_groups'))[0].n;
  const services = await q(`SELECT s.id, s.date, s.type, s.title, s.men, s.women, s.children, s.online,
      (SELECT COUNT(*) FROM cms_attendance a WHERE a.service_id = s.id) present,
      (SELECT COUNT(*) FROM cms_first_timers f WHERE f.service_id = s.id) first_timers
    FROM cms_services s ORDER BY s.date DESC, s.id DESC LIMIT 12`);
  const ft = (await q(`SELECT SUM(visit_date >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)) month, SUM(status = 'new') waiting FROM cms_first_timers`))[0];
  let money: any = null;
  if (allowed(r, 'money')) {
    const m = (await q(`SELECT
      COALESCE(SUM(CASE WHEN date >= DATE_FORMAT(CURDATE(), '%Y-%m-01') THEN amount END), 0) this_month,
      COALESCE(SUM(CASE WHEN date >= DATE_FORMAT(DATE_SUB(CURDATE(), INTERVAL 1 MONTH), '%Y-%m-01') AND date < DATE_FORMAT(CURDATE(), '%Y-%m-01') THEN amount END), 0) last_month
      FROM cms_giving`))[0];
    const e = (await q(`SELECT COALESCE(SUM(amount),0) n FROM cms_expenses WHERE date >= DATE_FORMAT(CURDATE(), '%Y-%m-01')`))[0].n;
    money = { thisMonth: Number(m.this_month), lastMonth: Number(m.last_month), expensesThisMonth: Number(e) };
  }
  res.json({ counts: Object.fromEntries(Object.entries(counts).map(([k, v]) => [k, Number(v) || 0])), families, groups, services, firstTimers: { month: Number(ft.month) || 0, waiting: Number(ft.waiting) || 0 }, money });
}));

router.get('/celebrations', can('people'), wrap(async (req, res) => {
  const days = Math.min(60, Math.max(1, int(req.query.days) || 7));
  const back = Math.min(14, Math.max(0, int(req.query.back) ?? 0));
  const rows = await q(`SELECT ${MEMBER_FIELDS} FROM cms_members m WHERE m.status <> 'inactive' AND (m.birth_month IS NOT NULL OR m.ann_month IS NOT NULL)`);
  const now = new Date(Date.now() + 3600e3); now.setUTCHours(0, 0, 0, 0);
  const out: any[] = [];
  const near = (d: number, mo: number) => {
    for (let k = -back; k <= days; k++) {
      const t = new Date(now.getTime() + k * 864e5);
      if (t.getUTCDate() === d && t.getUTCMonth() + 1 === mo) return k;
    }
    return null;
  };
  rows.forEach((m: any) => {
    if (m.birth_month && m.birth_day) { const k = near(m.birth_day, m.birth_month); if (k !== null) out.push({ kind: 'birthday', inDays: k, member: m, age: m.birth_year ? now.getUTCFullYear() - m.birth_year : null }); }
    if (m.ann_month && m.ann_day) { const k = near(m.ann_day, m.ann_month); if (k !== null) out.push({ kind: 'anniversary', inDays: k, member: m }); }
  });
  out.sort((a, b) => a.inDays - b.inDays);
  res.json({ items: out });
}));

// ------------------------------------------------------------------ members
router.get('/members', can('people'), wrap(async (_req, res) => {
  const rows = await q(`SELECT ${MEMBER_FIELDS}, f.name family_name,
      (SELECT GROUP_CONCAT(g.name ORDER BY g.name SEPARATOR ', ') FROM cms_group_members gm JOIN cms_groups g ON g.id = gm.group_id WHERE gm.member_id = m.id) groups_text,
      (SELECT MAX(s.date) FROM cms_attendance a JOIN cms_services s ON s.id = a.service_id WHERE a.member_id = m.id) last_seen
    FROM cms_members m LEFT JOIN cms_families f ON f.id = m.family_id ORDER BY m.first_name, m.last_name`);
  res.json({ items: rows });
}));

router.get('/members/export.csv', can('people'), wrap(async (_req, res) => {
  const rows = await q(`SELECT ${MEMBER_FIELDS}, f.name family_name,
      (SELECT GROUP_CONCAT(g.name SEPARATOR '; ') FROM cms_group_members gm JOIN cms_groups g ON g.id = gm.group_id WHERE gm.member_id = m.id) groups_text
    FROM cms_members m LEFT JOIN cms_families f ON f.id = m.family_id ORDER BY m.first_name, m.last_name`);
  const MON = ['', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const head = ['Title', 'First name', 'Last name', 'Gender', 'Phone', 'Email', 'Address', 'Birthday', 'Birth year', 'Wedding anniversary', 'Marital status', 'Spouse', 'Family', 'Family role', 'Status', 'Groups', 'Occupation', 'Joined', 'Baptised', 'Notes'];
  const cell = (v: any) => '"' + String(v == null ? '' : v).replace(/"/g, '""') + '"';
  const lines = [head.map(cell).join(',')].concat(rows.map((m: any) => [m.title, m.first_name, m.last_name, m.gender, m.phone, m.email, m.address,
    m.birth_day ? `${m.birth_day} ${MON[m.birth_month]}` : '', m.birth_year || '', m.ann_day ? `${m.ann_day} ${MON[m.ann_month]}` : '', m.marital_status, m.spouse_name,
    m.family_name || '', m.family_role, m.status, m.groups_text || '', m.occupation, m.join_date || '', m.baptism_date || '', m.notes || ''].map(cell).join(',')));
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="Church members ${today()}.csv"`);
  res.send('﻿' + lines.join('\r\n'));
}));

router.get('/members/:id', can('people'), wrap(async (req, res) => {
  const m = (await q(`SELECT ${MEMBER_FIELDS} FROM cms_members m WHERE m.id = ?`, [req.params.id]))[0];
  if (!m) return res.status(404).json({ message: 'Not found' });
  const family = m.family_id ? await q('SELECT id, title, first_name, last_name, family_role, photo_url, status FROM cms_members WHERE family_id = ? AND id <> ? ORDER BY FIELD(family_role, "head", "spouse", "child", "relative", "")', [m.family_id, m.id]) : [];
  const fam = m.family_id ? (await q('SELECT id, name, address FROM cms_families WHERE id = ?', [m.family_id]))[0] : null;
  const groups = await q('SELECT g.id, g.name, g.type, gm.role FROM cms_group_members gm JOIN cms_groups g ON g.id = gm.group_id WHERE gm.member_id = ?', [m.id]);
  const attendance = await q(`SELECT s.id, s.date, s.title, s.type, a.method FROM cms_attendance a JOIN cms_services s ON s.id = a.service_id WHERE a.member_id = ? ORDER BY s.date DESC LIMIT 20`, [m.id]);
  const recent = (await q(`SELECT COUNT(*) n FROM cms_services WHERE date >= DATE_SUB(CURDATE(), INTERVAL 90 DAY)`))[0].n;
  const came = (await q(`SELECT COUNT(*) n FROM cms_attendance a JOIN cms_services s ON s.id = a.service_id WHERE a.member_id = ? AND s.date >= DATE_SUB(CURDATE(), INTERVAL 90 DAY)`, [m.id]))[0].n;
  let giving = null;
  if (allowed(role(req), 'money')) {
    giving = {
      year: new Date().getFullYear(),
      total: Number((await q('SELECT COALESCE(SUM(amount),0) n FROM cms_giving WHERE member_id = ? AND YEAR(date) = YEAR(CURDATE())', [m.id]))[0].n),
      items: await q('SELECT id, date, type, amount, method FROM cms_giving WHERE member_id = ? ORDER BY date DESC LIMIT 10', [m.id]),
    };
  }
  const account = m.user_id ? (await q('SELECT id, email FROM users WHERE id = ?', [m.user_id]))[0] || null : null;
  res.json({ member: m, family: fam ? { ...fam, members: family } : null, groups, attendance, attendance90: { services: recent, came }, giving, account });
}));

router.post('/members', can('people'), upload.any(), wrap(async (req: any, res) => {
  const o = memberInput(req.body);
  if (!o.first_name) return res.status(400).json({ message: 'Type the first name.' });
  if (o.phone_key.length === 10) {
    const dup = await q('SELECT id, first_name, last_name FROM cms_members WHERE phone_key = ? AND first_name = ?', [o.phone_key, o.first_name]);
    if (dup.length && req.body.force !== '1') return res.status(409).json({ message: `${dup[0].first_name} ${dup[0].last_name} already has this phone number.`, duplicateId: dup[0].id });
  }
  o.photo_url = photoOf(req);
  o.source = 'manual';
  const cols = Object.keys(o);
  const r: any = await q(`INSERT INTO cms_members (${cols.join(',')}) VALUES (${cols.map(() => '?').join(',')})`, cols.map((k) => o[k]));
  await audit(req, 'member.add', `${o.first_name} ${o.last_name}`);
  res.json({ ok: true, id: r.insertId });
}));

router.put('/members/:id', can('people'), upload.any(), wrap(async (req: any, res) => {
  const cur = (await q('SELECT id, photo_url FROM cms_members WHERE id = ?', [req.params.id]))[0];
  if (!cur) return res.status(404).json({ message: 'Not found' });
  const o = memberInput(req.body);
  if (!o.first_name) return res.status(400).json({ message: 'Type the first name.' });
  const photo = photoOf(req);
  o.photo_url = photo || (req.body.remove_photo === '1' ? '' : cur.photo_url);
  const cols = Object.keys(o);
  await q(`UPDATE cms_members SET ${cols.map((c) => `${c} = ?`).join(', ')} WHERE id = ?`, [...cols.map((k) => o[k]), cur.id]);
  await audit(req, 'member.edit', `#${cur.id} ${o.first_name} ${o.last_name}`);
  res.json({ ok: true });
}));

router.delete('/members/:id', can('admin'), wrap(async (req, res) => {
  const m = (await q('SELECT id, first_name, last_name FROM cms_members WHERE id = ?', [req.params.id]))[0];
  if (!m) return res.json({ ok: true });
  await q('DELETE FROM cms_group_members WHERE member_id = ?', [m.id]);
  await q('DELETE FROM cms_attendance WHERE member_id = ?', [m.id]);
  await q('UPDATE cms_giving SET name = ?, member_id = NULL WHERE member_id = ?', [`${m.first_name} ${m.last_name}`, m.id]);
  await q('UPDATE cms_pledges SET name = ?, member_id = NULL WHERE member_id = ?', [`${m.first_name} ${m.last_name}`, m.id]);
  await q('DELETE FROM cms_members WHERE id = ?', [m.id]);
  await audit(req, 'member.delete', `${m.first_name} ${m.last_name}`);
  res.json({ ok: true });
}));

// link / unlink a member's website account (staff)
router.post('/members/:id/account', can('admin'), wrap(async (req, res) => {
  const email = s(req.body.email, 160).toLowerCase();
  if (!email) { await q('UPDATE cms_members SET user_id = NULL WHERE id = ?', [req.params.id]); return res.json({ ok: true }); }
  const u = (await q('SELECT id FROM users WHERE email = ?', [email]))[0];
  if (!u) return res.status(404).json({ message: 'No website account has that email. The member can create one on the sign-in page.' });
  await q('UPDATE cms_members SET user_id = NULL WHERE user_id = ?', [u.id]);
  await q('UPDATE cms_members SET user_id = ? WHERE id = ?', [u.id, req.params.id]);
  res.json({ ok: true });
}));

// accounts that signed up but aren't linked to anyone in the register
router.get('/accounts/unlinked', can('people'), wrap(async (_req, res) => {
  res.json({ items: await q(`SELECT u.id, u.email, u.first_name, u.last_name, u.phone, u.role, u.created_at FROM users u
    LEFT JOIN cms_members m ON m.user_id = u.id WHERE m.id IS NULL ORDER BY u.created_at DESC LIMIT 300`) });
}));

// ------------------------------------------------------------------ families
router.get('/families', can('people'), wrap(async (_req, res) => {
  const fams = await q('SELECT f.id, f.name, f.address, f.notes, COUNT(m.id) size FROM cms_families f LEFT JOIN cms_members m ON m.family_id = f.id GROUP BY f.id ORDER BY f.name');
  const members = await q(`SELECT id, title, first_name, last_name, family_id, family_role, photo_url, status FROM cms_members WHERE family_id IS NOT NULL ORDER BY FIELD(family_role, 'head', 'spouse', 'child', 'relative', ''), first_name`);
  res.json({ items: fams.map((f: any) => ({ ...f, members: members.filter((m: any) => m.family_id === f.id) })) });
}));
router.post('/families', can('people'), wrap(async (req, res) => {
  const name = s(req.body.name, 120); if (!name) return res.status(400).json({ message: 'Type the family name, e.g. The Adebayo Family.' });
  const r: any = await q('INSERT INTO cms_families (name, address, notes) VALUES (?,?,?)', [name, s(req.body.address, 500), s(req.body.notes, 2000)]);
  const ids: number[] = (Array.isArray(req.body.members) ? req.body.members : []).slice(0, 30);
  for (const x of ids as any[]) await q('UPDATE cms_members SET family_id = ?, family_role = ? WHERE id = ?', [r.insertId, pick(x.role, ['head', 'spouse', 'child', 'relative', ''] as const, ''), int(x.id)]);
  res.json({ ok: true, id: r.insertId });
}));
router.put('/families/:id', can('people'), wrap(async (req, res) => {
  await q('UPDATE cms_families SET name = ?, address = ?, notes = ? WHERE id = ?', [s(req.body.name, 120), s(req.body.address, 500), s(req.body.notes, 2000), req.params.id]);
  if (Array.isArray(req.body.members)) {
    await q('UPDATE cms_members SET family_id = NULL, family_role = "" WHERE family_id = ?', [req.params.id]);
    for (const x of req.body.members.slice(0, 30)) await q('UPDATE cms_members SET family_id = ?, family_role = ? WHERE id = ?', [req.params.id, pick(x.role, ['head', 'spouse', 'child', 'relative', ''] as const, ''), int(x.id)]);
  }
  res.json({ ok: true });
}));
router.delete('/families/:id', can('people'), wrap(async (req, res) => {
  await q('UPDATE cms_members SET family_id = NULL, family_role = "" WHERE family_id = ?', [req.params.id]);
  await q('DELETE FROM cms_families WHERE id = ?', [req.params.id]);
  res.json({ ok: true });
}));

// ------------------------------------------------------------------ groups (departments, cells, ministries)
router.get('/groups', can('people'), wrap(async (_req, res) => {
  res.json({ items: await q(`SELECT g.*, COUNT(gm.member_id) size, CONCAT_WS(' ', l.title, l.first_name, l.last_name) leader_name
    FROM cms_groups g LEFT JOIN cms_group_members gm ON gm.group_id = g.id LEFT JOIN cms_members l ON l.id = g.leader_id GROUP BY g.id ORDER BY g.type, g.name`) });
}));
router.get('/groups/:id', can('people'), wrap(async (req, res) => {
  const g = (await q('SELECT * FROM cms_groups WHERE id = ?', [req.params.id]))[0];
  if (!g) return res.status(404).json({ message: 'Not found' });
  const members = await q(`SELECT m.id, m.title, m.first_name, m.last_name, m.phone, m.email, m.photo_url, m.status, gm.role
    FROM cms_group_members gm JOIN cms_members m ON m.id = gm.member_id WHERE gm.group_id = ? ORDER BY m.first_name`, [g.id]);
  res.json({ group: g, members });
}));
router.post('/groups', can('people'), wrap(async (req, res) => {
  const name = s(req.body.name, 120); if (!name) return res.status(400).json({ message: 'Type the name.' });
  if ((await q('SELECT id FROM cms_groups WHERE LOWER(name) = LOWER(?)', [name])).length) return res.status(409).json({ message: 'There is already a group with this name.' });
  const r: any = await q('INSERT INTO cms_groups (name, type, leader_id, meets, description) VALUES (?,?,?,?,?)',
    [name, pick(req.body.type, ['department', 'cell', 'ministry', 'other'] as const, 'department'), int(req.body.leader_id), s(req.body.meets, 120), s(req.body.description, 2000)]);
  res.json({ ok: true, id: r.insertId });
}));
router.put('/groups/:id', can('people'), wrap(async (req, res) => {
  await q('UPDATE cms_groups SET name = ?, type = ?, leader_id = ?, meets = ?, description = ? WHERE id = ?',
    [s(req.body.name, 120), pick(req.body.type, ['department', 'cell', 'ministry', 'other'] as const, 'department'), int(req.body.leader_id), s(req.body.meets, 120), s(req.body.description, 2000), req.params.id]);
  res.json({ ok: true });
}));
router.delete('/groups/:id', can('people'), wrap(async (req, res) => {
  await q('DELETE FROM cms_group_members WHERE group_id = ?', [req.params.id]);
  await q('DELETE FROM cms_groups WHERE id = ?', [req.params.id]);
  res.json({ ok: true });
}));
router.post('/groups/:id/members', can('people'), wrap(async (req, res) => {
  const ids: any[] = Array.isArray(req.body.member_ids) ? req.body.member_ids : [];
  for (const id of ids.slice(0, 500)) await q('INSERT IGNORE INTO cms_group_members (group_id, member_id, role) VALUES (?,?,?)', [req.params.id, int(id), s(req.body.role, 60)]);
  res.json({ ok: true });
}));
router.put('/groups/:id/members/:mid', can('people'), wrap(async (req, res) => {
  await q('UPDATE cms_group_members SET role = ? WHERE group_id = ? AND member_id = ?', [s(req.body.role, 60), req.params.id, req.params.mid]);
  res.json({ ok: true });
}));
router.delete('/groups/:id/members/:mid', can('people'), wrap(async (req, res) => {
  await q('DELETE FROM cms_group_members WHERE group_id = ? AND member_id = ?', [req.params.id, req.params.mid]);
  res.json({ ok: true });
}));

// ------------------------------------------------------------------ services and attendance
const SERVICE_TYPES = ['sunday_service', 'sunday_school', 'prayer', 'bible_study', 'vigil', 'special', 'youth', 'other'] as const;
const newCode = () => Array.from(crypto.randomBytes(6)).map((b) => 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'[b % 31]).join('');
router.get('/services', can('people'), wrap(async (req, res) => {
  const from = day(req.query.from) || '2000-01-01', to = day(req.query.to) || '2100-01-01';
  res.json({ items: await q(`SELECT s.*, (SELECT COUNT(*) FROM cms_attendance a WHERE a.service_id = s.id) present,
      (SELECT COUNT(*) FROM cms_first_timers f WHERE f.service_id = s.id) first_timers
    FROM cms_services s WHERE s.date BETWEEN ? AND ? ORDER BY s.date DESC, s.id DESC LIMIT 400`, [from, to]) });
}));
router.post('/services', can('people'), wrap(async (req, res) => {
  const date = day(req.body.date) || today();
  const r: any = await q('INSERT INTO cms_services (date, type, title, checkin_code, checkin_open, notes) VALUES (?,?,?,?,?,?)',
    [date, pick(req.body.type, SERVICE_TYPES, 'sunday_service'), s(req.body.title, 160), newCode(), req.body.checkin_open ? 1 : 0, s(req.body.notes, 2000)]);
  res.json({ ok: true, id: r.insertId });
}));
router.put('/services/:id', can('people'), wrap(async (req, res) => {
  const b = req.body || {};
  const cur = (await q('SELECT * FROM cms_services WHERE id = ?', [req.params.id]))[0];
  if (!cur) return res.status(404).json({ message: 'Not found' });
  const n = (v: any, d: number) => { const x = int(v); return x !== null && x >= 0 ? Math.min(x, 100000) : d; };
  await q('UPDATE cms_services SET date = ?, type = ?, title = ?, men = ?, women = ?, children = ?, online = ?, checkin_open = ?, checkin_code = ?, notes = ? WHERE id = ?',
    [day(b.date) || cur.date, pick(b.type, SERVICE_TYPES, cur.type), b.title !== undefined ? s(b.title, 160) : cur.title,
      n(b.men, cur.men), n(b.women, cur.women), n(b.children, cur.children), n(b.online, cur.online),
      b.checkin_open !== undefined ? (b.checkin_open ? 1 : 0) : cur.checkin_open, b.new_code ? newCode() : cur.checkin_code,
      b.notes !== undefined ? s(b.notes, 2000) : cur.notes, cur.id]);
  res.json({ ok: true });
}));
router.delete('/services/:id', can('people'), wrap(async (req, res) => {
  await q('DELETE FROM cms_attendance WHERE service_id = ?', [req.params.id]);
  await q('UPDATE cms_first_timers SET service_id = NULL WHERE service_id = ?', [req.params.id]);
  await q('DELETE FROM cms_services WHERE id = ?', [req.params.id]);
  res.json({ ok: true });
}));
router.get('/services/:id/attendance', can('people'), wrap(async (req, res) => {
  res.json({ items: await q('SELECT member_id, method, at FROM cms_attendance WHERE service_id = ?', [req.params.id]) });
}));
router.post('/services/:id/attendance', can('people'), wrap(async (req, res) => {
  const mid = int(req.body.member_id); if (!mid) return res.status(400).json({ message: 'Choose a member.' });
  const ids = [mid];
  if (req.body.family) {
    const m = (await q('SELECT family_id FROM cms_members WHERE id = ?', [mid]))[0];
    if (m && m.family_id) (await q(`SELECT id FROM cms_members WHERE family_id = ? AND status <> 'inactive'`, [m.family_id])).forEach((x: any) => ids.includes(x.id) || ids.push(x.id));
  }
  for (const id of ids) {
    if (req.body.present === false) await q('DELETE FROM cms_attendance WHERE service_id = ? AND member_id = ?', [req.params.id, id]);
    else await q('INSERT IGNORE INTO cms_attendance (service_id, member_id, method) VALUES (?,?,?)', [req.params.id, id, id === mid ? 'staff' : 'family']);
  }
  res.json({ ok: true, ids });
}));
/** People who haven't been in church for a while (for follow-up calls) */
router.get('/attendance/absent', can('people'), wrap(async (req, res) => {
  const weeks = Math.min(26, Math.max(2, int(req.query.weeks) || 4));
  const since = new Date(Date.now() - weeks * 7 * 864e5).toISOString().slice(0, 10);
  const nServices = (await q('SELECT COUNT(*) n FROM cms_services WHERE date >= ? AND (SELECT COUNT(*) FROM cms_attendance a WHERE a.service_id = cms_services.id) > 0', [since]))[0].n;
  if (!nServices) return res.json({ items: [], services: 0 });
  res.json({ services: nServices, items: await q(`SELECT m.id, m.title, m.first_name, m.last_name, m.phone, m.photo_url, m.status,
      (SELECT MAX(s.date) FROM cms_attendance a JOIN cms_services s ON s.id = a.service_id WHERE a.member_id = m.id) last_seen
    FROM cms_members m WHERE m.status IN ('member', 'worker') AND NOT EXISTS (
      SELECT 1 FROM cms_attendance a JOIN cms_services s ON s.id = a.service_id WHERE a.member_id = m.id AND s.date >= ?)
    ORDER BY last_seen IS NULL, last_seen DESC, m.first_name`, [since]) });
}));

// ------------------------------------------------------------------ first timers
router.get('/first-timers', can('people'), wrap(async (_req, res) => {
  res.json({ items: await q(`SELECT f.*, CONCAT_WS(' ', a.title, a.first_name, a.last_name) assigned_name,
      (SELECT COUNT(*) FROM cms_followups x WHERE x.first_timer_id = f.id) followups,
      (SELECT MAX(x.at) FROM cms_followups x WHERE x.first_timer_id = f.id) last_followup
    FROM cms_first_timers f LEFT JOIN cms_members a ON a.id = f.assigned_to ORDER BY f.visit_date DESC, f.id DESC LIMIT 1000`) });
}));
router.get('/first-timers/:id', can('people'), wrap(async (req, res) => {
  const f = (await q('SELECT * FROM cms_first_timers WHERE id = ?', [req.params.id]))[0];
  if (!f) return res.status(404).json({ message: 'Not found' });
  res.json({ item: f, followups: await q('SELECT * FROM cms_followups WHERE first_timer_id = ? ORDER BY at DESC', [f.id]) });
}));
function ftInput(b: any) {
  return { name: s(b.name, 120), phone: s(b.phone, 30), email: s(b.email, 160), address: s(b.address, 500), gender: pick(b.gender, ['male', 'female', ''] as const, ''),
    visit_date: day(b.visit_date) || today(), service_id: int(b.service_id), invited_by: s(b.invited_by, 120), how_heard: s(b.how_heard, 120), wants: s(b.wants, 200),
    prayer: s(b.prayer, 2000), status: pick(b.status, ['new', 'contacted', 'returned', 'member', 'not_interested'] as const, 'new'), assigned_to: int(b.assigned_to) };
}
router.post('/first-timers', can('people'), wrap(async (req, res) => {
  const o: any = ftInput(req.body); if (!o.name) return res.status(400).json({ message: 'Type the name.' });
  const cols = Object.keys(o);
  const r: any = await q(`INSERT INTO cms_first_timers (${cols.join(',')}) VALUES (${cols.map(() => '?').join(',')})`, cols.map((k) => o[k]));
  res.json({ ok: true, id: r.insertId });
}));
router.put('/first-timers/:id', can('people'), wrap(async (req, res) => {
  const o: any = ftInput(req.body); if (!o.name) return res.status(400).json({ message: 'Type the name.' });
  const cols = Object.keys(o);
  await q(`UPDATE cms_first_timers SET ${cols.map((c) => `${c} = ?`).join(', ')} WHERE id = ?`, [...cols.map((k) => o[k]), req.params.id]);
  res.json({ ok: true });
}));
router.delete('/first-timers/:id', can('people'), wrap(async (req, res) => {
  await q('DELETE FROM cms_followups WHERE first_timer_id = ?', [req.params.id]);
  await q('DELETE FROM cms_first_timers WHERE id = ?', [req.params.id]);
  res.json({ ok: true });
}));
router.post('/first-timers/:id/followups', can('people'), wrap(async (req, res) => {
  const note = s(req.body.note, 2000); if (!note) return res.status(400).json({ message: 'Type what happened.' });
  const u = (await q('SELECT first_name, last_name FROM users WHERE id = ?', [req.user?.id]))[0] || {};
  await q('INSERT INTO cms_followups (first_timer_id, note, by_user, by_name) VALUES (?,?,?,?)', [req.params.id, note, req.user?.id || null, `${u.first_name || ''} ${u.last_name || ''}`.trim()]);
  if (req.body.status) await q('UPDATE cms_first_timers SET status = ? WHERE id = ?', [pick(req.body.status, ['new', 'contacted', 'returned', 'member', 'not_interested'] as const, 'contacted'), req.params.id]);
  else await q(`UPDATE cms_first_timers SET status = 'contacted' WHERE id = ? AND status = 'new'`, [req.params.id]);
  res.json({ ok: true });
}));
router.post('/first-timers/:id/convert', can('people'), wrap(async (req, res) => {
  const f = (await q('SELECT * FROM cms_first_timers WHERE id = ?', [req.params.id]))[0];
  if (!f) return res.status(404).json({ message: 'Not found' });
  if (f.member_id) return res.json({ ok: true, id: f.member_id });
  const n = splitName(f.name);
  const r: any = await q(`INSERT INTO cms_members (title, first_name, last_name, gender, phone, phone_key, email, address, status, join_date, source)
    VALUES (?,?,?,?,?,?,?,?,'member',?, 'first_timer')`, [n.title, n.first, n.last, f.gender || n.gender, f.phone, phoneKey(f.phone), f.email, f.address, today()]);
  await q(`UPDATE cms_first_timers SET status = 'member', member_id = ? WHERE id = ?`, [r.insertId, f.id]);
  await audit(req, 'first_timer.convert', f.name);
  res.json({ ok: true, id: r.insertId });
}));

// ------------------------------------------------------------------ giving, pledges, expenses (finance roles)
const GIVING_TYPES = ['tithe', 'offering', 'thanksgiving', 'seed', 'building', 'missions', 'welfare', 'pledge', 'first_fruit', 'special', 'other'];
function givingInput(b: any) {
  return { date: day(b.date) || today(), member_id: int(b.member_id), name: s(b.name, 120), type: GIVING_TYPES.includes(b.type) ? b.type : 'offering', amount: money(b.amount),
    method: pick(b.method, ['cash', 'transfer', 'pos', 'online', 'cheque', 'other'] as const, 'cash'), reference: s(b.reference, 120), service_id: int(b.service_id),
    pledge_id: int(b.pledge_id), notes: s(b.notes, 1000) };
}
router.get('/giving', can('money'), wrap(async (req, res) => {
  const from = day(req.query.from) || '2000-01-01', to = day(req.query.to) || '2100-01-01';
  res.json({ items: await q(`SELECT g.*, CONCAT_WS(' ', m.title, m.first_name, m.last_name) member_name, p.purpose pledge_purpose
    FROM cms_giving g LEFT JOIN cms_members m ON m.id = g.member_id LEFT JOIN cms_pledges p ON p.id = g.pledge_id
    WHERE g.date BETWEEN ? AND ? ORDER BY g.date DESC, g.id DESC LIMIT 3000`, [from, to]) });
}));
router.post('/giving', can('money'), wrap(async (req, res) => {
  const list = Array.isArray(req.body.items) ? req.body.items : [req.body];
  const rows = list.slice(0, 300).map(givingInput).filter((o: any) => o.amount > 0);
  if (!rows.length) return res.status(400).json({ message: 'Type an amount.' });
  for (const o of rows as any[]) {
    const cols = Object.keys(o);
    await q(`INSERT INTO cms_giving (${cols.join(',')}, recorded_by) VALUES (${cols.map(() => '?').join(',')}, ?)`, [...cols.map((k) => o[k]), req.user?.id || null]);
  }
  await audit(req, 'giving.add', `${rows.length} record(s), ₦${rows.reduce((a: number, o: any) => a + o.amount, 0).toLocaleString()}`);
  res.json({ ok: true, saved: rows.length });
}));
router.put('/giving/:id', can('money'), wrap(async (req, res) => {
  const o: any = givingInput(req.body); if (!(o.amount > 0)) return res.status(400).json({ message: 'Type an amount.' });
  const cols = Object.keys(o);
  await q(`UPDATE cms_giving SET ${cols.map((c) => `${c} = ?`).join(', ')} WHERE id = ?`, [...cols.map((k) => o[k]), req.params.id]);
  await audit(req, 'giving.edit', `#${req.params.id} ₦${o.amount}`);
  res.json({ ok: true });
}));
router.delete('/giving/:id', can('money'), wrap(async (req, res) => {
  const g = (await q('SELECT amount, type, date FROM cms_giving WHERE id = ?', [req.params.id]))[0];
  await q('DELETE FROM cms_giving WHERE id = ?', [req.params.id]);
  if (g) await audit(req, 'giving.delete', `#${req.params.id} ${g.type} ₦${g.amount} on ${g.date}`);
  res.json({ ok: true });
}));

router.get('/pledges', can('money'), wrap(async (_req, res) => {
  res.json({ items: await q(`SELECT p.*, CONCAT_WS(' ', m.title, m.first_name, m.last_name) member_name, m.phone,
      (SELECT COALESCE(SUM(amount),0) FROM cms_giving g WHERE g.pledge_id = p.id) paid
    FROM cms_pledges p LEFT JOIN cms_members m ON m.id = p.member_id ORDER BY p.created_at DESC`) });
}));
router.post('/pledges', can('money'), wrap(async (req, res) => {
  const amount = money(req.body.amount), purpose = s(req.body.purpose, 160);
  if (!(amount > 0) || !purpose) return res.status(400).json({ message: 'Type what the pledge is for and the amount.' });
  const r: any = await q('INSERT INTO cms_pledges (member_id, name, purpose, amount, due_date, notes) VALUES (?,?,?,?,?,?)',
    [int(req.body.member_id), s(req.body.name, 120), purpose, amount, day(req.body.due_date), s(req.body.notes, 1000)]);
  res.json({ ok: true, id: r.insertId });
}));
router.put('/pledges/:id', can('money'), wrap(async (req, res) => {
  await q('UPDATE cms_pledges SET member_id = ?, name = ?, purpose = ?, amount = ?, due_date = ?, notes = ? WHERE id = ?',
    [int(req.body.member_id), s(req.body.name, 120), s(req.body.purpose, 160), money(req.body.amount), day(req.body.due_date), s(req.body.notes, 1000), req.params.id]);
  res.json({ ok: true });
}));
router.delete('/pledges/:id', can('money'), wrap(async (req, res) => {
  await q('UPDATE cms_giving SET pledge_id = NULL WHERE pledge_id = ?', [req.params.id]);
  await q('DELETE FROM cms_pledges WHERE id = ?', [req.params.id]);
  res.json({ ok: true });
}));

function expenseInput(b: any) {
  return { date: day(b.date) || today(), category: s(b.category, 60) || 'Other', description: s(b.description, 255), amount: money(b.amount), paid_to: s(b.paid_to, 120),
    method: pick(b.method, ['cash', 'transfer', 'pos', 'cheque', 'other'] as const, 'cash'), approved_by: s(b.approved_by, 120) };
}
router.get('/expenses', can('money'), wrap(async (req, res) => {
  const from = day(req.query.from) || '2000-01-01', to = day(req.query.to) || '2100-01-01';
  res.json({ items: await q('SELECT * FROM cms_expenses WHERE date BETWEEN ? AND ? ORDER BY date DESC, id DESC LIMIT 3000', [from, to]) });
}));
router.post('/expenses', can('money'), wrap(async (req, res) => {
  const o: any = expenseInput(req.body); if (!(o.amount > 0)) return res.status(400).json({ message: 'Type the amount.' });
  const cols = Object.keys(o);
  const r: any = await q(`INSERT INTO cms_expenses (${cols.join(',')}, recorded_by) VALUES (${cols.map(() => '?').join(',')}, ?)`, [...cols.map((k) => o[k]), req.user?.id || null]);
  await audit(req, 'expense.add', `${o.category} ₦${o.amount}`);
  res.json({ ok: true, id: r.insertId });
}));
router.put('/expenses/:id', can('money'), wrap(async (req, res) => {
  const o: any = expenseInput(req.body); if (!(o.amount > 0)) return res.status(400).json({ message: 'Type the amount.' });
  const cols = Object.keys(o);
  await q(`UPDATE cms_expenses SET ${cols.map((c) => `${c} = ?`).join(', ')} WHERE id = ?`, [...cols.map((k) => o[k]), req.params.id]);
  await audit(req, 'expense.edit', `#${req.params.id} ₦${o.amount}`);
  res.json({ ok: true });
}));
router.delete('/expenses/:id', can('money'), wrap(async (req, res) => {
  const e = (await q('SELECT amount, category, date FROM cms_expenses WHERE id = ?', [req.params.id]))[0];
  await q('DELETE FROM cms_expenses WHERE id = ?', [req.params.id]);
  if (e) await audit(req, 'expense.delete', `${e.category} ₦${e.amount} on ${e.date}`);
  res.json({ ok: true });
}));

router.get('/reports/finance', can('money'), wrap(async (req, res) => {
  const from = day(req.query.from) || `${new Date().getFullYear()}-01-01`, to = day(req.query.to) || today();
  const byType = await q('SELECT type, COALESCE(SUM(amount),0) total, COUNT(*) n FROM cms_giving WHERE date BETWEEN ? AND ? GROUP BY type ORDER BY total DESC', [from, to]);
  const byMethod = await q('SELECT method, COALESCE(SUM(amount),0) total FROM cms_giving WHERE date BETWEEN ? AND ? GROUP BY method ORDER BY total DESC', [from, to]);
  const byCategory = await q('SELECT category, COALESCE(SUM(amount),0) total, COUNT(*) n FROM cms_expenses WHERE date BETWEEN ? AND ? GROUP BY category ORDER BY total DESC', [from, to]);
  const months = await q(`SELECT ym, SUM(inc) income, SUM(exp) expenses FROM (
      SELECT DATE_FORMAT(date, '%Y-%m') ym, amount inc, 0 exp FROM cms_giving WHERE date BETWEEN ? AND ?
      UNION ALL SELECT DATE_FORMAT(date, '%Y-%m'), 0, amount FROM cms_expenses WHERE date BETWEEN ? AND ?) t GROUP BY ym ORDER BY ym`, [from, to, from, to]);
  const income = byType.reduce((a: number, x: any) => a + Number(x.total), 0), expenses = byCategory.reduce((a: number, x: any) => a + Number(x.total), 0);
  res.json({ from, to, income, expenses, balance: income - expenses, byType, byMethod, byCategory, months: months.map((m: any) => ({ ym: m.ym, income: Number(m.income), expenses: Number(m.expenses) })) });
}));

router.get('/members/:id/statement', can('money'), wrap(async (req, res) => {
  const year = int(req.query.year) || new Date().getFullYear();
  const m = (await q(`SELECT ${MEMBER_FIELDS} FROM cms_members m WHERE m.id = ?`, [req.params.id]))[0];
  if (!m) return res.status(404).json({ message: 'Not found' });
  const items = await q('SELECT id, date, type, amount, method, reference FROM cms_giving WHERE member_id = ? AND YEAR(date) = ? ORDER BY date', [m.id, year]);
  res.json({ year, member: m, name: fullName(m), items, total: items.reduce((a: number, x: any) => a + Number(x.amount), 0) });
}));

/** Online giving made on the website/app (Paystack etc.) brought into the giving records */
router.post('/import/online-giving', can('money'), wrap(async (req, res) => {
  const rows = await q(`SELECT d.* FROM donations d WHERE LOWER(COALESCE(d.status,'')) IN ('success','successful','completed','approved','paid')
    AND NOT EXISTS (SELECT 1 FROM cms_giving g WHERE g.reference = CONCAT('online#', d.id))`);
  let n = 0;
  for (const d of rows) {
    const m = d.user_id ? (await q('SELECT id FROM cms_members WHERE user_id = ?', [d.user_id]))[0] : null;
    const dt = (d.payment_date || d.created_at) ? new Date(d.payment_date || d.created_at).toISOString().slice(0, 10) : today();
    const t = String(d.purpose || d.donation_type || '').toLowerCase();
    const type = GIVING_TYPES.find((x) => t.includes(x)) || 'offering';
    await q(`INSERT INTO cms_giving (date, member_id, name, type, amount, method, reference, notes, recorded_by) VALUES (?,?,?,?,?,'online',?,?,?)`,
      [dt, m ? m.id : null, s(d.name, 120), type, Number(d.amount) || 0, `online#${d.id}`, s(d.reference ? `Ref ${d.reference}` : '', 1000), req.user?.id || null]);
    n++;
  }
  res.json({ ok: true, imported: n });
}));

/** People with website/app accounts added to the register (once) */
router.post('/import/accounts', can('people'), wrap(async (req, res) => {
  const users = await q(`SELECT u.* FROM users u LEFT JOIN cms_members m ON m.user_id = u.id WHERE m.id IS NULL AND u.is_approved = 1`);
  let added = 0, linked = 0;
  for (const u of users) {
    const pk = phoneKey(u.phone);
    const same = pk.length === 10 ? (await q('SELECT id FROM cms_members WHERE phone_key = ? AND user_id IS NULL', [pk])) : [];
    if (same.length === 1) { await q('UPDATE cms_members SET user_id = ? WHERE id = ?', [u.id, same[0].id]); linked++; continue; }
    const dob = u.date_of_birth || u.birthday ? new Date(u.date_of_birth || u.birthday) : null;
    await q(`INSERT INTO cms_members (user_id, first_name, last_name, gender, phone, phone_key, email, address, birth_day, birth_month, birth_year, photo_url, source)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?, 'account')`, [u.id, s(u.first_name, 80) || 'Member', s(u.last_name === '-' ? '' : u.last_name, 80), u.gender || '', s(u.phone, 30), pk, s(u.email, 160),
      s(u.address, 500), dob ? dob.getUTCDate() : null, dob ? dob.getUTCMonth() + 1 : null, dob && dob.getUTCFullYear() > 1900 && dob.getUTCFullYear() !== 2000 ? dob.getUTCFullYear() : null, s(u.photo || u.profile_image, 500)]);
    added++;
  }
  res.json({ ok: true, added, linked });
}));

// ------------------------------------------------------------------ messages (email through Brevo; WhatsApp is sent from the phone)
async function audience(a: any): Promise<any[]> {
  a = a || {};
  let where = `m.status <> 'inactive'`; const vals: any[] = [];
  if (Array.isArray(a.member_ids) && a.member_ids.length) { where += ` AND m.id IN (${a.member_ids.slice(0, 2000).map(() => '?').join(',')})`; vals.push(...a.member_ids.map(int)); }
  if (Array.isArray(a.status) && a.status.length) { where += ` AND m.status IN (${a.status.map(() => '?').join(',')})`; vals.push(...a.status.map((x: any) => s(x, 20))); }
  if (Array.isArray(a.group_ids) && a.group_ids.length) { where += ` AND EXISTS (SELECT 1 FROM cms_group_members gm WHERE gm.member_id = m.id AND gm.group_id IN (${a.group_ids.map(() => '?').join(',')}))`; vals.push(...a.group_ids.map(int)); }
  if (a.gender === 'male' || a.gender === 'female') { where += ' AND m.gender = ?'; vals.push(a.gender); }
  if (int(a.birth_month)) { where += ' AND m.birth_month = ?'; vals.push(int(a.birth_month)); }
  const people = await q(`SELECT m.id, m.title, m.first_name, m.last_name, m.phone, m.email FROM cms_members m WHERE ${where} ORDER BY m.first_name`, vals);
  if (a.first_timers) {
    const fts = await q(`SELECT id, name, phone, email FROM cms_first_timers WHERE status IN ('new','contacted','returned') AND visit_date >= DATE_SUB(CURDATE(), INTERVAL 90 DAY)`);
    fts.forEach((f: any) => { const n = splitName(f.name); people.push({ id: `ft${f.id}`, title: n.title, first_name: n.first, last_name: n.last, phone: f.phone, email: f.email }); });
  }
  return people;
}
router.post('/messages/audience', can('people'), wrap(async (req, res) => {
  const people = await audience(req.body.audience);
  res.json({ items: people, withEmail: people.filter((p) => /@/.test(p.email || '')).length, withPhone: people.filter((p) => phoneKey(p.phone).length === 10).length });
}));
router.get('/messages', can('people'), wrap(async (_req, res) => {
  const sentToday = (await q(`SELECT COALESCE(SUM(delivered),0) n FROM cms_messages WHERE channel = 'email' AND at >= CURDATE()`))[0].n;
  res.json({ items: await q('SELECT * FROM cms_messages ORDER BY at DESC LIMIT 100'), emailToday: Number(sentToday), emailLimit: 290, emailReady: !!process.env.BREVO_API_KEY });
}));
const fill = (t: string, p: any) => t.replace(/\{first\}/gi, p.first_name || '').replace(/\{name\}/gi, [p.title, p.first_name, p.last_name].filter(Boolean).join(' ')).replace(/\{title\}/gi, p.title || '');
const htmlOf = (t: string) => t.split(/\n\s*\n/).map((para) => `<p style="margin:0 0 14px;font:15px/1.6 Arial,sans-serif;color:#1f2937">${para.replace(/[<>&]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' }[c] as string)).replace(/\n/g, '<br>')}</p>`).join('');
router.post('/messages/email', can('people'), wrap(async (req, res) => {
  if (!process.env.BREVO_API_KEY) return res.status(400).json({ message: 'Email isn’t set up yet: the website server needs its Brevo key (BREVO_API_KEY).' });
  const subject = s(req.body.subject, 200), body = String(req.body.body || '').slice(0, 20000);
  if (!subject || !body.trim()) return res.status(400).json({ message: 'Type the subject and the message.' });
  const people = (await audience(req.body.audience)).filter((p) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(p.email || ''));
  if (!people.length) return res.status(400).json({ message: 'None of these people has an email address.' });
  const sentToday = Number((await q(`SELECT COALESCE(SUM(delivered),0) n FROM cms_messages WHERE channel = 'email' AND at >= CURDATE()`))[0].n);
  if (sentToday + people.length > 290) return res.status(400).json({ message: `The free email plan sends 300 emails a day. ${sentToday} have gone today, so this can reach ${Math.max(0, 290 - sentToday)} people now. Choose fewer people, or send the rest tomorrow.` });
  let ok = 0;
  for (let i = 0; i < people.length; i += 5) {
    const batch = people.slice(i, i + 5);
    const r = await Promise.all(batch.map((p) => sendBrevoTransactionalEmail({
      to: [{ email: p.email, name: [p.first_name, p.last_name].filter(Boolean).join(' ') }], subject: fill(subject, p),
      html: `<div style="max-width:560px;margin:auto;padding:20px">${htmlOf(fill(body, p))}<p style="margin-top:24px;font:12px Arial,sans-serif;color:#6b7280">Household Of Covenant And Faith Apostolic Ministry · 140 Obafemi Awolowo Way, Radio Bus Stop, Ikorodu, Lagos</p></div>`,
    }).catch(() => false)));
    ok += r.filter(Boolean).length;
  }
  await q('INSERT INTO cms_messages (channel, subject, body, audience, recipients, delivered, sent_by) VALUES ("email",?,?,?,?,?,?)', [subject, body, s(req.body.audienceLabel, 200), people.length, ok, req.user?.id || null]);
  res.json({ ok: true, recipients: people.length, delivered: ok });
}));
router.post('/messages/whatsapp-log', can('people'), wrap(async (req, res) => {
  await q('INSERT INTO cms_messages (channel, subject, body, audience, recipients, delivered, sent_by) VALUES ("whatsapp","",?,?,?,?,?)',
    [String(req.body.body || '').slice(0, 20000), s(req.body.audienceLabel, 200), int(req.body.recipients) || 0, int(req.body.sent) || 0, req.user?.id || null]);
  res.json({ ok: true });
}));

// ------------------------------------------------------------------ staff accounts and activity (admin)
const STAFF_ROLES = ['member', 'pastor', 'elder', 'deacon', 'secretary', 'finance', 'department_head', 'media', 'media_head', 'choir', 'super_admin'];
router.get('/staff', can('admin'), wrap(async (_req, res) => {
  res.json({ roles: STAFF_ROLES, items: await q(`SELECT id, email, first_name, last_name, role, is_approved, created_at FROM users WHERE role <> 'member' ORDER BY role, first_name`) });
}));
router.put('/staff/role', can('admin'), wrap(async (req, res) => {
  const email = s(req.body.email, 160).toLowerCase(), r = String(req.body.role || '');
  if (!STAFF_ROLES.includes(r)) return res.status(400).json({ message: 'Choose a role.' });
  const u = (await q('SELECT id, role FROM users WHERE email = ?', [email]))[0];
  if (!u) return res.status(404).json({ message: 'No account has that email. They should create one first on the sign-in page.' });
  if (u.id === req.user?.id && r !== u.role) return res.status(400).json({ message: 'You can’t change your own role.' });
  if ((r === 'super_admin' || String(u.role).toLowerCase() === 'super_admin') && role(req) !== 'super_admin') return res.status(403).json({ message: 'Only a super admin can change a super admin’s access.' });
  await q('UPDATE users SET role = ? WHERE id = ?', [r, u.id]);
  await audit(req, 'staff.role', `${email} → ${r}`);
  res.json({ ok: true });
}));
router.get('/audit', can('admin'), wrap(async (_req, res) => {
  res.json({ items: await q('SELECT * FROM cms_audit ORDER BY at DESC LIMIT 300') });
}));

export default router;
