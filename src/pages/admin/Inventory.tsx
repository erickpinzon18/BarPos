// src/pages/admin/Inventory.tsx
// Inventario: existencias en vivo, movimientos manuales (inicial, compra, extracción, conteo)
// y configuración de insumos + recetas por producto.
// Las ventas se descuentan solas a partir de las cuentas (ver utils/inventory.ts).
import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useLocation, Link } from "react-router-dom";
import toast from "react-hot-toast";
import {
  Archive, Plus, Loader2, X, AlertTriangle, CheckCircle, Trash2, Edit2,
  ShoppingCart, PackageMinus, ClipboardCheck, Wand2, History, Search,
} from "lucide-react";
import { getProducts } from "../../services/firestoreService";
import {
  getInventoryItems, getInventoryRecipes, getInventoryMovements, getOrdersForInventory,
  saveInventoryItem, saveInventoryRecipe, addInventoryMovement, applySeed,
} from "../../services/inventoryService";
import {
  computeConsumption, computeStockAt, lastCheckpoint, fmtQty, proposeSeed, recipeLineUnits,
  type ConsumptionResult,
} from "../../utils/inventory";
import { businessDayOf, getBusinessDayRange } from "../../utils/shift";
import { useAuth } from "../../contexts/AuthContext";
import type {
  InventoryItem, InventoryItemKind, InventoryMovement, InventoryMovementType,
  InventoryRecipe, InventoryRecipeLine, InventoryUnit, Product,
} from "../../utils/types";

// ─── Helpers ──────────────────────────────────────────────────────────────────

const pad = (n: number) => String(n).padStart(2, "0");
const toLocalDatetime = (d: Date) =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
const fmtDateTime = (d: Date) =>
  d.toLocaleString("es-MX", { weekday: "short", day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });

const KIND_LABEL: Record<InventoryItemKind, string> = {
  botella: "🍾 Botella", cerveza: "🍺 Cerveza", refresco: "🥤 Refresco", jugo: "🧃 Jugo", otro: "📦 Otro",
};
const KIND_ORDER: InventoryItemKind[] = ["botella", "cerveza", "refresco", "jugo", "otro"];

const MOVEMENT_META: Record<InventoryMovementType, { label: string; color: string; sign: string }> = {
  inicial: { label: "Inventario inicial", color: "text-blue-400", sign: "=" },
  conteo: { label: "Conteo físico", color: "text-yellow-400", sign: "=" },
  compra: { label: "Compra", color: "text-green-400", sign: "+" },
  extraccion: { label: "Extracción", color: "text-red-400", sign: "−" },
};

const EXTRACTION_REASONS = ["Merma / rota", "Cortesía de la casa", "Uso interno", "Devolución a proveedor", "Otro"];

type Tab = "existencias" | "movimientos" | "config";

// ─── Main component ───────────────────────────────────────────────────────────

const Inventory: React.FC = () => {
  const { currentUser } = useAuth();
  const location = useLocation();
  const isBarra = location.pathname.startsWith("/kitchen");
  const historyPath = isBarra ? null : "/admin/inventory-history";

  const [tab, setTab] = useState<Tab>("existencias");
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [recipes, setRecipes] = useState<Map<string, InventoryRecipe>>(new Map());
  const [movements, setMovements] = useState<InventoryMovement[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [consumption, setConsumption] = useState<ConsumptionResult>({ lines: [], cancelled: [], unmapped: [] });
  const [todayStart, setTodayStart] = useState<Date>(getBusinessDayRange(businessDayOf(new Date())).start);

  const userName = currentUser?.displayName || currentUser?.email || "Usuario";

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [its, recs, movs, prodRes] = await Promise.all([
        getInventoryItems(), getInventoryRecipes(), getInventoryMovements(), getProducts(),
      ]);
      const dayStart = getBusinessDayRange(businessDayOf(new Date())).start;
      const cp = lastCheckpoint(movs);
      // Solo hacen falta las cuentas desde el último conteo (y las de hoy para "vendido hoy")
      const from = cp && cp.at < dayStart ? cp.at : dayStart;
      const orders = await getOrdersForInventory(from);
      setItems(its);
      setRecipes(recs);
      setMovements(movs);
      setProducts(prodRes.success && prodRes.data ? prodRes.data : []);
      setConsumption(computeConsumption(orders, recs, its));
      setTodayStart(dayStart);
    } catch (err) {
      console.error(err);
      toast.error((err as Error)?.message ?? "Error al cargar inventario");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  // ─── Derived ────────────────────────────────────────────────────────────────

  const activeItems = useMemo(() => items.filter((i) => i.active), [items]);
  const { stock, checkpoint } = useMemo(
    () => computeStockAt(movements, consumption.lines),
    [movements, consumption]
  );
  const soldToday = useMemo(() => {
    const m = new Map<string, number>();
    consumption.lines.forEach((l) => {
      if (l.orderCreatedAt >= todayStart) m.set(l.itemId, (m.get(l.itemId) ?? 0) + l.qty);
    });
    return m;
  }, [consumption, todayStart]);

  const hasInitial = movements.some((m) => m.type === "inicial" || m.type === "conteo");

  // ─── Movement modal ─────────────────────────────────────────────────────────

  const [mvType, setMvType] = useState<InventoryMovementType | null>(null);
  const openMovement = (t: InventoryMovementType) => setMvType(t);

  // ─── Render ──────────────────────────────────────────────────────────────────

  const tabs: { key: Tab; label: string }[] = isBarra
    ? [{ key: "existencias", label: "Existencias" }]
    : [
        { key: "existencias", label: "Existencias" },
        { key: "movimientos", label: "Movimientos" },
        { key: "config", label: "Insumos y recetas" },
      ];

  return (
    <div className="p-4 md:p-6 max-w-full">
      <div className="mb-5 flex flex-col md:flex-row md:items-end md:justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold mb-1 flex items-center gap-2">
            <Archive className="text-red-500" /> Inventario
          </h1>
          <p className="text-gray-400 text-sm">
            Existencia = último conteo + compras − extracciones − lo vendido en las cuentas
          </p>
        </div>
        {historyPath && (
          <Link
            to={historyPath}
            className="flex items-center gap-2 px-4 py-2.5 bg-gray-800 hover:bg-gray-700 border border-gray-700 text-gray-200 font-medium rounded-lg text-sm w-fit"
          >
            <History size={16} /> Histórico por día
          </Link>
        )}
      </div>

      <div className="flex gap-1 mb-6 border-b border-gray-800">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-5 py-2.5 text-sm font-semibold border-b-2 -mb-px transition-colors ${
              tab === t.key ? "border-red-500 text-red-400" : "border-transparent text-gray-400 hover:text-gray-200"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16 text-gray-400 gap-3">
          <Loader2 className="animate-spin" size={24} /> Cargando...
        </div>
      ) : (
        <>
          {tab === "existencias" && (
            <StockTab
              items={activeItems}
              stock={stock}
              soldToday={soldToday}
              checkpoint={checkpoint}
              hasInitial={hasInitial}
              unmapped={consumption.unmapped}
              isBarra={isBarra}
              onMovement={openMovement}
              onGoConfig={() => setTab("config")}
            />
          )}
          {tab === "movimientos" && <MovementsTab movements={movements} onMovement={openMovement} hasInitial={hasInitial} />}
          {tab === "config" && (
            <ConfigTab
              items={items}
              recipes={recipes}
              products={products}
              unmapped={consumption.unmapped}
              userName={userName}
              onChanged={loadData}
            />
          )}
        </>
      )}

      {mvType && (
        <MovementModal
          type={mvType}
          items={activeItems}
          movements={movements}
          consumption={consumption}
          onClose={() => setMvType(null)}
          onSaved={async () => { setMvType(null); await loadData(); }}
          createdBy={currentUser?.id ?? ""}
          createdByName={userName}
        />
      )}
    </div>
  );
};

