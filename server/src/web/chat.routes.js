import { Router } from 'express';
import { nanoid } from 'nanoid';
import crypto from 'crypto';
import { appwriteQuery } from '../storage/appwrite.js';

const router = Router();

function generateConversationId(userId, printerShopId) {
  const sortedIds = [userId, printerShopId].sort();
  return crypto
    .createHash('sha256')
    .update(sortedIds.join(':'))
    .digest('hex')
    .substring(0, 32);
}

const appwriteReady = (req, res) => {
  if (!req.appwrite) {
    res.status(500).json({ error: 'Appwrite is not configured on the server' });
    return false;
  }
  return true;
};

const parseConversation = (doc) => ({
  id: doc.conversationId || doc.$id,
  userId: doc.userId || '',
  printerShopId: doc.printerShopId || '',
  userName: doc.userName || '',
  userEmail: doc.userEmail || '',
  printerShopName: doc.printerShopName || '',
  printerShopLocation: doc.printerShopLocation || '',
  createdAt: doc.createdAt || doc.$createdAt,
  updatedAt: doc.updatedAt || doc.$updatedAt,
  lastMessageAt: doc.lastMessageAt || null
});

const parseMessage = (doc) => ({
  id: doc.messageId || doc.$id,
  conversationId: doc.conversationId,
  senderId: doc.senderId,
  senderRole: doc.senderRole,
  message: doc.message,
  createdAt: doc.createdAt || doc.$createdAt,
  readStatus: doc.readStatus ? 1 : 0
});

const getConversation = async (appwrite, conversationId) => {
  return appwrite.databases.getDocument(
    appwrite.databaseId,
    appwrite.conversationsCollectionId,
    conversationId
  );
};

const validateUserAccess = async (appwrite, conversationId, userId) => {
  const conversation = await getConversation(appwrite, conversationId);
  if (conversation.userId !== userId) {
    return { valid: false, error: 'Unauthorized access', conversation: null };
  }
  return { valid: true, conversation };
};

const validatePrinterAccess = async (appwrite, conversationId, printerShopId) => {
  const conversation = await getConversation(appwrite, conversationId);
  if (conversation.printerShopId !== printerShopId) {
    return { valid: false, error: 'Unauthorized access', conversation: null };
  }
  return { valid: true, conversation };
};

router.post('/conversations', async (req, res) => {
  if (!appwriteReady(req, res)) return;
  const appwrite = req.appwrite;
  const { userId, printerShopId, userName = '', userEmail = '', printerShopName = '', printerShopLocation = '' } = req.body;

  if (!userId || !printerShopId) {
    return res.status(400).json({ error: 'userId and printerShopId are required' });
  }

  const conversationId = generateConversationId(userId, printerShopId);
  const now = new Date().toISOString();

  try {
    let conversation = null;
    try {
      conversation = await getConversation(appwrite, conversationId);
    } catch (error) {
      if (error?.code !== 404) {
        throw error;
      }
    }

    if (!conversation) {
      conversation = await appwrite.databases.createDocument(
        appwrite.databaseId,
        appwrite.conversationsCollectionId,
        conversationId,
        {
          conversationId,
          userId,
          printerShopId,
          userName,
          userEmail,
          printerShopName,
          printerShopLocation,
          createdAt: now,
          updatedAt: now,
          lastMessageAt: null
        }
      );
    }

    return res.json({ conversation: parseConversation(conversation) });
  } catch (error) {
    console.error('Error creating conversation:', error);
    return res.status(500).json({ error: 'Failed to create conversation' });
  }
});

