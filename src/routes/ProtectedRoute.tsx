// src/routes/ProtectedRoute.tsx
import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import type { UserRole } from '../utils/types';

interface ProtectedRouteProps {
  allowedRoles?: UserRole[];
  redirectTo?: string;
}

const roleDefaultDashboard: Record<UserRole, string> = {
  admin: '/admin/home',
  waiter: '/waiter/home',
  kitchen: '/kitchen/kanban',
};

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ allowedRoles, redirectTo }) => {
  const { currentUser, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen text-gray-200">
        Cargando...
      </div>
    );
  }

  if (!currentUser) {
    // Not authenticated; send to root login (admin by default)
    return <Navigate to={redirectTo ?? '/admin/login'} replace />;
  }

  if (allowedRoles && !allowedRoles.includes(currentUser.role)) {
    // Authenticated but wrong role; send to their own dashboard
    return <Navigate to={roleDefaultDashboard[currentUser.role]} replace />;
  }

  return <Outlet />;
};

export default ProtectedRoute;
