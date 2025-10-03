// src/pages/kitchen/Login.tsx
import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import PinModal from "../../components/common/PinModal";
import { verifyUserPin } from "../../services/orderService";
import { getConfig } from "../../services/firestoreService";
import toast from "react-hot-toast";

const KitchenLogin: React.FC = () => {
    const navigate = useNavigate();
    const [showPinModal, setShowPinModal] = useState(false);
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

    const handlePinSubmit = async (pin: string) => {
        try {
            const user = await verifyUserPin(pin);

            if (!user) {
                toast.error("PIN incorrecto");
                return;
            }

            // Verificar que sea kitchen o barra
            if (user.role !== "kitchen" && user.role !== "barra") {
                toast.error(
                    "Acceso denegado. Solo personal de cocina/barra puede acceder."
                );
                return;
            }

            // Guardar nombre de usuario en localStorage para el layout
            localStorage.setItem(
                "kitchenUserName",
                user.displayName || user.email || "Usuario"
            );

            // Redirigir según el rol
            if (user.role === "kitchen") {
                navigate("/kitchen/cocina");
            } else {
                navigate("/kitchen/barra");
            }

            setShowPinModal(false);
            toast.success(`Bienvenido, ${user.displayName || user.email}`);
        } catch (error: any) {
            console.error("Error verifying PIN:", error);
            toast.error(error?.message || "PIN incorrecto");
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
                        Ingresa tu PIN para continuar
                    </p>
                </div>

                {/* Card de Acceso */}
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
                            Autenticación
                        </h2>
                        <p className="text-gray-400 text-sm">
                            Toca el botón para ingresar tu PIN
                        </p>
                    </div>

                    <button
                        onClick={() => setShowPinModal(true)}
                        className="w-full bg-orange-500 hover:bg-orange-600 text-white font-bold py-4 px-6 rounded-xl transition-all duration-200 transform hover:scale-105 shadow-lg hover:shadow-orange-500/50"
                    >
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
                                    d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z"
                                ></path>
                            </svg>
                            <span>Ingresar PIN</span>
                        </div>
                    </button>

                    <div className="mt-6 pt-6 border-t border-gray-700">
                        <p className="text-xs text-gray-500 text-center">
                            💡 Tu PIN de 4 dígitos te redirigirá automáticamente
                            a tu estación
                        </p>
                    </div>
                </div>

                {/* Link para ir a login de mesero o cocina */}
                <div className="text-sm mt-4 text-center">
                    <a
                        href="/admin/login"
                        className="text-amber-400 hover:text-amber-500 transition-colors opacity-70"
                    >
                        Iniciar sesión como Administrador
                    </a>
                </div>

                {/* Link para ir a login de mesero o cocina */}
                <div className="text-sm mt-2 text-center">
                    <a
                        href="/waiter/login"
                        className="text-amber-400 hover:text-amber-500 transition-colors opacity-70"
                    >
                        Iniciar sesión como Mesero
                    </a>
                </div>
            </div>

            {/* PIN Modal */}
            {showPinModal && (
                <PinModal
                    isOpen={showPinModal}
                    onClose={() => setShowPinModal(false)}
                    onConfirm={handlePinSubmit}
                    title="Ingresa tu PIN"
                    message="PIN de 4 dígitos"
                />
            )}
        </div>
    );
};

export default KitchenLogin;
