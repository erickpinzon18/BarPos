// src/pages/admin/Login.tsx
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { getConfig } from '../../services/firestoreService';

const AdminLogin: React.FC = () => {
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
      // Enforce admin role
      if (user.role !== 'admin') {
        setError('Acceso denegado. Solo administradores pueden acceder.');
        setLoading(false);
        return;
      }
      navigate('/admin/home');
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
          <p className="text-lg text-amber-400 font-semibold">Administrador</p>
          <p className="text-sm text-gray-500 mt-2">Acceso al panel de control</p>
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
                  d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
                ></path>
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-white mb-2">Iniciar Sesión</h2>
            <p className="text-gray-400 text-sm">Ingresa tus credenciales</p>
          </div>

          {/* Formulario de Login */}
          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Campo de Email */}
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-300 mb-2">
                Email
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
                    <span>Entrando...</span>
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
            <p className="text-xs text-gray-500 text-center">
              🔐 Panel exclusivo para administradores
            </p>
          </div>
        </div>

        {/* Links a otros logins */}
        <div className="mt-6 space-y-2">
          <div className="text-sm text-center">
            <a
              href="/waiter/login"
              className="text-amber-400 hover:text-amber-500 transition-colors opacity-70 hover:opacity-100"
            >
              Iniciar sesión como Mesero
            </a>
          </div>
          
          <div className="text-sm text-center">
            <a
              href="/kitchen/login"
              className="text-amber-400 hover:text-amber-500 transition-colors opacity-70 hover:opacity-100"
            >
              Iniciar sesión como Cocina / Barra
            </a>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminLogin;
