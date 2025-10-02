// src/layouts/WaiterLayout.tsx
import React, { useEffect, useState } from 'react';
import { Outlet, Link } from 'react-router-dom';
import { getConfig } from '../services/firestoreService';

const WaiterLayout: React.FC = () => {
  const [config, setConfig] = useState<any | null>(null);

  // Load business config (name, logo) from Firestore
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const cfg = await getConfig();
        if (mounted) setConfig(cfg?.success ? cfg.data : null);
      } catch (e) {
        console.debug('Could not load config/general:', e);
      }
    })();
    return () => { mounted = false; };
  }, []);

  return (
    <div className="bg-gray-900 text-gray-200 min-h-screen flex flex-col">
      <header className="bg-gray-800/80 backdrop-blur-sm sticky top-0 z-10 border-b border-gray-700">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <Link to="/waiter/home" className="flex items-center">
              {config?.logoUrl ? (
                <img 
                  src={config.logoUrl} 
                  alt="Logo" 
                  className="w-8 h-8 mr-2 object-contain"
                  onError={(e) => {
                    // Fallback to SVG icon if image fails to load
                    e.currentTarget.style.display = 'none';
                  }}
                />
              ) : (
                <svg className="w-8 h-8 mr-2 text-green-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M8 22h8"/><path d="M12 12v10"/><path d="m19 2-7 10-7-10"/></svg>
              )}
              <span className="text-xl font-bold tracking-tighter text-white">
                {config?.name ?? 'Bar POS'}
              </span>
            </Link>
            <nav className="flex items-center gap-4 text-sm">
              <Link to="/waiter/home" className="hover:text-green-400">Mesas</Link>
              {/* <Link to="/waiter/checkout" className="hover:text-green-400">Checkout</Link> */}
            </nav>
          </div>
        </div>
      </header>
      <main className="flex-1 container mx-auto p-4 sm:p-6 lg:p-8">
        <Outlet />
      </main>
    </div>
  );
};

export default WaiterLayout;
