// src/pages/admin/OrderDetails.tsx
import React, { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useOrderByTableId } from "../../hooks/useOrders";
import {
  deleteOrderItem,
  verifyUserPin,
  addItemToOrder,
} from "../../services/orderService";
import PinModal from "../../components/common/PinModal";
import QuantityModal from "../../components/common/QuantityModal";
import { ArrowLeft, Clock, User, Package, Trash2, Plus, Tag } from "lucide-react";
import type { OrderItem, Product } from "../../utils/types";
import { useProducts } from "../../hooks/useProducts";
import AddItemModal from "../../components/common/AddItemModal";
import { useActivePromotions, isPromotionWithinSchedule } from "../../hooks/usePromotions";
import {
  updateOrderPeopleCount,
  updateOrderTableName,
  updateOrderAdminComments,
  updateOrderStatusInKanban,
  cancelEmptyOrder,
} from "../../services/firestoreService";

const OrderDetails: React.FC = () => {
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
  const [selectedItemForMore, setSelectedItemForMore] =
    useState<OrderItem | null>(null);

  // 'order' now comes directly from the optimized hook

  // Local state to edit people count (saved via +/- clicks)
  const [peopleCount, setPeopleCount] = useState<number>(
    order?.peopleCount ?? 1
  );

  // Local state for table name and admin comments
  const [tableName, setTableName] = useState<string>(order?.tableName ?? "");
  const [adminComments, setAdminComments] = useState<string>(
    order?.adminComments ?? ""
  );

  // Ensure we initialize and sync peopleCount, tableName, and adminComments from the DB
  const lastOrderIdRef = React.useRef<string | null>(null);
  React.useEffect(() => {
    if (!order) return;

    // When a different order loads (or first load), initialize from DB
    if (lastOrderIdRef.current !== order.id) {
      lastOrderIdRef.current = order.id;
      setPeopleCount(order.peopleCount ?? 1);
      setTableName(order.tableName ?? "");
      setAdminComments(order.adminComments ?? "");
    } else {
      // Same order, but sync fields that might have changed from other sources (real-time updates)
      setPeopleCount(order.peopleCount ?? 1);
      setTableName(order.tableName ?? "");
      setAdminComments(order.adminComments ?? "");
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
      if (authorizedUser.role !== "admin") {
        console.warn(
          "Usuario no autorizado para eliminar item:",
          authorizedUser
        );
        throw new Error(
          "PIN válido, pero el usuario no tiene permisos. Solo administradores pueden eliminar items."
        );
      }

      // Eliminar item
      await deleteOrderItem(order.id, itemToDelete, authorizedUser);

      console.log("✅ Item eliminado exitosamente");
      setShowPinModal(false);
      setItemToDelete(null);
    } catch (error: any) {
      console.error("❌ Error eliminando item:", error);
      throw new Error(error.message || "Error al eliminar el item");
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
        throw new Error("Producto no encontrado");
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

      console.log("✅ Item agregado exitosamente");
    } catch (error: any) {
      console.error("❌ Error agregando item:", error);
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

      console.log(
        "✅ Item adicional agregado:",
        selectedItemForMore.productName,
        "x",
        quantity
      );
      setShowQuantityModal(false);
      setSelectedItemForMore(null);
    } catch (error: any) {
      console.error("❌ Error agregando item adicional:", error);
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
        console.error("Error saving people count:", res.error);
      }
    } catch (err) {
      console.error("Error saving people count:", err);
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
        console.error("Error saving table name:", res.error);
      }
    } catch (err) {
      console.error("Error saving table name:", err);
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
        console.error("Error saving admin comments:", res.error);
      }
    } catch (err) {
      console.error("Error saving admin comments:", err);
    }
  };

  const handleAdminCommentsChange = (
    e: React.ChangeEvent<HTMLTextAreaElement>
  ) => {
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
        navigate("/admin/home");
      } else {
        console.error("Error cerrando mesa:", res.error);
      }
    } catch (err) {
      console.error("Error cerrando mesa:", err);
    } finally {
      setCancelLoading(false);
      setShowCancelConfirm(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-500 mx-auto mb-4"></div>
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
          onClick={() => navigate("/admin/home")}
          className="mt-4 bg-red-600 hover:bg-red-700 text-gray-900 px-4 py-2 rounded-lg"
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
        <h2 className="text-xl font-bold text-white mb-2">
          Orden no encontrada
        </h2>
        <p className="text-gray-400 mb-4">
          No se encontró una orden activa para esta mesa.
        </p>
        <button
          onClick={() => navigate("/admin/home")}
          className="bg-red-600 hover:bg-red-700 text-gray-900 px-4 py-2 rounded-lg"
        >
          Volver al Panel
        </button>
      </div>
    );
  }

  // Marcar item como entregado (recogido)
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
      case "pendiente":
        return "bg-yellow-500 text-yellow-100";
      case "entregado":
        return "bg-green-600 text-green-100";
      default:
        return "bg-gray-500 text-gray-100";
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case "pendiente":
        return "⏳ Pendiente";
      case "entregado":
        return "✅ Entregado";
      default:
        return status;
    }
  };

  const timeElapsed = Math.floor(
    (new Date().getTime() - order.createdAt.getTime()) / (1000 * 60)
  );

  // Calcular totales dinámicamente basado en items activos
  const activeItems = order.items.filter((item) => !item.isDeleted);
  const calculatedSubtotal = activeItems.reduce(
    (sum, item) => sum + item.productPrice * item.quantity,
    0
  );
  const calculatedTotal = calculatedSubtotal;

  // Encuentra la promoción activa que aplique a un item
  const getItemPromo = (item: OrderItem) => {
    if (item.isDeleted) return null;
    return activePromotions.find(promo => {
      const categoryMatch =
        promo.categories.length === 0 ||
        promo.categories.includes(item.category);
      const productMatch =
        !promo.productIds || promo.productIds.length === 0 ||
        promo.productIds.includes(item.productId);
      return categoryMatch && productMatch;
    }) ?? null;
  };

  // Descuento automático estimado (solo promos vigentes al momento de agregar el item)
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

  // Precio con descuento de un item individual (sólo si la promo es vigente)
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

  return (
    <div className="p-4 md:p-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center">
          <button
            onClick={() => navigate("/admin/home")}
            className="mr-4 p-2 hover:bg-gray-700 rounded-lg transition-colors"
          >
            <ArrowLeft className="w-6 h-6 text-gray-400" />
          </button>
          <div>
            <h1 className="text-3xl font-bold text-white">
              {order.tableNumber === 0
                ? "🍹 Barra"
                : `Mesa ${order.tableNumber}`}
            </h1>
            <p className="text-gray-400">Orden #{order.id.slice(-8)}</p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-3xl font-bold text-red-500">
            ${calculatedTotal.toFixed(2)} MXN
          </p>
          <p className="text-sm text-gray-400">Total (calculado)</p>
        </div>
      </div>

      {/* Custom Table Name - Administrative Identifier */}
      <div className="bg-gray-800 p-4 rounded-xl border border-gray-800 mb-6">
        <label
          htmlFor="tableName"
          className="block text-sm font-medium text-gray-400 mb-2"
        >
          🏷️ Nombre de Mesa / Identificación
        </label>
        <input
          id="tableName"
          type="text"
          value={tableName}
          onChange={handleTableNameChange}
          onBlur={handleTableNameBlur}
          placeholder="ej: Mesa de Andrea, Cumpleaños de Juan, VIP, Terraza..."
          className="w-full bg-gray-700 border border-gray-600 text-white rounded-lg px-4 py-3 focus:ring-2 focus:ring-red-500 focus:border-transparent transition-all"
        />
        <p className="text-xs text-gray-500 mt-1">
          Personaliza la identificación de esta mesa para facilitar su ubicación
        </p>
      </div>

      {/* Info Cards - make four equal cards on md+ screens */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <div className="bg-gray-800 p-6 rounded-xl border border-gray-800 flex items-stretch">
          <div className="w-full flex items-center justify-between">
            <div className="flex items-center">
              <User className="w-10 h-10 text-red-500 mr-4" />
              <div>
                <p className="text-sm text-gray-400 mb-1">Mesero</p>
                <p className="text-xl font-semibold text-white">
                  {order.waiterName}
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-gray-800 p-6 rounded-xl border border-gray-800 flex items-stretch">
          <div className="w-full flex items-center justify-between">
            <div className="flex items-center">
              <Clock className="w-10 h-10 text-red-500 mr-4" />
              <div>
                <p className="text-sm text-gray-400 mb-1">
                  Tiempo Transcurrido
                </p>
                <p className="text-xl font-semibold text-white">
                  {timeElapsed} min
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-gray-800 p-6 rounded-xl border border-gray-800 flex items-stretch">
          <div className="w-full flex items-center justify-between">
            <div className="flex items-center">
              <Package className="w-10 h-10 text-red-500 mr-4" />
              <div>
                <p className="text-sm text-gray-400 mb-1">Items Totales</p>
                <p className="text-xl font-semibold text-white">
                  {order.items
                    .filter((item) => !item.isDeleted)
                    .reduce((total, item) => total + item.quantity, 0)}
                </p>
                <p className="text-sm text-gray-500">
                  {order.items.filter((item) => !item.isDeleted).length} tipos
                  diferentes
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-gray-800 p-6 rounded-xl border border-gray-800 flex items-stretch">
          <div className="w-full flex items-center justify-between">
            <div className="flex items-center">
              <User className="w-10 h-10 text-red-500 mr-4" />
              <div>
                <p className="text-sm text-gray-400 mb-1">Personas</p>
                <p className="text-xl font-semibold text-white">
                  {order.peopleCount ?? 1}
                </p>
              </div>
            </div>

            <div>
              <div className="flex items-center space-x-2">
                <button
                  onClick={handleDecrementPeople}
                  className="px-3 py-2 bg-gray-700 rounded text-gray-300 hover:bg-gray-600"
                  aria-label="Disminuir personas"
                >
                  -
                </button>
                <button
                  onClick={handleIncrementPeople}
                  className="px-3 py-2 bg-gray-700 rounded text-gray-300 hover:bg-gray-600"
                  aria-label="Aumentar personas"
                >
                  +
                </button>
              </div>
              <div className="mt-2 text-right"></div>
            </div>
          </div>
        </div>
      </div>

      {/* Estado de Items */}
      <div className="bg-gray-800 p-6 rounded-xl border border-gray-800 mb-8">
        <h3 className="text-lg font-semibold text-white mb-4 flex items-center">
          <div className="w-2 h-2 bg-red-500 rounded-full mr-3"></div>
          Estado de Items
        </h3>
        <div className="grid grid-cols-2 gap-4">
          {(() => {
            const activeItems = order.items.filter((item) => !item.isDeleted);
            const pendingCount = activeItems
              .filter((item) => item.status === "pendiente")
              .reduce((sum, item) => sum + item.quantity, 0);
            const deliveredCount = activeItems
              .filter((item) => item.status === "entregado")
              .reduce((sum, item) => sum + item.quantity, 0);

            return (
              <>
                <div className="text-center p-3 bg-yellow-900/20 border border-yellow-600 rounded-lg">
                  <div className="text-2xl font-bold text-yellow-400">{pendingCount}</div>
                  <div className="text-xs text-yellow-300">⏳ Pendiente</div>
                </div>
                <div className="text-center p-3 bg-green-900/20 border border-green-600 rounded-lg">
                  <div className="text-2xl font-bold text-green-400">{deliveredCount}</div>
                  <div className="text-xs text-green-300">✅ Entregado</div>
                </div>
              </>
            );
          })()}
        </div>
      </div>

      {/* Items List */}
      <div className="bg-gray-800 rounded-xl border border-gray-800 overflow-hidden">
        <div className="p-6 border-b border-gray-800">
          <h2 className="text-xl font-bold text-white">Items de la Orden</h2>
        </div>

        <div className="divide-y divide-gray-700">
          {order.items.length === 0 ||
          order.items.every((item) => item.isDeleted) ? (
            // Estado vacío - sin items
            <div className="p-12 text-center">
              <div className="mb-6">
                <Package className="w-16 h-16 text-gray-500 mx-auto mb-4" />
                <h3 className="text-xl font-bold text-white mb-2">
                  {order.items.length === 0
                    ? "Orden Vacía"
                    : "Todos los Items Eliminados"}
                </h3>
                <p className="text-gray-400 mb-6">
                  {order.items.length === 0
                    ? "Esta mesa no tiene productos agregados aún."
                    : "Todos los productos han sido eliminados de esta orden."}
                </p>
              </div>

              <div className="bg-gray-700/30 rounded-lg p-6 mb-6">
                <h4 className="text-lg font-semibold text-red-500 mb-3">
                  ¿Cómo agregar productos?
                </h4>
                <div className="space-y-3 text-sm text-gray-300">
                  <div className="flex items-center">
                    <div className="w-6 h-6 bg-red-600 text-gray-900 rounded-full flex items-center justify-center text-xs font-bold mr-3">
                      1
                    </div>
                    <span>Haz click en el botón "Agregar Items" abajo</span>
                  </div>
                  <div className="flex items-center">
                    <div className="w-6 h-6 bg-red-600 text-gray-900 rounded-full flex items-center justify-center text-xs font-bold mr-3">
                      2
                    </div>
                    <span>Busca y selecciona los productos del menú</span>
                  </div>
                  <div className="flex items-center">
                    <div className="w-6 h-6 bg-red-600 text-gray-900 rounded-full flex items-center justify-center text-xs font-bold mr-3">
                      3
                    </div>
                    <span>Elige la cantidad y confirma</span>
                  </div>
                </div>
              </div>

              <button
                onClick={handleOpenAddItemModal}
                className="bg-red-600 hover:bg-red-700 text-gray-100 font-bold py-3 px-8 rounded-lg transition-colors inline-flex items-center"
              >
                <Plus className="w-5 h-5 mr-2" />
                {order.items.length === 0
                  ? "Agregar Primer Producto"
                  : "Agregar Nuevos Productos"}
              </button>
            </div>
          ) : (
            // Lista de items existentes
            order.items.map((item: OrderItem) => {
              const isDeleted = item.isDeleted;
              const itemPromo = !isDeleted ? getItemPromo(item) : null;
              const promoValid = itemPromo ? isPromotionWithinSchedule(itemPromo.cutoffTime, item.createdAt) : false;

              return (
                <div
                  key={item.id}
                  className={`p-6 transition-colors ${
                    isDeleted
                      ? "bg-gray-800/50 border-l-4 border-gray-600"
                      : promoValid
                        ? "bg-green-950/30 border-l-4 border-green-500 hover:bg-green-950/50"
                        : "hover:bg-gray-700/50"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center">
                          <h3
                            className={`text-lg font-semibold ${
                              isDeleted
                                ? "text-gray-400 line-through"
                                : "text-white"
                            }`}
                          >
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
                            <span
                              className={`px-3 py-1 rounded-full text-xs font-bold ${getStatusColor(
                                item.status
                              )}`}
                            >
                              {getStatusText(item.status)}
                            </span>
                          )}

                          {!isDeleted && (
                            <>
                              {item.status === 'pendiente' && (
                                <button
                                  onClick={() => handleMarkDelivered(item.id)}
                                  className="p-2 text-green-400 hover:text-green-300 hover:bg-green-900/20 rounded-lg transition-colors"
                                  title="Marcar como entregado"
                                >
                                  <span className="text-sm font-bold">✓</span>
                                </button>
                              )}
                              <button
                                onClick={() => handleAddAnother(item)}
                                className="p-2 text-gray-400 hover:text-gray-300 hover:bg-gray-700 rounded-lg transition-colors"
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

                      <div
                        className={`flex items-center text-sm space-x-4 ${
                          isDeleted ? "text-gray-500" : "text-gray-400"
                        }`}
                      >
                        <span>Cantidad: {item.quantity}</span>
                        <span>Precio: ${item.productPrice.toFixed(2)}</span>
                        <span>Categoría: {item.category}</span>
                      </div>

                      {item.notes && (
                        <p
                          className={`text-sm mt-2 ${
                            isDeleted ? "text-gray-600" : "text-gray-500"
                          }`}
                        >
                          Notas: {item.notes}
                        </p>
                      )}

                      {isDeleted && (
                        <div className="mt-2 text-xs text-gray-500">
                          <p>Eliminado por: {item.deletedByName}</p>
                          <p>Fecha: {item.deletedAt?.toLocaleString()}</p>
                        </div>
                      )}
                      {/* Promo badge */}
                      {!isDeleted && (() => {
                        const promo = getItemPromo(item);
                        if (!promo) return null;
                        const valid = isPromotionWithinSchedule(promo.cutoffTime, item.createdAt);
                        return valid ? (
                          <div className="mt-2 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-green-900/40 border border-green-700/50 text-xs text-green-400">
                            <Tag size={11} />
                            <span className="font-semibold">{promo.name}</span>
                            <span className="text-green-500/80">· válido hasta las {promo.cutoffTime} hrs</span>
                          </div>
                        ) : (
                          <div className="mt-2 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-900/30 border border-amber-700/40 text-xs text-amber-400">
                            <Clock size={11} />
                            <span className="font-semibold">{promo.name}</span>
                            <span className="text-amber-500/80">· expiró a las {promo.cutoffTime} hrs</span>
                          </div>
                        );
                      })()}
                    </div>

                    <div className="text-right ml-4">
                      {(() => {
                        const discounted = !isDeleted ? getItemDiscountedTotal(item) : null;
                        const original = item.productPrice * item.quantity;
                        return (
                          <>
                            {discounted !== null ? (
                              <>
                                <p className="text-sm text-gray-500 line-through">${original.toFixed(2)}</p>
                                <p className="text-xl font-bold text-green-400">${discounted.toFixed(2)}</p>
                              </>
                            ) : (
                              <p className={`text-xl font-bold ${
                                isDeleted ? 'text-gray-500 line-through' : 'text-red-500'
                              }`}>${original.toFixed(2)}</p>
                            )}
                            <p className={`text-xs ${
                              isDeleted ? 'text-gray-600' : 'text-gray-400'
                            }`}>
                              {isDeleted ? 'No contabilizado' : `${item.quantity} × $${item.productPrice.toFixed(2)}`}
                            </p>
                          </>
                        );
                      })()}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Order Summary */}
        <div className="p-6 bg-gray-800/80 border-t border-gray-700">
          <div className="space-y-2">
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
            <div className="flex justify-between text-xl font-bold text-white border-t border-gray-600 pt-2">
              <span>Total{autoDiscount > 0 ? ' con promo' : ''}:</span>
              <span className={autoDiscount > 0 ? 'text-green-400' : ''}>
                ${(calculatedSubtotal - autoDiscount).toFixed(2)}
              </span>
            </div>
          </div>

          {/* Administrative Comments */}
          <div className="mt-6 pt-6 border-t border-gray-600">
            <label
              htmlFor="adminComments"
              className="block text-sm font-medium text-gray-400 mb-2"
            >
              📝 Comentarios Administrativos
            </label>
            <textarea
              id="adminComments"
              value={adminComments}
              onChange={handleAdminCommentsChange}
              onBlur={handleAdminCommentsBlur}
              placeholder="Notas internas: alergias, solicitudes especiales, observaciones del servicio..."
              rows={3}
              className="w-full bg-gray-800 border border-gray-800 text-white rounded-lg px-4 py-3 focus:ring-2 focus:ring-red-500 focus:border-transparent transition-all resize-none"
            />
            <p className="text-xs text-gray-500 mt-1">
              Estos comentarios son internos y NO aparecerán en el ticket del
              cliente
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-4 mt-8">
            <button
              onClick={handleOpenAddItemModal}
              className="flex-1 bg-red-600 hover:bg-red-700 text-gray-900 font-medium py-3 px-6 rounded-lg transition-colors"
            >
              Agregar Items
            </button>

            {(() => {
              const activeItemUnits = order.items
                .filter((i) => !i.isDeleted)
                .reduce((sum, i) => sum + i.quantity, 0);
              const hasUndelivered = order.items
                .filter((i) => !i.isDeleted)
                .some((i) => i.status !== "entregado");
              const canCheckout = activeItemUnits > 0 && !hasUndelivered;
              return (
                <div className="flex-1">
                  <button
                    onClick={handleProceedToCheckout}
                    disabled={!canCheckout}
                    className={`w-full font-medium py-3 px-6 rounded-lg transition-colors ${
                      canCheckout
                        ? "bg-green-600 hover:bg-green-700 text-white"
                        : "bg-gray-600 text-gray-300 cursor-not-allowed"
                    }`}
                    title={
                      canCheckout
                        ? "Proceder al pago"
                        : hasUndelivered
                        ? "No puedes cobrar: hay ítems pendientes, en preparación o listos (no entregados)"
                        : "Agrega al menos un producto para proceder"
                    }
                  >
                    Proceder al Pago
                  </button>
                  {hasUndelivered && (
                    <p className="text-xs text-yellow-300 mt-2">
                      No puedes proceder al pago: la orden tiene ítems
                      pendientes, en preparación o listos (no entregados).
                    </p>
                  )}
                </div>
              );
            })()}

            {activeItems.length === 0 && (
              <button
                onClick={() => setShowCancelConfirm(true)}
                className="flex-1 bg-gray-600 hover:bg-gray-500 text-white font-medium py-3 px-6 rounded-lg transition-colors"
              >
                Cerrar Mesa
              </button>
            )}
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
                    {cancelLoading ? "Cerrando..." : "Cerrar Mesa"}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* PIN Modal */}
        <PinModal
          isOpen={showPinModal}
          onClose={handleCancelDelete}
          onConfirm={handleConfirmDelete}
          loading={pinLoading}
          title="Eliminar Item"
          message={`¿Estás seguro de que deseas eliminar "${
            order.items.find((i) => i.id === itemToDelete)?.productName
          }"? Esta acción requiere autorización.`}
        />

        {/* Add Item Modal */}
        <AddItemModal
          isOpen={showAddItemModal}
          onClose={handleCloseAddItemModal}
          onAddItem={handleAddItem}
          products={products}
          loading={addItemLoading}
          activePromotions={activePromotions}
        />

        {/* Quantity Modal for Adding More */}
        <QuantityModal
          isOpen={showQuantityModal}
          onClose={handleCloseQuantityModal}
          onConfirm={handleConfirmQuantity}
          title="Agregar Más Items"
          product={
            selectedItemForMore
              ? {
                  id: selectedItemForMore.productId,
                  name: selectedItemForMore.productName,
                  description: `Agregar más unidades de ${selectedItemForMore.productName}`,
                  price: selectedItemForMore.productPrice,
                  category: selectedItemForMore.category,
                  available: true,
                  imageUrl: undefined,
                  createdAt: new Date(),
                  updatedAt: new Date(),
                }
              : null
          }
          loading={addItemLoading}
        />
      </div>
    </div>
  );
};

export default OrderDetails;
