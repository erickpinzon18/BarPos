// src/pages/admin/InventoryHistory.tsx
// Histórico de inventario por día de operación (5 AM → 5 AM):
// por insumo muestra inicio, compras, extracciones, vendido, ajuste de conteo y final,
// y el detalle línea por línea de qué cuenta / mesa / mesero / producto lo descontó.
import React, { useState, useEffect, useCallback, useMemo } from "react";
import { Link } from "react-router-dom";
import toast from "react-hot-toast";
import * as XLSX from "xlsx";
import {
  History, Loader2, ChevronDown, ChevronUp, Search, X, Download, AlertTriangle, ArrowLeft, Ban,
} from "lucide-react";
import {
  getInventoryItems, getInventoryRecipes, getInventoryMovements, getOrdersForInventory,
} from "../../services/inventoryService";
import {
  computeConsumption, computeStockAt, lastCheckpoint, fmtQty,
  type ConsumptionLine, type ConsumptionResult,
} from "../../utils/inventory";
import { businessDayKey, getBusinessDayRange, parseDayKey } from "../../utils/shift";
import type { InventoryItem, InventoryMovement, Order } from "../../utils/types";

const fmtTime = (d: Date) => d.toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" });
const fmtDay = (d: Date) => d.toLocaleDateString("es-MX", { weekday: "short", day: "2-digit", month: "short" });
const tableLabel = (l: { tableNumber: number | string; tableName?: string }) =>
  `Mesa ${l.tableNumber}${l.tableName ? ` "${l.tableName}"` : ""}`;

const STATUS_STYLE: Record<string, string> = {
  pagado: "bg-green-500/15 text-green-400",
  cortesia: "bg-purple-500/15 text-purple-400",
  activo: "bg-yellow-500/15 text-yellow-400",
};
const STATUS_LABEL: Record<string, string> = { pagado: "pagado", cortesia: "cortesía", activo: "en curso" };

interface Row {
  item: InventoryItem;
  start: number | null;
  compras: number;
  extracciones: number;
  vendido: number;
  ajuste: number;
  end: number | null;
  lines: ConsumptionLine[];
  manual: { m: InventoryMovement; qty: number; expected?: number }[];
}

