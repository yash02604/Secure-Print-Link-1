import React, { createContext, useState, useContext, useCallback } from 'react';
import api from '../api/client';
import { useAuth } from './AuthContext';

const DashboardStatsContext = createContext();

export const useDashboardStats = () => {
  const context = useContext(DashboardStatsContext);
  if (!context) {
    throw new Error('useDashboardStats must be used within a DashboardStatsProvider');
  }
  return context;
};

export const DashboardStatsProvider = ({ children }) => {
  const { currentUser } = useAuth();
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(false);

  const fetchStats = useCallback(async () => {
    if (!currentUser?.id) return;
    setLoading(true);
    try {
      const response = await api.get(`/api/jobs/stats?userId=${currentUser.id}`);
      if (response.data.stats) {
        setStats(response.data.stats);
      }
    } catch (err) {
      console.error('Failed to fetch dashboard stats', err);
      // Silent failure as per requirements
    } finally {
      setLoading(false);
    }
  }, [currentUser?.id]);

  const value = {
    stats,
    loading,
    fetchStats
  };

  return (
    <DashboardStatsContext.Provider value={value}>
      {children}
    </DashboardStatsContext.Provider>
  );
};
