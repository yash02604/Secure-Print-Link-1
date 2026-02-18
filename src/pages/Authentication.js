import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import styled from 'styled-components';
import { toast } from 'react-toastify';
import { useAuth } from '../context/AuthContext';
import { QRCodeCanvas } from 'qrcode.react';
import { 
  FaUser, 
  FaLock, 
  FaEye, 
  FaEyeSlash, 
  FaShieldAlt,
  FaPrint,
  FaQrcode
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

const AuthTabs = styled.div`
  display: flex;
  margin-bottom: 30px;
  border-bottom: 2px solid #f1f3f4;
  
  @media (max-width: 767px) {
    margin-bottom: 20px;
  }
`;

const TabButton = styled.button`
  flex: 1;
  padding: 15px;
  background: none;
  border: none;
  font-size: 16px;
  font-weight: 500;
  color: ${props => props.active ? '#667eea' : '#666'};
  cursor: pointer;
  border-bottom: 2px solid ${props => props.active ? '#667eea' : 'transparent'};
  transition: all 0.3s ease;
  min-height: 44px; /* Touch-friendly */
  
  @media (max-width: 1023px) {
    padding: 12px;
    font-size: 15px;
  }
  
  @media (max-width: 767px) {
    font-size: 14px;
    padding: 10px;
  }
  
  &:hover {
    color: #667eea;
  }
`;

const Form = styled.form`
  display: flex;
  flex-direction: column;
  gap: 20px;
  
  @media (max-width: 767px) {
    gap: 15px;
  }
`;

const FormGroup = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
  
  @media (max-width: 767px) {
    gap: 6px;
  }
  
  label {
    font-weight: 500;
    color: #333;
    font-size: 14px;
    
    @media (max-width: 767px) {
      font-size: 13px;
    }
  }
`;

const InputWrapper = styled.div`
  position: relative;
  
  .input-icon {
    position: absolute;
    left: 15px;
    top: 50%;
    transform: translateY(-50%);
    color: #999;
    font-size: 16px;
  }
  
  .toggle-password {
    position: absolute;
    right: 15px;
    top: 50%;
    transform: translateY(-50%);
    background: none;
    border: none;
    color: #999;
    cursor: pointer;
    font-size: 16px;
    
    &:hover {
      color: #667eea;
    }
  }
`;

const Input = styled.input`
  width: 100%;
  padding: 15px 15px 15px 45px;
  border: 2px solid #e1e5e9;
  border-radius: 10px;
  font-size: 16px;
  transition: border-color 0.3s ease;
  min-height: 44px; /* Touch-friendly */
  
  @media (max-width: 1023px) {
    padding: 12px 12px 12px 40px;
    font-size: 15px;
  }
  
  @media (max-width: 767px) {
    padding: 12px 12px 12px 35px;
    font-size: 16px; /* Keep readable on mobile */
    border-radius: 8px;
  }
  
  &:focus {
    outline: none;
    border-color: #667eea;
  }
  
  &::placeholder {
    color: #999;
  }
`;

const PinInput = styled.div`
  display: flex;
  gap: 10px;
  justify-content: center;
  
  @media (max-width: 767px) {
    gap: 8px;
  }
  
  input {
    width: 60px;
    height: 60px;
    border: 2px solid #e1e5e9;
    border-radius: 10px;
    text-align: center;
    font-size: 24px;
    font-weight: bold;
    transition: border-color 0.3s ease;
    min-width: 44px; /* Touch-friendly */
    min-height: 44px;
    
    @media (max-width: 1023px) {
      width: 50px;
      height: 50px;
      font-size: 20px;
    }
    
    @media (max-width: 767px) {
      width: 15vw;
      height: 15vw;
      max-width: 60px;
      max-height: 60px;
      min-width: 44px;
      min-height: 44px;
      font-size: 6vw;
      max-font-size: 24px;
    }
    
    &:focus {
      outline: none;
      border-color: #667eea;
    }
  }
`;

const LoginButton = styled.button`
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  border: none;
  padding: 15px;
  border-radius: 10px;
  font-size: 16px;
  font-weight: 600;
  cursor: pointer;
  transition: transform 0.2s ease;
  min-height: 44px; /* Touch-friendly */
  width: 100%;
  
  @media (max-width: 1023px) {
    padding: 12px;
    font-size: 15px;
  }
  
  @media (max-width: 767px) {
    padding: 14px;
    font-size: 16px;
    border-radius: 8px;
  }
  
  &:hover {
    transform: translateY(-2px);
  }
  
  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
    transform: none;
  }
