import React, { useState, useEffect, useRef } from "react";
import { useReactToPrint } from "react-to-print";
import {
  collection,
  query,
  where,
  getDocs,
  Timestamp,
  doc,
  getDoc,
  setDoc,
} from "firebase/firestore";
import { toast } from "react-hot-toast";
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
  FileText,
  Save,
  Receipt,
} from "lucide-react";
import { sendToPrinter } from "../../utils/printTicket";
import { PrintableDailySummary } from "../../components/admin/PrintableDailySummary";
import { useActiveOrders } from "../../hooks/useOrders";

const CARD_COMMISSION_RATE = 0.05; // 5% comisión terminal

interface WaiterStats {
  waiterName: string;
  waiterId: string;
  totalSales: number; // ventas totales (con propina)
  totalOrders: number;
  totalTips: number; // propinas brutas (todas)
  totalPeople: number; // personas totales atendidas por mesero

  // Ventas por método
  salesCash: number; // ventas en efectivo (subtotal + propina efectivo)
  salesCard: number; // ventas en tarjeta (subtotal + propina tarjeta) — monto bruto que pasa por terminal
  salesTransfer: number; // ventas en transferencia

  // Propinas por método
  tipsCash: number; // propinas cobradas en efectivo
  tipsCard: number; // propinas cobradas en tarjeta (brutas)
  tipsTransfer: number; // propinas en transferencia

  // Comisión bancaria (solo sobre ventas en tarjeta)
  cardCommission: number; // salesCard × 1.5%

  // Propinas netas ya descontando comisión proporcional
  tipsCardNet: number; // tipsCard - (tipsCard × 1.5%) * adjustment
  tipsNet: number; // tipsCash + tipsTransfer + tipsCardNet — lo que realmente se reparte

  waiterShare: number; // 46.67%
  barShare: number; // 20.00%
  busserShare: number; // 13.33%
  managerShare: number; // 13.33%
  cashierShare: number; // 6.67%
}

interface ShiftSummary {
  totalSales: number; // Saldo cobrado
  pendingBalance: number; // Saldo por cobrar
  pendingOrders: number; // Mesas abiertas
  totalOrders: number;
  totalItems: number;
  totalTips: number; // propinas brutas
  totalSubtotal: number;
  totalPeople: number; // total personas atendidas en el turno

  paymentMethods: {
    efectivo: number;
    tarjeta: number;
    transferencia: number;
  };

  // Comisión tarjeta
  totalCardCommission: number; // 1.5% sobre todo lo que entró en tarjeta
  totalCardTips: number; // propinas en tarjeta (brutas)
  totalCashTips: number; // propinas en efectivo
  totalTransferTips: number; // propinas en transferencia
  totalCardTipsNet: number; // propinas en tarjeta netas (ya descontada comisión)
  totalTipsNet: number; // propinas totales netas para repartir

  averageOrderValue: number; // venta promedio por ticket
  averageTipPercent: number; // % de propina promedio
  averagePeoplePerOrder: number; // personas promedio por cuenta
  averageSalePerPerson: number; // venta promedio por persona

  waiterStats: WaiterStats[];
  totalBarShare: number;
  totalBusserShare: number;
  totalManagerShare: number;
  totalCashierShare: number;
}

const CHARS_80MM = 30;
const sep = (c = "-") => c.repeat(CHARS_80MM);
const center = (text: string) => {
  const pad = Math.floor((CHARS_80MM - text.length) / 2);
  return " ".repeat(Math.max(0, pad)) + text;
};
const fmtLine = (left: string, right: string) => {
  const spaces = CHARS_80MM - left.length - right.length;
  return left + " ".repeat(Math.max(1, spaces)) + right;
};
const fmtM = (n: number) => `$${n.toFixed(2)}`;

