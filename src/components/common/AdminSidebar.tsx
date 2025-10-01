// src/components/common/AdminSidebar.tsx
import React from 'react';
import { NavLink } from 'react-router-dom';

const navLinkClass = ({ isActive }: { isActive: boolean }) =>
  `flex items-center py-2.5 px-4 rounded transition-colors ${
    isActive ? 'bg-gray-700 text-amber-400' : 'hover:bg-gray-700 hover:text-amber-400 text-gray-300'
  }`;

export const AdminSidebar: React.FC = () => {
  return (
    <aside className="bg-gray-800 text-gray-100 w-64 space-y-6 py-7 px-2 hidden md:block">
      <div className="flex items-center justify-center px-4">
        <svg className="w-10 h-10 mr-2 text-amber-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M8 22h8"></path><path d="M12 12v10"></path><path d="m19 2-7 10-7-10"></path></svg>
        <span className="text-2xl font-bold tracking-tighter text-white">Bar POS</span>
      </div>
      <nav className="space-y-1">
        <NavLink to="/admin/home" className={navLinkClass}>Mesas</NavLink>
        <NavLink to="/admin/kanban/cocina" className={navLinkClass}>Cocina</NavLink>
        <NavLink to="/admin/kanban/barra" className={navLinkClass}>Barra</NavLink>
        <NavLink to="/admin/tickets" className={navLinkClass}>Tickets</NavLink>
        <NavLink to="/admin/manage-products" className={navLinkClass}>Productos</NavLink>
        {/* <NavLink to="/admin/checkout" className={navLinkClass}>Checkout</NavLink> */}
      </nav>
    </aside>
  );
};

export default AdminSidebar;
