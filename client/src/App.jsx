import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import NavigationBar from './components/Navbar';
import Sidebar from './components/Sidebar';
import ChatBot from './components/ChatBot';

// Pages
import LandingPage from './pages/LandingPage';
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import Projects from './pages/Projects';
import AssessmentReports from './pages/AssessmentReports';
import TeamWorkspacePage from './pages/TeamWorkspacePage';
import AIMentorPage from './pages/AIMentorPage';
import AnalyticsPage from './pages/AnalyticsPage';
import ProfilePage from './pages/ProfilePage';
import LearningModules from './pages/LearningModules';

// Import Bootstrap CSS globally
import 'bootstrap/dist/css/bootstrap.min.css';

// Guard for private routes
function PrivateRoute({ children }) {
  const { isAuthenticated, loading } = useAuth();
  
  if (loading) {
    return (
      <div className="d-flex align-items-center justify-content-center" style={{ minHeight: '100vh' }}>
        <div className="spinner-border text-primary" role="status" />
      </div>
    );
  }

  return isAuthenticated ? children : <Navigate to="/login" />;
}

// Layout wrapper for authenticated users
function AppLayout() {
  const { isAuthenticated } = useAuth();

  return (
    <div className="d-flex flex-column" style={{ minHeight: '100vh', background: 'var(--bs-body-bg)' }}>
      <NavigationBar />
      <div className="d-flex flex-grow-1">
        {isAuthenticated && <Sidebar />}
        <main className="flex-grow-1 position-relative" style={{ overflowX: 'hidden' }}>
          <Routes>
            <Route path="/" element={<LandingPage />} />
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            
            {/* Authenticated Dashboard Pages */}
            <Route path="/dashboard" element={<PrivateRoute><Dashboard /></PrivateRoute>} />
            <Route path="/projects" element={<PrivateRoute><Projects /></PrivateRoute>} />
            <Route path="/assessments" element={<PrivateRoute><AssessmentReports /></PrivateRoute>} />
            <Route path="/learning" element={<PrivateRoute><LearningModules /></PrivateRoute>} />
            <Route path="/workspace" element={<PrivateRoute><TeamWorkspacePage /></PrivateRoute>} />
            <Route path="/mentor" element={<PrivateRoute><AIMentorPage /></PrivateRoute>} />
            <Route path="/analytics" element={<PrivateRoute><AnalyticsPage /></PrivateRoute>} />
            <Route path="/profile" element={<PrivateRoute><ProfilePage /></PrivateRoute>} />
          </Routes>
          {isAuthenticated && <ChatBot />}
        </main>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <Router>
        <AppLayout />
      </Router>
    </AuthProvider>
  );
}
