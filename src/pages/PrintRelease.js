import React, { useState, useEffect } from 'react';
import styled from 'styled-components';
import { toast } from 'react-toastify';
import { useAuth } from '../context/AuthContext';
import { usePrintJob } from '../context/PrintJobContext';
import { QRCodeCanvas } from 'qrcode.react';
import { 
  FaQrcode, 
  FaKey, 
  FaPrint,
  FaEye,
  FaChartBar
} from 'react-icons/fa';
import { useParams, useLocation } from 'react-router-dom';

const ReleaseContainer = styled.div`
  padding: 20px;
  max-width: 1000px;
  margin: 0 auto;
  
  @media (max-width: 768px) {
    padding: 15px;
    max-width: 100%;
  }
  
  @media (max-width: 480px) {
    padding: 10px;
  }
`;

const PageHeader = styled.div`
  text-align: center;
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
  
  @media (max-width: 768px) {
    margin-bottom: 20px;
    
    h1 {
      font-size: 24px;
    }
    
    p {
      font-size: 14px;
    }
  }
  
  @media (max-width: 480px) {
    h1 {
      font-size: 20px;
    }
    
    p {
      font-size: 13px;
    }
  }
`;

const PrinterInterface = styled.div`
  background: #2c3e50;
  border-radius: 20px;
  padding: 40px;
  color: white;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.3);
  position: relative;
  overflow: hidden;
  
  &::before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    height: 4px;
    background: linear-gradient(90deg, #3498db, #2ecc71, #f39c12, #e74c3c);
  }
  
  @media (max-width: 768px) {
    padding: 30px 20px;
    border-radius: 15px;
  }
  
  @media (max-width: 480px) {
    padding: 25px 15px;
    border-radius: 12px;
  }
`;

const PrinterHeader = styled.div`
  text-align: center;
  margin-bottom: 30px;
  
  .printer-name {
    font-size: 24px;
    font-weight: bold;
    margin-bottom: 8px;
  }
  
  .printer-status {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    font-size: 14px;
    opacity: 0.8;
    
    .status-dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: #2ecc71;
      animation: pulse 2s infinite;
    }
  }
  
  @keyframes pulse {
    0% { opacity: 1; }
    50% { opacity: 0.5; }
    100% { opacity: 1; }
  }
  
  @media (max-width: 768px) {
    margin-bottom: 20px;
    
    .printer-name {
      font-size: 20px;
    }
    
    .printer-status {
      font-size: 13px;
    }
  }
  
  @media (max-width: 480px) {
    .printer-name {
      font-size: 18px;
    }
    
    .printer-status {
      font-size: 12px;
      gap: 6px;
    }
    
    .status-dot {
      width: 6px;
      height: 6px;
    }
  }
`;

const AuthSection = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 30px;
  margin-bottom: 30px;
  
  @media (max-width: 768px) {
    grid-template-columns: 1fr;
    gap: 20px;
    margin-bottom: 20px;
  }
  
  @media (max-width: 480px) {
    gap: 15px;
  }
`;

const AuthMethod = styled.div`
  background: rgba(255, 255, 255, 0.1);
  border-radius: 12px;
  padding: 24px;
  text-align: center;
  cursor: pointer;
  transition: all 0.3s ease;
  border: 2px solid transparent;
  
  &:hover {
    background: rgba(255, 255, 255, 0.15);
    transform: translateY(-2px);
  }
  
  &.active {
    border-color: #3498db;
    background: rgba(52, 152, 219, 0.2);
  }
  
  .auth-icon {
    font-size: 48px;
    margin-bottom: 16px;
    color: #3498db;
  }
  
  .auth-title {
    font-size: 18px;
    font-weight: 600;
    margin-bottom: 8px;
  }
  
  .auth-description {
    font-size: 14px;
    opacity: 0.8;
    line-height: 1.4;
  }
  
  @media (max-width: 768px) {
    padding: 20px;
    
    .auth-icon {
      font-size: 40px;
      margin-bottom: 12px;
    }
    
    .auth-title {
      font-size: 16px;
      margin-bottom: 6px;
    }
    
    .auth-description {
      font-size: 13px;
    }
  }
  
  @media (max-width: 480px) {
    padding: 16px;
    
    .auth-icon {
      font-size: 36px;
    }
    
    .auth-title {
      font-size: 15px;
    }
    
    .auth-description {
      font-size: 12px;
    }
  }
`;

const PinInput = styled.div`
  display: flex;
  justify-content: center;
  gap: 12px;
  margin: 20px 0;
  
  input {
    width: 60px;
    height: 60px;
    border: 2px solid rgba(255, 255, 255, 0.3);
    border-radius: 12px;
    background: rgba(255, 255, 255, 0.1);
    color: white;
    text-align: center;
    font-size: 24px;
    font-weight: bold;
    transition: all 0.3s ease;
    
    &:focus {
      outline: none;
      border-color: #3498db;
      background: rgba(52, 152, 219, 0.2);
    }
    
    &::placeholder {
      color: rgba(255, 255, 255, 0.5);
    }
  }
  
  @media (max-width: 768px) {
    gap: 10px;
    margin: 15px 0;
    
    input {
      width: 50px;
      height: 50px;
      font-size: 20px;
    }
  }
  
  @media (max-width: 480px) {
    gap: 8px;
    margin: 12px 0;
    
    input {
      width: 45px;
      height: 45px;
      font-size: 18px;
      border-radius: 10px;
    }
  }
`;

const QRCodeDisplay = styled.div`
  text-align: center;
  margin: 20px 0;
  
  .qr-code {
    background: white;
    padding: 20px;
    border-radius: 12px;
    display: inline-block;
    margin-bottom: 16px;
  }
  
  .qr-instructions {
    font-size: 14px;
    opacity: 0.8;
    line-height: 1.4;
  }
`;

const JobsSection = styled.div`
  background: rgba(255, 255, 255, 0.1);
  border-radius: 12px;
  padding: 24px;
  margin-top: 30px;
