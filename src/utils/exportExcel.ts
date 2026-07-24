/**
 * Export Excel Utility — BarPos
 * Genera el reporte de cierre de caja (.xlsx) usando SheetJS, imitando el formato de la
 * hoja "VENTAS" que usa la contadora (FECHA, HORA, FOLIO, IMPORTE, PAGADO, DIFERENCIA,
 * SUGERIDA 15%, PROPINA SUG, bloques de TARJETA con marcadores V/M/A/O, TRANSFERENCIA,
 * EFECTIVO, TOTAL, DIFERENCIA, con fila de TOTALES al final).
 */
import * as XLSX from "xlsx";
import type { Order, Payment, CardType } from "./types";

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

type Cell = string | number;

/** Resuelve el monto de un pago individual, con fallback para órdenes antiguas
 * (pago único sin campo `amount` explícito). */
const getPaymentAmount = (order: Order, payment: Payment): number => {
  if (typeof payment.amount === "number") return payment.amount;
  if (Array.isArray(order.payments) && order.payments.length === 1) return order.total ?? 0;
  return 0;
};

const CARD_MARKERS: { type: CardType; label: string }[] = [
  { type: "Visa", label: "V" },
  { type: "Mastercard", label: "M" },
  { type: "Amex", label: "A" },
  { type: "Otra", label: "O" },
];

export const exportShiftReportToExcel = (
  orders: Order[],
  summary: ExcelSummaryTotals,
  cardTypeBreakdown: Record<string, number>,
  expenses: ExcelExpenses,
  shiftStart: Date,
  shiftEnd: Date
): void => {
  const sortedOrders = orders.slice().sort((a, b) => (a.folioSeq ?? 0) - (b.folioSeq ?? 0));

  // ── Hoja "Ventas" ────────────────────────────────────────────────────────
  const perOrderCardPayments = sortedOrders.map((order) =>
    (order.payments ?? []).filter((p) => p.method === "tarjeta")
  );
  const maxCards = Math.max(0, ...perOrderCardPayments.map((c) => c.length));
  const hasNotes = sortedOrders.some((o) => o.cashNotes);

  // Construye el encabezado de columnas: FECHA, HORA, FOLIO, IMPORTE, PAGADO, DIFERENCIA,
  // SUGERIDA 15%, PROPINA SUG, [TARJETA N, V, M, A, O] x maxCards, TRANSFERENCIA, EFECTIVO,
  // TOTAL, DIFERENCIA, [NOTAS]
  const header: Cell[] = [
    "FECHA", "HORA", "FOLIO", "IMPORTE", "PAGADO", "DIFERENCIA", "SUGERIDA 15%", "PROPINA SUG",
  ];
  for (let i = 1; i <= maxCards; i++) {
    header.push(`TARJETA ${i}`, "V", "M", "A", "O");
  }
  header.push("TRANSFERENCIA", "EFECTIVO", "TOTAL", "DIFERENCIA");
  if (hasNotes) header.push("NOTAS");

  const buildRow = (order: Order, cardPayments: Payment[]): Cell[] => {
    const payments: Payment[] = order.payments ?? [];
    const efectivoAmt = payments
      .filter((p) => p.method === "efectivo")
      .reduce((s, p) => s + getPaymentAmount(order, p), 0);
    const transferenciaAmt = payments
      .filter((p) => p.method === "transferencia")
      .reduce((s, p) => s + getPaymentAmount(order, p), 0);

    const completedAt = order.completedAt ? new Date(order.completedAt) : null;
    const subtotal = order.subtotal ?? 0;
    const total = order.total ?? 0;
    const tip = total - subtotal;
    const sugerida15 = subtotal * 0.15;
    const propinaSug = subtotal + sugerida15;
    const cardTotal = cardPayments.reduce((s, p) => s + getPaymentAmount(order, p), 0);
    const grandTotal = efectivoAmt + transferenciaAmt + cardTotal;

    const row: Cell[] = [
      completedAt ? completedAt.toLocaleDateString("es-MX") : "",
      completedAt ? completedAt.toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" }) : "",
      order.folio ?? order.id.slice(0, 6).toUpperCase(),
      subtotal,
      total,
      tip,
      sugerida15,
      propinaSug,
    ];

    for (let i = 0; i < maxCards; i++) {
      const p = cardPayments[i];
      row.push(p ? getPaymentAmount(order, p) : "");
      CARD_MARKERS.forEach((m) => row.push(p?.cardType === m.type ? m.label : ""));
    }

    row.push(transferenciaAmt || "", efectivoAmt || "", grandTotal, grandTotal - total);
    if (hasNotes) row.push(order.cashNotes ?? "");

    return row;
  };

  const dateLabel = shiftStart.toLocaleDateString("es-MX", { day: "2-digit", month: "long", year: "numeric" });
  const rows: Cell[][] = [
    [`VENTAS DEL TURNO ${dateLabel}`],
    [],
    header,
  ];

  let sumImporte = 0, sumPagado = 0, sumDiferencia = 0, sumTransferencia = 0, sumEfectivo = 0, sumTotal = 0;
  const sumPerCard: number[] = new Array(maxCards).fill(0);

  sortedOrders.forEach((order, idx) => {
    const cardPayments = perOrderCardPayments[idx];
    const row = buildRow(order, cardPayments);
    rows.push(row);

    sumImporte += order.subtotal ?? 0;
    sumPagado += order.total ?? 0;
    sumDiferencia += (order.total ?? 0) - (order.subtotal ?? 0);
    cardPayments.forEach((p, i) => { sumPerCard[i] += getPaymentAmount(order, p); });
    const payments: Payment[] = order.payments ?? [];
    sumTransferencia += payments.filter((p) => p.method === "transferencia").reduce((s, p) => s + getPaymentAmount(order, p), 0);
    sumEfectivo += payments.filter((p) => p.method === "efectivo").reduce((s, p) => s + getPaymentAmount(order, p), 0);
    sumTotal += order.total ?? 0;
  });

  const totalsRow: Cell[] = ["TOTALES DEL TURNO", "", "", sumImporte, sumPagado, sumDiferencia, "", ""];
  for (let i = 0; i < maxCards; i++) {
    totalsRow.push(sumPerCard[i] || "", "", "", "", "");
  }
  totalsRow.push(sumTransferencia || "", sumEfectivo || "", sumTotal, "");
  if (hasNotes) totalsRow.push("");
  rows.push(totalsRow);

  const ventasSheet = XLSX.utils.aoa_to_sheet(rows);
  ventasSheet["!merges"] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: header.length - 1 } }];

  // ── Hoja "Resumen" ───────────────────────────────────────────────────────
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
  XLSX.utils.book_append_sheet(workbook, ventasSheet, "Ventas");
  XLSX.utils.book_append_sheet(workbook, resumenSheet, "Resumen");

  const dateStr = shiftStart.toISOString().split("T")[0];
  XLSX.writeFile(workbook, `Cierre_Caja_${dateStr}.xlsx`);
};
