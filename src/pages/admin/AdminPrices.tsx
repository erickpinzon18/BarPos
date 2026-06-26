// src/pages/admin/AdminPrices.tsx
import React, { useState } from "react";
import { useActiveOrders } from "../../hooks/useOrders";
import { updateOrderItemPrice } from "../../services/firestoreService";
import { useAuth } from "../../contexts/AuthContext";
import type { Order, OrderItem } from "../../utils/types";
import {
  CircleDollarSign,
  Pencil,
  Check,
  X,
  ShieldCheck,
  History,
  Loader2,
} from "lucide-react";
import toast from "react-hot-toast";

type EditingState = {
  orderId: string;
  itemId: string;
  value: string;
} | null;

const fmt = (n: number) =>
  n.toLocaleString("es-MX", { style: "currency", currency: "MXN" });

const timeAgo = (date: Date | any): string => {
  const d: Date =
    date && typeof date.toDate === "function" ? date.toDate() : new Date(date);
  const diff = Math.floor((Date.now() - d.getTime()) / 1000);
  if (diff < 60) return "hace un momento";
  if (diff < 3600) return `hace ${Math.floor(diff / 60)} min`;
  if (diff < 86400) return `hace ${Math.floor(diff / 3600)} h`;
  return d.toLocaleDateString("es-MX");
};