`;

const JobsHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 20px;
  
  .jobs-title {
    font-size: 18px;
    font-weight: 600;
  }
  
  .jobs-count {
    background: rgba(52, 152, 219, 0.3);
    padding: 4px 12px;
    border-radius: 20px;
    font-size: 12px;
    font-weight: 500;
  }
`;

const JobList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 12px;
`;

const JobItem = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px;
  background: rgba(255, 255, 255, 0.05);
  border-radius: 8px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  transition: all 0.2s ease;
  
  &:hover {
    background: rgba(255, 255, 255, 0.1);
  }
  
  .job-info {
    display: flex;
    align-items: center;
    gap: 12px;
    
    .job-icon {
      width: 40px;
      height: 40px;
      border-radius: 8px;
      background: rgba(52, 152, 219, 0.3);
      display: flex;
      align-items: center;
      justify-content: center;
      color: #3498db;
    }
    
    .job-details {
      .job-name {
        font-weight: 500;
        margin-bottom: 4px;
      }
      
      .job-meta {
        font-size: 12px;
        opacity: 0.7;
      }
    }
  }
  
  .job-actions {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
    align-items: center;
  }
`;

const ActionButton = styled.button`
  padding: 8px 16px;
  border: none;
  border-radius: 6px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
  
  &.primary {
    background: #3498db;
    color: white;
    
    &:hover {
      background: #2980b9;
    }
    
    &:disabled {
      background: rgba(52, 152, 219, 0.5);
      cursor: not-allowed;
    }
  }
  
  &.secondary {
    background: rgba(255, 255, 255, 0.1);
    color: white;
    border: 1px solid rgba(255, 255, 255, 0.3);
    
    &:hover {
      background: rgba(255, 255, 255, 0.2);
    }
  }
`;

const UserInfo = styled.div`
  // ... existing code ...
`;

const AnalysisSection = styled.div`
  background: rgba(52, 152, 219, 0.1);
  border: 1px solid rgba(52, 152, 219, 0.2);
  border-radius: 12px;
  padding: 16px;
  margin-top: 20px;
  
  .analysis-header {
    font-size: 16px;
    font-weight: 600;
    margin-bottom: 12px;
    display: flex;
    align-items: center;
    gap: 8px;
    color: #3498db;
  }
  
  .analysis-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
    gap: 16px;
  }
  
  .analysis-item {
    .analysis-label {
      font-size: 12px;
      opacity: 0.7;
      margin-bottom: 4px;
    }
    .analysis-value {
      font-size: 18px;
      font-weight: 600;
    }
  }
`;

const EmptyState = styled.div`
  text-align: center;
  padding: 40px;
  opacity: 0.7;
  
  .empty-icon {
    font-size: 48px;
    margin-bottom: 16px;
    opacity: 0.5;
  }
  
  .empty-title {
    font-size: 16px;
    font-weight: 500;
    margin-bottom: 8px;
  }
  
  .empty-description {
    font-size: 14px;
  }
`;

