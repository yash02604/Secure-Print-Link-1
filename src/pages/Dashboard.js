import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import styled from 'styled-components';
import { useAuth } from '../context/AuthContext';
import { usePrintJob } from '../context/PrintJobContext';
import { FaPrint, FaFileAlt, FaServer, FaChartBar, FaCog, FaClock, FaCheckCircle, FaExclamationTriangle, FaEye } from 'react-icons/fa';
import EmptyState from '../components/EmptyState';

const DashboardContainer = styled.div`
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

const StatsGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
  gap: var(--spacing-lg);
`;

const StatCard = styled.div`
  background: var(--background-card);
  border-radius: var(--border-radius-lg);
  padding: var(--spacing-lg);
  box-shadow: var(--shadow-sm);
  border: 1px solid var(--border-color);
  display: flex;
  align-items: center;
  gap: var(--spacing-lg);
  transition: all var(--transition-normal);
  
  &:hover {
    transform: translateY(-2px);
    box-shadow: var(--shadow-md);
    border-color: var(--primary-color);
  }
  
  .stat-icon {
    width: 48px;
    height: 48px;
    border-radius: var(--border-radius-md);
    background: ${props => props.color || 'var(--primary-color)'}15;
    display: flex;
    align-items: center;
    justify-content: center;
    color: ${props => props.color || 'var(--primary-color)'};
    font-size: 20px;
    flex-shrink: 0;
  }
  
  .stat-info {
    .stat-value {
      font-size: var(--font-size-xxl);
      font-weight: 700;
      color: var(--text-primary);
      line-height: 1.2;
    }
    
    .stat-label {
      color: var(--text-secondary);
      font-size: var(--font-size-sm);
      font-weight: 500;
    }
  }
`;

const ContentGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(12, 1fr);
  gap: var(--spacing-xl);
  
  @media (max-width: 1200px) {
    grid-template-columns: 1fr;
  }
`;

const MainContent = styled.div`
  grid-column: span 8;
  display: flex;
  flex-direction: column;
  gap: var(--spacing-xl);
  
  @media (max-width: 1200px) {
    grid-column: span 12;
  }
`;

const Section = styled.section`
  background: var(--background-card);
  border-radius: var(--border-radius-lg);
  padding: var(--spacing-xl);
  box-shadow: var(--shadow-sm);
  border: 1px solid var(--border-color);
  
  .section-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: var(--spacing-xl);
    
    h2 {
      font-size: var(--font-size-xl);
      font-weight: 700;
      color: var(--text-primary);
      letter-spacing: -0.025em;
    }
    
    .view-all {
      color: var(--primary-color);
      text-decoration: none;
      font-size: var(--font-size-sm);
      font-weight: 600;
      padding: 6px 12px;
      border-radius: var(--border-radius-md);
      transition: all var(--transition-fast);
      
      &:hover {
        background: var(--background-light);
        color: var(--primary-hover);
      }
    }
  }
`;

const JobList = styled.div`
  display: flex;
  flex-direction: column;
  gap: var(--spacing-md);
`;

const JobItem = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--spacing-md);
  background: var(--background-light);
  border-radius: var(--border-radius-md);
  border: 1px solid transparent;
  transition: all var(--transition-fast);
  
  &:hover {
    background: white;
    border-color: var(--border-color);
    box-shadow: var(--shadow-sm);
    transform: translateX(4px);
  }
  
  .job-info {
    display: flex;
    align-items: center;
    gap: var(--spacing-md);
    
    .job-icon {
      width: 40px;
      height: 40px;
      border-radius: var(--border-radius-sm);
      background: white;
      display: flex;
      align-items: center;
      justify-content: center;
      color: var(--primary-color);
      box-shadow: var(--shadow-sm);
    }
    
    .job-details {
      .job-name {
        font-weight: 600;
        color: var(--text-primary);
        font-size: var(--font-size-md);
        margin-bottom: 2px;
      }
      
      .job-meta {
        font-size: var(--font-size-xs);
        color: var(--text-secondary);
      }
    }
  }
  
  .job-status {
    padding: 4px 12px;
    border-radius: 9999px;
    font-size: var(--font-size-xs);
    font-weight: 600;
    text-transform: capitalize;
    
    &.pending { background: #fef3c7; color: #92400e; }
    &.printing { background: #e0f2fe; color: #075985; }
    &.completed { background: #dcfce7; color: #166534; }
    &.cancelled { background: #fee2e2; color: #991b1b; }
  }
`;

const PrinterGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
  gap: var(--spacing-md);
`;

const PrinterCard = styled.div`
  background: var(--background-light);
  border-radius: var(--border-radius-md);
  padding: var(--spacing-lg);
  text-align: center;
  border: 1px solid transparent;
  transition: all var(--transition-fast);
  
  &:hover {
    background: white;
    border-color: var(--border-color);
    box-shadow: var(--shadow-sm);
  }
  
  .printer-icon {
    width: 48px;
    height: 48px;
    border-radius: 50%;
    background: white;
    color: ${props => props.status === 'online' ? 'var(--success-color)' : 'var(--error-color)'};
    display: flex;
    align-items: center;
    justify-content: center;
    margin: 0 auto var(--spacing-md);
    font-size: 20px;
    box-shadow: var(--shadow-sm);
  }
  
  .printer-name {
    font-weight: 600;
    color: var(--text-primary);
    font-size: var(--font-size-sm);
    margin-bottom: 4px;
  }
  
  .printer-status {
    font-size: var(--font-size-xs);
    color: ${props => props.status === 'online' ? 'var(--success-color)' : 'var(--error-color)'};
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.025em;
  }
