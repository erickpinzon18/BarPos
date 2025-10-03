// src/pages/admin/OrderDetails.tsx
import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useOrderByTableId } from '../../hooks/useOrders';
import { deleteOrderItem, verifyUserPin, addItemToOrder } from '../../services/orderService';
import PinModal from '../../components/common/PinModal';
import QuantityModal from '../../components/common/QuantityModal';
import { ArrowLeft, Clock, User, Package, Trash2, Plus } from 'lucide-react';
import type { OrderItem, Product } from '../../utils/types';
import { useProducts } from '../../hooks/useProducts';
import AddItemModal from '../../components/common/AddItemModal';
import { updateOrderPeopleCount } from '../../services/firestoreService';

const OrderDetails: React.FC = () => {
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

    // 'order' now comes directly from the optimized hook

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

    // Proceder al pago (Checkout) - navegar a /admin/checkout/:orderId
    const handleProceedToCheckout = () => {
        if (!order) return;
        navigate(`/admin/checkout/${order.id}`);
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
            <div className="flex items-center justify-center min-h-64">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-amber-400 mx-auto mb-4"></div>
                    <p className="text-gray-400">Cargando detalles de la orden...</p>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="text-center py-8">
                <p className="text-red-400">{error}</p>
                <button
                    onClick={() => navigate('/admin/home')}
                    className="mt-4 bg-amber-500 hover:bg-amber-600 text-gray-900 px-4 py-2 rounded-lg"
                >
                    Volver al Panel
                </button>
            </div>
        );
    }

    if (!order) {
        return (
            <div className="text-center py-8">
                <Package className="w-16 h-16 text-gray-500 mx-auto mb-4" />
                <h2 className="text-xl font-bold text-white mb-2">Orden no encontrada</h2>
                <p className="text-gray-400 mb-4">No se encontró una orden activa para esta mesa.</p>
                <button
                    onClick={() => navigate('/admin/home')}
                    className="bg-amber-500 hover:bg-amber-600 text-gray-900 px-4 py-2 rounded-lg"
                >
                    Volver al Panel
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

    return (
        <div className="p-4 md:p-8">
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
                <div className="flex items-center">
                    <button
                        onClick={() => navigate('/admin/home')}
                        className="mr-4 p-2 hover:bg-gray-700 rounded-lg transition-colors"
                    >
                        <ArrowLeft className="w-6 h-6 text-gray-400" />
                    </button>
                    <div>
                        <h1 className="text-3xl font-bold text-white">{order.tableNumber === 0 ? '🍹 Barra' : `Mesa ${order.tableNumber}`}</h1>
                        <p className="text-gray-400">Orden #{order.id.slice(-8)}</p>
                    </div>
                </div>
                <div className="text-right">
                    <p className="text-3xl font-bold text-amber-400">${calculatedTotal.toFixed(2)} MXN</p>
                    <p className="text-sm text-gray-400">Total (calculado)</p>
                </div>
            </div>

            {/* Info Cards - make four equal cards on md+ screens */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
                <div className="bg-gray-800 p-6 rounded-xl border border-gray-700 flex items-stretch">
                    <div className="w-full flex items-center justify-between">
                        <div className="flex items-center">
                            <User className="w-10 h-10 text-amber-400 mr-4" />
                            <div>
                                <p className="text-sm text-gray-400 mb-1">Mesero</p>
                                <p className="text-xl font-semibold text-white">{order.waiterName}</p>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="bg-gray-800 p-6 rounded-xl border border-gray-700 flex items-stretch">
                    <div className="w-full flex items-center justify-between">
                        <div className="flex items-center">
                            <Clock className="w-10 h-10 text-amber-400 mr-4" />
                            <div>
                                <p className="text-sm text-gray-400 mb-1">Tiempo Transcurrido</p>
                                <p className="text-xl font-semibold text-white">{timeElapsed} min</p>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="bg-gray-800 p-6 rounded-xl border border-gray-700 flex items-stretch">
                    <div className="w-full flex items-center justify-between">
                        <div className="flex items-center">
                            <Package className="w-10 h-10 text-amber-400 mr-4" />
                            <div>
                                <p className="text-sm text-gray-400 mb-1">Items Totales</p>
                                <p className="text-xl font-semibold text-white">
                                    {order.items
                                        .filter(item => !item.isDeleted)
                                        .reduce((total, item) => total + item.quantity, 0)
                                    }
                                </p>
                                <p className="text-sm text-gray-500">
                                    {order.items.filter(item => !item.isDeleted).length} tipos diferentes
                                </p>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="bg-gray-800 p-6 rounded-xl border border-gray-700 flex items-stretch">
                    <div className="w-full flex items-center justify-between">
                        <div className="flex items-center">
                            <User className="w-10 h-10 text-amber-400 mr-4" />
                            <div>
                                <p className="text-sm text-gray-400 mb-1">Personas</p>
                                <p className="text-xl font-semibold text-white">{order.peopleCount ?? 1}</p>
                            </div>
                        </div>

                        <div>
                            <div className="flex items-center space-x-2">
                                <button
                                    onClick={handleDecrementPeople}
                                    className="px-3 py-2 bg-gray-700 rounded text-gray-300 hover:bg-gray-600"
                                    aria-label="Disminuir personas"
                                >-</button>
                                <button
                                    onClick={handleIncrementPeople}
                                    className="px-3 py-2 bg-gray-700 rounded text-gray-300 hover:bg-gray-600"
                                    aria-label="Aumentar personas"
                                >+</button>
                            </div>
                            <div className="mt-2 text-right"></div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Estado de Preparación - Separado */}
            <div className="bg-gray-800 p-6 rounded-xl border border-gray-700 mb-8">
                <h3 className="text-lg font-semibold text-white mb-4 flex items-center">
                    <div className="w-2 h-2 bg-amber-400 rounded-full mr-3"></div>
                    Estado de Preparación
                </h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {(() => {
                        const activeItems = order.items.filter(item => !item.isDeleted);
                        const pendingCount = activeItems.filter(item => item.status === 'pendiente').reduce((sum, item) => sum + item.quantity, 0);
                        const preparingCount = activeItems.filter(item => item.status === 'en_preparacion').reduce((sum, item) => sum + item.quantity, 0);
                        const readyCount = activeItems.filter(item => item.status === 'listo').reduce((sum, item) => sum + item.quantity, 0);
                        const deliveredCount = activeItems.filter(item => item.status === 'entregado').reduce((sum, item) => sum + item.quantity, 0);

                        return (
                            <>
                                <div className="text-center p-3 bg-yellow-900/20 border border-yellow-600 rounded-lg">
                                    <div className="text-2xl font-bold text-yellow-400">{pendingCount}</div>
                                    <div className="text-xs text-yellow-300">⏳ Pendiente</div>
                                </div>
                                <div className="text-center p-3 bg-orange-900/20 border border-orange-600 rounded-lg">
                                    <div className="text-2xl font-bold text-orange-400">{preparingCount}</div>
                                    <div className="text-xs text-orange-300">🔥 Preparando</div>
                                </div>
                                <div className="text-center p-3 bg-green-900/20 border border-green-600 rounded-lg">
                                    <div className="text-2xl font-bold text-green-400">{readyCount}</div>
                                    <div className="text-xs text-green-300">✅ Listo</div>
                                </div>
                                <div className="text-center p-3 bg-blue-900/20 border border-blue-600 rounded-lg">
                                    <div className="text-2xl font-bold text-blue-400">{deliveredCount}</div>
                                    <div className="text-xs text-blue-300">🍽️ Entregado</div>
                                </div>
                            </>
                        );
                    })()}
                </div>
            </div>

            {/* Items List */}
            <div className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden">
                <div className="p-6 border-b border-gray-700">
                    <h2 className="text-xl font-bold text-white">Items de la Orden</h2>
                </div>

                <div className="divide-y divide-gray-700">
                    {order.items.length === 0 || order.items.every(item => item.isDeleted) ? (
                        // Estado vacío - sin items
                        <div className="p-12 text-center">
                            <div className="mb-6">
                                <Package className="w-16 h-16 text-gray-500 mx-auto mb-4" />
                                <h3 className="text-xl font-bold text-white mb-2">
                                    {order.items.length === 0 ? 'Orden Vacía' : 'Todos los Items Eliminados'}
                                </h3>
                                <p className="text-gray-400 mb-6">
                                    {order.items.length === 0
                                        ? 'Esta mesa no tiene productos agregados aún.'
                                        : 'Todos los productos han sido eliminados de esta orden.'
                                    }
                                </p>
                            </div>

                            <div className="bg-gray-700/30 rounded-lg p-6 mb-6">
                                <h4 className="text-lg font-semibold text-amber-400 mb-3">¿Cómo agregar productos?</h4>
                                <div className="space-y-3 text-sm text-gray-300">
                                    <div className="flex items-center">
                                        <div className="w-6 h-6 bg-amber-500 text-gray-900 rounded-full flex items-center justify-center text-xs font-bold mr-3">1</div>
                                        <span>Haz click en el botón "Agregar Items" abajo</span>
                                    </div>
                                    <div className="flex items-center">
                                        <div className="w-6 h-6 bg-amber-500 text-gray-900 rounded-full flex items-center justify-center text-xs font-bold mr-3">2</div>
                                        <span>Busca y selecciona los productos del menú</span>
                                    </div>
                                    <div className="flex items-center">
                                        <div className="w-6 h-6 bg-amber-500 text-gray-900 rounded-full flex items-center justify-center text-xs font-bold mr-3">3</div>
                                        <span>Elige la cantidad y confirma</span>
                                    </div>
                                </div>
                            </div>

                            <button
                                onClick={handleOpenAddItemModal}
                                className="bg-amber-500 hover:bg-amber-600 text-gray-900 font-bold py-3 px-8 rounded-lg transition-colors inline-flex items-center"
                            >
                                <Plus className="w-5 h-5 mr-2" />
                                {order.items.length === 0 ? 'Agregar Primer Producto' : 'Agregar Nuevos Productos'}
                            </button>
                        </div>
                    ) : (
                        // Lista de items existentes
                        order.items.map((item: OrderItem) => {
                            const isDeleted = item.isDeleted;

                            return (
                                <div
                                    key={item.id}
                                    className={`p-6 transition-colors ${isDeleted
                                            ? 'bg-gray-800/50 border-l-4 border-gray-600'
                                            : 'hover:bg-gray-700/50'
                                        }`}
                                >
                                    <div className="flex items-center justify-between">
                                        <div className="flex-1">
                                            <div className="flex items-center justify-between mb-2">
                                                <div className="flex items-center">
                                                    <h3 className={`text-lg font-semibold ${isDeleted ? 'text-gray-400 line-through' : 'text-white'
                                                        }`}>
                                                        {item.productName}
                                                    </h3>
                                                    {isDeleted && (
                                                        <span className="ml-2 px-2 py-1 bg-gray-600 text-gray-300 text-xs font-bold rounded">
                                                            ELIMINADO
                                                        </span>
                                                    )}
                                                </div>

                                                <div className="flex items-center space-x-2">
                                                    {!isDeleted && (
                                                        <span className={`px-3 py-1 rounded-full text-xs font-bold ${getStatusColor(item.status)}`}>
                                                            {getStatusText(item.status)}
                                                        </span>
                                                    )}

                                                    {!isDeleted && (
                                                        <>
                                                            <button
                                                                onClick={() => handleAddAnother(item)}
                                                                className="p-2 text-green-400 hover:text-green-300 hover:bg-green-900/20 rounded-lg transition-colors"
                                                                title="Agregar otro"
                                                            >
                                                                <Plus className="w-4 h-4" />
                                                            </button>
                                                            <button
                                                                onClick={() => handleDeleteItem(item.id)}
                                                                className="p-2 text-red-400 hover:text-red-300 hover:bg-red-900/20 rounded-lg transition-colors"
                                                                title="Eliminar item"
                                                            >
                                                                <Trash2 className="w-4 h-4" />
                                                            </button>
                                                        </>
                                                    )}
                                                </div>
                                            </div>

                                            <div className={`flex items-center text-sm space-x-4 ${isDeleted ? 'text-gray-500' : 'text-gray-400'
                                                }`}>
                                                <span>Cantidad: {item.quantity}</span>
                                                <span>Precio: ${item.productPrice.toFixed(2)}</span>
                                                <span>Categoría: {item.category}</span>
                                            </div>

                                            {item.notes && (
                                                <p className={`text-sm mt-2 ${isDeleted ? 'text-gray-600' : 'text-gray-500'
                                                    }`}>
                                                    Notas: {item.notes}
                                                </p>
                                            )}

                                            {isDeleted && (
                                                <div className="mt-2 text-xs text-gray-500">
                                                    <p>Eliminado por: {item.deletedByName}</p>
                                                    <p>Fecha: {item.deletedAt?.toLocaleString()}</p>
                                                </div>
                                            )}
                                        </div>

                                        <div className="text-right ml-4">
                                            <p className={`text-xl font-bold ${isDeleted ? 'text-gray-500 line-through' : 'text-amber-400'
                                                }`}>
                                                ${(item.productPrice * item.quantity).toFixed(2)}
                                            </p>
                                            <p className={`text-sm ${isDeleted ? 'text-gray-600' : 'text-gray-400'
                                                }`}>
                                                {isDeleted ? 'No contabilizado' : 'Subtotal'}
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            );
                        })
                    )}
                </div>

                {/* Order Summary */}
                <div className="p-6 bg-gray-700/50 border-t border-gray-600">
                    <div className="space-y-2">
                        <div className="flex justify-between text-xl font-bold text-white">
                            <span>Total:</span>
                            <span>${calculatedTotal.toFixed(2)}</span>
                        </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex gap-4 mt-8">
                        <button
                            onClick={handleOpenAddItemModal}
                            className="flex-1 bg-amber-500 hover:bg-amber-600 text-gray-900 font-medium py-3 px-6 rounded-lg transition-colors"
                        >
                            Agregar Items
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
                                <div className="flex-1">
                                    <button
                                        onClick={handleProceedToCheckout}
                                        disabled={!canCheckout}
                                        className={`w-full font-medium py-3 px-6 rounded-lg transition-colors ${canCheckout ? 'bg-green-600 hover:bg-green-700 text-white' : 'bg-gray-600 text-gray-300 cursor-not-allowed'}`}
                                        title={canCheckout ? 'Proceder al pago' : hasUndelivered ? 'No puedes cobrar: hay ítems pendientes, en preparación o listos (no entregados)' : 'Agrega al menos un producto para proceder'}
                                    >
                                        Proceder al Pago
                                    </button>
                                    {hasUndelivered && (
                                        <p className="text-xs text-yellow-300 mt-2">No puedes proceder al pago: la orden tiene ítems pendientes, en preparación o listos (no entregados).</p>
                                    )}
                                </div>
                            );
                        })()}

                        {/* Botón de cancelar (si aplica lógica futura) */}
                        <button className="hidden bg-red-600 hover:bg-red-700 text-white font-medium py-3 px-6 rounded-lg transition-colors">
                            Cancelar Orden
                        </button>
                    </div>
                </div>

                {/* PIN Modal */}
                <PinModal
                    isOpen={showPinModal}
                    onClose={handleCancelDelete}
                    onConfirm={handleConfirmDelete}
                    loading={pinLoading}
                    title="Eliminar Item"
                    message={`¿Estás seguro de que deseas eliminar "${order.items.find(i => i.id === itemToDelete)?.productName}"? Esta acción requiere autorización.`}
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
                    title="Agregar Más Items"
                    product={selectedItemForMore ? {
                        id: selectedItemForMore.productId,
                        name: selectedItemForMore.productName,
                        description: `Agregar más unidades de ${selectedItemForMore.productName}`,
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
        </div>
    );
};

export default OrderDetails;
