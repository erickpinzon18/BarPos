import React, { useState, useEffect, useMemo } from "react";
import { collection, getDocs, orderBy, query } from "firebase/firestore";
import { db } from "../../services/firebase";
import {
  AlertTriangle,
  CheckCircle,
  Clock,
  TrendingDown,
  Package,
  Activity,
  Calendar,
  BarChart3,
  Loader2,
} from "lucide-react";

type MainSection = "barra" | "bodega";

const SUBSECTIONS: Record<MainSection, { key: string; label: string; icon: string }[]> = {
  barra: [
    { key: "botellas", label: "Botellas", icon: "🍾" },
    { key: "refrescos", label: "Refrescos", icon: "🥤" },
    { key: "cerveza", label: "Cerveza", icon: "🍺" },
  ],
  bodega: [
    { key: "cerveza", label: "Cerveza", icon: "🍺" },
    { key: "refresco", label: "Refresco", icon: "🥤" },
    { key: "botellas_extra", label: "Botellas extra", icon: "🍾" },
  ],
};

// Opening days: Thu=4, Sat=6, Sun=0
const OPENING_DAYS = [0, 4, 6];

interface PeriodProduct {
  productName: string;
  unit: string;
  initialQty: number;
}

interface CheckEntry {
  productName: string;
  systemQty: number | null;
  confirmedQty: number | null;
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
  active: boolean;
  products: PeriodProduct[];
}

interface ProductStats {
  productName: string;
  unit: string;
  initialQty: number;
  currentStock: number;
  totalConsumed: number;
  avgPerSession: number;
  sessionsRemaining: number;
  estimatedRunOutDate: Date | null;
  consumptions: { date: Date; amount: number; label: string }[];
  stockHistory: { date: Date; qty: number }[];
}

function getRunOutDate(sessionsAhead: number): Date | null {
  if (!isFinite(sessionsAhead) || sessionsAhead <= 0) return null;
  const count = Math.ceil(sessionsAhead);
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  let found = 0;
  for (let i = 0; i < 200; i++) {
    d.setDate(d.getDate() + 1);
    if (OPENING_DAYS.includes(d.getDay())) {
      found++;
      if (found >= count) return new Date(d);
    }
  }
  return null;
}

function computeStats(period: InventoryPeriod, checks: InventoryCheck[]): ProductStats[] {
  const periodChecks = checks
    .filter((c) => c.periodId === period.id)
    .sort((a, b) => a.checkDate.getTime() - b.checkDate.getTime());

  return period.products.map((product) => {
    const stockHistory: { date: Date; qty: number }[] = [
      { date: period.startDate, qty: product.initialQty },
    ];
    const consumptions: { date: Date; amount: number; label: string }[] = [];
    let prevQty = product.initialQty;

    for (const check of periodChecks) {
      const entry = check.entries.find((e) => e.productName === product.productName);
      if (!entry) continue;
      const qty = entry.confirmedQty ?? entry.systemQty;
      if (qty === null) continue;
      const consumed = prevQty - qty;
      consumptions.push({ date: check.checkDate, amount: Math.max(0, consumed), label: check.label });
      stockHistory.push({ date: check.checkDate, qty });
      prevQty = qty;
    }

    const currentStock = stockHistory[stockHistory.length - 1].qty;
    const validConsumptions = consumptions.filter((c) => c.amount > 0);
    const totalConsumed = validConsumptions.reduce((s, c) => s + c.amount, 0);
    const avgPerSession =
      validConsumptions.length > 0 ? totalConsumed / validConsumptions.length : 0;
    const sessionsRemaining = avgPerSession > 0 ? currentStock / avgPerSession : Infinity;
    const estimatedRunOutDate = getRunOutDate(sessionsRemaining);

    return {
      productName: product.productName,
      unit: product.unit,
      initialQty: product.initialQty,
      currentStock,
      totalConsumed,
      avgPerSession,
      sessionsRemaining,
      estimatedRunOutDate,
      consumptions,
      stockHistory,
    };
  });
}

