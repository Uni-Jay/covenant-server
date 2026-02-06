"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const helmet_1 = __importDefault(require("helmet"));
const morgan_1 = __importDefault(require("morgan"));
const dotenv_1 = __importDefault(require("dotenv"));
const path_1 = __importDefault(require("path"));
const http_1 = require("http");
const socket_service_1 = require("./services/socket.service");
const birthday_service_1 = require("./services/birthday.service");
// Import routes
const auth_routes_1 = __importDefault(require("./routes/auth.routes"));
const sermon_routes_1 = __importDefault(require("./routes/sermon.routes"));
const event_routes_1 = __importDefault(require("./routes/event.routes"));
const gallery_routes_1 = __importDefault(require("./routes/gallery.routes"));
const blog_routes_1 = __importDefault(require("./routes/blog.routes"));
const prayerRequest_routes_1 = __importDefault(require("./routes/prayerRequest.routes"));
const donation_routes_1 = __importDefault(require("./routes/donation.routes"));
const ministry_routes_1 = __importDefault(require("./routes/ministry.routes"));
const contact_routes_1 = __importDefault(require("./routes/contact.routes"));
const feed_routes_1 = __importDefault(require("./routes/feed.routes"));
const chat_routes_1 = __importDefault(require("./routes/chat.routes"));
const document_routes_1 = __importDefault(require("./routes/document.routes"));
const churchEmail_routes_1 = __importDefault(require("./routes/churchEmail.routes"));
const bible_routes_1 = __importDefault(require("./routes/bible.routes"));
const hymn_routes_1 = __importDefault(require("./routes/hymn.routes"));
const notification_routes_1 = __importDefault(require("./routes/notification.routes"));
const firstTimer_routes_1 = __importDefault(require("./routes/firstTimer.routes"));
const dashboard_routes_1 = __importDefault(require("./routes/dashboard.routes"));
const attendance_routes_1 = __importDefault(require("./routes/attendance.routes"));
const departments_routes_1 = __importDefault(require("./routes/departments.routes"));
const users_routes_1 = __importDefault(require("./routes/users.routes"));
const ai_routes_1 = __importDefault(require("./routes/ai.routes"));
// Load environment variables
dotenv_1.default.config();
const app = (0, express_1.default)();
const PORT = process.env.PORT || 5000;
// Middleware
app.use((0, helmet_1.default)({
    crossOriginResourcePolicy: { policy: "cross-origin" }
}));
app.use((0, cors_1.default)({
    origin: [
        process.env.CLIENT_URL || 'http://localhost:5173',
        'http://localhost:8081', // Expo web
        'http://10.0.2.2:8081', // Android emulator
        'exp://localhost:8081', // Expo Go
    ],
    credentials: true
}));
app.use((0, morgan_1.default)('dev'));
app.use(express_1.default.json({ limit: '200mb' }));
app.use(express_1.default.urlencoded({ extended: true, limit: '200mb' }));
// Static files (uploads) - with CORS headers
app.use('/uploads', (req, res, next) => {
    res.header('Cross-Origin-Resource-Policy', 'cross-origin');
    res.header('Access-Control-Allow-Origin', '*');
    next();
}, express_1.default.static(path_1.default.join(__dirname, '../uploads')));
// API Routes
app.use('/api/auth', auth_routes_1.default);
app.use('/api/sermons', sermon_routes_1.default);
app.use('/api/events', event_routes_1.default);
app.use('/api/gallery', gallery_routes_1.default);
app.use('/api/blog', blog_routes_1.default);
app.use('/api/prayer-requests', prayerRequest_routes_1.default);
app.use('/api/donations', donation_routes_1.default);
app.use('/api/ministries', ministry_routes_1.default);
app.use('/api/contact', contact_routes_1.default);
app.use('/api/feed', feed_routes_1.default);
app.use('/api/chat', chat_routes_1.default);
app.use('/api/documents', document_routes_1.default);
app.use('/api/church-emails', churchEmail_routes_1.default);
app.use('/api/bible', bible_routes_1.default);
app.use('/api/hymns', hymn_routes_1.default);
app.use('/api/notifications', notification_routes_1.default);
app.use('/api/first-timers', firstTimer_routes_1.default);
app.use('/api/dashboard', dashboard_routes_1.default);
app.use('/api/attendance', attendance_routes_1.default);
app.use('/api/departments', departments_routes_1.default);
app.use('/api/users', users_routes_1.default);
app.use('/api/ai', ai_routes_1.default);
// Health check
app.get('/api/health', (req, res) => {
    res.json({ status: 'OK', message: 'Server is running' });
});
// Error handling middleware
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(err.status || 500).json({
        message: err.message || 'Internal Server Error',
        error: process.env.NODE_ENV === 'development' ? err : {}
    });
});
// Create HTTP server
const httpServer = (0, http_1.createServer)(app);
// Set up Socket.IO for real-time chat and WebRTC
(0, socket_service_1.setupSocketIO)(httpServer);
// Start server
httpServer.listen(PORT, () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
    console.log(`📖 Environment: ${process.env.NODE_ENV}`);
    console.log(`🔌 Socket.IO server ready`);
    // Initialize birthday checker
    (0, birthday_service_1.initializeBirthdayChecker)();
});
exports.default = app;
