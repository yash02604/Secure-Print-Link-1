import 'dotenv/config';
import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import morgan from 'morgan';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { createDb } from './storage/db.js';
import jobsRouter from './web/jobs.routes.js';
import printersRouter from './web/printers.routes.js';
import chatRouter from './web/chat.routes.js';
import fs from 'fs';
import { nanoid } from 'nanoid';
import crypto from 'crypto';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: process.env.CLIENT_URL || 'http://localhost:3000',
    methods: ['GET', 'POST'],
    credentials: true
  }
});
const PORT = process.env.PORT || 4000;

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(morgan('dev'));

// initialize DB
const dbPath = process.env.VERCEL
  ? '/tmp/secureprint.db'
  : join(__dirname, '../data/secureprint.db');

const db = createDb(dbPath);
app.set('db', db);

// routes
app.use('/api/jobs', (req, res, next) => { req.db = db; next(); }, jobsRouter);
app.use('/api/printers', (req, res, next) => { req.db = db; next(); }, printersRouter);
app.use('/api/chat', (req, res, next) => { req.db = db; next(); }, chatRouter);

app.get('/health', (req, res) => res.json({ ok: true }));

// Serve React build in production for internet-facing single URL
const buildDir = join(__dirname, '../../build');
if (fs.existsSync(buildDir)) {
  app.use(express.static(buildDir));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api')) return next();
    res.sendFile(join(buildDir, 'index.html'));
  });
}

app.use((err, req, res, next) => {
  console.error(err);
  res.status(err.status || 500).json({ error: err.message || 'Server error' });
});

// Socket.IO for real-time chat
const onlineUsers = new Map(); // userId/printerShopId -> socketId

// Generate deterministic conversation ID (must match chat.routes.js)
function generateConversationId(userId, printerShopId) {
  const sortedIds = [userId, printerShopId].sort();
  return crypto
    .createHash('sha256')
    .update(sortedIds.join(':'))
    .digest('hex')
    .substring(0, 32);
}

io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);

  // User/Printer joins with their identity
  socket.on('join', ({ userId, printerShopId, role }) => {
    const identity = role === 'user' ? userId : printerShopId;
    socket.identity = identity;
    socket.role = role;
    onlineUsers.set(identity, socket.id);
    console.log(`${role} ${identity} joined`);

    // Broadcast online status
    socket.broadcast.emit('user_online', { identity, role });
  });

  // Join a specific conversation room
  socket.on('join_conversation', ({ conversationId }) => {
    socket.join(conversationId);
    console.log(`${socket.identity} joined conversation ${conversationId}`);
  });

  // Send message
  socket.on('send_message', async ({ conversationId, senderId, senderRole, message }) => {
    try {
      // Validate access before sending
      const conversation = db.prepare('SELECT * FROM conversations WHERE id = ?').get(conversationId);
      if (!conversation) {
        socket.emit('error', { message: 'Conversation not found' });
        return;
      }

      // Validate sender has access to this conversation
      if (senderRole === 'user' && conversation.userId !== senderId) {
        socket.emit('error', { message: 'Unauthorized' });
        return;
      }
      if (senderRole === 'printer' && conversation.printerShopId !== senderId) {
        socket.emit('error', { message: 'Unauthorized' });
        return;
      }

      // Save message to database
      const messageId = nanoid();
      const now = new Date().toISOString();

      db.prepare(`
        INSERT INTO messages (id, conversationId, senderId, senderRole, message, createdAt, readStatus)
        VALUES (?, ?, ?, ?, ?, ?, 0)
      `).run(messageId, conversationId, senderId, senderRole, message, now);

      // Update conversation's lastMessageAt
      db.prepare('UPDATE conversations SET lastMessageAt = ?, updatedAt = ? WHERE id = ?')
        .run(now, now, conversationId);

      const newMessage = {
        id: messageId,
        conversationId,
        senderId,
        senderRole,
        message,
        createdAt: now,
        readStatus: 0
      };

      // Emit to all clients in this conversation room
      io.to(conversationId).emit('new_message', newMessage);

      // Also emit to specific recipient if they're online
      const recipientId = senderRole === 'user' ? conversation.printerShopId : conversation.userId;
      const recipientSocketId = onlineUsers.get(recipientId);
      if (recipientSocketId) {
        io.to(recipientSocketId).emit('new_message_notification', {
          conversationId,
          message: newMessage
        });
      }
    } catch (error) {
      console.error('Error sending message:', error);
      socket.emit('error', { message: 'Failed to send message' });
    }
  });

  // Typing indicator
  socket.on('typing', ({ conversationId, userId, printerShopId, isTyping }) => {
    socket.to(conversationId).emit('user_typing', { conversationId, userId, printerShopId, isTyping });
  });

  // Mark messages as read
  socket.on('mark_read', ({ conversationId, userId, printerShopId }) => {
    try {
      const senderRole = userId ? 'user' : 'printer';
      const column = userId ? 'userId' : 'printerShopId';
      const value = userId || printerShopId;

      // Validate access
      const conversation = db.prepare(`SELECT * FROM conversations WHERE id = ? AND ${column} = ?`)
        .get(conversationId, value);

      if (!conversation) {
        return;
      }

      // Mark messages as read
      if (userId) {
        db.prepare(`
          UPDATE messages 
          SET readStatus = 1 
          WHERE conversationId = ? AND senderRole = 'printer' AND readStatus = 0
        `).run(conversationId);
      } else {
        db.prepare(`
          UPDATE messages 
          SET readStatus = 1 
          WHERE conversationId = ? AND senderRole = 'user' AND readStatus = 0
        `).run(conversationId);
      }

      // Notify other party
      socket.to(conversationId).emit('messages_read', { conversationId });
    } catch (error) {
      console.error('Error marking messages as read:', error);
    }
  });

  socket.on('disconnect', () => {
    if (socket.identity) {
      onlineUsers.delete(socket.identity);
      socket.broadcast.emit('user_offline', { identity: socket.identity, role: socket.role });
      console.log(`${socket.role} ${socket.identity} disconnected`);
    }
  });
});

if (process.env.NODE_ENV !== 'test') {
  // Only listen if not triggered by Vercel/Test
  // Vercel handles the server via the exported app
  if (!process.env.VERCEL) {
    httpServer.listen(PORT, '0.0.0.0', () => {
      console.log(`SecurePrint backend running on http://0.0.0.0:${PORT}`);
      console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
      console.log(`Socket.IO enabled for real-time chat`);
    });
  }
}

export default app;


