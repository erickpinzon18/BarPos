import React from "react";
import { useAuth } from "../../contexts/AuthContext";
import { getConfig } from '../../services/firestoreService';
import { NavLink, useNavigate } from "react-router-dom";
import toast from 'react-hot-toast';
import {
    LayoutDashboard,
    ChefHat,
    GlassWater,
    Receipt,
    Package,
    Settings,
    LogOut,
    UserCircle,
    ClipboardCheck,
    Calculator,
    CreditCard,
} from "lucide-react";

// Estilos para los enlaces de navegación, cambia el color si está activo
const navLinkClass = ({ isActive }: { isActive: boolean }) =>
    `flex items-center gap-3 py-2.5 px-4 rounded-lg transition-colors text-sm font-medium ${
        isActive
            ? "bg-amber-500/10 text-amber-400"
            : "text-gray-400 hover:bg-gray-700/50 hover:text-gray-200"
    }`;

const logoutButtonClass = `flex w-full items-center gap-3 py-2.5 px-4 rounded-lg transition-colors text-sm font-medium text-red-400 hover:bg-red-500/10 hover:text-red-300`;

export const AdminSidebar: React.FC = () => {
    const { currentUser, logout } = useAuth();
    const navigate = useNavigate();
    const [businessName, setBusinessName] = React.useState<string | null>(null);
    const [logoUrl, setLogoUrl] = React.useState<string | null>(null);

    React.useEffect(() => {
        let mounted = true;
        const load = async () => {
            try {
                const res = await getConfig('general');
                if (!mounted) return;
                if (res.success && res.data) {
                    setBusinessName(res.data.name ?? null);
                    setLogoUrl(res.data.logoUrl ?? null);
                }
            } catch (err) {
                // ignore
            }
        };
        void load();
        return () => { mounted = false; };
    }, []);

    const handleLogout = async () => {
        try {
            await logout();
            navigate('/admin/login');
        } catch (err: any) {
            console.error('Error during logout:', err);
            toast.error(err?.message || 'Error al cerrar sesión');
        }
    };

    return (
        <aside className="bg-gray-800 text-gray-100 w-64 p-4 hidden md:flex flex-col h-screen overflow-y-auto">
            {/* Logo y Título */}
            <div className="flex items-center justify-center px-4 py-4 flex-shrink-0">
                {logoUrl ? (
                    <img src={logoUrl} alt="logo" className="w-10 h-10 mr-2 object-contain rounded" />
                ) : (
                    <svg
                        className="w-10 h-10 mr-2 text-amber-400"
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
                <span className="text-2xl font-bold tracking-tighter text-white">
                    {businessName ?? 'Bar POS'}
                </span>
            </div>

            {/* Contenedor principal para separar la navegación del pie de página */}
            <div className="flex flex-col justify-between flex-grow mt-4">
                {/* Navegación Principal */}
                <nav className="space-y-2">
                    <NavLink to="/admin/home" className={navLinkClass}>
                        <LayoutDashboard size={20} />
                        <span>Mesas</span>
                    </NavLink>
                    <NavLink to="/admin/kanban/cocina" className={navLinkClass}>
                        <ChefHat size={20} />
                        <span>Cocina</span>
                    </NavLink>
                    <NavLink to="/admin/kanban/barra" className={navLinkClass}>
                        <GlassWater size={20} />
                        <span>Barra</span>
                    </NavLink>
                    <NavLink to="/admin/panel" className={navLinkClass}>
                        <ClipboardCheck size={20} />
                        <span>Panel de pedidos</span>
                    </NavLink>
                    <NavLink to="/admin/tickets" className={navLinkClass}>
                        <Receipt size={20} />
                        <span>Tickets</span>
                    </NavLink>
                    <NavLink to="/admin/pagos-terminal" className={navLinkClass}>
                        <CreditCard size={20} />
                        <span>Pagos Terminal</span>
                    </NavLink>
                    <NavLink to="/admin/cierre" className={navLinkClass}>
                        <Calculator size={20} />
                        <span>Cierre de Caja</span>
                    </NavLink>
                    <NavLink
                        to="/admin/manage-products"
                        className={navLinkClass}
                    >
                        <Package size={20} />
                        <span>Productos</span>
                    </NavLink>
                </nav>

                {/* Sección Inferior: Configuración y Usuario */}
                <div>
                    <NavLink to="/admin/settings" className={navLinkClass}>
                        <Settings size={20} />
                        <span>Configuración</span>
                    </NavLink>

                    <hr className="my-4 border-gray-700" />

                    {/* Perfil de Usuario */}
                    <div className="flex items-center gap-3 p-2 mb-2">
                        <UserCircle size={40} className="text-gray-500" />
                        <div>
                            <p className="font-semibold text-white text-sm">
                                {currentUser?.displayName ?? "Usuario"}
                            </p>
                            <p className="text-xs text-gray-400">
                                {currentUser?.email ?? "—"}
                            </p>
                        </div>
                    </div>

                    {/* Botón de Cerrar Sesión */}
                    <button
                        onClick={handleLogout}
                        className={logoutButtonClass}
                    >
                        <LogOut size={20} />
                        <span>Cerrar Sesión</span>
                    </button>
                </div>
            </div>
        </aside>
    );
};

export default AdminSidebar;
