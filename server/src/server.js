import dotenv from 'dotenv';
import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import morgan from 'morgan';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { createAppwriteServices, appwriteQuery, createFileInputFromBuffer, generateUniqueId } from './storage/appwrite.js';
import jobsRouter from './web/jobs.routes.js';
import printersRouter from './web/printers.routes.js';
import chatRouter from './web/chat.routes.js';
import authRouter from './web/auth.routes.js';
import fs from 'fs';
import { nanoid } from 'nanoid';
import crypto from 'crypto';
import multer from 'multer';
import { Readable } from 'stream';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config();
dotenv.config({ path: join(__dirname, '../.env') });
dotenv.config({ path: join(__dirname, '../../.env') });
dotenv.config({ path: join(__dirname, '../../env.local') });

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

let appwrite = null;
try {
  appwrite = createAppwriteServices();
} catch (error) {
  console.error(error.message);
}

const upload = multer({
  storage: multer.memoryStorage()
});

const getMasterKey = () => {
  const rawKey = process.env.ENCRYPTION_KEY || 'default-encryption-key-change-me';
  return crypto.createHash('sha256').update(rawKey).digest();
};

const deriveFileKey = (fileId) => {
  const masterKey = getMasterKey();
  return crypto.hkdfSync('sha256', masterKey, Buffer.from(fileId), 'secure-file-encryption', 32);
};

const toBuffer = async (input) => {
  if (Buffer.isBuffer(input)) return input;
  if (input instanceof ArrayBuffer) return Buffer.from(input);
  if (ArrayBuffer.isView(input)) return Buffer.from(input.buffer, input.byteOffset, input.byteLength);
  if (input && typeof input.arrayBuffer === 'function') {
    const arrayBuffer = await input.arrayBuffer();
    return Buffer.from(arrayBuffer);
  }
  if (input && typeof input.on === 'function') {
    const chunks = [];
    for await (const chunk of input) {
      chunks.push(Buffer.from(chunk));
    }
    return Buffer.concat(chunks);
  }
  throw new Error('Unsupported Appwrite file payload');
};

const authMiddleware = (req, res, next) => {
  const userId = req.headers['x-user-id'] || req.query.userId;
  if (!userId) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  req.user = { id: String(userId) };
  next();
};

// routes
app.use('/api/jobs', (req, res, next) => { req.appwrite = appwrite; next(); }, jobsRouter);
app.use('/api/printers', (req, res, next) => { req.appwrite = appwrite; next(); }, printersRouter);
app.use('/api/chat', (req, res, next) => { req.appwrite = appwrite; next(); }, chatRouter);
app.use('/api/auth', (req, res, next) => { req.appwrite = appwrite; next(); }, authRouter);

app.post('/upload', authMiddleware, upload.single('file'), async (req, res, next) => {
  try {
    if (!appwrite) {
      return res.status(500).json({ error: 'Appwrite is not configured on the server' });
    }
    if (!req.file) {
      return res.status(400).json({ error: 'File is required' });
    }

    const allowedMimeTypes = new Set([
      'application/pdf',
      'image/jpeg',
      'image/png'
    ]);

    if (!allowedMimeTypes.has(req.file.mimetype)) {
      return res.status(400).json({ error: 'Only PDF, JPG, and PNG files are allowed' });
    }

    const fileId = nanoid();
    const fileKey = deriveFileKey(fileId);
    const iv = crypto.randomBytes(12);

    const cipher = crypto.createCipheriv('aes-256-gcm', fileKey, iv);
    const encryptedData = Buffer.concat([cipher.update(req.file.buffer), cipher.final()]);
    const authTag = cipher.getAuthTag();
    const combinedEncrypted = Buffer.concat([iv, authTag, encryptedData]);

    const storageFile = await appwrite.storage.createFile(
      appwrite.bucketId,
      generateUniqueId(),
      createFileInputFromBuffer(combinedEncrypted, req.file.originalname)
    );

    await appwrite.databases.createDocument(
      appwrite.databaseId,
      appwrite.filesCollectionId,
      fileId,
      {
        fileId,
        storageFileId: storageFile.$id,
        filename: req.file.originalname,
        mimeType: req.file.mimetype,
        size: req.file.size,
        createdAt: new Date().toISOString()
      }
    );

    res.json({
      id: fileId,
      filename: req.file.originalname,
      mimetype: req.file.mimetype,
      size: req.file.size
    });
  } catch (err) {
    next(err);
  }
});

