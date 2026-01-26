import React, { useState, useEffect } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import styled from 'styled-components';
import { useAuth } from '../context/AuthContext';
import { 
  FaHome, 
  FaPrint, 
  FaList, 
  FaServer, 
  FaUsers, 
  FaQrcode, 
  FaChartBar, 
  FaCog,
  FaChevronLeft,
  FaChevronRight,
  FaBars,
  FaTimes
} from 'react-icons/fa';

const SidebarContainer = styled.aside`
  background: var(--secondary-color);
  color: white;
  width: ${props => props.isOpen ? '260px' : '80px'};
  height: 100vh;
  transition: all var(--transition-normal);
  overflow: hidden;
  position: sticky;
  top: 0;
  display: flex;
  flex-direction: column;
  box-shadow: var(--shadow-lg);
  z-index: 900;
  
  @media (max-width: 768px) {
    position: fixed;
    top: 0;
    left: ${props => props.isOpen ? '0' : '-260px'};
    width: 260px;
    height: 100vh;
    z-index: 1000;
  }
`;

const Overlay = styled.div`
  display: none;
  
  @media (max-width: 768px) {
    display: ${props => props.isOpen ? 'block' : 'none'};
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(15, 23, 42, 0.5);
    backdrop-filter: blur(4px);
    z-index: 999;
  }
`;

const ToggleButton = styled.button`
  position: absolute;
  top: 24px;
  right: 12px;
  background: rgba(255, 255, 255, 0.1);
  border: none;
  color: white;
  width: 32px;
  height: 32px;
  border-radius: var(--border-radius-md);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  z-index: 10;
  transition: all var(--transition-fast);
  
  &:hover {
    background: rgba(255, 255, 255, 0.2);
    transform: scale(1.05);
  }
  
  @media (max-width: 768px) {
    display: none;
  }
`;

const MobileToggleButton = styled.button`
  display: none;
  position: fixed;
  top: 12px;
  left: 12px;
  background: var(--primary-color);
  border: none;
  color: white;
  width: 40px;
  height: 40px;
  border-radius: var(--border-radius-md);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  z-index: 1001;
  box-shadow: var(--shadow-md);
  transition: all var(--transition-fast);
  
  &:hover {
    background: var(--primary-hover);
    transform: scale(1.05);
  }
  
  @media (max-width: 768px) {
    display: flex;
  }
`;

const CloseButton = styled.button`
  display: none;
  position: absolute;
  top: 20px;
  right: 20px;
  background: transparent;
  border: none;
  color: white;
  width: 32px;
  height: 32px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  z-index: 10;
  transition: background-color var(--transition-fast);
  
  &:hover {
    background: rgba(255, 255, 255, 0.1);
  }
  
  @media (max-width: 768px) {
    display: flex;
  }
`;

const LogoSection = styled.div`
  padding: 32px 24px;
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 8px;
  
  .logo-icon {
    font-size: 28px;
    color: var(--primary-color);
    flex-shrink: 0;
  }
  
  .logo-text {
    font-size: 1.25rem;
    font-weight: 700;
    white-space: nowrap;
    letter-spacing: -0.025em;
    opacity: ${props => props.isOpen ? '1' : '0'};
    transition: opacity var(--transition-normal);
  }
  
  @media (max-width: 768px) {
    .logo-text {
      opacity: 1;
    }
  }
`;

const NavMenu = styled.nav`
  padding: 0 12px;
  flex: 1;
  overflow-y: auto;
  
  &::-webkit-scrollbar {
    width: 4px;
  }
  
  &::-webkit-scrollbar-track {
    background: transparent;
  }
  
  &::-webkit-scrollbar-thumb {
    background: rgba(255, 255, 255, 0.1);
    border-radius: 2px;
  }
`;

const NavSection = styled.div`
  margin-bottom: 24px;
  
  .section-title {
    padding: 0 16px 12px;
    font-size: 0.75rem;
    text-transform: uppercase;
    color: var(--text-light);
    font-weight: 600;
    letter-spacing: 0.05em;
    opacity: ${props => props.isOpen ? '1' : '0'};
    transition: opacity var(--transition-normal);
  }
  
  @media (max-width: 768px) {
    .section-title {
      opacity: 1;
    }
  }
`;

const NavItem = styled(NavLink)`
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 16px;
  color: var(--text-light);
  text-decoration: none;
  border-radius: var(--border-radius-md);
  transition: all var(--transition-fast);
  margin-bottom: 4px;
  white-space: nowrap;
  
  &:hover {
    background: rgba(255, 255, 255, 0.05);
    color: white;
  }
  
  &.active {
    background: var(--primary-color);
    color: white;
    box-shadow: var(--shadow-md);
  }
  
  .nav-icon {
    font-size: 20px;
    min-width: 20px;
    text-align: center;
    flex-shrink: 0;
  }
  
  .nav-text {
    font-size: 0.9375rem;
    font-weight: 500;
    opacity: ${props => props.isOpen ? '1' : '0'};
    transition: opacity var(--transition-normal);
  }
  
  @media (max-width: 768px) {
    .nav-text {
      opacity: 1;
    }
  }
`;

