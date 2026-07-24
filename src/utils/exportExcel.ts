/**
 * Export Excel Utility — BarPos
 * Genera el reporte de cierre de caja (.xlsx) usando SheetJS.
 */
import * as XLSX from "xlsx";
import type { Order, Payment } from "./types";

export interface ExcelGasto {
  concepto: string;
  monto: number;
}

export interface ExcelExpenses {
  gastos: ExcelGasto[];
}

export interface ExcelSummaryTotals {
  totalSales: number;
  totalSubtotal: number;
  totalTips: number;
  totalTipsNet: number;
  paymentMethods: { efectivo: number; tarjeta: number; transferencia: number };
  totalOrders: number;
  totalPeople: number;
}

/** Resuelve el monto de un pago individual, con fallback para órdenes antiguas
 * (pago único sin campo `amount` explícito). */
const getPaymentAmount = (order: Order, payment: Payment): number => {
  if (typeof payment.amount === "number") return payment.amount;
  if (Array.isArray(order.payments) && order.payments.length === 1) return order.total ?? 0;
  return 0;
};

export const exportShiftReportToExcel = (
  orders: Order[],
  summary: ExcelSummaryTotals,
  cardTypeBreakdown: Record<string, number>,
  expenses: ExcelExpenses,
  shiftStart: Date,
  shiftEnd: Date
): void => {
  // ── Hoja 1: Tickets (folio, mesa, mesero, método, tipo/detalle de tarjeta) ──
  const ticketRows: Record<string, string | number>[] = [];

  const sortedOrders = orders.slice().sort((a, b) => (a.folioSeq ?? 0) - (b.folioSeq ?? 0));

  sortedOrders.forEach((order) => {
      const payments: Payment[] =
        order.payments && order.payments.length > 0
          ? order.payments
          : [{ method: order.paymentMethod ?? "efectivo", createdAt: order.completedAt as any } as Payment];

      payments.forEach((p, idx) => {
        const completedAt = order.completedAt ? new Date(order.completedAt) : null;
        ticketRows.push({
          Folio: order.folio ?? "",
          "Ticket ID": order.id,
          Fecha: completedAt ? completedAt.toLocaleDateString("es-MX") : "",
          Hora: completedAt ? completedAt.toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" }) : "",
          Mesa: order.tableNumber === 0 ? "Barra" : `Mesa ${order.tableNumber}`,
          Mesero: order.waiterName ?? "",
          "Método": p.method ?? "",
          "Tipo Tarjeta": p.cardType ?? "",
          "Detalle Tarjeta": p.cardDetail ?? "",
          Monto: getPaymentAmount(order, p),
          Subtotal: idx === 0 ? order.subtotal ?? 0 : "",
          Total: idx === 0 ? order.total ?? 0 : "",
        });
      });
    });

  const ticketsSheet = XLSX.utils.json_to_sheet(ticketRows);

  // ── Hoja 2: Resumen ──────────────────────────────────────────────────────
  const totalExpenses = expenses.gastos.reduce((s, g) => s + g.monto, 0);
  const cashInRegister = summary.paymentMethods.efectivo - summary.totalTipsNet;
  const grandTotal =
    summary.paymentMethods.efectivo + summary.paymentMethods.tarjeta + summary.paymentMethods.transferencia;

  const foliosWithValue = sortedOrders.filter((o) => o.folio);
  const folioRangeLabel =
    foliosWithValue.length > 0
      ? `${foliosWithValue[0].folio} - ${foliosWithValue[foliosWithValue.length - 1].folio}`
      : "N/A";

  const resumenRows: { Concepto: string; Valor: string | number }[] = [
    { Concepto: "Turno", Valor: `${shiftStart.toLocaleString("es-MX")} -> ${shiftEnd.toLocaleString("es-MX")}` },
    { Concepto: "Rango de Folios", Valor: folioRangeLabel },
    { Concepto: "Total cuentas", Valor: summary.totalOrders },
    { Concepto: "Total personas", Valor: summary.totalPeople },
    { Concepto: "", Valor: "" },
    { Concepto: "Total efectivo", Valor: summary.paymentMethods.efectivo },
    { Concepto: "Total tarjeta", Valor: summary.paymentMethods.tarjeta },
    { Concepto: "Total transferencia", Valor: summary.paymentMethods.transferencia },
    { Concepto: "GRAN TOTAL", Valor: grandTotal },
    { Concepto: "", Valor: "" },
    { Concepto: "Desglose de tarjeta por tipo", Valor: "" },
    ...Object.entries(cardTypeBreakdown).map(([type, amount]) => ({ Concepto: `  ${type}`, Valor: amount })),
    { Concepto: "", Valor: "" },
    { Concepto: "Propinas brutas", Valor: summary.totalTips },
    { Concepto: "Propinas a repartir (netas)", Valor: summary.totalTipsNet },
    { Concepto: "", Valor: "" },
    { Concepto: "Efectivo en caja (antes de gastos)", Valor: cashInRegister },
    { Concepto: "", Valor: "" },
    { Concepto: "Gastos del Turno", Valor: "" },
    ...expenses.gastos.map((g) => ({ Concepto: `  ${g.concepto}`, Valor: -g.monto })),
    { Concepto: "Total Gastos", Valor: -totalExpenses },
    { Concepto: "", Valor: "" },
    { Concepto: "EFECTIVO FINAL EN CAJA", Valor: cashInRegister - totalExpenses },
  ];

  const resumenSheet = XLSX.utils.json_to_sheet(resumenRows);

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, ticketsSheet, "Tickets");
  XLSX.utils.book_append_sheet(workbook, resumenSheet, "Resumen");

  const dateStr = shiftStart.toISOString().split("T")[0];
  XLSX.writeFile(workbook, `Cierre_Caja_${dateStr}.xlsx`);
};
