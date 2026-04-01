import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import ProtectedRoute from './routes/ProtectedRoute';
import { useAuth } from './hooks/useAuth';
import LoadingSpinner from './components/UI/LoadingSpinner';

// Pages
import Login from './pages/Login';
import WaitingRoom from './pages/student/WaitingRoom';
import ExamSession from './pages/student/ExamSession';
import ExamCompleted from './pages/student/ExamCompleted';
import Dashboard from './pages/invigilator/Dashboard';
import StudentDetail from './pages/invigilator/StudentDetail';
import Exams from './pages/admin/Exams';
import Users from './pages/admin/Users';
import Reports from './pages/admin/Reports';
import ReportsView from './pages/admin/ReportsView';

const RootRedirect = () => {
  const { user, isAuthenticated, isLoading } = useAuth();

  if (isLoading) return <LoadingSpinner />;

  if (!isAuthenticated || !user) {
    return <Navigate to="/login" replace />;
  }

  if (user.role === 'student') return <Navigate to="/student/waiting-room" replace />;
  return <Navigate to="/invigilator/dashboard" replace />;
};

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<RootRedirect />} />
          <Route path="/login" element={<Login />} />

          {/* Student routes */}
            <Route path="/student/waiting-room" element={<ProtectedRoute allowedRoles={['student']}><WaitingRoom /></ProtectedRoute>} />
            <Route path="/student/exam" element={<ProtectedRoute allowedRoles={['student']}><ExamSession /></ProtectedRoute>} />
            <Route path="/student/exam-completed" element={<ProtectedRoute allowedRoles={['student']}><ExamCompleted /></ProtectedRoute>} />

          {/* Invigilator + Admin routes */}
          <Route path="/invigilator/dashboard" element={<ProtectedRoute allowedRoles={['invigilator', 'admin']}><Dashboard /></ProtectedRoute>} />
          <Route path="/invigilator/student/:id" element={<ProtectedRoute allowedRoles={['invigilator', 'admin']}><StudentDetail /></ProtectedRoute>} />
          <Route path="/invigilator/reports" element={<ProtectedRoute allowedRoles={['invigilator', 'admin']}><Reports /></ProtectedRoute>} />

          {/* Admin exclusive routes */}
          <Route path="/admin/exams" element={<ProtectedRoute allowedRoles={['admin']}><Exams /></ProtectedRoute>} />
          <Route path="/admin/users" element={<ProtectedRoute allowedRoles={['admin']}><Users /></ProtectedRoute>} />
          <Route path="/admin/reports" element={<ProtectedRoute allowedRoles={['admin']}><Reports /></ProtectedRoute>} />
          <Route path="/admin/reports/view" element={<ProtectedRoute allowedRoles={['admin']}><ReportsView /></ProtectedRoute>} />

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
