import React from 'react';
import styled from 'styled-components';
import { SignedIn, SignedOut, SignIn } from '@clerk/clerk-react';
import { 
  FaUser, 
  FaShieldAlt,
  FaPrint,
} from 'react-icons/fa';

const AuthContainer = styled.div`
  min-height: 100vh;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
  
  @media (max-width: 1023px) {
    padding: 15px;
  }
  
  @media (max-width: 767px) {
    padding: 10px;
    align-items: flex-start;
    padding-top: 20px;
  }
`;

const AuthCard = styled.div`
  background: white;
  border-radius: 20px;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.1);
  overflow: hidden;
  width: 100%;
  max-width: 900px;
  display: flex;
  min-height: 600px;
  
  @media (max-width: 767px) {
    flex-direction: column;
    min-height: auto;
    border-radius: 15px;
  }
`;

const LeftPanel = styled.div`
  flex: 1;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  padding: 40px;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  text-align: center;
  
  @media (max-width: 1023px) {
    padding: 30px;
  }
  
  @media (max-width: 767px) {
    padding: 25px 20px;
    text-align: center;
  }
  
  .hero-icon {
    font-size: 80px;
    margin-bottom: 20px;
    opacity: 0.9;
    
    @media (max-width: 1023px) {
      font-size: 60px;
    }
    
    @media (max-width: 767px) {
      font-size: 50px;
      margin-bottom: 15px;
    }
  }
  
  .hero-title {
    font-size: 32px;
    font-weight: bold;
    margin-bottom: 15px;
    
    @media (max-width: 1023px) {
      font-size: 28px;
    }
    
    @media (max-width: 767px) {
      font-size: 24px;
      margin-bottom: 10px;
    }
  }
  
  .hero-subtitle {
    font-size: 16px;
    opacity: 0.9;
    line-height: 1.6;
    max-width: 300px;
    
    @media (max-width: 1023px) {
      font-size: 15px;
      max-width: 100%;
    }
    
    @media (max-width: 767px) {
      font-size: 14px;
    }
  }
  
  .features {
    margin-top: 30px;
    text-align: left;
    
    @media (max-width: 767px) {
      margin-top: 20px;
      text-align: center;
    }
    
    .feature {
      display: flex;
      align-items: center;
      gap: 10px;
      margin-bottom: 15px;
      font-size: 14px;
      
      @media (max-width: 767px) {
        justify-content: center;
        font-size: 13px;
        margin-bottom: 12px;
      }
      
      .feature-icon {
        color: #2ecc71;
        flex-shrink: 0;
      }
    }
  }
`;

const RightPanel = styled.div`
  flex: 1;
  padding: 40px;
  display: flex;
  flex-direction: column;
  justify-content: center;
  
  @media (max-width: 1023px) {
    padding: 30px;
  }
  
  @media (max-width: 767px) {
    padding: 25px 20px;
  }
`;

 

const Authentication = () => {
  return (
    <AuthContainer>
      <AuthCard>
        <LeftPanel>
          <FaShieldAlt className="hero-icon" />
          <h1 className="hero-title">Secure Print Link</h1>
          <p className="hero-subtitle">
            Protect your confidential documents with secure printing technology
          </p>
          
          <div className="features">
            <div className="feature">
              <FaShieldAlt className="feature-icon" />
              <span>Document encryption and secure transmission</span>
            </div>
            <div className="feature">
              <FaPrint className="feature-icon" />
              <span>Hold-and-release printing system</span>
            </div>
            
            <div className="feature">
              <FaUser className="feature-icon" />
              <span>User tracking and audit trails</span>
            </div>
          </div>
        </LeftPanel>

        <RightPanel>
          <SignedOut>
            <div style={{ maxWidth: 420, width: '100%' }}>
              <SignIn />
            </div>
          </SignedOut>
          <SignedIn>
            <div style={{ color: '#667eea', fontWeight: 600 }}>
              Redirecting to your dashboard…
            </div>
          </SignedIn>
        </RightPanel>
      </AuthCard>
    </AuthContainer>
  );
};

export default Authentication;
