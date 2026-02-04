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
                    req.baseUrl.includes('blog') ? 'blog' : 'others';
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
    const allowedTypes = /jpeg|jpg|png|gif|pdf|mp3|mp4|wav|mpeg/;
    const extname = allowedTypes.test(path_1.default.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    if (extname && mimetype) {
        cb(null, true);
    }
    else {
        cb(new Error('Invalid file type'));
    }
};
exports.upload = (0, multer_1.default)({
    storage,
    limits: { fileSize: 200 * 1024 * 1024 }, // 200MB
    fileFilter
});