const OrderCard: React.FC<{
  order: Order;
  editing: EditingState;
  saving: boolean;
  onEdit: (orderId: string, item: OrderItem) => void;
  onSave: () => void;
  onCancel: () => void;
  onChangeValue: (v: string) => void;
}> = ({ order, editing, saving, onEdit, onSave, onCancel, onChangeValue }) => {
  const activeItems = order.items.filter((i) => !i.isDeleted);

  const subtotal = activeItems.reduce(
    (s, i) => s + i.productPrice * i.quantity,
    0
  );

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-gray-800">
        <div>
          <h3 className="font-bold text-white text-base">
            Mesa {order.tableNumber}
          </h3>
          {order.tableName && (
            <p className="text-xs text-red-400 mt-0.5">{order.tableName}</p>
          )}
          <p className="text-xs text-gray-400 mt-0.5">{order.waiterName}</p>
        </div>
        <div className="text-right">
          <p className="text-xs text-gray-500">subtotal</p>
          <p className="font-semibold text-white">{fmt(subtotal)}</p>
        </div>
      </div>

      {/* Items */}
      <div className="divide-y divide-gray-800">
        {activeItems.length === 0 && (
          <p className="text-center text-gray-600 py-6 text-sm">
            Sin ítems activos
          </p>
        )}
        {activeItems.map((item) => {
          const isEditing =
            editing?.orderId === order.id && editing?.itemId === item.id;
          const hasModifiedPrice =
            item.originalPrice !== undefined &&
            item.originalPrice !== item.productPrice;

          return (
            <div key={item.id} className="px-5 py-3">
              <div className="flex items-center gap-3">
                {/* Qty + name */}
                <span className="text-gray-500 text-sm w-6 shrink-0 text-right">
                  {item.quantity}×
                </span>
                <span className="flex-1 text-gray-200 text-sm leading-tight">
                  {item.productName}
                </span>

                {/* Price area */}
                {isEditing ? (
                  <div className="flex items-center gap-2">
                    <span className="text-gray-500 text-sm">$</span>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={editing.value}
                      onChange={(e) => onChangeValue(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") onSave();
                        if (e.key === "Escape") onCancel();
                      }}
                      className="w-24 bg-gray-800 border border-red-500 text-white text-sm rounded-lg px-2 py-1 focus:outline-none focus:ring-1 focus:ring-red-500"
                      autoFocus
                    />
                    <button
                      onClick={onSave}
                      disabled={saving}
                      className="p-1.5 rounded-lg bg-green-600/20 text-green-400 hover:bg-green-600/40 disabled:opacity-50 transition-colors"
                      title="Guardar"
                    >
                      {saving ? (
                        <Loader2 size={14} className="animate-spin" />
                      ) : (
                        <Check size={14} />
                      )}
                    </button>
                    <button
                      onClick={onCancel}
                      disabled={saving}
                      className="p-1.5 rounded-lg bg-gray-700 text-gray-400 hover:bg-gray-600 transition-colors"
                      title="Cancelar"
                    >
                      <X size={14} />
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      {hasModifiedPrice && (
                        <p className="text-xs text-gray-500 line-through">
                          {fmt(item.originalPrice!)}
                        </p>
                      )}
                      <p
                        className={`text-sm font-semibold ${
                          hasModifiedPrice ? "text-yellow-400" : "text-gray-200"
                        }`}
                      >
                        {fmt(item.productPrice)}
                      </p>
                    </div>
                    <button
                      onClick={() => onEdit(order.id, item)}
                      className="p-1.5 rounded-lg text-gray-500 hover:bg-gray-800 hover:text-red-400 transition-colors"
                      title="Editar precio"
                    >
                      <Pencil size={14} />
                    </button>
                  </div>
                )}
              </div>

              {/* Audit trail */}
              {hasModifiedPrice && item.priceModifiedByName && (
                <div className="flex items-center gap-1.5 mt-1.5 ml-9">
                  <History size={10} className="text-yellow-600" />
                  <span className="text-xs text-yellow-700">
                    Modificado por {item.priceModifiedByName}
                    {item.priceModifiedAt
                      ? ` · ${timeAgo(item.priceModifiedAt)}`
                      : ""}
                  </span>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

const AdminPrices: React.FC = () => {
  const { currentUser } = useAuth();
  const { orders, loading } = useActiveOrders();
  const [editing, setEditing] = useState<EditingState>(null);
  const [saving, setSaving] = useState(false);

  // Guard: solo superAdmin
  if (!currentUser?.superAdmin) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4 text-center">
        <ShieldCheck size={48} className="text-gray-700" />
        <p className="text-gray-500 text-lg font-medium">
          Acceso restringido
        </p>
        <p className="text-gray-600 text-sm max-w-xs">
          Solo administradores con permiso especial pueden acceder a este módulo.
        </p>
      </div>
    );
  }

  const handleEdit = (orderId: string, item: OrderItem) => {
    setEditing({
      orderId,
      itemId: item.id,
      value: String(item.productPrice),
    });
  };

  const handleCancel = () => setEditing(null);

  const handleSave = async () => {
    if (!editing || !currentUser) return;
    const newPrice = parseFloat(editing.value);
    if (isNaN(newPrice) || newPrice < 0) {
      toast.error("Precio inválido");
      return;
    }
    setSaving(true);
    try {
      const res = await updateOrderItemPrice(
        editing.orderId,
        editing.itemId,
        newPrice,
        currentUser.id,
        currentUser.displayName ?? currentUser.email
      );
      if (res.success) {
        toast.success("Precio actualizado");
        setEditing(null);
      } else {
        toast.error(res.error ?? "Error al guardar");
      }
    } finally {
      setSaving(false);
    }
  };

  const ordersWithItems = orders.filter(
    (o) => o.items.some((i) => !i.isDeleted)
  );

  return (
    <div className="max-w-6xl mx-auto">
      {/* Page header */}
      <div className="flex items-center gap-3 mb-8">
        <div className="p-2.5 rounded-xl bg-red-500/10">
          <CircleDollarSign size={24} className="text-red-400" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-white">Modificar Precios</h1>
          <p className="text-sm text-gray-400 mt-0.5">
            Ajusta el precio de productos en cuentas activas · Cambios quedan
            registrados
          </p>
        </div>
        <div className="ml-auto flex items-center gap-1.5 bg-red-500/10 border border-red-500/20 rounded-full px-3 py-1.5">
          <ShieldCheck size={14} className="text-red-400" />
          <span className="text-xs text-red-400 font-medium">Super Admin</span>
        </div>
      </div>

      {/* States */}
      {loading && (
        <div className="flex items-center justify-center gap-3 py-20 text-gray-500">
          <Loader2 size={22} className="animate-spin" />
          <span>Cargando cuentas activas…</span>
        </div>
      )}

      {!loading && ordersWithItems.length === 0 && (
        <div className="text-center py-20">
          <CircleDollarSign size={40} className="text-gray-700 mx-auto mb-4" />
          <p className="text-gray-500 text-lg font-medium">
            No hay cuentas activas
          </p>
          <p className="text-gray-600 text-sm mt-1">
            Las mesas con cuentas abiertas aparecerán aquí.
          </p>
        </div>
      )}

      {/* Orders grid */}
      {!loading && ordersWithItems.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {ordersWithItems.map((order) => (
            <OrderCard
              key={order.id}
              order={order}
              editing={editing}
              saving={saving}
              onEdit={handleEdit}
              onSave={handleSave}
              onCancel={handleCancel}
              onChangeValue={(v) =>
                setEditing((prev) => (prev ? { ...prev, value: v } : null))
              }
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default AdminPrices;
