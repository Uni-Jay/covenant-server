import express, { Application } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import dotenv from 'dotenv';
import path from 'path';
import { createServer } from 'http';
import { setupSocketIO } from './services/socket.service';

// Import routes
import authRoutes from './routes/auth.routes';
import sermonRoutes from './routes/sermon.routes';
import eventRoutes from './routes/event.routes';
import galleryRoutes from './routes/gallery.routes';
import blogRoutes from './routes/blog.routes';
import prayerRequestRoutes from './routes/prayerRequest.routes';
import donationRoutes from './routes/donation.routes';
import ministryRoutes from './routes/ministry.routes';
import contactRoutes from './routes/contact.routes';
import feedRoutes from './routes/feed.routes';
import chatRoutes from './routes/chat.routes';
import documentRoutes from './routes/document.routes';
import churchEmailRoutes from './routes/churchEmail.routes';
import bibleRoutes from './routes/bible.routes';
import hymnRoutes from './routes/hymn.routes';
import notificationRoutes from './routes/notification.routes';
import firstTimerRoutes from './routes/firstTimer.routes';
import dashboardRoutes from './routes/dashboard.routes';
import attendanceRoutes from './routes/attendance.routes';
import departmentsRoutes from './routes/departments.routes';

// Load environment variables
dotenv.config();

const app: Application = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" }
}));
app.use(cors({
  origin: [
    process.env.CLIENT_URL || 'http://localhost:5173',
    'http://localhost:8081', // Expo web
    'http://10.0.2.2:8081', // Android emulator
    'exp://localhost:8081', // Expo Go
  ],
  credentials: true
}));
app.use(morgan('dev'));
app.use(express.json({ limit: '200mb' }));
app.use(express.urlencoded({ extended: true, limit: '200mb' }));

// Static files (uploads) - with CORS headers
app.use('/uploads', (req, res, next) => {
  res.header('Cross-Origin-Resource-Policy', 'cross-origin');
  res.header('Access-Control-Allow-Origin', '*');
  next();
}, express.static(path.join(__dirname, '../uploads')));

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/sermons', sermonRoutes);
app.use('/api/events', eventRoutes);
app.use('/api/gallery', galleryRoutes);
app.use('/api/blog', blogRoutes);
app.use('/api/prayer-requests', prayerRequestRoutes);
app.use('/api/donations', donationRoutes);
app.use('/api/ministries', ministryRoutes);
app.use('/api/contact', contactRoutes);
app.use('/api/feed', feedRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/documents', documentRoutes);
app.use('/api/church-emails', churchEmailRoutes);
app.use('/api/bible', bibleRoutes);
app.use('/api/hymns', hymnRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/first-timers', firstTimerRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/attendance', attendanceRoutes);
app.use('/api/departments', departmentsRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', message: 'Server is running' });
});

// Error handling middleware
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error(err.stack);
  res.status(err.status || 500).json({
    message: err.message || 'Internal Server Error',
    error: process.env.NODE_ENV === 'development' ? err : {}
  });
});

// Create HTTP server
const httpServer = createServer(app);

// Set up Socket.IO for real-time chat and WebRTC
setupSocketIO(httpServer);

// Start server
httpServer.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
  console.log(`📖 Environment: ${process.env.NODE_ENV}`);
  console.log(`🔌 Socket.IO server ready`);
});

export default app;
