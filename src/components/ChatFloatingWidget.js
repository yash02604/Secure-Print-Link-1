import React, { useState } from 'react';
import styled from 'styled-components';
import { useChat } from '../context/ChatContext';
import { ChatWindow, ChatList } from './Chat';
import { FaComments } from 'react-icons/fa';

const FloatingButton = styled.button`
  position: fixed;
  bottom: 20px;
  right: 20px;
  width: 60px;
  height: 60px;
  border-radius: 50%;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  border: none;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 24px;
  transition: transform 0.2s, box-shadow 0.2s;
  z-index: 999;

  &:hover {
    transform: scale(1.1);
    box-shadow: 0 6px 16px rgba(0, 0, 0, 0.2);
  }

  .unread-badge {
    position: absolute;
    top: -5px;
    right: -5px;
    background: #dc3545;
    color: white;
    border-radius: 12px;
    padding: 2px 6px;
    font-size: 12px;
    font-weight: 600;
    min-width: 20px;
    text-align: center;
    border: 2px solid white;
  }
`;

const ChatFloatingWidget = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedConversation, setSelectedConversation] = useState(null);
  const { unreadCount } = useChat();

  const handleToggle = () => {
    setIsOpen(!isOpen);
    if (!isOpen) {
      setSelectedConversation(null);
    }
  };

  const handleSelectConversation = (conversation) => {
    setSelectedConversation(conversation);
  };

  const handleCloseChat = () => {
    setSelectedConversation(null);
    setIsOpen(false);
  };

  return (
    <>
      {!isOpen && (
        <FloatingButton onClick={handleToggle}>
          <FaComments />
          {unreadCount > 0 && <span className="unread-badge">{unreadCount}</span>}
        </FloatingButton>
      )}

      {isOpen && !selectedConversation && (
        <ChatList
          onSelectConversation={handleSelectConversation}
          onClose={handleToggle}
        />
      )}

      {isOpen && selectedConversation && (
        <ChatWindow
          conversation={selectedConversation}
          onClose={handleCloseChat}
        />
      )}
    </>
  );
};

export default ChatFloatingWidget;
