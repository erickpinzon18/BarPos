import React, { useState, useEffect } from "react";
import { collection, query, where, getDocs, Timestamp } from "firebase/firestore";
import { db } from "../../services/firebase";
import { useAuth } from "../../contexts/AuthContext";
import type { Order } from "../../utils/types";
import { TrendingUp, DollarSign, Users, Package, Clock, Calendar, ChevronLeft, ChevronRight } from "lucide-react";

const CARD_COMMISSION_RATE = 0.05;

const getShiftRange = (date: Date) => {
  const shiftStart = new Date(date);
  shiftStart.setHours(17, 0, 0, 0);
  const shiftEnd = new Date(date);
  shiftEnd.setDate(shiftEnd.getDate() + 1);
  shiftEnd.setHours(5, 0, 0, 0);
  return { shiftStart, shiftEnd };
};

const getCurrentShiftDate = () => {
  const now = new Date();
  if (now.getHours() >= 0 && now.getHours() < 17) {
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    return yesterday;
  }
  return now;
};

interface OrderRow {
  o: Order;
  subtotal: number;
  tip: number;
  cardComm: number;
  tipNet: number;
  cashAmt: number;
  cardAmt: number;
}

const MisVentas: React.FC = () => {
  const { currentUser } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState<Date>(getCurrentShiftDate());

  const { shiftStart, shiftEnd } = getShiftRange(selectedDate);
  const today = getCurrentShiftDate();
  const isCurrentShift = selectedDate.toDateString() === today.toDateString();

  const formatCurrency = (n: number) => `$${n.toFixed(2)}`;

  const goToPrevDay = () => {
    const d = new Date(selectedDate);
    d.setDate(d.getDate() - 1);
    setSelectedDate(d);
  };

  const goToNextDay = () => {
    if (isCurrentShift) return;
    const d = new Date(selectedDate);
    d.setDate(d.getDate() + 1);
    setSelectedDate(d);
  };

  useEffect(() => {
    if (!currentUser?.id) return;
    setLoading(true);
    setOrders([]);
    (async () => {
      try {
        const q = query(
          collection(db, "orders"),
          where("status", "==", "pagado"),
          where("completedAt", ">=", Timestamp.fromDate(shiftStart)),
          where("completedAt", "<=", Timestamp.fromDate(shiftEnd))
        );
        const snapshot = await getDocs(q);
        const data: Order[] = [];
        snapshot.forEach(doc => {
          const d = doc.data();
          if (d.waiterId === currentUser!.id) {
            data.push({
              id: doc.id,
              ...d,
              completedAt: d.completedAt?.toDate(),
              createdAt: d.createdAt?.toDate(),
            } as Order);
          }
        });
        data.sort((a, b) => (a.completedAt?.getTime() ?? 0) - (b.completedAt?.getTime() ?? 0));
        setOrders(data);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser?.id, selectedDate.toDateString()]);

  const rows: OrderRow[] = orders.map(o => {
    const total = o.total ?? 0;
    const subtotal = o.subtotal ?? 0;
    const tip = total - subtotal;
    let cashAmt = 0, cardAmt = 0;
    if (o.paymentMethod === "mixto" && Array.isArray(o.payments)) {
      o.payments.forEach(p => {
        if (p.method === "efectivo") cashAmt += p.amount ?? 0;
        else if (p.method === "tarjeta") cardAmt += p.amount ?? 0;
      });
    } else {
      cashAmt = o.paymentMethod === "efectivo" ? total : 0;
      cardAmt = o.paymentMethod === "tarjeta" ? total : 0;
    }
    const cardComm = o.paymentMethod === "tarjeta" ? tip * CARD_COMMISSION_RATE : 0;
    return { o, subtotal, tip, cardComm, tipNet: tip - cardComm, cashAmt, cardAmt };
  });

  const totals = rows.reduce(
    (acc, r) => ({
      sales: acc.sales + (r.o.total ?? 0),
      subtotal: acc.subtotal + r.subtotal,
      tips: acc.tips + r.tip,
      cardComm: acc.cardComm + r.cardComm,
      people: acc.people + (r.o.peopleCount ?? 1),
    }),
    { sales: 0, subtotal: 0, tips: 0, cardComm: 0, people: 0 }
  );
  const tipsNet = totals.tips - totals.cardComm;
  const waiterShare = tipsNet * 0.4667;
  const barShare = tipsNet * 0.2;
  const busserShare = tipsNet * 0.1333;
  const managerShare = tipsNet * 0.1333;
  const cashierShare = tipsNet * 0.0667;

  return (
    <div className="p-4 max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-5">
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <TrendingUp className="text-green-400" size={24} />
          Mis Ventas
          {currentUser?.displayName && <span className="text-green-400">— {currentUser.displayName}</span>}
        </h1>
      </div>

      {/* Selector de turno */}
      <div className="bg-gray-800 border border-gray-700 rounded-xl p-4 mb-5 flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="flex items-center gap-2 text-gray-400">
          <Calendar size={18} className="text-green-400" />
          <span className="text-sm font-semibold text-white">Turno:</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={goToPrevDay}
            className="p-1.5 rounded-lg bg-gray-700 hover:bg-gray-600 text-gray-300 transition-colors"
          >
            <ChevronLeft size={18} />
          </button>
          <input
            type="date"
            value={selectedDate.toISOString().split("T")[0]}
            max={today.toISOString().split("T")[0]}
            onChange={e => setSelectedDate(new Date(e.target.value + "T12:00:00"))}
            className="bg-gray-700 text-white rounded-lg px-3 py-1.5 border border-gray-600 focus:border-green-500 focus:outline-none text-sm"
          />
          <button
            onClick={goToNextDay}
            disabled={isCurrentShift}
            className="p-1.5 rounded-lg bg-gray-700 hover:bg-gray-600 text-gray-300 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <ChevronRight size={18} />
          </button>
          {isCurrentShift && (
            <span className="text-xs bg-green-500/20 text-green-400 border border-green-500/30 px-2 py-1 rounded-full font-semibold">
              Turno actual
            </span>
          )}
        </div>
        <div className="flex items-center gap-1 text-xs text-gray-400 sm:ml-auto">
          <Clock size={13} />
          {shiftStart.toLocaleDateString("es-MX", { day: "2-digit", month: "short" })} 5:00 PM
          {" → "}
          {shiftEnd.toLocaleDateString("es-MX", { day: "2-digit", month: "short" })} 5:00 AM
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center min-h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-400 mx-auto" />
        </div>
      ) : orders.length === 0 ? (
        <div className="text-center py-12 bg-gray-800/50 rounded-xl border border-gray-700">
          <Package className="mx-auto text-gray-600 mb-3" size={48} />
          <p className="text-gray-400 text-lg">No hay ventas para este turno</p>
        </div>
      ) : (
        <>
          {/* KPIs */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
            <div className="bg-gray-800 border border-gray-700 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-1">
                <DollarSign className="text-green-400" size={18} />
                <span className="text-xs text-gray-400 uppercase font-semibold">Ventas</span>
              </div>
              <p className="text-2xl font-bold text-white">{formatCurrency(totals.sales)}</p>
              <p className="text-xs text-gray-500 mt-0.5">con propina</p>
            </div>
            <div className="bg-gray-800 border border-gray-700 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-1">
                <DollarSign className="text-blue-400" size={18} />
                <span className="text-xs text-gray-400 uppercase font-semibold">Sin Propina</span>
              </div>
              <p className="text-2xl font-bold text-white">{formatCurrency(totals.subtotal)}</p>
              <p className="text-xs text-gray-500 mt-0.5">subtotal puro</p>
            </div>
            <div className="bg-gray-800 border border-gray-700 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-1">
                <Users className="text-purple-400" size={18} />
                <span className="text-xs text-gray-400 uppercase font-semibold">Cuentas</span>
              </div>
              <p className="text-2xl font-bold text-white">{orders.length}</p>
              <p className="text-xs text-gray-500 mt-0.5">{totals.people} personas</p>
            </div>
            <div className="bg-green-900/30 border border-green-700/50 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-1">
                <TrendingUp className="text-green-400" size={18} />
                <span className="text-xs text-green-400 uppercase font-semibold">Mi parte</span>
              </div>
              <p className="text-2xl font-bold text-green-300">{formatCurrency(waiterShare)}</p>
              <p className="text-xs text-green-600 mt-0.5">46.67% de {formatCurrency(tipsNet)}</p>
            </div>
          </div>

          {/* Tabla de cuentas */}
          <div className="bg-gray-800 border border-gray-700 rounded-xl overflow-hidden mb-5">
            <div className="px-4 py-3 bg-gray-700/50 border-b border-gray-700">
              <p className="text-white font-semibold text-sm">Detalle de cuentas</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-700 text-gray-400 text-xs uppercase">
                    <th className="text-left px-4 py-2">Mesa</th>
                    <th className="text-left px-4 py-2">Hora</th>
                    <th className="text-right px-4 py-2">Pers.</th>
                    <th className="text-right px-4 py-2">Subtotal</th>
                    <th className="text-right px-4 py-2">Efectivo</th>
                    <th className="text-right px-4 py-2">Tarjeta</th>
                    <th className="text-right px-4 py-2">Propina</th>
                    <th className="text-right px-4 py-2 text-green-400">Libre</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-700/50">
                  {rows.map(({ o, subtotal, tip, cardComm, tipNet, cashAmt, cardAmt }) => (
                    <tr key={o.id} className="hover:bg-gray-700/20 transition-colors">
                      <td className="px-4 py-2 text-gray-300">
                        {o.tableNumber === 0 ? "Barra" : `Mesa ${o.tableNumber}`}
                        {o.tableName ? <span className="text-gray-500 text-xs ml-1">({o.tableName})</span> : null}
                      </td>
                      <td className="px-4 py-2 text-gray-400">
                        {o.completedAt?.toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit", hour12: false }) ?? "—"}
                      </td>
                      <td className="px-4 py-2 text-right text-gray-300">{o.peopleCount ?? 1}</td>
                      <td className="px-4 py-2 text-right text-gray-300">{formatCurrency(subtotal)}</td>
                      <td className="px-4 py-2 text-right text-gray-300">{cashAmt > 0 ? formatCurrency(cashAmt) : "—"}</td>
                      <td className="px-4 py-2 text-right text-yellow-300">{cardAmt > 0 ? formatCurrency(cardAmt) : "—"}</td>
                      <td className="px-4 py-2 text-right text-gray-300">
                        {tip > 0 ? formatCurrency(tip) : "—"}
                        {cardComm > 0 && <span className="text-red-400 text-xs ml-1">(-{formatCurrency(cardComm)})</span>}
                      </td>
                      <td className="px-4 py-2 text-right text-green-400 font-semibold">{tip > 0 ? formatCurrency(tipNet) : "—"}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-gray-600 bg-gray-700/40 font-bold">
                    <td className="px-4 py-3 text-white" colSpan={3}>TOTAL ({orders.length} cuentas)</td>
                    <td className="px-4 py-3 text-right text-gray-300">{formatCurrency(totals.subtotal)}</td>
                    <td className="px-4 py-3 text-right text-gray-300" colSpan={2}>{formatCurrency(totals.sales)}</td>
                    <td className="px-4 py-3 text-right text-gray-300">
                      {formatCurrency(totals.tips)}
                      {totals.cardComm > 0 && <span className="text-red-400 text-xs ml-1">(-{formatCurrency(totals.cardComm)})</span>}
                    </td>
                    <td className="px-4 py-3 text-right text-green-400">{formatCurrency(tipsNet)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          {/* Distribución de propinas */}
          <div className="bg-gray-800 border border-gray-700 rounded-xl p-5">
            <p className="text-gray-400 text-xs uppercase font-semibold mb-3">
              Distribución de propinas — {formatCurrency(tipsNet)} netas
            </p>
            <div className="grid grid-cols-5 gap-2">
              <div className="bg-green-900/30 border border-green-700/40 rounded-lg p-3 text-center">
                <p className="text-gray-400 text-xs mb-1">👨‍🍳 Mesero</p>
                <p className="text-green-300 font-bold text-base">{formatCurrency(waiterShare)}</p>
                <p className="text-gray-500 text-xs">46.67%</p>
              </div>
              <div className="bg-purple-900/20 border border-purple-700/30 rounded-lg p-3 text-center">
                <p className="text-gray-400 text-xs mb-1">🍺 Barra</p>
                <p className="text-purple-300 font-bold text-base">{formatCurrency(barShare)}</p>
                <p className="text-gray-500 text-xs">20.00%</p>
              </div>
              <div className="bg-orange-900/20 border border-orange-700/30 rounded-lg p-3 text-center">
                <p className="text-gray-400 text-xs mb-1">🧹 Garrot</p>
                <p className="text-orange-300 font-bold text-base">{formatCurrency(busserShare)}</p>
                <p className="text-gray-500 text-xs">13.33%</p>
              </div>
              <div className="bg-yellow-900/20 border border-yellow-700/30 rounded-lg p-3 text-center">
                <p className="text-gray-400 text-xs mb-1">👔 Encarg</p>
                <p className="text-yellow-300 font-bold text-base">{formatCurrency(managerShare)}</p>
                <p className="text-gray-500 text-xs">13.33%</p>
              </div>
              <div className="bg-blue-900/20 border border-blue-700/30 rounded-lg p-3 text-center">
                <p className="text-gray-400 text-xs mb-1">🧾 Caja</p>
                <p className="text-blue-300 font-bold text-base">{formatCurrency(cashierShare)}</p>
                <p className="text-gray-500 text-xs">6.67%</p>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default MisVentas;
