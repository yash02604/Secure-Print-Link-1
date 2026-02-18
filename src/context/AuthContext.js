import React, { createContext, useContext, useState, useEffect } from 'react';
import CryptoJS from 'crypto-js';
import api from '../api/client';

const AuthContext = createContext();

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [currentUser, setCurrentUser] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);

  // Mock users for demonstration
  const mockUsers = [
    {
      id: 1,
      username: 'admin',
      password: 'admin123',
      name: 'Administrator',
      email: 'admin@company.com',
      role: 'admin',
      department: 'IT',
      pin: '1234'
    },
    {
      id: 2,
      username: 'user1',
      password: 'user123',
      name: 'John Doe',
      email: 'john.doe@company.com',
      role: 'user',
      department: 'Sales',
      pin: '5678'
    },
    {
      id: 3,
      username: 'user2',
      password: 'user123',
      name: 'Jane Smith',
      email: 'jane.smith@company.com',
      role: 'user',
      department: 'Marketing',
      pin: '9012'
    }
  ];

  useEffect(() => {
    // Check for stored authentication
    const storedUser = localStorage.getItem('securePrintUser');
    if (storedUser) {
      try {
        const user = JSON.parse(storedUser);
        setCurrentUser(user);
        setIsAuthenticated(true);
      } catch (error) {
        localStorage.removeItem('securePrintUser');
      }
    }
    setLoading(false);
  }, []);

  const login = async (username, password) => {
    // Try backend login first
    try {
      const response = await api.post('/api/auth/login', { username, password });
      if (response.data?.success && response.data?.user) {
        const user = response.data.user;
        setCurrentUser(user);
        setIsAuthenticated(true);
        localStorage.setItem('securePrintUser', JSON.stringify(user));
        return { success: true, user };
      }
    } catch (err) {
      // Fallback to mock users
    }
    
    await new Promise(resolve => setTimeout(resolve, 500));
    const user = mockUsers.find(u => u.username === username && u.password === password);
    if (user) {
      const { password: _, ...userWithoutPassword } = user;
      setCurrentUser(userWithoutPassword);
      setIsAuthenticated(true);
      localStorage.setItem('securePrintUser', JSON.stringify(userWithoutPassword));
      return { success: true, user: userWithoutPassword };
    } else {
      throw new Error('Invalid username or password');
    }
  };

  const loginWithPin = async (pin) => {
    await new Promise(resolve => setTimeout(resolve, 500));
    
    const user = mockUsers.find(u => u.pin === pin);
    
    if (user) {
      const { password: _, ...userWithoutPassword } = user;
      setCurrentUser(userWithoutPassword);
      setIsAuthenticated(true);
      localStorage.setItem('securePrintUser', JSON.stringify(userWithoutPassword));
      return { success: true, user: userWithoutPassword };
    } else {
      throw new Error('Invalid PIN');
    }
  };

  const logout = () => {
    setCurrentUser(null);
    setIsAuthenticated(false);
    localStorage.removeItem('securePrintUser');
  };

  const updateUser = (updatedUser) => {
    setCurrentUser(updatedUser);
    localStorage.setItem('securePrintUser', JSON.stringify(updatedUser));
  };

  const generateSecureToken = () => {
    return CryptoJS.lib.WordArray.random(32).toString();
  };

  const signup = async ({ username, password, name, email }) => {
    const response = await api.post('/api/auth/signup', { username, password, name, email });
    if (response.data?.success && response.data?.user) {
      const user = response.data.user;
      setCurrentUser(user);
      setIsAuthenticated(true);
      localStorage.setItem('securePrintUser', JSON.stringify(user));
      return { success: true, user };
    }
    throw new Error(response.data?.error || 'Failed to sign up');
  };

  const loginWithGoogle = async (idToken) => {
    const response = await api.post('/api/auth/google', { idToken });
    if (response.data?.success && response.data?.user) {
      const user = response.data.user;
      setCurrentUser(user);
      setIsAuthenticated(true);
      localStorage.setItem('securePrintUser', JSON.stringify(user));
      return { success: true, user };
    }
    throw new Error(response.data?.error || 'Failed to login with Google');
  };

  const value = {
    currentUser,
    isAuthenticated,
    loading,
    login,
    loginWithPin,
    signup,
    loginWithGoogle,
    logout,
    updateUser,
    generateSecureToken,
    mockUsers
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};
