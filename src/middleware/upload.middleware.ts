import multer from 'multer';
import path from 'path';
import fs from 'fs';

// Create uploads directory if it doesn't exist
const uploadDir = path.join(__dirname, '../../uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Configure storage
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const subDir = req.baseUrl.includes('sermon') ? 'sermons' :
                   req.baseUrl.includes('event') ? 'events' :
                   req.baseUrl.includes('gallery') ? 'gallery' :
                   req.baseUrl.includes('blog') ? 'blog' :
                   req.baseUrl.includes('feed') ? 'feed' :
                   req.baseUrl.includes('chat') ? 'chat' : 'others';
    
    const targetDir = path.join(uploadDir, subDir);
    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
    }
    
    cb(null, targetDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

// File filter
const fileFilter = (req: any, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  // Allow all common image, video, audio, and document types
  const allowedExtensions = /\.(jpeg|jpg|png|gif|webp|mp4|mov|avi|mkv|webm|mp3|wav|m4a|aac|ogg|pdf|doc|docx|xls|xlsx|ppt|pptx|txt|csv|zip|rar)$/i;
  const allowedMimePrefix = /^(image|video|audio)\//;
  const allowedDocMimes = [
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'text/plain',
    'text/csv',
    'application/zip',
    'application/x-rar-compressed',
    'application/octet-stream',
  ];

  const extAllowed = allowedExtensions.test(path.extname(file.originalname));
  const mimeAllowed = allowedMimePrefix.test(file.mimetype) || allowedDocMimes.includes(file.mimetype);

  if (extAllowed || mimeAllowed) {
    cb(null, true);
  } else {
    cb(new Error(`File type not allowed: ${path.extname(file.originalname)} (${file.mimetype})`));
  }
};

export const upload = multer({
  storage,
  limits: { fileSize: 200 * 1024 * 1024 }, // 200MB
  fileFilter
});
