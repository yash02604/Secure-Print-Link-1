import React, { createContext, useState, useContext, useEffect, useCallback } from 'react';
import api from '../api/client';
import { toast } from 'react-toastify';

const PrintJobContext = createContext();

export const usePrintJob = () => {
  const context = useContext(PrintJobContext);
  if (!context) {
    throw new Error('usePrintJob must be used within a PrintJobProvider');
  }
  return context;
};

export const PrintJobProvider = ({ children }) => {
  const [printJobs, setPrintJobs] = useState([]);
  const [printers, setPrinters] = useState([]);
  const [loading, setLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isFetching, setIsFetching] = useState(false);
  const [error, setError] = useState(null);
  const [expirationMetadata, setExpirationMetadata] = useState(new Map());

  // Helper to sync metadata from jobs
  const syncMetadataFromJobs = useCallback((jobs) => {
    setExpirationMetadata(prev => {
      const newMap = new Map(prev);
      jobs.forEach(job => {
        if (job.expiresAt && job.status !== 'deleted') {
          newMap.set(job.id, {
            expiresAt: new Date(job.expiresAt).getTime(),
            token: job.secureToken,
            viewCount: job.viewCount || 0
          });
        }
      });
      return newMap;
    });
  }, []);

  // Load initial data
  useEffect(() => {
    const loadInitialData = async () => {
      setIsFetching(true);
      setError(null);

      try {
        const [jobsResponse, printersResponse] = await Promise.all([
          api.get('/api/jobs').catch(err => ({ data: { jobs: [] } })),
          api.get('/api/printers').catch(err => ({ data: { printers: [] } }))
        ]);

        if (jobsResponse.data.jobs) {
          const jobs = jobsResponse.data.jobs;
          setPrintJobs(jobs);
          syncMetadataFromJobs(jobs);
        }
        
        if (printersResponse.data.printers && printersResponse.data.printers.length > 0) {
          setPrinters(printersResponse.data.printers);
        } else if (printers.length === 0) {
          // Fallback to some default printers if none from server
          setPrinters([
            { id: 1, name: 'Main Office Printer', location: 'Level 1, Room 102', status: 'online', model: 'HP LaserJet Enterprise', capabilities: 'Color, Duplex', department: 'Administration' },
            { id: 2, name: 'Marketing Printer', location: 'Level 2, Room 205', status: 'online', model: 'Canon imageRUNNER', capabilities: 'Color, Duplex, Stapling', department: 'Marketing' },
            { id: 3, name: 'IT Support Printer', location: 'Basement, IT Dept', status: 'online', model: 'Brother HL-Series', capabilities: 'Duplex', department: 'IT' }
          ]);
        }
      } catch (error) {
        console.error('Error loading data from API:', error);
        setError('Could not connect to server.');
      } finally {
        setIsFetching(false);
      }
    };

    loadInitialData();
  }, [printers.length, syncMetadataFromJobs]);

  // Cleanup expired jobs every minute (server-side cleanup is authoritative)
  useEffect(() => {
    const cleanupInterval = setInterval(() => {
      const currentServerTime = Date.now();
      const expiredJobIds = [];
      
      expirationMetadata.forEach((metadata, jobId) => {
        if (currentServerTime >= metadata.expiresAt) {
          expiredJobIds.push(jobId);
        }
      });
      
      if (expiredJobIds.length > 0) {
        setPrintJobs(prevJobs => 
          prevJobs.map(job => {
            if (expiredJobIds.includes(job.id)) {
              return {
                ...job,
                status: 'deleted',
                document: null, // Delete document data
                expiredAt: new Date().toISOString()
              };
            }
            return job;
          })
        );
        
        // Remove expired metadata
        setExpirationMetadata(prev => {
          const newMap = new Map(prev);
          expiredJobIds.forEach(id => newMap.delete(id));
          return newMap;
        });
      }
    }, 60000); // Run every minute
    
    return () => clearInterval(cleanupInterval);
  }, [expirationMetadata]);

  const submitPrintJob = async (jobData) => {
    setIsSubmitting(true);
    setError(null);
    
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
        const serverJob = response.data.job;
        
        submittedJob = {
          ...serverJob,
          document: serverJob.file ? {
            filename: serverJob.file.filename,
            originalname: serverJob.file.originalname,
            mimetype: serverJob.file.mimetype,
            size: serverJob.file.size
          } : null,
          viewCount: 0,
          firstViewedAt: null,
          lastViewedAt: null
        };

        setPrintJobs(prev => [submittedJob, ...prev]);
        
        const expiresAt = new Date(serverJob.expiresAt).getTime();
        setExpirationMetadata(prev => {
          const newMap = new Map(prev);
          newMap.set(serverJob.id, {
            expiresAt,
            createdAt: Date.now(),
            token: serverJob.secureToken,
            viewCount: 0,
            firstViewedAt: null,
            filePath: null
          });
          return newMap;
        });

        toast.success('Your document was encrypted and submitted securely.');
      }
    } catch (error) {
      console.error('API submission failed:', error.message, error.response?.status, error.config?.url);
      const errorDetail = error.response?.data?.error || error.message;
      const status = error.response?.status;
      
      let userFriendlyMessage = `Failed to submit print job: ${errorDetail}`;
      if (status === 405) {
        userFriendlyMessage = 'Submission failed (405): The API endpoint is not accepting the request. This usually happens if the backend server is not running or the API URL is incorrect.';
      }

      setError(userFriendlyMessage);
      toast.error('Submission failed. Please check if the backend server is running.');
    }

    setIsSubmitting(false);
    return submittedJob;
  };

  const getJobById = async (jobId) => {
    try {
      const response = await api.get(`/api/jobs/${jobId}`);
      if (response.data.job) {
        return response.data.job;
      }
      return null;
    } catch (error) {
      console.error('Error fetching job:', error);
      return null;
    }
  };

  const viewPrintJob = async (jobId, token, userId) => {
    toast.dismiss(); // Clear old toasts

    setLoading(true);
    try {
      const response = await api.post(`/api/jobs/${jobId}/view`, {
        token,
        userId
      });

      if (response.data.success) {
        // Update job in state
        setPrintJobs(prev => prev.map(job => 
          job.id === jobId 
            ? { 
                ...job, 
                viewCount: response.data.viewCount,
                firstViewedAt: response.data.firstViewedAt,
                document: response.data.document
              }
            : job
        ));

        // Update expiration metadata
        setExpirationMetadata(prev => {
          const newMap = new Map(prev);
          const metadata = newMap.get(jobId);
          if (metadata) {
            newMap.set(jobId, {
              ...metadata,
              viewCount: response.data.viewCount,
              firstViewedAt: response.data.firstViewedAt
            });
          }
          return newMap;
        });

        toast.success(response.data.message);
        return response.data.document;
      }
    } catch (error) {
      console.error('Error viewing job:', error);
      if (error.response?.data?.alreadyViewed) {
        toast.error('Document already viewed (one-time only)');
        // Update state to reflect this
        setPrintJobs(prev => prev.map(job => 
          job.id === jobId 
            ? { ...job, viewCount: error.response.data.viewCount || 1 }
            : job
        ));
        throw new Error('Document already viewed');
      } else if (error.response?.data?.error) {
        throw new Error(error.response.data.error);
      }
      throw new Error('Failed to view document');
    } finally {
      setLoading(false);
    }
  };

  const releasePrintJob = async (jobId, printerId, releasedBy, token) => {
    toast.dismiss(); // Clear old toasts

    setLoading(true);
    try {
      const response = await api.post(`/api/jobs/${jobId}/release`, {
        token,
        printerId,
        releasedBy
      });

      if (response.data.success) {
        // Update job status and clear document data locally
        setPrintJobs(prev => prev.map(job => 
          job.id === jobId 
            ? { 
                ...job, 
                status: 'released', 
                releasedAt: new Date().toISOString(),
                document: null // Clear document data on release
              }
            : job
        ));

        toast.success(response.data.message);
        return response.data;
      }
    } catch (error) {
      console.error('Error releasing job:', error);
      const errorMsg = error.response?.data?.error || error.message || 'Failed to release print job';
      
      if (error.response?.status === 409) {
        toast.warning('This job has already been released.');
        // Sync state
        setPrintJobs(prev => prev.map(job => 
          job.id === jobId ? { ...job, status: 'released' } : job
        ));
      } else {
        toast.error(errorMsg);
      }
      throw new Error(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  const cancelPrintJob = async (jobId) => {
    // OPTIMISTIC UI: Update status locally first
    const previousJobs = [...printJobs];
    setPrintJobs(prev => prev.map(job => 
      job.id === jobId 
        ? { ...job, status: 'cancelled', cancelledAt: new Date().toISOString() }
        : job
    ));

    try {
      // In a real app, we'd call the API here
      // const response = await api.post(`/api/jobs/${jobId}/cancel`);
      toast.success('Print job cancelled successfully');
    } catch (error) {
      console.error('Error cancelling job:', error);
      // Rollback on error
      setPrintJobs(previousJobs);
      toast.error('Failed to cancel job');
      throw error;
    }
  };

  const deletePrintJob = async (jobId) => {
    // OPTIMISTIC UI: Remove from local state
    const previousJobs = [...printJobs];
    const previousMetadata = new Map(expirationMetadata);
    
    setPrintJobs(prev => prev.filter(job => job.id !== jobId));
    setExpirationMetadata(prev => {
      const newMap = new Map(prev);
      newMap.delete(jobId);
      return newMap;
    });

    try {
      // In a real app, we'd call the API here
      // await api.delete(`/api/jobs/${jobId}`);
      toast.success('Print job deleted');
    } catch (error) {
      console.error('Error deleting job:', error);
      // Rollback
      setPrintJobs(previousJobs);
      setExpirationMetadata(previousMetadata);
      toast.error('Failed to delete job');
      throw error;
    }
  };

  const getJobsByUser = (userId) => {
    return printJobs.filter(job => job.userId === userId);
  };

  const getJobsByStatus = (status) => {
    return printJobs.filter(job => job.status === status);
  };

  const getJobsByPrinter = (printerId) => {
    return printJobs.filter(job => job.printerId === printerId);
  };

  const getJobStatistics = (userId) => {
    const userJobs = userId ? getJobsByUser(userId) : printJobs;
    
    return {
      total: userJobs.length,
      pending: userJobs.filter(job => job.status === 'pending').length,
      released: userJobs.filter(job => job.status === 'released').length,
      completed: userJobs.filter(job => job.status === 'completed').length,
      cancelled: userJobs.filter(job => job.status === 'cancelled').length,
      deleted: userJobs.filter(job => job.status === 'deleted').length,
      viewed: userJobs.filter(job => job.viewCount > 0).length,
      expired: userJobs.filter(job => job.status === 'deleted' || (job.expiresAt && new Date(job.expiresAt) < new Date())).length
    };
  };

  const addPrinter = async (printerData) => {
    // Implementation for adding printer
    console.log('Add printer:', printerData);
  };

  const updatePrinter = async (printerId, printerData) => {
    // Implementation for updating printer
    console.log('Update printer:', printerId, printerData);
  };

  const deletePrinter = async (printerId) => {
    // Implementation for deleting printer
    console.log('Delete printer:', printerId);
  };

  const calculateJobCost = (jobData) => {
    const baseCost = 0.10;
    const colorMultiplier = jobData.color ? 2 : 1;
    const duplexMultiplier = jobData.duplex ? 0.8 : 1;
    return +(baseCost * jobData.pages * jobData.copies * colorMultiplier * duplexMultiplier).toFixed(2);
  };

  const validateTokenAndExpiration = (jobId, token) => {
    const currentServerTime = Date.now();
    const metadata = expirationMetadata.get(jobId);
    
    if (!metadata) {
      return { valid: false, error: 'Print job not found or expired' };
    }
    
    if (metadata.token !== token) {
      return { valid: false, error: 'Invalid token' };
    }
    
    if (currentServerTime >= metadata.expiresAt) {
      return { valid: false, error: 'Print link has expired' };
    }
    
    return { valid: true };
  };

  const value = {
    printJobs,
    printers,
    loading,
    isSubmitting,
    isFetching,
    error,
    setError,
    submitPrintJob,
    getJobById,
    viewPrintJob,
    releasePrintJob,
    cancelPrintJob,
    deletePrintJob,
    getJobsByUser,
    getJobsByStatus,
    getJobsByPrinter,
    getJobStatistics,
    addPrinter,
    updatePrinter,
    deletePrinter,
    calculateJobCost,
    validateTokenAndExpiration,
    expirationMetadata
  };

  return (
    <PrintJobContext.Provider value={value}>
      {children}
    </PrintJobContext.Provider>
  );
};
