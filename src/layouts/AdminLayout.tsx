// src/layouts/AdminLayout.tsx
import React, { useState } from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import AdminSidebar from '../components/common/AdminSidebar';
import { useAuth } from '../contexts/AuthContext';
import {
  LayoutDashboard,
  ChefHat,
  GlassWater,
  Receipt,
  Package,
  Settings,
  LogOut,
  Menu,
  X,
  ClipboardCheck,
  Calculator,
} from 'lucide-react';
import toast from 'react-hot-toast';

const navLinkClassMobile = ({ isActive }: { isActive: boolean }) =>
  `flex items-center gap-3 py-3 px-4 rounded-lg transition-colors text-sm font-medium ${
    isActive
      ? 'bg-amber-500/20 text-amber-400 border-l-4 border-amber-400'
      : 'text-gray-400 hover:bg-gray-700/50 hover:text-gray-200'
  }`;

const AdminLayout: React.FC = () => {
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  const { currentUser, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    try {
      await logout();
      setShowMobileMenu(false);
      navigate('/admin/login');
    } catch (err: any) {
      console.error('Error during logout:', err);
      toast.error(err?.message || 'Error al cerrar sesión');
    }
  };

  const closeMobileMenu = () => {
    setShowMobileMenu(false);
  };

  return (
    <div className="bg-gray-900 text-gray-200 h-screen flex overflow-hidden">
      <AdminSidebar />
      <main className="flex-1 overflow-y-auto p-4 md:p-8">
        <Outlet />
      </main>

      {/* Botón flotante para móvil (solo visible en pantallas pequeñas) */}
      <div className="md:hidden fixed bottom-6 right-6 z-50">
        <button
          onClick={() => setShowMobileMenu(!showMobileMenu)}
          className="bg-amber-500 hover:bg-amber-600 text-gray-900 rounded-full p-4 shadow-lg hover:shadow-xl transition-all duration-200"
          aria-label="Abrir menú"
        >
          {showMobileMenu ? <X size={24} /> : <Menu size={24} />}
        </button>
      </div>

      {/* Menú móvil desplegable */}
      {showMobileMenu && (
        <>
          {/* Overlay para cerrar al hacer click fuera */}
          <div
            className="md:hidden fixed inset-0 bg-black/50 z-40 backdrop-blur-sm"
            onClick={closeMobileMenu}
          />
          
          {/* Panel del menú */}
          <div className="md:hidden fixed bottom-0 left-0 right-0 bg-gray-800 border-t-2 border-amber-500 z-50 max-h-[80vh] overflow-y-auto rounded-t-3xl shadow-2xl animate-in slide-in-from-bottom-full duration-300">
            <div className="p-6">
              {/* Header del usuario */}
              <div className="flex items-center gap-4 mb-6 pb-6 border-b border-gray-700">
                <div className="w-12 h-12 rounded-full bg-amber-500/20 flex items-center justify-center">
                  <span className="text-2xl">👤</span>
                </div>
                <div className="flex-1">
                  <p className="font-bold text-white text-lg">
                    {currentUser?.displayName ?? 'Usuario'}
                  </p>
                  <p className="text-sm text-gray-400">
                    {currentUser?.email ?? '—'}
                  </p>
                </div>
              </div>

              {/* Navegación */}
              <nav className="space-y-2 mb-6">
                <NavLink
                  to="/admin/home"
                  className={navLinkClassMobile}
                  onClick={closeMobileMenu}
                >
                  <LayoutDashboard size={20} />
                  <span>Mesas</span>
                </NavLink>
                <NavLink
                  to="/admin/kanban/cocina"
                  className={navLinkClassMobile}
                  onClick={closeMobileMenu}
                >
                  <ChefHat size={20} />
                  <span>Cocina</span>
                </NavLink>
                <NavLink
                  to="/admin/kanban/barra"
                  className={navLinkClassMobile}
                  onClick={closeMobileMenu}
                >
                  <GlassWater size={20} />
                  <span>Barra</span>
                </NavLink>
                <NavLink
                  to="/admin/panel"
                  className={navLinkClassMobile}
                  onClick={closeMobileMenu}
                >
                  <ClipboardCheck size={20} />
                  <span>Panel de pedidos</span>
                </NavLink>
                <NavLink
                  to="/admin/tickets"
                  className={navLinkClassMobile}
                  onClick={closeMobileMenu}
                >
                  <Receipt size={20} />
                  <span>Tickets</span>
                </NavLink>
                <NavLink
                  to="/admin/cierre"
                  className={navLinkClassMobile}
                  onClick={closeMobileMenu}
                >
                  <Calculator size={20} />
                  <span>Cierre de Caja</span>
                </NavLink>
                <NavLink
                  to="/admin/manage-products"
                  className={navLinkClassMobile}
                  onClick={closeMobileMenu}
                >
                  <Package size={20} />
                  <span>Productos</span>
                </NavLink>
                <NavLink
                  to="/admin/settings"
                  className={navLinkClassMobile}
                  onClick={closeMobileMenu}
                >
                  <Settings size={20} />
                  <span>Configuración</span>
                </NavLink>
              </nav>

              {/* Botón de cerrar sesión */}
              <button
                onClick={handleLogout}
                className="w-full flex items-center gap-3 py-3 px-4 rounded-lg text-red-400 hover:bg-red-500/10 transition-colors font-medium"
              >
                <LogOut size={20} />
                <span>Cerrar Sesión</span>
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default AdminLayout;