function alertLevel(sessions: number): "critical" | "warning" | "ok" | "none" {
  if (!isFinite(sessions)) return "none";
  if (sessions <= 1) return "critical";
  if (sessions <= 2.5) return "warning";
  return "ok";
}

const fmtDate = (d: Date) =>
  d.toLocaleDateString("es-MX", { weekday: "short", day: "2-digit", month: "short" });

const fmtNum = (n: number) => (n % 1 === 0 ? String(n) : n.toFixed(1));

const Sparkline: React.FC<{ data: { qty: number }[]; width?: number; height?: number }> = ({
  data,
  width = 120,
  height = 28,
}) => {
  if (data.length < 2) return null;
  const min = Math.min(...data.map((d) => d.qty));
  const max = Math.max(...data.map((d) => d.qty));
  const range = max - min || 1;
  const pad = 3;
  const w = width - pad * 2;
  const h = height - pad * 2;

  const points = data.map((d, i) => {
    const x = pad + (i / (data.length - 1)) * w;
    const y = pad + h - ((d.qty - min) / range) * h;
    return { x, y };
  });

  const polyline = points.map((p) => `${p.x},${p.y}`).join(" ");
  const lastY = points[points.length - 1].y;
  const firstY = points[0].y;
  const color = lastY > firstY ? "#f87171" : "#4ade80";

  return (
    <svg width={width} height={height}>
      <polyline
        points={polyline}
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity={0.8}
      />
      {points.map((p, i) => (
        <circle
          key={i}
          cx={p.x}
          cy={p.y}
          r={i === points.length - 1 ? 3 : 1.5}
          fill={color}
        />
      ))}
    </svg>
  );
};

const HBar: React.FC<{ value: number; max: number; colorClass?: string }> = ({
  value,
  max,
  colorClass = "bg-purple-500",
}) => {
  const pct = max > 0 ? Math.min((value / max) * 100, 100) : 0;
  return (
    <div className="h-2 rounded-full bg-gray-700/80 overflow-hidden">
      <div className={`h-full rounded-full transition-all ${colorClass}`} style={{ width: `${pct}%` }} />
    </div>
  );
};

