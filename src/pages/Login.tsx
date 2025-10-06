// src/pages/Login.tsx
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { getConfig } from '../services/firestoreService';

const Login: React.FC = () => {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [config, setConfig] = useState<any | null>(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const cfg = await getConfig();
        if (mounted) setConfig(cfg?.success ? cfg.data : null);
      } catch (err) {
        console.debug('Could not load config/general:', err);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setLoading(true);
      setError('');
      
      const user = await login(email, password);
      
      // Redirigir según el rol del usuario
      switch (user.role) {
        case 'admin':
          navigate('/admin/home');
          break;
        case 'waiter':
          navigate('/waiter/home');
          break;
        case 'kitchen':
          // Guardar nombre de usuario en localStorage para el layout
          localStorage.setItem('kitchenUserName', user.displayName || user.email || 'Usuario');
          navigate('/kitchen/cocina');
          break;
        case 'barra':
          // Guardar nombre de usuario en localStorage para el layout
          localStorage.setItem('kitchenUserName', user.displayName || user.email || 'Usuario');
          navigate('/kitchen/barra');
          break;
        default:
          setError('Rol de usuario no reconocido');
          setLoading(false);
          return;
      }
    } catch (err: any) {
      setError(err?.message || 'Usuario o contraseña incorrectos.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-900 text-gray-200 flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo y Título */}
        <div className="text-center mb-10">
          {config?.logoUrl ? (
            <img
              src={config.logoUrl}
              alt="logo"
              className="w-44 h-44 mx-auto mb-4 object-contain rounded"
              onError={(e) => {
                e.currentTarget.style.display = 'none';
              }}
            />
          ) : (
            <svg 
              className="w-16 h-16 mx-auto mb-4 text-amber-400" 
              viewBox="0 0 24 24" 
              fill="none" 
              stroke="currentColor" 
              strokeWidth="1.5" 
              strokeLinecap="round" 
              strokeLinejoin="round"
            >
              <path d="M8 22h8"></path>
              <path d="M12 12v10"></path>
              <path d="m19 2-7 10-7-10"></path>
            </svg>
          )}
          <h1 className="text-4xl font-bold tracking-tighter text-white mb-2">
            {config?.name ?? 'Bar POS'}
          </h1>
          <p className="text-lg text-amber-400 font-semibold">Sistema de Punto de Venta</p>
          <p className="text-sm text-gray-500 mt-2">Ingresa tus credenciales para continuar</p>
        </div>

        {/* Card de Login */}
        <div className="bg-gray-800 rounded-2xl shadow-xl p-8 border border-gray-700">
          <div className="text-center mb-6">
            <div className="w-20 h-20 bg-amber-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg
                className="w-10 h-10 text-amber-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                ></path>
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-white mb-2">Iniciar Sesión</h2>
            <p className="text-gray-400 text-sm">Acceso para todo el personal</p>
          </div>

          {/* Formulario de Login */}
          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Campo de Email */}
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-300 mb-2">
                Correo Electrónico
              </label>
              <input 
                type="email" 
                id="email" 
                name="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="bg-gray-700/50 border border-gray-600 placeholder-gray-400 text-white text-sm rounded-xl focus:ring-2 focus:ring-amber-500 focus:border-amber-500 block w-full p-3.5 transition duration-200" 
                placeholder="correo@ejemplo.com" 
                required
                autoComplete="email"
              />
            </div>

            {/* Campo de Contraseña */}
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-300 mb-2">
                Contraseña
              </label>
              <input 
                type="password" 
                id="password" 
                name="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="bg-gray-700/50 border border-gray-600 placeholder-gray-400 text-white text-sm rounded-xl focus:ring-2 focus:ring-amber-500 focus:border-amber-500 block w-full p-3.5 transition duration-200" 
                placeholder="••••••••" 
                required
                autoComplete="current-password"
              />
            </div>
            
            {/* Mensaje de Error */}
            {error && (
              <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3">
                <p className="text-red-400 text-sm text-center">{error}</p>
              </div>
            )}

            {/* Botón de Iniciar Sesión */}
            <button 
              type="submit" 
              disabled={loading}
              className="w-full bg-amber-500 hover:bg-amber-600 text-white font-bold py-4 px-6 rounded-xl transition-all duration-200 transform hover:scale-105 shadow-lg hover:shadow-amber-500/50 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
            >
              <div className="flex items-center justify-center gap-3">
                {loading ? (
                  <>
                    <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    <span>Ingresando...</span>
                  </>
                ) : (
                  <>
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1"></path>
                    </svg>
                    <span>Entrar</span>
                  </>
                )}
              </div>
            </button>
          </form>

          <div className="mt-6 pt-6 border-t border-gray-700">
            <div className="flex flex-wrap justify-center gap-4 text-xs text-gray-400">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 bg-amber-500 rounded-full"></span>
                <span>Administrador</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                <span>Mesero</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 bg-orange-500 rounded-full"></span>
                <span>Cocina/Barra</span>
              </div>
            </div>
            <p className="text-xs text-gray-500 text-center mt-3">
              🔄 Serás redirigido automáticamente según tu rol
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;
