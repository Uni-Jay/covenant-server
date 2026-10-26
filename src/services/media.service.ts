import { v2 as cloudinary } from 'cloudinary';
import path from 'path';
import { Request, Response, NextFunction } from 'express';

/**
 * Permanent storage for uploads.
 * Render's free plan wipes the server's disk whenever it sleeps or restarts, so every uploaded file is
 * also copied to Cloudinary (free plan). Database rows keep their usual "/uploads/…" paths; when the
 * local copy is gone, /uploads/… simply redirects to the Cloudinary copy.
 * Set CLOUDINARY_URL=cloudinary://KEY:SECRET@CLOUD_NAME to switch it on.
 */
export const cloudOn = !!process.env.CLOUDINARY_URL;
if (cloudOn) cloudinary.config({ secure: true });

const UPLOADS = path.join(__dirname, '../../uploads');
const IMAGE = /\.(jpe?g|png|gif|webp|bmp|svg|heic|avif)$/i;
const AV = /\.(mp4|mov|webm|mkv|avi|m4v|3gp|mp3|m4a|wav|ogg|aac|flac)$/i;

function kind(name: string): 'image' | 'video' | 'raw' { return IMAGE.test(name) ? 'image' : AV.test(name) ? 'video' : 'raw'; }
function clean(rel: string) { return rel.replace(/\\/g, '/').replace(/^\/+/, ''); }
function publicId(rel: string) { const r = 'hocfam/' + clean(rel); return kind(r) === 'raw' ? r : r.replace(/\.[^./]+$/, ''); }

export function cloudUrl(rel: string): string {
  return `https://res.cloudinary.com/${cloudinary.config().cloud_name}/${kind(rel)}/upload/hocfam/${clean(rel)}`;
}

/** Copy one saved upload to Cloudinary and return its permanent https address. */
export async function saveToCloud(absPath: string): Promise<string | null> {
  if (!cloudOn) return null;
  const rel = path.relative(UPLOADS, absPath);
  if (rel.startsWith('..')) return null;
  await cloudinary.uploader.upload(absPath, { public_id: publicId(rel), resource_type: kind(rel), overwrite: true, unique_filename: false, use_filename: false });
  return cloudUrl(rel);
}

/** After any request that uploaded files, copy them to Cloudinary in the background. */
export function mirrorUploads(req: Request, res: Response, next: NextFunction) {
  res.on('finish', () => {
    if (!cloudOn || res.statusCode >= 400) return;
    const r: any = req, files: any[] = [];
    if (r.file) files.push(r.file);
    if (r.files) (Array.isArray(r.files) ? r.files : Object.values(r.files).flat()).forEach((f: any) => files.push(f));
    files.forEach(f => {
      if (!f || !f.path) return;
      saveToCloud(f.path).then(u => u && console.log('☁️  Saved for good:', u)).catch(e => console.error('☁️  Could not save', f.originalname, '-', e.message));
    });
  });
  next();
}

/** /uploads/… whose local copy was wiped: send the visitor to the permanent copy. */
export function uploadsFallback(req: Request, res: Response, next: NextFunction) {
  if (!cloudOn) return next();
  let rel = '';
  try { rel = decodeURIComponent(req.path); } catch (e) { return next(); }
  rel = clean(rel);
  if (!rel || rel.includes('..')) return next();
  res.redirect(302, cloudUrl(rel));
}
