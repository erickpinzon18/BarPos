import React, { useState, useEffect, useCallback } from "react";
import {
  collection,
  query,
  where,
  getDocs,
  addDoc,
  orderBy,
  Timestamp,
  doc,
  updateDoc,
} from "firebase/firestore";
import { db } from "../../services/firebase";
import { getProducts } from "../../services/firestoreService";
import type { Product, OrderItem } from "../../utils/types";
import { useAuth } from "../../contexts/AuthContext";
import toast from "react-hot-toast";
import {
  Archive,
  Plus,
  ClipboardList,
  Loader2,
  X,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  CheckCircle,
  Minus,
  Calendar,
  Trash2,
  Check,
  Edit2,
} from "lucide-react";

// ─── Section config ───────────────────────────────────────────────────────────

type MainSection = "barra" | "bodega";

interface Subsection {
  key: string;
  label: string;
  icon: string;
}

const SUBSECTIONS: Record<MainSection, Subsection[]> = {
  barra: [
    { key: "botellas",  label: "Botellas",  icon: "🍾" },
    { key: "refrescos", label: "Refrescos", icon: "🥤" },
    { key: "cerveza",   label: "Cerveza",   icon: "🍺" },
  ],
  bodega: [
    { key: "cerveza",        label: "Cerveza",        icon: "🍺" },
    { key: "refresco",       label: "Refresco",       icon: "🥤" },
    { key: "botellas_extra", label: "Botellas extra", icon: "🍾" },
  ],
};

// Qué categorías del catálogo mostrar en cada sub-sección (null = todas)
const SUBSECTION_CATALOG_CATEGORIES: Record<string, string[] | null> = {
  "botellas":      ["Botella"],
  "refrescos":     ["Servicio"],
  "cerveza":       ["Bebida"],
  "refresco":      ["Servicio"],
  "botellas_extra":["Botella"],
};

// ─── Types ────────────────────────────────────────────────────────────────────

interface PeriodProduct {
  productName: string;
  unit: string;
  initialQty: number;
}

interface CheckEntry {
  productName: string;
  systemQty: number | null;
  confirmedQty: number | null;
  prevQty?: number | null;
}

interface InventoryCheck {
  id: string;
  periodId: string;
  label: string;
  checkDate: Date;
  entries: CheckEntry[];
}

