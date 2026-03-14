import React, { Component } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

// Components
import Dashboard from './pages/Dashboard';
import PrintJobSubmission from './pages/PrintJobSubmission';
import PrintJobQueue from './pages/PrintJobQueue';
import PrinterManagement from './pages/PrinterManagement';
import UserManagement from './pages/UserManagement';
import Authentication from './pages/Authentication';
import PrintRelease from './pages/PrintRelease';
import Reports from './pages/Reports';
import Settings from './pages/Settings';
import Chat from './pages/Chat';
import Layout from './components/Layout';

// Context
import { AuthProvider } from './context/AuthContext';
import { PrintJobProvider } from './context/PrintJobContext';
import { ChatProvider } from './context/ChatContext';
import { useAuth as useClerkAuth } from '@clerk/clerk-react';

const RequireAuth = ({ children }) => {
  const { isSignedIn } = useClerkAuth();
  return isSignedIn ? children : <Navigate to="/login" replace />;
};

const RedirectIfAuth = ({ children }) => {
  const { isSignedIn } = useClerkAuth();
  return isSignedIn ? <Navigate to="/dashboard" replace /> : children;
};

class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }
  componentDidCatch(error, errorInfo) {
    // You can log error info here if needed
  }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{ color: 'red', padding: 32, textAlign: 'center' }}>
          <h2>Something went wrong.</h2>
          <pre>{this.state.error && this.state.error.toString()}</pre>
        </div>
      );
    }
    return this.props.children;
  }
}

function App() {
  return (
    <AuthProvider>
      <PrintJobProvider>
        <ChatProvider>
          <ErrorBoundary>
            <Router>
              <Routes>
              <Route
                path="/login"
                element={
                  <RedirectIfAuth>
                    <Authentication />
                  </RedirectIfAuth>
                }
              />
              <Route
                path="/dashboard"
                element={
                  <RequireAuth>
                    <Layout>
                      <Dashboard />
                    </Layout>
                  </RequireAuth>
                }
              />
              <Route
                path="/print-job-submission"
                element={
                  <RequireAuth>
                    <Layout>
                      <PrintJobSubmission />
                    </Layout>
                  </RequireAuth>
                }
              />
              <Route
                path="/submit-job"
                element={
                  <RequireAuth>
                    <Layout>
                      <PrintJobSubmission />
                    </Layout>
                  </RequireAuth>
                }
              />
              <Route
                path="/print-job-queue"
                element={
                  <RequireAuth>
                    <Layout>
                      <PrintJobQueue />
                    </Layout>
                  </RequireAuth>
                }
              />
              <Route
                path="/printer-management"
                element={
                  <RequireAuth>
                    <Layout>
                      <PrinterManagement />
                    </Layout>
                  </RequireAuth>
                }
              />
              <Route
                path="/user-management"
                element={
                  <RequireAuth>
                    <Layout>
                      <UserManagement />
                    </Layout>
                  </RequireAuth>
                }
              />
              <Route
                path="/release/:jobId"
                element={<PrintRelease />}
              />
              <Route
                path="/print-release"
                element={
                  <RequireAuth>
                    <Layout>
                      <PrintRelease />
                    </Layout>
                  </RequireAuth>
                }
              />
              <Route
                path="/reports"
                element={
                  <RequireAuth>
                    <Layout>
                      <Reports />
                    </Layout>
                  </RequireAuth>
                }
              />
              <Route
                path="/settings"
                element={
                  <RequireAuth>
                    <Layout>
                      <Settings />
                    </Layout>
                  </RequireAuth>
                }
              />
              <Route
                path="/chat"
                element={
                  <RequireAuth>
                    <Layout>
                      <Chat />
                    </Layout>
                  </RequireAuth>
                }
              />
              <Route path="/" element={<Navigate to="/login" replace />} />
            </Routes>
          </Router>
          <ToastContainer />
        </ErrorBoundary>
      </ChatProvider>
    </PrintJobProvider>
  </AuthProvider>
);
}

export default App;