`;

const QuickActions = styled.div`
  display: flex;
  flex-direction: column;
  gap: var(--spacing-md);
`;

const ActionButton = styled.button`
  display: flex;
  align-items: center;
  gap: var(--spacing-md);
  padding: var(--spacing-md);
  background: var(--background-light);
  border: 1px solid transparent;
  border-radius: var(--border-radius-md);
  cursor: pointer;
  transition: all var(--transition-fast);
  text-align: left;
  width: 100%;
  
  &:hover {
    background: white;
    border-color: var(--primary-color);
    box-shadow: var(--shadow-sm);
    transform: translateY(-1px);
  }
  
  .action-icon {
    width: 40px;
    height: 40px;
    border-radius: var(--border-radius-sm);
    background: var(--primary-color);
    display: flex;
    align-items: center;
    justify-content: center;
    color: white;
    font-size: 18px;
    flex-shrink: 0;
  }
  
  .action-text {
    .action-title {
      font-weight: 600;
      color: var(--text-primary);
      font-size: var(--font-size-sm);
      margin-bottom: 2px;
    }
    
    .action-description {
      font-size: var(--font-size-xs);
      color: var(--text-secondary);
    }
  }
`;

const ChartPlaceholder = styled.div`
  height: 240px;
  background: var(--background-light);
  border-radius: var(--border-radius-md);
  display: flex;
  align-items: center;
  justify-content: center;
  border: 1px dashed var(--border-color);
`;

const SidebarContent = styled.div`
  grid-column: span 4;
  display: flex;
  flex-direction: column;
  gap: var(--spacing-xl);
  
  @media (max-width: 1200px) {
    grid-column: span 12;
  }
`;

const SystemStatus = styled.div`
  display: flex;
  flex-direction: column;
  gap: var(--spacing-md);
  
  .status-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: var(--spacing-sm) 0;
    border-bottom: 1px solid var(--border-color);
    
    &:last-child {
      border-bottom: none;
    }
    
    .status-label {
      font-size: var(--font-size-sm);
      color: var(--text-secondary);
      font-weight: 500;
    }
    
    .status-value {
      font-size: var(--font-size-sm);
      font-weight: 700;
      color: var(--text-primary);
    }
  }
