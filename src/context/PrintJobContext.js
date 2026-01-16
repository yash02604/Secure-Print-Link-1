import React, { createContext, useContext, useState, useEffect } from 'react';
import CryptoJS from 'crypto-js';
import { api } from '../api/client';

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
  // In-memory storage for expiration metadata (simulates server memory)
  const [expirationMetadata, setExpirationMetadata] = useState(new Map());
  const [usedTokens, setUsedTokens] = useState(new Set()); // Prevent token reuse

  useEffect(() => {
    // Mock printers for demonstration
    const mockPrinters = [
      {
        id: 1,
        name: 'Main Office Printer',
        location: 'Main Office - Floor 1',
        model: 'HP LaserJet Pro M404n',
        status: 'online',
        ip: '192.168.1.100',
        capabilities: ['color', 'duplex', 'stapling'],
        department: 'All'
      },
      {
        id: 2,
        name: 'Sales Department Printer',
        location: 'Sales Office - Floor 2',
        model: 'Canon imageRUNNER ADVANCE C3530',
        status: 'online',
        ip: '192.168.1.101',
        capabilities: ['color', 'duplex', 'scanning'],
        department: 'Sales'
      },
      {
        id: 3,
        name: 'Marketing Printer',
        location: 'Marketing Office - Floor 3',
        model: 'Xerox WorkCentre 6515',
        status: 'offline',
        ip: '192.168.1.102',
        capabilities: ['color', 'duplex', 'scanning', 'fax'],
        department: 'Marketing'
      }
    ];

    // Load mock data
    setPrinters(mockPrinters);
    
    // Load stored print jobs
    const storedJobs = localStorage.getItem('securePrintJobs');
    if (storedJobs) {
      try {
        setPrintJobs(JSON.parse(storedJobs));
      } catch (error) {
        console.error('Error loading stored print jobs:', error);
      }
    }
  }, []);

  // Cleanup loop: Periodically scan for expired jobs and delete them
  useEffect(() => {
    const cleanupInterval = setInterval(() => {
      const currentServerTime = Date.now();
      
      // Find expired jobs
      const expiredJobIds = [];
      expirationMetadata.forEach((metadata, jobId) => {
        if (currentServerTime >= metadata.expiresAt) {
          expiredJobIds.push(jobId);
        }
      });
      
      // Clean up expired jobs
      if (expiredJobIds.length > 0) {
        console.log(`Cleaning up ${expiredJobIds.length} expired print job(s)`);
        
        // Remove from expiration metadata
        setExpirationMetadata(prev => {
          const newMap = new Map(prev);
          expiredJobIds.forEach(id => newMap.delete(id));
          return newMap;
        });
        
        // Remove document data and mark as expired
        setPrintJobs(prev => prev.map(job => {
          if (expiredJobIds.includes(job.id)) {
            return {
              ...job,
              status: 'expired',
              document: null, // Delete document data
              expiredAt: new Date().toISOString()
            };
          }
          return job;
        }));
      }
    }, 60000); // Run every minute
    
    return () => clearInterval(cleanupInterval);
  }, [expirationMetadata]);

  // Save print jobs to localStorage whenever they change
  useEffect(() => {
    try {
      const jobsJson = JSON.stringify(printJobs);
      // Check localStorage size limit (typically 5-10MB)
      const sizeInMB = new Blob([jobsJson]).size / (1024 * 1024);
      if (sizeInMB > 5) {
        console.warn(`Warning: Print jobs data is large (${sizeInMB.toFixed(2)}MB). Large documents may cause issues.`);
      }
      localStorage.setItem('securePrintJobs', jobsJson);
      console.log('Print jobs saved to localStorage:', printJobs.length, 'jobs');
    } catch (error) {
      if (error.name === 'QuotaExceededError') {
        console.error('localStorage quota exceeded. Document may be too large. Consider using server storage.');
        // Keep jobs without document data for smaller storage
        const jobsWithoutDocs = printJobs.map(job => ({
          ...job,
          document: null // Remove document data to save space
        }));
        try {
          localStorage.setItem('securePrintJobs', JSON.stringify(jobsWithoutDocs));
          console.warn('Saved jobs without document data due to storage limit');
        } catch (e) {
          console.error('Failed to save even without document data:', e);
        }
      } else {
        console.error('Error saving print jobs to localStorage:', error);
      }
    }
  }, [printJobs]);

  const submitPrintJob = async (jobData) => {
    setLoading(true);
    try {
      // Try to use server API first (permanent fix)
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
          
          // Convert server response to client format
          const newJob = {
            ...serverJob,
            encrypted: true,
            // For client-side display, we still need document data URL
            document: jobData.file ? await convertFileToDataUrl(jobData.file) : null
          };

          setPrintJobs(prev => [newJob, ...prev]);
          return { success: true, job: newJob };
        }
      } catch (apiError) {
        // API not available - fallback to client-side (temporary)
        console.warn('Server API not available, using client-side fallback:', apiError.message);
        return await submitPrintJobClientSide(jobData);
      }
    } catch (err) {
      console.error(err);
      throw new Error('Failed to submit print job');
    } finally {
      setLoading(false);
    }
  };

  // Helper: Convert file to data URL
  const convertFileToDataUrl = async (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const fileName = file.name.toLowerCase();
        let mimeType = file.type;
        
        // Detect MIME type from extension if needed
        if (!mimeType || mimeType === 'application/octet-stream') {
          if (fileName.endsWith('.pdf')) mimeType = 'application/pdf';
          else if (fileName.endsWith('.doc')) mimeType = 'application/msword';
          else if (fileName.endsWith('.docx')) mimeType = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
          else if (fileName.endsWith('.xls')) mimeType = 'application/vnd.ms-excel';
          else if (fileName.endsWith('.xlsx')) mimeType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
          else if (fileName.endsWith('.ppt')) mimeType = 'application/vnd.ms-powerpoint';
          else if (fileName.endsWith('.pptx')) mimeType = 'application/vnd.openxmlformats-officedocument.presentationml.presentation';
          else if (fileName.endsWith('.txt')) mimeType = 'text/plain';
          else if (fileName.endsWith('.csv')) mimeType = 'text/csv';
          else if (/\.(jpg|jpeg|png|gif|bmp|webp|svg)$/.test(fileName)) mimeType = 'image/jpeg';
          else mimeType = 'application/octet-stream';
        }
        
        resolve({
          dataUrl: reader.result,
          mimeType,
          name: file.name
        });
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  // Client-side fallback (temporary - only used when API unavailable)
  const submitPrintJobClientSide = async (jobData) => {
    const jobId = String(Date.now());
    const secureToken = CryptoJS.lib.WordArray.random(32).toString();
    const expirationDuration = jobData.expirationDuration || 15;
    const currentServerTime = Date.now();
    const expiresAt = currentServerTime + (expirationDuration * 60 * 1000);
    
    // Store expiration metadata in memory (client-side fallback)
    setExpirationMetadata(prev => {
      const newMap = new Map(prev);
      newMap.set(jobId, {
        expiresAt,
        createdAt: currentServerTime,
        token: secureToken,
        used: false
      });
      return newMap;
    });
    
    const releaseLinkBase = typeof window !== 'undefined' && window.location && window.location.origin
      ? window.location.origin
      : '';
    const releaseLink = `${releaseLinkBase}/release/${jobId}?token=${secureToken}`;

    const document = jobData.file ? await convertFileToDataUrl(jobData.file) : null;

    const newJob = {
      id: jobId,
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
      cost: parseFloat(calculateJobCost(jobData)),
      submittedAt: new Date().toISOString(),
      printerId: null,
      releasedBy: null,
      secureToken,
      releaseLink,
      encrypted: true,
      expiresAt: new Date(expiresAt).toISOString(),
      expirationDuration,
      document
    };

    setPrintJobs(prev => [newJob, ...prev]);
    return { success: true, job: newJob };
  };

  const releasePrintJob = async (jobId, printerId, userId, token) => {
    setLoading(true);
    try {
      // Try to use server API first (permanent fix)
      try {
        const response = await api.post(`/api/jobs/${jobId}/release`, {
          token,
          printerId,
          releasedBy: userId
        });

        if (response.data.success) {
          // Update local state
          setPrintJobs(prev => prev.map(job =>
            job.id === jobId
              ? { ...job, status: 'printing', releasedAt: new Date().toISOString(), printerId, releasedBy: userId }
              : job
          ));
          
          // Mark as completed after delay (server handles file deletion)
          setTimeout(() => {
            setPrintJobs(prev => prev.map(job => 
              job.id === jobId 
                ? { ...job, status: 'completed', completedAt: new Date().toISOString(), document: null }
                : job
            ));
          }, 3000);
          
          return { success: true };
        }
      } catch (apiError) {
        // API not available - fallback to client-side validation
        console.warn('Server API not available, using client-side fallback:', apiError.message);
        return await releasePrintJobClientSide(jobId, printerId, userId, token);
      }
    } catch (err) {
      console.error(err);
      throw new Error(err.message || 'Failed to release print job');
    } finally {
      setLoading(false);
    }
  };

  // Client-side fallback (temporary - only used when API unavailable)
  const releasePrintJobClientSide = async (jobId, printerId, userId, token) => {
    const currentServerTime = Date.now();
    let metadata = expirationMetadata.get(jobId);
    
    // Fallback: If metadata is missing (e.g. page refresh), try to reconstruct it from printJobs
    if (!metadata) {
      const existingJob = printJobs.find(j => j.id === jobId);
      if (existingJob && existingJob.secureToken === token && existingJob.expiresAt) {
        // Reconstruct metadata from job info
        metadata = {
          expiresAt: new Date(existingJob.expiresAt).getTime(),
          token: existingJob.secureToken,
          used: existingJob.status !== 'pending'
        };
        // Restore to in-memory map
        setExpirationMetadata(prev => new Map(prev).set(jobId, metadata));
      }
    }

    if (!metadata) {
      throw new Error('Print job not found or expired');
    }
    
    if (usedTokens.has(token) || metadata.used) {
      throw new Error('Token has already been used');
    }
    
    if (metadata.token !== token) {
      throw new Error('Invalid token');
    }
    
    if (currentServerTime >= metadata.expiresAt) {
      setExpirationMetadata(prev => {
        const newMap = new Map(prev);
        newMap.delete(jobId);
        return newMap;
      });
      throw new Error('Print link has expired');
    }
    
    const targetJob = printJobs.find(j => j.id === jobId);
    if (!targetJob || (targetJob.secureToken && targetJob.secureToken !== token)) {
      throw new Error('Invalid release token');
    }
    
    setUsedTokens(prev => new Set(prev).add(token));
    setExpirationMetadata(prev => {
      const newMap = new Map(prev);
      const meta = newMap.get(jobId);
      if (meta) {
        newMap.set(jobId, { ...meta, used: true });
      }
      return newMap;
    });

    setPrintJobs(prev => prev.map(job =>
      job.id === jobId
        ? { ...job, status: 'printing', releasedAt: new Date().toISOString(), printerId, releasedBy: userId }
        : job
    ));
    
    // Delete file after successful printing (automatic cleanup)
    setTimeout(() => {
      setPrintJobs(prev => prev.map(job => {
        if (job.id === jobId) {
          return { 
            ...job, 
            status: 'completed', 
            completedAt: new Date().toISOString(),
            document: null // Delete document data
          };
        }
        return job;
      }));
      
      // Clean up expiration metadata
      setExpirationMetadata(prev => {
        const newMap = new Map(prev);
        newMap.delete(jobId);
        return newMap;
      });
    }, 3000);
    
    return { success: true };
  };

  const cancelPrintJob = async (jobId) => {
    setLoading(true);
    
    try {
      await new Promise(resolve => setTimeout(resolve, 500));
      
      setPrintJobs(prev => 
        prev.map(job => 
          job.id === jobId 
            ? { ...job, status: 'cancelled', cancelledAt: new Date().toISOString() }
            : job
        )
      );
      
      return { success: true };
    } catch (error) {
      throw new Error('Failed to cancel print job');
    } finally {
      setLoading(false);
    }
  };

  const deletePrintJob = async (jobId) => {
    setLoading(true);
    
    try {
      await new Promise(resolve => setTimeout(resolve, 500));
      
      setPrintJobs(prev => prev.filter(job => job.id !== jobId));
      
      return { success: true };
    } catch (error) {
      throw new Error('Failed to delete print job');
    } finally {
      setLoading(false);
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

  const calculateJobCost = (jobData) => {
    const baseCost = 0.10; // $0.10 per page
    const colorMultiplier = jobData.color ? 2 : 1;
    const duplexMultiplier = jobData.duplex ? 0.8 : 1;
    
    return (baseCost * jobData.pages * jobData.copies * colorMultiplier * duplexMultiplier).toFixed(2);
  };

  const getJobStatistics = () => {
    const total = printJobs.length;
    const pending = printJobs.filter(job => job.status === 'pending').length;
    const printing = printJobs.filter(job => job.status === 'printing').length;
    const completed = printJobs.filter(job => job.status === 'completed').length;
    const cancelled = printJobs.filter(job => job.status === 'cancelled').length;
    
    const totalCost = printJobs
      .filter(job => job.status === 'completed')
      .reduce((sum, job) => sum + parseFloat(job.cost), 0);
    
    return {
      total,
      pending,
      printing,
      completed,
      cancelled,
      totalCost: totalCost.toFixed(2)
    };
  };

  const addPrinter = (printerData) => {
    const newPrinter = {
      id: Date.now(),
      ...printerData,
      status: 'online'
    };
    setPrinters(prev => [...prev, newPrinter]);
    return newPrinter;
  };

  const updatePrinter = (printerId, updates) => {
    setPrinters(prev => 
      prev.map(printer => 
        printer.id === printerId ? { ...printer, ...updates } : printer
      )
    );
  };

  const deletePrinter = (printerId) => {
    setPrinters(prev => prev.filter(printer => printer.id !== printerId));
  };

  // Validate token and expiration (for use in PrintRelease)
  const validateTokenAndExpiration = (jobId, token) => {
    const currentServerTime = Date.now();
    const metadata = expirationMetadata.get(jobId);
    
    if (!metadata) {
      return { valid: false, error: 'Print job not found or expired' };
    }
    
    if (usedTokens.has(token)) {
      return { valid: false, error: 'Token has already been used' };
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
    submitPrintJob,
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
