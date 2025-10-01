// src/pages/admin/Login.tsx
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';

const AdminLogin: React.FC = () => {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setLoading(true);
      setError('');
      await login(email, password);
      navigate('/admin/home');
    } catch (err: any) {
      setError('Usuario o contraseña incorrectos.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-900 text-gray-200 flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-xs">
        {/* Logo y Título */}
        <div className="text-center mb-10">
          {/* Icono de copa de cocktail */}
          <svg 
            className="w-14 h-14 mx-auto mb-4 text-amber-400" 
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
          <h1 className="text-3xl font-bold tracking-tighter text-white">Bar POS</h1>
        </div>

        {/* Formulario de Login */}
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Campo de Email */}
          <div>
            <label htmlFor="email" className="sr-only">Email</label>
            <input 
              type="email" 
              id="email" 
              name="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="bg-gray-800 border border-gray-700 placeholder-gray-500 text-white text-sm rounded-lg focus:ring-amber-500 focus:border-amber-500 block w-full p-3.5 transition duration-300 ease-in-out" 
              placeholder="Email" 
              required
            />
          </div>

          {/* Campo de Contraseña */}
          <div>
            <label htmlFor="password" className="sr-only">Contraseña</label>
            <input 
              type="password" 
              id="password" 
              name="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="bg-gray-800 border border-gray-700 placeholder-gray-500 text-white text-sm rounded-lg focus:ring-amber-500 focus:border-amber-500 block w-full p-3.5 transition duration-300 ease-in-out" 
              placeholder="Contraseña" 
              required
            />
          </div>
          
          {/* Mensaje de Error */}
          {error && (
            <div className="text-red-400 text-sm pt-1 text-center">
              {error}
            </div>
          )}

          {/* Botón de Iniciar Sesión */}
          <button 
            type="submit" 
            disabled={loading}
            className="w-full text-gray-900 bg-amber-400 hover:bg-amber-500 focus:ring-4 focus:outline-none focus:ring-amber-300 font-medium rounded-lg text-sm px-5 py-3.5 text-center transition duration-300 ease-in-out transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
          >
            {loading ? 'Entrando...' : 'Entrar'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default AdminLogin;