`;

const Dashboard = () => {
  const { currentUser } = useAuth();
  const { printJobs, getJobStatistics, printers: allPrinters } = usePrintJob();
  const navigate = useNavigate();
  const [userJobs, setUserJobs] = useState([]);
  const [printers, setPrinters] = useState([]);
  const [stats, setStats] = useState({
    total: 0,
    pending: 0,
    released: 0,
    completed: 0,
    cancelled: 0,
    viewed: 0,
    expired: 0
  });

  // Filter user's jobs and calculate statistics
  useEffect(() => {
    if (printJobs && currentUser?.id) {
      const userJobs = printJobs.filter(job => job.userId === currentUser.id);
      setUserJobs(userJobs);
      
      // Calculate real-time statistics from the same data source
      const jobStats = getJobStatistics(currentUser.id);
      setStats(jobStats);
    }
    
    if (allPrinters) {
      setPrinters(allPrinters);
    }
  }, [printJobs, currentUser, getJobStatistics, allPrinters]);

  const onlinePrinters = printers.filter(p => p.status === 'online');
  const offlinePrinters = printers.filter(p => p.status === 'offline');

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <DashboardContainer>
      <PageHeader>
        <h1>Dashboard</h1>
        <p>Welcome back, {currentUser?.name}! Here's what's happening with your print jobs.</p>
      </PageHeader>

      <StatsGrid>
        <StatCard color="var(--primary-color)">
          <div className="stat-icon">
            <FaFileAlt />
          </div>
          <div className="stat-info">
            <div className="stat-value">{stats.total}</div>
            <div className="stat-label">Total Jobs</div>
          </div>
        </StatCard>

        <StatCard color="var(--warning-color)">
          <div className="stat-icon">
            <FaClock />
          </div>
          <div className="stat-info">
            <div className="stat-value">{stats.pending}</div>
            <div className="stat-label">Pending</div>
          </div>
        </StatCard>

        <StatCard color="var(--primary-hover)">
          <div className="stat-icon">
            <FaPrint />
          </div>
          <div className="stat-info">
            <div className="stat-value">{stats.released}</div>
            <div className="stat-label">Released</div>
          </div>
        </StatCard>

        <StatCard color="var(--success-color)">
          <div className="stat-icon">
            <FaCheckCircle />
          </div>
          <div className="stat-info">
            <div className="stat-value">{stats.completed}</div>
            <div className="stat-label">Completed</div>
          </div>
        </StatCard>

        <StatCard color="#8b5cf6">
          <div className="stat-icon">
            <FaEye />
          </div>
          <div className="stat-info">
            <div className="stat-value">{stats.viewed}</div>
            <div className="stat-label">Viewed</div>
          </div>
        </StatCard>

        <StatCard color="var(--error-color)">
          <div className="stat-icon">
            <FaExclamationTriangle />
          </div>
          <div className="stat-info">
            <div className="stat-value">{stats.expired}</div>
            <div className="stat-label">Expired</div>
          </div>
        </StatCard>
      </StatsGrid>

      <ContentGrid>
        <MainContent>
          <Section>
            <div className="section-header">
              <h2>Recent Print Jobs</h2>
              <a href="/print-job-queue" className="view-all">View All</a>
            </div>
            <JobList>
              {userJobs.length > 0 ? (
                userJobs.slice(0, 5).map((job) => (
                  <JobItem key={job.id}>
                    <div className="job-info">
                      <div className="job-icon">
                        <FaFileAlt />
                      </div>
                      <div className="job-details">
                        <div className="job-name">{job.documentName || 'Document'}</div>
                        <div className="job-meta">
                          {formatDate(job.submittedAt)} • {job.pages} pages • ${job.cost}
                        </div>
                      </div>
                    </div>
                    <div className={`job-status ${job.status}`}>
                      {job.status}
                    </div>
                  </JobItem>
                ))
              ) : (
                <EmptyState 
                  type="jobs" 
                  action={() => navigate('/submit-job')}
                  actionText="Submit Print Job"
                  onAction={() => navigate('/submit-job')}
                />
              )}
            </JobList>
          </Section>

          <Section>
            <div className="section-header">
              <h2>Printer Status</h2>
              <a href="/printers" className="view-all">Manage Printers</a>
            </div>
            <PrinterGrid>
              {printers.map(printer => (
                <PrinterCard key={printer.id} status={printer.status}>
                  <div className="printer-icon">
                    <FaServer />
                  </div>
                  <div className="printer-name">{printer.name}</div>
                  <div className="printer-status">{printer.status}</div>
                </PrinterCard>
              ))}
            </PrinterGrid>
          </Section>

          <Section>
            <div className="section-header">
              <h2>Print Activity</h2>
            </div>
            <ChartPlaceholder>
              <div style={{ textAlign: 'center' }}>
                <FaChartBar style={{ fontSize: '48px', marginBottom: '16px', opacity: 0.3 }} />
                <div>Print activity chart will be displayed here</div>
                <div style={{ fontSize: '12px', marginTop: '8px' }}>
                  Shows daily/weekly/monthly print job trends
                </div>
              </div>
            </ChartPlaceholder>
          </Section>
        </MainContent>

        <SidebarContent>
          <Section>
            <div className="section-header">
              <h2>Quick Actions</h2>
            </div>
            <QuickActions>
              <ActionButton onClick={() => navigate('/submit-job')}>
                <div className="action-icon">
                  <FaPrint />
                </div>
                <div className="action-text">
                  <div className="action-title">Submit Print Job</div>
                  <div className="action-description">Upload and submit a new document</div>
                </div>
              </ActionButton>

              <ActionButton onClick={() => navigate('/print-release')}>
                <div className="action-icon">
                  <FaCog />
                </div>
                <div className="action-text">
                  <div className="action-title">Release Print Jobs</div>
                  <div className="action-description">Release your pending print jobs</div>
                </div>
              </ActionButton>

              <ActionButton onClick={() => navigate('/print-job-queue')}>
                <div className="action-icon">
                  <FaFileAlt />
                </div>
                <div className="action-text">
                  <div className="action-title">View Job Queue</div>
                  <div className="action-description">Check status of all your jobs</div>
                </div>
              </ActionButton>

              <ActionButton onClick={() => navigate('/reports')}>
                <div className="action-icon">
                  <FaChartBar />
                </div>
                <div className="action-text">
                  <div className="action-title">View Reports</div>
                  <div className="action-description">Analytics and usage reports</div>
                </div>
              </ActionButton>
            </QuickActions>
          </Section>

          <Section>
            <div className="section-header">
              <h2>System Status</h2>
            </div>
            <SystemStatus>
              <div className="status-item">
                <span className="status-label">Online Printers</span>
                <span className="status-value" style={{ color: 'var(--success-color)' }}>{onlinePrinters.length}</span>
              </div>
              <div className="status-item">
                <span className="status-label">Offline Printers</span>
                <span className="status-value" style={{ color: 'var(--error-color)' }}>{offlinePrinters.length}</span>
              </div>
              <div className="status-item">
                <span className="status-label">Active Users</span>
                <span className="status-value" style={{ color: 'var(--primary-color)' }}>24</span>
              </div>
              <div className="status-item">
                <span className="status-label">System Health</span>
                <span className="status-value" style={{ color: 'var(--success-color)' }}>Excellent</span>
              </div>
            </SystemStatus>
          </Section>
        </SidebarContent>
      </ContentGrid>
    </DashboardContainer>
  );
};

export default Dashboard;
