import React, { useState, useEffect, useRef, useMemo } from 'react';
import styled from 'styled-components';
import { useChat } from '../context/ChatContext';
import { useAuth } from '../context/AuthContext';
import { FaPaperPlane, FaCircle, FaComments, FaTimes } from 'react-icons/fa';

const ChatContainer = styled.div`
  position: fixed;
  bottom: 20px;
  right: 20px;
  width: 380px;
  max-height: 600px;
  display: flex;
  flex-direction: column;
  background: white;
  border-radius: 12px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
  z-index: 1000;
  overflow: hidden;

  @media (max-width: 768px) {
    width: calc(100vw - 40px);
    max-height: calc(100vh - 100px);
  }
`;

const ChatHeader = styled.div`
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  padding: 16px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  
  .header-content {
    display: flex;
    align-items: center;
    gap: 12px;
    flex: 1;
  }

  .shop-info {
    flex: 1;
    
    .shop-name {
      font-weight: 600;
      font-size: 16px;
    }
    
    .shop-status {
      font-size: 12px;
      opacity: 0.9;
      display: flex;
      align-items: center;
      gap: 6px;
      margin-top: 4px;
    }
  }

  .close-btn {
    background: rgba(255, 255, 255, 0.2);
    border: none;
    color: white;
    width: 32px;
    height: 32px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    transition: background 0.2s;

    &:hover {
      background: rgba(255, 255, 255, 0.3);
    }
  }
`;

const MessageList = styled.div`
  flex: 1;
  overflow-y: auto;
  padding: 16px;
  background: #f8f9fa;
  display: flex;
  flex-direction: column;
  gap: 12px;
  max-height: 400px;

  &::-webkit-scrollbar {
    width: 6px;
  }

  &::-webkit-scrollbar-track {
    background: #f1f1f1;
  }

  &::-webkit-scrollbar-thumb {
    background: #888;
    border-radius: 3px;
  }
`;

const Message = styled.div`
  display: flex;
  flex-direction: column;
  align-items: ${props => props.isOwn ? 'flex-end' : 'flex-start'};
  
  .message-bubble {
    max-width: 70%;
    padding: 10px 14px;
    border-radius: 16px;
    background: ${props => props.isOwn ? 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' : '#e9ecef'};
    color: ${props => props.isOwn ? 'white' : '#2c3e50'};
    word-wrap: break-word;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  }

  .message-time {
    font-size: 11px;
    color: #6c757d;
    margin-top: 4px;
    padding: 0 8px;
  }

  .message-sender {
    font-size: 11px;
    font-weight: 600;
    color: #495057;
    margin-bottom: 4px;
    padding: 0 8px;
  }
`;

const TypingIndicator = styled.div`
  padding: 8px 16px;
  font-size: 13px;
  color: #6c757d;
  font-style: italic;
`;

const InputArea = styled.div`
  padding: 16px;
  border-top: 1px solid #e9ecef;
  display: flex;
  gap: 12px;
  align-items: center;
  background: white;

  input {
    flex: 1;
    padding: 10px 14px;
    border: 2px solid #e9ecef;
    border-radius: 24px;
    font-size: 14px;
    outline: none;
    transition: border-color 0.2s;

    &:focus {
      border-color: #667eea;
    }
  }

  button {
    width: 40px;
    height: 40px;
    border-radius: 50%;
    border: none;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: white;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    transition: transform 0.2s;

    &:hover:not(:disabled) {
      transform: scale(1.1);
    }

    &:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }
  }
`;

const ChatListContainer = styled.div`
  flex: 1;
  overflow-y: auto;
  
  &::-webkit-scrollbar {
    width: 6px;
  }

  &::-webkit-scrollbar-track {
    background: #f1f1f1;
  }

  &::-webkit-scrollbar-thumb {
    background: #888;
    border-radius: 3px;
  }
`;

const ConversationItem = styled.div`
  padding: 16px;
  border-bottom: 1px solid #e9ecef;
  cursor: pointer;
  transition: background 0.2s;
  display: flex;
  align-items: center;
  gap: 12px;

  &:hover {
    background: #f8f9fa;
  }

  .avatar {
    width: 48px;
    height: 48px;
    border-radius: 50%;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    display: flex;
    align-items: center;
    justify-content: center;
    color: white;
    font-weight: 600;
    font-size: 18px;
    flex-shrink: 0;
  }

  .conv-info {
    flex: 1;
    min-width: 0;

    .conv-name {
      font-weight: 600;
      color: #2c3e50;
      margin-bottom: 4px;
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .conv-preview {
      font-size: 13px;
      color: #6c757d;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
  }

  .conv-badge {
    background: #dc3545;
    color: white;
    border-radius: 12px;
    padding: 2px 8px;
    font-size: 12px;
    font-weight: 600;
    min-width: 20px;
    text-align: center;
  }
`;

const EmptyState = styled.div`
  padding: 40px 20px;
  text-align: center;
  color: #6c757d;

  svg {
    font-size: 48px;
    margin-bottom: 16px;
    opacity: 0.5;
  }

  p {
    margin: 0;
  }
`;

