import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import styled from 'styled-components';
import { useAuth } from '../context/AuthContext';
import { useUser, useAuth as useClerkAuth } from '@clerk/clerk-react';
import { 
  FaBars, 
  FaUser, 
  FaBell, 
  FaCog, 
  FaSignOutAlt,
  FaPrint,
  FaShieldAlt
} from 'react-icons/fa';

const HeaderContainer = styled.header`
  background: var(--background-card);
  color: var(--text-primary);
  padding: 0 24px;
  height: 64px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  box-shadow: var(--shadow-sm);
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  z-index: 1000;
  border-bottom: 1px solid var(--border-color);
`;

const LeftSection = styled.div`
  display: flex;
  align-items: center;
  gap: 16px;
`;

const MenuButton = styled.button`
  background: transparent;
  border: none;
  color: var(--text-secondary);
  font-size: 20px;
  cursor: pointer;
  padding: 8px;
  border-radius: var(--border-radius-md);
  transition: all var(--transition-fast);
  display: flex;
  align-items: center;
  justify-content: center;
  
  &:hover {
    background-color: var(--background-light);
    color: var(--primary-color);
  }
  
  @media (min-width: 769px) {
    display: none;
  }
`;

const Logo = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
  font-size: 1.25rem;
  font-weight: 700;
  color: var(--text-primary);
  letter-spacing: -0.025em;
  
  .logo-icon {
    font-size: 24px;
    color: var(--primary-color);
  }
  
  @media (max-width: 768px) {
    font-size: 1.125rem;
    margin-left: 40px; /* Account for mobile menu toggle */
    
    .logo-text {
      display: none;
    }
  }
`;

const RightSection = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
`;

const IconButton = styled.button`
  background: transparent;
  border: none;
  color: var(--text-secondary);
  font-size: 18px;
  cursor: pointer;
  padding: 10px;
  border-radius: var(--border-radius-md);
  position: relative;
  transition: all var(--transition-fast);
  display: flex;
  align-items: center;
  justify-content: center;
  
  &:hover {
    background-color: var(--background-light);
    color: var(--primary-color);
  }
  
  .badge {
    position: absolute;
    top: 6px;
    right: 6px;
    background-color: var(--error-color);
    color: white;
    border-radius: 50%;
    width: 16px;
    height: 16px;
    font-size: 10px;
    font-weight: 700;
    display: flex;
    align-items: center;
    justify-content: center;
    border: 2px solid var(--background-card);
  }
`;

const UserSection = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
  position: relative;
  margin-left: 8px;
  padding-left: 16px;
  border-left: 1px solid var(--border-color);
`;

const UserInfo = styled.div`
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  
  .user-name {
    font-weight: 600;
    font-size: 0.875rem;
    color: var(--text-primary);
  }
  
  .user-role {
    font-size: 0.75rem;
    color: var(--text-light);
    text-transform: capitalize;
  }
  
  @media (max-width: 1024px) {
    display: none;
  }
`;

const UserAvatar = styled.button`
  background: var(--background-light);
  border: 2px solid var(--border-color);
  border-radius: var(--border-radius-md);
  width: 40px;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--primary-color);
  font-size: 14px;
  font-weight: 700;
  cursor: pointer;
  transition: all var(--transition-fast);
  
  &:hover {
    border-color: var(--primary-color);
    background: white;
    transform: translateY(-1px);
    box-shadow: var(--shadow-sm);
  }
`;

const DropdownMenu = styled.div`
  position: absolute;
  top: calc(100% + 12px);
  right: 0;
  background: white;
  border-radius: var(--border-radius-lg);
  box-shadow: var(--shadow-xl);
  min-width: 240px;
  padding: 8px;
  z-index: 1000;
  border: 1px solid var(--border-color);
  animation: slideIn 0.2s ease-out;

  @keyframes slideIn {
    from { opacity: 0; transform: translateY(10px); }
    to { opacity: 1; transform: translateY(0); }
  }
  
  @media (max-width: 768px) {
    position: fixed;
    top: 72px;
    right: 16px;
    left: 16px;
    min-width: auto;
  }
`;

const DropdownItem = styled.button`
  width: 100%;
  padding: 10px 12px;
  background: transparent;
  border: none;
  border-radius: var(--border-radius-md);
  text-align: left;
  display: flex;
  align-items: center;
  gap: 12px;
  color: var(--text-secondary);
  font-size: 0.875rem;
  font-weight: 500;
  cursor: pointer;
  transition: all var(--transition-fast);
  
  &:hover {
    background-color: var(--background-light);
    color: var(--primary-color);
  }
  
  &.danger {
    color: var(--error-color);
    margin-top: 4px;
    border-top: 1px solid var(--border-color);
    border-radius: 0 0 var(--border-radius-md) var(--border-radius-md);
    padding-top: 14px;
    
    &:hover {
      background-color: #fef2f2;
    }
  }
`;

const Header = ({ onMenuToggle }) => {
  const { currentUser } = useAuth();
  const { user } = useUser();
  const { signOut } = useClerkAuth();
  const navigate = useNavigate();
  const [showDropdown, setShowDropdown] = useState(false);
  const [notifications] = useState(3); // Mock notification count

  const handleLogout = async () => {
    await signOut();
    navigate('/login');
    setShowDropdown(false);
  };

  const handleProfile = () => {
    navigate('/settings');
    setShowDropdown(false);
  };

  const getInitials = (name) => {
    return name
      .split(' ')
      .map(word => word[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  // Close dropdown when clicking outside
  React.useEffect(() => {
    const handleClickOutside = (event) => {
      if (showDropdown && !event.target.closest('header')) {
        setShowDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showDropdown]);

  return (
    <HeaderContainer>
      <LeftSection>
        <MenuButton onClick={onMenuToggle}>
          <FaBars />
        </MenuButton>
        <Logo>
          <FaShieldAlt className="logo-icon" />
          <span className="logo-text">Secure Print Link</span>
        </Logo>
      </LeftSection>

      <RightSection>
        <IconButton>
          <FaBell />
          {notifications > 0 && (
            <span className="badge">{notifications}</span>
          )}
        </IconButton>

        <UserSection>
          <UserInfo>
            <div className="user-name">{user?.fullName || user?.username || currentUser?.name}</div>
            <div className="user-role">{currentUser?.role}</div>
          </UserInfo>
          
          <UserAvatar onClick={() => setShowDropdown(!showDropdown)}>
            {getInitials((user?.fullName || user?.username || currentUser?.name || 'U'))}
          </UserAvatar>

          {showDropdown && (
            <DropdownMenu>
              <DropdownItem onClick={handleProfile}>
                <FaUser />
                Profile
              </DropdownItem>
              <DropdownItem onClick={() => navigate('/settings')}>
                <FaCog />
                Settings
              </DropdownItem>
              <DropdownItem onClick={() => navigate('/submit-job')}>
                <FaPrint />
                Submit Print Job
              </DropdownItem>
              <DropdownItem onClick={handleLogout} className="danger">
                <FaSignOutAlt />
                Logout
              </DropdownItem>
            </DropdownMenu>
          )}
        </UserSection>
      </RightSection>
    </HeaderContainer>
  );
};

export default Header;
