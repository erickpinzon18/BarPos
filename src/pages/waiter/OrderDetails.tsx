// src/pages/waiter/OrderDetails.tsx
import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Clock, Package, User, Plus, Trash2, Tag, ArrowLeftRight, Scissors } from 'lucide-react';
import { useOrderByTableId } from '../../hooks/useOrders';
import { useProducts } from '../../hooks/useProducts';
import SplitOrderModal from '../../components/common/SplitOrderModal';
import { useActivePromotions, isPromotionWithinSchedule } from '../../hooks/usePromotions';
import { deleteOrderItem, addItemToOrder, verifyUserPin, swapOrderItem } from '../../services/orderService';
import { updateOrderPeopleCount, updateOrderTableName, updateOrderAdminComments, updateOrderStatusInKanban, cancelEmptyOrder } from '../../services/firestoreService';
import PinModal from '../../components/common/PinModal';
import AddItemModal from '../../components/common/AddItemModal';
import QuantityModal from '../../components/common/QuantityModal';
import SwapServiceModal from '../../components/common/SwapServiceModal';
import { getCategoryInfo } from '../../utils/categories';
import type { OrderItem, Product } from '../../utils/types';

const WaiterOrderDetails: React.FC = () => {
    const { tableId } = useParams<{ tableId: string }>();
    const navigate = useNavigate();
    const { order, loading, error } = useOrderByTableId(tableId ?? undefined);
    const { products } = useProducts();
    const { promotions: activePromotions } = useActivePromotions();

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

    const [showSwapModal, setShowSwapModal] = useState(false);
    const [itemToSwap, setItemToSwap] = useState<OrderItem | null>(null);
    const [swapLoading, setSwapLoading] = useState(false);

    // Estados para el modal de separar cuenta
    const [showSplitModal, setShowSplitModal] = useState(false);

    // Local state to edit people count (saved via +/- clicks)
    const [peopleCount, setPeopleCount] = useState<number>(order?.peopleCount ?? 1);

    // Local state for table name and admin comments
    const [tableName, setTableName] = useState<string>(order?.tableName ?? '');
    const [adminComments, setAdminComments] = useState<string>(order?.adminComments ?? '');

    // Ensure we initialize and sync peopleCount, tableName, and adminComments from the DB
    const lastOrderIdRef = React.useRef<string | null>(null);
    React.useEffect(() => {
        if (!order) return;

        // When a different order loads (or first load), initialize from DB
        if (lastOrderIdRef.current !== order.id) {
            lastOrderIdRef.current = order.id;
            setPeopleCount(order.peopleCount ?? 1);
            setTableName(order.tableName ?? '');
            setAdminComments(order.adminComments ?? '');
        } else {
            // Same order, but sync fields that might have changed from other sources (real-time updates)
            setPeopleCount(order.peopleCount ?? 1);
            setTableName(order.tableName ?? '');
            setAdminComments(order.adminComments ?? '');
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
    const handleAddItem = async (productId: string, quantity: number, notes?: string) => {
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
                quantity,
                notes
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
    const handleConfirmQuantity = async (quantity: number, notes?: string) => {
        if (!order || !selectedItemForMore) return;

        try {
            await addItemToOrder(
                order.id,
                selectedItemForMore.productId,
                selectedItemForMore.productName,
                selectedItemForMore.productPrice,
                selectedItemForMore.category,
                quantity,
                notes
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

    const handleOpenSwap = (item: OrderItem) => {
        setItemToSwap(item);
        setShowSwapModal(true);
    };

    const handleConfirmSwap = async (newProduct: Product) => {
        if (!order || !itemToSwap) return;
        setSwapLoading(true);
        try {
            await swapOrderItem(order.id, itemToSwap.id, newProduct.id, newProduct.name);
            setShowSwapModal(false);
            setItemToSwap(null);
        } catch (err) {
            console.error('Error cambiando servicio:', err);
        } finally {
            setSwapLoading(false);
        }
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

    // Save table name to DB
    const saveTableNameToDB = async (name: string) => {
        if (!order) return;
        try {
            const res = await updateOrderTableName(order.id, name);
            if (!res.success) {
                console.error('Error saving table name:', res.error);
            }
        } catch (err) {
            console.error('Error saving table name:', err);
        }
    };

    const handleTableNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const newName = e.target.value;
        setTableName(newName);
    };

    const handleTableNameBlur = () => {
        void saveTableNameToDB(tableName);
    };

    // Save admin comments to DB
    const saveAdminCommentsToDB = async (comments: string) => {
        if (!order) return;
        try {
            const res = await updateOrderAdminComments(order.id, comments);
            if (!res.success) {
                console.error('Error saving admin comments:', res.error);
            }
        } catch (err) {
            console.error('Error saving admin comments:', err);
        }
    };

    const handleAdminCommentsChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        const newComments = e.target.value;
        setAdminComments(newComments);
    };

    const handleAdminCommentsBlur = () => {
        void saveAdminCommentsToDB(adminComments);
    };

    const [showCancelConfirm, setShowCancelConfirm] = useState(false);
    const [cancelLoading, setCancelLoading] = useState(false);

    const handleCancelOrder = async () => {
        if (!order) return;
        setCancelLoading(true);
        try {
            const res = await cancelEmptyOrder(order.tableId, order.id);
            if (res.success) {
                navigate('/waiter/home');
            } else {
                console.error('Error cerrando mesa:', res.error);
            }
        } catch (err) {
            console.error('Error cerrando mesa:', err);
        } finally {
            setCancelLoading(false);
            setShowCancelConfirm(false);
        }
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

    // Marcar item como entregado (recogido por el mesero)
    const handleMarkDelivered = async (itemId: string) => {
        if (!order) return;
        try {
            await updateOrderStatusInKanban(order.id, itemId, 'entregado');
        } catch (error) {
            console.error('Error marcando item como entregado:', error);
        }
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'pendiente':
                return 'bg-yellow-500 text-yellow-100';
            case 'entregado':
                return 'bg-green-600 text-green-100';
            default:
                return 'bg-gray-500 text-gray-100';
        }
    };

    const getStatusText = (status: string) => {
        switch (status) {
            case 'pendiente':
                return '⏳ Pendiente';
            case 'entregado':
                return '✅ Entregado';
            default:
                return status;
        }
    };

    const timeElapsed = Math.floor((new Date().getTime() - order.createdAt.getTime()) / (1000 * 60));

    // Calcular totales dinámicamente basado en items activos
    const activeItems = order.items.filter(item => !item.isDeleted);
    const calculatedSubtotal = activeItems.reduce((sum, item) => sum + (item.productPrice * item.quantity), 0);
    const calculatedTotal = calculatedSubtotal;

    // Promo: primera promoción activa+vigente que aplique a un item
    const getItemPromo = (item: OrderItem) => {
        if (item.isDeleted) return null;
        return activePromotions.find(promo => {
            const categoryMatch = promo.categories.length === 0 || promo.categories.includes(item.category);
            const productMatch = !promo.productIds || promo.productIds.length === 0 || promo.productIds.includes(item.productId);
            return categoryMatch && productMatch;
        }) ?? null;
    };

    // Descuento automático estimado (solo promos vigentes)
    const autoDiscount = (() => {
        let total = 0;
        for (const promo of activePromotions) {
            const applicable = activeItems.filter(i => {
                const catOk = promo.categories.length === 0 || promo.categories.includes(i.category);
                const prodOk = !promo.productIds || promo.productIds.length === 0 || promo.productIds.includes(i.productId);
                const timeOk = isPromotionWithinSchedule(promo.cutoffTime, i.createdAt);
                return catOk && prodOk && timeOk;
            });
            if (applicable.length === 0) continue;
            const sub = applicable.reduce((s, i) => s + i.productPrice * i.quantity, 0);
            if (promo.discountType === 'percentage') total += sub * (promo.discountValue / 100);
            else if (promo.discountType === 'fixed') total += Math.min(promo.discountValue, sub);
            else if (promo.discountType === '2x1') {
                for (const item of applicable) total += Math.floor(item.quantity / 2) * item.productPrice;
            } else if (promo.discountType === 'fixedprice') {
                for (const item of applicable) {
                    const diff = item.productPrice - promo.discountValue;
                    if (diff > 0) total += diff * item.quantity;
                }
            }
            break;
        }
        return total;
    })();

    // Calcula el precio con descuento de un item individual (sólo si la promo es vigente)
    const getItemDiscountedTotal = (item: OrderItem): number | null => {
        const promo = getItemPromo(item);
        if (!promo) return null;
        const valid = isPromotionWithinSchedule(promo.cutoffTime, item.createdAt);
        if (!valid) return null;
        const original = item.productPrice * item.quantity;
        if (promo.discountType === 'percentage') return original * (1 - promo.discountValue / 100);
        if (promo.discountType === 'fixed') return Math.max(0, original - promo.discountValue);
        if (promo.discountType === '2x1') return original - Math.floor(item.quantity / 2) * item.productPrice;
        if (promo.discountType === 'fixedprice') return Math.min(promo.discountValue, item.productPrice) * item.quantity;
        return null;
    };

    // Determinar si es la barra (mesa 0)
    const isBar = order.tableNumber === 0;

    return (
        <div className="min-h-screen bg-gray-900 pb-24">
            {/* Fixed Header - Mobile Optimized */}
            <div className="sticky top-0 z-10 bg-gray-800 border-b border-gray-800 shadow-lg">
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
                    <div className="bg-gray-800 p-4 rounded-xl border border-gray-800">
                        <div className="flex items-center mb-2">
                            <User className="w-5 h-5 text-green-400 mr-2" />
                            <p className="text-xs text-gray-400">Mesero</p>
                        </div>
                        <p className="text-sm font-semibold text-white truncate">{order.waiterName}</p>
                    </div>

                    <div className="bg-gray-800 p-4 rounded-xl border border-gray-800">
                        <div className="flex items-center mb-2">
                            <Clock className="w-5 h-5 text-green-400 mr-2" />
                            <p className="text-xs text-gray-400">Tiempo</p>
                        </div>
                        <p className="text-sm font-semibold text-white">{timeElapsed} min</p>
                    </div>

                    <div className="bg-gray-800 p-4 rounded-xl border border-gray-800">
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

                    <div className="bg-gray-800 p-4 rounded-xl border border-gray-800">
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

                {/* Custom Table Name - Administrative Identifier */}
                <div className="bg-gray-800 p-4 rounded-xl border border-gray-800">
                    <label htmlFor="tableName" className="block text-xs font-medium text-gray-400 mb-2">
                        🏷️ Nombre de Mesa / Identificación
                    </label>
                    <input
                        id="tableName"
                        type="text"
                        value={tableName}
                        onChange={handleTableNameChange}
                        onBlur={handleTableNameBlur}
                        placeholder="ej: Mesa de Andrea, Cumpleaños..."
                        className="w-full bg-gray-700 border border-gray-600 text-white rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                        Personaliza la identificación de esta mesa
                    </p>
                </div>

                {/* Estado de Preparación - Compacto para móvil */}
                <div className="bg-gray-800 p-4 rounded-xl border border-gray-800">
                    <h3 className="text-sm font-semibold text-white mb-3 flex items-center">
                        <div className="w-2 h-2 bg-green-400 rounded-full mr-2"></div>
                        Estado de Items
                    </h3>
                    <div className="grid grid-cols-2 gap-2">
                        {(() => {
                            const activeItems = order.items.filter(item => !item.isDeleted);
                            const pendingCount = activeItems.filter(item => item.status === 'pendiente').reduce((sum, item) => sum + item.quantity, 0);
                            const deliveredCount = activeItems.filter(item => item.status === 'entregado').reduce((sum, item) => sum + item.quantity, 0);

                            return (
                                <>
                                    <div className="text-center p-2 bg-yellow-900/20 border border-yellow-600 rounded-lg">
                                        <div className="text-xl font-bold text-yellow-400">{pendingCount}</div>
                                        <div className="text-xs text-yellow-300">⏳ Pendiente</div>
                                    </div>
                                    <div className="text-center p-2 bg-green-900/20 border border-green-600 rounded-lg">
                                        <div className="text-xl font-bold text-green-400">{deliveredCount}</div>
                                        <div className="text-xs text-green-300">✅ Entregado</div>
                                    </div>
                                </>
                            );
                        })()}
                    </div>
                </div>

                {/* Items List - Mobile Optimized */}
                <div className="bg-gray-800 rounded-xl border border-gray-800 overflow-hidden">
                    <div className="p-4 border-b border-gray-800 flex items-center justify-between">
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
                                const itemPromo = !isDeleted ? getItemPromo(item) : null;
                                const promoValid = itemPromo ? isPromotionWithinSchedule(itemPromo.cutoffTime, item.createdAt) : false;

                                return (
                                    <div
                                        key={item.id}
                                        className={`p-4 transition-colors ${
                                            isDeleted
                                                ? 'bg-gray-800/50 border-l-4 border-gray-600'
                                                : promoValid
                                                    ? 'bg-green-950/30 border-l-4 border-green-500 hover:bg-green-950/50'
                                                    : 'hover:bg-gray-700/50'
                                        }`}
                                    >
                                        <div className="flex items-start justify-between mb-2">
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2 mb-1 flex-wrap">
                                                    <h3 className={`font-semibold truncate ${isDeleted ? 'text-gray-500 line-through' : 'text-white'}`}>
                                                        {item.productName}
                                                    </h3>
                                                    <span className={`text-xs font-bold px-2 py-0.5 rounded-full flex-shrink-0 ${getStatusColor(item.status)}`}>
                                                        {getStatusText(item.status)}
                                                    </span>
                                                    {/* PROMO badge prominent */}
                                                    {promoValid && (
                                                        <span className="inline-flex items-center gap-1 bg-green-500 text-white text-[10px] font-extrabold px-1.5 py-0.5 rounded-md uppercase tracking-wide flex-shrink-0">
                                                            <Tag size={9} />
                                                            PROMO · hasta {itemPromo!.cutoffTime}hrs
                                                        </span>
                                                    )}
                                                    {itemPromo && !promoValid && (
                                                        <span className="inline-flex items-center gap-1 bg-amber-700/60 text-amber-300 text-[10px] font-bold px-1.5 py-0.5 rounded-md uppercase tracking-wide flex-shrink-0">
                                                            <Clock size={9} />
                                                            PROMO expirada
                                                        </span>
                                                    )}
                                                </div>
                                                <div className="flex items-center gap-3 text-xs">
                                                    <span className="text-gray-400">Cant: {item.quantity}</span>
                                                    {(() => {
                                                        const discounted = !isDeleted ? getItemDiscountedTotal(item) : null;
                                                        const original = item.productPrice * item.quantity;
                                                        if (discounted !== null) {
                                                            return (
                                                                <span className="flex items-center gap-1.5">
                                                                    <span className="line-through text-gray-500">${original.toFixed(2)}</span>
                                                                    <span className="text-green-400 font-bold">${discounted.toFixed(2)}</span>
                                                                </span>
                                                            );
                                                        }
                                                        return (
                                                            <span className="text-gray-300 font-semibold">${original.toFixed(2)}</span>
                                                        );
                                                    })()}
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
                                                    {item.status === 'pendiente' && (
                                                        <button
                                                            onClick={() => handleMarkDelivered(item.id)}
                                                            className="p-2 bg-green-600 hover:bg-green-500 active:scale-95 rounded-lg transition-all"
                                                            title="Marcar como entregado"
                                                        >
                                                            <span className="text-white text-sm">✓</span>
                                                        </button>
                                                    )}
                                                    <button
                                                        onClick={() => handleAddAnother(item)}
                                                        className="p-2 bg-gray-600 hover:bg-gray-500 rounded-lg transition-colors"
                                                        title="Agregar más"
                                                    >
                                                        <Plus className="w-4 h-4 text-white" />
                                                    </button>
                                                    {item.category === 'Servicio' && (
                                                        <button
                                                            onClick={() => handleOpenSwap(item)}
                                                            className="p-2 bg-purple-700 hover:bg-purple-600 rounded-lg transition-colors"
                                                            title="Cambiar servicio"
                                                        >
                                                            <ArrowLeftRight className="w-4 h-4 text-white" />
                                                        </button>
                                                    )}
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
                    <div className="p-4 bg-gray-800/80 border-t border-gray-700">
                        <div className="space-y-2 mb-4">
                            <div className="flex justify-between text-sm text-gray-400">
                                <span>Subtotal:</span>
                                <span>${calculatedSubtotal.toFixed(2)}</span>
                            </div>
                            {autoDiscount > 0 && (
                                <div className="flex justify-between text-sm text-green-400">
                                    <span className="flex items-center gap-1"><Tag size={12} /> Descuento promo:</span>
                                    <span className="font-semibold">-${autoDiscount.toFixed(2)}</span>
                                </div>
                            )}
                            <div className="flex justify-between text-lg font-bold text-white border-t border-gray-600 pt-2">
                                <span>Total{autoDiscount > 0 ? ' con promo' : ''}:</span>
                                <span className={autoDiscount > 0 ? 'text-green-400' : ''}>
                                    ${(calculatedSubtotal - autoDiscount).toFixed(2)}
                                </span>
                            </div>
                        </div>

                        {/* Administrative Comments */}
                        <div className="pt-4 border-t border-gray-600">
                            <label htmlFor="adminComments" className="block text-xs font-medium text-gray-400 mb-2">
                                📝 Comentarios Administrativos
                            </label>
                            <textarea
                                id="adminComments"
                                value={adminComments}
                                onChange={handleAdminCommentsChange}
                                onBlur={handleAdminCommentsBlur}
                                placeholder="Notas: alergias, solicitudes especiales..."
                                rows={2}
                                className="w-full bg-gray-800 border border-gray-800 text-white text-sm rounded-lg px-3 py-2 focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all resize-none"
                            />
                            <p className="text-xs text-gray-500 mt-1">
                                Notas internas (no aparecen en el ticket)
                            </p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Fixed Bottom Action Buttons - Mobile */}
            <div className="fixed bottom-0 left-0 right-0 bg-gray-800 border-t border-gray-800 p-4 shadow-lg z-20">
                <div className="flex gap-3">
                    <button
                        onClick={handleOpenAddItemModal}
                        className="flex-1 bg-green-500 hover:bg-green-600 text-white font-medium py-4 rounded-lg transition-colors flex items-center justify-center gap-2"
                    >
                        <Plus className="w-5 h-5" />
                        Agregar
                    </button>

                    <button
                        onClick={() => setShowSplitModal(true)}
                        className="flex-1 bg-gray-700 hover:bg-gray-600 text-white font-medium py-4 rounded-lg transition-colors flex items-center justify-center gap-2"
                        disabled={activeItems.length === 0}
                        title="Separar Cuenta"
                    >
                        <Scissors className="w-5 h-5" />
                    </button>

                    {activeItems.length === 0 ? (
                        <button
                            onClick={() => setShowCancelConfirm(true)}
                            className="flex-1 bg-gray-600 hover:bg-gray-500 text-white font-medium py-4 rounded-lg transition-colors"
                        >
                            Cerrar Mesa
                        </button>
                    ) : (
                        (() => {
                            const activeItemUnits = activeItems.reduce((sum, i) => sum + i.quantity, 0);
                            const hasUndelivered = activeItems.some(i => i.status !== 'entregado');
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
                        })()
                    )}
                </div>
                {(() => {
                    const hasUndelivered = activeItems.some(i => i.status !== 'entregado');
                    return activeItems.length > 0 && hasUndelivered ? (
                        <p className="text-xs text-yellow-300 mt-2 text-center">
                            ⚠️ No puedes cobrar: hay items sin entregar
                        </p>
                    ) : null;
                })()}
            </div>

            {showCancelConfirm && (
                <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
                    <div className="bg-gray-800 rounded-xl p-6 max-w-sm w-full mx-4 shadow-xl border border-gray-700">
                        <h3 className="text-lg font-bold text-white mb-2">¿Cerrar mesa?</h3>
                        <p className="text-gray-400 text-sm mb-6">
                            Se eliminará la orden vacía y la mesa quedará disponible.
                        </p>
                        <div className="flex gap-3">
                            <button
                                onClick={() => setShowCancelConfirm(false)}
                                disabled={cancelLoading}
                                className="flex-1 bg-gray-700 hover:bg-gray-600 text-white py-2 rounded-lg transition-colors"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={handleCancelOrder}
                                disabled={cancelLoading}
                                className="flex-1 bg-red-600 hover:bg-red-700 text-white py-2 rounded-lg transition-colors"
                            >
                                {cancelLoading ? 'Cerrando...' : 'Cerrar Mesa'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* PIN Modal */}
            <PinModal
                isOpen={showPinModal}
                onClose={handleCancelDelete}
                onConfirm={handleConfirmDelete}
                loading={pinLoading}
                title="Eliminar Item"
                message={`¿Eliminar "${order.items.find(i => i.id === itemToDelete)?.productName}"? Requiere PIN de administrador.`}
            />

            {/* Modals */}
            {showAddItemModal && (
                <AddItemModal
                    isOpen={showAddItemModal}
                    onClose={handleCloseAddItemModal}
                    onAddItem={handleAddItem}
                    products={products}
                    loading={addItemLoading}
                    activePromotions={activePromotions}
                />
            )}

            {showSplitModal && (
                <SplitOrderModal
                    isOpen={showSplitModal}
                    onClose={() => setShowSplitModal(false)}
                    order={order!}
                    onSuccess={() => setShowSplitModal(false)}
                />
            )}

            {/* Quantity Modal for Adding More */}
            <QuantityModal
                isOpen={showQuantityModal}
                onClose={handleCloseQuantityModal}
                onConfirm={handleConfirmQuantity}
                title="Agregar Más"
                showNotes={getCategoryInfo(selectedItemForMore?.category as any)?.workstation === 'barra'}
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

            {/* Swap Service Modal */}
            <SwapServiceModal
                isOpen={showSwapModal}
                onClose={() => { setShowSwapModal(false); setItemToSwap(null); }}
                onConfirm={handleConfirmSwap}
                currentItem={itemToSwap}
                products={products}
                loading={swapLoading}
            />
        </div>
    );
};

export default WaiterOrderDetails;