const ChatWindow = ({ conversation, onClose }) => {
  const { currentUser } = useAuth();
  const { messages, sendMessage, loadMessages, sendTyping, markMessagesAsRead, typingUsers, onlineUsers } = useChat();
  const [inputMessage, setInputMessage] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef(null);
  const typingTimeoutRef = useRef(null);

  const conversationMessages = useMemo(() => messages[conversation.id] || [], [messages, conversation.id]);
  const isOnline = conversation.printerShopId && onlineUsers.has(conversation.printerShopId);
  const isOtherTyping = typingUsers[conversation.id];

  useEffect(() => {
    loadMessages(conversation.id);
    markMessagesAsRead(conversation.id);
  }, [conversation.id, loadMessages, markMessagesAsRead]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [conversationMessages]);

  const handleInputChange = (e) => {
    setInputMessage(e.target.value);

    // Send typing indicator
    if (!isTyping) {
      setIsTyping(true);
      sendTyping(conversation.id, true);
    }

    // Reset typing timeout
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    typingTimeoutRef.current = setTimeout(() => {
      setIsTyping(false);
      sendTyping(conversation.id, false);
    }, 1000);
  };

  const handleSendMessage = (e) => {
    e.preventDefault();
    if (!inputMessage.trim()) return;

    sendMessage(conversation.id, inputMessage.trim());
    setInputMessage('');
    setIsTyping(false);
    sendTyping(conversation.id, false);

    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
  };

  const formatTime = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <ChatContainer>
      <ChatHeader>
        <div className="header-content">
          <div className="shop-info">
            <div className="shop-name">
              {conversation.printerShopName || conversation.userName || 'Chat'}
            </div>
            <div className="shop-status">
              <FaCircle style={{ fontSize: '8px', color: isOnline ? '#2ecc71' : '#95a5a6' }} />
              {isOnline ? 'Online' : 'Offline'}
            </div>
          </div>
        </div>
        <button className="close-btn" onClick={onClose}>
          <FaTimes />
        </button>
      </ChatHeader>

      <MessageList>
        {conversationMessages.length === 0 ? (
          <EmptyState>
            <FaComments />
            <p>No messages yet. Start the conversation!</p>
          </EmptyState>
        ) : (
          conversationMessages.map((msg) => {
            const isOwn = msg.senderId === currentUser.id;
            return (
              <Message key={msg.id} isOwn={isOwn}>
                {!isOwn && <div className="message-sender">{conversation.printerShopName || conversation.userName}</div>}
                <div className="message-bubble">{msg.message}</div>
                <div className="message-time">{formatTime(msg.createdAt)}</div>
              </Message>
            );
          })
        )}
        {isOtherTyping && <TypingIndicator>Typing...</TypingIndicator>}
        <div ref={messagesEndRef} />
      </MessageList>

      <InputArea>
        <form onSubmit={handleSendMessage} style={{ display: 'flex', gap: '12px', width: '100%' }}>
          <input
            type="text"
            placeholder="Type a message..."
            value={inputMessage}
            onChange={handleInputChange}
            autoFocus
          />
          <button type="submit" disabled={!inputMessage.trim()}>
            <FaPaperPlane />
          </button>
        </form>
      </InputArea>
    </ChatContainer>
  );
};

const ChatList = ({ onSelectConversation, onClose }) => {
  const { conversations, loading } = useChat();

  return (
    <ChatContainer>
      <ChatHeader>
        <div className="header-content">
          <div className="shop-info">
            <div className="shop-name">Messages</div>
            <div className="shop-status">{conversations.length} conversation{conversations.length !== 1 ? 's' : ''}</div>
          </div>
        </div>
        <button className="close-btn" onClick={onClose}>
          <FaTimes />
        </button>
      </ChatHeader>

      <ChatListContainer>
        {loading ? (
          <EmptyState>
            <p>Loading conversations...</p>
          </EmptyState>
        ) : conversations.length === 0 ? (
          <EmptyState>
            <FaComments />
            <p>No conversations yet</p>
          </EmptyState>
        ) : (
          conversations.map((conv) => (
            <ConversationItem key={conv.id} onClick={() => onSelectConversation(conv)}>
              <div className="avatar">
                {(conv.printerShopName || conv.userName || 'U').charAt(0).toUpperCase()}
              </div>
              <div className="conv-info">
                <div className="conv-name">
                  {conv.printerShopName || conv.userName}
                  {conv.printerShopLocation && <span style={{ fontSize: '12px', color: '#6c757d' }}>· {conv.printerShopLocation}</span>}
                </div>
                <div className="conv-preview">
                  {conv.lastMessageAt ? `Last message: ${new Date(conv.lastMessageAt).toLocaleString()}` : 'No messages yet'}
                </div>
              </div>
              {conv.unreadCount > 0 && <div className="conv-badge">{conv.unreadCount}</div>}
            </ConversationItem>
          ))
        )}
      </ChatListContainer>
    </ChatContainer>
  );
};

export { ChatWindow, ChatList };