const PrintRelease = () => {
  const { loginWithPin, mockUsers } = useAuth();
  const { printJobs, releasePrintJob, printers, validateTokenAndExpiration, viewPrintJob } = usePrintJob();
  const params = useParams();
  const location = useLocation();
  const [authMethod, setAuthMethod] = useState(null);
  const [pin, setPin] = useState(['', '', '', '']);
  const [pinInputs, setPinInputs] = useState([null, null, null, null]);
  const [authenticatedUser, setAuthenticatedUser] = useState(null);
  const [selectedPrinter, setSelectedPrinter] = useState(null);
  const [loading, setLoading] = useState(false);
  const [linkTargetJobId, setLinkTargetJobId] = useState(null);
  const [autoPrintDone, setAutoPrintDone] = useState(false);
  const [printedViaIframe, setPrintedViaIframe] = useState(false);
  const [serverJob, setServerJob] = useState(null);
  
  // SECURITY: Multi-use support - track releases per session, NOT globally
  // - releasingRef prevents duplicate calls during same render cycle (React StrictMode)
  // - releasedInSession tracks successful releases to avoid redundant API calls
  // - Does NOT prevent multiple releases across page refreshes (by design)
  const releasingRef = React.useRef(false); // Prevent concurrent release attempts
  const releasedInSession = React.useRef(false); // Track if already released in current session
  const [cachedDocument, setCachedDocument] = useState(null); // Cache document in browser memory

  useEffect(() => {
    // Validate token and expiration (server-side or client-side)
    const jobId = params.jobId;
    const search = new URLSearchParams(location.search);
    const token = search.get('token');
    if (!jobId || !token) return;
    
    // Try server API validation first (permanent fix)
    const validateFromServer = async () => {
      try {
        const { api } = await import('../api/client');
        const response = await api.get(`/api/jobs/${jobId}?token=${token}`);
        if (response.data.job) {
          setServerJob(response.data.job);
          setLinkTargetJobId(jobId);
          // Cache document in browser memory for multi-use
          if (response.data.job.document) {
            setCachedDocument(response.data.job.document);
          }
        }
      } catch (apiError) {
        // Check if this is an expiration error (expected behavior)
        if (apiError.response?.status === 403) {
          const errorMsg = apiError.response.data?.error || '';
          if (errorMsg.includes('expired')) {
            toast.info('This print link has expired', { autoClose: 5000 });
          } else {
            toast.error(errorMsg || 'Invalid or expired print link');
          }
          return;
        }
        
        // API not available - use client-side validation (fallback)
        if (validateTokenAndExpiration) {
          const validation = validateTokenAndExpiration(jobId, token);
          if (!validation.valid) {
            const errorMsg = validation.error || 'Invalid or expired print link';
            if (errorMsg.includes('expired')) {
              toast.info(errorMsg, { autoClose: 5000 });
            } else {
              toast.error(errorMsg);
            }
            return;
          }
        }
        
        const job = printJobs.find(j => j.id === jobId && j.secureToken === token);
        if (job) {
          if (job.expiresAt && new Date(job.expiresAt) < new Date()) {
            toast.info('This print link has expired', { autoClose: 5000 });
            return;
          }
          setLinkTargetJobId(jobId);
          // Cache document for multi-use
          if (job.document) {
            setCachedDocument(job.document);
          }
        }
      }
    };
    
    validateFromServer();
  }, [params.jobId, location.search, printJobs, validateTokenAndExpiration]);

  // Auto-open print dialog for the actual document once auto-release is done
  useEffect(() => {
    if (!autoPrintDone) return;

    const jobId = params.jobId;
    // Use cached document first, fallback to job document
    const documentData = cachedDocument || serverJob?.document || printJobs.find(j => j.id === jobId)?.document;

    // If we have a stored document, load and print it via an iframe
    if (documentData?.dataUrl && !printedViaIframe) {
      console.log('Attempting to print document:', { mimeType: documentData.mimeType, name: documentData.name });
      const { dataUrl, mimeType } = documentData || {};
      const iframe = document.createElement('iframe');
      iframe.style.position = 'fixed';
      iframe.style.right = '0';
      iframe.style.bottom = '0';
      iframe.style.width = '0';
      iframe.style.height = '0';
      iframe.style.border = '0';
      document.body.appendChild(iframe);

      const printIframe = () => {
        try {
          if (!iframe.contentWindow) {
            throw new Error('Iframe content window not accessible');
          }
          iframe.contentWindow.focus();
          iframe.contentWindow.print();
          setPrintedViaIframe(true);
        } catch (error) {
          console.error('Iframe print failed:', error);
          
          // Fallback: Open in new window/tab to guarantee printing works
          try {
            console.log('Falling back to new window print...');
            toast.info('Opening document in new window for printing...');
            
            // Create a blob URL instead of data URL for better browser compatibility
            let urlToOpen = dataUrl;
            try {
              if (dataUrl.startsWith('data:')) {
                const arr = dataUrl.split(',');
                const mime = arr[0].match(/:(.*?);/)[1];
                const bstr = atob(arr[1]);
                let n = bstr.length;
                const u8arr = new Uint8Array(n);
                while(n--) {
                  u8arr[n] = bstr.charCodeAt(n);
                }
                const blob = new Blob([u8arr], {type: mime});
                urlToOpen = URL.createObjectURL(blob);
              }
            } catch (e) {
              console.warn('Failed to create blob URL, using data URL', e);
            }

            const printWindow = window.open(urlToOpen, '_blank');
            if (printWindow) {
              printWindow.focus();
              printWindow.onload = () => {
                setTimeout(() => {
                  printWindow.print();
                  setPrintedViaIframe(true);
                  // Clean up blob URL if used
                  if (urlToOpen !== dataUrl) {
                    URL.revokeObjectURL(urlToOpen);
                  }
                }, 1000);
              };
            } else {
              throw new Error('Popup blocked');
            }
          } catch (fallbackError) {
            console.error('Fallback print failed:', fallbackError);
            toast.error('Failed to print automatically. Please click the Print button or try downloading.');
          }
        }
      };

      const fileName = (documentData?.name || '').toLowerCase();
      // Check both MIME type and file extension for better detection
      const isPdf = (mimeType || '').includes('pdf') || fileName.endsWith('.pdf');
      const isImage = (mimeType || '').startsWith('image/') || /\.(jpg|jpeg|png|gif|bmp|webp|svg)$/.test(fileName);
      const isText = (mimeType || '').includes('text/') || (mimeType || '') === 'text/plain' || /\.(txt|csv)$/.test(fileName);
      const isWord = /msword|wordprocessingml/.test(mimeType || '') || /\.(doc|docx)$/.test(fileName);
      const isExcel = /excel|spreadsheetml/.test(mimeType || '') || /\.(xls|xlsx)$/.test(fileName);
      const isPowerPoint = /powerpoint|presentationml/.test(mimeType || '') || /\.(ppt|pptx)$/.test(fileName);
      const isOffice = isWord || isExcel || isPowerPoint || /officedocument/.test(mimeType || '');

      if (isPdf) {
        iframe.src = dataUrl;
        // Increase timeout to allow PDF viewer to fully initialize
        iframe.onload = () => setTimeout(printIframe, 100000);
      } else if (isImage) {
        const doc = iframe.contentWindow?.document;
        if (doc) {
          doc.open();
          doc.write(`<!DOCTYPE html><html><head><meta charset="utf-8" /><style>html,body{margin:0;padding:0;height:100%}img{display:block;max-width:100%;max-height:100%;margin:auto}</style></head><body><img src="${dataUrl}" /></body></html>`);
          doc.close();
          setTimeout(printIframe, 200000);
        } else {
          window.open(dataUrl, '_blank');
        }
      } else if (isText) {
        const doc = iframe.contentWindow?.document;
        if (doc) {
          // Decode base64 payload if present in data URL
          let textContent = '';
          try {
            const base64 = dataUrl.split(',')[1] || '';
            textContent = atob(base64);
          } catch (_) {}
          doc.open();
          doc.write(`<!DOCTYPE html><html><head><meta charset="utf-8" /></head><body><pre>${textContent.replace(/[&<>]/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;'}[ch]))}</pre></body></html>`);
          doc.close();
          setTimeout(printIframe, 200);
        } else {
          window.open(dataUrl, '_blank');
        }
      } else if (isOffice) {
        // Office documents (Word, Excel, PowerPoint) - try to use Office Online Viewer or download
        const officeType = isWord ? 'Word' : isExcel ? 'Excel' : 'PowerPoint';
        toast.info(`${officeType} documents open in a new window. Use your browser's print function.`);
        window.open(dataUrl, '_blank');
      } else if (isText) {
        // Additional text formats (CSV, etc.)
        const doc = iframe.contentWindow?.document;
        if (doc) {
          let textContent = '';
          try {
            const base64 = dataUrl.split(',')[1] || '';
            textContent = atob(base64);
          } catch (_) {}
          doc.open();
          doc.write(`<!DOCTYPE html><html><head><meta charset="utf-8" /></head><body><pre style="padding:20px;font-family:monospace;">${textContent.replace(/[&<>]/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;'}[ch]))}</pre></body></html>`);
          doc.close();
          setTimeout(printIframe, 200);
        } else {
          window.open(dataUrl, '_blank');
        }
      } else {
        // Unknown type: open in a new tab so the browser/plugin can handle it
        window.open(dataUrl, '_blank');
      }

      return () => {
        iframe.onload = null;
        document.body.removeChild(iframe);
      };
    }

    // If no embedded document is available, fallback to printing the page
    // const id = setTimeout(() => {
    //   try { window.print(); } catch (_) {}
    // }, 300);
    // return () => clearTimeout(id);

    if (!documentData?.dataUrl && !printedViaIframe) {
      console.warn('Document content not found, cannot auto-print.');
      toast.error('Document content not available for printing. Please try downloading it instead.');
    }
  }, [autoPrintDone, printedViaIframe, params.jobId, printJobs, serverJob, cachedDocument]);

  // Auto-authenticate and release if valid token and jobId are present
  // SECURITY: Multi-use design - can be called multiple times (page refresh)
  // - releasingRef prevents duplicate calls in same render cycle (React StrictMode)
  // - releasedInSession prevents redundant API calls within same page load
  // - Page refresh resets session state, allowing re-validation
  useEffect(() => {
    const jobId = params.jobId;
    const search = new URLSearchParams(location.search);
    const token = search.get('token');
    
    // Skip if: no job/token, already releasing, or already released in this session
    if (!jobId || !token || releasingRef.current || releasedInSession.current) return;
    
    // Use cached document or fetch from server/printJobs
    const documentData = cachedDocument || serverJob?.document;
    const job = serverJob || printJobs.find(j => j.id === jobId && j.secureToken === token);
    if (!job) return;
    
    // Find the user for this job
    const user = mockUsers.find(u => String(u.id) === String(job.userId));
    if (!user) return;
    
    // Find the first available online printer
    const printer = printers.find(p => p.status === 'online');
    if (!printer) return;
    
    // Mark as releasing to prevent duplicate calls (React StrictMode)
    releasingRef.current = true;
    setAuthenticatedUser(user);
    setSelectedPrinter(printer);
    setLoading(true);
    
    // Release the job automatically
    releasePrintJob(jobId, printer.id, user.id, token)
      .then(() => {
        // Success - mark as released in this session
        releasedInSession.current = true;
        toast.success('Print job released successfully! You can print multiple times until the link expires.', {
          autoClose: 5000
        });
        setAutoPrintDone(true);
        
        // Cache document for future prints in this session
        if (documentData && !cachedDocument) {
          setCachedDocument(documentData);
        }
      })
      .catch((err) => {
        // Check if error is due to expiration (expected behavior)
        const errorMsg = err.message || 'Unknown error';
        if (errorMsg.includes('expired')) {
          toast.info('This print link has expired', { autoClose: 5000 });
        } else if (errorMsg.includes('already been used')) {
          // Should not happen with multi-use backend, but handle gracefully
          toast.info('This link was already used in another session. The link remains valid until expiration.', {
            autoClose: 5000
          });
          releasedInSession.current = true; // Treat as success
        } else {
          toast.error('Failed to release print job: ' + errorMsg);
        }
        // Reset releasing flag on error so user can retry manually
        releasingRef.current = false;
      })
      .finally(() => setLoading(false));
  }, [params.jobId, location.search, printJobs, printers, mockUsers, releasePrintJob, serverJob, cachedDocument]);

  const userJobs = authenticatedUser 
    ? [
        // Include serverJob if it matches user (ignore status for multi-use)
        ...(serverJob && serverJob.userId === authenticatedUser.id ? [serverJob] : []),
        // Include printJobs that match user (ignore status for multi-use)
        ...printJobs.filter(job => job.userId === authenticatedUser.id && job.id !== serverJob?.id)
      ]
    : [];

  const jobsToShow = linkTargetJobId
    ? userJobs.filter(j => j.id === linkTargetJobId)
    : userJobs;

  // Helper functions for button states
  const isJobWithinTimeLimit = (job) => {
    if (!job.expiresAt) return true;
    return new Date(job.expiresAt) > new Date();
  };

  const isJobValidForPrinting = (job) => {
    // Must be within time limit AND have document data (or be able to fetch it)
    return isJobWithinTimeLimit(job);
  };

  const getPrintButtonTitle = (job) => {
    if (!isJobWithinTimeLimit(job)) {
      return 'Print link has expired';
    }
    return 'Print Document';
  };

  const getReleaseButtonTitle = (job) => {
    if (loading) return 'Releasing...';
    if (!selectedPrinter) return 'Select a printer first';
    if (job.viewCount === 0) return 'Must view document first';
    if (!isJobWithinTimeLimit(job)) return 'Print link has expired';
    return 'Release job to printer';
  };

  // BUGFIX: Ensure document data is available for display
  // If cachedDocument exists, attach it to jobs that don't have document data
  const jobsWithDocuments = jobsToShow.map(job => {
    // Priority 1: Job already has document with dataUrl
    if (job.document?.dataUrl) {
      return job;
    }
    // Priority 2: Use cached document if job IDs match
    if (cachedDocument && (linkTargetJobId === job.id || jobsToShow.length === 1)) {
      console.log(`Attaching cached document to job ${job.id}`);
      return { ...job, document: cachedDocument };
    }
    // Priority 3: No document available - this is fine, buttons will fetch when clicked
    console.log(`Job ${job.id} (${job.documentName}) has no document data yet`);
    return job;
  });

  const handlePinChange = (index, value) => {
    if (value.length > 1) return;
    
    const newPin = [...pin];
    newPin[index] = value;
    setPin(newPin);
    
    if (value && index < 3) {
      pinInputs[index + 1]?.focus();
    }
  };

  const handlePinSubmit = async () => {
    const pinString = pin.join('');
    if (pinString.length !== 4) {
      toast.error('Please enter a 4-digit PIN');
      return;
    }

    setLoading(true);
    try {
      const result = await loginWithPin(pinString);
      setAuthenticatedUser(result.user);
      toast.success(`Welcome, ${result.user.name}!`);
      setPin(['', '', '', '']);
    } catch (error) {
      toast.error('Invalid PIN');
      setPin(['', '', '', '']);
    } finally {
      setLoading(false);
    }
  };

  const handleReleaseJob = async (jobId) => {
    if (!selectedPrinter) {
      toast.error('Please select a printer first');
      return;
    }

    // Find the job
    const job = jobsWithDocuments.find(j => j.id === jobId);
    if (!job) {
      toast.error('Job not found');
      return;
    }

    // Security: Check if within time limit
    if (!isJobWithinTimeLimit(job)) {
      toast.info('Print link has expired');
      return;
    }

    setLoading(true);
    try {
      const token = new URLSearchParams(location.search).get('token');
      await releasePrintJob(jobId, selectedPrinter.id, authenticatedUser.id, token);
      toast.success('Print job released successfully!');
      
      // Cache document for future use if we have it
      if (job?.document && !cachedDocument) {
        setCachedDocument(job.document);
      }
    } catch (error) {
      const errorMsg = error.message || 'Failed to release print job';
      if (errorMsg.includes('expired')) {
        toast.info('This print link has expired', { autoClose: 5000 });
      } else {
        toast.error(errorMsg);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleReleaseAll = async () => {
    if (!selectedPrinter) {
      toast.error('Please select a printer first');
      return;
    }

    setLoading(true);
    try {
      const token = new URLSearchParams(location.search).get('token');
      let successCount = 0;
      let errorCount = 0;
      
      for (const job of jobsWithDocuments) {
        // Check security constraints for each job
        if (!isJobWithinTimeLimit(job)) {
          errorCount++;
          console.warn(`Skipping job ${job.id}: Link expired`);
          continue;
        }
        
        try {
          await releasePrintJob(job.id, selectedPrinter.id, authenticatedUser.id, token);
          successCount++;
          // Cache document if we have it
          if (job?.document && !cachedDocument) {
            setCachedDocument(job.document);
          }
        } catch (error) {
          errorCount++;
          console.error(`Failed to release job ${job.id}:`, error.message);
        }
      }
      
      if (successCount > 0) {
        toast.success(`Successfully released ${successCount} job(s)! ${errorCount > 0 ? `(${errorCount} skipped due to constraints)` : ''}`);
      } else if (errorCount > 0) {
        toast.error(`Could not release any jobs. Check that links are not expired.`);
      }
    } catch (error) {
      const errorMsg = error.message || 'Failed to release some print jobs';
      if (errorMsg.includes('expired')) {
        toast.info('One or more print links have expired', { autoClose: 5000 });
      } else {
        toast.error(errorMsg);
      }
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // Helper: Convert data URL to Blob URL to avoid browser size limits
  const convertDataUrlToBlob = (dataUrl) => {
    try {
      if (!dataUrl.startsWith('data:')) return dataUrl;
      
      const arr = dataUrl.split(',');
      const mime = arr[0].match(/:(.*?);/)[1];
      const bstr = atob(arr[1]);
      let n = bstr.length;
      const u8arr = new Uint8Array(n);
      while(n--) {
        u8arr[n] = bstr.charCodeAt(n);
      }
      const blob = new Blob([u8arr], {type: mime});
      return URL.createObjectURL(blob);
    } catch (e) {
      console.warn('Failed to create blob URL, using data URL fallback', e);
      return dataUrl;
    }
  };

  const handleViewDocument = async (job) => {
    // Security: Check if within time limit
    if (!isJobWithinTimeLimit(job)) {
      toast.info('Print link has expired');
      return;
    }
    
    setLoading(true);
    
    try {
      // Use cached document first, fallback to job document
      let documentData = cachedDocument || job?.document;
      
      // If no document data, fetch it (no view count restrictions)
      if (!documentData?.dataUrl) {
        try {
          const fetchedData = await viewPrintJob(job.id, job.secureToken, authenticatedUser?.id || 'anonymous');
          if (fetchedData?.dataUrl) {
            documentData = fetchedData;
            // Cache it for future use
            setCachedDocument(fetchedData);
          }
        } catch (error) {
          console.error('Failed to fetch document for viewing:', error);
          toast.error('Failed to load document: ' + error.message);
          return;
        }
      }
      
      // Check if we have document content AFTER fetching
      if (!documentData?.dataUrl) {
        toast.error('Document content not available for preview');
        return;
      }

      const { dataUrl, mimeType, name } = documentData;
      const isPdf = (mimeType || '').includes('pdf');
      const isImage = (mimeType || '').startsWith('image/');
      const isText = (mimeType || '').includes('text/');
      const isWord = /msword|wordprocessingml/.test(mimeType || '');
      const isExcel = /excel|spreadsheetml/.test(mimeType || '');
      const isPowerPoint = /powerpoint|presentationml/.test(mimeType || '');
      const isOffice = isWord || isExcel || isPowerPoint;

      // For PDFs and images, open in a new window for viewing/printing
      if (isPdf || isImage) {
        if (isPdf) {
          // Convert to blob URL for PDFs (avoids data URL size limits)
          const blobUrl = convertDataUrlToBlob(dataUrl);
          const printWindow = window.open(blobUrl, '_blank');
          
          if (!printWindow) {
            toast.error('Failed to open document window. Please check popup blocker.');
            return;
          }
          
          // Cleanup blob URL after window loads
          if (blobUrl !== dataUrl && printWindow) {
            printWindow.addEventListener('load', () => {
              setTimeout(() => URL.revokeObjectURL(blobUrl), 5000);
            });
          }
        } else if (isImage) {
          const printWindow = window.open('', '_blank');
          if (!printWindow) {
            toast.error('Failed to open document window. Please check popup blocker.');
            return;
          }
          
          printWindow.document.write(`
            <!DOCTYPE html>
            <html>
              <head>
                <title>${name || 'Document'}</title>
                <style>
                  body { margin: 0; padding: 20px; text-align: center; background: #f5f5f5; }
                  img { max-width: 100%; height: auto; box-shadow: 0 4px 8px rgba(0,0,0,0.1); }
                </style>
              </head>
              <body>
                <img src="${dataUrl}" alt="${name || 'Document'}" />
                <script>window.onload = function() { window.focus(); }</script>
              </body>
            </html>
          `);
          printWindow.document.close();
        }
      } else if (isText) {
        // For text files, open in a new window with formatted text
        const printWindow = window.open('', '_blank');
        if (!printWindow) {
          toast.error('Failed to open document window. Please check popup blocker.');
          return;
        }
        
        try {
          const base64 = dataUrl.split(',')[1] || '';
          const textContent = atob(base64);
          printWindow.document.write(`
            <!DOCTYPE html>
            <html>
              <head>
                <title>${name || 'Document'}</title>
                <style>
                  body { margin: 0; padding: 20px; font-family: monospace; background: white; }
                  pre { white-space: pre-wrap; word-wrap: break-word; }
                </style>
              </head>
              <body>
                <pre>${textContent.replace(/[&<>]/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;'}[ch]))}</pre>
              </body>
            </html>
          `);
          printWindow.document.close();
        } catch (err) {
          window.open(dataUrl, '_blank');
        }
      } else if (isOffice) {
        // For Office documents, open for download/viewing
        const officeType = isWord ? 'Word' : isExcel ? 'Excel' : 'PowerPoint';
        toast.info(`Opening ${officeType} document. Use File > Print in your application to print.`);
        
        // Create a download link
        const link = document.createElement('a');
        link.href = dataUrl;
        link.download = name || 'document';
        link.target = '_blank';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      } else {
        // For other formats, try to open directly
        // Use blob URL for safety (handles large files)
        const blobUrl = convertDataUrlToBlob(dataUrl);
        const printWindow = window.open(blobUrl, '_blank');
        
        if (!printWindow) {
          toast.error('Failed to open document window. Please check popup blocker.');
          return;
        }
        
        // Cleanup blob URL after window loads
        if (blobUrl !== dataUrl && printWindow) {
          printWindow.addEventListener('load', () => {
            setTimeout(() => URL.revokeObjectURL(blobUrl), 5000);
          });
        }
      }
    } finally {
      setLoading(false);
    }
  };

  const handlePrintDocument = async (job) => {
    // Security: Check if within time limit
    if (!isJobWithinTimeLimit(job)) {
      toast.info('Print link has expired');
      return;
    }
    
    setLoading(true);
    
    try {
      // Use cached document first, fallback to job document
      let documentData = cachedDocument || job?.document;
      
      // If no document data, fetch it (no view count restrictions)
      if (!documentData?.dataUrl) {
        try {
          const fetchedData = await viewPrintJob(job.id, job.secureToken, authenticatedUser?.id || 'anonymous');
          if (fetchedData?.dataUrl) {
            documentData = fetchedData;
            // Cache it for future use
            setCachedDocument(fetchedData);
          }
        } catch (error) {
          console.error('Failed to fetch document for printing:', error);
          toast.error('Failed to load document: ' + error.message);
          return;
        }
      }
      
      // Check if we have document content AFTER fetching
      if (!documentData?.dataUrl) {
        toast.error('Document content not available for printing');
        return;
      }

      const { dataUrl, mimeType, name } = documentData;
      const isPdf = (mimeType || '').includes('pdf');
      const isImage = (mimeType || '').startsWith('image/');
      const isText = (mimeType || '').includes('text/');
      const isWord = /msword|wordprocessingml/.test(mimeType || '');
      const isExcel = /excel|spreadsheetml/.test(mimeType || '');
      const isPowerPoint = /powerpoint|presentationml/.test(mimeType || '');
      const isOffice = isWord || isExcel || isPowerPoint;

      // Create hidden iframe for printing
      const iframe = document.createElement('iframe');
      iframe.style.position = 'fixed';
      iframe.style.right = '0';
      iframe.style.bottom = '0';
      iframe.style.width = '0';
      iframe.style.height = '0';
      iframe.style.border = '0';
      document.body.appendChild(iframe);

      // Function to handle printing after iframe loads
      const printIframe = () => {
        try {
          if (!iframe.contentWindow) {
            throw new Error('Iframe content window not accessible');
          }
          iframe.contentWindow.focus();
          iframe.contentWindow.print();
        } catch (error) {
          console.error('Iframe print failed:', error);
          // Fallback to new window
          const printWindow = window.open(dataUrl, '_blank');
          if (printWindow) {
            printWindow.focus();
            printWindow.onload = () => {
              setTimeout(() => printWindow.print(), 1000);
            };
          }
        }
      };

      // Handle different file types
      if (isPdf) {
        // For PDFs, use blob URL and iframe
        const blobUrl = convertDataUrlToBlob(dataUrl);
        iframe.src = blobUrl;
        iframe.onload = () => {
          setTimeout(printIframe, 2000); // Give PDF viewer time to load
          // Cleanup blob URL after printing
          if (blobUrl !== dataUrl) {
            setTimeout(() => URL.revokeObjectURL(blobUrl), 10000);
          }
        };
      } else if (isImage) {
        // For images, create HTML content in iframe
        const doc = iframe.contentWindow?.document;
        if (doc) {
          doc.open();
          doc.write(`<!DOCTYPE html>
            <html>
              <head>
                <meta charset="utf-8" />
                <title>${name || 'Document'}</title>
                <style>
                  html,body { margin: 0; padding: 20px; height: 100%; text-align: center; }
                  img { display: block; max-width: 100%; max-height: 100%; margin: auto; }
                  @media print { body { padding: 0; } }
                </style>
              </head>
              <body>
                <img src="${dataUrl}" alt="${name || 'Document'}" />
              </body>
            </html>`);
          doc.close();
          setTimeout(printIframe, 1000);
        } else {
          // Fallback if iframe document not accessible
          const printWindow = window.open('', '_blank');
          if (!printWindow) {
            toast.error('Failed to open print window. Please check popup blocker.');
            return;
          }
          
          printWindow.document.write(`<!DOCTYPE html>
            <html>
              <head>
                <title>${name || 'Document'}</title>
                <style>
                  body { margin: 0; padding: 20px; text-align: center; }
                  img { max-width: 100%; height: auto; }
                </style>
              </head>
              <body>
                <img src="${dataUrl}" alt="${name || 'Document'}" />
              </body>
            </html>`);
          printWindow.document.close();
          printWindow.onload = () => setTimeout(() => printWindow.print(), 500);
        }
      } else if (isText) {
        // For text files, create formatted content in iframe
        try {
          const base64 = dataUrl.split(',')[1] || '';
          const textContent = atob(base64);
          const doc = iframe.contentWindow?.document;
          if (doc) {
            doc.open();
            doc.write(`<!DOCTYPE html>
              <html>
                <head>
                  <meta charset="utf-8" />
                  <title>${name || 'Document'}</title>
                  <style>
                    body { margin: 0; padding: 20px; font-family: monospace; }
                    pre { white-space: pre-wrap; word-wrap: break-word; }
                    @media print { body { padding: 10px; } }
                  </style>
                </head>
                <body>
                  <pre>${textContent.replace(/[&<>]/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;'}[ch]))}</pre>
                </body>
              </html>`);
            doc.close();
            setTimeout(printIframe, 500);
          } else {
            // Fallback
            const printWindow = window.open('', '_blank');
            if (!printWindow) {
              toast.error('Failed to open print window. Please check popup blocker.');
              return;
            }
            
            printWindow.document.write(`<!DOCTYPE html>
              <html>
                <head>
                  <title>${name || 'Document'}</title>
                  <style>
                    body { margin: 0; padding: 20px; font-family: monospace; }
                    pre { white-space: pre-wrap; word-wrap: break-word; }
                  </style>
                </head>
                <body>
                  <pre>${textContent.replace(/[&<>]/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;'}[ch]))}</pre>
                </body>
              </html>`);
            printWindow.document.close();
            printWindow.onload = () => setTimeout(() => printWindow.print(), 500);
          }
        } catch (err) {
          toast.error('Unable to print text document');
        }
      } else if (isOffice) {
        // For Office documents, download and inform user
        toast.info('Office documents need to be opened in their native application to print. Downloading file...');
        const link = document.createElement('a');
        link.href = dataUrl;
        link.download = name || 'document';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      } else {
        // For other formats, try iframe first, fallback to new window
        const blobUrl = convertDataUrlToBlob(dataUrl);
        iframe.src = blobUrl;
        iframe.onload = () => {
          setTimeout(printIframe, 1000);
          if (blobUrl !== dataUrl) {
            setTimeout(() => URL.revokeObjectURL(blobUrl), 5000);
          }
        };
      }

      // Cleanup iframe after printing
      setTimeout(() => {
        if (document.body.contains(iframe)) {
          document.body.removeChild(iframe);
        }
      }, 15000); // Remove after 15 seconds to ensure print dialog has time to appear

    } finally {
      setLoading(false);
    }
  };

  const getInitials = (name) => {
    return name
      ?.split(' ')
      .map(word => word[0])
      .join('')
      .toUpperCase()
      .slice(0, 2) || 'U';
  };

  return (
    <ReleaseContainer>
      <PageHeader>
        <h1>Secure Print Release</h1>
        <p>Authenticate and release your print jobs at any compatible printer</p>
      </PageHeader>

      <PrinterInterface>
        <PrinterHeader>
          <div className="printer-name">Main Office Printer</div>
          <div className="printer-status">
            <div className="status-dot"></div>
            <span>Online & Ready</span>
          </div>
        </PrinterHeader>

        {!authenticatedUser ? (
          <>
            <AuthSection>
              <AuthMethod 
                className={authMethod === 'pin' ? 'active' : ''}
                onClick={() => setAuthMethod('pin')}
              >
                <FaKey className="auth-icon" />
                <div className="auth-title">PIN Authentication</div>
                <div className="auth-description">
                  Enter your 4-digit PIN to access your print jobs
                </div>
              </AuthMethod>

              <AuthMethod 
                className={authMethod === 'qr' ? 'active' : ''}
                onClick={() => setAuthMethod('qr')}
              >
                <FaQrcode className="auth-icon" />
                <div className="auth-title">QR Code Scan</div>
                <div className="auth-description">
                  Scan QR code from mobile app for instant access
                </div>
              </AuthMethod>
            </AuthSection>

            {authMethod === 'pin' && (
              <div style={{ textAlign: 'center' }}>
                <PinInput>
                  {pin.map((digit, index) => (
                    <input
                      key={index}
                      type="text"
                      maxLength="1"
                      value={digit}
                      onChange={(e) => handlePinChange(index, e.target.value)}
                      ref={(el) => setPinInputs(prev => { prev[index] = el; return prev; })}
                      autoFocus={index === 0}
                      placeholder="•"
                    />
                  ))}
                </PinInput>
                <ActionButton 
                  className="primary" 
                  onClick={handlePinSubmit}
                  disabled={loading || pin.join('').length !== 4}
                >
                  {loading ? 'Authenticating...' : 'Authenticate'}
                </ActionButton>
              </div>
            )}

            {authMethod === 'qr' && (
              <QRCodeDisplay>
                <div className="qr-code">
                  <QRCodeCanvas 
                    value={JSON.stringify({
                      type: 'secure-print-release',
                      timestamp: Date.now(),
                      sessionId: Math.random().toString(36).substr(2, 9)
                    })} 
                    size={200} 
                  />
                </div>
                <div className="qr-instructions">
                  Open the Secure Print Link mobile app and scan this QR code to authenticate automatically.
                  <br />
                  <strong>Demo PIN:</strong> 1234 (Admin), 5678 (User 1), 9012 (User 2)
                </div>
              </QRCodeDisplay>
            )}
          </>
        ) : (
          <>
            <UserInfo>
              <div className="user-avatar">
                {getInitials(authenticatedUser.name)}
              </div>
              <div className="user-details">
                <div className="user-name">{authenticatedUser.name}</div>
                <div className="user-role">{authenticatedUser.role} • {authenticatedUser.department}</div>
              </div>
            </UserInfo>

            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px' }}>
                Select Printer:
              </label>
              <select
                value={selectedPrinter?.id || ''}
                onChange={(e) => {
                  const printer = printers.find(p => p.id === parseInt(e.target.value));
                  setSelectedPrinter(printer);
                }}
                style={{
                  width: '100%',
                  padding: '12px',
                  borderRadius: '8px',
                  background: 'rgba(255, 255, 255, 0.1)',
                  border: '1px solid rgba(255, 255, 255, 0.3)',
                  color: 'white',
                  fontSize: '14px'
                }}
              >
                <option value="">Choose a printer...</option>
                {printers.filter(p => p.status === 'online').map(printer => (
                  <option key={printer.id} value={printer.id}>
                    {printer.name} - {printer.location}
                  </option>
                ))}
              </select>
            </div>

            <JobsSection>
              <JobsHeader>
                <div className="jobs-title">Your Print Jobs</div>
                <div className="jobs-count">{userJobs.length} pending</div>
              </JobsHeader>

              {userJobs.length > 0 ? (
                <>
                  <JobList>
                    {jobsWithDocuments.map(job => (
                      <JobItem key={job.id} style={{ flexDirection: 'column', alignItems: 'stretch' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                          <div className="job-info">
                            <div className="job-icon">
                              <FaPrint />
                            </div>
                            <div className="job-details">
                              <div className="job-name">{job.documentName || 'Document'}</div>
                              <div className="job-meta">
                                {formatDate(job.submittedAt)} • {job.pages} pages • {job.copies} copies • ${job.cost}
                              </div>
                            </div>
                          </div>
                          <div className="job-actions">
                            <ActionButton 
                              className="secondary"
                              onClick={() => handleViewDocument(job)}
                              title="View Document"
                              style={{ padding: '8px 12px', minWidth: 'auto' }}
                            >
                              <FaEye style={{ marginRight: '4px' }} />
                              View
                            </ActionButton>
                            <ActionButton 
                              className="secondary"
                              onClick={() => handlePrintDocument(job)}
                              disabled={!isJobValidForPrinting(job)}
                              title={getPrintButtonTitle(job)}
                              style={{ padding: '8px 12px', minWidth: 'auto', opacity: isJobValidForPrinting(job) ? 1 : 0.6 }}
                            >
                              <FaPrint style={{ marginRight: '4px' }} />
                              Print
                            </ActionButton>
                            <ActionButton 
                              className="primary"
                              onClick={() => handleReleaseJob(job.id)}
                              disabled={loading || !selectedPrinter || !isJobWithinTimeLimit(job)}
                              title={getReleaseButtonTitle(job)}
                            >
                              Release
                            </ActionButton>
                          </div>
                        </div>

                        {job.analysis && (
                          <AnalysisSection>
                            <div className="analysis-header">
                              <FaChartBar /> Document Analysis
                            </div>
                            <div className="analysis-grid">
                              <div className="analysis-item">
                                <div className="analysis-label">Estimated Word Count</div>
                                <div className="analysis-value">{job.analysis.wordCount?.toLocaleString() || 'N/A'}</div>
                              </div>
                              <div className="analysis-item">
                                <div className="analysis-label">Analysis Status</div>
                                <div className="analysis-value">{job.analysis.status || 'Completed'}</div>
                              </div>
                              <div className="analysis-item">
                                <div className="analysis-label">Features Detected</div>
                                <div className="analysis-value">{job.analysis.features?.length || 0}</div>
                              </div>
                            </div>
                          </AnalysisSection>
                        )}
                      </JobItem>
                    ))}
                  </JobList>
                  
                  <div style={{ marginTop: '20px', textAlign: 'center' }}>
                    <ActionButton 
                      className="primary"
                      onClick={handleReleaseAll}
                      disabled={loading || !selectedPrinter || jobsWithDocuments.length === 0}
                    >
                      {loading ? 'Releasing...' : `Release All Jobs (${jobsWithDocuments.length})`}
                    </ActionButton>
                  </div>
                </>
              ) : (
                <EmptyState>
                  <FaPrint className="empty-icon" />
                  <div className="empty-title">No pending print jobs</div>
                  <div className="empty-description">
                    All your print jobs have been released or completed
                  </div>
                </EmptyState>
              )}
            </JobsSection>

            <div style={{ textAlign: 'center', marginTop: '20px' }}>
              <ActionButton 
                className="secondary"
                onClick={() => {
                  setAuthenticatedUser(null);
                  setAuthMethod(null);
                  setSelectedPrinter(null);
                }}
              >
                Sign Out
              </ActionButton>
            </div>
          </>
        )}
      </PrinterInterface>
    </ReleaseContainer>
  );
};

export default PrintRelease;
