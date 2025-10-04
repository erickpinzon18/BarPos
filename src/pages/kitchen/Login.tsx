// src/pages/kitchen/Login.tsx
import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import { getConfig } from "../../services/firestoreService";

const KitchenLogin: React.FC = () => {
    const navigate = useNavigate();
    const { login } = useAuth();
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const [config, setConfig] = useState<any | null>(null);

    useEffect(() => {
        let mounted = true;
        (async () => {
            try {
                const cfg = await getConfig();
                if (mounted) setConfig(cfg?.success ? cfg.data : null);
            } catch (err) {
                console.debug("Could not load config/general:", err);
            }
        })();
        return () => {
            mounted = false;
        };
    }, []);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        
        if (!email || !password) {
            setError("Por favor completa todos los campos");
            return;
        }

        setLoading(true);
        setError("");

        try {
            const user = await login(email, password);

            // Verificar que sea kitchen o barra
            if (user.role !== "kitchen" && user.role !== "barra") {
                setError("Acceso denegado. Solo personal de cocina/barra puede acceder.");
                setLoading(false);
                return;
            }

            // Guardar nombre de usuario en localStorage para el layout
            localStorage.setItem(
                "kitchenUserName",
                user.displayName || user.email || "Usuario"
            );

            console.log("Logged in user:", user.role);   

            // Redirigir según el rol
            if (user.role === "kitchen") {
                navigate("/kitchen/cocina");
            } else {
                navigate("/kitchen/barra");
            }
        } catch (error: any) {
            console.error("Login error:", error);
            setError(error?.message || "Error al iniciar sesión");
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
                                e.currentTarget.style.display = "none";
                            }}
                        />
                    ) : (
                        <svg
                            className="w-16 h-16 mx-auto mb-4 text-orange-400"
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
                        {config?.name ?? "Bar POS"}
                    </h1>
                    <p className="text-lg text-orange-400 font-semibold">
                        Cocina & Barra
                    </p>
                    <p className="text-sm text-gray-500 mt-2">
                        Ingresa tus credenciales para continuar
                    </p>
                </div>

                {/* Card de Login */}
                <div className="bg-gray-800 rounded-2xl shadow-xl p-8 border border-gray-700">
                    <div className="text-center mb-6">
                        <div className="w-20 h-20 bg-orange-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
                            <svg
                                className="w-10 h-10 text-orange-400"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                            >
                                <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth="2"
                                    d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                                ></path>
                            </svg>
                        </div>
                        <h2 className="text-2xl font-bold text-white mb-2">
                            Iniciar Sesión
                        </h2>
                        <p className="text-gray-400 text-sm">
                            Acceso para personal de cocina y barra
                        </p>
                    </div>

                    {/* Error Message */}
                    {error && (
                        <div className="mb-6 p-4 bg-red-500/10 border border-red-500/30 rounded-xl">
                            <p className="text-red-400 text-sm text-center">{error}</p>
                        </div>
                    )}

                    {/* Login Form */}
                    <form onSubmit={handleSubmit} className="space-y-6">
                        <div>
                            <label htmlFor="email" className="block text-sm font-medium text-gray-300 mb-2">
                                Correo Electrónico
                            </label>
                            <input
                                id="email"
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-xl text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-all"
                                placeholder="usuario@ejemplo.com"
                                required
                                autoComplete="email"
                            />
                        </div>

                        <div>
                            <label htmlFor="password" className="block text-sm font-medium text-gray-300 mb-2">
                                Contraseña
                            </label>
                            <input
                                id="password"
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-xl text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-all"
                                placeholder="••••••••"
                                required
                                autoComplete="current-password"
                            />
                        </div>

                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full bg-orange-500 hover:bg-orange-600 disabled:bg-orange-500/50 disabled:cursor-not-allowed text-white font-bold py-4 px-6 rounded-xl transition-all duration-200 transform hover:scale-105 shadow-lg hover:shadow-orange-500/50 disabled:transform-none disabled:shadow-none"
                        >
                            {loading ? (
                                <div className="flex items-center justify-center gap-3">
                                    <svg
                                        className="animate-spin h-5 w-5 text-white"
                                        xmlns="http://www.w3.org/2000/svg"
                                        fill="none"
                                        viewBox="0 0 24 24"
                                    >
                                        <circle
                                            className="opacity-25"
                                            cx="12"
                                            cy="12"
                                            r="10"
                                            stroke="currentColor"
                                            strokeWidth="4"
                                        ></circle>
                                        <path
                                            className="opacity-75"
                                            fill="currentColor"
                                            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                                        ></path>
                                    </svg>
                                    <span>Iniciando sesión...</span>
                                </div>
                            ) : (
                                <div className="flex items-center justify-center gap-3">
                                    <svg
                                        className="w-6 h-6"
                                        fill="none"
                                        stroke="currentColor"
                                        viewBox="0 0 24 24"
                                    >
                                        <path
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                            strokeWidth="2"
                                            d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1"
                                        ></path>
                                    </svg>
                                    <span>Iniciar Sesión</span>
                                </div>
                            )}
                        </button>
                    </form>

                    <div className="mt-6 pt-6 border-t border-gray-700">
                        <p className="text-xs text-gray-500 text-center">
                            💡 Serás redirigido a tu estación (cocina o barra) automáticamente
                        </p>
                    </div>
                </div>

                {/* Links a otros logins */}
                <div className="text-sm mt-4 text-center">
                    <a
                        href="/admin/login"
                        className="text-orange-400 hover:text-orange-500 transition-colors opacity-70"
                    >
                        Iniciar sesión como Administrador
                    </a>
                </div>

                <div className="text-sm mt-2 text-center">
                    <a
                        href="/waiter/login"
                        className="text-orange-400 hover:text-orange-500 transition-colors opacity-70"
                    >
                        Iniciar sesión como Mesero
                    </a>
                </div>
            </div>
        </div>
    );
};

export default KitchenLogin;
