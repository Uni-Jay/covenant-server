"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.setupSocketIO = setupSocketIO;
const socket_io_1 = require("socket.io");
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
function setupSocketIO(httpServer) {
    const io = new socket_io_1.Server(httpServer, {
        cors: {
            origin: '*',
            methods: ['GET', 'POST'],
        },
        transports: ['websocket', 'polling'],
    });
    // Authentication middleware
    io.use((socket, next) => {
        const token = socket.handshake.auth.token;
        const userId = socket.handshake.auth.userId;
        if (!token) {
            return next(new Error('Authentication error: No token provided'));
        }
        try {
            jsonwebtoken_1.default.verify(token, process.env.JWT_SECRET || 'your-secret-key');
            socket.userId = userId;
            next();
        }
        catch (error) {
            next(new Error('Authentication error: Invalid token'));
        }
    });
    io.on('connection', (socket) => {
        console.log(`[Socket.IO] User ${socket.userId} connected`);
        // Join group chat room
        socket.on('join-group', ({ groupId, userId }) => {
            socket.join(`group-${groupId}`);
            console.log(`[Socket.IO] User ${userId} joined group ${groupId}`);
        });
        // Leave group chat room
        socket.on('leave-group', ({ groupId, userId }) => {
            socket.leave(`group-${groupId}`);
            console.log(`[Socket.IO] User ${userId} left group ${groupId}`);
        });
        // Send message to group
        socket.on('send-message', ({ groupId, message }) => {
            console.log(`[Socket.IO] Broadcasting message to group ${groupId}`);
            socket.to(`group-${groupId}`).emit('new-message', message);
        });
        // User typing indicator
        socket.on('typing', ({ groupId, userId, userName }) => {
            socket.to(`group-${groupId}`).emit('user-typing', { groupId, userId, userName });
        });
        // User stopped typing
        socket.on('stop-typing', ({ groupId, userId, userName }) => {
            socket.to(`group-${groupId}`).emit('user-stopped-typing', { groupId, userId, userName });
        });
        // Mark message as read
        socket.on('mark-read', ({ groupId, messageId, userId }) => {
            socket.to(`group-${groupId}`).emit('message-read', { groupId, messageId, userId });
        });
        // WebRTC signaling
        socket.on('join-room', ({ roomId, userId }) => {
            const room = io.sockets.adapter.rooms.get(roomId);
            const numClients = room ? room.size : 0;
            if (numClients === 0) {
                socket.join(roomId);
                socket.emit('room-created');
                console.log(`[WebRTC] User ${userId} created room ${roomId}`);
            }
            else if (numClients === 1) {
                socket.join(roomId);
                socket.emit('room-joined');
                socket.to(roomId).emit('peer-joined');
                console.log(`[WebRTC] User ${userId} joined room ${roomId}`);
            }
            else {
                socket.emit('room-full');
                console.log(`[WebRTC] Room ${roomId} is full`);
            }
        });
        socket.on('offer', ({ roomId, offer }) => {
            console.log(`[WebRTC] Forwarding offer in room ${roomId}`);
            socket.to(roomId).emit('offer', offer);
        });
        socket.on('answer', ({ roomId, answer }) => {
            console.log(`[WebRTC] Forwarding answer in room ${roomId}`);
            socket.to(roomId).emit('answer', answer);
        });
        socket.on('ice-candidate', ({ roomId, candidate }) => {
            console.log(`[WebRTC] Forwarding ICE candidate in room ${roomId}`);
            socket.to(roomId).emit('ice-candidate', candidate);
        });
        socket.on('leave-room', ({ roomId, userId }) => {
            socket.leave(roomId);
            socket.to(roomId).emit('user-disconnected');
            console.log(`[WebRTC] User ${userId} left room ${roomId}`);
        });
        socket.on('disconnect', () => {
            console.log(`[Socket.IO] User ${socket.userId} disconnected`);
        });
    });
    console.log('[Socket.IO] Server initialized');
    return io;
}
