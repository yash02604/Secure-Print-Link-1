import React, { useState } from 'react';
import styled from 'styled-components';
import { useAuth } from '../context/AuthContext';
import { FaUser, FaShieldAlt, FaBell, FaCog, FaSave } from 'react-icons/fa';

const SettingsContainer = styled.div`
  padding: 20px;
  max-width: 800px;
  margin: 0 auto;
`;

const PageHeader = styled.div`
  margin-bottom: 30px;
  
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

const SettingsSection = styled.div`
  background: white;
  border-radius: 12px;
  padding: 24px;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
  margin-bottom: 20px;
  
  .section-header {
    display: flex;
    align-items: center;
    gap: 12px;
    margin-bottom: 20px;
    
    .section-icon {
      width: 40px;
      height: 40px;
      border-radius: 8px;
      background: #3498db20;
      display: flex;
      align-items: center;
      justify-content: center;
      color: #3498db;
      font-size: 18px;
    }
    
    .section-title {
      font-size: 18px;
      font-weight: 600;
      color: #2c3e50;
    }
  }
`;

const FormGroup = styled.div`
  margin-bottom: 20px;
  
  label {
    display: block;
    font-weight: 500;
    color: #333;
    margin-bottom: 8px;
  }
  
  input, select, textarea {
    width: 100%;
    padding: 12px;
    border: 2px solid #e1e5e9;
    border-radius: 8px;
    font-size: 14px;
    transition: border-color 0.3s ease;
    
    &:focus {
      outline: none;
      border-color: #3498db;
    }
  }
  
  textarea {
    resize: vertical;
    min-height: 100px;
  }
`;

const CheckboxGroup = styled.div`
  display: flex;
  flex-direction: column;
  gap: 12px;
  
  .checkbox-item {
    display: flex;
    align-items: center;
    gap: 10px;
    
    input[type="checkbox"] {
      width: 18px;
      height: 18px;
      accent-color: #3498db;
    }
    
    label {
      font-size: 14px;
      color: #333;
      cursor: pointer;
      margin: 0;
    }
  }
`;

const SaveButton = styled.button`
  background: #3498db;
  color: white;
  border: none;
  padding: 12px 24px;
  border-radius: 8px;
  font-weight: 500;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 8px;
  transition: background-color 0.2s ease;
  
  &:hover {
    background: #2980b9;
  }