const InventoryStats: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [periods, setPeriods] = useState<InventoryPeriod[]>([]);
  const [checks, setChecks] = useState<InventoryCheck[]>([]);
  const [mainSection, setMainSection] = useState<MainSection>("barra");
  const [subsectionKey, setSubsectionKey] = useState<string>("botellas");

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const [pSnap, cSnap] = await Promise.all([
          getDocs(query(collection(db, "inventoryPeriods"), orderBy("startDate", "desc"))),
          getDocs(query(collection(db, "inventoryChecks"), orderBy("checkDate", "asc"))),
        ]);
        setPeriods(
          pSnap.docs.map((d) => ({
            id: d.id,
            section: d.data().section,
            subsection: d.data().subsection ?? "",
            name: d.data().name,
            startDate: d.data().startDate.toDate(),
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
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, []);

  const handleMainSection = (s: MainSection) => {
    setMainSection(s);
    setSubsectionKey(SUBSECTIONS[s][0].key);
  };

  const activePeriod = useMemo(
    () =>
      periods.find(
        (p) => p.section === mainSection && p.subsection === subsectionKey && p.active
      ) ?? null,
    [periods, mainSection, subsectionKey]
  );

  const stats = useMemo(
    () => (activePeriod ? computeStats(activePeriod, checks) : []),
    [activePeriod, checks]
  );

  const sortedByRisk = useMemo(
    () =>
      [...stats]
        .filter((s) => isFinite(s.sessionsRemaining))
        .sort((a, b) => a.sessionsRemaining - b.sessionsRemaining),
    [stats]
  );

  const topConsumed = useMemo(
    () =>
      [...stats]
        .filter((s) => s.avgPerSession > 0)
        .sort((a, b) => b.avgPerSession - a.avgPerSession)
        .slice(0, 10),
    [stats]
  );

  const maxAvg = topConsumed[0]?.avgPerSession ?? 1;

  const criticalCount = stats.filter((s) => alertLevel(s.sessionsRemaining) === "critical").length;
  const warningCount = stats.filter((s) => alertLevel(s.sessionsRemaining) === "warning").length;
  const periodChecksCount = checks.filter((c) => c.periodId === activePeriod?.id).length;
  const subsectionInfo = SUBSECTIONS[mainSection].find((s) => s.key === subsectionKey);

  return (
    <div className="space-y-6 pb-8">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="bg-purple-500/10 p-2.5 rounded-xl">
          <BarChart3 size={24} className="text-purple-400" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-white">Estadísticas de Inventario</h1>
          <p className="text-sm text-gray-400">
            Consumo, stock actual y predicciones · Abre Jue, Sáb y Dom
          </p>
        </div>
      </div>

      {/* Main section tabs */}
      <div className="flex gap-2">
        {(["barra", "bodega"] as MainSection[]).map((s) => (
          <button
            key={s}
            onClick={() => handleMainSection(s)}
            className={`px-5 py-2 rounded-lg text-sm font-semibold transition-colors ${
              mainSection === s
                ? "bg-purple-600 text-white"
                : "bg-gray-800 text-gray-400 hover:text-white"
            }`}
          >
            {s === "barra" ? "🍹 Barra" : "📦 Bodega"}
          </button>
        ))}
      </div>

      {/* Subsection tabs */}
      <div className="flex gap-2 flex-wrap border-b border-gray-800 pb-4">
        {SUBSECTIONS[mainSection].map((sub) => (
          <button
            key={sub.key}
            onClick={() => setSubsectionKey(sub.key)}
            className={`flex items-center gap-1.5 px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
              subsectionKey === sub.key
                ? "bg-purple-500/20 text-purple-300 border border-purple-500/40"
                : "text-gray-500 hover:text-gray-300"
            }`}
          >
            <span>{sub.icon}</span>
            <span>{sub.label}</span>
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <Loader2 size={32} className="animate-spin text-purple-400" />
        </div>
      ) : !activePeriod ? (
        <div className="flex flex-col items-center justify-center h-64 text-gray-500">
          <Package size={48} className="mb-4 opacity-40" />
          <p className="text-lg">No hay período activo para {subsectionInfo?.label}</p>
          <p className="text-sm mt-1">Crea un período en la sección de Inventario</p>
        </div>
      ) : (
        <>
          {/* Summary cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-gray-900 rounded-xl p-4 border border-gray-800 col-span-2 md:col-span-1">
              <p className="text-xs text-gray-500 mb-1">Período activo</p>
              <p className="text-sm font-semibold text-white truncate">{activePeriod.name}</p>
              <p className="text-xs text-gray-500 mt-1">Desde {fmtDate(activePeriod.startDate)}</p>
              <p className="text-xs text-gray-500">{stats.length} productos · {periodChecksCount} cortes</p>
            </div>

            <div
              className={`rounded-xl p-4 border ${
                criticalCount > 0
                  ? "bg-red-500/5 border-red-500/30"
                  : "bg-gray-900 border-gray-800"
              }`}
            >
              <p className="text-xs text-gray-500 mb-1">Críticos</p>
              <p
                className={`text-3xl font-bold ${
                  criticalCount > 0 ? "text-red-400" : "text-gray-600"
                }`}
              >
                {criticalCount}
              </p>
              <p className="text-xs text-gray-500 mt-1">≤ 1 sesión restante</p>
            </div>

            <div
              className={`rounded-xl p-4 border ${
                warningCount > 0
                  ? "bg-yellow-500/5 border-yellow-500/30"
                  : "bg-gray-900 border-gray-800"
              }`}
            >
              <p className="text-xs text-gray-500 mb-1">En alerta</p>
              <p
                className={`text-3xl font-bold ${
                  warningCount > 0 ? "text-yellow-400" : "text-gray-600"
                }`}
              >
                {warningCount}
              </p>
              <p className="text-xs text-gray-500 mt-1">1–2.5 sesiones restantes</p>
            </div>

            <div className="bg-gray-900 rounded-xl p-4 border border-gray-800">
              <p className="text-xs text-gray-500 mb-1">Más consumido</p>
              {topConsumed[0] ? (
                <>
                  <p className="text-sm font-semibold text-white truncate">
                    {topConsumed[0].productName}
                  </p>
                  <p className="text-xs text-purple-400 mt-1">
                    ~{fmtNum(topConsumed[0].avgPerSession)} {topConsumed[0].unit}/sesión
                  </p>
                </>
              ) : (
                <p className="text-sm text-gray-600">—</p>
              )}
            </div>
          </div>

          {/* Consumo promedio por sesión — bar chart */}
          {topConsumed.length > 0 && (
            <div className="bg-gray-900 rounded-xl p-5 border border-gray-800">
              <div className="flex items-center gap-2 mb-4">
                <Activity size={18} className="text-purple-400" />
                <h2 className="text-base font-semibold text-white">
                  Consumo promedio por sesión
                </h2>
              </div>
              <div className="space-y-3">
                {topConsumed.map((s) => (
                  <div key={s.productName}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm text-gray-300 truncate max-w-[55%]">
                        {s.productName}
                      </span>
                      <span className="text-sm font-semibold text-white">
                        {fmtNum(s.avgPerSession)}{" "}
                        <span className="text-gray-500 font-normal text-xs">{s.unit}</span>
                      </span>
                    </div>
                    <HBar value={s.avgPerSession} max={maxAvg} colorClass="bg-purple-500" />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Predictions table */}
          {sortedByRisk.length > 0 && (
            <div className="bg-gray-900 rounded-xl p-5 border border-gray-800">
              <div className="flex items-center gap-2 mb-1">
                <Calendar size={18} className="text-purple-400" />
                <h2 className="text-base font-semibold text-white">
                  Predicción de agotamiento
                </h2>
              </div>
              <p className="text-xs text-gray-500 mb-4 ml-6">
                Calculado sobre el consumo promedio histórico de este período. Una "sesión" = un
                jueves, sábado o domingo.
              </p>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left border-b border-gray-800">
                      <th className="pb-2 pr-4 text-xs text-gray-500 font-medium">Producto</th>
                      <th className="pb-2 px-3 text-xs text-gray-500 font-medium text-right">
                        Stock actual
                      </th>
                      <th className="pb-2 px-3 text-xs text-gray-500 font-medium text-right">
                        Prom/sesión
                      </th>
                      <th className="pb-2 px-3 text-xs text-gray-500 font-medium text-right">
                        Sesiones restantes
                      </th>
                      <th className="pb-2 pl-3 text-xs text-gray-500 font-medium text-right">
                        Se acaba aprox.
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedByRisk.map((s) => {
                      const level = alertLevel(s.sessionsRemaining);
                      return (
                        <tr
                          key={s.productName}
                          className="border-b border-gray-800/40 hover:bg-gray-800/20"
                        >
                          <td className="py-3 pr-4">
                            <div className="flex items-center gap-2">
                              {level === "critical" && (
                                <AlertTriangle size={14} className="text-red-400 flex-shrink-0" />
                              )}
                              {level === "warning" && (
                                <Clock size={14} className="text-yellow-400 flex-shrink-0" />
                              )}
                              {level === "ok" && (
                                <CheckCircle size={14} className="text-green-400 flex-shrink-0" />
                              )}
                              <span className="text-gray-200">{s.productName}</span>
                            </div>
                          </td>
                          <td className="py-3 px-3 text-right font-semibold text-white">
                            {fmtNum(s.currentStock)}{" "}
                            <span className="text-gray-500 font-normal text-xs">{s.unit}</span>
                          </td>
                          <td className="py-3 px-3 text-right text-gray-400">
                            {s.avgPerSession > 0 ? fmtNum(s.avgPerSession) : "—"}
                          </td>
                          <td className="py-3 px-3 text-right">
                            <span
                              className={`font-bold text-base ${
                                level === "critical"
                                  ? "text-red-400"
                                  : level === "warning"
                                  ? "text-yellow-400"
                                  : "text-green-400"
                              }`}
                            >
                              {fmtNum(s.sessionsRemaining)}
                            </span>
                          </td>
                          <td className="py-3 pl-3 text-right">
                            {s.estimatedRunOutDate ? (
                              <span
                                className={`text-sm font-medium ${
                                  level === "critical"
                                    ? "text-red-300"
                                    : level === "warning"
                                    ? "text-yellow-300"
                                    : "text-gray-300"
                                }`}
                              >
                                {fmtDate(s.estimatedRunOutDate)}
                              </span>
                            ) : (
                              <span className="text-gray-600 text-sm">sin datos</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Stock level progress bars */}
          <div className="bg-gray-900 rounded-xl p-5 border border-gray-800">
            <div className="flex items-center gap-2 mb-4">
              <TrendingDown size={18} className="text-purple-400" />
              <h2 className="text-base font-semibold text-white">Nivel de stock actual</h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {stats.map((s) => {
                const pct =
                  s.initialQty > 0
                    ? Math.min((s.currentStock / s.initialQty) * 100, 100)
                    : 0;
                const level = alertLevel(s.sessionsRemaining);
                const barColor =
                  level === "critical"
                    ? "bg-red-500"
                    : level === "warning"
                    ? "bg-yellow-500"
                    : "bg-green-500";
                return (
                  <div key={s.productName}>
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-1.5">
                        {level === "critical" && (
                          <AlertTriangle size={12} className="text-red-400 flex-shrink-0" />
                        )}
                        {level === "warning" && (
                          <Clock size={12} className="text-yellow-400 flex-shrink-0" />
                        )}
                        <span className="text-sm text-gray-300 truncate max-w-[180px]">
                          {s.productName}
                        </span>
                      </div>
                      <span className="text-xs text-gray-500">
                        {fmtNum(s.currentStock)}/{fmtNum(s.initialQty)} {s.unit}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-2.5 rounded-full bg-gray-700/80 overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${barColor}`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <span className="text-xs text-gray-500 w-9 text-right">
                        {pct.toFixed(0)}%
                      </span>
                    </div>
                    {s.stockHistory.length >= 2 && (
                      <div className="mt-1.5">
                        <Sparkline data={s.stockHistory} width={130} height={26} />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Consumption history per product */}
          {stats.some((s) => s.consumptions.length > 0) && (
            <div className="bg-gray-900 rounded-xl p-5 border border-gray-800">
              <div className="flex items-center gap-2 mb-4">
                <BarChart3 size={18} className="text-purple-400" />
                <h2 className="text-base font-semibold text-white">
                  Historial de consumo por corte
                </h2>
              </div>
              <div className="space-y-6">
                {stats
                  .filter((s) => s.consumptions.length > 0)
                  .sort((a, b) => b.totalConsumed - a.totalConsumed)
                  .map((s) => {
                    const maxC = Math.max(...s.consumptions.map((c) => c.amount));
                    return (
                      <div key={s.productName}>
                        <div className="flex items-center justify-between mb-2">
                          <p className="text-sm font-medium text-gray-200">
                            {s.productName}
                          </p>
                          <p className="text-xs text-gray-500">
                            Total: {fmtNum(s.totalConsumed)} {s.unit}
                          </p>
                        </div>
                        <div className="space-y-1.5">
                          {s.consumptions.map((c, i) => (
                            <div key={i} className="flex items-center gap-2">
                              <span className="text-xs text-gray-500 w-28 truncate flex-shrink-0">
                                {fmtDate(c.date)}
                              </span>
                              <div className="flex-1 h-2 rounded-full bg-gray-700/80 overflow-hidden">
                                <div
                                  className="h-full rounded-full bg-purple-500/60"
                                  style={{
                                    width: `${maxC > 0 ? (c.amount / maxC) * 100 : 0}%`,
                                  }}
                                />
                              </div>
                              <span className="text-xs text-gray-400 w-14 text-right flex-shrink-0">
                                {fmtNum(c.amount)} {s.unit}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default InventoryStats;
