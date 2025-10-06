// src/layouts/KitchenLayout.tsx
import React, { useEffect, useState } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { getConfig } from '../services/firestoreService';
import { User, LogOut } from 'lucide-react';
import toast from 'react-hot-toast';

const KitchenLayout: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [config, setConfig] = useState<any | null>(null);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [userName, setUserName] = useState<string>('Usuario');

  // Determinar estación actual (cocina o barra)
  const isInCocina = location.pathname.includes('/cocina');
  const isInBarra = location.pathname.includes('/barra');

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

  // Get user name from localStorage (set during PIN verification)
  useEffect(() => {
    const storedUserName = localStorage.getItem('kitchenUserName');
    if (storedUserName) {
      setUserName(storedUserName);
    }
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('kitchenUserName');
    toast.success('Sesión cerrada');
    navigate('/login');
  };

  return (
    <div className="bg-gray-900 text-gray-200 min-h-screen flex flex-col">
      <header className="bg-gray-800/80 backdrop-blur-sm sticky top-0 z-10 border-b border-gray-700">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center">
              {config?.logoUrl ? (
                <img 
                  src={config.logoUrl} 
                  alt="Logo" 
                  className="w-8 h-8 mr-2 object-contain"
                  onError={(e) => {
                    e.currentTarget.style.display = 'none';
                  }}
                />
              ) : (
                <svg className="w-8 h-8 mr-2 text-orange-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M8 22h8"/>
                  <path d="M12 12v10"/>
                  <path d="m19 2-7 10-7-10"/>
                </svg>
              )}
              <span className="text-xl font-bold tracking-tighter text-white">
                {config?.name ?? 'Bar POS'}
              </span>
            </div>

            {/* Station Navigation Buttons */}
            <div className="flex items-center gap-2">
              {/* Cocina Button */}
              <button
                onClick={() => navigate('/kitchen/cocina')}
                className={`flex items-center gap-2 px-4 py-2 rounded-full transition-all duration-200 ${
                  isInCocina
                    ? 'bg-orange-600 text-white shadow-lg shadow-orange-500/50'
                    : 'bg-gray-700/50 text-gray-400 hover:bg-gray-700 hover:text-orange-400'
                }`}
              >
                <span className="text-2xl">👨‍🍳</span>
                <span className="font-bold">Cocina</span>
              </button>

              {/* Barra Button */}
              <button
                onClick={() => navigate('/kitchen/barra')}
                className={`flex items-center gap-2 px-4 py-2 rounded-full transition-all duration-200 ${
                  isInBarra
                    ? 'bg-purple-600 text-white shadow-lg shadow-purple-500/50'
                    : 'bg-gray-700/50 text-gray-400 hover:bg-gray-700 hover:text-purple-400'
                }`}
              >
                <span className="text-2xl">🍹</span>
                <span className="font-bold">Barra</span>
              </button>
            </div>
          </div>
        </div>
      </header>
      <main className="flex-1 container mx-auto p-4 sm:p-6 lg:p-8">
        <Outlet />
      </main>

      {/* Floating User Button */}
      <div className="fixed bottom-6 left-6 z-50">
        {/* User Menu (shown when clicked) */}
        {showUserMenu && (
          <div className="absolute bottom-full mb-2 left-0 bg-gray-800 border border-gray-700 rounded-lg shadow-xl overflow-hidden w-64 animate-in slide-in-from-bottom-2">
            <div className="p-4 border-b border-gray-700 bg-gray-750">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-orange-500/20 flex items-center justify-center">
                  <User className="w-6 h-6 text-orange-400" />
                </div>
                <div>
                  <p className="font-semibold text-white">{userName}</p>
                  <p className="text-xs text-gray-400">
                    {isInCocina ? 'Cocina' : 'Barra'}
                  </p>
                </div>
              </div>
            </div>
            <div className="p-2">
              <button
                onClick={handleLogout}
                className="w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-red-400 hover:bg-red-500/10 transition-colors"
              >
                <LogOut className="w-4 h-4" />
                <span className="font-medium">Cerrar Sesión</span>
              </button>
            </div>
          </div>
        )}

        {/* Floating Button */}
        <button
          onClick={() => setShowUserMenu(!showUserMenu)}
          className={`${isInBarra ? 'bg-purple-600 hover:bg-purple-700' : 'bg-orange-600 hover:bg-orange-700'} text-white rounded-full p-4 shadow-lg hover:shadow-xl transition-all duration-200 flex items-center gap-3 group`}
        >
          <div className={`w-8 h-8 rounded-full ${isInBarra ? 'bg-purple-500' : 'bg-orange-500'} flex items-center justify-center`}>
            <User className="w-5 h-5" />
          </div>
          <span className="font-medium pr-2">
            {userName}
          </span>
        </button>
      </div>
    </div>
  );
};

export default KitchenLayout;
