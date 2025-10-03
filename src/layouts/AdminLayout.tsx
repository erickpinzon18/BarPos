// src/layouts/AdminLayout.tsx
import React from 'react';
import { Outlet } from 'react-router-dom';
import AdminSidebar from '../components/common/AdminSidebar';

const AdminLayout: React.FC = () => {
  return (
    <div className="bg-gray-900 text-gray-200 h-screen flex overflow-hidden">
      <AdminSidebar />
      <main className="flex-1 overflow-y-auto p-4 md:p-8">
        <Outlet />
      </main>
    </div>
  );
};

export default AdminLayout;