`;

const QRCodeSection = styled.div`
  text-align: center;
  padding: 20px;
  border: 2px dashed #e1e5e9;
  border-radius: 10px;
  margin-top: 20px;
  
  @media (max-width: 767px) {
    padding: 15px;
    margin-top: 15px;
  }
  
  .qr-title {
    font-size: 16px;
    font-weight: 500;
    margin-bottom: 15px;
    color: #333;
    
    @media (max-width: 767px) {
      font-size: 15px;
      margin-bottom: 12px;
    }
  }
  
  .qr-code {
    margin: 0 auto;
    padding: 20px;
    background: white;
    border-radius: 10px;
    display: inline-block;
    
    @media (max-width: 767px) {
      padding: 15px;
      max-width: 100%;
    }
    
    canvas {
      max-width: 100%;
      height: auto !important;
      
      @media (max-width: 767px) {
        width: 60vw !important;
        height: 60vw !important;
        max-width: 200px !important;
        max-height: 200px !important;
      }
    }
  }
  
  .qr-instructions {
    margin-top: 15px;
    font-size: 14px;
    color: #666;
    line-height: 1.5;
    
    @media (max-width: 767px) {
      font-size: 13px;
      margin-top: 12px;
    }
  }
`;

const DemoCredentials = styled.div`
  margin-top: 20px;
  padding: 15px;
  background: #f8f9fa;
  border-radius: 10px;
  border-left: 4px solid #667eea;
  
  @media (max-width: 767px) {
    margin-top: 15px;
    padding: 12px;
  }
  
  .demo-title {
    font-weight: 600;
    color: #333;
    margin-bottom: 10px;
    font-size: 14px;
    
    @media (max-width: 767px) {
      font-size: 13px;
      margin-bottom: 8px;
    }
  }
  
  .demo-item {
    font-size: 14px;
    color: #666;
    margin-bottom: 5px;
    
    @media (max-width: 767px) {
      font-size: 12px;
      margin-bottom: 4px;
      line-height: 1.4;
    }
    
    strong {
      color: #333;
    }
  }
