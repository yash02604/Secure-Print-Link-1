import React, { useState, useEffect } from 'react';
import styled from 'styled-components';
import { toast } from 'react-toastify';
import { useAuth } from '../context/AuthContext';
import { usePrintJob } from '../context/PrintJobContext';
import { useNavigate } from 'react-router-dom';
import EmptyState from '../components/EmptyState';
import { 
  FaPrint, 
  FaTrash, 
  FaEye, 
  FaCheckCircle,
  FaExclamationTriangle,
  FaClock,
  FaFileAlt,
  FaSearch,
  FaSort
} from 'react-icons/fa';

const QueueContainer = styled.div`
  display: flex;
  flex-direction: column;
  gap: var(--spacing-xl);
`;

const PageHeader = styled.div`
  h1 {
    font-size: var(--font-size-xxxl);
    font-weight: 800;
    color: var(--text-primary);
    margin-bottom: var(--spacing-xs);
    letter-spacing: -0.025em;
  }
  
  p {
    color: var(--text-secondary);
    font-size: var(--font-size-md);
  }
`;

const ControlsSection = styled.div`
  background: var(--background-card);
  border-radius: var(--border-radius-lg);
  padding: var(--spacing-xl);
  box-shadow: var(--shadow-sm);
  border: 1px solid var(--border-color);
`;

const ControlsGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
  gap: var(--spacing-lg);
  align-items: flex-end;
`;

const ControlGroup = styled.div`
  display: flex;
  flex-direction: column;
  gap: var(--spacing-sm);
  
  label {
    font-size: var(--font-size-sm);
    font-weight: 600;
    color: var(--text-primary);
  }
  
  .input-wrapper {
    position: relative;
    display: flex;
    align-items: center;
    
    .input-icon {
      position: absolute;
      left: 12px;
      color: var(--text-light);
      font-size: 14px;
    }
    
    input, select {
      width: 100%;
      padding: 10px 12px;
      padding-left: ${props => props.hasIcon ? '36px' : '12px'};
      background: var(--background-light);
      border: 1px solid var(--border-color);
      border-radius: var(--border-radius-md);
      font-size: var(--font-size-sm);
      color: var(--text-primary);
      transition: all var(--transition-fast);
      
      &:focus {
        border-color: var(--primary-color);
        background: white;
        box-shadow: 0 0 0 3px var(--primary-color)15;
      }
    }
  }
`;

const SortSection = styled.div`
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  flex-wrap: wrap;
  
  .sort-label {
    font-size: var(--font-size-sm);
    font-weight: 600;
    color: var(--text-secondary);
    margin-right: var(--spacing-xs);
  }
`;

const SortButton = styled.button`
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 16px;
  background: var(--background-light);
  border: 1px solid var(--border-color);
  border-radius: var(--border-radius-md);
  color: var(--text-secondary);
  font-size: var(--font-size-sm);
  font-weight: 600;
  transition: all var(--transition-fast);
  
  &:hover {
    background: white;
    border-color: var(--primary-color);
    color: var(--primary-color);
  }
  
  &.active {
    background: var(--primary-color);
    color: white;
    border-color: var(--primary-color);
    box-shadow: var(--shadow-sm);
  }
`;

const JobsContainer = styled.div`
  background: var(--background-card);
  border-radius: var(--border-radius-lg);
  box-shadow: var(--shadow-sm);
  border: 1px solid var(--border-color);
  overflow: hidden;
`;

const JobList = styled.div`
  display: flex;
  flex-direction: column;
`;

const JobItem = styled.div`
  display: grid;
  grid-template-columns: auto 1fr auto;
  align-items: center;
  gap: var(--spacing-xl);
  padding: var(--spacing-lg) var(--spacing-xl);
  border-bottom: 1px solid var(--border-color);
  transition: all var(--transition-fast);
  
  &:hover {
    background: var(--background-light);
  }
  
  &:last-child {
    border-bottom: none;
  }
  
  @media (max-width: 992px) {
    grid-template-columns: 1fr;
    gap: var(--spacing-md);
    padding: var(--spacing-lg);
  }