`;

const Settings = () => {
  const { currentUser } = useAuth();
  const [settings, setSettings] = useState({
    name: currentUser?.name || '',
    email: currentUser?.email || '',
    department: currentUser?.department || '',
    notifications: {
      email: true,
      push: false,
      sms: false
    },
    security: {
      twoFactor: false,
      sessionTimeout: 30,
      requirePin: true
    },
    preferences: {
      defaultPrinter: '',
      defaultCopies: 1,
      defaultColor: false,
      defaultDuplex: true
    }
  });

  const handleSave = () => {
    // In a real app, this would save to the backend
    console.log('Settings saved:', settings);
  };

  return (
    <SettingsContainer>
      <PageHeader>
        <h1>Settings</h1>
        <p>Manage your account preferences and system settings</p>
      </PageHeader>

      <SettingsSection>
        <div className="section-header">
          <FaUser className="section-icon" />
          <div className="section-title">Profile Information</div>
        </div>
        
        <FormGroup>
          <label>Full Name</label>
          <input
            type="text"
            value={settings.name}
            onChange={(e) => setSettings(prev => ({ ...prev, name: e.target.value }))}
          />
        </FormGroup>
        
        <FormGroup>
          <label>Email Address</label>
          <input
            type="email"
            value={settings.email}
            onChange={(e) => setSettings(prev => ({ ...prev, email: e.target.value }))}
          />
        </FormGroup>
        
        <FormGroup>
          <label>Department</label>
          <select
            value={settings.department}
            onChange={(e) => setSettings(prev => ({ ...prev, department: e.target.value }))}
          >
            <option value="">Select Department</option>
            <option value="IT">IT</option>
            <option value="Sales">Sales</option>
            <option value="Marketing">Marketing</option>
            <option value="HR">HR</option>
            <option value="Finance">Finance</option>
          </select>
        </FormGroup>
      </SettingsSection>

      <SettingsSection>
        <div className="section-header">
          <FaBell className="section-icon" />
          <div className="section-title">Notifications</div>
        </div>
        
        <CheckboxGroup>
          <div className="checkbox-item">
            <input
              type="checkbox"
              id="email-notifications"
              checked={settings.notifications.email}
              onChange={(e) => setSettings(prev => ({
                ...prev,
                notifications: { ...prev.notifications, email: e.target.checked }
              }))}
            />
            <label htmlFor="email-notifications">Email notifications for print job status</label>
          </div>
          
          <div className="checkbox-item">
            <input
              type="checkbox"
              id="push-notifications"
              checked={settings.notifications.push}
              onChange={(e) => setSettings(prev => ({
                ...prev,
                notifications: { ...prev.notifications, push: e.target.checked }
              }))}
            />
            <label htmlFor="push-notifications">Push notifications (mobile app)</label>
          </div>
          
          <div className="checkbox-item">
            <input
              type="checkbox"
              id="sms-notifications"
              checked={settings.notifications.sms}
              onChange={(e) => setSettings(prev => ({
                ...prev,
                notifications: { ...prev.notifications, sms: e.target.checked }
              }))}
            />
            <label htmlFor="sms-notifications">SMS notifications for urgent jobs</label>
          </div>
        </CheckboxGroup>
      </SettingsSection>

      <SettingsSection>
        <div className="section-header">
          <FaShieldAlt className="section-icon" />
          <div className="section-title">Security Settings</div>
        </div>
        
        <CheckboxGroup>
          <div className="checkbox-item">
            <input
              type="checkbox"
              id="two-factor"
              checked={settings.security.twoFactor}
              onChange={(e) => setSettings(prev => ({
                ...prev,
                security: { ...prev.security, twoFactor: e.target.checked }
              }))}
            />
            <label htmlFor="two-factor">Enable two-factor authentication</label>
          </div>
          
          <div className="checkbox-item">
            <input
              type="checkbox"
              id="require-pin"
              checked={settings.security.requirePin}
              onChange={(e) => setSettings(prev => ({
                ...prev,
                security: { ...prev.security, requirePin: e.target.checked }
              }))}
            />
            <label htmlFor="require-pin">Require PIN for print release</label>
          </div>
        </CheckboxGroup>
        
        <FormGroup>
          <label>Session Timeout (minutes)</label>
          <select
            value={settings.security.sessionTimeout}
            onChange={(e) => setSettings(prev => ({
              ...prev,
              security: { ...prev.security, sessionTimeout: parseInt(e.target.value) }
            }))}
          >
            <option value={15}>15 minutes</option>
            <option value={30}>30 minutes</option>
            <option value={60}>1 hour</option>
            <option value={120}>2 hours</option>
          </select>
        </FormGroup>
      </SettingsSection>

      <SettingsSection>
        <div className="section-header">
          <FaCog className="section-icon" />
          <div className="section-title">Print Preferences</div>
        </div>
        
        <FormGroup>
          <label>Default Printer</label>
          <select
            value={settings.preferences.defaultPrinter}
            onChange={(e) => setSettings(prev => ({
              ...prev,
              preferences: { ...prev.preferences, defaultPrinter: e.target.value }
            }))}
          >
            <option value="">Select Default Printer</option>
            <option value="main-office">Main Office Printer</option>
            <option value="sales-dept">Sales Department Printer</option>
            <option value="marketing">Marketing Printer</option>
          </select>
        </FormGroup>
        
        <FormGroup>
          <label>Default Number of Copies</label>
          <input
            type="number"
            min="1"
            max="100"
            value={settings.preferences.defaultCopies}
            onChange={(e) => setSettings(prev => ({
              ...prev,
              preferences: { ...prev.preferences, defaultCopies: parseInt(e.target.value) }
            }))}
          />
        </FormGroup>
        
        <CheckboxGroup>
          <div className="checkbox-item">
            <input
              type="checkbox"
              id="default-color"
              checked={settings.preferences.defaultColor}
              onChange={(e) => setSettings(prev => ({
                ...prev,
                preferences: { ...prev.preferences, defaultColor: e.target.checked }
              }))}
            />
            <label htmlFor="default-color">Default to color printing</label>
          </div>
          
          <div className="checkbox-item">
            <input
              type="checkbox"
              id="default-duplex"
              checked={settings.preferences.defaultDuplex}
              onChange={(e) => setSettings(prev => ({
                ...prev,
                preferences: { ...prev.preferences, defaultDuplex: e.target.checked }
              }))}
            />
            <label htmlFor="default-duplex">Default to double-sided printing</label>
          </div>
        </CheckboxGroup>
      </SettingsSection>

      <SaveButton onClick={handleSave}>
        <FaSave />
        Save Settings
      </SaveButton>
    </SettingsContainer>
  );
};

export default Settings;