const InventoryHistory: React.FC = () => {
  const todayKey = businessDayKey(new Date());
  const [fromKey, setFromKey] = useState(todayKey);
  const [toKey, setToKey] = useState(todayKey);
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [movements, setMovements] = useState<InventoryMovement[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [consumption, setConsumption] = useState<ConsumptionResult>({ lines: [], cancelled: [], unmapped: [] });
  const [range, setRange] = useState<{ start: Date; end: Date } | null>(null);
  const [q, setQ] = useState("");
  const [expanded, setExpanded] = useState<string[]>([]);
  const [onlyMoved, setOnlyMoved] = useState(true);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);

  const load = useCallback(async (fk: string, tk: string) => {
    if (fk > tk) { toast.error("La fecha inicial no puede ser mayor a la final"); return; }
    setLoading(true);
    try {
      const start = getBusinessDayRange(parseDayKey(fk)).start;
      const end = getBusinessDayRange(parseDayKey(tk)).end;
      const [its, recs, movs] = await Promise.all([getInventoryItems(), getInventoryRecipes(), getInventoryMovements()]);
      // Para el inicio del día hace falta lo vendido desde el último conteo previo
      const cp = lastCheckpoint(movs, start);
      const from = cp && cp.at < start ? cp.at : start;
      const ords = await getOrdersForInventory(from, end);
      setItems(its);
      setMovements(movs);
      setOrders(ords);
      setConsumption(computeConsumption(ords, recs, its));
      setRange({ start, end });
      setExpanded([]);
    } catch (err) {
      console.error(err);
      toast.error((err as Error)?.message ?? "Error al cargar histórico");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(todayKey, todayKey); }, [load, todayKey]);

  const inRange = useCallback((d: Date) => !!range && d >= range.start && d < range.end, [range]);
  const rangeLines = useMemo(() => consumption.lines.filter((l) => inRange(l.orderCreatedAt)), [consumption, inRange]);
  const rangeMovements = useMemo(() => movements.filter((m) => inRange(m.at)), [movements, inRange]);
  const rangeOrderIds = useMemo(
    () => new Set(orders.filter((o) => inRange(o.createdAt instanceof Date ? o.createdAt : new Date(o.createdAt))).map((o) => o.id)),
    [orders, inRange]
  );
  const cancelled = consumption.cancelled.filter((c) => rangeOrderIds.has(c.orderId));
  const unmapped = useMemo(
    () => consumption.unmapped
      .map((u) => ({ ...u, orders: u.orders.filter((o) => rangeOrderIds.has(o.orderId)) }))
      .filter((u) => u.orders.length > 0),
    [consumption, rangeOrderIds]
  );

  const rows: Row[] = useMemo(() => {
    if (!range) return [];
    const startStock = computeStockAt(movements, consumption.lines, new Date(range.start.getTime() - 1));
    const endStock = computeStockAt(movements, consumption.lines, new Date(Math.min(range.end.getTime() - 1, Date.now())));
    return items.map((item) => {
      const lines = rangeLines.filter((l) => l.itemId === item.id).sort((a, b) => a.itemCreatedAt.getTime() - b.itemCreatedAt.getTime());
      const manual = rangeMovements.flatMap((m) =>
        m.lines.filter((l) => l.itemId === item.id).map((l) => ({ m, qty: l.qty, expected: l.expected }))
      );
      const sum = (t: string) => manual.filter((x) => x.m.type === t).reduce((s, x) => s + x.qty, 0);
      const vendido = lines.reduce((s, l) => s + l.qty, 0);
      const start = startStock.checkpoint ? startStock.stock.get(item.id) ?? 0 : null;
      const end = endStock.checkpoint ? endStock.stock.get(item.id) ?? 0 : null;
      const compras = sum("compra");
      const extracciones = sum("extraccion");
      // Lo que no explican compras/extracciones/ventas lo explica un conteo físico (faltante o sobrante)
      const ajuste = end !== null ? end - ((start ?? 0) + compras - extracciones - vendido) : 0;
      return { item, start, compras, extracciones, vendido, ajuste, end, lines, manual };
    });
  }, [items, movements, consumption, range, rangeLines, rangeMovements]);

  const shown = rows.filter((r) =>
    (!q || r.item.name.toLowerCase().includes(q.toLowerCase())) &&
    (!onlyMoved || r.lines.length > 0 || r.manual.length > 0)
  );

  const toggle = (id: string) => setExpanded((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));
  const openOrder = (id: string) => setSelectedOrder(orders.find((o) => o.id === id) ?? null);

  const exportExcel = () => {
    if (!range) return;
    const resumen = rows.map((r) => ({
      Insumo: r.item.name,
      Inicio: r.start ?? "",
      Compras: r.compras,
      Extracciones: r.extracciones,
      Vendido: Math.round(r.vendido * 100) / 100,
      "Ajuste conteo": Math.round(r.ajuste * 100) / 100,
      Final: r.end !== null ? Math.round(r.end * 100) / 100 : "",
    }));
    const detalle = rangeLines
      .slice()
      .sort((a, b) => a.itemCreatedAt.getTime() - b.itemCreatedAt.getTime())
      .map((l) => ({
        Fecha: l.itemCreatedAt.toLocaleString("es-MX"),
        Insumo: items.find((i) => i.id === l.itemId)?.name ?? l.itemId,
        Descuento: Math.round(l.qty * 1000) / 1000,
        Producto: l.productName,
        Cantidad: l.productQty,
        Origen: l.source,
        Folio: l.folio ?? "",
        Mesa: tableLabel(l),
        Mesero: l.waiterName,
        Estado: STATUS_LABEL[l.orderStatus] ?? l.orderStatus,
        Notas: l.notes ?? "",
      }));
    const canc = cancelled.map((c) => ({
      Producto: c.productName, Cantidad: c.productQty, Motivo: c.reason ?? "", "Canceló": c.deletedByName ?? "",
      Hora: c.deletedAt ? c.deletedAt.toLocaleString("es-MX") : "", Folio: c.folio ?? "", Mesa: tableLabel(c), Mesero: c.waiterName,
    }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(resumen), "Resumen");
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(detalle), "Detalle");
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(canc), "Cancelados");
    XLSX.writeFile(wb, `Inventario_${fromKey}${toKey !== fromKey ? `_a_${toKey}` : ""}.xlsx`);
  };

  return (
    <div className="p-4 md:p-6">
      <Link to="/admin/inventory" className="inline-flex items-center gap-1 text-sm text-gray-400 hover:text-white mb-3">
        <ArrowLeft size={14} /> Inventario
      </Link>
      <h1 className="text-3xl font-bold mb-1 flex items-center gap-2">
        <History className="text-red-500" /> Histórico de inventario
      </h1>
      <p className="text-gray-400 text-sm mb-5">
        Día de operación de 5 AM a 5 AM. Abre un insumo para ver de qué cuenta, mesa y mesero salió cada descuento.
      </p>

      <div className="bg-gray-800 rounded-2xl border border-gray-700 p-4 mb-5 flex flex-col md:flex-row md:items-end gap-3">
        <div>
          <label className="block text-xs font-semibold text-gray-400 uppercase mb-1.5">Desde</label>
          <input type="date" value={fromKey} onChange={(e) => setFromKey(e.target.value)}
            className="bg-gray-900 text-white rounded-lg p-2.5 border border-gray-700 [color-scheme:dark]" />
        </div>
        <div>
          <label className="block text-xs font-semibold text-gray-400 uppercase mb-1.5">Hasta</label>
          <input type="date" value={toKey} onChange={(e) => setToKey(e.target.value)}
            className="bg-gray-900 text-white rounded-lg p-2.5 border border-gray-700 [color-scheme:dark]" />
        </div>
        <button onClick={() => load(fromKey, toKey)} disabled={loading}
          className="flex items-center justify-center gap-2 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white font-bold py-2.5 px-6 rounded-lg">
          <Search size={16} /> {loading ? "Buscando..." : "Buscar"}
        </button>
        <button onClick={exportExcel} disabled={loading || !range}
          className="flex items-center justify-center gap-2 bg-gray-700 hover:bg-gray-600 disabled:opacity-50 text-gray-200 font-semibold py-2.5 px-4 rounded-lg md:ml-auto">
          <Download size={16} /> Excel
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16 text-gray-400 gap-3"><Loader2 className="animate-spin" size={24} /> Cargando...</div>
      ) : items.length === 0 ? (
        <p className="text-center py-16 text-gray-500">No hay insumos configurados. Ve a Inventario → Insumos y recetas.</p>
      ) : (
        <>
          {unmapped.length > 0 && (
            <div className="mb-4 bg-red-500/10 border border-red-500/30 rounded-xl p-4 text-sm">
              <p className="text-red-300 font-semibold flex items-center gap-2 mb-1"><AlertTriangle size={16} /> Vendido sin descontar inventario</p>
              <ul className="text-red-200/80 space-y-0.5">
                {unmapped.map((u) => (
                  <li key={u.kind + u.key}>
                    {u.kind === "sin-receta" ? "Sin receta" : "Mezclador sin ligar"}: <b>{u.label.trim()}</b> ({u.qty}) —{" "}
                    {u.orders.map((o, i) => (
                      <button key={o.orderId} onClick={() => openOrder(o.orderId)} className="underline hover:text-white">
                        {i > 0 ? ", " : ""}{o.folio ?? `Mesa ${o.tableNumber}`}
                      </button>
                    ))}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="flex flex-col md:flex-row md:items-center gap-3 mb-3">
            <div className="relative max-w-sm flex-1">
              <Search size={15} className="absolute left-3 top-2.5 text-gray-500" />
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar insumo (ej. Centenario)..."
                className="bg-gray-800 text-white rounded-lg pl-9 pr-3 py-2 border border-gray-700 focus:border-red-500 focus:outline-none w-full text-sm" />
            </div>
            <label className="flex items-center gap-2 text-sm text-gray-300">
              <input type="checkbox" checked={onlyMoved} onChange={(e) => setOnlyMoved(e.target.checked)} /> Solo insumos con movimiento
            </label>
          </div>

          <div className="space-y-2 mb-8">
            <div className="hidden md:grid grid-cols-12 px-4 text-xs font-semibold text-gray-500 uppercase">
              <span className="col-span-4">Insumo</span>
              <span className="col-span-1 text-center">Inicio</span>
              <span className="col-span-1 text-center">Compras</span>
              <span className="col-span-2 text-center">Extracciones</span>
              <span className="col-span-1 text-center">Vendido</span>
              <span className="col-span-2 text-center">Ajuste conteo</span>
              <span className="col-span-1 text-center">Final</span>
            </div>
            {shown.length === 0 && <p className="text-center py-10 text-gray-500">Sin movimientos en este periodo</p>}
            {shown.map((r) => {
              const open = expanded.includes(r.item.id);
              return (
                <div key={r.item.id} className="bg-gray-800/60 rounded-xl border border-gray-700 overflow-hidden">
                  <button onClick={() => toggle(r.item.id)} className="w-full grid grid-cols-2 md:grid-cols-12 gap-y-1 items-center px-4 py-3 text-left hover:bg-gray-800/80">
                    <span className="col-span-2 md:col-span-4 text-white font-medium flex items-center gap-2">
                      {open ? <ChevronUp size={15} /> : <ChevronDown size={15} />} {r.item.name}
                      <span className="text-xs text-gray-500">{r.lines.length} desc.</span>
                    </span>
                    <Cell label="Inicio" v={r.start} />
                    <Cell label="Compras" v={r.compras} cls="text-green-400" prefix="+" />
                    <Cell label="Extracciones" v={r.extracciones} cls="text-red-400" prefix="−" span2 />
                    <Cell label="Vendido" v={r.vendido} cls="text-orange-300" prefix="−" />
                    <Cell label="Ajuste" v={Math.abs(r.ajuste) < 0.01 ? 0 : r.ajuste} cls={r.ajuste < -0.009 ? "text-red-400" : r.ajuste > 0.009 ? "text-green-400" : "text-gray-500"} span2 signed />
                    <Cell label="Final" v={r.end} cls="text-white font-bold" />
                  </button>
                  {open && (
                    <div className="px-4 pb-4 overflow-x-auto">
                      <table className="min-w-full text-sm">
                        <thead>
                          <tr className="text-xs text-gray-500 uppercase border-b border-gray-700">
                            <th className="text-left py-1.5 pr-3">Hora</th>
                            <th className="text-left py-1.5 pr-3">Folio</th>
                            <th className="text-left py-1.5 pr-3">Mesa</th>
                            <th className="text-left py-1.5 pr-3">Mesero</th>
                            <th className="text-left py-1.5 pr-3">Producto</th>
                            <th className="text-center py-1.5 pr-3">Descuenta</th>
                            <th className="text-left py-1.5">Estado</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-800/50">
                          {r.manual.map(({ m, qty, expected }) => (
                            <tr key={m.id} className="bg-gray-900/40">
                              <td className="py-1.5 pr-3 text-gray-400 whitespace-nowrap">{fmtDay(m.at)} {fmtTime(m.at)}</td>
                              <td colSpan={4} className="py-1.5 pr-3 text-gray-300">
                                <b className="capitalize">{m.type === "extraccion" ? "Extracción" : m.type}</b>
                                {m.reason ? ` · ${m.reason}` : ""}{m.supplier ? ` · ${m.supplier}` : ""}{m.note ? ` · ${m.note}` : ""} · {m.createdByName}
                              </td>
                              <td className="py-1.5 pr-3 text-center font-semibold text-gray-200">
                                {m.type === "compra" ? `+${fmtQty(qty)}` : m.type === "extraccion" ? `−${fmtQty(qty)}` : `= ${fmtQty(qty)}`}
                                {expected !== undefined && Math.abs(qty - expected) > 0.009 && (
                                  <span className={`block text-xs ${qty < expected ? "text-red-400" : "text-green-400"}`}>esperado {fmtQty(expected)}</span>
                                )}
                              </td>
                              <td />
                            </tr>
                          ))}
                          {r.lines.map((l, i) => (
                            <tr key={i} className="hover:bg-gray-800/40">
                              <td className="py-1.5 pr-3 text-gray-400 whitespace-nowrap">{fmtDay(l.itemCreatedAt)} {fmtTime(l.itemCreatedAt)}</td>
                              <td className="py-1.5 pr-3">
                                <button onClick={() => openOrder(l.orderId)} className="text-blue-400 hover:underline">{l.folio ?? "ver"}</button>
                              </td>
                              <td className="py-1.5 pr-3 text-gray-300 whitespace-nowrap">{tableLabel(l)}</td>
                              <td className="py-1.5 pr-3 text-gray-300 whitespace-nowrap">{l.waiterName}</td>
                              <td className="py-1.5 pr-3 text-gray-200">
                                {l.productName} ×{l.productQty}
                                {l.source === "mezclador" && <span className="text-xs text-gray-500 block">mezclador en notas: {l.notes}</span>}
                              </td>
                              <td className="py-1.5 pr-3 text-center font-semibold text-orange-300">−{fmtQty(l.qty)}</td>
                              <td className="py-1.5">
                                <span className={`text-xs px-2 py-0.5 rounded-full ${STATUS_STYLE[l.orderStatus] ?? ""}`}>{STATUS_LABEL[l.orderStatus] ?? l.orderStatus}</span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {cancelled.length > 0 && (
            <section className="mb-8">
              <h2 className="text-lg font-bold text-white mb-2 flex items-center gap-2"><Ban size={18} className="text-gray-400" /> Cancelados en cuentas (no descuentan)</h2>
              <div className="overflow-x-auto rounded-xl border border-gray-700">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="bg-gray-900/80 text-xs text-gray-400 uppercase">
                      <th className="text-left px-4 py-2">Producto</th>
                      <th className="text-left px-3 py-2">Motivo</th>
                      <th className="text-left px-3 py-2">Canceló</th>
                      <th className="text-left px-3 py-2">Cuenta</th>
                      <th className="text-left px-3 py-2">Mesero</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-800/50">
                    {cancelled.map((c, i) => (
                      <tr key={i}>
                        <td className="px-4 py-2 text-gray-200">{c.productName} ×{c.productQty}</td>
                        <td className="px-3 py-2 text-gray-400">{c.reason || "—"}</td>
                        <td className="px-3 py-2 text-gray-400">{c.deletedByName ?? "—"}{c.deletedAt ? ` · ${fmtTime(c.deletedAt)}` : ""}</td>
                        <td className="px-3 py-2"><button onClick={() => openOrder(c.orderId)} className="text-blue-400 hover:underline">{c.folio ?? "ver"} · {tableLabel(c)}</button></td>
                        <td className="px-3 py-2 text-gray-400">{c.waiterName}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}
        </>
      )}

      {selectedOrder && <OrderModal order={selectedOrder} onClose={() => setSelectedOrder(null)} />}
    </div>
  );
};

const Cell: React.FC<{ label: string; v: number | null; cls?: string; prefix?: string; span2?: boolean; signed?: boolean }> = ({ label, v, cls = "text-gray-300", prefix = "", span2, signed }) => (
  <span className={`${span2 ? "md:col-span-2" : "md:col-span-1"} text-center ${cls}`}>
    <span className="md:hidden text-xs text-gray-500 mr-1">{label}:</span>
    {v === null ? "—" : v === 0 ? <span className="text-gray-600">0</span> : signed ? `${v > 0 ? "+" : ""}${fmtQty(v)}` : `${prefix}${fmtQty(v)}`}
  </span>
);

const OrderModal: React.FC<{ order: Order; onClose: () => void }> = ({ order, onClose }) => {
  const created = order.createdAt instanceof Date ? order.createdAt : new Date(order.createdAt);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="bg-gray-900 rounded-2xl border border-gray-700 w-full max-w-lg max-h-[85vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between p-5 border-b border-gray-700">
          <div>
            <h2 className="text-lg font-bold text-white">{order.folio ? `Folio ${order.folio}` : "Cuenta"} · {tableLabel(order)}</h2>
            <p className="text-sm text-gray-400">
              {order.waiterName} · abierta {fmtDay(created)} {fmtTime(created)} ·{" "}
              <span className={`text-xs px-2 py-0.5 rounded-full ${STATUS_STYLE[order.status] ?? ""}`}>{STATUS_LABEL[order.status] ?? order.status}</span>
            </p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-white"><X size={22} /></button>
        </div>
        <div className="p-5 space-y-2">
          {(order.items ?? []).map((it) => (
            <div key={it.id} className={`rounded-lg px-3 py-2 ${it.isDeleted ? "bg-red-500/5 line-through text-gray-500" : "bg-gray-800 text-gray-200"}`}>
              <div className="flex justify-between text-sm">
                <span>{it.quantity}× {it.productName}</span>
                <span className="text-gray-500 text-xs">{it.createdAt ? fmtTime(new Date(it.createdAt)) : ""}</span>
              </div>
              {it.notes && <p className="text-xs text-gray-500 mt-0.5 no-underline">{it.notes}</p>}
              {it.isDeleted && <p className="text-xs text-red-400 no-underline">Cancelado{it.cancelReason ? `: ${it.cancelReason}` : ""}{it.deletedByName ? ` · ${it.deletedByName}` : ""}</p>}
            </div>
          ))}
          {typeof order.total === "number" && <p className="text-right text-white font-semibold pt-2">Total ${order.total.toLocaleString("es-MX")}</p>}
        </div>
      </div>
    </div>
  );
};

export default InventoryHistory;
