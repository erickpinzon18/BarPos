// src/pages/waiter/OrderDetails.tsx
import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Clock, Package, User, Plus, Trash2 } from 'lucide-react';
import { useOrderByTableId } from '../../hooks/useOrders';
import { useProducts } from '../../hooks/useProducts';
import { deleteOrderItem, addItemToOrder, verifyUserPin } from '../../services/orderService';
import { updateOrderPeopleCount } from '../../services/firestoreService';
import PinModal from '../../components/common/PinModal';
import AddItemModal from '../../components/common/AddItemModal';
import QuantityModal from '../../components/common/QuantityModal';
import type { OrderItem, Product } from '../../utils/types';

const WaiterOrderDetails: React.FC = () => {
    const { tableId } = useParams<{ tableId: string }>();
    const navigate = useNavigate();
    const { order, loading, error } = useOrderByTableId(tableId ?? undefined);
    const { products } = useProducts();

    // Estados para el modal de PIN
    const [showPinModal, setShowPinModal] = useState(false);
    const [itemToDelete, setItemToDelete] = useState<string | null>(null);
    const [pinLoading, setPinLoading] = useState(false);

    // Estados para el modal de agregar items
    const [showAddItemModal, setShowAddItemModal] = useState(false);
    const [addItemLoading, setAddItemLoading] = useState(false);

    // Estados para el modal de cantidad (agregar más)
    const [showQuantityModal, setShowQuantityModal] = useState(false);
    const [selectedItemForMore, setSelectedItemForMore] = useState<OrderItem | null>(null);

    // Local state to edit people count (saved via +/- clicks)
    const [peopleCount, setPeopleCount] = useState<number>(order?.peopleCount ?? 1);

    // Ensure we initialize peopleCount from the DB when the order first loads
    const lastOrderIdRef = React.useRef<string | null>(null);
    React.useEffect(() => {
        if (!order) return;

        // When a different order loads (or first load), initialize peopleCount from DB
        if (lastOrderIdRef.current !== order.id) {
            lastOrderIdRef.current = order.id;
            setPeopleCount(order.peopleCount ?? 1);
        }
    }, [order]);

    // Función para iniciar eliminación de item
    const handleDeleteItem = (itemId: string) => {
        setItemToDelete(itemId);
        setShowPinModal(true);
    };

    // Función para confirmar eliminación con PIN
    const handleConfirmDelete = async (pin: string) => {
        if (!order || !itemToDelete) return;

        setPinLoading(true);
        try {
            // Verificar PIN
            const authorizedUser = await verifyUserPin(pin);

            // Only admins can delete items
            if (authorizedUser.role !== 'admin') {
                console.warn('Usuario no autorizado para eliminar item:', authorizedUser);
                throw new Error('PIN válido, pero el usuario no tiene permisos. Solo administradores pueden eliminar items.');
            }

            // Eliminar item
            await deleteOrderItem(order.id, itemToDelete, authorizedUser);

            console.log('✅ Item eliminado exitosamente');
            setShowPinModal(false);
            setItemToDelete(null);
        } catch (error: any) {
            console.error('❌ Error eliminando item:', error);
            throw new Error(error.message || 'Error al eliminar el item');
        } finally {
            setPinLoading(false);
        }
    };

    // Función para cancelar eliminación
    const handleCancelDelete = () => {
        setShowPinModal(false);
        setItemToDelete(null);
    };

    // Función para agregar item a la orden
    const handleAddItem = async (productId: string, quantity: number) => {
        if (!order) return;

        setAddItemLoading(true);
        try {
            const product = products.find((p: Product) => p.id === productId);
            if (!product) {
                throw new Error('Producto no encontrado');
            }

            await addItemToOrder(
                order.id,
                product.id,
                product.name,
                product.price,
                product.category,
                quantity
            );

            console.log('✅ Item agregado exitosamente');
        } catch (error: any) {
            console.error('❌ Error agregando item:', error);
            throw error;
        } finally {
            setAddItemLoading(false);
        }
    };

    // Función para abrir modal de agregar items
    const handleOpenAddItemModal = () => {
        setShowAddItemModal(true);
    };

    // Función para cerrar modal de agregar items
    const handleCloseAddItemModal = () => {
        setShowAddItemModal(false);
    };

    // Función para agregar otro item del mismo tipo
    const handleAddAnother = (item: OrderItem) => {
        setSelectedItemForMore(item);
        setShowQuantityModal(true);
    };

    // Función para confirmar cantidad de item adicional
    const handleConfirmQuantity = async (quantity: number) => {
        if (!order || !selectedItemForMore) return;

        try {
            await addItemToOrder(
                order.id,
                selectedItemForMore.productId,
                selectedItemForMore.productName,
                selectedItemForMore.productPrice,
                selectedItemForMore.category,
                quantity
            );

            console.log('✅ Item adicional agregado:', selectedItemForMore.productName, 'x', quantity);
            setShowQuantityModal(false);
            setSelectedItemForMore(null);
        } catch (error: any) {
            console.error('❌ Error agregando item adicional:', error);
            throw error;
        }
    };

    // Función para cerrar modal de cantidad
    const handleCloseQuantityModal = () => {
        setShowQuantityModal(false);
        setSelectedItemForMore(null);
    };

    // Proceder al pago (Checkout) - navegar a /waiter/checkout/:orderId
    const handleProceedToCheckout = () => {
        if (!order) return;
        navigate(`/waiter/checkout/${order.id}`);
    };

    // Persist peopleCount only when user explicitly clicks + or -
    const savePeopleCountToDB = async (newCount: number) => {
        if (!order) return;

        try {
            const res = await updateOrderPeopleCount(order.id, newCount);
            if (!res.success) {
                console.error('Error saving people count:', res.error);
            }
        } catch (err) {
            console.error('Error saving people count:', err);
        }
    };

    const handleDecrementPeople = () => {
        const next = Math.max(1, peopleCount - 1);
        setPeopleCount(next);
        void savePeopleCountToDB(next);
    };

    const handleIncrementPeople = () => {
        const next = Math.max(1, peopleCount + 1);
        setPeopleCount(next);
        void savePeopleCountToDB(next);
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-400 mx-auto mb-4"></div>
                    <p className="text-gray-400">Cargando orden...</p>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="text-center py-8 px-4">
                <p className="text-red-400 mb-4">{error}</p>
                <button
                    onClick={() => navigate('/waiter/home')}
                    className="bg-green-500 hover:bg-green-600 text-white px-6 py-3 rounded-lg font-medium"
                >
                    Volver a Mesas
                </button>
            </div>
        );
    }

    if (!order) {
        return (
            <div className="text-center py-8 px-4">
                <Package className="w-16 h-16 text-gray-500 mx-auto mb-4" />
                <h2 className="text-xl font-bold text-white mb-2">Orden no encontrada</h2>
                <p className="text-gray-400 mb-4">No se encontró una orden activa para esta mesa.</p>
                <button
                    onClick={() => navigate('/waiter/home')}
                    className="bg-green-500 hover:bg-green-600 text-white px-6 py-3 rounded-lg font-medium"
                >
                    Volver a Mesas
                </button>
            </div>
        );
    }

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'pendiente':
                return 'bg-yellow-500 text-yellow-100';
            case 'en_preparacion':
                return 'bg-blue-500 text-blue-100';
            case 'listo':
                return 'bg-green-500 text-green-100';
            case 'entregado':
                return 'bg-gray-500 text-gray-100';
            default:
                return 'bg-gray-500 text-gray-100';
        }
    };

    const getStatusText = (status: string) => {
        switch (status) {
            case 'pendiente':
                return 'Pendiente';
            case 'en_preparacion':
                return 'En Preparación';
            case 'listo':
                return 'Listo';
            case 'entregado':
                return 'Entregado';
            default:
                return status;
        }
    };

    const timeElapsed = Math.floor((new Date().getTime() - order.createdAt.getTime()) / (1000 * 60));

    // Calcular totales dinámicamente basado en items activos
    const activeItems = order.items.filter(item => !item.isDeleted);
    const calculatedSubtotal = activeItems.reduce((sum, item) => sum + (item.productPrice * item.quantity), 0);
    const calculatedTotal = calculatedSubtotal;

    // Determinar si es la barra (mesa 0)
    const isBar = order.tableNumber === 0;

    return (
        <div className="min-h-screen bg-gray-900 pb-24">
            {/* Fixed Header - Mobile Optimized */}
            <div className="sticky top-0 z-10 bg-gray-800 border-b border-gray-700 shadow-lg">
                <div className="flex items-center justify-between p-4">
                    <div className="flex items-center flex-1">
                        <button
                            onClick={() => navigate('/waiter/home')}
                            className="mr-3 p-2 hover:bg-gray-700 rounded-lg transition-colors"
                        >
                            <ArrowLeft className="w-6 h-6 text-gray-400" />
                        </button>
                        <div className="flex-1">
                            <h1 className="text-2xl font-bold text-white">{isBar ? '🍹 Barra' : `Mesa ${order.tableNumber}`}</h1>
                            <p className="text-xs text-gray-400">#{order.id.slice(-8)}</p>
                        </div>
                    </div>
                    <div className="text-right">
                        <p className={`text-2xl font-bold ${isBar ? 'text-purple-400' : 'text-green-400'}`}>${calculatedTotal.toFixed(2)}</p>
                        <p className="text-xs text-gray-400">Total</p>
                    </div>
                </div>
            </div>

            <div className="p-4 space-y-4">
                {/* Info Cards - Mobile Stack */}
                <div className="grid grid-cols-2 gap-3">
                    <div className="bg-gray-800 p-4 rounded-xl border border-gray-700">
                        <div className="flex items-center mb-2">
                            <User className="w-5 h-5 text-green-400 mr-2" />
                            <p className="text-xs text-gray-400">Mesero</p>
                        </div>
                        <p className="text-sm font-semibold text-white truncate">{order.waiterName}</p>
                    </div>

                    <div className="bg-gray-800 p-4 rounded-xl border border-gray-700">
                        <div className="flex items-center mb-2">
                            <Clock className="w-5 h-5 text-green-400 mr-2" />
                            <p className="text-xs text-gray-400">Tiempo</p>
                        </div>
                        <p className="text-sm font-semibold text-white">{timeElapsed} min</p>
                    </div>

                    <div className="bg-gray-800 p-4 rounded-xl border border-gray-700">
                        <div className="flex items-center mb-2">
                            <Package className="w-5 h-5 text-green-400 mr-2" />
                            <p className="text-xs text-gray-400">Items</p>
                        </div>
                        <p className="text-sm font-semibold text-white">
                            {order.items
                                .filter(item => !item.isDeleted)
                                .reduce((total, item) => total + item.quantity, 0)
                            }
                        </p>
                        <p className="text-xs text-gray-500">
                            {order.items.filter(item => !item.isDeleted).length} tipos
                        </p>
                    </div>

                    <div className="bg-gray-800 p-4 rounded-xl border border-gray-700">
                        <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center">
                                <User className="w-5 h-5 text-green-400 mr-2" />
                                <p className="text-xs text-gray-400">Personas</p>
                            </div>
                        </div>
                        <div className="flex items-center justify-between">
                            <p className="text-sm font-semibold text-white">{peopleCount}</p>
                            <div className="flex items-center space-x-1">
                                <button
                                    onClick={handleDecrementPeople}
                                    className="w-8 h-8 bg-gray-700 rounded text-gray-300 hover:bg-gray-600 font-bold"
                                    aria-label="Disminuir"
                                >-</button>
                                <button
                                    onClick={handleIncrementPeople}
                                    className="w-8 h-8 bg-gray-700 rounded text-gray-300 hover:bg-gray-600 font-bold"
                                    aria-label="Aumentar"
                                >+</button>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Estado de Preparación - Compacto para móvil */}
                <div className="bg-gray-800 p-4 rounded-xl border border-gray-700">
                    <h3 className="text-sm font-semibold text-white mb-3 flex items-center">
                        <div className="w-2 h-2 bg-green-400 rounded-full mr-2"></div>
                        Estado de Items
                    </h3>
                    <div className="grid grid-cols-4 gap-2">
                        {(() => {
                            const activeItems = order.items.filter(item => !item.isDeleted);
                            const pendingCount = activeItems.filter(item => item.status === 'pendiente').reduce((sum, item) => sum + item.quantity, 0);
                            const preparingCount = activeItems.filter(item => item.status === 'en_preparacion').reduce((sum, item) => sum + item.quantity, 0);
                            const readyCount = activeItems.filter(item => item.status === 'listo').reduce((sum, item) => sum + item.quantity, 0);
                            const deliveredCount = activeItems.filter(item => item.status === 'entregado').reduce((sum, item) => sum + item.quantity, 0);

                            return (
                                <>
                                    <div className="text-center p-2 bg-yellow-900/20 border border-yellow-600 rounded-lg">
                                        <div className="text-xl font-bold text-yellow-400">{pendingCount}</div>
                                        <div className="text-xs text-yellow-300">⏳</div>
                                    </div>
                                    <div className="text-center p-2 bg-orange-900/20 border border-orange-600 rounded-lg">
                                        <div className="text-xl font-bold text-orange-400">{preparingCount}</div>
                                        <div className="text-xs text-orange-300">🔥</div>
                                    </div>
                                    <div className="text-center p-2 bg-green-900/20 border border-green-600 rounded-lg">
                                        <div className="text-xl font-bold text-green-400">{readyCount}</div>
                                        <div className="text-xs text-green-300">✅</div>
                                    </div>
                                    <div className="text-center p-2 bg-blue-900/20 border border-blue-600 rounded-lg">
                                        <div className="text-xl font-bold text-blue-400">{deliveredCount}</div>
                                        <div className="text-xs text-blue-300">🍽️</div>
                                    </div>
                                </>
                            );
                        })()}
                    </div>
                </div>

                {/* Items List - Mobile Optimized */}
                <div className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden">
                    <div className="p-4 border-b border-gray-700 flex items-center justify-between">
                        <h2 className="text-lg font-bold text-white">Items</h2>
                        <button
                            onClick={handleOpenAddItemModal}
                            className="bg-green-500 hover:bg-green-600 text-white p-2 rounded-lg transition-colors"
                        >
                            <Plus className="w-5 h-5" />
                        </button>
                    </div>

                    <div className="divide-y divide-gray-700">
                        {order.items.length === 0 || order.items.every(item => item.isDeleted) ? (
                            // Estado vacío - sin items
                            <div className="p-8 text-center">
                                <Package className="w-16 h-16 text-gray-500 mx-auto mb-4" />
                                <h3 className="text-lg font-bold text-white mb-2">
                                    {order.items.length === 0 ? 'Orden Vacía' : 'Items Eliminados'}
                                </h3>
                                <p className="text-sm text-gray-400 mb-6">
                                    {order.items.length === 0
                                        ? 'Agrega productos a esta mesa.'
                                        : 'Todos los productos han sido eliminados.'
                                    }
                                </p>
                                <button
                                    onClick={handleOpenAddItemModal}
                                    className="bg-green-500 hover:bg-green-600 text-white font-medium py-3 px-6 rounded-lg inline-flex items-center"
                                >
                                    <Plus className="w-5 h-5 mr-2" />
                                    Agregar Productos
                                </button>
                            </div>
                        ) : (
                            // Lista de items - Compacta para móvil
                            order.items.map((item: OrderItem) => {
                                const isDeleted = item.isDeleted;

                                return (
                                    <div
                                        key={item.id}
                                        className={`p-4 ${isDeleted
                                                ? 'bg-gray-800/50 border-l-4 border-gray-600'
                                                : 'hover:bg-gray-700/50'
                                            }`}
                                    >
                                        <div className="flex items-start justify-between mb-2">
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2 mb-1">
                                                    <h3 className={`font-semibold truncate ${isDeleted ? 'text-gray-500 line-through' : 'text-white'
                                                        }`}>
                                                        {item.productName}
                                                    </h3>
                                                    <span className={`text-xs font-bold px-2 py-0.5 rounded-full flex-shrink-0 ${getStatusColor(item.status)
                                                        }`}>
                                                        {getStatusText(item.status)}
                                                    </span>
                                                </div>
                                                <div className="flex items-center gap-3 text-xs text-gray-400">
                                                    <span>Cant: {item.quantity}</span>
                                                    <span>${item.productPrice.toFixed(2)} c/u</span>
                                                    <span className="text-green-400 font-semibold">
                                                        ${(item.productPrice * item.quantity).toFixed(2)}
                                                    </span>
                                                </div>
                                                {item.notes && (
                                                    <p className="text-xs text-gray-500 mt-1 italic">
                                                        "{item.notes}"
                                                    </p>
                                                )}
                                                {isDeleted && (
                                                    <p className="text-xs text-red-400 mt-1 font-medium">
                                                        ❌ Eliminado por: {item.deletedByName || 'Admin'}
                                                    </p>
                                                )}
                                            </div>
                                            {!isDeleted && (
                                                <div className="flex flex-col gap-2 ml-2">
                                                    <button
                                                        onClick={() => handleAddAnother(item)}
                                                        className="p-2 bg-green-600 hover:bg-green-700 rounded-lg transition-colors"
                                                        title="Agregar más"
                                                    >
                                                        <Plus className="w-4 h-4 text-white" />
                                                    </button>
                                                    <button
                                                        onClick={() => handleDeleteItem(item.id)}
                                                        className="p-2 bg-red-600 hover:bg-red-700 rounded-lg transition-colors"
                                                        title="Eliminar"
                                                    >
                                                        <Trash2 className="w-4 h-4 text-white" />
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                );
                            })
                        )}
                    </div>

                    {/* Resumen - Compacto */}
                    <div className="p-4 bg-gray-700/50 border-t border-gray-600">
                        <div className="space-y-1.5 mb-4">
                            <div className="flex justify-between text-lg font-bold text-white">
                                <span>Total:</span>
                                <span>${calculatedTotal.toFixed(2)}</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Fixed Bottom Action Buttons - Mobile */}
            <div className="fixed bottom-0 left-0 right-0 bg-gray-800 border-t border-gray-700 p-4 shadow-lg z-20">
                <div className="flex gap-3">
                    <button
                        onClick={handleOpenAddItemModal}
                        className="flex-1 bg-green-500 hover:bg-green-600 text-white font-medium py-4 rounded-lg transition-colors flex items-center justify-center gap-2"
                    >
                        <Plus className="w-5 h-5" />
                        Agregar
                    </button>

                    {(() => {
                        const activeItemUnits = order.items
                            .filter(i => !i.isDeleted)
                            .reduce((sum, i) => sum + i.quantity, 0);
                        const hasUndelivered = order.items
                            .filter(i => !i.isDeleted)
                            .some(i => i.status !== 'entregado');
                        const canCheckout = activeItemUnits > 0 && !hasUndelivered;
                        return (
                            <button
                                onClick={handleProceedToCheckout}
                                disabled={!canCheckout}
                                className={`flex-1 font-medium py-4 rounded-lg transition-colors ${canCheckout 
                                    ? 'bg-blue-600 hover:bg-blue-700 text-white' 
                                    : 'bg-gray-600 text-gray-400 cursor-not-allowed'}`}
                                title={canCheckout ? 'Proceder al pago' : hasUndelivered ? 'Hay items pendientes' : 'Agrega productos primero'}
                            >
                                💳 Cobrar
                            </button>
                        );
                    })()}
                </div>
                {(() => {
                    const hasUndelivered = order.items
                        .filter(i => !i.isDeleted)
                        .some(i => i.status !== 'entregado');
                    return hasUndelivered ? (
                        <p className="text-xs text-yellow-300 mt-2 text-center">
                            ⚠️ No puedes cobrar: hay items sin entregar
                        </p>
                    ) : null;
                })()}
            </div>

            {/* PIN Modal */}
            <PinModal
                isOpen={showPinModal}
                onClose={handleCancelDelete}
                onConfirm={handleConfirmDelete}
                loading={pinLoading}
                title="Eliminar Item"
                message={`¿Eliminar "${order.items.find(i => i.id === itemToDelete)?.productName}"? Requiere PIN de administrador.`}
            />

            {/* Add Item Modal */}
            <AddItemModal
                isOpen={showAddItemModal}
                onClose={handleCloseAddItemModal}
                onAddItem={handleAddItem}
                products={products}
                loading={addItemLoading}
            />

            {/* Quantity Modal for Adding More */}
            <QuantityModal
                isOpen={showQuantityModal}
                onClose={handleCloseQuantityModal}
                onConfirm={handleConfirmQuantity}
                title="Agregar Más"
                product={selectedItemForMore ? {
                    id: selectedItemForMore.productId,
                    name: selectedItemForMore.productName,
                    description: `Agregar más ${selectedItemForMore.productName}`,
                    price: selectedItemForMore.productPrice,
                    category: selectedItemForMore.category,
                    available: true,
                    imageUrl: undefined,
                    createdAt: new Date(),
                    updatedAt: new Date()
                } : null}
                loading={addItemLoading}
            />
        </div>
    );
};

export default WaiterOrderDetails;
