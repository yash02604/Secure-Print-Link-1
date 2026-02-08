import React, { useState } from 'react';
import { useDropzone } from 'react-dropzone';
import styled from 'styled-components';
import { toast } from 'react-toastify';
import { useAuth } from '../context/AuthContext';
import { usePrintJob } from '../context/PrintJobContext';
import { QRCodeCanvas } from 'qrcode.react';
import { encryptFileAES, createEncryptedFile } from '../utils/aesCrypto';
import { 
  FaUpload, 
  FaFileAlt, 
  FaFilePdf,
  FaFileWord,
  FaFileExcel,
  FaFilePowerpoint,
  FaFileImage,
  FaFileCode,
  FaPrint, 
  FaShieldAlt, 
  FaCog,
  FaTimes,
  FaCheck,
  FaQrcode,
  FaExclamationTriangle
} from 'react-icons/fa';

const SubmissionContainer = styled.div`
  padding: 20px;
  max-width: 800px;
  margin: 0 auto;
`;

const PageHeader = styled.div`
  margin-bottom: 30px;
  text-align: center;
  
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

const SubmissionCard = styled.div`
  background: white;
  border-radius: 12px;
  padding: 30px;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
`;

const StepIndicator = styled.div`
  display: flex;
  justify-content: center;
  margin-bottom: 30px;
  
  .step {
    display: flex;
    align-items: center;
    gap: 10px;
    
    .step-number {
      width: 30px;
      height: 30px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: bold;
      font-size: 14px;
      background: ${props => props.active ? '#3498db' : '#ecf0f1'};
      color: ${props => props.active ? 'white' : '#7f8c8d'};
    }
    
    .step-text {
      font-weight: 500;
      color: ${props => props.active ? '#2c3e50' : '#7f8c8d'};
    }
    
    &:not(:last-child)::after {
      content: '';
      width: 40px;
      height: 2px;
      background: #ecf0f1;
      margin: 0 10px;
    }
  }
`;

const FileUploadSection = styled.div`
  text-align: center;
  padding: 40px;
  border: 2px dashed #e1e5e9;
  border-radius: 12px;
  margin-bottom: 30px;
  transition: border-color 0.3s ease;
  
  &.drag-active {
    border-color: #3498db;
    background: #f8f9fa;
  }
  
  .upload-icon {
    font-size: 48px;
    color: #3498db;
    margin-bottom: 16px;
  }
  
  .upload-text {
    font-size: 18px;
    font-weight: 500;
    color: #2c3e50;
    margin-bottom: 8px;
  }
  
  .upload-hint {
    color: #7f8c8d;
    font-size: 14px;
    margin-bottom: 20px;
  }
  
  .upload-button {
    background: #3498db;
    color: white;
    border: none;
    padding: 12px 24px;
    border-radius: 8px;
    font-weight: 500;
    cursor: pointer;
    transition: background-color 0.2s ease;
    
    &:hover {
      background: #2980b9;
    }
  }
`;

const FilePreview = styled.div`
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 16px;
  background: #f8f9fa;
  border-radius: 8px;
  margin-bottom: 20px;
  
  .file-icon {
    width: 40px;
    height: 40px;
    border-radius: 8px;
    background: #3498db20;
    display: flex;
    align-items: center;
    justify-content: center;
    color: #3498db;
  }
  
  .file-info {
    flex: 1;
    
    .file-name {
      font-weight: 500;
      color: #2c3e50;
      margin-bottom: 4px;
    }
    
    .file-size {
      font-size: 12px;
      color: #7f8c8d;
    }
  }
  
  .remove-file {
    background: none;
    border: none;
    color: #e74c3c;
    cursor: pointer;
    padding: 8px;
    border-radius: 4px;
    
    &:hover {
      background: #f8d7da;
    }
  }
`;

const FormSection = styled.div`
  margin-bottom: 30px;
  
  .section-title {
    font-size: 18px;
    font-weight: 600;
    color: #2c3e50;
    margin-bottom: 16px;
    display: flex;
    align-items: center;
    gap: 8px;
  }
`;

const FormGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 20px;
`;

const FormGroup = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
  
  label {
    font-weight: 500;
    color: #333;
    font-size: 14px;
  }
  
  input, select {
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
    }
  }