`;

const Authentication = () => {
  const navigate = useNavigate();
  const { login, loginWithPin, signup, loginWithGoogle } = useAuth();
  const [activeTab, setActiveTab] = useState('credentials');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  
  // Credentials form
  const [credentials, setCredentials] = useState({
    username: '',
    password: ''
  });
  
  // PIN form
  const [pin, setPin] = useState(['', '', '', '']);
  const [pinInputs, setPinInputs] = useState([null, null, null, null]);

  // QR Code data
  const qrData = JSON.stringify({
    type: 'secure-print-auth',
    timestamp: Date.now(),
    sessionId: Math.random().toString(36).substr(2, 9)
  });

  // Sign Up form
  const [signUpData, setSignUpData] = useState({
    name: '',
    email: '',
    username: '',
    password: ''
  });

  // Google Sign-In
  const [googleReady, setGoogleReady] = useState(false);
  const googleBtnRef = React.useRef(null);

  React.useEffect(() => {
    const clientId = process.env.REACT_APP_GOOGLE_CLIENT_ID;
    if (!clientId) return;
    // Load Google Identity Services script
    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    script.onload = () => {
      setGoogleReady(true);
      // Initialize and render button
      /* global google */
      if (window.google && google.accounts && google.accounts.id) {
        google.accounts.id.initialize({
          client_id: clientId,
          callback: async (response) => {
            const idToken = response.credential;
            try {
              setLoading(true);
              await loginWithGoogle(idToken);
              toast.success('Login successful!');
              navigate('/');
            } catch (error) {
              toast.error(error.message);
            } finally {
              setLoading(false);
            }
          }
        });
        if (googleBtnRef.current) {
          google.accounts.id.renderButton(googleBtnRef.current, {
            theme: 'outline',
            size: 'large',
            type: 'standard',
            shape: 'rectangular',
            text: 'signin_with',
          });
        }
      }
    };
    document.head.appendChild(script);
    return () => {
      // Cleanup script and disable auto prompt if needed
      if (window.google && google.accounts && google.accounts.id) {
        try { google.accounts.id.cancel(); } catch (_) {}
      }
      document.head.removeChild(script);
    };
  }, [loginWithGoogle, navigate]);

  const handleCredentialsSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    
    try {
      await login(credentials.username, credentials.password);
      toast.success('Login successful!');
      navigate('/');
    } catch (error) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  const handlePinSubmit = async (e) => {
    e.preventDefault();
    const pinString = pin.join('');
    
    if (pinString.length !== 4) {
      toast.error('Please enter a 4-digit PIN');
      return;
    }
    
    setLoading(true);
    
    try {
      await loginWithPin(pinString);
      toast.success('Login successful!');
      navigate('/');
    } catch (error) {
      toast.error(error.message);
      setPin(['', '', '', '']);
    } finally {
      setLoading(false);
    }
  };

  const handlePinChange = (index, value) => {
    if (value.length > 1) return;
    
    const newPin = [...pin];
    newPin[index] = value;
    setPin(newPin);
    
    // Auto-focus next input
    if (value && index < 3) {
      pinInputs[index + 1]?.focus();
    }
  };

  const handleKeyDown = (index, e) => {
    if (e.key === 'Backspace' && !pin[index] && index > 0) {
      pinInputs[index - 1]?.focus();
    }
  };

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
              <FaQrcode className="feature-icon" />
              <span>Multiple authentication methods</span>
            </div>
            <div className="feature">
              <FaUser className="feature-icon" />
              <span>User tracking and audit trails</span>
            </div>
          </div>
        </LeftPanel>

        <RightPanel>
          <AuthTabs>
            <TabButton 
              active={activeTab === 'credentials'} 
              onClick={() => setActiveTab('credentials')}
            >
              Username & Password
            </TabButton>
            <TabButton 
              active={activeTab === 'pin'} 
              onClick={() => setActiveTab('pin')}
            >
              PIN Code
            </TabButton>
            <TabButton 
              active={activeTab === 'qr'} 
              onClick={() => setActiveTab('qr')}
            >
              QR Code
            </TabButton>
            <TabButton 
              active={activeTab === 'signup'} 
              onClick={() => setActiveTab('signup')}
            >
              Sign Up
            </TabButton>
            <TabButton 
              active={activeTab === 'google'} 
              onClick={() => setActiveTab('google')}
            >
              Google
            </TabButton>
          </AuthTabs>

          {activeTab === 'credentials' && (
            <Form onSubmit={handleCredentialsSubmit}>
              <FormGroup>
                <label>Username</label>
                <InputWrapper>
                  <FaUser className="input-icon" />
                  <Input
                    type="text"
                    placeholder="Enter your username"
                    value={credentials.username}
                    onChange={(e) => setCredentials(prev => ({ ...prev, username: e.target.value }))}
                    required
                  />
                </InputWrapper>
              </FormGroup>

              <FormGroup>
                <label>Password</label>
                <InputWrapper>
                  <FaLock className="input-icon" />
                  <Input
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Enter your password"
                    value={credentials.password}
                    onChange={(e) => setCredentials(prev => ({ ...prev, password: e.target.value }))}
                    required
                  />
                  <button
                    type="button"
                    className="toggle-password"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? <FaEyeSlash /> : <FaEye />}
                  </button>
                </InputWrapper>
              </FormGroup>

              <LoginButton type="submit" disabled={loading}>
                {loading ? 'Signing In...' : 'Sign In'}
              </LoginButton>
            </Form>
          )}

          {activeTab === 'pin' && (
            <Form onSubmit={handlePinSubmit}>
              <FormGroup>
                <label>Enter your 4-digit PIN</label>
                <PinInput>
                  {pin.map((digit, index) => (
                    <input
                      key={index}
                      type="text"
                      maxLength="1"
                      value={digit}
                      onChange={(e) => handlePinChange(index, e.target.value)}
                      onKeyDown={(e) => handleKeyDown(index, e)}
                      ref={(el) => setPinInputs(prev => { prev[index] = el; return prev; })}
                      autoFocus={index === 0}
                    />
                  ))}
                </PinInput>
              </FormGroup>

              <LoginButton type="submit" disabled={loading}>
                {loading ? 'Signing In...' : 'Sign In with PIN'}
              </LoginButton>
            </Form>
          )}

          {activeTab === 'qr' && (
            <div>
              <QRCodeSection>
                <div className="qr-title">Scan QR Code with Mobile App</div>
                <div className="qr-code">
                  <QRCodeCanvas value={qrData} size={200} />
                </div>
                <div className="qr-instructions">
                  Open the Secure Print Link mobile app and scan this QR code to authenticate automatically.
                </div>
              </QRCodeSection>
            </div>
          )}

          {activeTab === 'signup' && (
            <Form onSubmit={async (e) => {
              e.preventDefault();
              setLoading(true);
              try {
                await signup(signUpData);
                toast.success('Account created! Signed in securely.');
                navigate('/');
              } catch (error) {
                toast.error(error.message);
              } finally {
                setLoading(false);
              }
            }}>
              <FormGroup>
                <label>Name</label>
                <InputWrapper>
                  <FaUser className="input-icon" />
                  <Input
                    type="text"
                    placeholder="Enter your name"
                    value={signUpData.name}
                    onChange={(e) => setSignUpData(prev => ({ ...prev, name: e.target.value }))}
                    required
                  />
                </InputWrapper>
              </FormGroup>
              <FormGroup>
                <label>Email</label>
                <InputWrapper>
                  <FaUser className="input-icon" />
                  <Input
                    type="email"
                    placeholder="Enter your email"
                    value={signUpData.email}
                    onChange={(e) => setSignUpData(prev => ({ ...prev, email: e.target.value }))}
                    required
                  />
                </InputWrapper>
              </FormGroup>
              <FormGroup>
                <label>Username</label>
                <InputWrapper>
                  <FaUser className="input-icon" />
                  <Input
                    type="text"
                    placeholder="Choose a username"
                    value={signUpData.username}
                    onChange={(e) => setSignUpData(prev => ({ ...prev, username: e.target.value }))}
                    required
                  />
                </InputWrapper>
              </FormGroup>
              <FormGroup>
                <label>Password</label>
                <InputWrapper>
                  <FaLock className="input-icon" />
                  <Input
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Create a password"
                    value={signUpData.password}
                    onChange={(e) => setSignUpData(prev => ({ ...prev, password: e.target.value }))}
                    required
                  />
                  <button
                    type="button"
                    className="toggle-password"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? <FaEyeSlash /> : <FaEye />}
                  </button>
                </InputWrapper>
              </FormGroup>
              <LoginButton type="submit" disabled={loading}>
                {loading ? 'Creating Account...' : 'Sign Up'}
              </LoginButton>
            </Form>
          )}

          {activeTab === 'google' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div ref={googleBtnRef} />
              {!googleReady && (
                <div style={{ color: '#666', fontSize: '14px' }}>
                  Google Sign‑In requires configuration. Set REACT_APP_GOOGLE_CLIENT_ID in your environment.
                </div>
              )}
            </div>
          )}

          <DemoCredentials>
            <div className="demo-title">Demo Credentials:</div>
            <div className="demo-item">
              <strong>Admin:</strong> username: admin, password: admin123, PIN: 1234
            </div>
            <div className="demo-item">
              <strong>User 1:</strong> username: user1, password: user123, PIN: 5678
            </div>
            <div className="demo-item">
              <strong>User 2:</strong> username: user2, password: user123, PIN: 9012
            </div>
          </DemoCredentials>
        </RightPanel>
      </AuthCard>
    </AuthContainer>
  );
};

export default Authentication;
