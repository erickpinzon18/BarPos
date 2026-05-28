import React, { useState, useEffect } from "react";
import {
  collection,
  query,
  where,
  getDocs,
  Timestamp,
} from "firebase/firestore";
import { db } from "../../services/firebase";
import type { Order } from "../../utils/types";
import {
  Calendar,
  DollarSign,
  Package,
  Users,
  TrendingUp,
  Clock,
  Printer,
  CreditCard,
  BarChart2,
} from "lucide-react";
import { sendToPrinter } from "../../utils/printTicket";

const CARD_COMMISSION_RATE = 0.015; // 1.5% comisión terminal

interface WaiterStats {
  waiterName: string;
  waiterId: string;
  totalSales: number;      // ventas totales (con propina)
  totalOrders: number;
  totalTips: number;       // propinas brutas (todas)
  totalPeople: number;     // personas totales atendidas por mesero

  // Ventas por método
  salesCash: number;       // ventas en efectivo (subtotal + propina efectivo)
  salesCard: number;       // ventas en tarjeta (subtotal + propina tarjeta) — monto bruto que pasa por terminal
  salesTransfer: number;   // ventas en transferencia

  // Propinas por método
  tipsCash: number;        // propinas cobradas en efectivo
  tipsCard: number;        // propinas cobradas en tarjeta (brutas)
  tipsTransfer: number;    // propinas en transferencia

  // Comisión bancaria (solo sobre ventas en tarjeta)
  cardCommission: number;  // salesCard × 1.5%

  // Propinas netas ya descontando comisión proporcional
  tipsCardNet: number;     // tipsCard - (tipsCard × 1.5%) * adjustment
  tipsNet: number;         // tipsCash + tipsTransfer + tipsCardNet — lo que realmente se reparte

  waiterShare: number;     // 46.67%
  barShare: number;        // 20.00%
  busserShare: number;     // 13.33%
  managerShare: number;    // 13.33%
  cashierShare: number;    // 6.67%
}

interface ShiftSummary {
  totalSales: number;
  totalOrders: number;
  totalItems: number;
  totalTips: number;       // propinas brutas
  totalSubtotal: number;
  totalPeople: number;     // total personas atendidas en el turno

  paymentMethods: {
    efectivo: number;
    tarjeta: number;
    transferencia: number;
  };

  // Comisión tarjeta
  totalCardCommission: number;  // 1.5% sobre todo lo que entró en tarjeta
  totalCardTips: number;        // propinas en tarjeta (brutas)
  totalCardTipsNet: number;     // propinas en tarjeta netas (ya descontada comisión)
  totalTipsNet: number;         // propinas totales netas para repartir

  averageOrderValue: number;    // venta promedio por ticket
  averageTipPercent: number;    // % de propina promedio
  averagePeoplePerOrder: number;// personas promedio por cuenta
  averageSalePerPerson: number; // venta promedio por persona

  waiterStats: WaiterStats[];
  totalBarShare: number;
  totalBusserShare: number;
  totalManagerShare: number;
  totalCashierShare: number;
}

const CHARS_80MM = 30;
const sep = (c = '-') => c.repeat(CHARS_80MM);
const center = (text: string) => {
  const pad = Math.floor((CHARS_80MM - text.length) / 2);
  return ' '.repeat(Math.max(0, pad)) + text;
};
const fmtLine = (left: string, right: string) => {
  const spaces = CHARS_80MM - left.length - right.length;
  return left + ' '.repeat(Math.max(1, spaces)) + right;
};
const fmtM = (n: number) => `$${n.toFixed(2)}`;