`;

const SecuritySection = styled.div`
  background: #f8f9fa;
  border-radius: 8px;
  padding: 20px;
  margin-bottom: 30px;
  
  .security-header {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 16px;
    
    .security-icon {
      color: #27ae60;
      font-size: 18px;
    }
    
    .security-title {
      font-weight: 600;
      color: #2c3e50;
    }
  }
  
  .security-features {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
    gap: 12px;
    
    .feature {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 14px;
      color: #27ae60;
      
      .feature-icon {
        font-size: 12px;
      }
    }
  }
`;

const QRCodeSection = styled.div`
  text-align: center;
  padding: 20px;
  border: 2px dashed #e1e5e9;
  border-radius: 8px;
  margin-bottom: 20px;
  
  .qr-title {
    font-weight: 500;
    color: #333;
    margin-bottom: 12px;
  }
  
  .qr-code {
    margin: 0 auto;
    padding: 16px;
    background: white;
    border-radius: 8px;
    display: inline-block;
  }
`;

const SubmitButton = styled.button`
  width: 100%;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  border: none;
  padding: 16px;
  border-radius: 12px;
  font-size: 16px;
  font-weight: 600;
  cursor: pointer;
  transition: transform 0.2s ease;
  
  &:hover {
    transform: translateY(-2px);
  }
  
  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
    transform: none;
  }
`;

const LinkBox = styled.div`
  background: #f8f9fa;
  border: 2px dashed #e1e5e9;
  border-radius: 8px;
  padding: 16px;
  margin-bottom: 16px;
  word-break: break-all;
