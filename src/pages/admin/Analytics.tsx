import React, { useState, useEffect, useMemo } from "react";
import {
  collection,
  query,
  where,
  getDocs,
  Timestamp,
} from "firebase/firestore";
import { db } from "../../services/firebase";
import type { OrderItem } from "../../utils/types";
import { CATEGORIES, type CategoryKey } from "../../utils/categories";
import {
  BarChart3,
  Calendar,
  Filter,
  Package,
  Wine,
  TrendingUp,
  Users,
} from "lucide-react";

interface SaleRecord {
  date: Date;
  orderId: string;
  productName: string;
  category: CategoryKey;
  quantity: number;
  unitPrice: number;
  total: number;
  waiterName: string;
}

interface CategorySummary {
  category: CategoryKey;
  quantity: number;
  total: number;
  icon: string;
  color: string;
}

type DateFilterType = "week" | "month" | "day" | "range";

const Analytics: React.FC = () => {
  // State
  const [loading, setLoading] = useState(true);
  const [salesData, setSalesData] = useState<SaleRecord[]>([]);

  // Date filter state
  const [dateFilterType, setDateFilterType] = useState<DateFilterType>("week");
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [startDate, setStartDate] = useState<Date>(() => {
    const d = new Date();
    d.setDate(d.getDate() - 7);
    return d;
  });
  const [endDate, setEndDate] = useState<Date>(new Date());

  // Category filter
  const [selectedCategory, setSelectedCategory] = useState<string>("Todos");

  // Get date range based on filter type
  const getDateRange = (): { start: Date; end: Date } => {
    const now = new Date();

    switch (dateFilterType) {
      case "week": {
        // Get start of current week (Monday)
        const dayOfWeek = now.getDay();
        const diff = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
        const weekStart = new Date(now);
        weekStart.setDate(now.getDate() - diff);
        weekStart.setHours(0, 0, 0, 0);

        const weekEnd = new Date(now);
        weekEnd.setHours(23, 59, 59, 999);

        return { start: weekStart, end: weekEnd };
      }
      case "month": {
        const monthStart = new Date(
          selectedDate.getFullYear(),
          selectedDate.getMonth(),
          1
        );
        monthStart.setHours(0, 0, 0, 0);

        const monthEnd = new Date(
          selectedDate.getFullYear(),
          selectedDate.getMonth() + 1,
          0
        );
        monthEnd.setHours(23, 59, 59, 999);

        return { start: monthStart, end: monthEnd };
      }
      case "day": {
        const dayStart = new Date(selectedDate);
        dayStart.setHours(0, 0, 0, 0);

        const dayEnd = new Date(selectedDate);
        dayEnd.setHours(23, 59, 59, 999);

        return { start: dayStart, end: dayEnd };
      }
      case "range": {
        const rangeStart = new Date(startDate);
        rangeStart.setHours(0, 0, 0, 0);

        const rangeEnd = new Date(endDate);
        rangeEnd.setHours(23, 59, 59, 999);

        return { start: rangeStart, end: rangeEnd };
      }
      default:
        return { start: now, end: now };
    }
  };

  // Load sales data
  const loadSalesData = async () => {
    setLoading(true);
    try {
      const { start, end } = getDateRange();

      const q = query(
        collection(db, "orders"),
        where("status", "==", "pagado"),
        where("completedAt", ">=", Timestamp.fromDate(start)),
        where("completedAt", "<=", Timestamp.fromDate(end))
      );

      const snapshot = await getDocs(q);
      const records: SaleRecord[] = [];

      snapshot.forEach((doc) => {
        const data = doc.data();
        const completedAt = data.completedAt?.toDate() || new Date();
        const items: OrderItem[] = data.items || [];
        const waiterName = data.waiterName || "Desconocido";

        items.forEach((item) => {
          if (!item.isDeleted) {
            records.push({
              date: completedAt,
              orderId: doc.id,
              productName: item.productName,
              category: item.category as CategoryKey,
              quantity: item.quantity || 1,
              unitPrice: item.productPrice || 0,
              total: (item.productPrice || 0) * (item.quantity || 1),
              waiterName: waiterName,
            });
          }
        });
      });

      // Sort by date descending
      records.sort((a, b) => b.date.getTime() - a.date.getTime());
      setSalesData(records);
    } catch (error) {
      console.error("Error loading analytics data:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSalesData();
  }, [dateFilterType, selectedDate, startDate, endDate]);

  // Filtered data based on category
  const filteredData = useMemo(() => {
    if (selectedCategory === "Todos") {
      return salesData;
    }
    return salesData.filter((record) => record.category === selectedCategory);
  }, [salesData, selectedCategory]);

  // Category summaries
  const categorySummaries = useMemo((): CategorySummary[] => {
    const summaryMap = new Map<
      CategoryKey,
      { quantity: number; total: number }
    >();

    salesData.forEach((record) => {
      const existing = summaryMap.get(record.category) || {
        quantity: 0,
        total: 0,
      };
      summaryMap.set(record.category, {
        quantity: existing.quantity + record.quantity,
        total: existing.total + record.total,
      });
    });

    return CATEGORIES.map((cat) => {
      const data = summaryMap.get(cat.key) || { quantity: 0, total: 0 };
      return {
        category: cat.key,
        quantity: data.quantity,
        total: data.total,
        icon: cat.icon || "📦",
        color: cat.color || "bg-gray-500",
      };
    }).filter((s) => s.quantity > 0);
  }, [salesData]);

  // Bottles summary (special focus)
  const bottlesSummary = useMemo(() => {
    const bottles = salesData.filter((r) => r.category === "Botella");
    return {
      count: bottles.reduce((sum, b) => sum + b.quantity, 0),
      total: bottles.reduce((sum, b) => sum + b.total, 0),
      items: bottles,
    };
  }, [salesData]);

  // Format helpers
  const formatCurrency = (amount: number) => `$${amount.toFixed(2)}`;
  const formatDate = (date: Date) =>
    date.toLocaleDateString("es-MX", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });

  const { start: rangeStart, end: rangeEnd } = getDateRange();

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2 flex items-center gap-2">
          <BarChart3 className="text-amber-400" />
          Analytics
        </h1>
        <p className="text-gray-400">
          Análisis de ventas • {rangeStart.toLocaleDateString("es-MX")} -{" "}
          {rangeEnd.toLocaleDateString("es-MX")}
        </p>
      </div>

      {/* Filters Section */}
      <div className="bg-gray-800 rounded-xl p-4 mb-6 border border-gray-700">
        <div className="flex flex-col lg:flex-row gap-4">
          {/* Date Filter Type */}
          <div className="flex-1">
            <label className="text-sm font-semibold text-white mb-2 flex items-center gap-2">
              <Calendar size={16} className="text-amber-400" />
              Período
            </label>
            <div className="flex flex-wrap gap-2 mt-2">
              {[
                { key: "week", label: "Esta Semana" },
                { key: "month", label: "Mes" },
                { key: "day", label: "Día" },
                { key: "range", label: "Rango" },
              ].map(({ key, label }) => (
                <button
                  key={key}
                  onClick={() => setDateFilterType(key as DateFilterType)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    dateFilterType === key
                      ? "bg-amber-500 text-gray-900"
                      : "bg-gray-700 text-gray-300 hover:bg-gray-600"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Date Inputs based on filter type */}
          <div className="flex-1">
            {dateFilterType === "month" && (
              <div>
                <label className="text-sm font-semibold text-white mb-2 block">
                  Seleccionar Mes
                </label>
                <input
                  type="month"
                  value={`${selectedDate.getFullYear()}-${String(
                    selectedDate.getMonth() + 1
                  ).padStart(2, "0")}`}
                  onChange={(e) =>
                    setSelectedDate(new Date(e.target.value + "-01"))
                  }
                  className="bg-gray-700 text-white rounded-lg px-4 py-2 border border-gray-600 focus:border-amber-400 focus:outline-none w-full"
                />
              </div>
            )}
            {dateFilterType === "day" && (
              <div>
                <label className="text-sm font-semibold text-white mb-2 block">
                  Seleccionar Día
                </label>
                <input
                  type="date"
                  value={selectedDate.toISOString().split("T")[0]}
                  onChange={(e) =>
                    setSelectedDate(new Date(e.target.value + "T12:00:00"))
                  }
                  className="bg-gray-700 text-white rounded-lg px-4 py-2 border border-gray-600 focus:border-amber-400 focus:outline-none w-full"
                />
              </div>
            )}
            {dateFilterType === "range" && (
              <div className="flex gap-2">
                <div className="flex-1">
                  <label className="text-sm font-semibold text-white mb-2 block">
                    Desde
                  </label>
                  <input
                    type="date"
                    value={startDate.toISOString().split("T")[0]}
                    onChange={(e) =>
                      setStartDate(new Date(e.target.value + "T00:00:00"))
                    }
                    className="bg-gray-700 text-white rounded-lg px-4 py-2 border border-gray-600 focus:border-amber-400 focus:outline-none w-full"
                  />
                </div>
                <div className="flex-1">
                  <label className="text-sm font-semibold text-white mb-2 block">
                    Hasta
                  </label>
                  <input
                    type="date"
                    value={endDate.toISOString().split("T")[0]}
                    onChange={(e) =>
                      setEndDate(new Date(e.target.value + "T23:59:59"))
                    }
                    className="bg-gray-700 text-white rounded-lg px-4 py-2 border border-gray-600 focus:border-amber-400 focus:outline-none w-full"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Category Filter */}
          <div className="flex-1">
            <label className="text-sm font-semibold text-white mb-2 flex items-center gap-2">
              <Filter size={16} className="text-amber-400" />
              Categoría
            </label>
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="bg-gray-700 text-white rounded-lg px-4 py-2 border border-gray-600 focus:border-amber-400 focus:outline-none w-full mt-2"
            >
              <option value="Todos">Todas las categorías</option>
              {CATEGORIES.map((cat) => (
                <option key={cat.key} value={cat.key}>
                  {cat.icon} {cat.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-12">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-amber-400"></div>
          <p className="mt-4 text-gray-400">Cargando analytics...</p>
        </div>
      ) : (
        <>
          {/* Bottles Special Summary */}
          <div className="bg-gradient-to-r from-purple-500/10 to-purple-600/10 border-2 border-purple-500/30 rounded-xl p-6 mb-6">
            <h2 className="text-xl font-bold mb-4 text-purple-400 flex items-center gap-2">
              <Wine size={24} />
              🍾 Control de Botellas
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-gray-800/50 rounded-lg p-4">
                <p className="text-gray-400 text-sm mb-1">Botellas Vendidas</p>
                <p className="text-3xl font-bold text-white">
                  {bottlesSummary.count}
                </p>
              </div>
              <div className="bg-gray-800/50 rounded-lg p-4">
                <p className="text-gray-400 text-sm mb-1">Total en Botellas</p>
                <p className="text-3xl font-bold text-purple-400">
                  {formatCurrency(bottlesSummary.total)}
                </p>
              </div>
              <div className="bg-gray-800/50 rounded-lg p-4">
                <p className="text-gray-400 text-sm mb-1">
                  Promedio por Botella
                </p>
                <p className="text-3xl font-bold text-white">
                  {bottlesSummary.count > 0
                    ? formatCurrency(
                        bottlesSummary.total / bottlesSummary.count
                      )
                    : "$0.00"}
                </p>
              </div>
            </div>
          </div>

          {/* Category Summaries */}
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3 mb-6">
            {categorySummaries.map((summary) => (
              <div
                key={summary.category}
                onClick={() => setSelectedCategory(summary.category)}
                className={`bg-gray-800 rounded-xl p-4 border cursor-pointer transition-all hover:scale-105 ${
                  selectedCategory === summary.category
                    ? "border-amber-400 ring-2 ring-amber-400/20"
                    : "border-gray-700 hover:border-gray-600"
                }`}
              >
                <div className="text-2xl mb-2">{summary.icon}</div>
                <p className="text-xs text-gray-400 truncate">
                  {summary.category}
                </p>
                <p className="text-lg font-bold text-white">
                  {summary.quantity}
                </p>
                <p className="text-sm text-amber-400">
                  {formatCurrency(summary.total)}
                </p>
              </div>
            ))}
          </div>

          {/* Totals Row */}
          <div className="bg-gradient-to-r from-amber-500/10 to-orange-500/10 border border-amber-500/30 rounded-xl p-4 mb-6">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-center">
              <div>
                <TrendingUp className="mx-auto text-amber-400 mb-1" size={20} />
                <p className="text-gray-400 text-xs">Total Ventas</p>
                <p className="text-2xl font-bold text-white">
                  {formatCurrency(
                    filteredData.reduce((sum, r) => sum + r.total, 0)
                  )}
                </p>
              </div>
              <div>
                <Package className="mx-auto text-blue-400 mb-1" size={20} />
                <p className="text-gray-400 text-xs">Items Vendidos</p>
                <p className="text-2xl font-bold text-white">
                  {filteredData.reduce((sum, r) => sum + r.quantity, 0)}
                </p>
              </div>
              <div>
                <Users className="mx-auto text-green-400 mb-1" size={20} />
                <p className="text-gray-400 text-xs">Transacciones</p>
                <p className="text-2xl font-bold text-white">
                  {new Set(filteredData.map((r) => r.orderId)).size}
                </p>
              </div>
              <div>
                <BarChart3 className="mx-auto text-purple-400 mb-1" size={20} />
                <p className="text-gray-400 text-xs">Registros</p>
                <p className="text-2xl font-bold text-white">
                  {filteredData.length}
                </p>
              </div>
            </div>
          </div>

          {/* Sales Table */}
          <div className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden">
            <div className="p-4 border-b border-gray-700">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <Package size={20} className="text-amber-400" />
                Detalle de Ventas
                <span className="text-sm font-normal text-gray-400">
                  ({filteredData.length} registros)
                </span>
              </h3>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-900/50">
                  <tr>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-400 uppercase">
                      Fecha
                    </th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-400 uppercase">
                      Producto
                    </th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-400 uppercase">
                      Categoría
                    </th>
                    <th className="text-center px-4 py-3 text-xs font-semibold text-gray-400 uppercase">
                      Cant.
                    </th>
                    <th className="text-right px-4 py-3 text-xs font-semibold text-gray-400 uppercase">
                      Precio Unit.
                    </th>
                    <th className="text-right px-4 py-3 text-xs font-semibold text-gray-400 uppercase">
                      Total
                    </th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-400 uppercase">
                      Vendedor
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-700">
                  {filteredData.length === 0 ? (
                    <tr>
                      <td
                        colSpan={7}
                        className="text-center py-12 text-gray-500"
                      >
                        <Package
                          className="mx-auto mb-3 opacity-50"
                          size={48}
                        />
                        <p>No hay ventas en este período</p>
                      </td>
                    </tr>
                  ) : (
                    filteredData.slice(0, 100).map((record, idx) => {
                      const catInfo = CATEGORIES.find(
                        (c) => c.key === record.category
                      );
                      return (
                        <tr
                          key={`${record.orderId}-${idx}`}
                          className="hover:bg-gray-700/30"
                        >
                          <td className="px-4 py-3 text-sm text-gray-300 whitespace-nowrap">
                            {formatDate(record.date)}
                          </td>
                          <td className="px-4 py-3 text-sm text-white font-medium">
                            {record.productName}
                          </td>
                          <td className="px-4 py-3">
                            <span
                              className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs ${
                                catInfo?.color || "bg-gray-600"
                              } bg-opacity-20`}
                            >
                              {catInfo?.icon} {record.category}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-center text-sm text-white font-semibold">
                            {record.quantity}
                          </td>
                          <td className="px-4 py-3 text-right text-sm text-gray-300">
                            {formatCurrency(record.unitPrice)}
                          </td>
                          <td className="px-4 py-3 text-right text-sm text-amber-400 font-semibold">
                            {formatCurrency(record.total)}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-300">
                            {record.waiterName}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
              {filteredData.length > 100 && (
                <div className="p-4 text-center text-gray-400 text-sm border-t border-gray-700">
                  Mostrando 100 de {filteredData.length} registros
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default Analytics;