// ─── Existencias ──────────────────────────────────────────────────────────────

const StockTab: React.FC<{
  items: InventoryItem[];
  stock: Map<string, number>;
  soldToday: Map<string, number>;
  checkpoint: InventoryMovement | null;
  hasInitial: boolean;
  unmapped: ConsumptionResult["unmapped"];
  isBarra: boolean;
  onMovement: (t: InventoryMovementType) => void;
  onGoConfig: () => void;
}> = ({ items, stock, soldToday, checkpoint, hasInitial, unmapped, isBarra, onMovement, onGoConfig }) => {
  const [q, setQ] = useState("");
  const filtered = items.filter((i) => !q || i.name.toLowerCase().includes(q.toLowerCase()));
  const cpQty = (id: string) => checkpoint?.lines.find((l) => l.itemId === id)?.qty;
  const sinReceta = unmapped.filter((u) => u.kind === "sin-receta");
  const sinMezclador = unmapped.filter((u) => u.kind === "mezclador");

  if (items.length === 0) {
    return (
      <div className="text-center py-16">
        <Archive size={48} className="mx-auto mb-4 text-gray-700" />
        <p className="text-gray-400 mb-2">Aún no hay insumos configurados</p>
        {!isBarra && (
          <button onClick={onGoConfig} className="mt-3 px-6 py-3 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-xl">
            Configurar insumos y recetas
          </button>
        )}
      </div>
    );
  }

  return (
    <div>
      {!isBarra && (sinReceta.length > 0 || sinMezclador.length > 0) && (
        <div className="mb-4 bg-red-500/10 border border-red-500/30 rounded-xl p-4 text-sm">
          <p className="text-red-300 font-semibold flex items-center gap-2 mb-1">
            <AlertTriangle size={16} /> Hay ventas que no están descontando inventario
          </p>
          {sinReceta.length > 0 && (
            <p className="text-red-200/80">
              Productos sin receta: {sinReceta.map((u) => `${u.label.trim()} (${u.qty})`).join(", ")}
            </p>
          )}
          {sinMezclador.length > 0 && (
            <p className="text-red-200/80">
              Mezcladores sin ligar a un insumo: {sinMezclador.map((u) => `${u.label} (${u.qty})`).join(", ")}
            </p>
          )}
          <button onClick={onGoConfig} className="mt-2 text-red-300 underline text-xs">Corregir en Insumos y recetas</button>
        </div>
      )}

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 mb-4">
        <div className="text-sm text-gray-400">
          {checkpoint ? (
            <>Último conteo: <span className="text-white">{fmtDateTime(checkpoint.at)}</span> por {checkpoint.createdByName}</>
          ) : (
            <span className="text-yellow-400">Captura el inventario inicial para empezar a descontar</span>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          {!hasInitial ? (
            <ActionBtn icon={<ClipboardCheck size={16} />} label="Inventario inicial" primary onClick={() => onMovement("inicial")} />
          ) : (
            <ActionBtn icon={<ClipboardCheck size={16} />} label="Conteo físico" primary onClick={() => onMovement("conteo")} />
          )}
          {!isBarra && hasInitial && (
            <>
              <ActionBtn icon={<ShoppingCart size={16} />} label="Compra" onClick={() => onMovement("compra")} />
              <ActionBtn icon={<PackageMinus size={16} />} label="Extracción" onClick={() => onMovement("extraccion")} />
            </>
          )}
        </div>
      </div>

      <div className="relative mb-3 max-w-sm">
        <Search size={15} className="absolute left-3 top-2.5 text-gray-500" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Buscar insumo..."
          className="bg-gray-800 text-white rounded-lg pl-9 pr-3 py-2 border border-gray-700 focus:border-red-500 focus:outline-none w-full text-sm"
        />
      </div>

      <div className="overflow-x-auto rounded-xl border border-gray-700">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="bg-gray-900/80 border-b border-gray-700 text-xs text-gray-400 uppercase">
              <th className="text-left px-4 py-3">Insumo</th>
              <th className="text-center px-3 py-3">Último conteo</th>
              <th className="text-center px-3 py-3">Vendido hoy</th>
              <th className="text-center px-3 py-3 text-white bg-gray-800/60">Existencia</th>
            </tr>
          </thead>
          {KIND_ORDER.map((kind) => {
            const group = filtered.filter((i) => i.kind === kind);
            if (group.length === 0) return null;
            return (
              <tbody key={kind} className="divide-y divide-gray-800/50">
                <tr className="bg-gray-900/40">
                  <td colSpan={4} className="px-4 py-1.5 text-xs font-semibold text-gray-500 uppercase">{KIND_LABEL[kind]}</td>
                </tr>
                {group.map((it) => {
                  const s = stock.get(it.id) ?? 0;
                  const low = it.minStock !== undefined && it.minStock !== null && s <= it.minStock;
                  return (
                    <tr key={it.id} className="hover:bg-gray-800/40">
                      <td className="px-4 py-2.5 text-white font-medium">
                        {it.name}
                        <span className="text-gray-500 text-xs ml-2">{it.unit}</span>
                      </td>
                      <td className="text-center px-3 py-2.5 text-gray-400">{fmtQty(cpQty(it.id))}</td>
                      <td className="text-center px-3 py-2.5 text-gray-300">{fmtQty(soldToday.get(it.id) ?? 0)}</td>
                      <td className={`text-center px-3 py-2.5 font-bold bg-gray-800/30 ${s < 0 ? "text-red-400" : low ? "text-yellow-400" : "text-white"}`}>
                        {checkpoint ? fmtQty(s) : "—"}
                        {low && <span className="block text-xs font-normal">bajo mínimo ({fmtQty(it.minStock)})</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            );
          })}
        </table>
      </div>
      <p className="text-xs text-gray-500 mt-2">
        Las botellas se muestran en unidades (los tragos descuentan fracciones). Negativo = el sistema esperaba menos de lo que hay: revisa conteo o compras.
      </p>
    </div>
  );
};

const ActionBtn: React.FC<{ icon: React.ReactNode; label: string; onClick: () => void; primary?: boolean }> = ({ icon, label, onClick, primary }) => (
  <button
    onClick={onClick}
    className={`flex items-center gap-2 px-4 py-2.5 font-semibold rounded-lg text-sm transition-colors ${
      primary ? "bg-red-600 hover:bg-red-700 text-white" : "bg-gray-700 hover:bg-gray-600 text-gray-200"
    }`}
  >
    {icon} {label}
  </button>
);

// ─── Movimientos ──────────────────────────────────────────────────────────────

const MovementsTab: React.FC<{
  movements: InventoryMovement[];
  hasInitial: boolean;
  onMovement: (t: InventoryMovementType) => void;
}> = ({ movements, hasInitial, onMovement }) => {
  const [open, setOpen] = useState<string | null>(null);
  const sorted = [...movements].sort((a, b) => b.at.getTime() - a.at.getTime());
  return (
    <div>
      <div className="flex flex-wrap gap-2 mb-4">
        {!hasInitial && <ActionBtn icon={<ClipboardCheck size={16} />} label="Inventario inicial" primary onClick={() => onMovement("inicial")} />}
        {hasInitial && (
          <>
            <ActionBtn icon={<ShoppingCart size={16} />} label="Compra" primary onClick={() => onMovement("compra")} />
            <ActionBtn icon={<PackageMinus size={16} />} label="Extracción" onClick={() => onMovement("extraccion")} />
            <ActionBtn icon={<ClipboardCheck size={16} />} label="Conteo físico" onClick={() => onMovement("conteo")} />
          </>
        )}
      </div>
      {sorted.length === 0 ? (
        <p className="text-center py-12 text-gray-500">Sin movimientos registrados</p>
      ) : (
        <div className="space-y-2">
          {sorted.map((m) => {
            const meta = MOVEMENT_META[m.type];
            const isOpen = open === m.id;
            const diffs = m.type === "conteo" ? m.lines.filter((l) => l.expected !== undefined && Math.abs(l.qty - l.expected) > 0.009) : [];
            return (
              <div key={m.id} className="bg-gray-800/60 rounded-xl border border-gray-700 overflow-hidden">
                <button onClick={() => setOpen(isOpen ? null : m.id)} className="w-full text-left p-4 hover:bg-gray-800/80 flex flex-col md:flex-row md:items-center md:justify-between gap-1">
                  <div>
                    <span className={`font-semibold ${meta.color}`}>{meta.label}</span>
                    <span className="text-gray-400 text-sm ml-3">{fmtDateTime(m.at)}</span>
                    {m.reason && <span className="text-gray-300 text-sm ml-3">· {m.reason}</span>}
                    {m.supplier && <span className="text-gray-300 text-sm ml-3">· {m.supplier}</span>}
                  </div>
                  <div className="text-xs text-gray-500">
                    {m.lines.length} insumos · {m.createdByName}
                    {m.type === "conteo" && diffs.length > 0 && <span className="text-red-400 ml-2">{diffs.length} con diferencia</span>}
                  </div>
                </button>
                {isOpen && (
                  <div className="px-4 pb-4">
                    {m.note && <p className="text-sm text-gray-400 mb-2">Nota: {m.note}</p>}
                    <table className="min-w-full text-sm">
                      <thead>
                        <tr className="text-xs text-gray-500 uppercase">
                          <th className="text-left py-1">Insumo</th>
                          {m.type === "conteo" && <th className="text-center py-1">Esperado</th>}
                          <th className="text-center py-1">{m.type === "conteo" || m.type === "inicial" ? "Contado" : "Cantidad"}</th>
                          {m.type === "conteo" && <th className="text-center py-1">Diferencia</th>}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-800/50">
                        {m.lines.map((l) => {
                          const diff = l.expected !== undefined ? l.qty - l.expected : 0;
                          return (
                            <tr key={l.itemId}>
                              <td className="py-1.5 text-gray-200">{l.itemName}</td>
                              {m.type === "conteo" && <td className="text-center text-gray-400">{fmtQty(l.expected)}</td>}
                              <td className="text-center text-white font-semibold">{meta.sign !== "=" ? meta.sign : ""}{fmtQty(l.qty)}</td>
                              {m.type === "conteo" && (
                                <td className={`text-center font-semibold ${Math.abs(diff) < 0.01 ? "text-gray-600" : diff < 0 ? "text-red-400" : "text-green-400"}`}>
                                  {Math.abs(diff) < 0.01 ? "—" : `${diff > 0 ? "+" : ""}${fmtQty(diff)}`}
                                </td>
                              )}
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
      <p className="text-xs text-gray-500 mt-3">Los movimientos no se borran. Para corregir un error registra otro movimiento (compra, extracción o conteo).</p>
    </div>
  );
};

// ─── Modal de movimiento ─────────────────────────────────────────────────────

const MovementModal: React.FC<{
  type: InventoryMovementType;
  items: InventoryItem[];
  movements: InventoryMovement[];
  consumption: ConsumptionResult;
  onClose: () => void;
  onSaved: () => void;
  createdBy: string;
  createdByName: string;
}> = ({ type, items, movements, consumption, onClose, onSaved, createdBy, createdByName }) => {
  const meta = MOVEMENT_META[type];
  const isCount = type === "inicial" || type === "conteo";
  const [at, setAt] = useState(toLocalDatetime(new Date()));
  const [qty, setQty] = useState<Record<string, string>>({});
  const [reason, setReason] = useState(type === "extraccion" ? EXTRACTION_REASONS[0] : "");
  const [supplier, setSupplier] = useState("");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [q, setQ] = useState("");
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Esperado al instante del conteo (para mostrar y guardar diferencias)
  const expected = useMemo(() => {
    if (type !== "conteo") return new Map<string, number>();
    const when = new Date(at);
    return computeStockAt(movements, consumption.lines, Number.isNaN(when.getTime()) ? new Date() : when).stock;
  }, [type, at, movements, consumption]);

  const sortedItems = useMemo(
    () => [...items].sort((a, b) => KIND_ORDER.indexOf(a.kind) - KIND_ORDER.indexOf(b.kind) || a.name.localeCompare(b.name)),
    [items]
  );
  const visible = sortedItems.filter((i) => !q || i.name.toLowerCase().includes(q.toLowerCase()));

  const focusInput = (i: number) => {
    const el = inputRefs.current[i];
    if (el) { el.focus(); el.select(); }
  };
  const onKey = (e: React.KeyboardEvent<HTMLInputElement>, i: number) => {
    if (e.key === "ArrowDown" || e.key === "Enter") { e.preventDefault(); focusInput(i + 1); }
    else if (e.key === "ArrowUp") { e.preventDefault(); focusInput(i - 1); }
  };

  const save = async () => {
    const when = new Date(at);
    if (Number.isNaN(when.getTime())) { toast.error("Fecha inválida"); return; }
    if (when > new Date(Date.now() + 5 * 60_000)) { toast.error("La fecha no puede ser futura"); return; }
    // Antes del último conteo ya no afectaría la existencia (y no tenemos esas cuentas cargadas)
    const cp = lastCheckpoint(movements);
    if (cp && when < cp.at) {
      toast.error(`No se puede registrar antes del último conteo (${fmtDateTime(cp.at)})`);
      return;
    }
    if (type === "extraccion" && !reason.trim()) { toast.error("Indica el motivo de la extracción"); return; }

    const parse = (v: string | undefined) => (v === undefined || v.trim() === "" ? null : parseFloat(v));
    let lines;
    if (isCount) {
      // Conteo: todos los insumos. Si se deja vacío en conteo se toma lo esperado; en inicial es obligatorio.
      const missing = sortedItems.filter((i) => parse(qty[i.id]) === null);
      if (type === "inicial" && missing.length > 0) {
        toast.error(`Falta capturar ${missing.length} insumo(s): ${missing.slice(0, 3).map((m) => m.name).join(", ")}…`);
        return;
      }
      if (type === "conteo" && missing.length > 0 &&
        !window.confirm(`${missing.length} insumo(s) sin capturar se guardarán con la cantidad esperada. ¿Continuar?`)) return;
      lines = sortedItems.map((i) => {
        const exp = type === "conteo" ? Math.round((expected.get(i.id) ?? 0) * 1000) / 1000 : undefined;
        const v = parse(qty[i.id]);
        return { itemId: i.id, itemName: i.name, qty: v ?? exp ?? 0, ...(exp !== undefined ? { expected: exp } : {}) };
      });
    } else {
      lines = sortedItems
        .map((i) => ({ itemId: i.id, itemName: i.name, qty: parse(qty[i.id]) ?? 0 }))
        .filter((l) => l.qty > 0);
      if (lines.length === 0) { toast.error("Captura al menos una cantidad"); return; }
    }
    if (lines.some((l) => Number.isNaN(l.qty) || l.qty < 0)) { toast.error("Hay cantidades inválidas"); return; }

    setSaving(true);
    try {
      await addInventoryMovement({ type, at: when, lines, reason, supplier, note, createdBy, createdByName });
      toast.success(`${meta.label} guardado`);
      onSaved();
    } catch (err) {
      toast.error((err as Error)?.message ?? "Error al guardar");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/70 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="bg-gray-900 rounded-2xl border border-gray-700 w-full max-w-2xl my-4">
        <div className="flex items-center justify-between p-5 border-b border-gray-700">
          <h2 className={`text-xl font-bold ${meta.color}`}>{meta.label}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white"><X size={22} /></button>
        </div>

        <div className="p-5 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Fecha y hora">
              <input type="datetime-local" value={at} onChange={(e) => setAt(e.target.value)} className={inputCls} />
            </Field>
            {type === "compra" && (
              <Field label="Proveedor (opcional)">
                <input value={supplier} onChange={(e) => setSupplier(e.target.value)} className={inputCls} />
              </Field>
            )}
            {type === "extraccion" && (
              <Field label="Motivo">
                <select value={reason} onChange={(e) => setReason(e.target.value)} className={inputCls}>
                  {EXTRACTION_REASONS.map((r) => <option key={r} value={r}>{r}</option>)}
                </select>
              </Field>
            )}
          </div>
          <Field label="Nota (opcional)">
            <input value={note} onChange={(e) => setNote(e.target.value)} placeholder={type === "extraccion" ? "Ej: se rompió al servir mesa 4" : ""} className={inputCls} />
          </Field>

          {type === "conteo" && (
            <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl px-4 py-3 text-sm text-blue-300 flex items-center justify-between gap-3">
              <span className="flex items-center gap-2"><AlertTriangle size={15} /> El esperado se calcula a la fecha/hora del conteo.</span>
              <button
                onClick={() => setQty(Object.fromEntries(sortedItems.map((i) => [i.id, String(Math.round((expected.get(i.id) ?? 0) * 100) / 100)])))}
                className="flex-shrink-0 flex items-center gap-1 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg"
              >
                <CheckCircle size={13} /> Llenar con esperado
              </button>
            </div>
          )}

          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Filtrar insumo..." className={inputCls} />

          <div className="overflow-hidden rounded-xl border border-gray-700">
            <div className="grid grid-cols-12 bg-gray-800/60 px-4 py-2 text-xs font-semibold text-gray-400 uppercase">
              <span className="col-span-6">Insumo</span>
              <span className="col-span-2 text-center">{type === "conteo" ? "Esperado" : ""}</span>
              <span className="col-span-4 text-center">{isCount ? "Contado" : "Cantidad"}</span>
            </div>
            <div className="divide-y divide-gray-800/50 max-h-[50vh] overflow-y-auto">
              {visible.map((it, idx) => {
                const exp = expected.get(it.id);
                const v = qty[it.id];
                const num = v === undefined || v === "" ? null : parseFloat(v);
                const diff = type === "conteo" && num !== null && exp !== undefined ? num - exp : 0;
                return (
                  <div key={it.id} className={`grid grid-cols-12 items-center px-4 py-2 ${Math.abs(diff) > 0.009 ? (diff < 0 ? "bg-red-500/5" : "bg-green-500/5") : ""}`}>
                    <div className="col-span-6">
                      <p className="text-white text-sm font-medium truncate">{it.name}</p>
                      <p className="text-gray-500 text-xs">{it.unit}{it.kind === "botella" ? " · usa decimales para botellas abiertas (0.5)" : ""}</p>
                    </div>
                    <div className="col-span-2 text-center text-gray-400">{type === "conteo" ? fmtQty(exp ?? 0) : ""}</div>
                    <div className="col-span-4 flex items-center justify-center gap-2">
                      <input
                        ref={(el) => { inputRefs.current[idx] = el; }}
                        type="number" min={0} step={it.kind === "botella" ? 0.25 : 1}
                        value={v ?? ""}
                        placeholder={type === "conteo" ? fmtQty(exp ?? 0) : "0"}
                        onChange={(e) => setQty((p) => ({ ...p, [it.id]: e.target.value }))}
                        onKeyDown={(e) => onKey(e, idx)}
                        onFocus={(e) => e.target.select()}
                        className="w-24 text-center rounded-lg px-2 py-1.5 border text-sm font-semibold bg-gray-800 border-gray-600 text-white focus:outline-none focus:border-red-500"
                      />
                      {Math.abs(diff) > 0.009 && (
                        <span className={`text-xs font-medium ${diff < 0 ? "text-red-400" : "text-green-400"}`}>{diff > 0 ? "+" : ""}{fmtQty(diff)}</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-3 p-5 border-t border-gray-700">
          <button onClick={onClose} className="px-5 py-2 text-gray-400 hover:text-white text-sm">Cancelar</button>
          <button onClick={save} disabled={saving} className="flex items-center gap-2 px-6 py-2.5 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white font-semibold rounded-lg text-sm">
            {saving ? <Loader2 size={15} className="animate-spin" /> : <CheckCircle size={15} />} Guardar
          </button>
        </div>
      </div>
    </div>
  );
};

const inputCls = "bg-gray-800 text-white rounded-lg px-3 py-2 border border-gray-600 focus:border-red-500 focus:outline-none w-full text-sm";
const Field: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <div>
    <label className="text-xs font-semibold text-gray-400 uppercase mb-1.5 block">{label}</label>
    {children}
  </div>
);

// ─── Configuración: insumos y recetas ────────────────────────────────────────

const ConfigTab: React.FC<{
  items: InventoryItem[];
  recipes: Map<string, InventoryRecipe>;
  products: Product[];
  unmapped: ConsumptionResult["unmapped"];
  userName: string;
  onChanged: () => Promise<void>;
}> = ({ items, recipes, products, unmapped, userName, onChanged }) => {
  const [editItem, setEditItem] = useState<Partial<InventoryItem> | null>(null);
  const [editRecipe, setEditRecipe] = useState<InventoryRecipe | null>(null);
  const [onlyMissing, setOnlyMissing] = useState(false);
  const [q, setQ] = useState("");
  const [seedPreview, setSeedPreview] = useState<ReturnType<typeof proposeSeed> | null>(null);
  const [seeding, setSeeding] = useState(false);

  const itemById = useMemo(() => new Map(items.map((i) => [i.id, i])), [items]);
  const unmappedMixers = unmapped.filter((u) => u.kind === "mezclador");

  const sellable = products
    .filter((p) => p.available || recipes.has(p.id))
    .sort((a, b) => a.category.localeCompare(b.category) || a.name.localeCompare(b.name));
  const missingCount = sellable.filter((p) => !hasRecipe(recipes.get(p.id))).length;
  const shownProducts = sellable.filter(
    (p) => (!onlyMissing || !hasRecipe(recipes.get(p.id))) && (!q || p.name.toLowerCase().includes(q.toLowerCase()))
  );

  const openSeed = () => {
    setSeedPreview(proposeSeed(products.map((p) => ({ id: p.id, name: p.name, category: p.category }))));
  };
  const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").trim().toLowerCase();
  const existingNames = new Set(items.map((i) => norm(i.name)));
  const seedNewItems = seedPreview?.items.filter((s) => !existingNames.has(s.key)) ?? [];
  const seedNewRecipes = seedPreview?.recipes.filter((r) => !recipes.has(r.productId)) ?? [];

  const confirmSeed = async () => {
    if (!seedPreview) return;
    setSeeding(true);
    try {
      const r = await applySeed(seedPreview.items, seedPreview.recipes, items, recipes, userName);
      toast.success(`${r.itemsCreated} insumos y ${r.recipesCreated} recetas creadas`);
      setSeedPreview(null);
      await onChanged();
    } catch (err) {
      toast.error((err as Error)?.message ?? "Error al generar");
    } finally {
      setSeeding(false);
    }
  };

  return (
    <div className="space-y-8">
      {/* Insumos */}
      <section>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 mb-3">
          <h2 className="text-xl font-bold text-white">Insumos ({items.length})</h2>
          <div className="flex gap-2">
            <ActionBtn icon={<Wand2 size={16} />} label="Generar desde la carta" onClick={openSeed} />
            <ActionBtn icon={<Plus size={16} />} label="Nuevo insumo" primary
              onClick={() => setEditItem({ name: "", kind: "botella", unit: "botella", servingsPerUnit: 16, mixerAliases: [], active: true })} />
          </div>
        </div>
        {unmappedMixers.length > 0 && (
          <div className="mb-3 bg-yellow-500/10 border border-yellow-500/30 rounded-xl p-3 text-sm text-yellow-200">
            Mezcladores en notas sin insumo: {unmappedMixers.map((u) => `"${u.label}" (${u.qty})`).join(", ")}.
            Agrégalos como alias del insumo correcto.
          </div>
        )}
        <div className="overflow-x-auto rounded-xl border border-gray-700">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="bg-gray-900/80 text-xs text-gray-400 uppercase border-b border-gray-700">
                <th className="text-left px-4 py-2">Insumo</th>
                <th className="text-left px-3 py-2">Tipo</th>
                <th className="text-center px-3 py-2">Tragos/unidad</th>
                <th className="text-left px-3 py-2">Alias en notas</th>
                <th className="text-center px-3 py-2">Mínimo</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800/50">
              {items.map((it) => (
                <tr key={it.id} className={`hover:bg-gray-800/40 ${it.active ? "" : "opacity-50"}`}>
                  <td className="px-4 py-2 text-white">{it.name}{!it.active && <span className="text-xs text-gray-500 ml-2">(inactivo)</span>}</td>
                  <td className="px-3 py-2 text-gray-400">{KIND_LABEL[it.kind]}</td>
                  <td className="px-3 py-2 text-center text-gray-300">{it.kind === "botella" ? it.servingsPerUnit : "—"}</td>
                  <td className="px-3 py-2 text-gray-400 text-xs">{it.mixerAliases.join(", ") || "—"}</td>
                  <td className="px-3 py-2 text-center text-gray-400">{fmtQty(it.minStock)}</td>
                  <td className="px-3 py-2 text-right">
                    <button onClick={() => setEditItem(it)} className="text-gray-400 hover:text-white"><Edit2 size={15} /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Recetas */}
      <section>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 mb-3">
          <h2 className="text-xl font-bold text-white">
            Recetas por producto
            {missingCount > 0 && <span className="ml-2 text-sm text-red-400 font-normal">{missingCount} sin receta</span>}
          </h2>
          <div className="flex items-center gap-3">
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar producto..." className={`${inputCls} w-56`} />
            <label className="flex items-center gap-2 text-sm text-gray-300 whitespace-nowrap">
              <input type="checkbox" checked={onlyMissing} onChange={(e) => setOnlyMissing(e.target.checked)} /> Solo sin receta
            </label>
          </div>
        </div>
        <div className="overflow-x-auto rounded-xl border border-gray-700">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="bg-gray-900/80 text-xs text-gray-400 uppercase border-b border-gray-700">
                <th className="text-left px-4 py-2">Producto</th>
                <th className="text-left px-3 py-2">Categoría</th>
                <th className="text-left px-3 py-2">Descuenta</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800/50">
              {shownProducts.map((p) => {
                const r = recipes.get(p.id);
                return (
                  <tr key={p.id} className="hover:bg-gray-800/40">
                    <td className="px-4 py-2 text-white">{p.name}</td>
                    <td className="px-3 py-2 text-gray-400">{p.category}</td>
                    <td className="px-3 py-2">
                      {!hasRecipe(r) ? (
                        <span className="text-red-400 font-medium">Sin receta</span>
                      ) : r!.noInventory ? (
                        <span className="text-gray-500">No consume inventario</span>
                      ) : (
                        <span className="text-gray-300">
                          {r!.lines.map((l) => {
                            const it = itemById.get(l.itemId);
                            const txt = l.per === "serving"
                              ? `${l.qty} trago${l.qty !== 1 ? "s" : ""} (${fmtQty(recipeLineUnits(l, it))})`
                              : `${l.qty}`;
                            return `${txt} × ${it?.name ?? "¿insumo borrado?"}`;
                          }).join(" + ")}
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-right">
                      <button
                        onClick={() => setEditRecipe(r ? { ...r, lines: [...r.lines] } : { productId: p.id, productName: p.name, lines: [], noInventory: false })}
                        className="text-gray-400 hover:text-white"
                      ><Edit2 size={15} /></button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      {editItem && (
        <ItemModal item={editItem} onClose={() => setEditItem(null)} onSaved={async () => { setEditItem(null); await onChanged(); }} />
      )}
      {editRecipe && (
        <RecipeModal
          recipe={editRecipe}
          items={items.filter((i) => i.active)}
          userName={userName}
          onClose={() => setEditRecipe(null)}
          onSaved={async () => { setEditRecipe(null); await onChanged(); }}
        />
      )}
      {seedPreview && (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/70 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-gray-900 rounded-2xl border border-gray-700 w-full max-w-3xl my-4">
            <div className="flex items-center justify-between p-5 border-b border-gray-700">
              <h2 className="text-xl font-bold text-white flex items-center gap-2"><Wand2 size={20} className="text-red-500" /> Generar desde la carta</h2>
              <button onClick={() => setSeedPreview(null)} className="text-gray-400 hover:text-white"><X size={22} /></button>
            </div>
            <div className="p-5 space-y-4 text-sm">
              <p className="text-gray-400">
                Solo se crea lo que no existe. Reglas: "X - Botella" = 1 de X, "X - Promo" = 2 de X, "X - Trago" = 1 trago de X,
                cervezas y servicios = 1 de sí mismos. Paquetes, cócteles y shots se quedan sin receta para que los captures.
              </p>
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <h3 className="text-white font-semibold mb-2">Insumos nuevos ({seedNewItems.length})</h3>
                  <div className="max-h-72 overflow-y-auto space-y-1">
                    {seedNewItems.map((s) => (
                      <div key={s.key} className="bg-gray-800 rounded px-3 py-1.5 text-gray-300 flex justify-between">
                        <span>{s.name}</span><span className="text-gray-500 text-xs">{KIND_LABEL[s.kind]}</span>
                      </div>
                    ))}
                  </div>
                </div>
                <div>
                  <h3 className="text-white font-semibold mb-2">Recetas nuevas ({seedNewRecipes.length})</h3>
                  <div className="max-h-72 overflow-y-auto space-y-1">
                    {seedNewRecipes.map((r) => (
                      <div key={r.productId} className="bg-gray-800 rounded px-3 py-1.5 text-gray-300">
                        {r.productName}
                        <span className="text-gray-500 text-xs block">
                          {r.noInventory ? "No consume inventario" : r.lines.map((l) => `${l.qty} ${l.per === "serving" ? "trago" : "u"} × ${seedPreview.items.find((i) => i.key === l.itemKey)?.name}`).join(" + ")}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-3 p-5 border-t border-gray-700">
              <button onClick={() => setSeedPreview(null)} className="px-5 py-2 text-gray-400 hover:text-white text-sm">Cancelar</button>
              <button onClick={confirmSeed} disabled={seeding || (seedNewItems.length === 0 && seedNewRecipes.length === 0)}
                className="flex items-center gap-2 px-6 py-2.5 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white font-semibold rounded-lg text-sm">
                {seeding ? <Loader2 size={15} className="animate-spin" /> : <CheckCircle size={15} />} Crear
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const hasRecipe = (r?: InventoryRecipe) => !!r && (r.noInventory || r.lines.length > 0);

const ItemModal: React.FC<{ item: Partial<InventoryItem>; onClose: () => void; onSaved: () => void }> = ({ item, onClose, onSaved }) => {
  const [name, setName] = useState(item.name ?? "");
  const [kind, setKind] = useState<InventoryItemKind>(item.kind ?? "botella");
  const [unit, setUnit] = useState<InventoryUnit>(item.unit ?? "botella");
  const [spu, setSpu] = useState(String(item.servingsPerUnit ?? 16));
  const [aliases, setAliases] = useState((item.mixerAliases ?? []).join(", "));
  const [minStock, setMinStock] = useState(item.minStock !== undefined && item.minStock !== null ? String(item.minStock) : "");
  const [active, setActive] = useState(item.active ?? true);
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!name.trim()) { toast.error("Ponle nombre al insumo"); return; }
    const servings = kind === "botella" ? parseFloat(spu) : 1;
    if (!(servings > 0)) { toast.error("Tragos por unidad debe ser mayor a 0"); return; }
    setSaving(true);
    try {
      await saveInventoryItem({
        id: item.id,
        name: name.trim(),
        kind,
        unit,
        servingsPerUnit: servings,
        mixerAliases: aliases.split(",").map((a) => a.trim()).filter(Boolean),
        minStock: minStock.trim() === "" ? undefined : parseFloat(minStock),
        active,
      });
      toast.success("Insumo guardado");
      onSaved();
    } catch (err) {
      toast.error((err as Error)?.message ?? "Error al guardar");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="bg-gray-900 rounded-2xl border border-gray-700 w-full max-w-lg">
        <div className="flex items-center justify-between p-5 border-b border-gray-700">
          <h2 className="text-xl font-bold text-white">{item.id ? "Editar insumo" : "Nuevo insumo"}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white"><X size={22} /></button>
        </div>
        <div className="p-5 space-y-4">
          <Field label="Nombre"><input value={name} onChange={(e) => setName(e.target.value)} className={inputCls} /></Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Tipo">
              <select value={kind} onChange={(e) => {
                const k = e.target.value as InventoryItemKind;
                setKind(k);
                setUnit(k === "botella" ? "botella" : k === "jugo" ? "jarra" : "pz");
              }} className={inputCls}>
                {KIND_ORDER.map((k) => <option key={k} value={k}>{KIND_LABEL[k]}</option>)}
              </select>
            </Field>
            <Field label="Unidad">
              <select value={unit} onChange={(e) => setUnit(e.target.value as InventoryUnit)} className={inputCls}>
                <option value="botella">botella</option><option value="pz">pz</option><option value="jarra">jarra</option>
              </select>
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-4">
            {kind === "botella" && (
              <Field label="Tragos por botella"><input type="number" min={1} value={spu} onChange={(e) => setSpu(e.target.value)} className={inputCls} /></Field>
            )}
            <Field label="Mínimo (alerta)"><input type="number" min={0} value={minStock} onChange={(e) => setMinStock(e.target.value)} placeholder="Opcional" className={inputCls} /></Field>
          </div>
          <Field label="Alias en notas (separados por coma)">
            <input value={aliases} onChange={(e) => setAliases(e.target.value)} placeholder="Ej: Agua Tónica" className={inputCls} />
            <p className="text-xs text-gray-500 mt-1">Cómo aparece en "Servicios: 2x …" / "Refresco: 1x …". El nombre del insumo ya cuenta como alias.</p>
          </Field>
          <label className="flex items-center gap-2 text-sm text-gray-300">
            <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} /> Activo
          </label>
        </div>
        <div className="flex justify-end gap-3 p-5 border-t border-gray-700">
          <button onClick={onClose} className="px-5 py-2 text-gray-400 hover:text-white text-sm">Cancelar</button>
          <button onClick={save} disabled={saving} className="flex items-center gap-2 px-6 py-2.5 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white font-semibold rounded-lg text-sm">
            {saving ? <Loader2 size={15} className="animate-spin" /> : <CheckCircle size={15} />} Guardar
          </button>
        </div>
      </div>
    </div>
  );
};

/** Selector de insumo con buscador (sin acentos, por cualquier parte del nombre) */
const ItemPicker: React.FC<{
  items: InventoryItem[];
  value: string;
  onChange: (id: string) => void;
}> = ({ items, value, onChange }) => {
  const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").trim().toLowerCase();
  const selected = items.find((i) => i.id === value);
  const [open, setOpen] = useState(!value);
  const [q, setQ] = useState("");
  const [hi, setHi] = useState(0);
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, []);

  const results = useMemo(() => {
    const words = norm(q).split(/\s+/).filter(Boolean);
    return items
      .filter((i) => i.active !== false)
      .filter((i) => words.every((w) => norm(i.name).includes(w)))
      .sort((a, b) => KIND_ORDER.indexOf(a.kind) - KIND_ORDER.indexOf(b.kind) || a.name.localeCompare(b.name));
  }, [items, q]);

  const pick = (id: string) => { onChange(id); setOpen(false); setQ(""); };

  if (!open) {
    return (
      <button type="button" onClick={() => { setOpen(true); setHi(0); }}
        className="w-full flex items-center justify-between gap-2 bg-gray-800 rounded-lg px-3 py-2.5 border border-gray-600 hover:border-red-500 text-left">
        <span className={selected ? "text-white font-medium truncate" : "text-gray-500"}>{selected?.name ?? "Elegir insumo…"}</span>
        {selected && <span className="text-xs text-gray-500 shrink-0">{KIND_LABEL[selected.kind]}</span>}
      </button>
    );
  }

  return (
    <div ref={boxRef} className="relative">
      <div className="relative">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
        <input autoFocus value={q} placeholder="Buscar botella, cerveza, refresco…"
          onChange={(e) => { setQ(e.target.value); setHi(0); }}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") { e.preventDefault(); setHi((h) => Math.min(h + 1, results.length - 1)); }
            else if (e.key === "ArrowUp") { e.preventDefault(); setHi((h) => Math.max(h - 1, 0)); }
            else if (e.key === "Enter") { e.preventDefault(); if (results[hi]) pick(results[hi].id); }
            else if (e.key === "Escape") { e.preventDefault(); setOpen(false); }
          }}
          className="w-full bg-gray-800 text-white rounded-lg pl-9 pr-3 py-2.5 border border-red-500 focus:outline-none text-sm" />
      </div>
      <div className="mt-1 max-h-60 overflow-y-auto rounded-lg border border-gray-700 bg-gray-900">
        {results.length === 0 && <div className="px-3 py-3 text-sm text-gray-500">Sin resultados</div>}
        {results.map((x, idx) => (
          <button type="button" key={x.id} onMouseEnter={() => setHi(idx)} onClick={() => pick(x.id)}
            className={`w-full flex items-center justify-between gap-2 px-3 py-2 text-left text-sm ${idx === hi ? "bg-red-600/20 text-white" : "text-gray-300"} ${x.id === value ? "font-semibold" : ""}`}>
            <span className="truncate">{x.name}</span>
            <span className="text-xs text-gray-500 shrink-0">{KIND_LABEL[x.kind]}</span>
          </button>
        ))}
      </div>
    </div>
  );
};

const RecipeModal: React.FC<{
  recipe: InventoryRecipe;
  items: InventoryItem[];
  userName: string;
  onClose: () => void;
  onSaved: () => void;
}> = ({ recipe, items, userName, onClose, onSaved }) => {
  const [lines, setLines] = useState<InventoryRecipeLine[]>(recipe.lines);
  const [noInventory, setNoInventory] = useState(!!recipe.noInventory);
  const [saving, setSaving] = useState(false);
  const itemById = new Map(items.map((i) => [i.id, i]));

  const update = (i: number, patch: Partial<InventoryRecipeLine>) =>
    setLines((p) => p.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));

  const save = async () => {
    const valid = lines.filter((l) => l.itemId && l.qty > 0);
    if (!noInventory && valid.length === 0) { toast.error("Agrega al menos un insumo o marca 'No consume inventario'"); return; }
    setSaving(true);
    try {
      await saveInventoryRecipe({ ...recipe, lines: noInventory ? [] : valid, noInventory }, userName);
      toast.success("Receta guardada");
      onSaved();
    } catch (err) {
      toast.error((err as Error)?.message ?? "Error al guardar");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="bg-gray-900 rounded-2xl border border-gray-700 w-full max-w-xl">
        <div className="flex items-center justify-between p-5 border-b border-gray-700">
          <h2 className="text-lg font-bold text-white">Receta: <span className="text-red-400">{recipe.productName}</span></h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white"><X size={22} /></button>
        </div>
        <div className="p-5 space-y-4 max-h-[70vh] overflow-y-auto">
          <p className="text-xs text-gray-500">
            Lo que descuenta <b>1</b> unidad vendida de este producto. Los mezcladores elegidos en el modal de botella/trago
            se descuentan aparte desde las notas; no los agregues aquí.
          </p>
          <label className="flex items-center gap-2 text-sm text-gray-300">
            <input type="checkbox" checked={noInventory} onChange={(e) => setNoInventory(e.target.checked)} />
            No consume inventario (ej: Vaso roto, cargos)
          </label>
          {!noInventory && (
            <div className="space-y-3">
              {lines.map((l, i) => {
                const it = itemById.get(l.itemId);
                return (
                  <div key={i} className="rounded-xl border border-gray-700 bg-gray-800/40 p-3 space-y-2">
                    <div className="flex gap-2 items-start">
                      <div className="flex-1 min-w-0">
                        <ItemPicker items={items} value={l.itemId} onChange={(id) => update(i, { itemId: id })} />
                      </div>
                      <button onClick={() => setLines((p) => p.filter((_, idx) => idx !== i))} className="p-2 text-gray-500 hover:text-red-400" title="Quitar">
                        <Trash2 size={16} />
                      </button>
                    </div>
                    <div className="flex gap-2 items-center">
                      <span className="text-xs text-gray-500 w-16">Descuenta</span>
                      <input type="number" min={0} step={0.25} value={l.qty}
                        onChange={(e) => update(i, { qty: parseFloat(e.target.value) || 0 })}
                        className="bg-gray-800 text-white rounded-lg px-3 py-2 border border-gray-600 focus:border-red-500 focus:outline-none text-sm w-24 text-center" />
                      <select value={l.per} onChange={(e) => update(i, { per: e.target.value as "unit" | "serving" })}
                        className="bg-gray-800 text-white rounded-lg px-3 py-2 border border-gray-600 focus:border-red-500 focus:outline-none text-sm flex-1">
                        <option value="unit">{it?.unit ?? "unidad"}(s) completa(s)</option>
                        <option value="serving">trago(s){it && it.servingsPerUnit > 1 ? ` (1/${it.servingsPerUnit} de ${it.unit})` : ""}</option>
                      </select>
                    </div>
                  </div>
                );
              })}
              <button onClick={() => setLines((p) => [...p, { itemId: "", qty: 1, per: "unit" }])} className="flex items-center gap-1 text-sm text-red-400 hover:text-red-300">
                <Plus size={14} /> Agregar insumo
              </button>
            </div>
          )}
        </div>
        <div className="flex justify-end gap-3 p-5 border-t border-gray-700">
          <button onClick={onClose} className="px-5 py-2 text-gray-400 hover:text-white text-sm">Cancelar</button>
          <button onClick={save} disabled={saving} className="flex items-center gap-2 px-6 py-2.5 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white font-semibold rounded-lg text-sm">
            {saving ? <Loader2 size={15} className="animate-spin" /> : <CheckCircle size={15} />} Guardar
          </button>
        </div>
      </div>
    </div>
  );
};

export default Inventory;
