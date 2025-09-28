// src/layouts/KitchenLayout.tsx
import React from 'react';
import { Outlet, Link } from 'react-router-dom';

const KitchenLayout: React.FC = () => {
  return (
    <div className="bg-gray-900 text-gray-200 min-h-screen flex flex-col">
      <header className="bg-gray-800/80 backdrop-blur-sm sticky top-0 z-10 border-b border-gray-700">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <Link to="/kitchen/kanban" className="flex items-center">
              <svg className="w-8 h-8 mr-2 text-amber-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M8 22h8"/><path d="M12 12v10"/><path d="m19 2-7 10-7-10"/></svg>
              <span className="text-xl font-bold tracking-tighter text-white">Cocina</span>
            </Link>
          </div>
        </div>
      </header>
      <main className="flex-1 container mx-auto p-4 sm:p-6 lg:p-8">
        <Outlet />
      </main>
    </div>
  );
};

export default KitchenLayout;