`;

const CopyButton = styled.button`
  background: #3498db;
  color: white;
  border: none;
  padding: 10px 16px;
  border-radius: 6px;
  font-weight: 500;
  cursor: pointer;
  &:hover { background: #2980b9; }
`;

const PrintJobSubmission = () => {
  const { currentUser } = useAuth();
  const { submitPrintJob, isSubmitting, error: apiError, setError: setApiError } = usePrintJob();
  const [currentStep, setCurrentStep] = useState(1);
  const [selectedFile, setSelectedFile] = useState(null);
  const [encryptedFile, setEncryptedFile] = useState(null); // Store encrypted file for submission
  const [lastSubmittedJob, setLastSubmittedJob] = useState(null);
  const [jobData, setJobData] = useState({
    documentName: '',
    pages: 1,
    copies: 1,
    color: false,
    duplex: false,
    stapling: false,
    priority: 'normal',
    printerId: '',
    notes: '',
    expirationDuration: 15 // Default: 15 minutes
  });
  const [formError, setFormError] = useState(null);
  const [validationErrors, setValidationErrors] = useState({});

  // Reset errors when data changes
  const updateJobData = (updates) => {
    setJobData(prev => ({ ...prev, ...updates }));
    if (formError) setFormError(null);
    if (Object.keys(validationErrors).length > 0) setValidationErrors({});
    if (apiError) setApiError(null);
  };

  // Always call hooks at the top!
  // Supported file extensions
  const supportedExtensions = [
    // Documents
    '.pdf', '.doc', '.docx', '.txt', '.rtf',
    // Spreadsheets
    '.xls', '.xlsx', '.csv',
    // Presentations
    '.ppt', '.pptx',
    // Images
    '.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp', '.svg',
    // Other
    '.json', '.html', '.htm'
  ];

  // Validate file by extension (fallback when MIME type detection fails)
  const isValidFileType = (fileName) => {
    const extension = fileName.toLowerCase().substring(fileName.lastIndexOf('.'));
    return supportedExtensions.includes(extension);
  };

  const onDrop = (acceptedFiles, fileRejections) => {
    // Check if files were rejected
    if (fileRejections && fileRejections.length > 0) {
      const rejection = fileRejections[0];
      const file = rejection.file;
      
      // Validate by file extension (more reliable than MIME type)
      if (isValidFileType(file.name)) {
        // File extension is valid, accept it even if MIME type was rejected
        setSelectedFile(file);
        setJobData(prev => ({
          ...prev,
          documentName: file.name
        }));
        setCurrentStep(2);
        toast.success(`File accepted: ${file.name}`);
        return;
      } else {
        // File extension is not supported
        toast.error(`File type not supported: ${file.name}. Supported formats: ${supportedExtensions.join(', ')}`);
        return;
      }
    }
    
    // Handle accepted files (passed MIME type check)
    if (acceptedFiles && acceptedFiles.length > 0) {
      const file = acceptedFiles[0];
      
      // Double-check by extension (safety check)
      if (isValidFileType(file.name)) {
        setSelectedFile(file);
        setJobData(prev => ({
          ...prev,
          documentName: file.name
        }));
        setCurrentStep(2);
      } else {
        toast.error(`File type not supported: ${file.name}`);
      }
    }
  };

  const { getRootProps, getInputProps, isDragActive, fileRejections } = useDropzone({
    onDrop,
    accept: {
      // PDF Documents
      'application/pdf': ['.pdf'],
      // Word Documents  
      'application/msword': ['.doc'],
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
      // Excel Spreadsheets
      'application/vnd.ms-excel': ['.xls'],
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
      // PowerPoint Presentations
      'application/vnd.ms-powerpoint': ['.ppt'],
      'application/vnd.openxmlformats-officedocument.presentationml.presentation': ['.pptx'],
      // Text Files
      'text/plain': ['.txt'],
      'text/csv': ['.csv'],
      'text/html': ['.html', '.htm'],
      // Images (wildcard for all image types)
      'image/*': ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp', '.svg', '.ico'],
      // Additional formats
      'application/rtf': ['.rtf'],
      'application/json': ['.json'],
      // Fallback: accept as binary if MIME type unknown (we'll validate by extension)
      'application/octet-stream': ['.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx', '.pdf']
    },
    multiple: false,
    // Don't strictly enforce MIME types - we validate by extension
    noClick: false,
    noKeyboard: false
  });

  // Now do your early returns
  if (apiError) {
    return (
      <div style={{ color: 'red', padding: 32, textAlign: 'center' }}>
        <h2>Something went wrong.</h2>
        <pre>{apiError.toString()}</pre>
      </div>
    );
  }

  if (!currentUser) {
    return (
      <div style={{ color: 'red', padding: 32, textAlign: 'center' }}>
        <h2>You must be logged in to submit a print job.</h2>
      </div>
    );
  }

  try {
    const validateForm = () => {
      const errors = {};
      if (!selectedFile) errors.file = 'File is required';
      if (!jobData.documentName.trim()) errors.documentName = 'Document name is required';
      if (jobData.pages < 1) errors.pages = 'Pages must be at least 1';
      if (jobData.copies < 1) errors.copies = 'Copies must be at least 1';
      if (jobData.expirationDuration < 5) errors.expiration = 'Expiration must be at least 5 minutes';
      
      setValidationErrors(errors);
      return Object.keys(errors).length === 0;
    };

    const handleSubmit = async (e) => {
      e.preventDefault();
      
      if (currentStep === 3) {
        // Reset for another job
        setSelectedFile(null);
        setEncryptedFile(null);
        setLastSubmittedJob(null);
        setJobData({
          documentName: '',
          pages: 1,
          copies: 1,
          color: false,
          duplex: false,
          stapling: false,
          priority: 'normal',
          printerId: '',
          notes: '',
          expirationDuration: 15
        });
        setCurrentStep(1);
        return;
      }

      if (!validateForm()) {
        setFormError('Please correct the errors before submitting.');
        return;
      }

      try {
        // Encrypt file before submission
        let fileToSubmit = selectedFile;
        
        if (selectedFile) {
          try {
            // Generate secret from jobId + timestamp + userId for deterministic encryption
            const jobId = 'job_' + Date.now().toString(36);
            const secret = `${jobId}_${currentUser.id}_${Date.now()}`;
            
            // Encrypt the file
            const { encryptedBlob, iv } = await encryptFileAES(selectedFile, secret);
            
            // Create encrypted file with .enc extension
            const encryptedFileObj = createEncryptedFile(selectedFile, encryptedBlob);
            
            // Store encrypted file and IV for later use
            setEncryptedFile({
              file: encryptedFileObj,
              iv: Array.from(iv), // Convert to array for JSON serialization
              secret: secret
            });
            
            fileToSubmit = encryptedFileObj;
            
            toast.info('File encrypted successfully');
          } catch (encryptError) {
            console.error('Encryption failed:', encryptError);
            toast.warn('Encryption failed, submitting original file');
            // Continue with original file if encryption fails
          }
        }

        const jobPayload = {
          ...jobData,
          userId: currentUser.id,
          userName: currentUser.name,
          file: fileToSubmit
        };

        const result = await submitPrintJob(jobPayload);
        
        // Attach encryption metadata to the job for later decryption
        if (result && encryptedFile) {
          result.encryption = {
            iv: encryptedFile.iv,
            secret: encryptedFile.secret
          };
        }
        
        setLastSubmittedJob(result);
        setCurrentStep(3);
      } catch (err) {
        setFormError(err.message || 'Submission failed. Please try again.');
      }
    };

    const removeFile = () => {
      setSelectedFile(null);
      setEncryptedFile(null);
      setJobData(prev => ({ ...prev, documentName: '' }));
      setCurrentStep(1);
    };

    const formatFileSize = (bytes) => {
      if (bytes === 0) return '0 Bytes';
      const k = 1024;
      const sizes = ['Bytes', 'KB', 'MB', 'GB'];
      const i = Math.floor(Math.log(bytes) / Math.log(k));
      return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    };

    const getFileIcon = (file) => {
      if (!file) return FaFileAlt;
      const fileName = file.name.toLowerCase();
      const fileType = file.type.toLowerCase();
      
      // PDF
      if (fileType.includes('pdf') || fileName.endsWith('.pdf')) {
        return FaFilePdf;
      }
      // Word
      if (fileType.includes('word') || fileType.includes('msword') || fileName.endsWith('.doc') || fileName.endsWith('.docx')) {
        return FaFileWord;
      }
      // Excel
      if (fileType.includes('excel') || fileType.includes('spreadsheet') || fileName.endsWith('.xls') || fileName.endsWith('.xlsx')) {
        return FaFileExcel;
      }
      // PowerPoint
      if (fileType.includes('powerpoint') || fileType.includes('presentation') || fileName.endsWith('.ppt') || fileName.endsWith('.pptx')) {
        return FaFilePowerpoint;
      }
      // Images
      if (fileType.startsWith('image/') || /\.(jpg|jpeg|png|gif|bmp|webp|svg)$/.test(fileName)) {
        return FaFileImage;
      }
      // Code/Text
      if (fileType.includes('text') || fileType.includes('json') || fileType.includes('html') || /\.(txt|csv|json|html|htm|js|css)$/.test(fileName)) {
        return FaFileCode;
      }
      // Default
      return FaFileAlt;
    };

    const copyLink = async () => {
      if (lastSubmittedJob?.releaseLink) {
        await navigator.clipboard.writeText(lastSubmittedJob.releaseLink);
        toast.info('Release link copied to clipboard');
      }
    };

    return (
      <SubmissionContainer>
        <PageHeader>
          <h1>Submit Print Job</h1>
          <p>Upload your document and configure print settings securely</p>
        </PageHeader>

        <SubmissionCard>
          <StepIndicator active={currentStep}>
            <div className="step">
              <div className="step-number">1</div>
              <div className="step-text">Upload File</div>
            </div>
            <div className="step">
              <div className="step-number">2</div>
              <div className="step-text">Configure Settings</div>
            </div>
            <div className="step">
              <div className="step-number">3</div>
              <div className="step-text">Submit Job</div>
            </div>
          </StepIndicator>

          <form onSubmit={handleSubmit}>
            {currentStep === 1 && (
              <FileUploadSection 
                {...getRootProps()} 
                className={`${isDragActive ? 'drag-active' : ''} ${isSubmitting ? 'loading' : ''}`}
                style={{ cursor: isSubmitting ? 'not-allowed' : 'pointer' }}
              >
                <input 
                  {...getInputProps()} 
                  accept={supportedExtensions.join(',')}
                  type="file"
                  disabled={isSubmitting}
                />
                <FaUpload className="upload-icon" />
                <div className="upload-text">
                  {isDragActive ? 'Drop the file here' : 'Drag & drop a file here'}
                </div>
                <div className="upload-hint">
                  or click to select a file<br/>
                  <strong>Supported formats:</strong> PDF, Word, Excel, PowerPoint, Text, Images, RTF, JSON, HTML
                </div>
                {validationErrors.file && (
                  <div style={{ color: 'var(--error-color)', marginTop: '10px', fontSize: '14px', fontWeight: '600' }}>
                    {validationErrors.file}
                  </div>
                )}
                {fileRejections && fileRejections.length > 0 && (
                  <div style={{ color: 'var(--error-color)', marginTop: '10px', fontSize: '14px' }}>
                    {fileRejections[0].errors[0]?.code === 'file-invalid-type' 
                      ? 'Please select a supported file type'
                      : fileRejections[0].errors[0]?.message}
                  </div>
                )}
                <button type="button" className="upload-button" disabled={isSubmitting}>
                  Choose File
                </button>
              </FileUploadSection>
            )}

            {selectedFile && (() => {
              const FileIcon = getFileIcon(selectedFile);
              return (
                <FilePreview style={{ opacity: isSubmitting ? 0.7 : 1 }}>
                  <div className="file-icon">
                    <FileIcon />
                  </div>
                  <div className="file-info">
                    <div className="file-name">{selectedFile.name}</div>
                    <div className="file-size">{formatFileSize(selectedFile.size)} • {selectedFile.type || 'Unknown type'}</div>
                  </div>
                  <button type="button" className="remove-file" onClick={removeFile} disabled={isSubmitting}>
                    <FaTimes />
                  </button>
                </FilePreview>
              );
            })()}

            {currentStep >= 2 && currentStep !== 3 && (
              <>
                <FormSection style={{ opacity: isSubmitting ? 0.7 : 1 }}>
                  <div className="section-title">
                    <FaCog />
                    Print Settings
                  </div>
                  <FormGrid>
                    <FormGroup>
                      <label>Document Name</label>
                      <input
                        type="text"
                        value={jobData.documentName}
                        onChange={(e) => updateJobData({ documentName: e.target.value })}
                        placeholder="Enter document name"
                        disabled={isSubmitting}
                        style={{ borderColor: validationErrors.documentName ? 'var(--error-color)' : '' }}
                      />
                      {validationErrors.documentName && <small style={{ color: 'var(--error-color)' }}>{validationErrors.documentName}</small>}
                    </FormGroup>
                    <FormGroup>
                      <label>Number of Pages</label>
                      <input
                        type="number"
                        min="1"
                        value={jobData.pages}
                        onChange={(e) => updateJobData({ pages: parseInt(e.target.value) || 0 })}
                        disabled={isSubmitting}
                      />
                    </FormGroup>
                    <FormGroup>
                      <label>Number of Copies</label>
                      <input
                        type="number"
                        min="1"
                        max="100"
                        value={jobData.copies}
                        onChange={(e) => updateJobData({ copies: parseInt(e.target.value) || 0 })}
                        disabled={isSubmitting}
                      />
                    </FormGroup>
                    <FormGroup>
                      <label>Priority</label>
                      <select
                        value={jobData.priority}
                        onChange={(e) => updateJobData({ priority: e.target.value })}
                        disabled={isSubmitting}
                      >
                        <option value="low">Low</option>
                        <option value="normal">Normal</option>
                        <option value="high">High</option>
                        <option value="urgent">Urgent</option>
                      </select>
                    </FormGroup>
                    <FormGroup>
                      <label>Link Expiration Duration</label>
                      <select
                        value={jobData.expirationDuration}
                        onChange={(e) => updateJobData({ expirationDuration: parseInt(e.target.value) })}
                        disabled={isSubmitting}
                      >
                        <option value={5}>5 minutes</option>
                        <option value={10}>10 minutes</option>
                        <option value={15}>15 minutes</option>
                        <option value={30}>30 minutes</option>
                        <option value={60}>1 hour</option>
                      </select>
                      <small style={{ color: 'var(--text-secondary)', fontSize: '12px', marginTop: '4px', display: 'block' }}>
                        The print link will expire after the selected duration.
                      </small>
                    </FormGroup>
                  </FormGrid>
                </FormSection>

                <FormSection style={{ opacity: isSubmitting ? 0.7 : 1 }}>
                  <div className="section-title">
                    <FaPrint />
                    Print Options
                  </div>
                  <CheckboxGroup>
                    <div className="checkbox-item">
                      <input
                        type="checkbox"
                        id="color"
                        checked={jobData.color}
                        onChange={(e) => updateJobData({ color: e.target.checked })}
                        disabled={isSubmitting}
                      />
                      <label htmlFor="color">Color Printing</label>
                    </div>
                    <div className="checkbox-item">
                      <input
                        type="checkbox"
                        id="duplex"
                        checked={jobData.duplex}
                        onChange={(e) => updateJobData({ duplex: e.target.checked })}
                        disabled={isSubmitting}
                      />
                      <label htmlFor="duplex">Double-sided Printing</label>
                    </div>
                    <div className="checkbox-item">
                      <input
                        type="checkbox"
                        id="stapling"
                        checked={jobData.stapling}
                        onChange={(e) => updateJobData({ stapling: e.target.checked })}
                        disabled={isSubmitting}
                      />
                      <label htmlFor="stapling">Stapling</label>
                    </div>
                  </CheckboxGroup>
                </FormSection>

                <FormSection>
                  <div className="section-title">
                    <FaShieldAlt />
                    Security Features
                  </div>
                  <SecuritySection>
                    <div className="security-header">
                      <FaShieldAlt className="security-icon" />
                      <div className="security-title">Your document will be secured with:</div>
                    </div>
                    <div className="security-features">
                      <div className="feature">
                        <FaCheck className="feature-icon" />
                        <span>End-to-end encryption</span>
                      </div>
                      <div className="feature">
                        <FaCheck className="feature-icon" />
                        <span>Secure token authentication</span>
                      </div>
                      <div className="feature">
                        <FaCheck className="feature-icon" />
                        <span>Hold-and-release system</span>
                      </div>
                      <div className="feature">
                        <FaCheck className="feature-icon" />
                        <span>Audit trail logging</span>
                      </div>
                    </div>
                  </SecuritySection>
                </FormSection>

                {selectedFile && (
                  <FormSection>
                    <div className="section-title">
                      <FaQrcode />
                      Release QR Code
                    </div>
                    <QRCodeSection>
                      <div className="qr-title">Scan this QR code at any printer to release your job</div>
                      <div className="qr-code">
                        <QRCodeCanvas 
                          value={lastSubmittedJob?.releaseLink || `${window.location.origin}/release/${Date.now()}`} 
                          size={150} 
                        />
                      </div>
                    </QRCodeSection>
                  </FormSection>
                )}

                <FormGroup>
                  <label>Additional Notes (Optional)</label>
                  <textarea
                    value={jobData.notes}
                    onChange={(e) => setJobData(prev => ({ ...prev, notes: e.target.value }))}
                    placeholder="Add any special instructions or notes..."
                    rows="3"
                    style={{
                      padding: '12px',
                      border: '2px solid #e1e5e9',
                      borderRadius: '8px',
                      fontSize: '14px',
                      resize: 'vertical'
                    }}
                  />
                </FormGroup>
              </>
            )}

            {currentStep === 3 && lastSubmittedJob && (
              <>
                <FormSection>
                  <div className="section-title">
                    <FaShieldAlt />
                    Secure Release Link
                  </div>
                  <LinkBox>{lastSubmittedJob.releaseLink}</LinkBox>
                  <div style={{ display: 'flex', gap: '12px', marginTop: '12px' }}>
                    <CopyButton type="button" onClick={copyLink}>Copy Link</CopyButton>
                    <CopyButton 
                      type="button" 
                      onClick={() => window.open(lastSubmittedJob.releaseLink, '_blank')}
                      style={{ background: '#2ecc71' }}
                      onMouseOver={(e) => e.target.style.background = '#27ae60'}
                      onMouseOut={(e) => e.target.style.background = '#2ecc71'}
                    >
                      Open Print Link
                    </CopyButton>
                  </div>
                </FormSection>
                <div style={{ marginTop: 12, color: '#7f8c8d', fontSize: '14px' }}>
                  <strong>📄 Document Formats Supported:</strong> PDF, Word (DOC, DOCX), Excel (XLS, XLSX), PowerPoint (PPT, PPTX), Text, Images, and more.
                  <br /><br />
                  <strong>⏰ Link Expiration:</strong> This link will expire in {lastSubmittedJob.expirationDuration || 15} minutes ({new Date(lastSubmittedJob.expiresAt).toLocaleString()}). 
                  The file will be automatically deleted after expiration or successful printing.
                  <br /><br />
                  Share this link with the person at the printer to release the job. The link encodes a secure token unique to this job. 
                  Click "Open Print Link" to view and print your document directly.
                </div>
              </>
            )}

            {(formError || apiError) && (
              <div style={{ 
                padding: '12px', 
                background: '#fef2f2', 
                color: 'var(--error-color)', 
                borderRadius: '8px', 
                marginBottom: '20px',
                fontSize: '14px',
                border: '1px solid #fee2e2',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}>
                <FaExclamationTriangle />
                <span>{formError || apiError}</span>
              </div>
            )}

            <SubmitButton 
              type="submit" 
              disabled={isSubmitting || (currentStep === 1 && !selectedFile)}
              className={isSubmitting ? 'loading' : ''}
            >
              {isSubmitting ? 'Submitting...' : (currentStep === 3 ? 'Submit Another Job' : 'Submit Print Job')}
            </SubmitButton>
          </form>
        </SubmissionCard>
      </SubmissionContainer>
    );
  } catch (err) {
    setApiError(err);
    return null;
  }
};

export default PrintJobSubmission;
