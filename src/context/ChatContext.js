import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { io } from 'socket.io-client';
import api from '../api/client';
import { toast } from 'react-toastify';
import { useAuth } from './AuthContext';

const ChatContext = createContext();

export const useChat = () => {
  const context = useContext(ChatContext);
  if (!context) {
    throw new Error('useChat must be used within a ChatProvider');
  }
  return context;
};

export const ChatProvider = ({ children }) => {
  const { currentUser, isAuthenticated } = useAuth();
  const [socket, setSocket] = useState(null);
  const [conversations, setConversations] = useState([]);
  const [activeConversation, setActiveConversation] = useState(null);
  const [messages, setMessages] = useState({});
  const [onlineUsers, setOnlineUsers] = useState(new Set());
  const [typingUsers, setTypingUsers] = useState({});
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const typingTimeoutRef = useRef({});

  // Initialize Socket.IO connection
  useEffect(() => {
    if (!isAuthenticated || !currentUser) return;

    const serverUrl = process.env.REACT_APP_SOCKET_URL || 'http://localhost:4000';
    const newSocket = io(serverUrl, {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: 5
    });

    newSocket.on('connect', () => {
      console.log('Socket connected');
      // Join with user identity
      const role = currentUser.role === 'admin' ? 'printer' : 'user';
      newSocket.emit('join', {
        userId: currentUser.id,
        printerShopId: role === 'printer' ? currentUser.id : null,
        role
      });
    });

    newSocket.on('disconnect', () => {
      console.log('Socket disconnected');
    });

    newSocket.on('connect_error', (error) => {
      console.error('Socket connection error:', error);
    });

    // Listen for new messages
    newSocket.on('new_message', (message) => {
      setMessages(prev => ({
        ...prev,
        [message.conversationId]: [...(prev[message.conversationId] || []), message]
      }));

      // Update conversation's last message time
      setConversations(prev => 
        prev.map(conv => 
          conv.id === message.conversationId 
            ? { ...conv, lastMessageAt: message.createdAt, unreadCount: conv.unreadCount + 1 }
            : conv
        ).sort((a, b) => new Date(b.lastMessageAt) - new Date(a.lastMessageAt))
      );
    });

    // Listen for message notifications
    newSocket.on('new_message_notification', ({ conversationId, message }) => {
      // Show notification if not in active conversation
      if (activeConversation?.id !== conversationId) {
        toast.info('New message received');
      }
    });

    // Listen for typing indicators
    newSocket.on('user_typing', ({ conversationId, isTyping }) => {
      setTypingUsers(prev => ({
        ...prev,
        [conversationId]: isTyping
      }));
    });

    // Listen for read receipts
    newSocket.on('messages_read', ({ conversationId }) => {
      setMessages(prev => ({
        ...prev,
        [conversationId]: (prev[conversationId] || []).map(msg => ({
          ...msg,
          readStatus: 1
        }))
      }));
    });

    // Listen for online/offline status
    newSocket.on('user_online', ({ identity }) => {
      setOnlineUsers(prev => new Set([...prev, identity]));
    });

    newSocket.on('user_offline', ({ identity }) => {
      setOnlineUsers(prev => {
        const newSet = new Set(prev);
        newSet.delete(identity);
        return newSet;
      });
    });

    setSocket(newSocket);

    return () => {
      newSocket.close();
    };
  }, [isAuthenticated, currentUser, activeConversation?.id]);

  // Load conversations
  const loadConversations = useCallback(async () => {
    if (!currentUser) return;

    setLoading(true);
    try {
      const role = currentUser.role === 'admin' ? 'printer' : 'user';
      const endpoint = role === 'user' 
        ? `/api/chat/conversations/user/${currentUser.id}`
        : `/api/chat/conversations/printer/${currentUser.id}`;

      const response = await api.get(endpoint);
      setConversations(response.data.conversations || []);
    } catch (error) {
      console.error('Error loading conversations:', error);
      toast.error('Failed to load conversations');
    } finally {
      setLoading(false);
    }
  }, [currentUser]);

  // Create or get conversation
  const getOrCreateConversation = useCallback(async (printerShopId) => {
    if (!currentUser) return null;

    try {
      const response = await api.post('/api/chat/conversations', {
        userId: currentUser.id,
        printerShopId
      });

      const conversation = response.data.conversation;
      
      // Add to conversations if not already present
      setConversations(prev => {
        const exists = prev.find(c => c.id === conversation.id);
        if (exists) return prev;
        return [conversation, ...prev];
      });

      return conversation;
    } catch (error) {
      console.error('Error creating conversation:', error);
      toast.error('Failed to start conversation');
      return null;
    }
  }, [currentUser]);

  // Load messages for a conversation
  const loadMessages = useCallback(async (conversationId, offset = 0, limit = 50) => {
    if (!currentUser) return;

    try {
      const role = currentUser.role === 'admin' ? 'printer' : 'user';
      const params = {
        [role === 'user' ? 'userId' : 'printerShopId']: currentUser.id,
        offset,
        limit
      };

      const response = await api.get(`/api/chat/conversations/${conversationId}/messages`, { params });
      
      setMessages(prev => ({
        ...prev,
        [conversationId]: response.data.messages || []
      }));

      return response.data;
    } catch (error) {
      console.error('Error loading messages:', error);
      toast.error('Failed to load messages');
      return { messages: [], hasMore: false };
    }
  }, [currentUser]);

  // Send message via Socket.IO
  const sendMessage = useCallback((conversationId, message) => {
    if (!socket || !currentUser) return;

    const role = currentUser.role === 'admin' ? 'printer' : 'user';
    
    socket.emit('send_message', {
      conversationId,
      senderId: currentUser.id,
      senderRole: role,
      message
    });

    // Optimistically add message to UI
    const tempMessage = {
      id: `temp_${Date.now()}`,
      conversationId,
      senderId: currentUser.id,
      senderRole: role,
      message,
      createdAt: new Date().toISOString(),
      readStatus: 0
    };

    setMessages(prev => ({
      ...prev,
      [conversationId]: [...(prev[conversationId] || []), tempMessage]
    }));
  }, [socket, currentUser]);

  // Join conversation room
  const joinConversation = useCallback((conversationId) => {
    if (!socket) return;
    socket.emit('join_conversation', { conversationId });
    setActiveConversation(conversations.find(c => c.id === conversationId) || { id: conversationId });
    
    // Mark messages as read
    markMessagesAsRead(conversationId);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [socket, conversations]);

  // Leave conversation room
  const leaveConversation = useCallback(() => {
    setActiveConversation(null);
  }, []);

  // Send typing indicator
  const sendTyping = useCallback((conversationId, isTyping) => {
    if (!socket || !currentUser) return;

    const role = currentUser.role === 'admin' ? 'printer' : 'user';

    // Clear existing timeout
    if (typingTimeoutRef.current[conversationId]) {
      clearTimeout(typingTimeoutRef.current[conversationId]);
    }

    socket.emit('typing', {
      conversationId,
      userId: role === 'user' ? currentUser.id : null,
      printerShopId: role === 'printer' ? currentUser.id : null,
      isTyping
    });

    // Auto-stop typing after 3 seconds
    if (isTyping) {
      typingTimeoutRef.current[conversationId] = setTimeout(() => {
        socket.emit('typing', {
          conversationId,
          userId: role === 'user' ? currentUser.id : null,
          printerShopId: role === 'printer' ? currentUser.id : null,
          isTyping: false
        });
      }, 3000);
    }
  }, [socket, currentUser]);

  // Mark messages as read
  const markMessagesAsRead = useCallback(async (conversationId) => {
    if (!socket || !currentUser) return;

    const role = currentUser.role === 'admin' ? 'printer' : 'user';

    socket.emit('mark_read', {
      conversationId,
      userId: role === 'user' ? currentUser.id : null,
      printerShopId: role === 'printer' ? currentUser.id : null
    });

    // Also call API to ensure persistence
    try {
      await api.patch('/api/chat/messages/read', {
        conversationId,
        userId: role === 'user' ? currentUser.id : null,
        printerShopId: role === 'printer' ? currentUser.id : null
      });

      // Update local state
      setConversations(prev =>
        prev.map(conv =>
          conv.id === conversationId ? { ...conv, unreadCount: 0 } : conv
        )
      );
    } catch (error) {
      console.error('Error marking messages as read:', error);
    }
  }, [socket, currentUser]);

  // Load unread count
  const loadUnreadCount = useCallback(async () => {
    if (!currentUser) return;

    try {
      const role = currentUser.role === 'admin' ? 'printer' : 'user';
      const params = {
        [role === 'user' ? 'userId' : 'printerShopId']: currentUser.id
      };

      const response = await api.get('/api/chat/messages/unread', { params });
      setUnreadCount(response.data.unreadCount || 0);
    } catch (error) {
      console.error('Error loading unread count:', error);
    }
  }, [currentUser]);

  // Load conversations on mount
  useEffect(() => {
    if (isAuthenticated && currentUser) {
      loadConversations();
      loadUnreadCount();
    }
  }, [isAuthenticated, currentUser, loadConversations, loadUnreadCount]);

  const value = {
    socket,
    conversations,
    activeConversation,
    messages,
    onlineUsers,
    typingUsers,
    unreadCount,
    loading,
    loadConversations,
    getOrCreateConversation,
    loadMessages,
    sendMessage,
    joinConversation,
    leaveConversation,
    sendTyping,
    markMessagesAsRead,
    loadUnreadCount
  };

  return (
    <ChatContext.Provider value={value}>
      {children}
    </ChatContext.Provider>
  );
};
