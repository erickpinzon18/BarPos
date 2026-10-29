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
  onSnapshot,
} from "firebase/firestore";
import { toast } from "react-hot-toast";
import { db } from "../../services/firebase";
import type { Order, OrderItem } from "../../utils/types";
import { getProducts } from "../../services/firestoreService";
import {
  Calendar,
  DollarSign,
  Package,
  Users,
  TrendingUp,
  Clock,
  Printer,
  BarChart2,
  FileText,
  Receipt,
  Download,
} from "lucide-react";
import { sendToPrinter } from "../../utils/printTicket";
import { PrintableDailySummary } from "../../components/admin/PrintableDailySummary";
import { useActiveOrders } from "../../hooks/useOrders";
import { exportShiftReportToExcel } from "../../utils/exportExcel";
import { getShiftRange, getCurrentShiftDate, shiftDateKey, SHIFT_START_LABEL, SHIFT_END_LABEL } from '../../utils/shift';
import { tableLabel as formatTableLabel } from '../../utils/tableLabel';

// Ya no se descuenta comisión de tarjeta a las propinas: la propina es la completa.
const CARD_COMMISSION_RATE = 0;

// ── DEMO / AULA ────────────────────────────────────────────────────────────
// El modo demo ya NO se controla desde aquí. Se activa/desactiva desde el
// portal externo (/control.html) y se lee en tiempo real del documento
// Firestore `config/demoCash` = { enabled: boolean, factor: number }.
const DEMO_CASH_FACTOR_DEFAULT = 0.85;

interface Gasto {
  id: string;
  concepto: string;
  monto: number;
}

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

  // Comisión bancaria (5% solo de la propina en pagos 100% tarjeta — no aplica a mixto)
  cardCommission: number; // tipsCard × 5% — solo órdenes con paymentMethod === 'tarjeta'

  // Propinas netas ya descontando comisión
  tipsCardNet: number; // tipsCard - cardCommission
  tipsNet: number; // tipsCash + tipsTransfer + tipsCardNet — lo que realmente se reparte

  waiterShare: number; // 46.67%
  barShare: number; // 20.00%
  busserShare: number; // 13.33%
  managerShare: number; // 13.33%
  cashierShare: number; // 6.67%

  orders: Order[]; // órdenes individuales del mesero para vista de detalle
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

// Propina de mesero por unidad: la copiada al item al pedirlo o, si no la trae
// (pedidos de antes del cambio), la del catálogo actual. null = pendiente de definir.
type TipCatalog = Map<string, number | null>;
const itemTipPerUnit = (i: OrderItem, catalog: TipCatalog): number | null =>
  typeof i.tipPerUnit === 'number' ? i.tipPerUnit : (catalog.get(i.productId) ?? null);

// Agrupa los productos vendidos (sin eliminados) de un conjunto de órdenes
const getSoldProducts = (orders: Order[], catalog: TipCatalog) => {
  const map = new Map<string, { name: string; quantity: number; amount: number; tip: number; tipPending: boolean }>();
  orders.forEach(o => {
    (o.items || []).forEach(i => {
      if (i.isDeleted) return;
      const qty = i.quantity ?? 1;
      const row = map.get(i.productName) ?? { name: i.productName, quantity: 0, amount: 0, tip: 0, tipPending: false };
      row.quantity += qty;
      row.amount += (i.productPrice ?? 0) * qty;
      const tpu = itemTipPerUnit(i, catalog);
      if (tpu === null) row.tipPending = true; else row.tip += tpu * qty;
      map.set(i.productName, row);
    });
  });
  return [...map.values()].sort((a, b) => b.amount - a.amount);
};

// Lo que le toca al mesero según la tabla de propinas por producto
const getWaiterTableTip = (orders: Order[], catalog: TipCatalog) => {
  const products = getSoldProducts(orders, catalog);
  return {
    amount: products.reduce((s, p) => s + p.tip, 0),
    pending: products.filter(p => p.tipPending).map(p => p.name),
  };
};

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


