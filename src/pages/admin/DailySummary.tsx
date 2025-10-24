import React, { useState, useEffect } from 'react';
import { collection, query, where, getDocs, Timestamp } from 'firebase/firestore';
import { db } from '../../services/firebase';
import type { Order } from '../../utils/types';
import { Calendar, DollarSign, Package, Users, TrendingUp, Clock, UserCircle } from 'lucide-react';
import { PieChart as RechartsPie, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Legend, CartesianGrid } from 'recharts';

interface WaiterStats {
  waiterName: string;
  waiterId: string;
  totalSales: number;
  totalOrders: number;
  totalTips: number;
  averageTipPercent: number;
  waiterShare: number;    // 66% para el mesero
  barShare: number;       // 33% para barra
}

interface ShiftSummary {
  totalSales: number;
  totalOrders: number;
  totalItems: number;
  totalTips: number;
  totalSubtotal: number;
  paymentMethods: {
    efectivo: number;
    tarjeta: number;
    transferencia: number;
  };
  averageOrderValue: number;
  averageTipPercent: number;
  waiterStats: WaiterStats[];
  totalBarShare: number;  // Total para barra (suma de todos los 33%)
}

const DailySummary: React.FC = () => {
  // Función para obtener la fecha del turno actual (ayer si estamos antes de las 3 AM, hoy si estamos después de las 5 PM)
  const getCurrentShiftDate = () => {
    const now = new Date();
    const currentHour = now.getHours();
    
    // Si son entre las 12 AM y las 3 AM, el turno empezó ayer
    if (currentHour >= 0 && currentHour < 3) {
      const yesterday = new Date(now);
      yesterday.setDate(yesterday.getDate() - 1);
      return yesterday;
    }
    
    // Si son entre las 3 AM y las 5 PM, el turno de ayer ya terminó, mostrar el de anteayer
    if (currentHour >= 3 && currentHour < 17) {
      const yesterday = new Date(now);
      yesterday.setDate(yesterday.getDate() - 1);
      return yesterday;
    }
    
    // Si son después de las 5 PM, el turno actual empezó hoy
    return now;
  };

  const [summary, setSummary] = useState<ShiftSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState<Date>(getCurrentShiftDate());

  // Calcular inicio y fin del turno (5 PM a 3 AM del día siguiente)
  const getShiftRange = (date: Date) => {
    const shiftStart = new Date(date);
    shiftStart.setHours(17, 0, 0, 0); // 5 PM

    const shiftEnd = new Date(date);
    shiftEnd.setDate(shiftEnd.getDate() + 1);
    shiftEnd.setHours(3, 0, 0, 0); // 3 AM del día siguiente

    return { shiftStart, shiftEnd };
  };

  const loadShiftData = async (date: Date) => {
    setLoading(true);
    try {
      const { shiftStart, shiftEnd } = getShiftRange(date);

      // Query para obtener órdenes pagadas en el rango del turno
      const q = query(
        collection(db, 'orders'),
        where('status', '==', 'pagado'),
        where('completedAt', '>=', Timestamp.fromDate(shiftStart)),
        where('completedAt', '<=', Timestamp.fromDate(shiftEnd))
      );

      const snapshot = await getDocs(q);
      const ordersData: Order[] = [];

      snapshot.forEach((doc) => {
        const data = doc.data();
        ordersData.push({
          id: doc.id,
          ...data,
          completedAt: data.completedAt?.toDate(),
          createdAt: data.createdAt?.toDate(),
          updatedAt: data.updatedAt?.toDate(),
        } as Order);
      });

      // Calcular resumen
      const summary: ShiftSummary = {
        totalSales: 0,
        totalOrders: ordersData.length,
        totalItems: 0,
        totalTips: 0,
        totalSubtotal: 0,
        paymentMethods: {
          efectivo: 0,
          tarjeta: 0,
          transferencia: 0,
        },
        averageOrderValue: 0,
        averageTipPercent: 0,
        waiterStats: [],
        totalBarShare: 0,
      };

      let totalTipPercent = 0;
      let ordersWithTip = 0;
      const waiterStatsMap = new Map<string, WaiterStats>();

      ordersData.forEach((order) => {
        const subtotal = order.subtotal ?? 0;
        const total = order.total ?? 0;
        const tip = total - subtotal;

        summary.totalSales += total;
        summary.totalSubtotal += subtotal;
        summary.totalTips += tip;

        // Contar items activos
        const activeItems = (order.items || []).filter(i => !i.isDeleted);
        summary.totalItems += activeItems.reduce((sum, item) => sum + (item.quantity ?? 1), 0);

        // Contar por método de pago
        if (order.paymentMethod) {
          const method = order.paymentMethod as keyof typeof summary.paymentMethods;
          if (summary.paymentMethods[method] !== undefined) {
            summary.paymentMethods[method] += total;
          }
        }

        // Calcular promedio de propina
        const tipPercent = order.payments?.[0]?.tipPercent ?? 0;
        if (tipPercent > 0) {
          totalTipPercent += tipPercent;
          ordersWithTip++;
        }

        // Estadísticas por mesero
        const waiterId = order.waiterId || 'unknown';
        const waiterName = order.waiterName || 'Desconocido';
        
        if (!waiterStatsMap.has(waiterId)) {
          waiterStatsMap.set(waiterId, {
            waiterId,
            waiterName,
            totalSales: 0,
            totalOrders: 0,
            totalTips: 0,
            averageTipPercent: 0,
            waiterShare: 0,
            barShare: 0,
          });
        }

        const waiterStats = waiterStatsMap.get(waiterId)!;
        waiterStats.totalSales += total;
        waiterStats.totalOrders += 1;
        waiterStats.totalTips += tip;
        if (tipPercent > 0) {
          waiterStats.averageTipPercent += tipPercent;
        }
      });

      // Calcular promedios de propina por mesero y distribución
      let totalBarShare = 0;
      waiterStatsMap.forEach((stats) => {
        if (stats.totalOrders > 0) {
          stats.averageTipPercent = (stats.averageTipPercent / stats.totalOrders) * 100;
        }
        // Calcular distribución: 66% mesero, 33% barra
        stats.waiterShare = stats.totalTips * 0.66;
        stats.barShare = stats.totalTips * 0.34;
        totalBarShare += stats.barShare;
      });

      summary.averageOrderValue = summary.totalOrders > 0 ? summary.totalSales / summary.totalOrders : 0;
      summary.averageTipPercent = ordersWithTip > 0 ? (totalTipPercent / ordersWithTip) * 100 : 0;
      summary.waiterStats = Array.from(waiterStatsMap.values()).sort((a, b) => b.totalSales - a.totalSales);
      summary.totalBarShare = totalBarShare;

      // console.log('Summary waiterStats:', summary.waiterStats); // Debug
      // console.log('Total Bar Share:', totalBarShare); // Debug
      setSummary(summary);
    } catch (error) {
      console.error('Error loading shift data:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadShiftData(selectedDate);
  }, [selectedDate]);

  const formatCurrency = (amount: number) => `$${amount.toFixed(2)}`;
  const formatPercent = (percent: number) => `${percent.toFixed(1)}%`;

  const { shiftStart, shiftEnd } = getShiftRange(selectedDate);

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2 flex items-center gap-2">
          <TrendingUp className="text-amber-400" />
          Cierre de Caja
        </h1>
        <p className="text-gray-400">Resumen de ventas del turno</p>
      </div>

      {/* Selector de Fecha */}
      <div className="bg-gray-800 rounded-xl p-4 mb-6 border border-gray-700">
        <div className="flex flex-col md:flex-row md:items-center gap-4">
          <div className="flex items-center gap-2">
            <Calendar className="text-amber-400" size={20} />
            <label className="text-sm font-semibold text-white">Seleccionar turno:</label>
          </div>
          <input
            type="date"
            value={selectedDate.toISOString().split('T')[0]}
            onChange={(e) => setSelectedDate(new Date(e.target.value + 'T12:00:00'))}
            className="bg-gray-700 text-white rounded-lg px-4 py-2 border border-gray-600 focus:border-amber-400 focus:outline-none"
          />
          <div className="flex items-center gap-2 text-sm text-gray-300">
            <Clock size={16} />
            <span>
              {shiftStart.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })} 5:00 PM
              {' → '}
              {shiftEnd.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })} 3:00 AM
            </span>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-12">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-amber-400"></div>
          <p className="mt-4 text-gray-400">Cargando resumen...</p>
        </div>
      ) : summary ? (
        <>
          {/* Tarjetas de Resumen Principal */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-6">
            {/* Total de Ventas */}
            <div className="bg-gradient-to-br from-green-500/10 to-green-600/5 border border-green-500/30 rounded-xl p-5">
              <div className="flex items-center justify-between mb-2">
                <DollarSign className="text-green-400" size={24} />
                <span className="text-xs font-semibold text-green-400 bg-green-500/20 px-2 py-1 rounded">TOTAL</span>
              </div>
              <p className="text-3xl font-bold text-white mb-1">{formatCurrency(summary.totalSales)}</p>
              <p className="text-sm text-gray-400">Ventas totales</p>
            </div>

            {/* Total de Órdenes */}
            <div className="bg-gradient-to-br from-blue-500/10 to-blue-600/5 border border-blue-500/30 rounded-xl p-5">
              <div className="flex items-center justify-between mb-2">
                <Package className="text-blue-400" size={24} />
                <span className="text-xs font-semibold text-blue-400 bg-blue-500/20 px-2 py-1 rounded">ÓRDENES</span>
              </div>
              <p className="text-3xl font-bold text-white mb-1">{summary.totalOrders}</p>
              <p className="text-sm text-gray-400">Tickets procesados</p>
            </div>

            {/* Total de Items */}
            <div className="bg-gradient-to-br from-purple-500/10 to-purple-600/5 border border-purple-500/30 rounded-xl p-5">
              <div className="flex items-center justify-between mb-2">
                <Package className="text-purple-400" size={24} />
                <span className="text-xs font-semibold text-purple-400 bg-purple-500/20 px-2 py-1 rounded">ITEMS</span>
              </div>
              <p className="text-3xl font-bold text-white mb-1">{summary.totalItems}</p>
              <p className="text-sm text-gray-400">Productos vendidos</p>
            </div>

            {/* Total de Propinas */}
            <div className="bg-gradient-to-br from-amber-500/10 to-amber-600/5 border border-amber-500/30 rounded-xl p-5">
              <div className="flex items-center justify-between mb-2">
                <TrendingUp className="text-amber-400" size={24} />
                <span className="text-xs font-semibold text-amber-400 bg-amber-500/20 px-2 py-1 rounded">PROPINAS</span>
              </div>
              <p className="text-3xl font-bold text-white mb-1">{formatCurrency(summary.totalTips)}</p>
              <p className="text-sm text-gray-400">Para repartir</p>
            </div>

            {/* Promedio por Ticket */}
            <div className="bg-gradient-to-br from-cyan-500/10 to-cyan-600/5 border border-cyan-500/30 rounded-xl p-5">
              <div className="flex items-center justify-between mb-2">
                <DollarSign className="text-cyan-400" size={24} />
                <span className="text-xs font-semibold text-cyan-400 bg-cyan-500/20 px-2 py-1 rounded">PROM</span>
              </div>
              <p className="text-3xl font-bold text-white mb-1">{formatCurrency(summary.averageOrderValue)}</p>
              <p className="text-sm text-gray-400">Ticket promedio</p>
            </div>

            {/* Items por Orden */}
            <div className="bg-gradient-to-br from-pink-500/10 to-pink-600/5 border border-pink-500/30 rounded-xl p-5">
              <div className="flex items-center justify-between mb-2">
                <Package className="text-pink-400" size={24} />
                <span className="text-xs font-semibold text-pink-400 bg-pink-500/20 px-2 py-1 rounded">PROM</span>
              </div>
              <p className="text-3xl font-bold text-white mb-1">
                {summary.totalOrders > 0 ? (summary.totalItems / summary.totalOrders).toFixed(1) : '0'}
              </p>
              <p className="text-sm text-gray-400">Items por orden</p>
            </div>
          </div>

          {/* Tarjetas de Resumen Secundario - Meseros Activos y Propinas */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            {/* Meseros Activos */}
            <div className="bg-gradient-to-br from-indigo-500/10 to-indigo-600/5 border border-indigo-500/30 rounded-xl p-5">
              <div className="flex items-center justify-between mb-2">
                <Users className="text-indigo-400" size={24} />
                <span className="text-xs font-semibold text-indigo-400 bg-indigo-500/20 px-2 py-1 rounded">MESEROS</span>
              </div>
              <p className="text-3xl font-bold text-white mb-1">
                {summary?.waiterStats ? summary.waiterStats.filter(w => w.totalSales > 0).length : 0}
              </p>
              <p className="text-sm text-gray-400">Con ventas activas</p>
            </div>

            {/* Propina Promedio % */}
            <div className="bg-gradient-to-br from-yellow-500/10 to-yellow-600/5 border border-yellow-500/30 rounded-xl p-5">
              <div className="flex items-center justify-between mb-2">
                <TrendingUp className="text-yellow-400" size={24} />
                <span className="text-xs font-semibold text-yellow-400 bg-yellow-500/20 px-2 py-1 rounded">%</span>
              </div>
              <p className="text-3xl font-bold text-white mb-1">{formatPercent(summary.averageTipPercent)}</p>
              <p className="text-sm text-gray-400">Propina promedio</p>
            </div>

            {/* Total para Barra */}
            <div className="bg-gradient-to-br from-purple-500/10 to-purple-600/5 border border-purple-500/30 rounded-xl p-5">
              <div className="flex items-center justify-between mb-2">
                <DollarSign className="text-purple-400" size={24} />
                <span className="text-xs font-semibold text-purple-400 bg-purple-500/20 px-2 py-1 rounded">BARRA</span>
              </div>
              <p className="text-3xl font-bold text-white mb-1">{formatCurrency(summary.totalBarShare || 0)}</p>
              <p className="text-sm text-gray-400">Total barra (34%)</p>
            </div>
          </div>

          {/* Desglose Detallado */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
            {/* Métodos de Pago */}
            <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
              <h3 className="text-xl font-bold mb-4 text-white flex items-center gap-2">
                <DollarSign className="text-amber-400" size={20} />
                Métodos de Pago
              </h3>
              <div className="space-y-4">
                <div className="flex justify-between items-center p-3 bg-gray-700/50 rounded-lg">
                  <span className="text-gray-300 font-medium">💵 Efectivo</span>
                  <span className="text-white font-bold">{formatCurrency(summary.paymentMethods.efectivo)}</span>
                </div>
                <div className="flex justify-between items-center p-3 bg-gray-700/50 rounded-lg">
                  <span className="text-gray-300 font-medium">💳 Tarjeta</span>
                  <span className="text-white font-bold">{formatCurrency(summary.paymentMethods.tarjeta)}</span>
                </div>
                <div className="flex justify-between items-center p-3 bg-gray-700/50 rounded-lg">
                  <span className="text-gray-300 font-medium">📱 Transferencia</span>
                  <span className="text-white font-bold">{formatCurrency(summary.paymentMethods.transferencia)}</span>
                </div>
              </div>
            </div>

            {/* Estadísticas Adicionales */}
            <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
              <h3 className="text-xl font-bold mb-4 text-white flex items-center gap-2">
                <TrendingUp className="text-amber-400" size={20} />
                Estadísticas
              </h3>
              <div className="space-y-4">
                <div className="flex justify-between items-center p-3 bg-gray-700/50 rounded-lg">
                  <span className="text-gray-300 font-medium">Subtotal (sin propina)</span>
                  <span className="text-white font-bold">{formatCurrency(summary.totalSubtotal)}</span>
                </div>
                <div className="flex justify-between items-center p-3 bg-gray-700/50 rounded-lg">
                  <span className="text-gray-300 font-medium">Ticket promedio</span>
                  <span className="text-white font-bold">{formatCurrency(summary.averageOrderValue)}</span>
                </div>
                <div className="flex justify-between items-center p-3 bg-gray-700/50 rounded-lg">
                  <span className="text-gray-300 font-medium">Propina promedio</span>
                  <span className="text-white font-bold">{formatPercent(summary.averageTipPercent)}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Gráficas de Análisis */}
          {summary?.waiterStats && Array.isArray(summary.waiterStats) && summary.waiterStats.filter(w => w.totalSales > 0).length > 0 && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
              {/* Gráfica de Ventas por Mesero */}
              <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
                <h3 className="text-xl font-bold mb-4 text-white flex items-center gap-2">
                  <UserCircle className="text-green-400" size={20} />
                  Ventas por Mesero
                </h3>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={summary.waiterStats.filter(w => w.totalSales > 0).map(w => ({
                    name: w.waiterName.split(' ')[0],
                    Ventas: w.totalSales,
                    Propinas: w.totalTips
                  }))}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                    <XAxis dataKey="name" stroke="#9CA3AF" />
                    <YAxis stroke="#9CA3AF" />
                    <Tooltip 
                      contentStyle={{ backgroundColor: '#1F2937', border: '1px solid #374151', borderRadius: '8px' }}
                      labelStyle={{ color: '#F9FAFB' }}
                    />
                    <Legend />
                    <Bar dataKey="Ventas" fill="#10b981" radius={[8, 8, 0, 0]} />
                    <Bar dataKey="Propinas" fill="#f59e0b" radius={[8, 8, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* Gráfica de Métodos de Pago */}
              <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
                <h3 className="text-xl font-bold mb-4 text-white flex items-center gap-2">
                  <DollarSign className="text-blue-400" size={20} />
                  Métodos de Pago
                </h3>
                <ResponsiveContainer width="100%" height={300}>
                  <RechartsPie>
                    <Pie
                      data={[
                        { name: 'Efectivo', value: summary.paymentMethods.efectivo },
                        { name: 'Tarjeta', value: summary.paymentMethods.tarjeta },
                        { name: 'Transferencia', value: summary.paymentMethods.transferencia }
                      ].filter(p => p.value > 0)}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={(entry: any) => `${entry.name} ${(entry.percent * 100).toFixed(0)}%`}
                      outerRadius={100}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      <Cell fill="#10b981" />
                      <Cell fill="#3b82f6" />
                      <Cell fill="#a855f7" />
                    </Pie>
                    <Tooltip 
                      contentStyle={{ backgroundColor: '#1F2937', border: '1px solid #374151', borderRadius: '8px' }}
                      formatter={(value: number) => formatCurrency(value)}
                    />
                  </RechartsPie>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {/* Gráfica de Distribución de Propinas */}
          {summary?.waiterStats && Array.isArray(summary.waiterStats) && summary.waiterStats.filter(w => w.totalSales > 0).length > 0 && (
            <div className="bg-gray-800 rounded-xl p-6 border border-gray-700 mb-6">
              <h3 className="text-xl font-bold mb-4 text-white flex items-center gap-2">
                <TrendingUp className="text-amber-400" size={20} />
                Distribución de Propinas (66% Mesero / 34% Barra)
              </h3>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={summary.waiterStats.filter(w => w.totalSales > 0).map(w => ({
                  name: w.waiterName.split(' ')[0],
                  'Mesero (66%)': w.waiterShare,
                  'Barra (34%)': w.barShare
                }))}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                  <XAxis dataKey="name" stroke="#9CA3AF" />
                  <YAxis stroke="#9CA3AF" />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#1F2937', border: '1px solid #374151', borderRadius: '8px' }}
                    labelStyle={{ color: '#F9FAFB' }}
                    formatter={(value: number) => formatCurrency(value)}
                  />
                  <Legend />
                  <Bar dataKey="Mesero (66%)" stackId="a" fill="#10b981" radius={[0, 0, 0, 0]} />
                  <Bar dataKey="Barra (34%)" stackId="a" fill="#a855f7" radius={[8, 8, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Corte de Propinas por Mesero */}
          {summary?.waiterStats && Array.isArray(summary.waiterStats) && summary.waiterStats.filter(w => w.totalSales > 0).length > 0 && (
            <div className="bg-gray-800 rounded-xl p-6 border border-gray-700 mb-6">
              <h3 className="text-xl font-bold mb-4 text-white flex items-center gap-2">
                <Users className="text-amber-400" size={20} />
                Corte de Propinas por Mesero
              </h3>
              <div className="space-y-3">
                {summary.waiterStats.filter(w => w.totalSales > 0).map((waiter, index) => (
                  <div 
                    key={waiter.waiterId}
                    className="bg-gradient-to-r from-green-500/10 to-green-600/5 border border-green-500/30 rounded-lg p-4"
                  >
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <div className="bg-green-500/20 text-green-400 w-10 h-10 rounded-full flex items-center justify-center font-bold">
                          #{index + 1}
                        </div>
                        <div>
                          <p className="text-white font-bold text-lg">{waiter.waiterName}</p>
                          <p className="text-gray-400 text-sm">{waiter.totalOrders} órdenes • {formatCurrency(waiter.totalSales)} vendidos</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-2xl font-bold text-green-400">{formatCurrency(waiter.waiterShare)}</p>
                        <p className="text-xs text-gray-400">para mesero (66%)</p>
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-3 pt-3 border-t border-green-500/20">
                      <div className="bg-green-900/20 rounded-lg p-3 text-center border border-green-500/20">
                        <p className="text-gray-400 text-xs mb-1">💰 Propina Total</p>
                        <p className="text-white font-bold text-lg">{formatCurrency(waiter.totalTips)}</p>
                      </div>
                      <div className="bg-purple-900/20 rounded-lg p-3 text-center border border-purple-500/20">
                        <p className="text-gray-400 text-xs mb-1">🍺 Para Barra (34%)</p>
                        <p className="text-purple-400 font-bold text-lg">{formatCurrency(waiter.barShare)}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              
              {/* Resumen de distribución */}
              <div className="mt-4 pt-4 border-t border-gray-700">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Totales de Meseros */}
                  <div className="bg-green-900/20 border border-green-500/30 rounded-lg p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <Users className="text-green-400" size={20} />
                      <h4 className="text-green-400 font-bold">Total Meseros</h4>
                    </div>
                    <div className="space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="text-gray-400 text-sm">Meseros activos:</span>
                        <span className="text-white font-bold">{summary.waiterStats.filter(w => w.totalSales > 0).length}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-gray-400 text-sm">Total para meseros (66%):</span>
                        <span className="text-green-400 font-bold text-xl">
                          {formatCurrency(summary.totalTips * 0.66)}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Total de Barra */}
                  <div className="bg-purple-900/20 border border-purple-500/30 rounded-lg p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <DollarSign className="text-purple-400" size={20} />
                      <h4 className="text-purple-400 font-bold">Total Barra</h4>
                    </div>
                    <div className="space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="text-gray-400 text-sm">Suma de 34% de todos:</span>
                        <span className="text-purple-400 font-bold text-xl">
                          {formatCurrency(summary.totalBarShare)}
                        </span>
                      </div>
                      <div className="flex justify-between items-center text-xs">
                        <span className="text-gray-500">Total propinas:</span>
                        <span className="text-gray-400">{formatCurrency(summary.totalTips)}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Resumen Final */}
          <div className="bg-gradient-to-r from-amber-500/10 to-orange-500/10 border-2 border-amber-500/30 rounded-xl p-6">
            <h3 className="text-2xl font-bold mb-4 text-amber-400 text-center">💰 Resumen del Turno</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-center">
              <div>
                <p className="text-gray-400 text-sm mb-1">Total Vendido</p>
                <p className="text-3xl font-bold text-white">{formatCurrency(summary.totalSales)}</p>
              </div>
              <div>
                <p className="text-gray-400 text-sm mb-1">Propinas Totales</p>
                <p className="text-3xl font-bold text-amber-400">{formatCurrency(summary.totalTips)}</p>
              </div>
              <div>
                <p className="text-gray-400 text-sm mb-1">Total de Tickets</p>
                <p className="text-3xl font-bold text-blue-400">{summary.totalOrders}</p>
              </div>
            </div>
          </div>

          {/* Mensaje si no hay datos */}
          {summary.totalOrders === 0 && (
            <div className="text-center py-8 mt-6 bg-gray-800/50 rounded-xl border border-gray-700">
              <Package className="mx-auto text-gray-600 mb-3" size={48} />
              <p className="text-gray-400 text-lg">No hay ventas registradas en este turno</p>
              <p className="text-gray-500 text-sm mt-2">
                Turno: {shiftStart.toLocaleDateString('es-ES')} 5:00 PM - {shiftEnd.toLocaleDateString('es-ES')} 3:00 AM
              </p>
            </div>
          )}
        </>
      ) : null}
    </div>
  );
};

export default DailySummary;