const getShiftRange = (date: Date) => {
  const shiftStart = new Date(date);
  shiftStart.setHours(17, 0, 0, 0);
  const shiftEnd = new Date(date);
  shiftEnd.setDate(shiftEnd.getDate() + 1);
  shiftEnd.setHours(5, 0, 0, 0);
  return { shiftStart, shiftEnd };
};

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

  // Expenses State
  const [djExpense, setDjExpense] = useState<number>(0);
  const [varietyExpense, setVarietyExpense] = useState<number>(0);
  const [extraExpense, setExtraExpense] = useState<number>(0);
  const [extraExpenseDesc, setExtraExpenseDesc] = useState<string>("");
  const [savingExpenses, setSavingExpenses] = useState(false);

  const printRef = useRef<HTMLDivElement>(null);
  
  const { orders: activeOrders } = useActiveOrders();
  const { shiftStart, shiftEnd } = getShiftRange(selectedDate);

  const shiftActiveOrders = activeOrders.filter(order => {
    const orderDate = order.createdAt;
    return orderDate >= shiftStart && orderDate <= shiftEnd;
  });

  const livePendingOrders = shiftActiveOrders.length;
  const livePendingBalance = shiftActiveOrders.reduce((sum, order) => {
    const activeItems = order.items?.filter(i => !i.isDeleted) || [];
    return sum + activeItems.reduce((s, i) => s + (i.productPrice || 0) * (i.quantity || 0), 0);
  }, 0);

  const handlePrintPDF = useReactToPrint({
    contentRef: printRef,
    documentTitle: `Cierre_Caja_${selectedDate.toISOString().split("T")[0]}`,
    pageStyle: `
      @page {
        size: auto;
        margin: 15mm;
      }
      @media print {
        body {
          -webkit-print-color-adjust: exact;
        }
      }
    `,
  });

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
        pendingBalance: 0,
        pendingOrders: 0,
        totalOrders: ordersData.length,
        totalItems: 0,
        totalTips: 0,
        totalSubtotal: 0,
        totalPeople: 0,
        paymentMethods: {
          efectivo: 0,
          tarjeta: 0,
          transferencia: 0,
        },
        totalCardCommission: 0,
        totalCardTips: 0,
        totalCashTips: 0,
        totalTransferTips: 0,
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

      // Ya no consultamos aquí, usamos el hook useActiveOrders para tiempo real

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
        summary.totalItems += activeItems.reduce(
          (s, i) => s + (i.quantity ?? 1),
          0
        );

        // ── Contabilizar ventas y propinas por método ──────────────────────
        // Determina qué porción de cada pago corresponde a propina vs subtotal
        // Para eso usamos los datos del payment array cuando están disponibles.

        let cashSale = 0,
          cardSale = 0,
          transferSale = 0;
        let cashTip = 0,
          cardTip = 0,
          transferTip = 0;

        if (order.paymentMethod === "mixto" && Array.isArray(order.payments)) {
          order.payments.forEach((p) => {
            const pAmt = p.amount ?? 0;
            const pTip = p.tipAmount ?? 0;
            summary.paymentMethods[
              p.method as keyof typeof summary.paymentMethods
            ] =
              (summary.paymentMethods[
                p.method as keyof typeof summary.paymentMethods
              ] ?? 0) + pAmt;
            if (p.method === "efectivo") {
              cashSale += pAmt;
              cashTip += pTip;
            } else if (p.method === "tarjeta") {
              cardSale += pAmt;
              cardTip += pTip;
            } else if (p.method === "transferencia") {
              transferSale += pAmt;
              transferTip += pTip;
            }
          });
        } else if (order.paymentMethod) {
          const m = order.paymentMethod as keyof typeof summary.paymentMethods;
          if (summary.paymentMethods[m] !== undefined)
            summary.paymentMethods[m] += total;
          if (order.paymentMethod === "efectivo") {
            cashSale = total;
            cashTip = tip;
          } else if (order.paymentMethod === "tarjeta") {
            cardSale = total;
            cardTip = tip;
          } else if (order.paymentMethod === "transferencia") {
            transferSale = total;
            transferTip = tip;
          }
        }

        // Acumula totales de propinas por método
        summary.totalCardTips += cardTip;
        summary.totalCashTips += cashTip;
        summary.totalTransferTips += transferTip;

        // Comisión bancaria: 5% sobre TODO lo cobrado por terminal (subtotal + propina).
        // Esta comisión completa sale de la propina del mesero, no del subtotal.
        // Ej: $100 subtotal + $16 propina = $116 tarjeta → comisión $1.74 → propina neta $14.26
        const cardCommission = cardSale * CARD_COMMISSION_RATE;
        // Toda la comisión se descuenta directamente de la propina en tarjeta
        const cardTipNet = cardTip - cardCommission;

        summary.totalCardCommission += cardCommission;
        summary.totalCardTipsNet += cardTipNet;

        // Propina promedio
        const tipPercent = order.payments?.[0]?.tipPercent ?? 0;
        if (tipPercent > 0) {
          totalTipPercent += tipPercent;
          ordersWithTip++;
        }

        // ── Stats por mesero ───────────────────────────────────────────────
        const waiterId = order.waiterId || "unknown";
        const waiterName = order.waiterName || "Desconocido";

        if (!waiterStatsMap.has(waiterId)) {
          waiterStatsMap.set(waiterId, {
            waiterId,
            waiterName,
            totalSales: 0,
            totalOrders: 0,
            totalTips: 0,
            totalPeople: 0,
            salesCash: 0,
            salesCard: 0,
            salesTransfer: 0,
            tipsCash: 0,
            tipsCard: 0,
            tipsTransfer: 0,
            cardCommission: 0,
            tipsCardNet: 0,
            tipsNet: 0,
            waiterShare: 0,
            barShare: 0,
            busserShare: 0,
            managerShare: 0,
            cashierShare: 0,
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

      // ── Propinas netas por mesero ─────────────────────────────
      // La comisión de la tarjeta (5% sobre la venta en tarjeta) se le descuenta
      // directamente a la propina bruta del mesero que generó ese cobro.
      summary.totalTipsNet = 0;

      waiterStatsMap.forEach((ws) => {
        // La propina neta del mesero es su propina total menos la comisión generada por SUS cobros con tarjeta
        ws.tipsNet = Math.max(0, ws.totalTips - ws.cardCommission);
        
        // Sumamos al pool global neto
        summary.totalTipsNet += ws.tipsNet;

        // Mantener tipsCardNet informativo para referencia por-mesero
        ws.tipsCardNet = ws.tipsCard - ws.cardCommission;

        // Distribución de su propina neta
        ws.waiterShare = ws.tipsNet * 0.4667;
        ws.barShare    = ws.tipsNet * 0.2;
        ws.busserShare = ws.tipsNet * 0.1333;
        ws.managerShare = ws.tipsNet * 0.1333;
        ws.cashierShare = ws.tipsNet * 0.0667;

        summary.totalBarShare    += ws.barShare;
        summary.totalBusserShare += ws.busserShare;
        summary.totalManagerShare += ws.managerShare;
        summary.totalCashierShare += ws.cashierShare;
      });

      // Con el modelo proporcional: sum(ws.tipsNet) == totalTipsNet exactamente.


      // ── Promedios globales ───────────────────────────────────────────────
      summary.averageOrderValue =
        summary.totalOrders > 0 ? summary.totalSales / summary.totalOrders : 0;
      summary.averageTipPercent =
        ordersWithTip > 0 ? (totalTipPercent / ordersWithTip) * 100 : 0;
      summary.averagePeoplePerOrder =
        summary.totalOrders > 0 ? summary.totalPeople / summary.totalOrders : 0;
      summary.averageSalePerPerson =
        summary.totalPeople > 0 ? summary.totalSales / summary.totalPeople : 0;

      summary.waiterStats = Array.from(waiterStatsMap.values())
        .filter((s) => s.totalSales > 0)
        .sort((a, b) => b.totalSales - a.totalSales);

      // Fetch shift expenses
      const shiftDateStr = selectedDate.toISOString().split("T")[0];
      const expensesRef = doc(db, "shiftExpenses", shiftDateStr);
      const expensesSnap = await getDoc(expensesRef);
      if (expensesSnap.exists()) {
        const d = expensesSnap.data();
        setDjExpense(d.djExpense || 0);
        setVarietyExpense(d.varietyExpense || 0);
        setExtraExpense(d.extraExpense || 0);
        setExtraExpenseDesc(d.extraExpenseDesc || "");
      } else {
        setDjExpense(0);
        setVarietyExpense(0);
        setExtraExpense(0);
        setExtraExpenseDesc("");
      }

      setSummary(summary);
    } catch (error) {
      console.error("Error loading shift data:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadShiftData(selectedDate);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDate]);

  const handleSaveExpenses = async () => {
    if (extraExpense > 0 && !extraExpenseDesc.trim()) {
      toast.error("Por favor describe el gasto extra.");
      return;
    }
    setSavingExpenses(true);
    try {
      const shiftDateStr = selectedDate.toISOString().split("T")[0];
      await setDoc(doc(db, "shiftExpenses", shiftDateStr), {
        djExpense,
        varietyExpense,
        extraExpense,
        extraExpenseDesc: extraExpenseDesc.trim(),
      });
      toast.success("Gastos guardados correctamente");
    } catch (error) {
      console.error(error);
      toast.error("Error al guardar gastos");
    } finally {
      setSavingExpenses(false);
    }
  };

  const formatCurrency = (n: number) => `$${n.toFixed(2)}`;
  const formatPercent = (n: number) => `${n.toFixed(1)}%`;

  // ── Ticket de cierre de caja (80mm) ─────────────────────────────────────
  const printClosingReport = () => {
    if (!summary) return;

    const lines: string[] = [];
    // const W = CHARS_80MM;

    lines.push(sep("="));
    lines.push(center("CIERRE DE CAJA"));
    lines.push(center("Wikka Despecho"));
    lines.push(sep("="));
    lines.push("");

    // Fecha turno
    const dateLabel = shiftStart.toLocaleDateString("es-MX", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
    lines.push(fmtLine("Turno:", dateLabel));
    lines.push(
      fmtLine(
        "Inicio:",
        shiftStart.toLocaleTimeString("es-MX", {
          hour: "2-digit",
          minute: "2-digit",
        })
      )
    );
    lines.push(
      fmtLine(
        "Fin:",
        shiftEnd.toLocaleTimeString("es-MX", {
          hour: "2-digit",
          minute: "2-digit",
        })
      )
    );
    lines.push(
      fmtLine(
        "Impreso:",
        new Date().toLocaleTimeString("es-MX", {
          hour: "2-digit",
          minute: "2-digit",
        })
      )
    );
    lines.push("");
    lines.push(sep());

    // ── Ventas Generales ────────────────────────────────────────────────────
    lines.push(center("VENTAS GENERALES"));
    lines.push(sep());
    lines.push(fmtLine("Total vendido:", fmtM(summary.totalSales)));
    lines.push(fmtLine("Subtotal (sin propina):", fmtM(summary.totalSubtotal)));
    lines.push(fmtLine("Propinas brutas:", fmtM(summary.totalTips)));
    lines.push("");

    // ── Métodos de Pago ─────────────────────────────────────────────────────
    lines.push(center("METODOS DE PAGO"));
    lines.push(sep());
    lines.push(
      fmtLine("Efectivo (Total):", fmtM(summary.paymentMethods.efectivo))
    );
    lines.push(
      fmtLine("  -Propinas (Total):", `-${fmtM(summary.totalTipsNet)}`)
    );
    const cashInRegister =
      summary.paymentMethods.efectivo - summary.totalTipsNet;
    lines.push(fmtLine("  Efectivo en caja:", fmtM(cashInRegister)));
    lines.push(fmtLine("Tarjeta:", fmtM(summary.paymentMethods.tarjeta)));
    lines.push(
      fmtLine("Transferencia:", fmtM(summary.paymentMethods.transferencia))
    );
    lines.push("");

    // ── Gastos del Turno ────────────────────────────────────────────────────
    const totalExpenses =
      (djExpense || 0) + (varietyExpense || 0) + (extraExpense || 0);
    if (totalExpenses > 0) {
      lines.push(center("GASTOS DEL TURNO"));
      lines.push(sep());
      if (djExpense > 0) lines.push(fmtLine("DJ:", `-${fmtM(djExpense)}`));
      if (varietyExpense > 0)
        lines.push(fmtLine("Variedad:", `-${fmtM(varietyExpense)}`));
      if (extraExpense > 0)
        lines.push(
          fmtLine(
            `Extra (${extraExpenseDesc || "N/A"}):`,
            `-${fmtM(extraExpense)}`
          )
        );
      lines.push(sep("-"));
      lines.push(fmtLine("Total Gastos:", `-${fmtM(totalExpenses)}`));
      lines.push(
        fmtLine("EFECTIVO FINAL EN CAJA:", fmtM(cashInRegister - totalExpenses))
      );
      lines.push("");
    }

    // ── Propinas ────────────────────────────────────────────────────────────
    lines.push(center("PROPINAS"));
    lines.push(sep());
    lines.push(fmtLine("Propinas en tarjeta:", fmtM(summary.totalCardTips)));
    const cashAndTransferTips = summary.totalTips - summary.totalCardTips;
    lines.push(fmtLine("Propinas efect/transf:", fmtM(cashAndTransferTips)));
    lines.push(sep("-"));
    lines.push(fmtLine("PROPINAS A REPARTIR:", fmtM(summary.totalTipsNet)));
    lines.push("");

    // ── Indicadores ─────────────────────────────────────────────────────────
    lines.push(center("INDICADORES DEL TURNO"));
    lines.push(sep());
    lines.push(fmtLine("Total cuentas:", String(summary.totalOrders)));
    lines.push(fmtLine("Total personas:", String(summary.totalPeople)));
    lines.push(fmtLine("Total productos:", String(summary.totalItems)));
    lines.push(
      fmtLine(
        "Promedio personas/cuenta:",
        summary.averagePeoplePerOrder.toFixed(1)
      )
    );
    lines.push(
      fmtLine("Promedio venta/persona:", fmtM(summary.averageSalePerPerson))
    );
    lines.push(
      fmtLine("Promedio venta/ticket:", fmtM(summary.averageOrderValue))
    );
    lines.push(
      fmtLine("Propina promedio:", formatPercent(summary.averageTipPercent))
    );
    lines.push("");

    // ── Por mesero ──────────────────────────────────────────────────────────
    if (summary.waiterStats.length > 0) {
      lines.push(center("CORTE POR MESERO"));
      lines.push(sep("="));

      summary.waiterStats.forEach((w) => {
        lines.push(center(w.waiterName.toUpperCase()));
        lines.push(sep("-"));
        lines.push(fmtLine("Cuentas:", String(w.totalOrders)));
        lines.push(fmtLine("Personas:", String(w.totalPeople)));
        lines.push(fmtLine("Ventas totales:", fmtM(w.totalSales)));
        if (w.salesCard > 0) {
          lines.push(fmtLine("  Ventas tarjeta:", fmtM(w.salesCard)));
          lines.push(fmtLine("  Propina tarjeta:", fmtM(w.tipsCard)));
        }
        lines.push(fmtLine("Propinas a repartir:", fmtM(w.tipsNet)));
        lines.push("");
        lines.push(center("-- DISTRIBUCION PROPINAS --"));
        lines.push(fmtLine("  Mesero (46.67%):", fmtM(w.waiterShare)));
        lines.push(fmtLine("  Barra  (20.00%):", fmtM(w.barShare)));
        lines.push(fmtLine("  Garrot (13.33%):", fmtM(w.busserShare)));
        lines.push(fmtLine("  Encarg (13.33%):", fmtM(w.managerShare)));
        lines.push(fmtLine("  Caja    (6.67%):", fmtM(w.cashierShare)));
        lines.push(sep());
      });

      // Totales de distribución
      lines.push(center("TOTALES DISTRIBUCION"));
      lines.push(sep("="));
      lines.push(
        fmtLine("Meseros (46.67%):", fmtM(summary.totalTipsNet * 0.4667))
      );
      lines.push(fmtLine("Barra   (20.00%):", fmtM(summary.totalBarShare)));
      lines.push(fmtLine("Garrot  (13.33%):", fmtM(summary.totalBusserShare)));
      lines.push(fmtLine("Encarg  (13.33%):", fmtM(summary.totalManagerShare)));
      lines.push(fmtLine("Caja     (6.67%):", fmtM(summary.totalCashierShare)));
      lines.push("");
    }

    lines.push(sep("="));
    lines.push(center("FIN DE CIERRE"));
    lines.push(sep("="));
    lines.push("");

    sendToPrinter(lines.join("\n"), "80mm", "Cierre de Caja");
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
          <div className="flex items-center gap-3">
            <button
              onClick={printClosingReport}
              className="flex items-center gap-2 bg-gray-700 hover:bg-gray-600 text-white font-bold px-4 py-2.5 rounded-xl transition-colors shadow-lg text-sm"
            >
              <Printer size={18} />
              Imprimir en ticket
            </button>
            <button
              onClick={() => handlePrintPDF()}
              className="flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white font-bold px-4 py-2.5 rounded-xl transition-colors shadow-lg text-sm"
            >
              <FileText size={18} />
              Imprimir en PDF
            </button>
          </div>
        )}
      </div>

      {/* Selector de Fecha */}
      <div className="bg-gray-800 rounded-xl p-4 mb-6 border border-gray-700">
        <div className="flex flex-col md:flex-row md:items-center gap-4">
          <div className="flex items-center gap-2">
            <Calendar className="text-red-500" size={20} />
            <label className="text-sm font-semibold text-white">
              Seleccionar turno:
            </label>
          </div>
          <input
            type="date"
            value={selectedDate.toISOString().split("T")[0]}
            onChange={(e) =>
              setSelectedDate(new Date(e.target.value + "T12:00:00"))
            }
            className="bg-gray-700 text-white rounded-lg px-4 py-2 border border-gray-600 focus:border-red-500 focus:outline-none"
          />
          <div className="flex items-center gap-2 text-sm text-gray-300">
            <Clock size={16} />
            <span>
              {shiftStart.toLocaleDateString("es-ES", {
                day: "numeric",
                month: "short",
              })}{" "}
              5:00 PM
              {" → "}
              {shiftEnd.toLocaleDateString("es-ES", {
                day: "numeric",
                month: "short",
              })}{" "}
              5:00 AM
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
                <span className="text-xs font-semibold text-green-400 bg-green-500/20 px-2 py-1 rounded">
                  COBRADO
                </span>
              </div>
              <p className="text-3xl font-bold text-white mb-1">
                {formatCurrency(summary.totalSales)}
              </p>
              <p className="text-sm text-gray-400">Ventas totales</p>
            </div>


            <div className="bg-gradient-to-br from-blue-500/10 to-blue-600/5 border border-blue-500/30 rounded-xl p-5">
              <div className="flex items-center justify-between mb-2">
                <Package className="text-blue-400" size={24} />
                <span className="text-xs font-semibold text-blue-400 bg-blue-500/20 px-2 py-1 rounded">
                  CUENTAS
                </span>
              </div>
              <p className="text-3xl font-bold text-white mb-1">
                {summary.totalOrders}
              </p>
              <p className="text-sm text-gray-400">Tickets procesados</p>
            </div>

            <div className="bg-gradient-to-br from-purple-500/10 to-purple-600/5 border border-purple-500/30 rounded-xl p-5">
              <div className="flex items-center justify-between mb-2">
                <Users className="text-purple-400" size={24} />
                <span className="text-xs font-semibold text-purple-400 bg-purple-500/20 px-2 py-1 rounded">
                  PERSONAS
                </span>
              </div>
              <p className="text-3xl font-bold text-white mb-1">
                {summary.totalPeople}
              </p>
              <p className="text-sm text-gray-400">Clientes atendidos</p>
            </div>

            <div className="bg-gradient-to-br from-red-500/10 to-red-700/5 border border-red-600/30 rounded-xl p-5">
              <div className="flex items-center justify-between mb-2">
                <TrendingUp className="text-red-500" size={24} />
                <span className="text-xs font-semibold text-red-500 bg-red-500/20 px-2 py-1 rounded">
                  PROPINAS
                </span>
              </div>
              <p className="text-3xl font-bold text-white mb-1">
                {formatCurrency(summary.totalTipsNet)}
              </p>
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
                {
                  label: "Total Cuentas",
                  value: String(summary.totalOrders),
                  sub: "tickets",
                },
                {
                  label: "Total Personas",
                  value: String(summary.totalPeople),
                  sub: "clientes",
                },
                {
                  label: "Personas / Cuenta",
                  value: summary.averagePeoplePerOrder.toFixed(1),
                  sub: "promedio",
                },
                {
                  label: "Venta / Persona",
                  value: formatCurrency(summary.averageSalePerPerson),
                  sub: "promedio",
                },
                {
                  label: "Venta / Ticket",
                  value: formatCurrency(summary.averageOrderValue),
                  sub: "promedio",
                },
              ].map((kpi) => (
                <div
                  key={kpi.label}
                  className="bg-gray-700/40 rounded-lg p-4 text-center border border-gray-600/50"
                >
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
                <div className="flex flex-col gap-1 p-3 bg-gray-700/50 rounded-lg">
                  <div className="flex justify-between items-center">
                    <span className="text-gray-300 font-medium">
                      💵 Efectivo (Total)
                    </span>
                    <span className="text-white font-bold">
                      {formatCurrency(summary.paymentMethods.efectivo)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center pl-4 text-sm mt-1">
                    <span className="text-gray-400">— Propinas (Todas)</span>
                    <span className="text-gray-400 font-semibold">
                      -{formatCurrency(summary.totalTipsNet)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center pl-4 text-sm border-t border-gray-600 pt-1 mt-1">
                    <span className="text-green-400 font-medium">
                      Efectivo en caja
                    </span>
                    <span className="text-green-400 font-bold">
                      {formatCurrency(
                        summary.paymentMethods.efectivo - summary.totalTipsNet
                      )}
                    </span>
                  </div>
                </div>
                <div className="flex flex-col gap-1 p-3 bg-gray-700/50 rounded-lg">
                  <div className="flex justify-between items-center">
                    <span className="text-gray-300 font-medium">
                      💳 Tarjeta
                    </span>
                    <span className="text-white font-bold">
                      {formatCurrency(summary.paymentMethods.tarjeta)}
                    </span>
                  </div>
                </div>
                <div className="flex justify-between items-center p-3 bg-gray-700/50 rounded-lg">
                  <span className="text-gray-300 font-medium">
                    📱 Transferencia
                  </span>
                  <span className="text-white font-bold">
                    {formatCurrency(summary.paymentMethods.transferencia)}
                  </span>
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
                    <span className="text-yellow-300 font-medium">
                      💳 Propinas en tarjeta
                    </span>
                    <span className="text-yellow-300 font-bold">
                      {formatCurrency(summary.totalCardTips)}
                    </span>
                  </div>
                </div>
                {/* Propinas en efectivo/transferencia */}
                <div className="flex justify-between items-center p-3 bg-gray-700/50 rounded-lg">
                  <span className="text-gray-300 font-medium">
                    💵 Propinas efect/transf
                  </span>
                  <span className="text-white font-bold">
                    {formatCurrency(summary.totalTips - summary.totalCardTips)}
                  </span>
                </div>
                {/* Total neto
                <div className="flex justify-between items-center mt-3 pt-3 border-t border-gray-600">
                  <span className="text-green-300 font-bold text-lg">
                    ✅ Propinas a repartir
                  </span>
                  <span className="text-green-400 font-bold text-xl">
                    {formatCurrency(summary.totalTipsNet)}
                  </span>
                </div> */}
                {/* Stats adicionales */}
                <div className="flex justify-between items-center p-3 bg-gray-700/30 rounded-lg text-sm">
                  <span className="text-gray-400">Propina promedio</span>
                  <span className="text-white font-semibold">
                    {formatPercent(summary.averageTipPercent)}
                  </span>
                </div>
              </div>
            </div>
            </div>

            {/* ── Gastos y Por Cobrar ───────────────────────────────────────── */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
              {/* Gastos del Turno */}
              <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
              <h3 className="text-xl font-bold mb-4 text-white flex items-center gap-2">
                <Receipt className="text-orange-500" size={20} />
                Gastos del Turno
              </h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-1">
                    Pago a DJ
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <span className="text-gray-500">$</span>
                    </div>
                    <input
                      type="number"
                      value={djExpense || ""}
                      onChange={(e) => setDjExpense(Number(e.target.value))}
                      className="w-full bg-gray-700 border border-gray-600 rounded-lg pl-8 pr-4 py-2 text-white focus:outline-none focus:border-red-500"
                      placeholder="0.00"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-1">
                    Pago a Variedad
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <span className="text-gray-500">$</span>
                    </div>
                    <input
                      type="number"
                      value={varietyExpense || ""}
                      onChange={(e) =>
                        setVarietyExpense(Number(e.target.value))
                      }
                      className="w-full bg-gray-700 border border-gray-600 rounded-lg pl-8 pr-4 py-2 text-white focus:outline-none focus:border-red-500"
                      placeholder="0.00"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-400 mb-1">
                      Gasto Extra
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <span className="text-gray-500">$</span>
                      </div>
                      <input
                        type="number"
                        value={extraExpense || ""}
                        onChange={(e) =>
                          setExtraExpense(Number(e.target.value))
                        }
                        className="w-full bg-gray-700 border border-gray-600 rounded-lg pl-8 pr-2 py-2 text-white focus:outline-none focus:border-red-500"
                        placeholder="0.00"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-400 mb-1">
                      Descripción extra
                    </label>
                    <input
                      type="text"
                      value={extraExpenseDesc}
                      onChange={(e) => setExtraExpenseDesc(e.target.value)}
                      className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-red-500"
                      placeholder="Ej. Vasos, hielo..."
                    />
                  </div>
                </div>

                <div className="mt-4 p-4 bg-gray-900/60 rounded-xl border border-gray-700">
                  <div className="flex justify-between items-center text-sm mb-2">
                    <span className="text-gray-400">Efectivo en caja</span>
                    <span className="text-gray-300 font-medium">
                      {formatCurrency(
                        summary.paymentMethods.efectivo - summary.totalTipsNet
                      )}
                    </span>
                  </div>
                  <div className="flex justify-between items-center text-sm mb-2">
                    <span className="text-gray-400">Total Gastos</span>
                    <span className="text-red-400 font-medium">
                      -
                      {formatCurrency(
                        (djExpense || 0) +
                          (varietyExpense || 0) +
                          (extraExpense || 0)
                      )}
                    </span>
                  </div>
                  <div className="flex justify-between items-center border-t border-gray-700 pt-2 mt-2">
                    <span className="text-green-400 font-bold">
                      Efectivo Final en Caja
                    </span>
                    <span className="text-green-400 font-bold text-lg">
                      {formatCurrency(
                        summary.paymentMethods.efectivo -
                          summary.totalTipsNet -
                          ((djExpense || 0) +
                            (varietyExpense || 0) +
                            (extraExpense || 0))
                      )}
                    </span>
                  </div>
                </div>

                <button
                  onClick={handleSaveExpenses}
                  disabled={savingExpenses}
                  className="w-full flex items-center justify-center gap-2 bg-red-600 hover:bg-red-700 text-white font-bold py-3 px-4 rounded-xl transition-colors mt-2"
                >
                  <Save size={18} />
                  {savingExpenses ? "Guardando..." : "Guardar Gastos"}
                </button>
              </div>
            </div>

            {/* Saldo Por Cobrar */}
            <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
              <h3 className="text-xl font-bold mb-4 text-white flex items-center gap-2">
                <Clock className="text-orange-500" size={20} />
                Saldo Por Cobrar (Mesas Abiertas)
              </h3>
              <div className="bg-gradient-to-br from-orange-500/10 to-orange-600/5 rounded-xl p-6 flex flex-col items-center justify-center text-center h-[calc(100%-3.5rem)] border border-orange-500/20">
                <p className="text-sm text-gray-400 mb-2">Total regado en mesas</p>
                <p className="text-5xl font-bold text-orange-400 mb-4">
                  {formatCurrency(livePendingBalance)}
                </p>
                <div className="bg-gray-900/60 border border-gray-700 rounded-lg px-4 py-2 inline-block mb-6">
                  <span className="text-white font-medium">{livePendingOrders}</span>
                  <span className="text-gray-400 ml-2">Mesas activas</span>
                </div>

                <div className="w-full grid grid-cols-2 gap-4 border-t border-orange-500/20 pt-4 mt-auto">
                  <div>
                    <p className="text-xs text-gray-400 mb-1">Ya Cobrado</p>
                    <p className="text-xl font-bold text-green-400">
                      {formatCurrency(summary.totalSales)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-400 mb-1">Proyección Total</p>
                    <p className="text-xl font-bold text-blue-400">
                      {formatCurrency(summary.totalSales + livePendingBalance)}
                    </p>
                  </div>
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
                          <p className="text-white font-bold text-lg">
                            {waiter.waiterName}
                          </p>
                          <p className="text-gray-400 text-sm">
                            {waiter.totalOrders} cuentas · {waiter.totalPeople}{" "}
                            personas · {formatCurrency(waiter.totalSales)}{" "}
                            vendidos
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-2xl font-bold text-green-400">
                          {formatCurrency(waiter.waiterShare)}
                        </p>
                        <p className="text-xs text-gray-400">
                          para mesero (46.67%)
                        </p>
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
                            <span className="text-gray-400">
                              Ventas tarjeta
                            </span>
                            <span className="text-white font-medium">
                              {formatCurrency(waiter.salesCard)}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-400">
                              Propinas tarjeta
                            </span>
                            <span className="text-yellow-300 font-medium">
                              {formatCurrency(waiter.tipsCard)}
                            </span>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Propinas netas */}
                    <div className="flex justify-between items-center mb-4 p-2 bg-green-900/20 rounded-lg">
                      <span className="text-gray-300 text-sm font-medium">
                        Propinas netas para distribuir
                      </span>
                      <span className="text-green-400 font-bold">
                        {formatCurrency(waiter.tipsNet)}
                      </span>
                    </div>

                    {/* Grid distribución */}
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2 pt-3 border-t border-gray-600/40">
                      <div className="bg-green-900/20 rounded-lg p-3 text-center border border-green-500/20">
                        <p className="text-gray-400 text-xs mb-1">👨‍🍳 Mesero</p>
                        <p className="text-green-400 font-bold">
                          {formatCurrency(waiter.waiterShare)}
                        </p>
                        <p className="text-gray-500 text-xs">46.67%</p>
                      </div>
                      <div className="bg-purple-900/20 rounded-lg p-3 text-center border border-purple-500/20">
                        <p className="text-gray-400 text-xs mb-1">🍺 Barra</p>
                        <p className="text-purple-400 font-bold">
                          {formatCurrency(waiter.barShare)}
                        </p>
                        <p className="text-gray-500 text-xs">20.00%</p>
                      </div>
                      <div className="bg-orange-900/20 rounded-lg p-3 text-center border border-orange-500/20">
                        <p className="text-gray-400 text-xs mb-1">
                          🧹 Garrotero
                        </p>
                        <p className="text-orange-400 font-bold">
                          {formatCurrency(waiter.busserShare)}
                        </p>
                        <p className="text-gray-500 text-xs">13.33%</p>
                      </div>
                      <div className="bg-yellow-900/20 rounded-lg p-3 text-center border border-yellow-500/20">
                        <p className="text-gray-400 text-xs mb-1">
                          👔 Encargado
                        </p>
                        <p className="text-yellow-400 font-bold">
                          {formatCurrency(waiter.managerShare)}
                        </p>
                        <p className="text-gray-500 text-xs">13.33%</p>
                      </div>
                      <div className="bg-blue-900/20 rounded-lg p-3 text-center border border-blue-500/20">
                        <p className="text-gray-400 text-xs mb-1">🧾 Caja</p>
                        <p className="text-blue-400 font-bold">
                          {formatCurrency(waiter.cashierShare)}
                        </p>
                        <p className="text-gray-500 text-xs">6.67%</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Resumen distribución total */}
              <div className="mt-5 pt-5 border-t border-gray-700">
                <p className="text-gray-400 text-sm font-semibold mb-3 uppercase tracking-wide">
                  Distribución Total del Turno
                </p>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
                  {[
                    {
                      label: "Meseros",
                      pct: "46.67%",
                      amount: summary.totalTipsNet * 0.4667,
                      color: "green",
                    },
                    {
                      label: "Barra",
                      pct: "20.00%",
                      amount: summary.totalTipsNet * 0.2,
                      color: "purple",
                    },
                    {
                      label: "Garrotero",
                      pct: "13.33%",
                      amount: summary.totalTipsNet * 0.1333,
                      color: "orange",
                    },
                    {
                      label: "Encargado",
                      pct: "13.33%",
                      amount: summary.totalTipsNet * 0.1333,
                      color: "yellow",
                    },
                    {
                      label: "Caja",
                      pct: "6.67%",
                      amount: summary.totalTipsNet * 0.0667,
                      color: "blue",
                    },
                  ].map((item) => (
                    <div
                      key={item.label}
                      className={`bg-${item.color}-900/20 border border-${item.color}-500/30 rounded-lg p-4 text-center`}
                    >
                      <p
                        className={`text-${item.color}-400 font-bold text-sm mb-1`}
                      >
                        {item.label}
                      </p>
                      <p className={`text-${item.color}-300 font-bold text-xl`}>
                        {formatCurrency(item.amount)}
                      </p>
                      <p className="text-gray-500 text-xs mt-1">{item.pct}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ── Resumen Final ─────────────────────────────────────────────── */}
          <div className="bg-gradient-to-r from-red-500/10 to-red-600/10 border-2 border-red-600/30 rounded-xl p-6">
            <h3 className="text-2xl font-bold mb-4 text-red-500 text-center">
              💰 Resumen del Turno
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-center">
              <div>
                <p className="text-gray-400 text-sm mb-1">Total Vendido</p>
                <p className="text-3xl font-bold text-white">
                  {formatCurrency(summary.totalSales)}
                </p>
              </div>
              <div>
                <p className="text-gray-400 text-sm mb-1">
                  Propinas a Repartir
                </p>
                <p className="text-3xl font-bold text-red-400">
                  {formatCurrency(summary.totalTipsNet)}
                </p>
              </div>
              <div>
                <p className="text-gray-400 text-sm mb-1">Cuentas / Personas</p>
                <p className="text-3xl font-bold text-blue-400">
                  {summary.totalOrders} / {summary.totalPeople}
                </p>
              </div>
            </div>
          </div>

          {/* Mensaje vacío */}
          {summary.totalOrders === 0 && (
            <div className="text-center py-8 mt-6 bg-gray-800/50 rounded-xl border border-gray-700">
              <Package className="mx-auto text-gray-600 mb-3" size={48} />
              <p className="text-gray-400 text-lg">
                No hay ventas registradas en este turno
              </p>
              <p className="text-gray-500 text-sm mt-2">
                Turno: {shiftStart.toLocaleDateString("es-ES")} 5:00 PM –{" "}
                {shiftEnd.toLocaleDateString("es-ES")} 5:00 AM
              </p>
            </div>
          )}
        </>
      ) : null}

      {/* Hidden printable component */}
      <div style={{ display: "none" }}>
        <PrintableDailySummary
          ref={printRef}
          summary={summary}
          shiftStart={shiftStart}
          shiftEnd={shiftEnd}
          expenses={{
            dj: djExpense || 0,
            variety: varietyExpense || 0,
            extra: extraExpense || 0,
            extraDesc: extraExpenseDesc,
          }}
        />
      </div>
    </div>
  );
};

export default DailySummary;