interface InventoryPeriod {
  id: string;
  section: MainSection;
  subsection: string;
  name: string;
  startDate: Date;
  createdBy: string;
  active: boolean;
  products: PeriodProduct[];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const pad = (n: number) => String(n).padStart(2, "0");

const toLocalDatetime = (d: Date) =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;

const fmtDate = (d: Date) =>
  d.toLocaleDateString("es-MX", { weekday: "short", day: "2-digit", month: "short" });

const fmtNum = (n: number | null) =>
  n === null ? "—" : n % 1 === 0 ? String(n) : n.toFixed(1);

// ─── Discrepancy badge ────────────────────────────────────────────────────────

const DiscBadge: React.FC<{ sys: number | null; real: number | null }> = ({ sys, real }) => {
  if (sys === null || real === null) return null;
  const diff = real - sys;
  if (Math.abs(diff) < 0.01) return null;
  return (
    <span className={`text-xs font-medium ml-1 ${diff > 0 ? "text-green-400" : "text-red-400"}`}>
      ({diff > 0 ? "+" : ""}{fmtNum(diff)})
    </span>
  );
};

// ─── Spreadsheet table ────────────────────────────────────────────────────────

const SpreadsheetTable: React.FC<{
  period: InventoryPeriod;
  periodChecks: InventoryCheck[];
  onEditCheck?: (check: InventoryCheck, idx: number, period: InventoryPeriod) => void;
}> = ({ period, periodChecks, onEditCheck }) => {
  const currentStock = (productName: string) => {
    if (periodChecks.length === 0) {
      const p = period.products.find((x) => x.productName === productName);
      return { qty: p?.initialQty ?? null, fromSystem: false };
    }
    const last = periodChecks[periodChecks.length - 1];
    const entry = last.entries.find((e) => e.productName === productName);
    if (!entry) return { qty: null, fromSystem: false };
    if (entry.confirmedQty !== null) return { qty: entry.confirmedQty, fromSystem: false };
    return { qty: entry.systemQty, fromSystem: true };
  };

  return (
    <div className="overflow-x-auto rounded-xl border border-gray-700">
      <table className="min-w-full text-sm">
        <thead>
          <tr className="bg-gray-900/80 border-b border-gray-700">
            <th className="sticky left-0 bg-gray-900 z-10 text-left px-4 py-3 text-xs font-semibold text-gray-400 uppercase min-w-[180px] border-r border-gray-700">
              Producto
            </th>
            <th className="text-center px-3 py-3 text-xs font-semibold text-gray-400 uppercase min-w-[70px]">
              Unidad
            </th>
            <th className="text-center px-3 py-3 text-xs font-semibold text-gray-400 uppercase min-w-[80px] bg-gray-800/40">
              Inicial
            </th>
            {periodChecks.map((check, idx) => (
              <th
                key={check.id}
                colSpan={2}
                onClick={() => onEditCheck?.(check, idx, period)}
                className="text-center px-2 py-3 text-xs font-semibold text-gray-400 uppercase min-w-[140px] border-l border-gray-700/50 cursor-pointer hover:bg-gray-800/40 transition-colors group"
              >
                <div className="flex items-center justify-center gap-1">
                  {check.label}
                  <Edit2 size={12} className="opacity-0 group-hover:opacity-100" />
                </div>
                <div className="text-gray-600 text-xs font-normal">{fmtDate(check.checkDate)}</div>
              </th>
            ))}
            <th className="text-center px-3 py-3 text-xs font-semibold text-white uppercase min-w-[90px] border-l border-gray-700 bg-gray-800/60">
              Stock Actual
            </th>
          </tr>
          {periodChecks.length > 0 && (
            <tr className="bg-gray-900/40 border-b border-gray-700 text-xs text-gray-500">
              <th className="sticky left-0 bg-gray-900/60 border-r border-gray-700" />
              <th /><th />
              {periodChecks.map((check) => (
                <React.Fragment key={check.id}>
                  <th className="py-1 px-2 text-gray-500 font-medium border-l border-gray-700/40">Sistema</th>
                  <th className="py-1 px-2 text-blue-400 font-medium">Real</th>
                </React.Fragment>
              ))}
              <th className="border-l border-gray-700" />
            </tr>
          )}
        </thead>
        <tbody className="divide-y divide-gray-800/50">
          {period.products.map((product, idx) => {
            const stock = currentStock(product.productName);
            return (
              <tr key={idx} className="hover:bg-gray-800/40 transition-colors">
                <td className="sticky left-0 bg-gray-950 hover:bg-gray-900 z-10 px-4 py-2.5 text-white font-medium border-r border-gray-700/50 truncate max-w-[200px]">
                  {product.productName}
                </td>
                <td className="text-center px-3 py-2.5 text-gray-400 text-xs">{product.unit}</td>
                <td className="text-center px-3 py-2.5 font-semibold text-gray-300 bg-gray-800/20">
                  {fmtNum(product.initialQty)}
                </td>
                {periodChecks.map((check, checkIndex) => {
                  const entry = check.entries.find((e) => e.productName === product.productName);
                  let sys = entry?.systemQty ?? null;
                  
                  if (sys === null) {
                    const prevCheck = checkIndex > 0 ? periodChecks[checkIndex - 1] : null;
                    if (prevCheck) {
                      const prevEntry = prevCheck.entries.find(e => e.productName === product.productName);
                      sys = prevEntry?.confirmedQty ?? prevEntry?.systemQty ?? product.initialQty;
                    } else {
                      sys = product.initialQty;
                    }
                  }

                  const real = entry?.confirmedQty ?? null;
                  const isMixer = period.subsection === "refrescos" || period.subsection === "refresco";
                  const hasDisc = !isMixer && sys !== null && real !== null && Math.abs(real - sys) > 0.01;
                  const isShort = hasDisc && real! < sys!;
                  return (
                    <React.Fragment key={check.id}>
                      <td className="text-center px-2 py-2.5 text-gray-500 border-l border-gray-700/30">
                        {fmtNum(sys)}
                      </td>
                      <td className={`text-center px-2 py-2.5 font-semibold ${
                        real === null ? "text-gray-600" : isShort ? "text-red-400" : hasDisc ? "text-green-400" : "text-white"
                      }`}>
                        {fmtNum(real)}
                        {hasDisc && (
                          <span className={`text-xs ml-1 ${isShort ? "text-red-500" : "text-green-500"}`}>
                            {real! > sys! ? "+" : ""}{fmtNum(real! - sys!)}
                          </span>
                        )}
                      </td>
                    </React.Fragment>
                  );
                })}
                <td className={`text-center px-3 py-2.5 font-bold border-l border-gray-700 ${
                  stock.fromSystem ? "text-gray-400 italic" : "text-white"
                }`}>
                  {fmtNum(stock.qty)}
                  {stock.fromSystem && <span className="block text-xs text-gray-600 font-normal">estimado</span>}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};

// ─── Main component ───────────────────────────────────────────────────────────

const Inventory: React.FC = () => {
  const { currentUser } = useAuth();

  // Navigation state
  const [mainSection, setMainSection] = useState<MainSection>("barra");
  const [subsectionKey, setSubsectionKey] = useState<string>("botellas");

  // Sync subsection default when switching main section
  const handleMainSection = (s: MainSection) => {
    setMainSection(s);
    setSubsectionKey(SUBSECTIONS[s][0].key);
  };

  // Data
  const [periods, setPeriods] = useState<InventoryPeriod[]>([]);
  const [checks, setChecks] = useState<InventoryCheck[]>([]);
  const [catalogProducts, setCatalogProducts] = useState<Product[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [expandedPast, setExpandedPast] = useState<string | null>(null);

  // New period modal
  const [showNewPeriod, setShowNewPeriod] = useState(false);
  const [isEditingPeriod, setIsEditingPeriod] = useState(false);
  const [npName, setNpName] = useState("");
  const [npDate, setNpDate] = useState(toLocalDatetime(new Date()));
  const [npRows, setNpRows] = useState<PeriodProduct[]>([{ productName: "", unit: "pz", initialQty: 0 }]);
  const [npSaving, setNpSaving] = useState(false);
  const [npSearch, setNpSearch] = useState("");

  // Add check modal
  const [showAddCheck, setShowAddCheck] = useState(false);
  const [checkLabel, setCheckLabel] = useState("");
  const [checkDate, setCheckDate] = useState(toLocalDatetime(new Date()));
  const [checkEntries, setCheckEntries] = useState<CheckEntry[]>([]);
  const [checkLoading, setCheckLoading] = useState(false);
  const [checkSaving, setCheckSaving] = useState(false);
  const [editingCheckId, setEditingCheckId] = useState<string | null>(null);

  // ─── Load data ──────────────────────────────────────────────────────────────

  const loadData = useCallback(async () => {
    setLoadingData(true);
    try {
      const [pSnap, cSnap, prodRes] = await Promise.all([
        getDocs(query(collection(db, "inventoryPeriods"), orderBy("startDate", "desc"))),
        getDocs(query(collection(db, "inventoryChecks"), orderBy("checkDate", "asc"))),
        getProducts(),
      ]);

      setPeriods(
        pSnap.docs.map((d) => ({
          id: d.id,
          section: d.data().section,
          subsection: d.data().subsection ?? "",
          name: d.data().name,
          startDate: d.data().startDate.toDate(),
          createdBy: d.data().createdBy ?? "",
          active: d.data().active ?? false,
          products: d.data().products ?? [],
        }))
      );

      setChecks(
        cSnap.docs.map((d) => ({
          id: d.id,
          periodId: d.data().periodId,
          label: d.data().label,
          checkDate: d.data().checkDate.toDate(),
          entries: d.data().entries ?? [],
        }))
      );

      if (prodRes.success && prodRes.data) setCatalogProducts(prodRes.data.filter((p) => p.available));
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingData(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  // ─── Derived ────────────────────────────────────────────────────────────────

  const activePeriod =
    periods.find((p) => p.section === mainSection && p.subsection === subsectionKey && p.active) ?? null;

  const pastPeriods = periods.filter(
    (p) => p.section === mainSection && p.subsection === subsectionKey && !p.active
  );

  const activeChecks = checks
    .filter((c) => c.periodId === activePeriod?.id)
    .sort((a, b) => a.checkDate.getTime() - b.checkDate.getTime());

  const currentSubInfo = SUBSECTIONS[mainSection].find((s) => s.key === subsectionKey)!;

  // ─── New period ─────────────────────────────────────────────────────────────

  const openNewPeriod = () => {
    const label = currentSubInfo?.label ?? subsectionKey;
    setNpName(`${label} — ${new Date().toLocaleDateString("es-MX", { day: "2-digit", month: "short" })}`);
    setNpDate(toLocalDatetime(new Date()));
    setNpRows([{ productName: "", unit: "pz", initialQty: 0 }]);
    setNpSearch("");
    setIsEditingPeriod(false);
    setShowNewPeriod(true);
  };

  const openEditPeriod = () => {
    if (!activePeriod) return;
    setNpName(activePeriod.name);
    setNpDate(toLocalDatetime(activePeriod.startDate));
    setNpRows(activePeriod.products.length > 0 ? activePeriod.products : [{ productName: "", unit: "pz", initialQty: 0 }]);
    setNpSearch("");
    setIsEditingPeriod(true);
    setShowNewPeriod(true);
  };

  const addCatalogProduct = (product: Product) => {
    if (npRows.some((r) => r.productName === product.name)) return;
    setNpRows((prev) => [...prev.filter((r) => r.productName !== ""), { productName: product.name, unit: "pz", initialQty: 0 }]);
  };

  const saveNewPeriod = async () => {
    const validRows = npRows.filter((r) => r.productName.trim() && r.initialQty >= 0);
    if (!npName.trim()) { toast.error("Ponle un nombre al período"); return; }
    if (validRows.length === 0) { toast.error("Agrega al menos un producto"); return; }

    setNpSaving(true);
    try {
      if (isEditingPeriod && activePeriod) {
        await updateDoc(doc(db, "inventoryPeriods", activePeriod.id), {
          name: npName.trim(),
          startDate: Timestamp.fromDate(new Date(npDate)),
          products: validRows.map((r) => ({
            productName: r.productName.trim(),
            unit: r.unit.trim() || "pz",
            initialQty: r.initialQty,
          })),
        });
        toast.success("Período actualizado");
      } else {
        if (activePeriod) {
          await updateDoc(doc(db, "inventoryPeriods", activePeriod.id), { active: false });
        }
        await addDoc(collection(db, "inventoryPeriods"), {
          section: mainSection,
          subsection: subsectionKey,
          name: npName.trim(),
          startDate: Timestamp.fromDate(new Date(npDate)),
          createdBy: currentUser?.displayName ?? currentUser?.email ?? "Admin",
          active: true,
          products: validRows.map((r) => ({
            productName: r.productName.trim(),
            unit: r.unit.trim() || "pz",
            initialQty: r.initialQty,
          })),
        });
        toast.success("Período creado");
      }
      setShowNewPeriod(false);
      await loadData();
    } catch (err: any) {
      toast.error(err?.message ?? "Error al guardar");
    } finally {
      setNpSaving(false);
    }
  };

  // ─── Add check ──────────────────────────────────────────────────────────────

  const openAddCheck = async () => {
    if (!activePeriod) return;
    const now = new Date();
    const weekday = now.toLocaleDateString("es-MX", { weekday: "long" });
    setCheckLabel(weekday.charAt(0).toUpperCase() + weekday.slice(1));
    setCheckDate(toLocalDatetime(now));
    setCheckEntries([]);
    setShowAddCheck(true);
    setCheckLoading(true);
    setEditingCheckId(null);

    try {
      const lastCheck = activeChecks.length > 0 ? activeChecks[activeChecks.length - 1] : null;
      const fromDate = lastCheck ? lastCheck.checkDate : activePeriod.startDate;

      const snap = await getDocs(
        query(
          collection(db, "orders"),
          where("status", "==", "pagado"),
          where("completedAt", ">=", Timestamp.fromDate(fromDate)),
          where("completedAt", "<=", Timestamp.fromDate(now))
        )
      );

      const productNamesInPeriod = activePeriod.products.map(p => p.productName);

      const soldMap = new Map<string, number>();
      snap.forEach((d) => {
        const items: OrderItem[] = d.data().items ?? [];
        items.forEach((item) => {
          if (!item.isDeleted) {
            let name = item.productName;
            let qty = item.quantity || 1;

            // Extraer mezcladores de las notas (ej: "Servicios: 2x Coca Cola")
            if (item.notes) {
              const MIXER_NAMES = ['Agua Mineral', 'Coca Cola', 'Squirt', 'Manzanita', 'Sprite'];
              MIXER_NAMES.forEach(mixerName => {
                const regex = new RegExp(`(\\d+)x\\s+${mixerName}`, 'i');
                const match = item.notes?.match(regex);
                if (match) {
                  const mQty = parseInt(match[1], 10);
                  if (!isNaN(mQty)) {
                    soldMap.set(mixerName, (soldMap.get(mixerName) ?? 0) + mQty);
                  }
                }
              });
            }

            if (name.toLowerCase().includes("promo")) {
              qty = qty * 2;
              const baseName = name.replace(/ - Promo/i, "").replace(/ Promo/i, "").trim();
              const asBotella = `${baseName} - Botella`;
              
              if (productNamesInPeriod.includes(asBotella)) {
                name = asBotella;
              } else if (productNamesInPeriod.includes(baseName)) {
                name = baseName;
              } else {
                name = name.replace(/ - Promo/i, " - Botella");
              }
              soldMap.set(name, (soldMap.get(name) ?? 0) + qty);
            } else if (
              (item.category === 'Bebida' || item.category === 'Shot') &&
              (name.includes(' - Trago') || name.includes(' - Shot'))
            ) {
              // Cada trago descuenta 1/16 de la botella correspondiente
              const bottleName = name
                .replace(/ - Trago$/i, ' - Botella')
                .replace(/ - Shot$/i, ' - Botella');
              if (productNamesInPeriod.includes(bottleName)) {
                soldMap.set(bottleName, (soldMap.get(bottleName) ?? 0) + qty / 16);
              }
              // No agregar el trago mismo al mapa (no es botella)
            } else {
              soldMap.set(name, (soldMap.get(name) ?? 0) + qty);
            }
          }
        });
      });

      setCheckEntries(
        activePeriod.products.map((product) => {
          const sold = soldMap.get(product.productName) ?? 0;
          let prevQty: number | null = product.initialQty;
          if (lastCheck) {
            const prev = lastCheck.entries.find((e) => e.productName === product.productName);
            prevQty = prev?.confirmedQty ?? prev?.systemQty ?? product.initialQty;
          }
          const systemQty = prevQty !== null ? Math.max(0, prevQty - sold) : null;
          return { productName: product.productName, systemQty, confirmedQty: null, prevQty };
        })
      );
    } catch (err) {
      console.error(err);
      setCheckEntries(activePeriod.products.map((p) => ({ productName: p.productName, systemQty: null, confirmedQty: null, prevQty: p.initialQty })));
    } finally {
      setCheckLoading(false);
    }
  };

  const openEditCheck = async (check: InventoryCheck, checkIndex: number, period: InventoryPeriod) => {
    setEditingCheckId(check.id);
    setCheckLabel(check.label);
    setCheckDate(toLocalDatetime(check.checkDate));
    setShowAddCheck(true);
    setCheckLoading(true);

    try {
      const pChecks = checks
        .filter((c) => c.periodId === period.id)
        .sort((a, b) => a.checkDate.getTime() - b.checkDate.getTime());
      
      const prevCheck = checkIndex > 0 ? pChecks[checkIndex - 1] : null;
      const fromDate = prevCheck ? prevCheck.checkDate : period.startDate;
      const toDate = check.checkDate;

      const snap = await getDocs(
        query(
          collection(db, "orders"),
          where("status", "==", "pagado"),
          where("completedAt", ">=", Timestamp.fromDate(fromDate)),
          where("completedAt", "<=", Timestamp.fromDate(toDate))
        )
      );

      const productNamesInPeriod = period.products.map(p => p.productName);
      const soldMap = new Map<string, number>();
      snap.forEach((d) => {
        const items: OrderItem[] = d.data().items ?? [];
        items.forEach((item) => {
          if (!item.isDeleted) {
            let name = item.productName;
            let qty = item.quantity || 1;

            // Extraer mezcladores de las notas (ej: "Servicios: 2x Coca Cola")
            if (item.notes) {
              const MIXER_NAMES = ['Agua Mineral', 'Coca Cola', 'Squirt', 'Manzanita', 'Sprite'];
              MIXER_NAMES.forEach(mixerName => {
                const regex = new RegExp(`(\\d+)x\\s+${mixerName}`, 'i');
                const match = item.notes?.match(regex);
                if (match) {
                  const mQty = parseInt(match[1], 10);
                  if (!isNaN(mQty)) {
                    soldMap.set(mixerName, (soldMap.get(mixerName) ?? 0) + mQty);
                  }
                }
              });
            }

            if (name.toLowerCase().includes("promo")) {
              qty = qty * 2;
              const baseName = name.replace(/ - Promo/i, "").replace(/ Promo/i, "").trim();
              const asBotella = `${baseName} - Botella`;
              if (productNamesInPeriod.includes(asBotella)) name = asBotella;
              else if (productNamesInPeriod.includes(baseName)) name = baseName;
              else name = name.replace(/ - Promo/i, " - Botella");
              soldMap.set(name, (soldMap.get(name) ?? 0) + qty);
            } else if (
              (item.category === 'Bebida' || item.category === 'Shot') &&
              (name.includes(' - Trago') || name.includes(' - Shot'))
            ) {
              // Cada trago descuenta 1/16 de la botella correspondiente
              const bottleName = name
                .replace(/ - Trago$/i, ' - Botella')
                .replace(/ - Shot$/i, ' - Botella');
              if (productNamesInPeriod.includes(bottleName)) {
                soldMap.set(bottleName, (soldMap.get(bottleName) ?? 0) + qty / 16);
              }
              // No agregar el trago mismo al mapa
            } else {
              soldMap.set(name, (soldMap.get(name) ?? 0) + qty);
            }
          }
        });
      });

      setCheckEntries(
        period.products.map((product) => {
          const sold = soldMap.get(product.productName) ?? 0;
          let prevQty: number | null = product.initialQty;
          if (prevCheck) {
            const prev = prevCheck.entries.find((e) => e.productName === product.productName);
            prevQty = prev?.confirmedQty ?? prev?.systemQty ?? product.initialQty;
          }
          const systemQty = prevQty !== null ? Math.max(0, prevQty - sold) : null;
          
          const currentEntry = check.entries.find(e => e.productName === product.productName);
          
          return { 
            productName: product.productName, 
            systemQty: currentEntry?.systemQty ?? systemQty, 
            confirmedQty: currentEntry?.confirmedQty ?? null,
            prevQty 
          };
        })
      );
    } catch (err) {
      console.error(err);
      setCheckEntries(check.entries.map(e => ({ ...e, prevQty: null })));
    } finally {
      setCheckLoading(false);
    }
  };

  const saveCheck = async () => {
    if (!editingCheckId && !activePeriod) return;
    if (!checkLabel.trim()) { toast.error("Ponle una etiqueta al conteo"); return; }
    setCheckSaving(true);
    try {
      if (editingCheckId) {
        await updateDoc(doc(db, "inventoryChecks", editingCheckId), {
          label: checkLabel.trim(),
          checkDate: Timestamp.fromDate(new Date(checkDate)),
          entries: checkEntries,
        });
        toast.success("Conteo actualizado");
      } else {
        await addDoc(collection(db, "inventoryChecks"), {
          periodId: activePeriod!.id,
          section: mainSection,
          subsection: subsectionKey,
          label: checkLabel.trim(),
          checkDate: Timestamp.fromDate(new Date(checkDate)),
          entries: checkEntries,
        });
        toast.success("Conteo guardado");
      }
      setShowAddCheck(false);
      await loadData();
    } catch (err: any) {
      toast.error(err?.message ?? "Error al guardar");
    } finally {
      setCheckSaving(false);
    }
  };

  const updateCheckEntry = (productName: string, value: string) => {
    const num = value === "" ? null : parseFloat(value);
    setCheckEntries((prev) => prev.map((e) => e.productName === productName ? { ...e, confirmedQty: num } : e));
  };

  const confirmAllSystem = () =>
    setCheckEntries((prev) => prev.map((e) => ({ ...e, confirmedQty: e.systemQty ?? e.confirmedQty })));

  // ─── Navegación por teclado en filas de "Nuevo Período" (flechas, Enter, Tab) ──
  const npQtyInputRefs = React.useRef<(HTMLInputElement | null)[]>([]);

  const focusNpQtyInput = (index: number) => {
    const el = npQtyInputRefs.current[index];
    if (el) {
      el.focus();
      el.select();
    }
  };

  const handleNpQtyKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, idx: number) => {
    if (e.key === "ArrowDown" || e.key === "Enter") {
      e.preventDefault();
      focusNpQtyInput(idx + 1);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      focusNpQtyInput(idx - 1);
    } else if (e.key === "Tab") {
      e.preventDefault();
      focusNpQtyInput(e.shiftKey ? idx - 1 : idx + 1);
    }
  };

  // ─── Navegación por teclado en el conteo (flechas, Enter, Tab) ─────────────────
  const checkInputRefs = React.useRef<(HTMLInputElement | null)[]>([]);

  const focusCheckInput = (index: number) => {
    const el = checkInputRefs.current[index];
    if (el) {
      el.focus();
      el.select();
    }
  };

  const handleCheckInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, idx: number) => {
    if (e.key === "ArrowDown" || e.key === "Enter") {
      e.preventDefault();
      focusCheckInput(idx + 1);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      focusCheckInput(idx - 1);
    } else if (e.key === "Tab") {
      // Salta directo al siguiente/anterior input de cantidad, sin detenerse en los botones +/-
      e.preventDefault();
      focusCheckInput(e.shiftKey ? idx - 1 : idx + 1);
    }
  };

  // ─── Render ──────────────────────────────────────────────────────────────────

  const allowedCategories = SUBSECTION_CATALOG_CATEGORIES[subsectionKey] ?? null;
  const filteredCatalog = catalogProducts.filter((p) => {
    if (allowedCategories && !allowedCategories.includes(p.category)) return false;
    return npSearch === "" || p.name.toLowerCase().includes(npSearch.toLowerCase());
  });

  return (
    <div className="p-4 md:p-6 max-w-full">
      {/* Header */}
      <div className="mb-5">
        <h1 className="text-3xl font-bold mb-1 flex items-center gap-2">
          <Archive className="text-red-500" />
          Inventario
        </h1>
        <p className="text-gray-400 text-sm">
          Registra períodos, añade conteos diarios y detecta diferencias
        </p>
      </div>

      {/* Main section tabs */}
      <div className="flex gap-1 mb-4 bg-gray-900 rounded-xl p-1 w-fit border border-gray-800">
        {(["barra", "bodega"] as MainSection[]).map((s) => (
          <button
            key={s}
            onClick={() => handleMainSection(s)}
            className={`px-8 py-2.5 rounded-lg text-sm font-bold uppercase tracking-wide transition-all ${
              mainSection === s ? "bg-red-600 text-white shadow-lg" : "text-gray-400 hover:text-gray-200"
            }`}
          >
            {s === "barra" ? "🍸 Barra" : "📦 Bodega"}
          </button>
        ))}
      </div>

      {/* Subsection tabs */}
      <div className="flex gap-1 mb-6 border-b border-gray-800 pb-0">
        {SUBSECTIONS[mainSection].map((sub) => (
          <button
            key={sub.key}
            onClick={() => setSubsectionKey(sub.key)}
            className={`flex items-center gap-1.5 px-5 py-2.5 text-sm font-semibold border-b-2 transition-colors -mb-px ${
              subsectionKey === sub.key
                ? "border-red-500 text-red-400"
                : "border-transparent text-gray-400 hover:text-gray-200"
            }`}
          >
            <span>{sub.icon}</span>
            {sub.label}
          </button>
        ))}
      </div>

      {/* Content */}
      {loadingData ? (
        <div className="flex items-center justify-center py-16 text-gray-400 gap-3">
          <Loader2 className="animate-spin" size={24} /> Cargando...
        </div>
      ) : (
        <>
          {activePeriod ? (
            <div className="mb-8">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
                <div>
                  <h2 className="text-xl font-bold text-white">{activePeriod.name}</h2>
                  <p className="text-gray-400 text-sm">
                    Desde{" "}
                    {activePeriod.startDate.toLocaleDateString("es-MX", {
                      weekday: "long", day: "2-digit", month: "long", hour: "2-digit", minute: "2-digit",
                    })}
                    {" • "}{activeChecks.length} conteo{activeChecks.length !== 1 ? "s" : ""}
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={openAddCheck}
                    className="flex items-center gap-2 px-4 py-2.5 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-lg transition-colors text-sm"
                  >
                    <Plus size={16} /> Agregar Conteo del Día
                  </button>
                  <button
                    onClick={openEditPeriod}
                    className="flex items-center gap-2 px-4 py-2.5 bg-gray-700 hover:bg-gray-600 text-gray-300 font-medium rounded-lg transition-colors text-sm"
                  >
                    Editar Período
                  </button>
                  <button
                    onClick={openNewPeriod}
                    className="flex items-center gap-2 px-4 py-2.5 bg-gray-700 hover:bg-gray-600 text-gray-300 font-medium rounded-lg transition-colors text-sm"
                  >
                    Nuevo Período
                  </button>
                </div>
              </div>

              <SpreadsheetTable period={activePeriod} periodChecks={activeChecks} onEditCheck={openEditCheck} />

              {activeChecks.length === 0 && (
                <p className="text-center py-6 text-gray-500 text-sm">
                  Aún no hay conteos — presiona "Agregar Conteo del Día"
                </p>
              )}
            </div>
          ) : (
            <div className="text-center py-16">
              <Archive size={48} className="mx-auto mb-4 text-gray-700" />
              <p className="text-gray-400 mb-2">
                No hay período activo para{" "}
                <span className="text-white font-semibold">
                  {mainSection === "barra" ? "Barra" : "Bodega"} › {currentSubInfo?.label}
                </span>
              </p>
              <p className="text-gray-500 text-sm mb-6">Crea uno para empezar a trackear el inventario</p>
              <button
                onClick={openNewPeriod}
                className="flex items-center gap-2 px-6 py-3 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-xl transition-colors mx-auto"
              >
                <Plus size={18} /> Crear Nuevo Período
              </button>
            </div>
          )}

          {/* Past periods */}
          {pastPeriods.length > 0 && (
            <div>
              <h3 className="text-gray-400 text-xs font-semibold uppercase tracking-wide mb-3 flex items-center gap-2">
                <ClipboardList size={13} /> Períodos anteriores
              </h3>
              <div className="space-y-2">
                {pastPeriods.map((period) => {
                  const pChecks = checks
                    .filter((c) => c.periodId === period.id)
                    .sort((a, b) => a.checkDate.getTime() - b.checkDate.getTime());
                  const isExpanded = expandedPast === period.id;
                  return (
                    <div key={period.id} className="bg-gray-800/60 rounded-xl border border-gray-700 overflow-hidden">
                      <button
                        onClick={() => setExpandedPast(isExpanded ? null : period.id)}
                        className="w-full flex items-center justify-between p-4 text-left hover:bg-gray-800/80 transition-colors"
                      >
                        <div>
                          <span className="text-white font-medium">{period.name}</span>
                          <span className="text-gray-500 text-sm ml-3">
                            {fmtDate(period.startDate)} • {pChecks.length} conteos
                          </span>
                        </div>
                        {isExpanded ? <ChevronUp size={16} className="text-gray-400" /> : <ChevronDown size={16} className="text-gray-400" />}
                      </button>
                      {isExpanded && (
                        <div className="p-4 bg-gray-900/30">
                        <SpreadsheetTable period={period} periodChecks={pChecks} onEditCheck={openEditCheck} />
                      </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </>
      )}

      {/* ── MODAL: Nuevo Período ──────────────────────────────────────────────── */}
      {showNewPeriod && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-gray-900 rounded-2xl border border-gray-700 w-full max-w-5xl my-auto">
            <div className="flex items-center justify-between p-5 border-b border-gray-700">
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                {!isEditingPeriod && <Plus size={20} className="text-red-500" />}
                {isEditingPeriod ? "Editar Período" : "Nuevo Período"} —{" "}
                <span className="text-red-400">
                  {mainSection === "barra" ? "Barra" : "Bodega"} › {currentSubInfo?.icon} {currentSubInfo?.label}
                </span>
              </h2>
              <button onClick={() => setShowNewPeriod(false)} className="text-gray-400 hover:text-white">
                <X size={22} />
              </button>
            </div>

            <div className="p-5 space-y-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-semibold text-gray-400 uppercase mb-1.5 block">Nombre del período</label>
                  <input
                    value={npName}
                    onChange={(e) => setNpName(e.target.value)}
                    placeholder="Ej: Semana del 19 Mayo"
                    className="bg-gray-800 text-white rounded-lg px-4 py-2 border border-gray-600 focus:border-red-500 focus:outline-none w-full text-sm"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-400 uppercase mb-1.5 block">Fecha y hora de inicio</label>
                  <input
                    type="datetime-local"
                    value={npDate}
                    onChange={(e) => setNpDate(e.target.value)}
                    className="bg-gray-800 text-white rounded-lg px-4 py-2 border border-gray-600 focus:border-red-500 focus:outline-none w-full text-sm"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                {/* Product rows */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-xs font-semibold text-gray-400 uppercase">
                      Productos ({npRows.filter((r) => r.productName).length})
                    </label>
                    <button
                      onClick={() => setNpRows((prev) => [...prev, { productName: "", unit: "pz", initialQty: 0 }])}
                      className="flex items-center gap-1 text-xs text-red-400 hover:text-red-300"
                    >
                      <Plus size={13} /> Agregar fila
                    </button>
                  </div>
                  <div className="text-xs text-gray-600 mb-1 flex gap-2 px-1">
                    <span className="flex-1">Nombre del producto</span>
                    <span className="w-16 text-center">Unidad</span>
                    <span className="w-20 text-right">Cantidad</span>
                    <span className="w-12" />
                  </div>
                  <div className="space-y-1.5 max-h-80 overflow-y-auto pr-1">
                    {npRows.map((row, i) => (
                      <div key={i} className="flex gap-2 items-center">
                        <input
                          value={row.productName}
                          onChange={(e) =>
                            setNpRows((prev) => prev.map((r, idx) => idx === i ? { ...r, productName: e.target.value } : r))
                          }
                          placeholder="Nombre del producto"
                          className="bg-gray-800 text-white rounded-lg px-3 py-1.5 border border-gray-700 focus:border-red-500 focus:outline-none flex-1 text-sm"
                        />
                        <input
                          value={row.unit}
                          onChange={(e) =>
                            setNpRows((prev) => prev.map((r, idx) => idx === i ? { ...r, unit: e.target.value } : r))
                          }
                          placeholder="pz"
                          className="bg-gray-800 text-white rounded-lg px-2 py-1.5 border border-gray-700 focus:border-red-500 focus:outline-none w-16 text-sm text-center"
                        />
                        <input
                          ref={(el) => { npQtyInputRefs.current[i] = el; }}
                          type="number"
                          min={0}
                          step={0.5}
                          value={row.initialQty || ""}
                          placeholder="0"
                          onChange={(e) =>
                            setNpRows((prev) => prev.map((r, idx) => idx === i ? { ...r, initialQty: parseFloat(e.target.value) || 0 } : r))
                          }
                          onKeyDown={(e) => handleNpQtyKeyDown(e, i)}
                          onFocus={(e) => e.target.select()}
                          className="bg-gray-800 text-white rounded-lg px-2 py-1.5 border border-gray-700 focus:border-red-500 focus:outline-none w-20 text-sm text-right"
                        />
                        <div className="flex flex-col items-center justify-center gap-0.5 ml-1">
                          <button
                            onClick={() => setNpRows(prev => { if (i === 0) return prev; const r = [...prev]; [r[i-1], r[i]] = [r[i], r[i-1]]; return r; })}
                            disabled={i === 0}
                            className="text-gray-500 hover:text-white disabled:opacity-30 transition-colors leading-none"
                            title="Subir"
                          >
                            <ChevronUp size={14} />
                          </button>
                          <button
                            onClick={() => setNpRows(prev => { if (i === prev.length - 1) return prev; const r = [...prev]; [r[i], r[i+1]] = [r[i+1], r[i]]; return r; })}
                            disabled={i === npRows.length - 1}
                            className="text-gray-500 hover:text-white disabled:opacity-30 transition-colors leading-none"
                            title="Bajar"
                          >
                            <ChevronDown size={14} />
                          </button>
                        </div>
                        <button
                          onClick={() => setNpRows((prev) => prev.filter((_, idx) => idx !== i))}
                          className="text-gray-600 hover:text-red-400 transition-colors flex-shrink-0 ml-1"
                          title="Eliminar"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Catalog picker */}
                <div>
                  <label className="text-xs font-semibold text-gray-400 uppercase mb-2 block">
                    Agregar desde catálogo de productos
                  </label>
                  <input
                    value={npSearch}
                    onChange={(e) => setNpSearch(e.target.value)}
                    placeholder="Buscar producto del menú..."
                    className="bg-gray-800 text-white rounded-lg px-3 py-1.5 border border-gray-700 focus:border-red-500 focus:outline-none w-full text-sm mb-2"
                  />
                  <div className="max-h-72 overflow-y-auto space-y-1">
                    {filteredCatalog.slice(0, 40).map((p) => {
                      const added = npRows.some((r) => r.productName === p.name);
                      return (
                        <button
                          key={p.id}
                          onClick={() => addCatalogProduct(p)}
                          disabled={added}
                          className={`w-full text-left px-3 py-1.5 rounded-lg text-sm transition-colors flex items-center justify-between ${
                            added ? "bg-green-500/10 text-green-400 cursor-default" : "bg-gray-800 text-gray-300 hover:bg-gray-700"
                          }`}
                        >
                          <span>{p.name}</span>
                          <span className="text-xs text-gray-500">{added ? <Check size={14} /> : p.category}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-3 p-5 border-t border-gray-700">
              <button onClick={() => setShowNewPeriod(false)} className="px-5 py-2 text-gray-400 hover:text-white text-sm">
                Cancelar
              </button>
              <button
                onClick={saveNewPeriod}
                disabled={npSaving}
                className="flex items-center gap-2 px-6 py-2.5 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white font-semibold rounded-lg transition-colors text-sm"
              >
                {npSaving ? <Loader2 size={15} className="animate-spin" /> : <Archive size={15} />}
                {isEditingPeriod ? "Guardar Cambios" : "Crear Período"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL: Agregar Conteo ─────────────────────────────────────────────── */}
      {showAddCheck && (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/70 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-gray-900 rounded-2xl border border-gray-700 w-full max-w-2xl my-4">
            <div className="flex items-center justify-between p-5 border-b border-gray-700">
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                <Calendar size={20} className="text-red-500" />
                {editingCheckId ? "Editar Conteo" : "Conteo del Día"}
                <span className="text-sm text-gray-400 font-normal ml-1">
                  — {currentSubInfo?.icon} {currentSubInfo?.label}
                </span>
              </h2>
              <button onClick={() => setShowAddCheck(false)} className="text-gray-400 hover:text-white">
                <X size={22} />
              </button>
            </div>

            <div className="p-5 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-semibold text-gray-400 uppercase mb-1.5 block">Etiqueta</label>
                  <input
                    value={checkLabel}
                    onChange={(e) => setCheckLabel(e.target.value)}
                    placeholder="Ej: Jueves, Viernes..."
                    className="bg-gray-800 text-white rounded-lg px-3 py-2 border border-gray-600 focus:border-red-500 focus:outline-none w-full text-sm"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-400 uppercase mb-1.5 block">Fecha / hora del conteo</label>
                  <input
                    type="datetime-local"
                    value={checkDate}
                    onChange={(e) => setCheckDate(e.target.value)}
                    className="bg-gray-800 text-white rounded-lg px-3 py-2 border border-gray-600 focus:border-red-500 focus:outline-none w-full text-sm"
                  />
                </div>
              </div>

              {checkLoading ? (
                <div className="flex items-center justify-center py-10 text-gray-400 gap-3">
                  <Loader2 className="animate-spin" size={22} />
                  Calculando cantidades esperadas...
                </div>
              ) : (
                <>
                  {checkEntries.some((e) => e.systemQty !== null) && (
                    <div className="flex items-center justify-between bg-blue-500/10 border border-blue-500/20 rounded-xl px-4 py-3 text-sm">
                      <span className="flex items-center gap-2 text-blue-300">
                        <AlertTriangle size={15} />
                        El sistema calculó lo esperado basado en ventas. Confirma o corrige.
                      </span>
                      <button
                        onClick={confirmAllSystem}
                        className="ml-3 flex-shrink-0 flex items-center gap-1 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg"
                      >
                        <CheckCircle size={13} /> Confirmar todos
                      </button>
                    </div>
                  )}

                  <div className="overflow-hidden rounded-xl border border-gray-700">
                    <div className="grid grid-cols-12 bg-gray-800/60 px-4 py-2 text-xs font-semibold text-gray-400 uppercase">
                      <span className="col-span-4">Producto</span>
                      <span className="col-span-2 text-center">Anterior</span>
                      <span className="col-span-2 text-center">Esperado</span>
                      <span className="col-span-4 text-center">Conteo Real</span>
                    </div>
                    <div className="divide-y divide-gray-800/50 max-h-96 overflow-y-auto">
                      {checkEntries.map((entry, idx) => {
                        const product = activePeriod?.products.find((p) => p.productName === entry.productName);
                        const isMixer = subsectionKey === "refrescos" || subsectionKey === "refresco";
                        const hasDisc = !isMixer && entry.systemQty !== null && entry.confirmedQty !== null && Math.abs(entry.confirmedQty - entry.systemQty) > 0.01;
                        const isShort = hasDisc && entry.confirmedQty! < entry.systemQty!;

                        return (
                          <div
                            key={idx}
                            className={`grid grid-cols-12 items-center px-4 py-2.5 ${
                              hasDisc ? (isShort ? "bg-red-500/5" : "bg-green-500/5") : "hover:bg-gray-800/30"
                            }`}
                          >
                            <div className="col-span-4">
                              <p className="text-white text-sm font-medium truncate">{entry.productName}</p>
                              {product && <p className="text-gray-500 text-xs">{product.unit}</p>}
                            </div>
                            <div className="col-span-2 text-center text-gray-400 font-medium">
                              {fmtNum(entry.prevQty ?? null)}
                            </div>
                            <div className="col-span-2 text-center">
                              {entry.systemQty !== null ? (
                                <div className="flex items-center justify-center gap-2">
                                  <span className="text-gray-300 font-semibold">{fmtNum(entry.systemQty)}</span>
                                  <button
                                    onClick={() => updateCheckEntry(entry.productName, String(entry.systemQty))}
                                    className="text-gray-500 hover:text-green-400 transition-colors"
                                    title="Confirmar"
                                  >
                                    <Check size={14} />
                                  </button>
                                </div>
                              ) : (
                                <span className="text-gray-600 text-xs">sin ventas</span>
                              )}
                            </div>
                            <div className="col-span-4 flex items-center justify-center gap-2">
                              <button
                                onClick={() => updateCheckEntry(entry.productName, String(Math.max(0, (entry.confirmedQty ?? 0) - 0.5)))}
                                className="text-gray-600 hover:text-red-400 transition-colors"
                              >
                                <Minus size={14} />
                              </button>
                              <input
                                ref={(el) => { checkInputRefs.current[idx] = el; }}
                                type="number"
                                min={0}
                                step={0.5}
                                value={entry.confirmedQty ?? ""}
                                placeholder={entry.systemQty !== null ? fmtNum(entry.systemQty) : "0"}
                                onChange={(e) => updateCheckEntry(entry.productName, e.target.value)}
                                onKeyDown={(e) => handleCheckInputKeyDown(e, idx)}
                                onFocus={(e) => e.target.select()}
                                className={`w-20 text-center rounded-lg px-2 py-1.5 border text-sm font-semibold focus:outline-none ${
                                  hasDisc
                                    ? isShort
                                      ? "bg-red-500/10 border-red-500/40 text-red-300"
                                      : "bg-green-500/10 border-green-500/40 text-green-300"
                                    : "bg-gray-800 border-gray-600 text-white"
                                } focus:border-red-500`}
                              />
                              <button
                                onClick={() => updateCheckEntry(entry.productName, String((entry.confirmedQty ?? 0) + 0.5))}
                                className="text-gray-600 hover:text-green-400 transition-colors"
                              >
                                <Plus size={14} />
                              </button>
                              {!isMixer && <DiscBadge sys={entry.systemQty} real={entry.confirmedQty} />}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </>
              )}
            </div>

            <div className="flex justify-end gap-3 p-5 border-t border-gray-700">
              <button onClick={() => setShowAddCheck(false)} className="px-5 py-2 text-gray-400 hover:text-white text-sm">
                Cancelar
              </button>
              <button
                onClick={saveCheck}
                disabled={checkSaving || checkLoading}
                className="flex items-center gap-2 px-6 py-2.5 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white font-semibold rounded-lg transition-colors text-sm"
              >
                {checkSaving ? <Loader2 size={15} className="animate-spin" /> : <CheckCircle size={15} />}
                Guardar Conteo
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Inventory;
