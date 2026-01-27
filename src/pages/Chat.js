import React, { useState, useEffect } from 'react';
import styled from 'styled-components';
import { useChat } from '../context/ChatContext';
import { useAuth } from '../context/AuthContext';
import { usePrintJob } from '../context/PrintJobContext';
import { FaComments, FaPaperPlane, FaCircle } from 'react-icons/fa';

const ChatPageContainer = styled.div`
  display: flex;
  flex-direction: column;
  gap: 20px;
  height: calc(100vh - 150px);
`;

const PageHeader = styled.div`
  h1 {
    font-size: 28px;
    font-weight: bold;
    color: #2c3e50;
    margin-bottom: 8px;
  }
  
  p {
    color: #7f8c8d;
    font-size: 16px;
  }
`;

const ChatContainer = styled.div`
  display: grid;
  grid-template-columns: 350px 1fr;
  gap: 20px;
  height: 100%;
  background: white;
  border-radius: 12px;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
  overflow: hidden;

  @media (max-width: 1024px) {
    grid-template-columns: ${props => props.showChat ? '0 1fr' : '1fr 0'};
  }

  @media (max-width: 768px) {
    grid-template-columns: 1fr;
  }
`;

const ConversationList = styled.div`
  border-right: 1px solid #e9ecef;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  
  @media (max-width: 1024px) {
    display: ${props => props.hide ? 'none' : 'flex'};
  }
`;

const SearchBar = styled.div`
  padding: 16px;
  border-bottom: 1px solid #e9ecef;
  
  input {
    width: 100%;
    padding: 10px 14px;
    border: 2px solid #e9ecef;
    border-radius: 8px;
    font-size: 14px;
    outline: none;
    
    &:focus {
      border-color: #667eea;
    }
  }
`;

const ConversationItem = styled.div`
  padding: 16px;
  border-bottom: 1px solid #f8f9fa;
  cursor: pointer;
  transition: background 0.2s;
  display: flex;
  align-items: center;
  gap: 12px;
  background: ${props => props.active ? '#f8f9fa' : 'transparent'};

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

const ChatArea = styled.div`
  display: flex;
  flex-direction: column;
  overflow: hidden;
  
  @media (max-width: 1024px) {
    display: ${props => props.hide ? 'none' : 'flex'};
  }
