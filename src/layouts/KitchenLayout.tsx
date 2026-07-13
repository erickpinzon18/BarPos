// src/layouts/KitchenLayout.tsx
import React, { useEffect, useRef, useState } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { getConfig } from '../services/firestoreService';
import { User, LogOut, LayoutDashboard, Printer, BarChart2, Package } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '../contexts/AuthContext';
import { useAutoPrintTickets } from '../hooks/useAutoPrintTickets';
import { usePaperSize } from '../hooks/usePaperSize';

const KitchenLayout: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { currentUser, logout } = useAuth();
  const [config, setConfig] = useState<any | null>(null);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showPrintMenu, setShowPrintMenu] = useState(false);
  const [userName, setUserName] = useState<string>('Usuario');
  const printMenuRef = useRef<HTMLDivElement>(null);

  const defaultStation = currentUser?.role === 'barra' ? 'barra' : 'cocina';
  const [paperSize, setPaperSize] = usePaperSize(currentUser?.id);
  const { enabled: autoPrintEnabled, setEnabled: setAutoPrintEnabled, stations, setStations } = useAutoPrintTickets(defaultStation, paperSize);

  // Determinar estación actual
  const isInCocina = location.pathname.includes('/cocina');
  const isInBarra = location.pathname.includes('/barra');
  const isInMesas = location.pathname.includes('/mesas') || location.pathname.includes('/order') || location.pathname.includes('/checkout');
  const isInVentas = location.pathname.includes('/ventas');
  const isInInventory = location.pathname.includes('/inventory');

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

  // Close print menu when clicking outside
  useEffect(() => {
    if (!showPrintMenu) return;
    const handler = (e: MouseEvent) => {
      if (printMenuRef.current && !printMenuRef.current.contains(e.target as Node)) {
        setShowPrintMenu(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showPrintMenu]);

  const toggleStation = (s: 'cocina' | 'barra') => {
    if (stations.includes(s)) {
      setStations(stations.filter(x => x !== s));
    } else {
      setStations([...stations, s]);
    }
  };

  const handleLogout = async () => {
    try {
      localStorage.removeItem('kitchenUserName');
      await logout();
      navigate('/login');
    } catch (err: any) {
      toast.error(err?.message || 'Error al cerrar sesión');
    }
  };

  return (
    <div className="bg-gray-950 text-gray-200 min-h-screen flex flex-col">
      <header className="bg-gray-900/80 backdrop-blur-sm sticky top-0 z-10 border-b border-gray-800">
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
                <svg className="w-8 h-8 mr-2 text-red-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M8 22h8"/>
                  <path d="M12 12v10"/>
                  <path d="m19 2-7 10-7-10"/>
                </svg>
              )}
              <span className="text-xl font-bold tracking-tighter text-white">
                {config?.name ?? 'Rest POS'}
              </span>
            </div>

            {/* Station Navigation Buttons */}
            <div className="flex items-center gap-2">
              {/* Auto-print toggle */}
              <div className="relative" ref={printMenuRef}>
                <button
                  onClick={() => setShowPrintMenu(!showPrintMenu)}
                  title="Auto-imprimir comandas"
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-full transition-all duration-200 ${
                    autoPrintEnabled
                      ? 'bg-green-700 text-white shadow-lg shadow-green-500/40'
                      : 'bg-gray-700/50 text-gray-400 hover:bg-gray-700 hover:text-gray-200'
                  }`}
                >
                  <Printer size={18} />
                  <span className={`text-xs font-bold ${autoPrintEnabled ? 'text-green-200' : 'text-gray-400'}`}>
                    {autoPrintEnabled ? 'AUTO' : 'OFF'}
                  </span>
                </button>

                {showPrintMenu && (
                  <div className="absolute right-0 top-full mt-2 w-60 bg-gray-800 border border-gray-700 rounded-xl shadow-2xl z-50 p-4 flex flex-col gap-3">
                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Auto-imprimir comandas</p>

                    {/* Enable toggle */}
                    <label className="flex items-center justify-between cursor-pointer">
                      <span className="text-sm text-gray-200">Activar auto-print</span>
                      <button
                        onClick={() => setAutoPrintEnabled(!autoPrintEnabled)}
                        className={`relative w-11 h-6 rounded-full transition-colors duration-200 focus:outline-none ${autoPrintEnabled ? 'bg-green-600' : 'bg-gray-600'}`}
                      >
                        <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform duration-200 ${autoPrintEnabled ? 'translate-x-5' : 'translate-x-0'}`} />
                      </button>
                    </label>

                    {/* Station checkboxes */}
                    <div className="flex flex-col gap-1.5">
                      <p className="text-xs text-gray-400">Estaciones a imprimir:</p>
                      {(['cocina', 'barra'] as const).map(s => (
                        <label key={s} className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={stations.includes(s)}
                            onChange={() => toggleStation(s)}
                            className="w-4 h-4 rounded accent-orange-500"
                          />
                          <span className="text-sm text-gray-200 capitalize">{s === 'cocina' ? '👨‍🍳 Cocina' : '🍹 Barra'}</span>
                        </label>
                      ))}
                    </div>

                    {/* Paper size */}
                    <div className="flex items-center justify-between">
                      <p className="text-xs text-gray-400">Ancho de papel:</p>
                      <div className="flex bg-gray-900 rounded-lg overflow-hidden border border-gray-700">
                        {(['58mm', '80mm'] as const).map(size => (
                          <button
                            key={size}
                            onClick={() => setPaperSize(size)}
                            className={`px-3 py-1.5 text-xs font-semibold transition-colors ${
                              paperSize === size
                                ? 'bg-orange-600 text-white'
                                : 'text-gray-400 hover:text-white'
                            }`}
                          >
                            {size}
                          </button>
                        ))}
                      </div>
                    </div>

                    <p className="text-xs text-gray-500">Imprime un ticket cuando llega un nuevo pedido, sin importar en qué pestaña estés.</p>
                  </div>
                )}
              </div>
              {/* Ventas Button */}
              <button
                onClick={() => navigate('/kitchen/ventas')}
                className={`flex items-center gap-2 px-4 py-2 rounded-full transition-all duration-200 ${
                  isInVentas
                    ? 'bg-emerald-700 text-white shadow-lg shadow-emerald-500/50'
                    : 'bg-gray-700/50 text-gray-400 hover:bg-gray-700 hover:text-emerald-400'
                }`}
              >
                <BarChart2 size={20} />
                <span className="font-bold">Ventas</span>
              </button>

              {/* Inventario Button */}
              <button
                onClick={() => navigate('/kitchen/inventory')}
                className={`flex items-center gap-2 px-4 py-2 rounded-full transition-all duration-200 ${
                  isInInventory
                    ? 'bg-teal-700 text-white shadow-lg shadow-teal-500/50'
                    : 'bg-gray-700/50 text-gray-400 hover:bg-gray-700 hover:text-teal-400'
                }`}
              >
                <Package size={20} />
                <span className="font-bold">Inventario</span>
              </button>

              {/* Mesas Button */}
              <button
                onClick={() => navigate('/kitchen/mesas')}
                className={`flex items-center gap-2 px-4 py-2 rounded-full transition-all duration-200 ${
                  isInMesas
                    ? 'bg-red-700 text-white shadow-lg shadow-red-500/50'
                    : 'bg-gray-700/50 text-gray-400 hover:bg-gray-700 hover:text-red-500'
                }`}
              >
                <LayoutDashboard size={20} />
                <span className="font-bold">Mesas</span>
              </button>

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
          <div className="absolute bottom-full mb-2 left-0 bg-gray-800 border border-gray-800 rounded-lg shadow-xl overflow-hidden w-64 animate-in slide-in-from-bottom-2">
            <div className="p-4 border-b border-gray-800 bg-gray-750">
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