router.get('/conversations/user/:userId', async (req, res) => {
  if (!appwriteReady(req, res)) return;
  const appwrite = req.appwrite;
  const { userId } = req.params;

  try {
    const { documents } = await appwrite.databases.listDocuments(
      appwrite.databaseId,
      appwrite.conversationsCollectionId,
      [appwriteQuery.equal('userId', userId), appwriteQuery.limit(100), appwriteQuery.orderDesc('updatedAt')]
    );

    const conversations = [];
    for (const doc of documents) {
      const unreadResp = await appwrite.databases.listDocuments(
        appwrite.databaseId,
        appwrite.messagesCollectionId,
        [
          appwriteQuery.equal('conversationId', doc.conversationId || doc.$id),
          appwriteQuery.equal('readStatus', false),
          appwriteQuery.notEqual('senderId', userId),
          appwriteQuery.limit(1)
        ]
      );
      conversations.push({
        ...parseConversation(doc),
        unreadCount: unreadResp.total
      });
    }
    return res.json({ conversations });
  } catch (error) {
    console.error('Error getting user conversations:', error);
    return res.status(500).json({ error: 'Failed to fetch conversations' });
  }
});

router.get('/conversations/printer/:printerShopId', async (req, res) => {
  if (!appwriteReady(req, res)) return;
  const appwrite = req.appwrite;
  const { printerShopId } = req.params;

  try {
    const { documents } = await appwrite.databases.listDocuments(
      appwrite.databaseId,
      appwrite.conversationsCollectionId,
      [appwriteQuery.equal('printerShopId', printerShopId), appwriteQuery.limit(100), appwriteQuery.orderDesc('updatedAt')]
    );

    const conversations = [];
    for (const doc of documents) {
      const unreadResp = await appwrite.databases.listDocuments(
        appwrite.databaseId,
        appwrite.messagesCollectionId,
        [
          appwriteQuery.equal('conversationId', doc.conversationId || doc.$id),
          appwriteQuery.equal('readStatus', false),
          appwriteQuery.notEqual('senderId', printerShopId),
          appwriteQuery.limit(1)
        ]
      );
      conversations.push({
        ...parseConversation(doc),
        unreadCount: unreadResp.total
      });
    }
    return res.json({ conversations });
  } catch (error) {
    console.error('Error getting printer conversations:', error);
    return res.status(500).json({ error: 'Failed to fetch conversations' });
  }
});

router.get('/conversations/:conversationId/messages', async (req, res) => {
  if (!appwriteReady(req, res)) return;
  const appwrite = req.appwrite;
  const { conversationId } = req.params;
  const { userId, printerShopId, limit = 50, offset = 0 } = req.query;

  try {
    if (userId) {
      const validation = await validateUserAccess(appwrite, conversationId, userId);
      if (!validation.valid) {
        return res.status(403).json({ error: validation.error });
      }
    } else if (printerShopId) {
      const validation = await validatePrinterAccess(appwrite, conversationId, printerShopId);
      if (!validation.valid) {
        return res.status(403).json({ error: validation.error });
      }
    } else {
      return res.status(400).json({ error: 'userId or printerShopId is required' });
    }

    const parsedLimit = parseInt(limit, 10);
    const parsedOffset = parseInt(offset, 10);
    const response = await appwrite.databases.listDocuments(
      appwrite.databaseId,
      appwrite.messagesCollectionId,
      [
        appwriteQuery.equal('conversationId', conversationId),
        appwriteQuery.orderDesc('createdAt'),
        appwriteQuery.limit(parsedLimit),
        appwriteQuery.offset(parsedOffset)
      ]
    );

    const messages = response.documents.map(parseMessage).reverse();
    return res.json({
      messages,
      totalCount: response.total,
      hasMore: parsedOffset + messages.length < response.total
    });
  } catch (error) {
    if (error?.code === 404) {
      return res.status(404).json({ error: 'Conversation not found' });
    }
    console.error('Error fetching messages:', error);
    return res.status(500).json({ error: 'Failed to fetch messages' });
  }
});

