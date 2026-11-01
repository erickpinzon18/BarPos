// src/pages/admin/MoveItems.tsx
import React, { useMemo, useState } from "react";
import { ArrowRightLeft, ArrowRight, Loader2, Minus, Plus, Search } from "lucide-react";
import toast from "react-hot-toast";
import { useTables } from "../../hooks/useTables";
import { useActiveOrders } from "../../hooks/useOrders";
import { useAuth } from "../../contexts/AuthContext";
import { transferOrderItems, type TransferTarget } from "../../services/orderService";
import { withEffectiveStatus } from "../../utils/tableStatus";
import { tableLabel } from "../../utils/tableLabel";
import type { Order } from "../../utils/types";

const fmt = (n: number) => n.toLocaleString("es-MX", { style: "currency", currency: "MXN" });

const orderTotal = (o: Order) =>
  o.items.filter(i => !i.isDeleted).reduce((s, i) => s + i.productPrice * i.quantity, 0);

const byTableNumber = (a: { tableNumber?: number | string; number?: number | string }, b: typeof a) =>
  String(a.tableNumber ?? a.number).localeCompare(String(b.tableNumber ?? b.number), "es", { numeric: true });

const MoveItems: React.FC = () => {
  const { currentUser } = useAuth();
  const { tables: rawTables, loading: tablesLoading } = useTables();
  const { orders, loading: ordersLoading } = useActiveOrders();
  const tables = withEffectiveStatus(rawTables, orders);

  const [sourceId, setSourceId] = useState<string>("");
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [targetMode, setTargetMode] = useState<"order" | "table">("order");
  const [targetId, setTargetId] = useState<string>("");
  const [search, setSearch] = useState("");
  const [saving, setSaving] = useState(false);

  const sortedOrders = useMemo(() => [...orders].sort(byTableNumber), [orders]);
  const freeTables = useMemo(
    () => tables.filter(t => t.status === "libre").sort(byTableNumber),
    [tables]
  );

  const source = orders.find(o => o.id === sourceId) ?? null;
  const sourceItems = source?.items.filter(i => !i.isDeleted) ?? [];

  const selectedCount = sourceItems.reduce((s, i) => s + Math.min(quantities[i.id] ?? 0, i.quantity), 0);
  const selectedAmount = sourceItems.reduce(
    (s, i) => s + Math.min(quantities[i.id] ?? 0, i.quantity) * i.productPrice,
    0
  );

  const targetLabel =
    targetMode === "order"
      ? (() => {
          const o = orders.find(x => x.id === targetId);
          return o ? tableLabel(o.tableNumber) : "";
        })()
      : (() => {
          const t = tables.find(x => x.id === targetId);
          return t ? tableLabel(t.number) : "";
        })();

  const q = search.trim().toLowerCase();
  const matches = (label: string, extra = "") =>
    !q || label.toLowerCase().includes(q) || extra.toLowerCase().includes(q);

  const selectSource = (id: string) => {
    setSourceId(id);
    setQuantities({});
    if (targetId === id) setTargetId("");
  };

  const setQty = (itemId: string, qty: number, max: number) =>
    setQuantities(prev => ({ ...prev, [itemId]: Math.max(0, Math.min(max, qty)) }));

  const selectAll = () =>
    setQuantities(Object.fromEntries(sourceItems.map(i => [i.id, i.quantity])));

  const handleMove = async () => {
    if (!currentUser || !source || !targetId || selectedCount === 0) return;
    const target: TransferTarget =
      targetMode === "order" ? { kind: "order", orderId: targetId } : { kind: "table", tableId: targetId };
    const moves = Object.entries(quantities)
      .filter(([, qty]) => qty > 0)
      .map(([itemId, quantity]) => ({ itemId, quantity }));

    setSaving(true);
    try {
      await transferOrderItems(source.id, moves, target, currentUser);
      toast.success(`${selectedCount} producto(s) movidos de ${tableLabel(source.tableNumber)} a ${targetLabel}`);
      setQuantities({});
      setTargetId("");
    } catch (err: any) {
      console.error("❌ Error moviendo productos:", err);
      toast.error(err?.message || "No se pudieron mover los productos");
    } finally {
      setSaving(false);
    }
  };

  if (tablesLoading || ordersLoading) {
    return (
      <div className="flex items-center justify-center min-h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-500" />
      </div>
    );
  }

  const step = "text-xs font-bold uppercase tracking-wider text-gray-500 mb-3";

  return (
    <div className="max-w-7xl mx-auto pb-28">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-white flex items-center gap-3">
          <ArrowRightLeft className="w-8 h-8 text-red-500" />
          Mover productos
        </h1>
        <p className="text-gray-400 mt-1 text-sm">
          Pasa productos de una cuenta a otra mesa ocupada, o sepáralos a una mesa libre. Lo que ya se
          imprimió o entregó no se vuelve a mandar a barra/cocina.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[260px_1fr_300px] gap-4">
        {/* 1. Mesa origen */}
        <section className="bg-gray-900 border border-gray-800 rounded-xl p-4">
          <p className={step}>1 · Mesa origen</p>
          <div className="relative mb-3">
            <Search className="w-4 h-4 text-gray-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Buscar mesa o mesero"
              className="w-full bg-gray-800 border border-gray-700 rounded-lg pl-9 pr-3 py-2 text-sm text-white outline-none focus:ring-2 focus:ring-red-500"
            />
          </div>
          {sortedOrders.length === 0 ? (
            <p className="text-gray-500 text-sm">No hay cuentas abiertas.</p>
          ) : (
            <div className="space-y-2 max-h-[60vh] overflow-y-auto pr-1">
              {sortedOrders
                .filter(o => matches(tableLabel(o.tableNumber), `${o.waiterName ?? ""} ${o.tableName ?? ""}`))
                .map(o => {
                  const count = o.items.filter(i => !i.isDeleted).reduce((s, i) => s + i.quantity, 0);
                  const active = o.id === sourceId;
                  return (
                    <button
                      key={o.id}
                      onClick={() => selectSource(o.id)}
                      className={`w-full text-left px-3 py-2.5 rounded-lg border transition-colors ${
                        active
                          ? "bg-red-500/15 border-red-500 text-white"
                          : "bg-gray-800/60 border-gray-700 text-gray-300 hover:border-gray-500"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-semibold">{tableLabel(o.tableNumber)}</span>
                        <span className="text-sm">{fmt(orderTotal(o))}</span>
                      </div>
                      <div className="text-xs text-gray-400 truncate">
                        {o.waiterName || "—"} · {count} prod.
                        {o.tableName ? ` · ${o.tableName}` : ""}
                      </div>
                    </button>
                  );
                })}
            </div>
          )}
        </section>

        {/* 2. Productos */}
        <section className="bg-gray-900 border border-gray-800 rounded-xl p-4">
          <div className="flex items-center justify-between mb-3">
            <p className={`${step} mb-0`}>
              2 · Productos {source ? `de ${tableLabel(source.tableNumber)}` : ""}
            </p>
            {sourceItems.length > 0 && (
              <div className="flex gap-3 text-xs">
                <button onClick={selectAll} className="text-red-400 hover:text-red-300 font-semibold">
                  Todo
                </button>
                <button onClick={() => setQuantities({})} className="text-gray-400 hover:text-gray-200">
                  Limpiar
                </button>
              </div>
            )}
          </div>
          {!source ? (
            <p className="text-gray-500 text-sm py-10 text-center">Elige la mesa de la que quieres mover productos.</p>
          ) : sourceItems.length === 0 ? (
            <p className="text-gray-500 text-sm py-10 text-center">Esta cuenta no tiene productos.</p>
          ) : (
            <div className="space-y-2">
              {sourceItems.map(item => {
                const qty = Math.min(quantities[item.id] ?? 0, item.quantity);
                return (
                  <div
                    key={item.id}
                    className={`flex items-center gap-3 p-3 rounded-lg border ${
                      qty > 0 ? "bg-red-500/10 border-red-500/50" : "bg-gray-800/60 border-gray-700"
                    }`}
                  >
                    <button
                      onClick={() => setQty(item.id, qty > 0 ? 0 : item.quantity, item.quantity)}
                      className="flex-1 min-w-0 text-left"
                    >
                      <p className="font-medium text-white truncate">{item.productName}</p>
                      <p className="text-xs text-gray-400 truncate">
                        {item.quantity} × {fmt(item.productPrice)}
                        {item.status === "entregado" ? " · entregado" : " · pendiente"}
                        {item.notes ? ` · ${item.notes}` : ""}
                      </p>
                    </button>
                    <div className="flex items-center gap-1 bg-gray-950 rounded-lg p-1 border border-gray-700 flex-shrink-0">
                      <button
                        onClick={() => setQty(item.id, qty - 1, item.quantity)}
                        disabled={qty === 0}
                        className="w-9 h-9 rounded-md bg-gray-800 text-gray-300 hover:bg-gray-700 flex items-center justify-center disabled:opacity-40"
                        aria-label="Menos"
                      >
                        <Minus className="w-4 h-4" />
                      </button>
                      <span className="w-12 text-center text-sm font-bold text-white">
                        {qty}/{item.quantity}
                      </span>
                      <button
                        onClick={() => setQty(item.id, qty + 1, item.quantity)}
                        disabled={qty === item.quantity}
                        className="w-9 h-9 rounded-md bg-gray-800 text-gray-300 hover:bg-gray-700 flex items-center justify-center disabled:opacity-40"
                        aria-label="Más"
                      >
                        <Plus className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* 3. Destino */}
        <section className="bg-gray-900 border border-gray-800 rounded-xl p-4">
          <p className={step}>3 · Mover a</p>
          <div className="grid grid-cols-2 gap-1 bg-gray-800 rounded-lg p-1 mb-3">
            {(["order", "table"] as const).map(mode => (
              <button
                key={mode}
                onClick={() => {
                  setTargetMode(mode);
                  setTargetId("");
                }}
                className={`py-2 rounded-md text-sm font-semibold transition-colors ${
                  targetMode === mode ? "bg-red-600 text-white" : "text-gray-400 hover:text-gray-200"
                }`}
              >
                {mode === "order" ? "Mesa ocupada" : "Mesa libre"}
              </button>
            ))}
          </div>
          <p className="text-xs text-gray-500 mb-3">
            {targetMode === "order"
              ? "Los productos se suman a la cuenta abierta de esa mesa."
              : "Se abre una cuenta nueva con el mismo mesero (separar cuenta)."}
          </p>
          <div className="space-y-2 max-h-[50vh] overflow-y-auto pr-1">
            {targetMode === "order"
              ? sortedOrders
                  .filter(o => o.id !== sourceId)
                  .map(o => (
                    <button
                      key={o.id}
                      onClick={() => setTargetId(o.id)}
                      className={`w-full text-left px-3 py-2.5 rounded-lg border transition-colors ${
                        targetId === o.id
                          ? "bg-emerald-500/15 border-emerald-500 text-white"
                          : "bg-gray-800/60 border-gray-700 text-gray-300 hover:border-gray-500"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-semibold">{tableLabel(o.tableNumber)}</span>
                        <span className="text-sm">{fmt(orderTotal(o))}</span>
                      </div>
                      <div className="text-xs text-gray-400 truncate">{o.waiterName || "—"}</div>
                    </button>
                  ))
              : freeTables.map(t => (
                  <button
                    key={t.id}
                    onClick={() => setTargetId(t.id)}
                    className={`w-full text-left px-3 py-2.5 rounded-lg border transition-colors ${
                      targetId === t.id
                        ? "bg-emerald-500/15 border-emerald-500 text-white"
                        : "bg-gray-800/60 border-gray-700 text-gray-300 hover:border-gray-500"
                    }`}
                  >
                    <span className="font-semibold">{tableLabel(t.number)}</span>
                  </button>
                ))}
            {targetMode === "order" && sortedOrders.filter(o => o.id !== sourceId).length === 0 && (
              <p className="text-gray-500 text-sm">No hay otras mesas ocupadas.</p>
            )}
            {targetMode === "table" && freeTables.length === 0 && (
              <p className="text-gray-500 text-sm">No hay mesas libres.</p>
            )}
          </div>
        </section>
      </div>

      {/* Barra de confirmación */}
      <div className="fixed bottom-0 left-0 md:left-64 right-0 bg-gray-900/95 backdrop-blur border-t border-gray-800 px-4 py-3 z-30">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center gap-3 justify-between pr-20 md:pr-0">
          <div className="text-sm text-gray-300 flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-white">{source ? tableLabel(source.tableNumber) : "—"}</span>
            <ArrowRight className="w-4 h-4 text-gray-500" />
            <span className="font-semibold text-white">{targetLabel || "—"}</span>
            <span className="text-gray-400">
              · {selectedCount} prod. · {fmt(selectedAmount)}
            </span>
          </div>
          <button
            onClick={handleMove}
            disabled={saving || !source || !targetId || selectedCount === 0}
            className="px-6 py-3 bg-red-600 hover:bg-red-700 disabled:bg-gray-700 disabled:text-gray-400 text-white rounded-xl font-semibold flex items-center gap-2"
          >
            {saving && <Loader2 className="w-4 h-4 animate-spin" />}
            Mover productos
          </button>
        </div>
      </div>
    </div>
  );
};

export default MoveItems;
