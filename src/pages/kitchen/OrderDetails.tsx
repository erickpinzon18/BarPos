// src/pages/kitchen/OrderDetails.tsx
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
import { updateOrderPeopleCount, updateOrderTableName, updateOrderAdminComments } from '../../services/firestoreService';

const KitchenOrderDetails: React.FC = () => {
    const { tableId } = useParams<{ tableId: string }>();
    const navigate = useNavigate();
    const { order, loading, error } = useOrderByTableId(tableId ?? undefined);
    const { products } = useProducts();

    const [showPinModal, setShowPinModal] = useState(false);
    const [itemToDelete, setItemToDelete] = useState<string | null>(null);
    const [pinLoading, setPinLoading] = useState(false);

    const [showAddItemModal, setShowAddItemModal] = useState(false);
    const [addItemLoading, setAddItemLoading] = useState(false);

    const [showQuantityModal, setShowQuantityModal] = useState(false);
    const [selectedItemForMore, setSelectedItemForMore] = useState<OrderItem | null>(null);

    const [peopleCount, setPeopleCount] = useState<number>(order?.peopleCount ?? 1);
    const [tableName, setTableName] = useState<string>(order?.tableName ?? '');
    const [adminComments, setAdminComments] = useState<string>(order?.adminComments ?? '');

    const lastOrderIdRef = React.useRef<string | null>(null);
    React.useEffect(() => {
        if (!order) return;
        if (lastOrderIdRef.current !== order.id) {
            lastOrderIdRef.current = order.id;
            setPeopleCount(order.peopleCount ?? 1);
            setTableName(order.tableName ?? '');
            setAdminComments(order.adminComments ?? '');
        } else {
            setPeopleCount(order.peopleCount ?? 1);
            setTableName(order.tableName ?? '');
            setAdminComments(order.adminComments ?? '');
        }
    }, [order]);

    const handleDeleteItem = (itemId: string) => {
        setItemToDelete(itemId);
        setShowPinModal(true);
    };

    const handleConfirmDelete = async (pin: string) => {
        if (!order || !itemToDelete) return;
        setPinLoading(true);
        try {
            const authorizedUser = await verifyUserPin(pin);
            if (authorizedUser.role !== 'admin') {
                throw new Error('PIN válido, pero el usuario no tiene permisos. Solo administradores pueden eliminar items.');
            }
            await deleteOrderItem(order.id, itemToDelete, authorizedUser);
            setShowPinModal(false);
            setItemToDelete(null);
        } catch (error: any) {
            throw new Error(error.message || 'Error al eliminar el item');
        } finally {
            setPinLoading(false);
        }
    };

    const handleCancelDelete = () => {
        setShowPinModal(false);
        setItemToDelete(null);
    };

    const handleAddItem = async (productId: string, quantity: number) => {
        if (!order) return;
        setAddItemLoading(true);
        try {
            const product = products.find((p: Product) => p.id === productId);
            if (!product) throw new Error('Producto no encontrado');
            await addItemToOrder(order.id, product.id, product.name, product.price, product.category, quantity);
        } catch (error: any) {
            throw error;
        } finally {
            setAddItemLoading(false);
        }
    };

    const handleAddAnother = (item: OrderItem) => {
        setSelectedItemForMore(item);
        setShowQuantityModal(true);
    };

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
            setShowQuantityModal(false);
            setSelectedItemForMore(null);
        } catch (error: any) {
            throw error;
        }
    };

    const handleProceedToCheckout = () => {
        if (!order) return;
        navigate(`/kitchen/checkout/${order.id}`);
    };

    const savePeopleCountToDB = async (newCount: number) => {
        if (!order) return;
        try {
            await updateOrderPeopleCount(order.id, newCount);
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

    const handleTableNameBlur = () => {
        if (!order) return;
        updateOrderTableName(order.id, tableName).catch(err => console.error('Error saving table name:', err));
    };

    const handleAdminCommentsBlur = () => {
        if (!order) return;
        updateOrderAdminComments(order.id, adminComments).catch(err => console.error('Error saving comments:', err));
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-64">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-400 mx-auto mb-4"></div>
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
                    onClick={() => navigate('/kitchen/mesas')}
                    className="mt-4 bg-orange-500 hover:bg-orange-600 text-gray-900 px-4 py-2 rounded-lg"
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
                    onClick={() => navigate('/kitchen/mesas')}
                    className="bg-orange-500 hover:bg-orange-600 text-gray-900 px-4 py-2 rounded-lg"
                >
                    Volver al Panel
                </button>
            </div>
        );
    }

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'pendiente': return 'bg-yellow-500 text-yellow-100';
            case 'en_preparacion': return 'bg-blue-500 text-blue-100';
            case 'listo': return 'bg-green-500 text-green-100';
            case 'entregado': return 'bg-gray-500 text-gray-100';
            default: return 'bg-gray-500 text-gray-100';
        }
    };

    const getStatusText = (status: string) => {
        switch (status) {
            case 'pendiente': return 'Pendiente';
            case 'en_preparacion': return 'En Preparación';
            case 'listo': return 'Listo';
            case 'entregado': return 'Entregado';
            default: return status;
        }
    };

    const timeElapsed = Math.floor((new Date().getTime() - order.createdAt.getTime()) / (1000 * 60));
    const activeItems = order.items.filter(item => !item.isDeleted);
    const calculatedTotal = activeItems.reduce((sum, item) => sum + item.productPrice * item.quantity, 0);

    return (
        <div className="p-4 md:p-8">
            <div className="flex items-center justify-between mb-6">
                <div className="flex items-center">
                    <button
                        onClick={() => navigate('/kitchen/mesas')}
                        className="mr-4 p-2 hover:bg-gray-700 rounded-lg transition-colors"
                    >
                        <ArrowLeft className="w-6 h-6 text-gray-400" />
                    </button>
                    <div>
                        <h1 className="text-3xl font-bold text-white">
                            {order.tableNumber === 0 ? '🍹 Barra' : `Mesa ${order.tableNumber}`}
                        </h1>
                        <p className="text-gray-400">Orden #{order.id.slice(-8)}</p>
                    </div>
                </div>
                <div className="text-right">
                    <p className="text-3xl font-bold text-orange-400">${calculatedTotal.toFixed(2)} MXN</p>
                    <p className="text-sm text-gray-400">Total (calculado)</p>
                </div>
            </div>

            <div className="bg-gray-800 p-4 rounded-xl border border-gray-700 mb-6">
                <label htmlFor="tableName" className="block text-sm font-medium text-gray-400 mb-2">
                    🏷️ Nombre de Mesa / Identificación
                </label>
                <input
                    id="tableName"
                    type="text"
                    value={tableName}
                    onChange={e => setTableName(e.target.value)}
                    onBlur={handleTableNameBlur}
                    placeholder="ej: Mesa de Andrea, Cumpleaños de Juan, VIP, Terraza..."
                    className="w-full bg-gray-700 border border-gray-600 text-white rounded-lg px-4 py-3 focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-all"
                />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
                <div className="bg-gray-800 p-6 rounded-xl border border-gray-700 flex items-stretch">
                    <div className="w-full flex items-center">
                        <User className="w-10 h-10 text-orange-400 mr-4" />
                        <div>
                            <p className="text-sm text-gray-400 mb-1">Mesero</p>
                            <p className="text-xl font-semibold text-white">{order.waiterName}</p>
                        </div>
                    </div>
                </div>

                <div className="bg-gray-800 p-6 rounded-xl border border-gray-700 flex items-stretch">
                    <div className="w-full flex items-center">
                        <Clock className="w-10 h-10 text-orange-400 mr-4" />
                        <div>
                            <p className="text-sm text-gray-400 mb-1">Tiempo Transcurrido</p>
                            <p className="text-xl font-semibold text-white">{timeElapsed} min</p>
                        </div>
                    </div>
                </div>

                <div className="bg-gray-800 p-6 rounded-xl border border-gray-700 flex items-stretch">
                    <div className="w-full flex items-center">
                        <Package className="w-10 h-10 text-orange-400 mr-4" />
                        <div>
                            <p className="text-sm text-gray-400 mb-1">Items Totales</p>
                            <p className="text-xl font-semibold text-white">
                                {activeItems.reduce((total, item) => total + item.quantity, 0)}
                            </p>
                            <p className="text-sm text-gray-500">{activeItems.length} tipos diferentes</p>
                        </div>
                    </div>
                </div>

                <div className="bg-gray-800 p-6 rounded-xl border border-gray-700 flex items-stretch">
                    <div className="w-full flex items-center justify-between">
                        <div className="flex items-center">
                            <User className="w-10 h-10 text-orange-400 mr-4" />
                            <div>
                                <p className="text-sm text-gray-400 mb-1">Personas</p>
                                <p className="text-xl font-semibold text-white">{order.peopleCount ?? 1}</p>
                            </div>
                        </div>
                        <div className="flex items-center space-x-2">
                            <button onClick={handleDecrementPeople} className="px-3 py-2 bg-gray-700 rounded text-gray-300 hover:bg-gray-600">-</button>
                            <button onClick={handleIncrementPeople} className="px-3 py-2 bg-gray-700 rounded text-gray-300 hover:bg-gray-600">+</button>
                        </div>
                    </div>
                </div>
            </div>

            <div className="bg-gray-800 p-6 rounded-xl border border-gray-700 mb-8">
                <h3 className="text-lg font-semibold text-white mb-4 flex items-center">
                    <div className="w-2 h-2 bg-orange-400 rounded-full mr-3"></div>
                    Estado de Preparación
                </h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {(() => {
                        const pendingCount = activeItems.filter(i => i.status === 'pendiente').reduce((s, i) => s + i.quantity, 0);
                        const preparingCount = activeItems.filter(i => i.status === 'en_preparacion').reduce((s, i) => s + i.quantity, 0);
                        const readyCount = activeItems.filter(i => i.status === 'listo').reduce((s, i) => s + i.quantity, 0);
                        const deliveredCount = activeItems.filter(i => i.status === 'entregado').reduce((s, i) => s + i.quantity, 0);
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

            <div className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden">
                <div className="p-6 border-b border-gray-700">
                    <h2 className="text-xl font-bold text-white">Items de la Orden</h2>
                </div>

                <div className="divide-y divide-gray-700">
                    {order.items.length === 0 || order.items.every(item => item.isDeleted) ? (
                        <div className="p-12 text-center">
                            <Package className="w-16 h-16 text-gray-500 mx-auto mb-4" />
                            <h3 className="text-xl font-bold text-white mb-2">
                                {order.items.length === 0 ? 'Orden Vacía' : 'Todos los Items Eliminados'}
                            </h3>
                            <p className="text-gray-400 mb-6">
                                {order.items.length === 0
                                    ? 'Esta mesa no tiene productos agregados aún.'
                                    : 'Todos los productos han sido eliminados de esta orden.'}
                            </p>
                            <button
                                onClick={() => setShowAddItemModal(true)}
                                className="bg-orange-500 hover:bg-orange-600 text-gray-900 font-bold py-3 px-8 rounded-lg transition-colors inline-flex items-center"
                            >
                                <Plus className="w-5 h-5 mr-2" />
                                {order.items.length === 0 ? 'Agregar Primer Producto' : 'Agregar Nuevos Productos'}
                            </button>
                        </div>
                    ) : (
                        order.items.map((item: OrderItem) => {
                            const isDeleted = item.isDeleted;
                            return (
                                <div
                                    key={item.id}
                                    className={`p-6 transition-colors ${isDeleted ? 'bg-gray-800/50 border-l-4 border-gray-600' : 'hover:bg-gray-700/50'}`}
                                >
                                    <div className="flex items-center justify-between">
                                        <div className="flex-1">
                                            <div className="flex items-center justify-between mb-2">
                                                <div className="flex items-center">
                                                    <h3 className={`text-lg font-semibold ${isDeleted ? 'text-gray-400 line-through' : 'text-white'}`}>
                                                        {item.productName}
                                                    </h3>
                                                    {isDeleted && (
                                                        <span className="ml-2 px-2 py-1 bg-gray-600 text-gray-300 text-xs font-bold rounded">ELIMINADO</span>
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
                                            <div className={`flex items-center text-sm space-x-4 ${isDeleted ? 'text-gray-500' : 'text-gray-400'}`}>
                                                <span>Cantidad: {item.quantity}</span>
                                                <span>Precio: ${item.productPrice.toFixed(2)}</span>
                                                <span>Categoría: {item.category}</span>
                                            </div>
                                            {item.notes && (
                                                <p className={`text-sm mt-2 ${isDeleted ? 'text-gray-600' : 'text-gray-500'}`}>
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
                                            <p className={`text-xl font-bold ${isDeleted ? 'text-gray-500 line-through' : 'text-orange-400'}`}>
                                                ${(item.productPrice * item.quantity).toFixed(2)}
                                            </p>
                                            <p className={`text-sm ${isDeleted ? 'text-gray-600' : 'text-gray-400'}`}>
                                                {isDeleted ? 'No contabilizado' : 'Subtotal'}
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            );
                        })
                    )}
                </div>

                <div className="p-6 bg-gray-700/50 border-t border-gray-600">
                    <div className="flex justify-between text-xl font-bold text-white">
                        <span>Total:</span>
                        <span>${calculatedTotal.toFixed(2)}</span>
                    </div>

                    <div className="mt-6 pt-6 border-t border-gray-600">
                        <label htmlFor="adminComments" className="block text-sm font-medium text-gray-400 mb-2">
                            📝 Comentarios Administrativos
                        </label>
                        <textarea
                            id="adminComments"
                            value={adminComments}
                            onChange={e => setAdminComments(e.target.value)}
                            onBlur={handleAdminCommentsBlur}
                            placeholder="Notas internas: alergias, solicitudes especiales, observaciones del servicio..."
                            rows={3}
                            className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-4 py-3 focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-all resize-none"
                        />
                        <p className="text-xs text-gray-500 mt-1">
                            Estos comentarios son internos y NO aparecerán en el ticket del cliente
                        </p>
                    </div>

                    <div className="flex gap-4 mt-8">
                        <button
                            onClick={() => setShowAddItemModal(true)}
                            className="flex-1 bg-orange-500 hover:bg-orange-600 text-gray-900 font-medium py-3 px-6 rounded-lg transition-colors"
                        >
                            Agregar Items
                        </button>

                        {(() => {
                            const activeItemUnits = order.items.filter(i => !i.isDeleted).reduce((sum, i) => sum + i.quantity, 0);
                            const hasUndelivered = order.items.filter(i => !i.isDeleted).some(i => i.status !== 'entregado');
                            const canCheckout = activeItemUnits > 0 && !hasUndelivered;
                            return (
                                <div className="flex-1">
                                    <button
                                        onClick={handleProceedToCheckout}
                                        disabled={!canCheckout}
                                        className={`w-full font-medium py-3 px-6 rounded-lg transition-colors ${canCheckout ? 'bg-green-600 hover:bg-green-700 text-white' : 'bg-gray-600 text-gray-300 cursor-not-allowed'}`}
                                    >
                                        Proceder al Pago
                                    </button>
                                    {hasUndelivered && (
                                        <p className="text-xs text-yellow-300 mt-2">No puedes proceder al pago: la orden tiene ítems pendientes, en preparación o listos (no entregados).</p>
                                    )}
                                </div>
                            );
                        })()}
                    </div>
                </div>

                <PinModal
                    isOpen={showPinModal}
                    onClose={handleCancelDelete}
                    onConfirm={handleConfirmDelete}
                    loading={pinLoading}
                    title="Eliminar Item"
                    message={`¿Estás seguro de que deseas eliminar "${order.items.find(i => i.id === itemToDelete)?.productName}"? Esta acción requiere autorización.`}
                />

                <AddItemModal
                    isOpen={showAddItemModal}
                    onClose={() => setShowAddItemModal(false)}
                    onAddItem={handleAddItem}
                    products={products}
                    loading={addItemLoading}
                />

                <QuantityModal
                    isOpen={showQuantityModal}
                    onClose={() => { setShowQuantityModal(false); setSelectedItemForMore(null); }}
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

export default KitchenOrderDetails;
