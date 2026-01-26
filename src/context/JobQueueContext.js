import React, { createContext, useState, useContext, useEffect, useCallback } from 'react';
import api from '../api/client';
import { useAuth } from './AuthContext';

const JobQueueContext = createContext();

export const useJobQueue = () => {
  const context = useContext(JobQueueContext);
  if (!context) {
    throw new Error('useJobQueue must be used within a JobQueueProvider');
  }
  return context;
};

export const JobQueueProvider = ({ children }) => {
  const { currentUser } = useAuth();
  const [jobs, setJobs] = useState([]);
  const [isFetching, setIsFetching] = useState(false);
  
  const fetchJobs = useCallback(async (silent = false) => {
    if (!currentUser?.id) return;
    if (!silent) setIsFetching(true);
    try {
      const response = await api.get(`/api/jobs?userId=${currentUser.id}`);
      if (response.data.jobs) {
        setJobs(response.data.jobs);
      }
    } catch (err) {
      console.error('Failed to fetch jobs', err);
    } finally {
      if (!silent) setIsFetching(false);
    }
  }, [currentUser?.id]);

  // Background cleanup timer - runs ONLY when this provider is active (Job Queue page)
  useEffect(() => {
    const timer = setInterval(() => {
      fetchJobs(true);
    }, 60000);
    return () => clearInterval(timer);
  }, [fetchJobs]);

  const deleteJob = useCallback(async (jobId) => {
    try {
      setJobs(prev => prev.filter(j => j.id !== jobId));
      // In a real app, call API
      // await api.delete(`/api/jobs/${jobId}`);
    } catch (err) {
      console.error('Failed to delete job', err);
    }
  }, []);

  const viewJob = useCallback(async (jobId, token, userId) => {
    try {
      const response = await api.post(`/api/jobs/${jobId}/view`, {
        token,
        userId
      });

      if (response.data.success) {
        // Update job in state
        setJobs(prev => prev.map(job => 
          job.id === jobId 
            ? { 
                ...job, 
                viewCount: response.data.viewCount,
                firstViewedAt: response.data.firstViewedAt,
                document: response.data.document
              }
            : job
        ));
        return response.data.document;
      }
    } catch (error) {
      console.error('Error viewing job:', error);
      if (error.response?.data?.alreadyViewed) {
        setJobs(prev => prev.map(job => 
          job.id === jobId ? { ...job, viewCount: error.response.data.viewCount || 1 } : job
        ));
      }
      throw error;
    }
  }, []);

  const value = {
    jobs,
    isFetching,
    fetchJobs,
    deleteJob,
    viewJob
  };

  return (
    <JobQueueContext.Provider value={value}>
      {children}
    </JobQueueContext.Provider>
  );
};
