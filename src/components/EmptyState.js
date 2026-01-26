import React from 'react';
import styled from 'styled-components';
import { 
  FaFileAlt, 
  FaClock, 
  FaExclamationTriangle, 
  FaSearch,
  FaPrint,
  FaUser
} from 'react-icons/fa';

const EmptyStateContainer = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 64px 24px;
  text-align: center;
  color: var(--text-secondary);
  background: var(--background-card);
  border-radius: var(--border-radius-lg);
  border: 1px dashed var(--border-color);
  width: 100%;
`;

const IconWrapper = styled.div`
  font-size: 56px;
  margin-bottom: 24px;
  color: ${props => props.color || 'var(--text-light)'};
  opacity: 0.8;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 96px;
  height: 96px;
  background: ${props => props.color || 'var(--primary-color)'}10;
  border-radius: 50%;
`;

const Title = styled.h3`
  font-size: var(--font-size-xl);
  font-weight: 700;
  margin-bottom: 12px;
  color: var(--text-primary);
  letter-spacing: -0.01em;
`;

const Description = styled.p`
  font-size: var(--font-size-md);
  line-height: 1.6;
  max-width: 440px;
  margin-bottom: 32px;
  color: var(--text-secondary);
`;

const ActionButton = styled.button`
  background: var(--primary-color);
  color: white;
  border: none;
  padding: 12px 28px;
  border-radius: var(--border-radius-md);
  font-size: var(--font-size-sm);
  font-weight: 600;
  cursor: pointer;
  transition: all var(--transition-fast);
  display: inline-flex;
  align-items: center;
  gap: 10px;
  box-shadow: var(--shadow-md);
  
  &:hover {
    background: var(--primary-hover);
    transform: translateY(-2px);
    box-shadow: var(--shadow-lg);
  }
  
  &:active {
    transform: translateY(0);
  }
`;

const getIconAndColor = (type) => {
  switch (type) {
    case 'jobs':
      return { icon: <FaFileAlt />, color: 'var(--primary-color)' };
    case 'expired':
      return { icon: <FaClock />, color: 'var(--warning-color)' };
    case 'error':
      return { icon: <FaExclamationTriangle />, color: 'var(--error-color)' };
    case 'search':
      return { icon: <FaSearch />, color: 'var(--text-light)' };
    case 'print':
      return { icon: <FaPrint />, color: 'var(--success-color)' };
    case 'users':
      return { icon: <FaUser />, color: '#8b5cf6' };
    default:
      return { icon: <FaFileAlt />, color: 'var(--text-light)' };
  }
};

const EmptyState = ({ 
  type = 'default', 
  title, 
  description, 
  action,
  actionText,
  onAction 
}) => {
  const { icon, color } = getIconAndColor(type);
  
  const defaultContent = {
    jobs: {
      title: 'No print jobs found',
      description: 'Submit your first print job to get started. Your documents will appear here once submitted.'
    },
    expired: {
      title: 'All jobs expired',
      description: 'Your print jobs have expired and been automatically deleted for security.'
    },
    error: {
      title: 'Something went wrong',
      description: 'We encountered an error while loading your data. Please try again.'
    },
    search: {
      title: 'No results found',
      description: 'Try adjusting your search terms or filters to find what you\'re looking for.'
    },
    print: {
      title: 'No print activity',
      description: 'There\'s no print activity to show yet. Submit a job to see it here.'
    },
    users: {
      title: 'No users found',
      description: 'There are no users to display. Add new users to manage access.'
    }
  };

  const content = defaultContent[type] || {
    title: title || 'No data available',
    description: description || 'There\'s nothing to show here.'
  };

  return (
    <EmptyStateContainer>
      <IconWrapper color={color}>
        {icon}
      </IconWrapper>
      <Title>{content.title}</Title>
      <Description>{content.description}</Description>
      {action && onAction && (
        <ActionButton onClick={onAction}>
          {actionText || 'Get Started'}
        </ActionButton>
      )}
    </EmptyStateContainer>
  );
};

export default EmptyState;