const DailySummary: React.FC = () => {
  // Función para obtener la fecha del turno actual
  const getCurrentShiftDate = () => {
    const now = new Date();
    const h = now.getHours();
    if (h >= 0 && h < 17) {
      const yesterday = new Date(now);
      yesterday.setDate(yesterday.getDate() - 1);
      return yesterday;
    }
    return now;
  };

  const [summary, setSummary] = useState<ShiftSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState<Date>(getCurrentShiftDate());

  const getShiftRange = (date: Date) => {
    const shiftStart = new Date(date);
    shiftStart.setHours(17, 0, 0, 0);
    const shiftEnd = new Date(date);
    shiftEnd.setDate(shiftEnd.getDate() + 1);
    shiftEnd.setHours(5, 0, 0, 0);
    return { shiftStart, shiftEnd };
  };

  const loadShiftData = async (date: Date) => {
    setLoading(true);
    try {
      const { shiftStart, shiftEnd } = getShiftRange(date);

      const q = query(
        collection(db, "orders"),
        where("status", "==", "pagado"),
        where("completedAt", ">=", Timestamp.fromDate(shiftStart)),
        where("completedAt", "<=", Timestamp.fromDate(shiftEnd))
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

      // ── Inicializar resumen ──────────────────────────────────────────────
      const summary: ShiftSummary = {
        totalSales: 0,
        totalOrders: ordersData.length,
        totalItems: 0,
        totalTips: 0,
        totalSubtotal: 0,
        totalPeople: 0,
        paymentMethods: { efectivo: 0, tarjeta: 0, transferencia: 0 },
        totalCardCommission: 0,
        totalCardTips: 0,
        totalCardTipsNet: 0,
        totalTipsNet: 0,
        averageOrderValue: 0,
        averageTipPercent: 0,
        averagePeoplePerOrder: 0,
        averageSalePerPerson: 0,
        waiterStats: [],
        totalBarShare: 0,
        totalBusserShare: 0,
        totalManagerShare: 0,
        totalCashierShare: 0,
      };

      let totalTipPercent = 0;
      let ordersWithTip = 0;
      const waiterStatsMap = new Map<string, WaiterStats>();

      ordersData.forEach((order) => {
        const subtotal = order.subtotal ?? 0;
        const total = order.total ?? 0;
        const tip = total - subtotal;
        const people = order.peopleCount ?? 1;

        summary.totalSales += total;
        summary.totalSubtotal += subtotal;
        summary.totalTips += tip;
        summary.totalPeople += people;

        // Items activos
        const activeItems = (order.items || []).filter((i) => !i.isDeleted);
        summary.totalItems += activeItems.reduce((s, i) => s + (i.quantity ?? 1), 0);

        // ── Contabilizar ventas y propinas por método ──────────────────────
        // Determina qué porción de cada pago corresponde a propina vs subtotal
        // Para eso usamos los datos del payment array cuando están disponibles.

        let cashSale = 0, cardSale = 0, transferSale = 0;
        let cashTip = 0, cardTip = 0, transferTip = 0;

        if (order.paymentMethod === 'mixto' && Array.isArray(order.payments)) {
          order.payments.forEach((p) => {
            const pAmt = p.amount ?? 0;
            const pTip = p.tipAmount ?? 0;
            summary.paymentMethods[p.method as keyof typeof summary.paymentMethods] =
              (summary.paymentMethods[p.method as keyof typeof summary.paymentMethods] ?? 0) + pAmt;
            if (p.method === 'efectivo') { cashSale += pAmt; cashTip += pTip; }
            else if (p.method === 'tarjeta') { cardSale += pAmt; cardTip += pTip; }
            else if (p.method === 'transferencia') { transferSale += pAmt; transferTip += pTip; }
          });
        } else if (order.paymentMethod) {
          const m = order.paymentMethod as keyof typeof summary.paymentMethods;
          if (summary.paymentMethods[m] !== undefined) summary.paymentMethods[m] += total;
          if (order.paymentMethod === 'efectivo') { cashSale = total; cashTip = tip; }
          else if (order.paymentMethod === 'tarjeta') { cardSale = total; cardTip = tip; }
          else if (order.paymentMethod === 'transferencia') { transferSale = total; transferTip = tip; }
        }

        // Comisión bancaria: 1.5% sobre TODO lo cobrado por terminal (subtotal + propina).
        // Esta comisión completa sale de la propina del mesero, no del subtotal.
        // Ej: $100 subtotal + $16 propina = $116 tarjeta → comisión $1.74 → propina neta $14.26
        const cardCommission = cardSale * CARD_COMMISSION_RATE;
        // Toda la comisión se descuenta directamente de la propina en tarjeta
        const cardTipNet = cardTip - cardCommission;

        summary.totalCardCommission += cardCommission;
        summary.totalCardTips += cardTip;
        summary.totalCardTipsNet += cardTipNet;

        // Propina promedio
        const tipPercent = order.payments?.[0]?.tipPercent ?? 0;
        if (tipPercent > 0) { totalTipPercent += tipPercent; ordersWithTip++; }

        // ── Stats por mesero ───────────────────────────────────────────────
        const waiterId = order.waiterId || "unknown";
        const waiterName = order.waiterName || "Desconocido";

        if (!waiterStatsMap.has(waiterId)) {
          waiterStatsMap.set(waiterId, {
            waiterId, waiterName,
            totalSales: 0, totalOrders: 0, totalTips: 0, totalPeople: 0,
            salesCash: 0, salesCard: 0, salesTransfer: 0,
            tipsCash: 0, tipsCard: 0, tipsTransfer: 0,
            cardCommission: 0, tipsCardNet: 0, tipsNet: 0,
            waiterShare: 0, barShare: 0, busserShare: 0, managerShare: 0, cashierShare: 0,
          });
        }

        const ws = waiterStatsMap.get(waiterId)!;
        ws.totalSales += total;
        ws.totalOrders += 1;
        ws.totalTips += tip;
        ws.totalPeople += people;
        ws.salesCash += cashSale;
        ws.salesCard += cardSale;
        ws.salesTransfer += transferSale;
        ws.tipsCash += cashTip;
        ws.tipsCard += cardTip;
        ws.tipsTransfer += transferTip;
        ws.cardCommission += cardCommission;
      });

      // ── Post-proceso propinas netas por mesero ───────────────────────────
      // La comisión completa (1.5% del total tarjeta) sale íntegra de las propinas.
      // Propinas netas globales = (propinas en efect/transf) + (propinas en tarjeta - comisión total tarjeta)
      summary.totalTipsNet =
        (summary.totalTips - summary.totalCardTips) +  // propinas efect + transf
        Math.max(0, summary.totalCardTipsNet);          // propinas tarjeta ya descontada comisión entera

      waiterStatsMap.forEach((ws) => {
        // Toda la comisión bancaria del mesero sale de su propina en tarjeta
        ws.tipsCardNet = ws.tipsCard - ws.cardCommission;
        ws.tipsNet = ws.tipsCash + ws.tipsTransfer + Math.max(0, ws.tipsCardNet);

        ws.waiterShare  = ws.tipsNet * 0.4667;
        ws.barShare     = ws.tipsNet * 0.20;
        ws.busserShare  = ws.tipsNet * 0.1333;
        ws.managerShare = ws.tipsNet * 0.1333;
        ws.cashierShare = ws.tipsNet * 0.0667;

        summary.totalBarShare     += ws.barShare;
        summary.totalBusserShare  += ws.busserShare;
        summary.totalManagerShare += ws.managerShare;
        summary.totalCashierShare += ws.cashierShare;
      });

      // ── Promedios globales ───────────────────────────────────────────────
      summary.averageOrderValue    = summary.totalOrders > 0 ? summary.totalSales / summary.totalOrders : 0;
      summary.averageTipPercent    = ordersWithTip > 0 ? (totalTipPercent / ordersWithTip) * 100 : 0;
      summary.averagePeoplePerOrder = summary.totalOrders > 0 ? summary.totalPeople / summary.totalOrders : 0;
      summary.averageSalePerPerson  = summary.totalPeople > 0 ? summary.totalSales / summary.totalPeople : 0;

      summary.waiterStats = Array.from(waiterStatsMap.values())
        .filter((s) => s.totalSales > 0)
        .sort((a, b) => b.totalSales - a.totalSales);

      setSummary(summary);
    } catch (error) {
      console.error("Error loading shift data:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadShiftData(selectedDate); }, [selectedDate]);

  const formatCurrency = (n: number) => `$${n.toFixed(2)}`;
  const formatPercent  = (n: number) => `${n.toFixed(1)}%`;
  const { shiftStart, shiftEnd } = getShiftRange(selectedDate);

  // ── Ticket de cierre de caja (80mm) ─────────────────────────────────────
  const printClosingReport = () => {
    if (!summary) return;

    const lines: string[] = [];
    const W = CHARS_80MM;

    lines.push(sep('='));
    lines.push(center('CIERRE DE CAJA'));
    lines.push(center('ChepeChupes'));
    lines.push(sep('='));
    lines.push('');

    // Fecha turno
    const dateLabel = shiftStart.toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' });
    lines.push(fmtLine('Turno:', dateLabel));
    lines.push(fmtLine('Inicio:', shiftStart.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })));
    lines.push(fmtLine('Fin:', shiftEnd.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })));
    lines.push(fmtLine('Impreso:', new Date().toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })));
    lines.push('');
    lines.push(sep());

    // ── Ventas Generales ────────────────────────────────────────────────────
    lines.push(center('VENTAS GENERALES'));
    lines.push(sep());
    lines.push(fmtLine('Total vendido:', fmtM(summary.totalSales)));
    lines.push(fmtLine('Subtotal (sin propina):', fmtM(summary.totalSubtotal)));
    lines.push(fmtLine('Propinas brutas:', fmtM(summary.totalTips)));
    lines.push('');

    // ── Métodos de Pago ─────────────────────────────────────────────────────
    lines.push(center('METODOS DE PAGO'));
    lines.push(sep());
    lines.push(fmtLine('Efectivo:', fmtM(summary.paymentMethods.efectivo)));
    lines.push(fmtLine('Tarjeta (bruto):', fmtM(summary.paymentMethods.tarjeta)));
    lines.push(fmtLine('  -Comision 1.5%:', `-${fmtM(summary.totalCardCommission)}`));
    lines.push(fmtLine('  Tarjeta neto:', fmtM(summary.paymentMethods.tarjeta - summary.totalCardCommission)));
    lines.push(fmtLine('Transferencia:', fmtM(summary.paymentMethods.transferencia)));
    lines.push('');

    // ── Propinas ────────────────────────────────────────────────────────────
    lines.push(center('PROPINAS'));
    lines.push(sep());
    lines.push(fmtLine('Propinas en tarjeta:', fmtM(summary.totalCardTips)));
    lines.push(fmtLine('  -Comision 1.5%:', `-${fmtM(summary.totalCardCommission)}`));
    lines.push(fmtLine('  Propinas tarjeta neto:', fmtM(summary.totalCardTipsNet)));
    const cashAndTransferTips = summary.totalTips - summary.totalCardTips;
    lines.push(fmtLine('Propinas efect/transf:', fmtM(cashAndTransferTips)));
    lines.push(sep('-'));
    lines.push(fmtLine('PROPINAS NETAS:', fmtM(summary.totalTipsNet)));
    lines.push('');

    // ── Indicadores ─────────────────────────────────────────────────────────
    lines.push(center('INDICADORES DEL TURNO'));
    lines.push(sep());
    lines.push(fmtLine('Total cuentas:', String(summary.totalOrders)));
    lines.push(fmtLine('Total personas:', String(summary.totalPeople)));
    lines.push(fmtLine('Total productos:', String(summary.totalItems)));
    lines.push(fmtLine('Promedio personas/cuenta:', summary.averagePeoplePerOrder.toFixed(1)));
    lines.push(fmtLine('Promedio venta/persona:', fmtM(summary.averageSalePerPerson)));
    lines.push(fmtLine('Promedio venta/ticket:', fmtM(summary.averageOrderValue)));
    lines.push(fmtLine('Propina promedio:', formatPercent(summary.averageTipPercent)));
    lines.push('');

    // ── Por mesero ──────────────────────────────────────────────────────────
    if (summary.waiterStats.length > 0) {
      lines.push(center('CORTE POR MESERO'));
      lines.push(sep('='));

      summary.waiterStats.forEach((w) => {
        lines.push(center(w.waiterName.toUpperCase()));
        lines.push(sep('-'));
        lines.push(fmtLine('Cuentas:', String(w.totalOrders)));
        lines.push(fmtLine('Personas:', String(w.totalPeople)));
        lines.push(fmtLine('Ventas totales:', fmtM(w.totalSales)));
        if (w.salesCard > 0) {
          lines.push(fmtLine('  Ventas tarjeta:', fmtM(w.salesCard)));
          lines.push(fmtLine('  Comision 1.5%:', `-${fmtM(w.cardCommission)}`));
          lines.push(fmtLine('  Propina tarjeta:', fmtM(w.tipsCard)));
          lines.push(fmtLine('  Prop.tarjeta neta:', fmtM(Math.max(0, w.tipsCardNet))));
        }
        lines.push(fmtLine('Propinas netas:', fmtM(w.tipsNet)));
        lines.push('');
        lines.push(center('-- DISTRIBUCION PROPINAS --'));
        lines.push(fmtLine('  Mesero (46.67%):', fmtM(w.waiterShare)));
        lines.push(fmtLine('  Barra  (20.00%):', fmtM(w.barShare)));
        lines.push(fmtLine('  Garrot (13.33%):', fmtM(w.busserShare)));
        lines.push(fmtLine('  Encarg (13.33%):', fmtM(w.managerShare)));
        lines.push(fmtLine('  Caja    (6.67%):', fmtM(w.cashierShare)));
        lines.push(sep());
      });

      // Totales de distribución
      lines.push(center('TOTALES DISTRIBUCION'));
      lines.push(sep('='));
      lines.push(fmtLine('Meseros (46.67%):', fmtM(summary.totalTipsNet * 0.4667)));
      lines.push(fmtLine('Barra   (20.00%):', fmtM(summary.totalBarShare)));
      lines.push(fmtLine('Garrot  (13.33%):', fmtM(summary.totalBusserShare)));
      lines.push(fmtLine('Encarg  (13.33%):', fmtM(summary.totalManagerShare)));
      lines.push(fmtLine('Caja     (6.67%):', fmtM(summary.totalCashierShare)));
      lines.push('');
    }

    lines.push(sep('='));
    lines.push(center('FIN DE CIERRE'));
    lines.push(sep('='));
    lines.push('');

    sendToPrinter(lines.join('\n'), '80mm', 'Cierre de Caja');
  };

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-bold mb-1 flex items-center gap-2">
            <TrendingUp className="text-red-500" />
            Cierre de Caja
          </h1>
          <p className="text-gray-400">Resumen de ventas del turno</p>
        </div>
        {summary && summary.totalOrders > 0 && (
          <button
            onClick={printClosingReport}
            className="flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white font-bold px-5 py-3 rounded-xl transition-colors shadow-lg"
          >
            <Printer size={18} />
            Imprimir Cierre
          </button>
        )}
      </div>

      {/* Selector de Fecha */}
      <div className="bg-gray-800 rounded-xl p-4 mb-6 border border-gray-700">
        <div className="flex flex-col md:flex-row md:items-center gap-4">
          <div className="flex items-center gap-2">
            <Calendar className="text-red-500" size={20} />
            <label className="text-sm font-semibold text-white">Seleccionar turno:</label>
          </div>
          <input
            type="date"
            value={selectedDate.toISOString().split("T")[0]}
            onChange={(e) => setSelectedDate(new Date(e.target.value + "T12:00:00"))}
            className="bg-gray-700 text-white rounded-lg px-4 py-2 border border-gray-600 focus:border-red-500 focus:outline-none"
          />
          <div className="flex items-center gap-2 text-sm text-gray-300">
            <Clock size={16} />
            <span>
              {shiftStart.toLocaleDateString("es-ES", { day: "numeric", month: "short" })} 5:00 PM
              {" → "}
              {shiftEnd.toLocaleDateString("es-ES", { day: "numeric", month: "short" })} 5:00 AM
            </span>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-12">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-red-500" />
          <p className="mt-4 text-gray-400">Cargando resumen...</p>
        </div>
      ) : summary ? (
        <>
          {/* ── KPIs Principales ─────────────────────────────────────────── */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <div className="bg-gradient-to-br from-green-500/10 to-green-600/5 border border-green-500/30 rounded-xl p-5">
              <div className="flex items-center justify-between mb-2">
                <DollarSign className="text-green-400" size={24} />
                <span className="text-xs font-semibold text-green-400 bg-green-500/20 px-2 py-1 rounded">TOTAL</span>
              </div>
              <p className="text-3xl font-bold text-white mb-1">{formatCurrency(summary.totalSales)}</p>
              <p className="text-sm text-gray-400">Ventas totales</p>
            </div>

            <div className="bg-gradient-to-br from-blue-500/10 to-blue-600/5 border border-blue-500/30 rounded-xl p-5">
              <div className="flex items-center justify-between mb-2">
                <Package className="text-blue-400" size={24} />
                <span className="text-xs font-semibold text-blue-400 bg-blue-500/20 px-2 py-1 rounded">CUENTAS</span>
              </div>
              <p className="text-3xl font-bold text-white mb-1">{summary.totalOrders}</p>
              <p className="text-sm text-gray-400">Tickets procesados</p>
            </div>

            <div className="bg-gradient-to-br from-purple-500/10 to-purple-600/5 border border-purple-500/30 rounded-xl p-5">
              <div className="flex items-center justify-between mb-2">
                <Users className="text-purple-400" size={24} />
                <span className="text-xs font-semibold text-purple-400 bg-purple-500/20 px-2 py-1 rounded">PERSONAS</span>
              </div>
              <p className="text-3xl font-bold text-white mb-1">{summary.totalPeople}</p>
              <p className="text-sm text-gray-400">Clientes atendidos</p>
            </div>

            <div className="bg-gradient-to-br from-red-500/10 to-red-700/5 border border-red-600/30 rounded-xl p-5">
              <div className="flex items-center justify-between mb-2">
                <TrendingUp className="text-red-500" size={24} />
                <span className="text-xs font-semibold text-red-500 bg-red-500/20 px-2 py-1 rounded">PROPINAS</span>
              </div>
              <p className="text-3xl font-bold text-white mb-1">{formatCurrency(summary.totalTipsNet)}</p>
              <p className="text-sm text-gray-400">Netas para repartir</p>
            </div>
          </div>

          {/* ── Indicadores de Desempeño ──────────────────────────────────── */}
          <div className="bg-gray-800 rounded-xl p-6 border border-gray-700 mb-6">
            <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
              <BarChart2 className="text-red-500" size={20} />
              Indicadores de Desempeño
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
              {[
                { label: 'Total Cuentas', value: String(summary.totalOrders), sub: 'tickets' },
                { label: 'Total Personas', value: String(summary.totalPeople), sub: 'clientes' },
                { label: 'Personas / Cuenta', value: summary.averagePeoplePerOrder.toFixed(1), sub: 'promedio' },
                { label: 'Venta / Persona', value: formatCurrency(summary.averageSalePerPerson), sub: 'promedio' },
                { label: 'Venta / Ticket', value: formatCurrency(summary.averageOrderValue), sub: 'promedio' },
              ].map((kpi) => (
                <div key={kpi.label} className="bg-gray-700/40 rounded-lg p-4 text-center border border-gray-600/50">
                  <p className="text-gray-400 text-xs mb-1">{kpi.label}</p>
                  <p className="text-white font-bold text-xl">{kpi.value}</p>
                  <p className="text-gray-500 text-xs">{kpi.sub}</p>
                </div>
              ))}
            </div>
          </div>

          {/* ── Métodos de Pago + Comisión Tarjeta ───────────────────────── */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
            <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
              <h3 className="text-xl font-bold mb-4 text-white flex items-center gap-2">
                <DollarSign className="text-red-500" size={20} />
                Métodos de Pago
              </h3>
              <div className="space-y-3">
                <div className="flex justify-between items-center p-3 bg-gray-700/50 rounded-lg">
                  <span className="text-gray-300 font-medium">💵 Efectivo</span>
                  <span className="text-white font-bold">{formatCurrency(summary.paymentMethods.efectivo)}</span>
                </div>
                <div className="flex flex-col gap-1 p-3 bg-gray-700/50 rounded-lg">
                  <div className="flex justify-between items-center">
                    <span className="text-gray-300 font-medium">💳 Tarjeta (bruto)</span>
                    <span className="text-white font-bold">{formatCurrency(summary.paymentMethods.tarjeta)}</span>
                  </div>
                  <div className="flex justify-between items-center pl-4 text-sm">
                    <span className="text-red-400">— Comisión 1.5%</span>
                    <span className="text-red-400 font-semibold">-{formatCurrency(summary.totalCardCommission)}</span>
                  </div>
                  <div className="flex justify-between items-center pl-4 text-sm border-t border-gray-600 pt-1">
                    <span className="text-green-400 font-medium">Tarjeta neto</span>
                    <span className="text-green-400 font-bold">{formatCurrency(summary.paymentMethods.tarjeta - summary.totalCardCommission)}</span>
                  </div>
                </div>
                <div className="flex justify-between items-center p-3 bg-gray-700/50 rounded-lg">
                  <span className="text-gray-300 font-medium">📱 Transferencia</span>
                  <span className="text-white font-bold">{formatCurrency(summary.paymentMethods.transferencia)}</span>
                </div>
              </div>
            </div>

            {/* Propinas con desglose tarjeta */}
            <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
              <h3 className="text-xl font-bold mb-4 text-white flex items-center gap-2">
                <CreditCard className="text-red-500" size={20} />
                Desglose de Propinas
              </h3>
              <div className="space-y-3">
                {/* Propinas en tarjeta */}
                <div className="flex flex-col gap-1 p-3 bg-yellow-900/20 border border-yellow-700/40 rounded-lg">
                  <div className="flex justify-between items-center">
                    <span className="text-yellow-300 font-medium">💳 Propinas en tarjeta</span>
                    <span className="text-yellow-300 font-bold">{formatCurrency(summary.totalCardTips)}</span>
                  </div>
                  <div className="flex justify-between items-center pl-4 text-sm">
                    <span className="text-red-400">— Comisión 1.5%</span>
                    <span className="text-red-400 font-semibold">-{formatCurrency(summary.totalCardCommission)}</span>
                  </div>
                  <div className="flex justify-between items-center pl-4 text-sm border-t border-yellow-700/40 pt-1">
                    <span className="text-green-400 font-medium">Propinas tarjeta netas</span>
                    <span className="text-green-400 font-bold">{formatCurrency(summary.totalCardTipsNet)}</span>
                  </div>
                </div>

                {/* Propinas en efectivo/transferencia */}
                <div className="flex justify-between items-center p-3 bg-gray-700/50 rounded-lg">
                  <span className="text-gray-300 font-medium">💵 Propinas efect/transf</span>
                  <span className="text-white font-bold">{formatCurrency(summary.totalTips - summary.totalCardTips)}</span>
                </div>

                {/* Total neto */}
                <div className="flex justify-between items-center p-3 bg-green-900/30 border border-green-500/40 rounded-lg">
                  <span className="text-green-300 font-bold text-lg">✅ Propinas netas totales</span>
                  <span className="text-green-400 font-bold text-xl">{formatCurrency(summary.totalTipsNet)}</span>
                </div>

                {/* Stats adicionales */}
                <div className="flex justify-between items-center p-3 bg-gray-700/30 rounded-lg text-sm">
                  <span className="text-gray-400">Propina promedio</span>
                  <span className="text-white font-semibold">{formatPercent(summary.averageTipPercent)}</span>
                </div>
                <div className="flex justify-between items-center p-3 bg-gray-700/30 rounded-lg text-sm">
                  <span className="text-gray-400">Total comisiones banco</span>
                  <span className="text-red-400 font-semibold">-{formatCurrency(summary.totalCardCommission)}</span>
                </div>
              </div>
            </div>
          </div>

          {/* ── Corte de Propinas por Mesero ─────────────────────────────── */}
          {summary.waiterStats && summary.waiterStats.length > 0 && (
            <div className="bg-gray-800 rounded-xl p-6 border border-gray-700 mb-6">
              <h3 className="text-xl font-bold mb-4 text-white flex items-center gap-2">
                <Users className="text-red-500" size={20} />
                Corte por Mesero
              </h3>
              <div className="space-y-4">
                {summary.waiterStats.map((waiter, index) => (
                  <div
                    key={waiter.waiterId}
                    className="bg-gradient-to-r from-gray-700/40 to-gray-800/40 border border-gray-600/50 rounded-xl p-5"
                  >
                    {/* Header mesero */}
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <div className="bg-red-500/20 text-red-400 w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm">
                          #{index + 1}
                        </div>
                        <div>
                          <p className="text-white font-bold text-lg">{waiter.waiterName}</p>
                          <p className="text-gray-400 text-sm">
                            {waiter.totalOrders} cuentas · {waiter.totalPeople} personas · {formatCurrency(waiter.totalSales)} vendidos
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-2xl font-bold text-green-400">{formatCurrency(waiter.waiterShare)}</p>
                        <p className="text-xs text-gray-400">para mesero (46.67%)</p>
                      </div>
                    </div>

                    {/* Desglose tarjeta si aplica */}
                    {waiter.salesCard > 0 && (
                      <div className="mb-4 p-3 bg-yellow-900/20 border border-yellow-700/40 rounded-lg text-sm">
                        <p className="text-yellow-300 font-semibold mb-2 flex items-center gap-1">
                          <CreditCard size={14} /> Detalle Tarjeta
                        </p>
                        <div className="grid grid-cols-2 gap-2">
                          <div className="flex justify-between">
                            <span className="text-gray-400">Ventas tarjeta</span>
                            <span className="text-white font-medium">{formatCurrency(waiter.salesCard)}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-400">Propinas tarjeta</span>
                            <span className="text-yellow-300 font-medium">{formatCurrency(waiter.tipsCard)}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-red-400">Comisión 1.5%</span>
                            <span className="text-red-400 font-medium">-{formatCurrency(waiter.cardCommission)}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-green-400">Prop. tarjeta neta</span>
                            <span className="text-green-400 font-medium">{formatCurrency(Math.max(0, waiter.tipsCardNet))}</span>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Propinas netas */}
                    <div className="flex justify-between items-center mb-4 p-2 bg-green-900/20 rounded-lg">
                      <span className="text-gray-300 text-sm font-medium">Propinas netas para distribuir</span>
                      <span className="text-green-400 font-bold">{formatCurrency(waiter.tipsNet)}</span>
                    </div>

                    {/* Grid distribución */}
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2 pt-3 border-t border-gray-600/40">
                      <div className="bg-green-900/20 rounded-lg p-3 text-center border border-green-500/20">
                        <p className="text-gray-400 text-xs mb-1">👨‍🍳 Mesero</p>
                        <p className="text-green-400 font-bold">{formatCurrency(waiter.waiterShare)}</p>
                        <p className="text-gray-500 text-xs">46.67%</p>
                      </div>
                      <div className="bg-purple-900/20 rounded-lg p-3 text-center border border-purple-500/20">
                        <p className="text-gray-400 text-xs mb-1">🍺 Barra</p>
                        <p className="text-purple-400 font-bold">{formatCurrency(waiter.barShare)}</p>
                        <p className="text-gray-500 text-xs">20.00%</p>
                      </div>
                      <div className="bg-orange-900/20 rounded-lg p-3 text-center border border-orange-500/20">
                        <p className="text-gray-400 text-xs mb-1">🧹 Garrotero</p>
                        <p className="text-orange-400 font-bold">{formatCurrency(waiter.busserShare)}</p>
                        <p className="text-gray-500 text-xs">13.33%</p>
                      </div>
                      <div className="bg-yellow-900/20 rounded-lg p-3 text-center border border-yellow-500/20">
                        <p className="text-gray-400 text-xs mb-1">👔 Encargado</p>
                        <p className="text-yellow-400 font-bold">{formatCurrency(waiter.managerShare)}</p>
                        <p className="text-gray-500 text-xs">13.33%</p>
                      </div>
                      <div className="bg-blue-900/20 rounded-lg p-3 text-center border border-blue-500/20">
                        <p className="text-gray-400 text-xs mb-1">🧾 Caja</p>
                        <p className="text-blue-400 font-bold">{formatCurrency(waiter.cashierShare)}</p>
                        <p className="text-gray-500 text-xs">6.67%</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Resumen distribución total */}
              <div className="mt-5 pt-5 border-t border-gray-700">
                <p className="text-gray-400 text-sm font-semibold mb-3 uppercase tracking-wide">Distribución Total del Turno</p>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
                  {[
                    { label: 'Meseros', pct: '46.67%', amount: summary.totalTipsNet * 0.4667, color: 'green' },
                    { label: 'Barra', pct: '20.00%', amount: summary.totalBarShare, color: 'purple' },
                    { label: 'Garrotero', pct: '13.33%', amount: summary.totalBusserShare, color: 'orange' },
                    { label: 'Encargado', pct: '13.33%', amount: summary.totalManagerShare, color: 'yellow' },
                    { label: 'Caja', pct: '6.67%', amount: summary.totalCashierShare, color: 'blue' },
                  ].map((item) => (
                    <div key={item.label} className={`bg-${item.color}-900/20 border border-${item.color}-500/30 rounded-lg p-4 text-center`}>
                      <p className={`text-${item.color}-400 font-bold text-sm mb-1`}>{item.label}</p>
                      <p className={`text-${item.color}-300 font-bold text-xl`}>{formatCurrency(item.amount)}</p>
                      <p className="text-gray-500 text-xs mt-1">{item.pct}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ── Resumen Final ─────────────────────────────────────────────── */}
          <div className="bg-gradient-to-r from-red-500/10 to-red-600/10 border-2 border-red-600/30 rounded-xl p-6">
            <h3 className="text-2xl font-bold mb-4 text-red-500 text-center">💰 Resumen del Turno</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
              <div>
                <p className="text-gray-400 text-sm mb-1">Total Vendido</p>
                <p className="text-3xl font-bold text-white">{formatCurrency(summary.totalSales)}</p>
              </div>
              <div>
                <p className="text-gray-400 text-sm mb-1">Propinas Netas</p>
                <p className="text-3xl font-bold text-red-400">{formatCurrency(summary.totalTipsNet)}</p>
              </div>
              <div>
                <p className="text-gray-400 text-sm mb-1">Cuentas / Personas</p>
                <p className="text-3xl font-bold text-blue-400">{summary.totalOrders} / {summary.totalPeople}</p>
              </div>
              <div>
                <p className="text-gray-400 text-sm mb-1">Comisión Banco</p>
                <p className="text-3xl font-bold text-yellow-400">-{formatCurrency(summary.totalCardCommission)}</p>
              </div>
            </div>
          </div>

          {/* Mensaje vacío */}
          {summary.totalOrders === 0 && (
            <div className="text-center py-8 mt-6 bg-gray-800/50 rounded-xl border border-gray-700">
              <Package className="mx-auto text-gray-600 mb-3" size={48} />
              <p className="text-gray-400 text-lg">No hay ventas registradas en este turno</p>
              <p className="text-gray-500 text-sm mt-2">
                Turno: {shiftStart.toLocaleDateString("es-ES")} 5:00 PM – {shiftEnd.toLocaleDateString("es-ES")} 5:00 AM
              </p>
            </div>
          )}
        </>
      ) : null}
    </div>
  );
};

export default DailySummary;