router.post('/messages', async (req, res) => {
  if (!appwriteReady(req, res)) return;
  const appwrite = req.appwrite;
  const { conversationId, senderId, senderRole, message } = req.body;

  if (!conversationId || !senderId || !senderRole || !message) {
    return res.status(400).json({ error: 'conversationId, senderId, senderRole, and message are required' });
  }

  // Validate senderRole
  if (!['user', 'printer'].includes(senderRole)) {
    return res.status(400).json({ error: 'senderRole must be "user" or "printer"' });
  }

  try {
    let validation;
    if (senderRole === 'user') {
      validation = await validateUserAccess(appwrite, conversationId, senderId);
    } else {
      validation = await validatePrinterAccess(appwrite, conversationId, senderId);
    }
    if (!validation.valid) {
      return res.status(403).json({ error: validation.error });
    }

    const messageId = nanoid();
    const now = new Date().toISOString();
    const newMessageDoc = await appwrite.databases.createDocument(
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
      { lastMessageAt: now, updatedAt: now }
    );
    return res.json({ message: parseMessage(newMessageDoc) });
  } catch (error) {
    if (error?.code === 404) {
      return res.status(404).json({ error: 'Conversation not found' });
    }
    console.error('Error sending message:', error);
    return res.status(500).json({ error: 'Failed to send message' });
  }
});

router.patch('/messages/read', async (req, res) => {
  if (!appwriteReady(req, res)) return;
  const appwrite = req.appwrite;
  const { conversationId, userId, printerShopId } = req.body;

  if (!conversationId || (!userId && !printerShopId)) {
    return res.status(400).json({ error: 'conversationId and (userId or printerShopId) are required' });
  }

  try {
    let senderRoleToMark;
    if (userId) {
      const validation = await validateUserAccess(appwrite, conversationId, userId);
      if (!validation.valid) {
        return res.status(403).json({ error: validation.error });
      }
      senderRoleToMark = 'printer';
    } else {
      const validation = await validatePrinterAccess(appwrite, conversationId, printerShopId);
      if (!validation.valid) {
        return res.status(403).json({ error: validation.error });
      }
      senderRoleToMark = 'user';
    }

    const response = await appwrite.databases.listDocuments(
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
      response.documents.map((messageDoc) =>
        appwrite.databases.updateDocument(
          appwrite.databaseId,
          appwrite.messagesCollectionId,
          messageDoc.$id,
          { readStatus: true }
        )
      )
    );

    return res.json({ success: true });
  } catch (error) {
    if (error?.code === 404) {
      return res.status(404).json({ error: 'Conversation not found' });
    }
    console.error('Error marking messages as read:', error);
    return res.status(500).json({ error: 'Failed to mark messages as read' });
  }
});

router.get('/messages/unread', async (req, res) => {
  if (!appwriteReady(req, res)) return;
  const appwrite = req.appwrite;
  const { userId, printerShopId } = req.query;

  if (!userId && !printerShopId) {
    return res.status(400).json({ error: 'userId or printerShopId is required' });
  }

  try {
    const identity = userId || printerShopId;
    const conversationQueryField = userId ? 'userId' : 'printerShopId';
    const senderRoleToCount = userId ? 'printer' : 'user';
    const conversationsResp = await appwrite.databases.listDocuments(
      appwrite.databaseId,
      appwrite.conversationsCollectionId,
      [appwriteQuery.equal(conversationQueryField, identity), appwriteQuery.limit(100)]
    );

    let unreadCount = 0;
    for (const conversation of conversationsResp.documents) {
      const unreadResp = await appwrite.databases.listDocuments(
        appwrite.databaseId,
        appwrite.messagesCollectionId,
        [
          appwriteQuery.equal('conversationId', conversation.conversationId || conversation.$id),
          appwriteQuery.equal('senderRole', senderRoleToCount),
          appwriteQuery.equal('readStatus', false),
          appwriteQuery.limit(1)
        ]
      );
      unreadCount += unreadResp.total;
    }

    return res.json({ unreadCount });
  } catch (error) {
    console.error('Error getting unread count:', error);
    return res.status(500).json({ error: 'Failed to fetch unread count' });
  }
});

export default router;
