import React, { createContext, useState, useContext } from 'react';
import api from '../api/client';

const PrintJobContext = createContext();

export const usePrintJob = () => {
  const context = useContext(PrintJobContext);
  if (!context) {
    throw new Error('usePrintJob must be used within a PrintJobProvider');
  }
  return context;
};

export const PrintJobProvider = ({ children }) => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const submitPrintJob = async (jobData) => {
    setIsSubmitting(true);
    setError(null);
    
    let apiSuccess = false;
    let submittedJob = null;

    try {
      const formData = new FormData();
      formData.append('userId', jobData.userId);
      formData.append('userName', jobData.userName);
      formData.append('documentName', jobData.documentName);
      formData.append('pages', jobData.pages);
      formData.append('copies', jobData.copies);
      formData.append('color', jobData.color);
      formData.append('duplex', jobData.duplex);
      formData.append('stapling', jobData.stapling);
      formData.append('priority', jobData.priority);
      formData.append('notes', jobData.notes || '');
      formData.append('expirationDuration', jobData.expirationDuration || 15);
      
      if (jobData.file instanceof File) {
        formData.append('file', jobData.file);
      }

      const response = await api.post('/api/jobs', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      if (response.data.success && response.data.job) {
        apiSuccess = true;
        submittedJob = response.data.job;
      }
    } catch (error) {
      console.warn('API submission failed, falling back to local storage:', error.message);
    }

    // LOCAL FALLBACK if API failed
    if (!apiSuccess) {
      try {
        const id = 'local_' + Math.random().toString(36).substr(2, 9);
        const secureToken = Math.random().toString(36).substr(2, 32);
        const expirationDuration = parseInt(jobData.expirationDuration || 15);
        const expiresAt = new Date(Date.now() + expirationDuration * 60000).toISOString();
        const submittedAt = new Date().toISOString();
        const origin = window.location.origin;
        const releaseLink = `${origin}/release/${id}?token=${secureToken}`;

        submittedJob = {
          id,
          userId: jobData.userId,
          userName: jobData.userName,
          documentName: jobData.documentName,
          pages: jobData.pages,
          copies: jobData.copies,
          color: jobData.color,
          duplex: jobData.duplex,
          stapling: jobData.stapling,
          priority: jobData.priority,
          notes: jobData.notes,
          status: 'pending',
          cost: calculateJobCost(jobData),
          submittedAt,
          secureToken,
          releaseLink,
          expiresAt,
          viewCount: 0
        };
      } catch (err) {
        console.error('Local submission failed:', err);
        setError('Failed to submit print job.');
        throw err;
      }
    }

    setIsSubmitting(false);
    return submittedJob;
  };

  const calculateJobCost = (jobData) => {
    const baseCost = 0.10;
    const colorMultiplier = jobData.color ? 2 : 1;
    const duplexMultiplier = jobData.duplex ? 0.8 : 1;
    return +(baseCost * jobData.pages * jobData.copies * colorMultiplier * duplexMultiplier).toFixed(2);
  };

  const value = {
    isSubmitting,
    error,
    setError,
    submitPrintJob,
    calculateJobCost
  };

  return (
    <PrintJobContext.Provider value={value}>
      {children}
    </PrintJobContext.Provider>
  );
};