`;

const ChatHeader = styled.div`
  padding: 16px;
  border-bottom: 1px solid #e9ecef;
  display: flex;
  align-items: center;
  justify-content: space-between;

  .header-content {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .shop-name {
    font-weight: 600;
    font-size: 16px;
    color: #2c3e50;
  }

  .shop-status {
    font-size: 13px;
    color: #6c757d;
    display: flex;
    align-items: center;
    gap: 6px;
  }
`;

const MessageArea = styled.div`
  flex: 1;
  overflow-y: auto;
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 12px;
  background: #f8f9fa;

  &::-webkit-scrollbar {
    width: 8px;
  }

  &::-webkit-scrollbar-track {
    background: #f1f1f1;
  }

  &::-webkit-scrollbar-thumb {
    background: #888;
    border-radius: 4px;
  }
`;

const Message = styled.div`
  display: flex;
  flex-direction: column;
  align-items: ${props => props.isOwn ? 'flex-end' : 'flex-start'};
  
  .message-bubble {
    max-width: 60%;
    padding: 12px 16px;
    border-radius: 16px;
    background: ${props => props.isOwn ? 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' : 'white'};
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

const InputArea = styled.div`
  padding: 16px;
  border-top: 1px solid #e9ecef;
  display: flex;
  gap: 12px;
  align-items: center;
  background: white;

  input {
    flex: 1;
    padding: 12px 16px;
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
    width: 48px;
    height: 48px;
    border-radius: 50%;
    border: none;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: white;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    transition: transform 0.2s;
    font-size: 18px;

    &:hover:not(:disabled) {
      transform: scale(1.1);
    }

    &:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }
  }
`;

const EmptyState = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  color: #6c757d;
  padding: 40px;
  text-align: center;

  svg {
    font-size: 64px;
    margin-bottom: 20px;
    opacity: 0.5;
  }

  h3 {
    margin-bottom: 8px;
    color: #2c3e50;
  }

  p {
    margin: 0;
  }
`;

const PrinterSelector = styled.div`
  padding: 20px;
  background: #f8f9fa;
  border-radius: 8px;
  margin-bottom: 20px;

  h3 {
    margin-bottom: 16px;
    color: #2c3e50;
  }

  .printer-list {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
    gap: 12px;
  }

  .printer-item {
    padding: 16px;
    background: white;
    border: 2px solid #e9ecef;
    border-radius: 8px;
    cursor: pointer;
    transition: all 0.2s;

    &:hover {
      border-color: #667eea;
      transform: translateY(-2px);
    }

    .printer-name {
      font-weight: 600;
      color: #2c3e50;
      margin-bottom: 4px;
    }

    .printer-location {
      font-size: 13px;
      color: #6c757d;
    }
  }
`;

const ChatPage = () => {
  const { currentUser } = useAuth();
  const { conversations, messages, activeConversation, loadMessages, sendMessage, joinConversation, getOrCreateConversation, onlineUsers, typingUsers } = useChat();
  const { printers } = usePrintJob();
  const [selectedConversation, setSelectedConversation] = useState(null);
  const [inputMessage, setInputMessage] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [showPrinterSelector, setShowPrinterSelector] = useState(false);

  useEffect(() => {
    if (activeConversation && selectedConversation?.id !== activeConversation.id) {
      setSelectedConversation(activeConversation);
    }
  }, [activeConversation, selectedConversation?.id]);

  const handleSelectConversation = (conv) => {
    setSelectedConversation(conv);
    joinConversation(conv.id);
    loadMessages(conv.id);
  };

  const handleStartNewChat = async (printer) => {
    const conversation = await getOrCreateConversation(printer.id);
    if (conversation) {
      handleSelectConversation(conversation);
      setShowPrinterSelector(false);
    }
  };

  const handleSendMessage = (e) => {
    e.preventDefault();
    if (!inputMessage.trim() || !selectedConversation) return;

    sendMessage(selectedConversation.id, inputMessage.trim());
    setInputMessage('');
  };

  const filteredConversations = conversations.filter(conv =>
    (conv.printerShopName || conv.userName || '').toLowerCase().includes(searchQuery.toLowerCase())
  );

  const conversationMessages = selectedConversation ? messages[selectedConversation.id] || [] : [];
  const isOnline = selectedConversation && onlineUsers.has(selectedConversation.printerShopId);

  const formatTime = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <ChatPageContainer>
      <PageHeader>
        <h1>Messages</h1>
        <p>Chat with printer shops about your print jobs</p>
      </PageHeader>

      {showPrinterSelector && (
        <PrinterSelector>
          <h3>Select a Printer Shop to Chat</h3>
          <div className="printer-list">
            {printers.map(printer => (
              <div key={printer.id} className="printer-item" onClick={() => handleStartNewChat(printer)}>
                <div className="printer-name">{printer.name}</div>
                <div className="printer-location">{printer.location}</div>
              </div>
            ))}
          </div>
        </PrinterSelector>
      )}

      <ChatContainer showChat={!!selectedConversation}>
        <ConversationList hide={!!selectedConversation}>
          <SearchBar>
            <input
              type="text"
              placeholder="Search conversations..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </SearchBar>

          {filteredConversations.length === 0 ? (
            <EmptyState>
              <FaComments />
              <h3>No conversations yet</h3>
              <p>Start a conversation with a printer shop</p>
              <button
                onClick={() => setShowPrinterSelector(true)}
                style={{
                  marginTop: '20px',
                  padding: '12px 24px',
                  background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  fontWeight: '600'
                }}
              >
                Start Chat
              </button>
            </EmptyState>
          ) : (
            <div style={{ overflowY: 'auto' }}>
              {filteredConversations.map(conv => (
                <ConversationItem
                  key={conv.id}
                  active={selectedConversation?.id === conv.id}
                  onClick={() => handleSelectConversation(conv)}
                >
                  <div className="avatar">
                    {(conv.printerShopName || conv.userName || 'U').charAt(0).toUpperCase()}
                  </div>
                  <div className="conv-info">
                    <div className="conv-name">
                      {conv.printerShopName || conv.userName}
                      {conv.printerShopLocation && (
                        <span style={{ fontSize: '12px', color: '#6c757d' }}>· {conv.printerShopLocation}</span>
                      )}
                    </div>
                    <div className="conv-preview">
                      {conv.lastMessageAt
                        ? `Last message: ${new Date(conv.lastMessageAt).toLocaleString()}`
                        : 'No messages yet'}
                    </div>
                  </div>
                  {conv.unreadCount > 0 && <div className="conv-badge">{conv.unreadCount}</div>}
                </ConversationItem>
              ))}
            </div>
          )}
        </ConversationList>

        <ChatArea hide={!selectedConversation}>
          {!selectedConversation ? (
            <EmptyState>
              <FaComments />
              <h3>Select a conversation</h3>
              <p>Choose a conversation from the list to start chatting</p>
            </EmptyState>
          ) : (
            <>
              <ChatHeader>
                <div className="header-content">
                  <div>
                    <div className="shop-name">
                      {selectedConversation.printerShopName || selectedConversation.userName}
                    </div>
                    <div className="shop-status">
                      <FaCircle style={{ fontSize: '8px', color: isOnline ? '#2ecc71' : '#95a5a6' }} />
                      {isOnline ? 'Online' : 'Offline'}
                    </div>
                  </div>
                </div>
              </ChatHeader>

              <MessageArea>
                {conversationMessages.length === 0 ? (
                  <EmptyState>
                    <p>No messages yet. Start the conversation!</p>
                  </EmptyState>
                ) : (
                  conversationMessages.map(msg => {
                    const isOwn = msg.senderId === currentUser.id;
                    return (
                      <Message key={msg.id} isOwn={isOwn}>
                        {!isOwn && (
                          <div className="message-sender">
                            {selectedConversation.printerShopName || selectedConversation.userName}
                          </div>
                        )}
                        <div className="message-bubble">{msg.message}</div>
                        <div className="message-time">{formatTime(msg.createdAt)}</div>
                      </Message>
                    );
                  })
                )}
                {typingUsers[selectedConversation.id] && (
                  <div style={{ fontStyle: 'italic', color: '#6c757d', fontSize: '13px' }}>Typing...</div>
                )}
              </MessageArea>

              <InputArea>
                <form onSubmit={handleSendMessage} style={{ display: 'flex', gap: '12px', width: '100%' }}>
                  <input
                    type="text"
                    placeholder="Type a message..."
                    value={inputMessage}
                    onChange={(e) => setInputMessage(e.target.value)}
                  />
                  <button type="submit" disabled={!inputMessage.trim()}>
                    <FaPaperPlane />
                  </button>
                </form>
              </InputArea>
            </>
          )}
        </ChatArea>
      </ChatContainer>
    </ChatPageContainer>
  );
};

export default ChatPage;