app.get('/decrypt/:id', authMiddleware, async (req, res, next) => {
  const { id } = req.params;

  try {
    if (!appwrite) {
      return res.status(500).json({ error: 'Appwrite is not configured on the server' });
    }

    const record = await appwrite.databases.getDocument(
      appwrite.databaseId,
      appwrite.filesCollectionId,
      id
    );

    const fileKey = deriveFileKey(id);
    const encryptedPayload = await appwrite.storage.getFileDownload(appwrite.bucketId, record.storageFileId);
    const encryptedBuffer = await toBuffer(encryptedPayload);
    const iv = encryptedBuffer.subarray(0, 12);
    const authTag = encryptedBuffer.subarray(12, 28);
    const encryptedData = encryptedBuffer.subarray(28);

    const decipher = crypto.createDecipheriv('aes-256-gcm', fileKey, iv);
    decipher.setAuthTag(authTag);

    const decryptedBuffer = Buffer.concat([
      decipher.update(encryptedData),
      decipher.final()
    ]);

    res.setHeader('Content-Type', record.mimeType || 'application/octet-stream');
    res.setHeader(
      'Content-Disposition',
      `inline; filename="${encodeURIComponent(record.filename || 'document.bin')}"`
    );
    res.setHeader('Content-Length', decryptedBuffer.length);
    res.setHeader('Cache-Control', 'no-store');

    Readable.from(decryptedBuffer).pipe(res);
  } catch (err) {
    if (err?.code === 404) {
      return res.status(404).json({ error: 'File not found' });
    }
    next(err);
  }
});

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

const getConversationDoc = async (conversationId) => {
  if (!appwrite) return null;
  return appwrite.databases.getDocument(
    appwrite.databaseId,
    appwrite.conversationsCollectionId,
    conversationId
  );
};

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
      if (!appwrite) {
        socket.emit('error', { message: 'Appwrite is not configured' });
        return;
      }

      const conversation = await getConversationDoc(conversationId);
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

      const messageId = nanoid();
      const now = new Date().toISOString();

      await appwrite.databases.createDocument(
        appwrite.databaseId,
        appwrite.messagesCollectionId,
        messageId,
        {
          messageId,
          conversationId,
          senderId,
          senderRole,
          message,
          createdAt: now,
          readStatus: false
        }
      );

      await appwrite.databases.updateDocument(
        appwrite.databaseId,
        appwrite.conversationsCollectionId,
        conversationId,
        {
          lastMessageAt: now,
          updatedAt: now
        }
      );

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
    (async () => {
      try {
        if (!appwrite) {
          return;
        }
        const conversation = await getConversationDoc(conversationId);
        if (!conversation) {
          return;
        }

        if (userId && conversation.userId !== userId) {
          return;
        }
        if (printerShopId && conversation.printerShopId !== printerShopId) {
          return;
        }

        const senderRoleToMark = userId ? 'printer' : 'user';
        const unread = await appwrite.databases.listDocuments(
          appwrite.databaseId,
          appwrite.messagesCollectionId,
          [
            appwriteQuery.equal('conversationId', conversationId),
            appwriteQuery.equal('senderRole', senderRoleToMark),
            appwriteQuery.equal('readStatus', false),
            appwriteQuery.limit(100)
          ]
        );

        await Promise.all(
          unread.documents.map((doc) =>
            appwrite.databases.updateDocument(
              appwrite.databaseId,
              appwrite.messagesCollectionId,
              doc.$id,
              { readStatus: true }
            )
          )
        );

        socket.to(conversationId).emit('messages_read', { conversationId });
      } catch (error) {
        console.error('Error marking messages as read:', error);
      }
    })();
  });

  socket.on('disconnect', () => {
    if (socket.identity) {
      onlineUsers.delete(socket.identity);
      socket.broadcast.emit('user_offline', { identity: socket.identity, role: socket.role });
      console.log(`${socket.role} ${socket.identity} disconnected`);
    }
  });
});

export default app;
export { app, io, httpServer };

if (process.argv[1] && process.argv[1] === __filename) {
  httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`SecurePrint backend running on http://0.0.0.0:${PORT}`);
    console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`Socket.IO enabled for real-time chat`);
  });
}
