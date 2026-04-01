import React, { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import LoadingSpinner from '../components/UI/LoadingSpinner';
import Navbar from '../components/Layout/Navbar';
import Sidebar from '../components/Layout/Sidebar';

const ProtectedRoute = ({ children, allowedRoles }) => {
  const { user, isAuthenticated, isLoading } = useAuth();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  if (isLoading) {
    return (
      <div className="h-screen w-screen bg-uips-bg flex items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (!isAuthenticated || !user) {
    return <Navigate to="/login" replace />;
  }

  if (allowedRoles && !allowedRoles.includes(user.role)) {
    const defaultRoute = user.role === 'student' ? '/student/waiting-room' : '/invigilator/dashboard';
    return <Navigate to={defaultRoute} replace />;
  }

  return (
    <div className="h-screen w-full flex flex-col bg-uips-bg overflow-hidden">
      <Navbar toggleSidebar={() => setIsSidebarOpen((prev) => !prev)} />
      <div className="flex-1 flex overflow-hidden pt-14">
        <Sidebar
          role={user.role}
          isOpen={isSidebarOpen}
          toggleSidebar={() => setIsSidebarOpen((prev) => !prev)}
        />
        <main className="flex-1 overflow-y-auto p-6 md:p-8 relative">
          {children}
        </main>
      </div>
    </div>
  );
};

export default ProtectedRoute;
