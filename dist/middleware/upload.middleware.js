"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.upload = void 0;
const multer_1 = __importDefault(require("multer"));
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
// Create uploads directory if it doesn't exist
const uploadDir = path_1.default.join(__dirname, '../../uploads');
if (!fs_1.default.existsSync(uploadDir)) {
    fs_1.default.mkdirSync(uploadDir, { recursive: true });
}
// Configure storage
const storage = multer_1.default.diskStorage({
    destination: (req, file, cb) => {
        const subDir = req.baseUrl.includes('sermon') ? 'sermons' :
            req.baseUrl.includes('event') ? 'events' :
                req.baseUrl.includes('gallery') ? 'gallery' :
                    req.baseUrl.includes('blog') ? 'blog' :
                        req.baseUrl.includes('feed') ? 'feed' :
                            req.baseUrl.includes('chat') ? 'chat' : 'others';
        const targetDir = path_1.default.join(uploadDir, subDir);
        if (!fs_1.default.existsSync(targetDir)) {
            fs_1.default.mkdirSync(targetDir, { recursive: true });
        }
        cb(null, targetDir);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, file.fieldname + '-' + uniqueSuffix + path_1.default.extname(file.originalname));
    }
});
// File filter
const fileFilter = (req, file, cb) => {
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
    const extAllowed = allowedExtensions.test(path_1.default.extname(file.originalname));
    const mimeAllowed = allowedMimePrefix.test(file.mimetype) || allowedDocMimes.includes(file.mimetype);
    if (extAllowed || mimeAllowed) {
        cb(null, true);
    }
    else {
        cb(new Error(`File type not allowed: ${path_1.default.extname(file.originalname)} (${file.mimetype})`));
    }
};
exports.upload = (0, multer_1.default)({
    storage,
    limits: { fileSize: 200 * 1024 * 1024 }, // 200MB
    fileFilter
});
