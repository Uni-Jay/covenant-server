import { Server as SocketIOServer, Socket } from 'socket.io';
import { Server as HTTPServer } from 'http';
import jwt from 'jsonwebtoken';

interface UserSocket extends Socket {
  userId?: number;
}

export function setupSocketIO(httpServer: HTTPServer) {
  const io = new SocketIOServer(httpServer, {
    cors: {
      origin: '*',
      methods: ['GET', 'POST'],
    },
    transports: ['websocket', 'polling'],
  });

  // Authentication middleware
  io.use((socket: UserSocket, next) => {
    const token = socket.handshake.auth.token;
    const userId = socket.handshake.auth.userId;

    if (!token) {
      return next(new Error('Authentication error: No token provided'));
    }

    try {
      jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
      socket.userId = userId;
      next();
    } catch (error) {
      next(new Error('Authentication error: Invalid token'));
    }
  });

  io.on('connection', (socket: UserSocket) => {
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
      } else if (numClients === 1) {
        socket.join(roomId);
        socket.emit('room-joined');
        socket.to(roomId).emit('peer-joined');
        console.log(`[WebRTC] User ${userId} joined room ${roomId}`);
      } else {
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

    // Call notification events
    socket.on('call:invite', ({ callerId, callerName, callerPhoto, recipientIds, groupId, groupName, callType, roomId }) => {
      console.log(`[Call] ${callerName} (${callerId}) initiating ${callType} call to group ${groupId}`);
      console.log(`[Call Debug] Looking for recipients:`, recipientIds);
      
      // Debug: Show all connected users
      const allConnectedUsers = Array.from(io.sockets.sockets.values())
        .map((s: any) => ({ socketId: s.id, userId: s.userId }))
        .filter((s) => s.userId);
      console.log(`[Call Debug] All connected users:`, allConnectedUsers);
      
      // Broadcast call invitation to all recipients
      recipientIds.forEach((recipientId: number) => {
        const recipientSockets = Array.from(io.sockets.sockets.values()).filter(
          (s: any) => s.userId === recipientId
        );
        
        console.log(`[Call Debug] Found ${recipientSockets.length} socket(s) for recipient ${recipientId}`);
        
        recipientSockets.forEach((recipientSocket) => {
          console.log(`[Call Debug] Emitting call:incoming to socket ${recipientSocket.id}`);
          recipientSocket.emit('call:incoming', {
            callerId,
            callerName,
            callerPhoto,
            groupId,
            groupName,
            callType,
            roomId,
          });
        });
        
        if (recipientSockets.length === 0) {
          console.log(`[Call Warning] ⚠️  Recipient ${recipientId} is NOT CONNECTED - notification will not be delivered!`);
        }
      });
    });

    socket.on('call:accept', ({ callerId, acceptorId, acceptorName, roomId }) => {
      console.log(`[Call] User ${acceptorId} accepted call in room ${roomId}`);
      
      // Notify the caller that someone accepted
      const callerSockets = Array.from(io.sockets.sockets.values()).filter(
        (s: any) => s.userId === callerId
      );
      
      callerSockets.forEach((callerSocket) => {
        callerSocket.emit('call:accepted', {
          acceptorId,
          acceptorName,
          roomId,
        });
      });
    });

    socket.on('call:reject', ({ callerId, rejectorId, roomId }) => {
      console.log(`[Call] User ${rejectorId} rejected call in room ${roomId}`);
      
      // Notify the caller
      const callerSockets = Array.from(io.sockets.sockets.values()).filter(
        (s: any) => s.userId === callerId
      );
      
      callerSockets.forEach((callerSocket) => {
        callerSocket.emit('call:rejected', {
          rejectorId,
          roomId,
        });
      });
    });

    socket.on('call:end', ({ roomId, userId, recipientIds }) => {
      console.log(`[Call] Call ended in room ${roomId} by user ${userId}`);
      
      // Broadcast to all participants
      if (recipientIds && recipientIds.length > 0) {
        recipientIds.forEach((recipientId: number) => {
          const recipientSockets = Array.from(io.sockets.sockets.values()).filter(
            (s: any) => s.userId === recipientId
          );
          
          recipientSockets.forEach((recipientSocket) => {
            recipientSocket.emit('call:ended', { roomId });
          });
        });
      }
      
      // Also emit to the room
      socket.to(roomId).emit('call:ended', { roomId });
    });

    socket.on('disconnect', () => {
      console.log(`[Socket.IO] User ${socket.userId} disconnected`);
    });
  });

  console.log('[Socket.IO] Server initialized');
  return io;
}
