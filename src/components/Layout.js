import React, { useState, useEffect } from 'react';
import styled from 'styled-components';
import Header from './Header';
import Sidebar from './Sidebar';

const LayoutContainer = styled.div`
  display: flex;
  min-height: 100vh;
  background: var(--background-light);
`;

const MainContent = styled.main`
  flex: 1;
  padding: 32px;
  padding-top: 96px; /* Header height (64px) + spacing (32px) */
  transition: all var(--transition-normal);
  width: 100%;
  max-width: 1600px;
  margin: 0 auto;
  
  @media (max-width: 768px) {
    padding: 16px;
    padding-top: 80px; /* Header height (64px) + spacing (16px) */
  }
`;

const Layout = ({ children }) => {
  const [sidebarOpen, setSidebarOpen] = useState(true);

  // Check if device is mobile to set initial sidebar state
  useEffect(() => {
    const checkMobile = () => {
      const mobile = window.innerWidth <= 768;
      if (mobile) {
        setSidebarOpen(false); // Start with closed sidebar on mobile
      } else {
        setSidebarOpen(true); // Start with open sidebar on desktop
      }
    };

    checkMobile();
    window.addEventListener('resize', checkMobile);

    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const toggleSidebar = (state) => {
    if (typeof state === 'boolean') {
      setSidebarOpen(state);
    } else {
      setSidebarOpen(!sidebarOpen);
    }
  };

  return (
    <LayoutContainer>
      <Header onMenuToggle={() => toggleSidebar()} />
      <Sidebar isOpen={sidebarOpen} onToggle={toggleSidebar} />
      <MainContent>
        {children}
      </MainContent>
    </LayoutContainer>
  );
};

export default Layout;