const DailySummary: React.FC = () => {
  // Función para obtener la fecha del turno actual

  const [summary, setSummary] = useState<ShiftSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState<Date>(getCurrentShiftDate());
  const [waiterTab, setWaiterTab] = useState<'resumen' | 'detalle'>('resumen');
  const [tipCatalog, setTipCatalog] = useState<TipCatalog>(new Map());

  useEffect(() => {
    getProducts().then(res => {
      if (!res.success || !res.data) return;
      setTipCatalog(new Map(res.data.map(p => [p.id, typeof p.tipPerUnit === 'number' ? p.tipPerUnit : null])));
    });
  }, []);
  const [pendingTab, setPendingTab] = useState<'resumen' | 'detalle'>('resumen');

  // Gastos del Turno — lista de conceptos con su monto
  const [gastos, setGastos] = useState<Gasto[]>([]);
  const [gastoConceptoInput, setGastoConceptoInput] = useState("");
  const [gastoMontoInput, setGastoMontoInput] = useState("");
  const [savingExpenses, setSavingExpenses] = useState(false);

  // Órdenes crudas del turno (para detalle de tickets y export a Excel)
  const [shiftOrders, setShiftOrders] = useState<Order[]>([]);

  // ── Config demo (controlado desde el portal externo /control.html) ──────────
  const [demoMode, setDemoMode] = useState<boolean>(false);
  const [demoFactor, setDemoFactor] = useState<number>(DEMO_CASH_FACTOR_DEFAULT);
  const adjCash = (n: number) => (demoMode ? n * demoFactor : n);

  useEffect(() => {
    const unsub = onSnapshot(doc(db, "config", "demoCash"), (snap) => {
      const data = snap.data();
      setDemoMode(Boolean(data?.enabled));
      setDemoFactor(
        typeof data?.factor === "number" ? data.factor : DEMO_CASH_FACTOR_DEFAULT
      );
    });
    return unsub;
  }, []);

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

  useEffect(() => {
    if (shiftActiveOrders.length === 0) {
      console.log(`⏳ SALDO POR COBRAR — Turno ${shiftStart.toLocaleDateString('es-MX')}: sin mesas activas en este turno`);
      return;
    }
    console.group(`⏳ SALDO POR COBRAR — Turno ${shiftStart.toLocaleDateString('es-MX')} (${shiftActiveOrders.length} mesas activas)`);
    console.log(`Rango del turno: ${shiftStart.toLocaleString('es-MX')} → ${shiftEnd.toLocaleString('es-MX')}`);
    let total = 0;
    shiftActiveOrders.forEach(order => {
      const activeItems = order.items?.filter(i => !i.isDeleted) || [];
      const orderTotal = activeItems.reduce((s, i) => s + (i.productPrice || 0) * (i.quantity || 0), 0);
      total += orderTotal;
      const tableLabel = order.tableNumber === 0 ? 'Barra' : formatTableLabel(order.tableNumber);
      console.group(`${tableLabel}${order.tableName ? ` (${order.tableName})` : ''} — $${orderTotal.toFixed(2)}`);
      console.log('ID orden:', order.id);
      console.log('Mesero:', order.waiterName || '—', '| ID:', order.waiterId || '—');
      console.log('Abierta desde:', order.createdAt ? new Date(order.createdAt).toLocaleString('es-MX') : '—');
      console.log('Personas:', order.peopleCount ?? 1);
      const allItems = order.items || [];
      const deletedItems = allItems.filter(i => i.isDeleted);
      console.log(`Items activos (${activeItems.length}):`);
      activeItems.forEach(i => {
        console.log(`  ✅ ${i.productName} x${i.quantity} = $${((i.productPrice || 0) * (i.quantity || 0)).toFixed(2)}`);
      });
      if (deletedItems.length > 0) {
        console.log(`Items eliminados/devueltos (${deletedItems.length}) — NO cuentan en el saldo:`);
        deletedItems.forEach(i => {
          console.log(`  ❌ ${i.productName} x${i.quantity} = $${((i.productPrice || 0) * (i.quantity || 0)).toFixed(2)} | isDeleted: ${i.isDeleted} | razón: ${(i as any).cancelReason || (i as any).deletedByName || '—'}`);
        });
      }
      console.groupEnd();
    });
    console.log(`TOTAL SALDO POR COBRAR: $${total.toFixed(2)}`);
    console.groupEnd();
  }, [shiftActiveOrders, selectedDate]);

  /** Resuelve el monto de un pago individual, con fallback para pagos únicos antiguos sin `amount`. */
  const getPaymentAmount = (order: Order, payment: NonNullable<Order["payments"]>[number]): number => {
    if (typeof payment.amount === "number") return payment.amount;
    if (Array.isArray(order.payments) && order.payments.length === 1) return order.total ?? 0;
    return 0;
  };

  // Desglose de cargos con tarjeta por tipo (Visa/Mastercard/Amex/Otra)
  const cardTypeBreakdown = React.useMemo(() => {
    const map: Record<string, number> = {};
    shiftOrders.forEach((order) => {
      (order.payments || []).forEach((p) => {
        if (p.method === "tarjeta") {
          const key = p.cardType || "Otra";
          map[key] = (map[key] || 0) + getPaymentAmount(order, p);
        }
      });
    });
    return map;
  }, [shiftOrders]);

  // Detalle de tickets del turno, ordenado por secuencia de folio (consecutivo)
  const ticketDetails = React.useMemo(() => {
    return shiftOrders
      .slice()
      .sort((a, b) => (a.folioSeq ?? 0) - (b.folioSeq ?? 0))
      .map((o) => ({
        folio: o.folio,
        folioSeq: o.folioSeq,
        id: o.id,
        table: o.tableNumber === 0 ? "Barra" : formatTableLabel(o.tableNumber),
        waiter: o.waiterName,
        method: o.paymentMethod,
        total: o.total ?? 0,
        // Comisión del mesero (tabla) y propina de la cuenta
        commission: getSoldProducts([o], tipCatalog).reduce((sum, p) => sum + p.tip, 0),
        tip: typeof o.tipAmount === "number"
          ? o.tipAmount
          : Math.max(0, (o.total ?? 0) - (o.subtotal ?? 0) + ((o as any).discount ?? 0)),
        cashNotes: o.cashNotes,
      }));
  }, [shiftOrders, tipCatalog]);

  // Rango de folios del turno (primer y último folio asignado, en orden de secuencia)
  const folioRange = React.useMemo(() => {
    const withFolio = ticketDetails.filter((t) => t.folio);
    if (withFolio.length === 0) return null;
    return { first: withFolio[0].folio as string, last: withFolio[withFolio.length - 1].folio as string };
  }, [ticketDetails]);

  const handlePrintPDF = useReactToPrint({
    contentRef: printRef,
    documentTitle: `Cierre_Caja_${shiftDateKey(selectedDate)}`,
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

      setShiftOrders(ordersData);

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
          // Distribute the order tip proportionally by payment amount to avoid
          // double-counting from old orders that stored tipAmount on every payment entry.
          const totalPaymentAmt = order.payments.reduce((s, p) => s + (p.amount ?? 0), 0);
          order.payments.forEach((p) => {
            const pAmt = p.amount ?? 0;
            const pTip = totalPaymentAmt > 0 ? tip * (pAmt / totalPaymentAmt) : 0;
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

        // Comisión: 5% de la propina, SOLO para pagos 100% tarjeta (no mixto, no efectivo)
        const isPureCard = order.paymentMethod === 'tarjeta';
        const cardCommission = isPureCard ? cardTip * CARD_COMMISSION_RATE : 0;
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
            orders: [],
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
        ws.orders.push(order);
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

      // ── DEBUG LOGS ─────────────────────────────────────────────────────────
      console.group("📊 CIERRE DE CAJA — Desglose completo");

      console.group("💰 VENTAS TOTALES");
      console.log("Total cobrado (subtotal + propinas):", summary.totalSales.toFixed(2));
      console.log("  Subtotal (comida/bebida):", summary.totalSubtotal.toFixed(2));
      console.log("  Propinas brutas:", summary.totalTips.toFixed(2));
      console.groupEnd();

      console.group("💳 MÉTODOS DE PAGO");
      console.log("Efectivo (incluye propinas):", summary.paymentMethods.efectivo.toFixed(2));
      console.log("Tarjeta  (incluye propinas):", summary.paymentMethods.tarjeta.toFixed(2));
      console.log("Transferencia:", summary.paymentMethods.transferencia.toFixed(2));
      console.log("SUMA métodos:", (summary.paymentMethods.efectivo + summary.paymentMethods.tarjeta + summary.paymentMethods.transferencia).toFixed(2), " ← debe = Total cobrado");
      console.groupEnd();

      console.group("🎯 PROPINAS POR MÉTODO");
      console.log("Propinas en efectivo (brutas):", summary.totalCashTips.toFixed(2));
      console.log("Propinas en tarjeta  (brutas):", summary.totalCardTips.toFixed(2));
      console.log("Propinas transferencia:", summary.totalTransferTips.toFixed(2));
      const sumaMetodos = summary.totalCashTips + summary.totalCardTips + summary.totalTransferTips;
      const propinasNoAtribuidas = summary.totalTips - sumaMetodos;
      console.log("SUMA propinas por método:", sumaMetodos.toFixed(2));
      console.log("Propinas brutas totales:", summary.totalTips.toFixed(2));
      console.log("⚠️  Propinas NO atribuidas a método (cuentas mixtas):", propinasNoAtribuidas.toFixed(2));
      console.groupEnd();

      console.group("🏦 COMISIÓN TARJETA (5% solo de propina en pago puro tarjeta)");
      console.log("Cargo total por terminal:", summary.paymentMethods.tarjeta.toFixed(2));
      console.log("Propinas tarjeta brutas (solo pagos puros):", summary.totalCardTips.toFixed(2));
      console.log("Comisión 5% =", summary.totalCardCommission.toFixed(2), " ←", summary.totalCardTips.toFixed(2), "× 0.05");
      console.log("Propinas tarjeta netas:", summary.totalCardTipsNet.toFixed(2), " ← brutas − comisión");
      console.groupEnd();

      console.group("✅ PROPINAS A REPARTIR");
      console.log("Propinas tarjeta (neta):", summary.totalCardTipsNet.toFixed(2));
      console.log("Propinas efect/transf:", (summary.totalCashTips + summary.totalTransferTips).toFixed(2));
      console.log("Propinas mixtas no atribuidas:", propinasNoAtribuidas.toFixed(2));
      console.log("TOTAL A REPARTIR (totalTipsNet):", summary.totalTipsNet.toFixed(2));
      console.log("CHECK — totalTipsNet debe = tarjeta neta + efect/transf + mixtas:", (summary.totalCardTipsNet + summary.totalCashTips + summary.totalTransferTips + propinasNoAtribuidas).toFixed(2));
      console.groupEnd();

      console.group("👨‍🍳 POR MESERO");
      summary.waiterStats.forEach(w => {
        console.group(w.waiterName);
        console.log("Ventas totales:", w.totalSales.toFixed(2));
        console.log("  Efectivo:", w.salesCash.toFixed(2), "| Tarjeta:", w.salesCard.toFixed(2), "| Transf:", w.salesTransfer.toFixed(2));
        console.log("Propinas brutas:", w.totalTips.toFixed(2));
        console.log("  Propinas efect:", w.tipsCash.toFixed(2), "| Propinas tarjeta:", w.tipsCard.toFixed(2), "| Propinas transf:", w.tipsTransfer.toFixed(2));
        console.log("Comisión tarjeta (5% de", w.salesCard.toFixed(2), "):", w.cardCommission.toFixed(2));
        console.log("Propinas netas a repartir:", w.tipsNet.toFixed(2));
        console.log("  Mesero (46.67%):", w.waiterShare.toFixed(2));
        console.log("  Barra  (20.00%):", w.barShare.toFixed(2));
        console.log("  Garrot (13.33%):", w.busserShare.toFixed(2));
        console.log("  Encarg (13.33%):", w.managerShare.toFixed(2));
        console.log("  Caja   ( 6.67%):", w.cashierShare.toFixed(2));
        console.groupEnd();
      });
      console.groupEnd();

      console.groupEnd(); // CIERRE DE CAJA

      // Fetch shift expenses
      const shiftDateStr = shiftDateKey(selectedDate);
      const expensesRef = doc(db, "shiftExpenses", shiftDateStr);
      const expensesSnap = await getDoc(expensesRef);
      if (expensesSnap.exists()) {
        const d = expensesSnap.data();
        setGastos(Array.isArray(d.gastos) ? d.gastos : []);
      } else {
        setGastos([]);
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

  const gastosTotal = gastos.reduce((s, g) => s + g.monto, 0);

  const saveGastosToDB = async (list: Gasto[]) => {
    setSavingExpenses(true);
    try {
      const shiftDateStr = shiftDateKey(selectedDate);
      await setDoc(doc(db, "shiftExpenses", shiftDateStr), { gastos: list }, { merge: true });
    } catch (error) {
      console.error(error);
      toast.error("Error al guardar gastos");
    } finally {
      setSavingExpenses(false);
    }
  };

  const handleAddGasto = () => {
    const monto = Number(gastoMontoInput);
    if (!gastoConceptoInput.trim() || !monto || monto <= 0) {
      toast.error("Ingresa concepto y monto válidos.");
      return;
    }
    const next: Gasto[] = [
      ...gastos,
      {
        id: `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        concepto: gastoConceptoInput.trim(),
        monto,
      },
    ];
    setGastos(next);
    setGastoConceptoInput("");
    setGastoMontoInput("");
    void saveGastosToDB(next);
  };

  const handleRemoveGasto = (id: string) => {
    const next = gastos.filter((g) => g.id !== id);
    setGastos(next);
    void saveGastosToDB(next);
  };

  const formatCurrency = (n: number) => `$${n.toFixed(2)}`;

  // ── Valores ajustados para demo mode ──────────────────────────────────────
  const cashReduction = demoMode && summary
    ? summary.paymentMethods.efectivo * (1 - demoFactor)
    : 0;
  const dTotalSales    = summary ? summary.totalSales - cashReduction : 0;
  const dTotalSubtotal = summary ? summary.totalSubtotal - cashReduction : 0;
  const dAvgOrderValue    = summary && summary.totalOrders > 0 ? dTotalSales / summary.totalOrders : 0;
  const dAvgSalePerPerson = summary && summary.totalPeople > 0 ? dTotalSales / summary.totalPeople : 0;
  const adjWaiterSales = (w: WaiterStats) =>
    w.totalSales - (demoMode ? w.salesCash * (1 - demoFactor) : 0);
  // Lo vendido en productos (sin propina del cliente; el precio ya incluye la comisión)
  const adjWaiterProducts = (w: WaiterStats) => adjWaiterSales(w) - w.totalTips;
  // Comisión que se le paga en efectivo a cada mesero (tabla por producto): se descuenta del efectivo
  const waiterCommissionTotal = summary
    ? summary.waiterStats.reduce((s, w) => s + getWaiterTableTip(w.orders, tipCatalog).amount, 0)
    : 0;
  const cashInRegisterValue = summary
    ? adjCash(summary.paymentMethods.efectivo) - summary.totalTipsNet - waiterCommissionTotal
    : 0;

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
    if (folioRange) {
      lines.push(fmtLine("Folios:", `${folioRange.first} - ${folioRange.last}`));
    }
    lines.push("");
    lines.push(sep());

    // ── Ventas Generales ────────────────────────────────────────────────────
    lines.push(center("VENTAS GENERALES"));
    lines.push(sep());
    lines.push(fmtLine("Total cobrado:", fmtM(dTotalSales)));
    lines.push(fmtLine("Productos:", fmtM(dTotalSubtotal)));
    lines.push(fmtLine("Propinas:", fmtM(summary.totalTips)));
    lines.push("  (promos 10% + autorizadas)");
    lines.push(fmtLine("Comisiones:", fmtM(waiterCommissionTotal)));
    lines.push("  (incluidas en el precio)");
    lines.push("");

    // ── Métodos de Pago ─────────────────────────────────────────────────────
    lines.push(center("METODOS DE PAGO"));
    lines.push(sep());
    lines.push(
      fmtLine("Efectivo (Total):", fmtM(adjCash(summary.paymentMethods.efectivo)))
    );
    lines.push(fmtLine("  -Propinas:", `-${fmtM(summary.totalTipsNet)}`));
    lines.push(fmtLine("  -Comisiones:", `-${fmtM(waiterCommissionTotal)}`));
    const cashInRegister = cashInRegisterValue;
    lines.push(fmtLine("  Efectivo en caja:", fmtM(cashInRegister)));
    lines.push(fmtLine("Tarjeta:", fmtM(summary.paymentMethods.tarjeta)));
    lines.push(
      fmtLine("Transferencia:", fmtM(summary.paymentMethods.transferencia))
    );
    lines.push(sep("-"));
    lines.push(
      fmtLine(
        "GRAN TOTAL:",
        fmtM(
          summary.paymentMethods.efectivo +
            summary.paymentMethods.tarjeta +
            summary.paymentMethods.transferencia
        )
      )
    );
    lines.push("");

    // ── Desglose de Tarjeta por Tipo ─────────────────────────────────────────
    if (Object.keys(cardTypeBreakdown).length > 0) {
      lines.push(center("TARJETA POR TIPO"));
      lines.push(sep());
      Object.entries(cardTypeBreakdown).forEach(([type, amount]) => {
        lines.push(fmtLine(`  ${type}:`, fmtM(amount)));
      });
      lines.push("");
    }

    // ── Gastos del Turno ────────────────────────────────────────────────────
    const totalExpenses = gastosTotal;
    if (totalExpenses > 0) {
      lines.push(center("GASTOS DEL TURNO"));
      lines.push(sep());
      gastos.forEach((g) => {
        lines.push(fmtLine(`${g.concepto}:`, `-${fmtM(g.monto)}`));
      });
      lines.push(sep("-"));
      lines.push(fmtLine("Total Gastos:", `-${fmtM(totalExpenses)}`));
      lines.push(
        fmtLine("EFECTIVO FINAL EN CAJA:", fmtM(cashInRegister - totalExpenses))
      );
      lines.push("");
    }

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
      fmtLine("Promedio venta/persona:", fmtM(dAvgSalePerPerson))
    );
    lines.push(
      fmtLine("Promedio venta/ticket:", fmtM(dAvgOrderValue))
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
        lines.push(fmtLine("Vendido:", fmtM(adjWaiterProducts(w))));
        lines.push(fmtLine("Propina:", fmtM(w.totalTips)));
        lines.push(fmtLine("Total cobrado:", fmtM(adjWaiterSales(w))));
        lines.push("");
        // Productos con su comisión
        const products = getSoldProducts(w.orders, tipCatalog);
        products.forEach((p) => {
          lines.push(`${p.quantity}x ${p.name}`.slice(0, CHARS_80MM));
          lines.push(fmtLine(`   ${fmtM(p.amount)}`, p.tipPending ? "com. pend." : `com ${fmtM(p.tip)}`));
        });
        const wt = getWaiterTableTip(w.orders, tipCatalog);
        lines.push(sep("-"));
        lines.push(fmtLine("Comision:", fmtM(wt.amount)));
        if (wt.pending.length > 0) lines.push(`  (${wt.pending.length} prod. sin comision)`);
        lines.push(fmtLine("Propina:", fmtM(w.totalTips)));
        lines.push(fmtLine("A ENTREGAR:", fmtM(wt.amount + w.totalTips)));
        lines.push("");
        lines.push("Firma: ______________________");
        lines.push(sep());
      });
      lines.push("");

      // ── Resumen de pago a meseros ──────────────────────────────────────────
      lines.push(center("PAGO A MESEROS"));
      lines.push(sep());
      let totalPayout = 0;
      summary.waiterStats.forEach((w) => {
        const amount = getWaiterTableTip(w.orders, tipCatalog).amount + w.totalTips;
        totalPayout += amount;
        lines.push(fmtLine(`${w.waiterName}:`.slice(0, 19), fmtM(amount)));
      });
      lines.push(sep("-"));
      lines.push(fmtLine("TOTAL:", fmtM(totalPayout)));
      lines.push("  (comisiones + propinas)");
      lines.push("");
    }

    // ── Detalle de Tickets (folios consecutivos) ─────────────────────────────
    if (ticketDetails.length > 0) {
      lines.push(center("DETALLE DE TICKETS"));
      lines.push(sep("="));
      ticketDetails.forEach((t) => {
        const folioLabel = t.folio ? `Folio ${t.folio}` : t.id.slice(0, 6).toUpperCase();
        lines.push(fmtLine(`${folioLabel} — ${t.table}`, fmtM(t.total)));
        lines.push(`  ${t.waiter ?? "-"} · ${t.method ?? "-"}`);
        if (t.commission > 0 || t.tip > 0) {
          lines.push(`  Com ${fmtM(t.commission)} · Prop ${fmtM(t.tip)}`);
        }
        if (t.cashNotes) {
          lines.push(`  Nota: ${t.cashNotes}`);
        }
      });
      lines.push(sep());
      lines.push("");
    }

    // ── Firma de recepción de efectivo ────────────────────────────────────────
    lines.push(sep("="));
    lines.push(center("RECIBI EFECTIVO"));
    lines.push(sep("="));
    lines.push("");
    lines.push("Nombre: _____________________________");
    lines.push("");
    lines.push("Firma:  _____________________________");
    lines.push("");
    lines.push(center("(Este es el original)"));
    lines.push("");

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
            <button
              onClick={() =>
                exportShiftReportToExcel(
                  shiftOrders,
                  { ...summary, waiterCommissionTotal },
                  cardTypeBreakdown,
                  { gastos },
                  shiftStart,
                  shiftEnd
                )
              }
              className="flex items-center gap-2 bg-green-700 hover:bg-green-600 text-white font-bold px-4 py-2.5 rounded-xl transition-colors shadow-lg text-sm"
            >
              <Download size={18} />
              Exportar a Excel
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
            value={shiftDateKey(selectedDate)}
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
              {SHIFT_START_LABEL}
              {" → "}
              {shiftEnd.toLocaleDateString("es-ES", {
                day: "numeric",
                month: "short",
              })}{" "}
              {SHIFT_END_LABEL}
            </span>
          </div>
          {folioRange && (
            <div className="flex items-center gap-2 text-sm text-gray-300 md:ml-auto">
              <FileText size={16} />
              <span>
                Folios: <span className="font-mono font-semibold text-white">{folioRange.first}</span>
                {" — "}
                <span className="font-mono font-semibold text-white">{folioRange.last}</span>
              </span>
            </div>
          )}
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
                {formatCurrency(dTotalSales)}
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
                  value: formatCurrency(dAvgSalePerPerson),
                  sub: "promedio",
                },
                {
                  label: "Venta / Ticket",
                  value: formatCurrency(dAvgOrderValue),
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

          {/* ── Métodos de Pago ───────────────────────────────────────────── */}
          <div className="grid grid-cols-1 gap-6 mb-6">
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
                      {formatCurrency(adjCash(summary.paymentMethods.efectivo))}
                    </span>
                  </div>
                  <div className="flex justify-between items-center pl-4 text-sm mt-1">
                    <span className="text-gray-400">— Propinas (Todas)</span>
                    <span className="text-gray-400 font-semibold">
                      -{formatCurrency(summary.totalTipsNet)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center pl-4 text-sm mt-1">
                    <span className="text-gray-400">— Comisiones meseros</span>
                    <span className="text-gray-400 font-semibold">
                      -{formatCurrency(waiterCommissionTotal)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center pl-4 text-sm border-t border-gray-600 pt-1 mt-1">
                    <span className="text-green-400 font-medium">
                      Efectivo en caja
                    </span>
                    <span className="text-green-400 font-bold">
                      {formatCurrency(cashInRegisterValue)}
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
                <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto_auto] gap-2">
                  <input
                    type="text"
                    value={gastoConceptoInput}
                    onChange={(e) => setGastoConceptoInput(e.target.value)}
                    placeholder="Concepto (ej. DJ, Variedad, Hielo...)"
                    className="bg-gray-700 border border-gray-600 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-red-500"
                  />
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <span className="text-gray-500">$</span>
                    </div>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={gastoMontoInput}
                      onChange={(e) => setGastoMontoInput(e.target.value)}
                      placeholder="0.00"
                      className="w-full sm:w-32 bg-gray-700 border border-gray-600 rounded-lg pl-7 pr-3 py-2 text-white text-sm focus:outline-none focus:border-red-500"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={handleAddGasto}
                    disabled={savingExpenses}
                    className="bg-red-600 hover:bg-red-700 text-white font-semibold px-4 py-2 rounded-lg text-sm transition-colors disabled:opacity-50"
                  >
                    + Agregar
                  </button>
                </div>

                {gastos.length > 0 ? (
                  <div className="space-y-2">
                    {gastos.map((g) => (
                      <div
                        key={g.id}
                        className="flex items-center justify-between bg-gray-900/60 rounded-lg px-3 py-2 text-sm"
                      >
                        <span className="text-white font-medium">{g.concepto}</span>
                        <div className="flex items-center gap-3">
                          <span className="text-red-400 font-semibold">-{formatCurrency(g.monto)}</span>
                          <button
                            onClick={() => handleRemoveGasto(g.id)}
                            className="text-red-400 hover:text-red-300 text-xs"
                          >
                            Quitar
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-gray-500 text-center py-2">
                    Sin gastos registrados para este turno.
                  </p>
                )}

                <div className="mt-4 p-4 bg-gray-900/60 rounded-xl border border-gray-700">
                  <div className="flex justify-between items-center text-sm mb-2">
                    <span className="text-gray-400">Efectivo en caja</span>
                    <span className="text-gray-300 font-medium">
                      {formatCurrency(cashInRegisterValue)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center text-sm mb-2">
                    <span className="text-gray-400">Total Gastos</span>
                    <span className="text-red-400 font-medium">
                      -{formatCurrency(gastosTotal)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center border-t border-gray-700 pt-2 mt-2">
                    <span className="text-green-400 font-bold">
                      Efectivo Final en Caja
                    </span>
                    <span className="text-green-400 font-bold text-lg">
                      {formatCurrency(cashInRegisterValue - gastosTotal)}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Saldo Por Cobrar */}
            <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
              <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
                <h3 className="text-xl font-bold text-white flex items-center gap-2">
                  <Clock className="text-orange-500" size={20} />
                  Saldo Por Cobrar
                </h3>
                <div className="flex bg-gray-700 rounded-lg p-1 gap-1">
                  <button
                    onClick={() => setPendingTab('resumen')}
                    className={`px-3 py-1 rounded-md text-sm font-semibold transition-colors ${pendingTab === 'resumen' ? 'bg-orange-500 text-white' : 'text-gray-400 hover:text-white'}`}
                  >
                    Resumen
                  </button>
                  <button
                    onClick={() => setPendingTab('detalle')}
                    className={`px-3 py-1 rounded-md text-sm font-semibold transition-colors ${pendingTab === 'detalle' ? 'bg-orange-500 text-white' : 'text-gray-400 hover:text-white'}`}
                  >
                    Detalle
                  </button>
                </div>
              </div>

              {pendingTab === 'resumen' ? (
                <div className="bg-gradient-to-br from-orange-500/10 to-orange-600/5 rounded-xl p-6 flex flex-col items-center justify-center text-center border border-orange-500/20">
                  <p className="text-sm text-gray-400 mb-2">Total regado en mesas</p>
                  <p className="text-5xl font-bold text-orange-400 mb-4">
                    {formatCurrency(livePendingBalance)}
                  </p>
                  <div className="bg-gray-900/60 border border-gray-700 rounded-lg px-4 py-2 inline-block mb-6">
                    <span className="text-white font-medium">{livePendingOrders}</span>
                    <span className="text-gray-400 ml-2">Mesas activas</span>
                  </div>
                  <div className="w-full grid grid-cols-2 gap-4 border-t border-orange-500/20 pt-4">
                    <div>
                      <p className="text-xs text-gray-400 mb-1">Ya Cobrado</p>
                      <p className="text-xl font-bold text-green-400">
                        {formatCurrency(dTotalSales)}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-400 mb-1">Proyección Total</p>
                      <p className="text-xl font-bold text-blue-400">
                        {formatCurrency(dTotalSales + livePendingBalance)}
                      </p>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
                  {shiftActiveOrders.length === 0 ? (
                    <div className="text-center py-8 text-gray-500">
                      <Clock size={32} className="mx-auto mb-2 opacity-40" />
                      <p>No hay mesas activas en este turno</p>
                    </div>
                  ) : (
                    <>
                      {shiftActiveOrders
                        .slice()
                        .sort((a, b) => {
                          const aTime = a.createdAt instanceof Date ? a.createdAt.getTime() : new Date(a.createdAt).getTime();
                          const bTime = b.createdAt instanceof Date ? b.createdAt.getTime() : new Date(b.createdAt).getTime();
                          return bTime - aTime;
                        })
                        .map(order => {
                          const activeItems = (order.items || []).filter(i => !i.isDeleted);
                          const orderTotal = activeItems.reduce((s, i) => s + i.productPrice * i.quantity, 0);
                          const tableLabel = order.tableNumber === 0 ? 'Barra' : formatTableLabel(order.tableNumber);
                          return (
                            <div key={order.id} className="bg-gray-700/40 border border-gray-600/50 rounded-lg p-3">
                              <div className="flex items-center justify-between mb-2">
                                <div>
                                  <span className="text-white font-semibold text-sm">{tableLabel}</span>
                                  {order.tableName && (
                                    <span className="text-gray-500 text-xs ml-1">({order.tableName})</span>
                                  )}
                                  <span className="text-gray-400 text-xs ml-2">· {order.waiterName}</span>
                                  <p className="text-gray-600 text-xs mt-0.5">
                                    Abierta{" "}
                                    {order.createdAt
                                      ? new Date(order.createdAt).toLocaleTimeString("es-MX", {
                                          hour: "2-digit",
                                          minute: "2-digit",
                                          hour12: false,
                                        })
                                      : "—"}
                                  </p>
                                </div>
                                <span className="text-orange-400 font-bold text-sm">{formatCurrency(orderTotal)}</span>
                              </div>
                              <div className="space-y-0.5">
                                {activeItems.map(item => (
                                  <div key={item.id} className="flex justify-between text-xs text-gray-400">
                                    <span>{item.quantity}× {item.productName}</span>
                                    <span>{formatCurrency(item.productPrice * item.quantity)}</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          );
                        })
                      }
                      <div className="sticky bottom-0 bg-gray-800 border-t border-orange-500/30 pt-2 mt-2 flex justify-between items-center text-sm font-bold">
                        <span className="text-gray-300">{livePendingOrders} mesas abiertas</span>
                        <span className="text-orange-400">{formatCurrency(livePendingBalance)}</span>
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* ── Corte por Mesero: vendido, propina y total ─────────────────── */}
          {summary.waiterStats && summary.waiterStats.length > 0 && (
            <div className="bg-gray-800 rounded-xl p-6 border border-gray-700 mb-6">
              {/* Header + tabs */}
              <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
                <h3 className="text-xl font-bold text-white flex items-center gap-2">
                  <Users className="text-red-500" size={20} />
                  Corte por Mesero
                </h3>
                <div className="flex bg-gray-700 rounded-lg p-1 gap-1">
                  <button
                    onClick={() => setWaiterTab('resumen')}
                    className={`px-4 py-1.5 rounded-md text-sm font-semibold transition-colors ${waiterTab === 'resumen' ? 'bg-red-600 text-white' : 'text-gray-400 hover:text-white'}`}
                  >
                    Resumen
                  </button>
                  <button
                    onClick={() => setWaiterTab('detalle')}
                    className={`px-4 py-1.5 rounded-md text-sm font-semibold transition-colors ${waiterTab === 'detalle' ? 'bg-red-600 text-white' : 'text-gray-400 hover:text-white'}`}
                  >
                    Lo vendido por persona
                  </button>
                </div>
              </div>

              {/* ── TAB: RESUMEN ── */}
              {waiterTab === 'resumen' && (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-700 text-gray-400 text-xs uppercase">
                        <th className="text-left px-4 py-2">Mesero</th>
                        <th className="text-right px-4 py-2">Cuentas</th>
                        <th className="text-right px-4 py-2">Personas</th>
                        <th className="text-right px-4 py-2">Vendido</th>
                        <th className="text-right px-4 py-2">Propina cliente</th>
                        <th className="text-right px-4 py-2">Total</th>
                        <th className="text-right px-4 py-2 text-green-400">Comisión a pagar</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-700/50">
                      {summary.waiterStats.map((waiter) => (
                        <tr key={waiter.waiterId} className="hover:bg-gray-700/30 transition-colors">
                          <td className="px-4 py-3 text-white font-semibold">{waiter.waiterName}</td>
                          <td className="px-4 py-3 text-right text-gray-300">{waiter.totalOrders}</td>
                          <td className="px-4 py-3 text-right text-gray-300">{waiter.totalPeople}</td>
                          <td className="px-4 py-3 text-right text-gray-200">{formatCurrency(adjWaiterProducts(waiter))}</td>
                          <td className="px-4 py-3 text-right text-gray-300">{formatCurrency(waiter.totalTips)}</td>
                          <td className="px-4 py-3 text-right text-white font-bold">{formatCurrency(adjWaiterSales(waiter))}</td>
                          <td className="px-4 py-3 text-right">
                            {(() => {
                              const t = getWaiterTableTip(waiter.orders, tipCatalog);
                              return (
                                <>
                                  <span className="text-green-400 font-bold">{formatCurrency(t.amount)}</span>
                                  {t.pending.length > 0 && (
                                    <p className="text-[11px] text-amber-400" title={t.pending.join(', ')}>
                                      + {t.pending.length} producto{t.pending.length > 1 ? 's' : ''} pendiente{t.pending.length > 1 ? 's' : ''}
                                    </p>
                                  )}
                                </>
                              );
                            })()}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="border-t-2 border-gray-600 bg-gray-700/40 font-bold">
                        <td className="px-4 py-3 text-white">TOTAL</td>
                        <td className="px-4 py-3 text-right text-gray-300">{summary.totalOrders}</td>
                        <td className="px-4 py-3 text-right text-gray-300">{summary.totalPeople}</td>
                        <td className="px-4 py-3 text-right text-gray-200">{formatCurrency(dTotalSubtotal)}</td>
                        <td className="px-4 py-3 text-right text-gray-300">{formatCurrency(summary.totalTips)}</td>
                        <td className="px-4 py-3 text-right text-white">{formatCurrency(dTotalSales)}</td>
                        <td className="px-4 py-3 text-right text-green-400">
                          {formatCurrency(waiterCommissionTotal)}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}

              {/* ── TAB: LO VENDIDO POR PERSONA ── */}
              {waiterTab === 'detalle' && (
                <div className="space-y-6">
                  {summary.waiterStats.map((waiter) => {
                    const products = getSoldProducts(waiter.orders, tipCatalog);
                    const waiterTip = products.reduce((s, p) => s + p.tip, 0);
                    const productsTotal = products.reduce((s, p) => s + p.amount, 0);
                    const sold = adjWaiterProducts(waiter);
                    const discounts = productsTotal - sold;
                    return (
                      <div key={waiter.waiterId} className="border border-gray-700 rounded-xl overflow-hidden">
                        <div className="bg-gray-700/60 px-5 py-3 flex items-center justify-between flex-wrap gap-3">
                          <div>
                            <p className="text-white font-bold text-base">{waiter.waiterName}</p>
                            <p className="text-gray-400 text-xs">{waiter.totalOrders} cuentas · {waiter.totalPeople} personas</p>
                          </div>
                          <div className="flex gap-5 text-right">
                            <div>
                              <p className="text-gray-400 text-xs">Vendido</p>
                              <p className="text-gray-200 font-bold">{formatCurrency(sold)}</p>
                            </div>
                            <div>
                              <p className="text-gray-400 text-xs">Propina cliente</p>
                              <p className="text-gray-300 font-bold">{formatCurrency(waiter.totalTips)}</p>
                            </div>
                            <div>
                              <p className="text-gray-400 text-xs">Total</p>
                              <p className="text-white font-bold">{formatCurrency(adjWaiterSales(waiter))}</p>
                            </div>
                            <div>
                              <p className="text-gray-400 text-xs">Comisión a pagar</p>
                              <p className="text-green-400 font-bold">{formatCurrency(waiterTip)}</p>
                            </div>
                          </div>
                        </div>
                        <div className="overflow-x-auto">
                          <table className="w-full text-sm">
                            <thead>
                              <tr className="border-b border-gray-700 text-gray-400 text-xs uppercase">
                                <th className="text-left px-4 py-2">Producto</th>
                                <th className="text-right px-4 py-2">Cantidad</th>
                                <th className="text-right px-4 py-2">Importe</th>
                                <th className="text-right px-4 py-2 text-green-400">Comisión</th>
                              </tr>
                            </thead>
                            {waiter.orders.length === 0 && (
                              <tbody><tr><td colSpan={4} className="px-4 py-4 text-center text-gray-500">Sin productos</td></tr></tbody>
                            )}
                            {/* Una sección por cuenta: encabezado con folio/mesa/hora y lo que se cobró */}
                            {[...waiter.orders]
                              .sort((a, b) => (a.folioSeq ?? 0) - (b.folioSeq ?? 0) || new Date(a.completedAt ?? 0).getTime() - new Date(b.completedAt ?? 0).getTime())
                              .map(order => {
                                const orderProducts = getSoldProducts([order], tipCatalog);
                                const oSubtotal = order.subtotal ?? 0;
                                const oTotal = order.total ?? 0;
                                const oDiscount = (order as any).discount ?? 0;
                                // Comisión del mesero según la tabla (sale del precio cobrado)
                                const oWaiterCommission = orderProducts.reduce((sum, p) => sum + p.tip, 0);
                                const oTip = typeof order.tipAmount === 'number'
                                  ? order.tipAmount
                                  : Math.max(0, oTotal - oSubtotal + oDiscount);
                                const time = order.completedAt
                                  ? new Date(order.completedAt).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })
                                  : '';
                                const mesa = order.tableNumber === 0 ? 'Barra' : formatTableLabel(order.tableNumber);
                                return (
                                  <tbody key={order.id} className="divide-y divide-gray-700/50 border-t-2 border-gray-600">
                                    <tr className="bg-gray-900/50">
                                      <td colSpan={4} className="px-4 py-2">
                                        <div className="flex items-center justify-between flex-wrap gap-2">
                                          <span className="text-gray-200 font-semibold text-xs">
                                            {order.folio ? `Folio ${order.folio}` : 'Sin folio'} · {mesa}
                                            {time && ` · ${time}`}
                                            {order.paymentMethod && <span className="text-gray-400 font-normal capitalize"> · {order.paymentMethod}</span>}
                                          </span>
                                          <span className="flex gap-4 text-xs">
                                            <span className="text-gray-400">Productos <span className="text-gray-200 font-semibold">{formatCurrency(oSubtotal - oDiscount)}</span></span>
                                            <span className="text-gray-400">Comisión <span className="text-green-400 font-semibold">{formatCurrency(oWaiterCommission)}</span></span>
                                            <span className="text-gray-400">Propina <span className={`font-semibold ${oTip > 0 ? 'text-amber-300' : 'text-gray-200'}`}>{formatCurrency(oTip)}</span></span>
                                            <span className="text-gray-400">Total <span className="text-white font-bold">{formatCurrency(oTotal)}</span></span>
                                          </span>
                                        </div>
                                      </td>
                                    </tr>
                                    {orderProducts.map(p => (
                                      <tr key={p.name} className="hover:bg-gray-700/30 transition-colors">
                                        <td className="px-4 py-2 pl-8 text-gray-200">{p.name}</td>
                                        <td className="px-4 py-2 text-right text-gray-300">{p.quantity}</td>
                                        <td className="px-4 py-2 text-right text-white">{formatCurrency(p.amount)}</td>
                                        <td className="px-4 py-2 text-right">
                                          {p.tipPending
                                            ? <span className="text-amber-400 text-xs">{p.tip > 0 ? `${formatCurrency(p.tip)} + pendiente` : 'pendiente'}</span>
                                            : <span className="text-green-400">{formatCurrency(p.tip)}</span>}
                                        </td>
                                      </tr>
                                    ))}
                                  </tbody>
                                );
                              })}
                            <tfoot>
                              {Math.abs(discounts) >= 0.01 && (
                                <tr className="border-t border-gray-700 text-sm">
                                  <td className="px-4 py-2 text-gray-400" colSpan={2}>Descuentos / promociones</td>
                                  <td className="px-4 py-2 text-right text-red-400">-{formatCurrency(discounts)}</td>
                                  <td />
                                </tr>
                              )}
                              <tr className="border-t-2 border-gray-600 bg-gray-700/40 font-bold">
                                <td className="px-4 py-3 text-white">TOTAL VENDIDO</td>
                                <td className="px-4 py-3 text-right text-gray-300">{products.reduce((s, p) => s + p.quantity, 0)}</td>
                                <td className="px-4 py-3 text-right text-white">{formatCurrency(sold)}</td>
                                <td className="px-4 py-3 text-right text-green-400">{formatCurrency(waiterTip)}</td>
                              </tr>
                              <tr className="border-t border-gray-700 text-sm">
                                <td className="px-4 py-2 text-gray-300" colSpan={3}>Propina de los clientes</td>
                                <td className="px-4 py-2 text-right text-amber-300 font-semibold">{formatCurrency(waiter.totalTips)}</td>
                              </tr>
                              <tr className="border-t-2 border-gray-600 bg-green-900/20 font-bold">
                                <td className="px-4 py-3 text-white" colSpan={3}>SE LE DA AL MESERO (comisión + propina)</td>
                                <td className="px-4 py-3 text-right text-green-400 text-base">{formatCurrency(waiterTip + waiter.totalTips)}</td>
                              </tr>
                            </tfoot>
                          </table>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* ── Resumen Final ─────────────────────────────────────────────── */}
          <div className="bg-gradient-to-r from-red-500/10 to-red-600/10 border-2 border-red-600/30 rounded-xl p-6">
            <h3 className="text-2xl font-bold mb-4 text-red-500 text-center">
              💰 Resumen del Turno
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
              <div>
                <p className="text-gray-400 text-sm mb-1">Sin Propina</p>
                <p className="text-3xl font-bold text-gray-300">
                  {formatCurrency(dTotalSubtotal)}
                </p>
              </div>
              <div>
                <p className="text-gray-400 text-sm mb-1">Total Vendido</p>
                <p className="text-3xl font-bold text-white">
                  {formatCurrency(dTotalSales)}
                </p>
              </div>
              <div>
                <p className="text-gray-400 text-sm mb-1">Propinas</p>
                <p className="text-3xl font-bold text-red-400">
                  {formatCurrency(summary.totalTips)}
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
                Turno: {shiftStart.toLocaleDateString("es-ES")} {SHIFT_START_LABEL} –{" "}
                {shiftEnd.toLocaleDateString("es-ES")} {SHIFT_END_LABEL}
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
          expenses={{ gastos }}
          cardTypeBreakdown={cardTypeBreakdown}
          ticketDetails={ticketDetails}
          waiterTableTips={Object.fromEntries(
            (summary?.waiterStats ?? []).map(w => [w.waiterId, getWaiterTableTip(w.orders, tipCatalog).amount])
          )}
        />
      </div>
    </div>
  );
};

export default DailySummary;