`;

const JobInfo = styled.div`
  min-width: 0;
  
  .job-title {
    font-size: var(--font-size-lg);
    font-weight: 700;
    color: var(--text-primary);
    margin-bottom: 4px;
    letter-spacing: -0.01em;
  }
  
  .job-details {
    display: flex;
    flex-wrap: wrap;
    gap: var(--spacing-md);
    row-gap: 4px;
    
    .detail-item {
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: var(--font-size-sm);
      color: var(--text-secondary);
      font-weight: 500;
      
      .dot {
        width: 4px;
        height: 4px;
        border-radius: 50%;
        background: var(--text-light);
      }
    }
  }
`;

const JobStatus = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  min-width: 120px;
  
  .status-badge {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 6px 14px;
    border-radius: 9999px;
    font-size: var(--font-size-xs);
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.025em;
    
    &.pending { background: #fef3c7; color: #92400e; }
    &.released { background: #e0f2fe; color: #075985; }
    &.printing { background: #e0f2fe; color: #075985; }
    &.completed { background: #dcfce7; color: #166534; }
    &.cancelled { background: #fee2e2; color: #991b1b; }
  }
  
  .job-cost {
    font-size: var(--font-size-md);
    font-weight: 700;
    color: var(--text-primary);
  }
  
  @media (max-width: 992px) {
    flex-direction: row;
    justify-content: space-between;
    width: 100%;
    border-bottom: 1px solid var(--border-color);
    padding-bottom: var(--spacing-md);
  }
`;

const JobActions = styled.div`
  display: flex;
  gap: var(--spacing-sm);
  
  @media (max-width: 992px) {
    justify-content: flex-end;
    width: 100%;
  }
`;

const ActionButton = styled.button`
  width: 40px;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: white;
  border: 1px solid var(--border-color);
  border-radius: var(--border-radius-md);
  color: var(--text-secondary);
  font-size: 16px;
  transition: all var(--transition-fast);
  
  &:hover:not(:disabled) {
    border-color: var(--primary-color);
    color: var(--primary-color);
    background: var(--background-light);
    transform: translateY(-2px);
    box-shadow: var(--shadow-sm);
  }
  
  &.danger:hover:not(:disabled) {
    border-color: var(--error-color);
    color: var(--error-color);
    background: #fef2f2;
  }
  
  &.success:hover:not(:disabled) {
    border-color: var(--success-color);
    color: var(--success-color);
    background: #f0fdf4;
  }
  
  &:disabled {
    opacity: 0.4;
    cursor: not-allowed;
    background: var(--background-light);
  }
`;

const LoadingWrapper = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 80px;
  gap: var(--spacing-md);
  color: var(--text-secondary);
  font-weight: 600;
  
  .spinner {
    width: 40px;
    height: 40px;
    border: 3px solid var(--background-light);
    border-top-color: var(--primary-color);
    border-radius: 50%;
    animation: spin 1s linear infinite;
  }
  
  @keyframes spin {
    to { transform: rotate(360deg); }
  }