const UserSection = styled.div`
  padding: 20px;
  border-top: 1px solid rgba(255, 255, 255, 0.1);
  background: rgba(0, 0, 0, 0.1);
  
  .user-info {
    display: flex;
    align-items: center;
    gap: 12px;
  }
  
  .user-avatar {
    width: 40px;
    height: 40px;
    border-radius: var(--border-radius-md);
    background: var(--primary-color);
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 16px;
    font-weight: 600;
    flex-shrink: 0;
    box-shadow: var(--shadow-sm);
  }
  
  .user-details {
    opacity: ${props => props.isOpen ? '1' : '0'};
    transition: opacity var(--transition-normal);
    min-width: 0;
    overflow: hidden;
  }
  
  .user-name {
    font-size: 0.875rem;
    font-weight: 600;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    color: white;
  }
  
  .user-role {
    font-size: 0.75rem;
    color: var(--text-light);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    text-transform: capitalize;
  }
  
  @media (max-width: 768px) {
    .user-details {
      opacity: 1;
    }
  }
`;

const Sidebar = ({ isOpen, onToggle }) => {
  const { currentUser } = useAuth();
  const location = useLocation();
  const [isMobile, setIsMobile] = useState(false);

  const getInitials = (name) => {
    return name
      ?.split(' ')
      .map(word => word[0])
      .join('')
      .toUpperCase()
      .slice(0, 2) || 'U';
  };

  const navItems = [
    {
      title: 'Main',
      items: [
        { path: '/dashboard', icon: FaHome, text: 'Dashboard' },
        { path: '/submit-job', icon: FaPrint, text: 'Submit Print Job' },
        { path: '/print-job-queue', icon: FaList, text: 'Print Job Queue' },
      ]
    },
    {
      title: 'Management',
      items: [
        { path: '/printer-management', icon: FaServer, text: 'Printer Management' },
        { path: '/user-management', icon: FaUsers, text: 'User Management' },
        { path: '/print-release', icon: FaQrcode, text: 'Print Release' },
      ]
    },
    {
      title: 'Analytics',
      items: [
        { path: '/reports', icon: FaChartBar, text: 'Reports & Analytics' },
        { path: '/settings', icon: FaCog, text: 'Settings' },
      ]
    }
  ];

  // Filter items based on user role
  const filteredNavItems = navItems.map(section => ({
    ...section,
    items: section.items.filter(item => {
      if (item.path === '/users' && currentUser?.role !== 'admin') {
        return false;
      }
      return true;
    })
  })).filter(section => section.items.length > 0);

  // Check if device is mobile
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth <= 768);
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
    
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Close sidebar when navigating on mobile
  useEffect(() => {
    if (isMobile && isOpen) {
      onToggle(false);
    }
  }, [location, isMobile, isOpen, onToggle]);

  const handleOverlayClick = () => {
    if (isMobile) {
      onToggle(false);
    }
  };

  return (
    <>
      <MobileToggleButton onClick={() => onToggle(true)}>
        <FaBars />
      </MobileToggleButton>
      
      <Overlay isOpen={isOpen && isMobile} onClick={handleOverlayClick} />
      
      <SidebarContainer isOpen={isOpen} isMobile={isMobile}>
        <ToggleButton isOpen={isOpen} onClick={() => onToggle(!isOpen)}>
          {isOpen ? <FaChevronLeft /> : <FaChevronRight />}
        </ToggleButton>
        
        <CloseButton onClick={() => onToggle(false)}>
          <FaTimes />
        </CloseButton>

        <LogoSection isOpen={isOpen}>
          <FaPrint className="logo-icon" />
          <span className="logo-text">Secure Print</span>
        </LogoSection>

        <NavMenu>
          {filteredNavItems.map((section, index) => (
            <NavSection key={index} isOpen={isOpen}>
              <div className="section-title">{section.title}</div>
              {section.items.map((item, itemIndex) => (
                <NavItem
                  key={itemIndex}
                  to={item.path}
                  isOpen={isOpen}
                  end={item.path === '/'}
                >
                  <item.icon className="nav-icon" />
                  <span className="nav-text">{item.text}</span>
                </NavItem>
              ))}
            </NavSection>
          ))}
        </NavMenu>

        <UserSection isOpen={isOpen}>
          <div className="user-info">
            <div className="user-avatar">
              {getInitials(currentUser?.name)}
            </div>
            <div className="user-details">
              <div className="user-name">{currentUser?.name}</div>
              <div className="user-role">{currentUser?.role}</div>
            </div>
          </div>
        </UserSection>
      </SidebarContainer>
    </>
  );
};

export default Sidebar;