`;

const PrintJobQueue = () => {
  const { currentUser } = useAuth();
  const { printJobs, deletePrintJob, viewPrintJob, releasePrintJob, printers } = usePrintJob();
  const navigate = useNavigate();
  const [filteredJobs, setFilteredJobs] = useState([]);
  const [filters, setFilters] = useState({
    status: 'all',
    priority: 'all',
    search: ''
  });
  const [sortBy, setSortBy] = useState('submittedAt');
  const [sortOrder, setSortOrder] = useState('desc');
  const [userJobs, setUserJobs] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filter user's jobs only
  useEffect(() => {
    if (printJobs && currentUser?.id) {
      const userJobs = printJobs.filter(job => job.userId === currentUser.id);
      setUserJobs(userJobs);
      setLoading(false);
    }
  }, [printJobs, currentUser]);

  // Apply filters and sorting
  useEffect(() => {
    if (!userJobs.length) return;
    
    let jobs = [...userJobs];
    
    // Apply filters
    if (filters.status !== 'all') {
      jobs = jobs.filter(job => job.status === filters.status);
    }
    if (filters.priority !== 'all') {
      jobs = jobs.filter(job => job.priority === filters.priority);
    }
    if (filters.search) {
      jobs = jobs.filter(job => 
        job.documentName?.toLowerCase().includes(filters.search.toLowerCase()) ||
        job.notes?.toLowerCase().includes(filters.search.toLowerCase())
      );
    }
    
    // Apply sorting
    jobs.sort((a, b) => {
      let aValue = a[sortBy];
      let bValue = b[sortBy];
      
      if (sortBy === 'submittedAt' || sortBy === 'releasedAt' || sortBy === 'completedAt') {
        aValue = new Date(aValue || 0);
        bValue = new Date(bValue || 0);
      }
      
      if (sortOrder === 'asc') {
        return aValue > bValue ? 1 : -1;
      } else {
        return aValue < bValue ? 1 : -1;
      }
    });
    
    setFilteredJobs(jobs);
  }, [userJobs, filters, sortBy, sortOrder]);

  const handleDeleteJob = async (jobId) => {
    if (window.confirm('Are you sure you want to delete this print job? This cannot be undone.')) {
      try {
        await deletePrintJob(jobId);
        toast.success('Print job deleted successfully');
      } catch (error) {
        toast.error('Failed to delete print job: ' + error.message);
      }
    }
  };

  const handleViewJob = async (jobId) => {
    const job = filteredJobs.find(j => j.id === jobId);
    if (!job) {
      toast.error('Job not found.');
      return;
    }
    
    try {
      // For server jobs, use the content endpoint directly
      if (!jobId.startsWith('local_')) {
        const contentUrl = `/api/jobs/${jobId}/content?token=${encodeURIComponent(job.secureToken)}`;
        const viewWindow = window.open(contentUrl, '_blank');
        if (!viewWindow) {
          toast.error('Failed to open document. Please check your popup blocker.');
          return;
        }
        toast.success('Opening document in new tab...');
      } else {
        // For local jobs, use the existing viewPrintJob function
        const documentData = await viewPrintJob(jobId, job.secureToken, currentUser.id);
        if (documentData?.dataUrl) {
          window.open(documentData.dataUrl, '_blank');
        } else {
          toast.error('Document data not available for viewing.');
        }
      }
    } catch (error) {
      toast.error('Failed to view document: ' + error.message);
    }
  };

  const handleReleaseJob = async (jobId) => {
    const job = filteredJobs.find(j => j.id === jobId);
    if (!job) return;

    // Find an online printer (default)
    const printer = printers.find(p => p.status === 'online') || { id: 1 };

    setLoading(true);
    try {
      await releasePrintJob(jobId, printer.id, currentUser.id, job.secureToken);
      // No toast here, Context handles it
    } catch (error) {
      // Context handles toast
    } finally {
      setLoading(false);
    }
  };

  const handleSort = (field) => {
    if (sortBy === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setSortOrder('desc');
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'pending': return <FaClock />;
      case 'printing': return <FaPrint />;
      case 'completed': return <FaCheckCircle />;
      case 'cancelled': return <FaExclamationTriangle />;
      default: return <FaFileAlt />;
    }
  };

  const getPriorityColor = (priority) => {
    switch (priority) {
      case 'high': return '#e74c3c';
      case 'normal': return '#3498db';
      case 'low': return '#95a5a6';
      default: return '#7f8c8d';
    }
  };

  if (loading) {
    return (
      <QueueContainer>
        <LoadingWrapper>
          <div className="spinner" />
          <div>Loading your secure print jobs...</div>
        </LoadingWrapper>
      </QueueContainer>
    );
  }

  // Determine empty state type
  let emptyStateType = 'jobs';
  let emptyStateAction = null;
  let emptyStateActionText = 'Submit Print Job';
  
  if (filters.status !== 'all' || filters.search || filters.priority !== 'all') {
    emptyStateType = 'search';
  } else {
    emptyStateAction = () => navigate('/submit-job');
  }

  return (
    <QueueContainer>
      <PageHeader>
        <h1>Print Job Queue</h1>
        <p>Manage and track your secure print jobs</p>
      </PageHeader>

      <ControlsSection>
        <ControlsGrid>
          <ControlGroup hasIcon>
            <label htmlFor="search">Search Jobs</label>
            <div className="input-wrapper">
              <FaSearch className="input-icon" />
              <input
                id="search"
                type="text"
                placeholder="Search documents..."
                value={filters.search}
                onChange={(e) => setFilters(prev => ({ ...prev, search: e.target.value }))}
              />
            </div>
          </ControlGroup>

          <ControlGroup>
            <label htmlFor="status">Status</label>
            <div className="input-wrapper">
              <select
                id="status"
                value={filters.status}
                onChange={(e) => setFilters(prev => ({ ...prev, status: e.target.value }))}
              >
                <option value="all">All Statuses</option>
                <option value="pending">Pending</option>
                <option value="printing">Printing</option>
                <option value="completed">Completed</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </div>
          </ControlGroup>

          <ControlGroup>
            <label htmlFor="priority">Priority</label>
            <div className="input-wrapper">
              <select
                id="priority"
                value={filters.priority}
                onChange={(e) => setFilters(prev => ({ ...prev, priority: e.target.value }))}
              >
                <option value="all">All Priorities</option>
                <option value="high">High</option>
                <option value="normal">Normal</option>
                <option value="low">Low</option>
              </select>
            </div>
          </ControlGroup>

          <SortSection>
            <span className="sort-label">Sort by:</span>
            <SortButton
              className={sortBy === 'submittedAt' ? 'active' : ''}
              onClick={() => handleSort('submittedAt')}
            >
              <FaSort />
              Date
            </SortButton>
            <SortButton
              className={sortBy === 'documentName' ? 'active' : ''}
              onClick={() => handleSort('documentName')}
            >
              <FaSort />
              Name
            </SortButton>
          </SortSection>
        </ControlsGrid>
      </ControlsSection>

      <JobsContainer>
        {filteredJobs.length > 0 ? (
          <JobList>
            {filteredJobs.map((job) => (
              <JobItem key={job.id}>
                <JobStatus>
                  <div className={`status-badge ${job.status}`}>
                    {getStatusIcon(job.status)}
                    {job.status}
                  </div>
                  <div className="job-cost">${job.cost?.toFixed(2) || '0.00'}</div>
                </JobStatus>
                
                <JobInfo>
                  <div className="job-title" title={job.documentName}>{job.documentName}</div>
                  <div className="job-details">
                    <div className="detail-item">
                      <span>{job.pages} Pages</span>
                      <div className="dot" />
                      <span>{job.copies} Copies</span>
                    </div>
                    <div className="detail-item">
                      <div className="dot" />
                      <span style={{ color: getPriorityColor(job.priority) }}>
                        {job.priority.toUpperCase()} Priority
                      </span>
                    </div>
                    <div className="detail-item">
                      <div className="dot" />
                      <span>{formatDate(job.submittedAt)}</span>
                    </div>
                    {job.notes && (
                      <div className="detail-item">
                        <div className="dot" />
                        <span>{job.notes}</span>
                      </div>
                    )}
                  </div>
                </JobInfo>
                
                <JobActions>
                  <ActionButton
                    onClick={() => handleViewJob(job.id)}
                    title="Preview document (multiple views allowed)"
                    className="success"
                  >
                    <FaEye />
                  </ActionButton>
                  
                  {job.status === 'pending' && (
                    <ActionButton
                      onClick={() => handleReleaseJob(job.id)}
                      disabled={loading}
                      title="Release this job for printing"
                      className="success"
                    >
                      <FaPrint />
                    </ActionButton>
                  )}
                  
                  <ActionButton
                    onClick={() => handleDeleteJob(job.id)}
                    title="Delete this job"
                    className="danger"
                  >
                    <FaTrash />
                  </ActionButton>
                </JobActions>
              </JobItem>
            ))}
          </JobList>
        ) : (
          <EmptyState
            type={emptyStateType}
            action={emptyStateAction}
            actionText={emptyStateActionText}
            onAction={emptyStateAction}
          />
        )}
      </JobsContainer>
    </QueueContainer>
  );
};

export default PrintJobQueue;