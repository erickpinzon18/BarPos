import { forwardRef } from 'react';

interface PrintableDailySummaryProps {
  summary: any;
  shiftStart: Date;
  shiftEnd: Date;
  expenses?: {
    dj: number;
    variety: number;
    extra: number;
    extraDesc: string;
    nominas?: { person: string; amount: number; date: string }[];
  };
  cardTypeBreakdown?: Record<string, number>;
  ticketDetails?: {
    folio?: number;
    id: string;
    table: string;
    waiter: string;
    method?: string;
    total: number;
  }[];
}

export const PrintableDailySummary = forwardRef<HTMLDivElement, PrintableDailySummaryProps>(
  ({ summary, shiftStart, shiftEnd, expenses, cardTypeBreakdown, ticketDetails }, ref) => {
    if (!summary) return null;

    const formatCurrency = (n: number) => `$${n.toFixed(2)}`;
    const nominasTotal = (expenses?.nominas ?? []).reduce((s, n) => s + n.amount, 0);
    const hasExpenses = expenses && (expenses.dj > 0 || expenses.variety > 0 || expenses.extra > 0 || nominasTotal > 0);

    return (
      <div ref={ref} className="bg-white text-black p-10 min-h-screen" style={{ width: '100%', maxWidth: '800px', margin: '0 auto' }}>
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold uppercase">Cierre de Caja</h1>
          <h2 className="text-xl font-semibold text-gray-700">Wikka Despecho</h2>
          <div className="mt-4 text-sm text-gray-600">
            <p>
              <strong>Turno:</strong> {shiftStart.toLocaleDateString("es-MX", { day: "2-digit", month: "long", year: "numeric" })}
            </p>
            <p>
              <strong>Inicio:</strong> {shiftStart.toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" })} — <strong>Fin:</strong> {shiftEnd.toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" })}
            </p>
            <p>
              <strong>Impreso:</strong> {new Date().toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" })}
            </p>
          </div>
        </div>

        {/* Resumen General */}
        <div className="mb-8 border border-gray-300 rounded-lg overflow-hidden break-inside-avoid">
          <div className="bg-gray-100 px-4 py-2 font-bold uppercase border-b border-gray-300">Resumen General</div>
          <div className="p-4 grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <p className="text-xs text-gray-500 uppercase">Total Vendido</p>
              <p className="font-bold text-lg">{formatCurrency(summary.totalSales)}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500 uppercase">Propinas a Repartir</p>
              <p className="font-bold text-lg">{formatCurrency(summary.totalTipsNet)}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500 uppercase">Cuentas</p>
              <p className="font-bold text-lg">{summary.totalOrders}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500 uppercase">Personas</p>
              <p className="font-bold text-lg">{summary.totalPeople}</p>
            </div>
          </div>
        </div>

        {/* Detalle de Tickets (folios consecutivos) */}
        {ticketDetails && ticketDetails.length > 0 && (
          <div className="mb-8 break-inside-avoid">
            <h3 className="font-bold uppercase border-b-2 border-black mb-3 pb-1">Detalle de Tickets</h3>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-gray-500 text-xs uppercase">
                  <th className="py-1">Folio</th>
                  <th className="py-1">Mesa</th>
                  <th className="py-1">Mesero</th>
                  <th className="py-1">Método</th>
                  <th className="py-1 text-right">Total</th>
                </tr>
              </thead>
              <tbody>
                {ticketDetails.map((t) => (
                  <tr key={t.id} className="border-b border-gray-100">
                    <td className="py-1 font-mono">{typeof t.folio === 'number' ? `#${t.folio}` : t.id.slice(0, 6).toUpperCase()}</td>
                    <td className="py-1">{t.table}</td>
                    <td className="py-1">{t.waiter}</td>
                    <td className="py-1 capitalize">{t.method}</td>
                    <td className="py-1 text-right font-medium">{formatCurrency(t.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Detalles, Gastos y Métodos de Pago */}
        <div className={`grid gap-8 mb-8 break-inside-avoid ${hasExpenses ? 'grid-cols-3' : 'grid-cols-2'}`}>
          <div>
            <h3 className="font-bold uppercase border-b-2 border-black mb-3 pb-1">Métodos de Pago</h3>
            <table className="w-full text-sm">
              <tbody>
                <tr>
                  <td className="py-1">Efectivo (Total)</td>
                  <td className="text-right font-medium">{formatCurrency(summary.paymentMethods.efectivo)}</td>
                </tr>
                <tr>
                  <td className="py-1 text-gray-500 pl-4">— Propinas (Todas)</td>
                  <td className="text-right font-medium text-gray-500">-{formatCurrency(summary.totalTipsNet)}</td>
                </tr>
                <tr>
                  <td className="py-1 font-semibold text-green-700 pl-4 border-b border-gray-200 pb-2">Efectivo en Caja</td>
                  <td className="text-right font-semibold text-green-700 border-b border-gray-200 pb-2">{formatCurrency(summary.paymentMethods.efectivo - summary.totalTipsNet)}</td>
                </tr>
                <tr>
                  <td className="py-1">Tarjeta</td>
                  <td className="text-right font-medium">{formatCurrency(summary.paymentMethods.tarjeta)}</td>
                </tr>
                {cardTypeBreakdown && Object.entries(cardTypeBreakdown).map(([type, amount]) => (
                  <tr key={type}>
                    <td className="py-0.5 text-gray-500 pl-4 text-xs">— {type}</td>
                    <td className="text-right text-gray-500 text-xs">{formatCurrency(amount as number)}</td>
                  </tr>
                ))}
                <tr>
                  <td className="py-1 border-b border-gray-200 pb-2">Transferencia</td>
                  <td className="text-right font-medium border-b border-gray-200 pb-2">{formatCurrency(summary.paymentMethods.transferencia)}</td>
                </tr>
                <tr>
                  <td className="py-2 font-bold">Gran Total</td>
                  <td className="text-right font-bold">{formatCurrency(summary.paymentMethods.efectivo + summary.paymentMethods.tarjeta + summary.paymentMethods.transferencia)}</td>
                </tr>
              </tbody>
            </table>
          </div>
          <div>
            <h3 className="font-bold uppercase border-b-2 border-black mb-3 pb-1">Desglose de Propinas</h3>
            <table className="w-full text-sm">
              <tbody>
                <tr>
                  <td className="py-1">Propinas en tarjeta (neta) <span className="text-gray-400 text-xs font-normal">— 5% comisión ya descontada</span></td>
                  <td className="text-right font-medium">{formatCurrency(summary.totalCardTipsNet)}</td>
                </tr>
                <tr>
                  <td className="py-1 border-b border-gray-200 pb-2">Propinas efect/transf</td>
                  <td className="text-right font-medium border-b border-gray-200 pb-2">{formatCurrency(summary.totalTips - summary.totalCardTips)}</td>
                </tr>
                <tr>
                  <td className="py-2 font-bold">Propinas a Repartir</td>
                  <td className="text-right font-bold">{formatCurrency(summary.totalTipsNet)}</td>
                </tr>
              </tbody>
            </table>
          </div>

          {hasExpenses && (
            <div>
              <h3 className="font-bold uppercase border-b-2 border-black mb-3 pb-1">Gastos del Turno</h3>
              <table className="w-full text-sm">
                <tbody>
                  {expenses!.dj > 0 && (
                    <tr>
                      <td className="py-1">Pago DJ</td>
                      <td className="text-right font-medium text-red-600">-{formatCurrency(expenses!.dj)}</td>
                    </tr>
                  )}
                  {expenses!.variety > 0 && (
                    <tr>
                      <td className="py-1">Pago Variedad</td>
                      <td className="text-right font-medium text-red-600">-{formatCurrency(expenses!.variety)}</td>
                    </tr>
                  )}
                  {expenses!.extra > 0 && (
                    <tr>
                      <td className="py-1">Extra ({expenses!.extraDesc || 'N/A'})</td>
                      <td className="text-right font-medium text-red-600">-{formatCurrency(expenses!.extra)}</td>
                    </tr>
                  )}
                  {nominasTotal > 0 && (
                    <tr>
                      <td className="py-1 border-b border-gray-200 pb-2">Nómina</td>
                      <td className="text-right font-medium text-red-600 border-b border-gray-200 pb-2">-{formatCurrency(nominasTotal)}</td>
                    </tr>
                  )}
                  <tr>
                    <td className="py-2 font-bold text-green-700">Efectivo Final en Caja</td>
                    <td className="text-right font-bold text-green-700">
                      {formatCurrency(
                        (summary.paymentMethods.efectivo - summary.totalTipsNet) -
                        (expenses!.dj + expenses!.variety + expenses!.extra + nominasTotal)
                      )}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Desglose por Mesero */}
        {summary.waiterStats.length > 0 && (
          <div className="mb-8">
            <h3 className="font-bold uppercase border-b-2 border-black mb-3 pb-1">Desglose por Mesero</h3>
            <div className="space-y-6">
              {summary.waiterStats.map((w: any, idx: number) => (
                <div key={idx} className="border border-gray-200 rounded-lg p-4 break-inside-avoid">
                  <div className="flex justify-between items-center mb-3">
                    <h4 className="font-bold text-lg">{w.waiterName}</h4>
                    <span className="text-xs bg-gray-200 px-2 py-1 rounded">
                      {w.totalOrders} cuentas • {w.totalPeople} personas
                    </span>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4 text-sm mb-4">
                    <div>
                      <p className="text-gray-500 text-xs">Ventas (Efect/Transf)</p>
                      <p className="font-medium">{formatCurrency(w.salesCash + w.salesTransfer)}</p>
                    </div>
                    <div>
                      <p className="text-gray-500 text-xs">Ventas (Tarjeta)</p>
                      <p className="font-medium">{formatCurrency(w.salesCard)}</p>
                    </div>
                    <div>
                      <p className="text-gray-500 text-xs">Propina Tarjeta (neta)</p>
                      <p className="font-medium">{formatCurrency(w.tipsCardNet)}</p>
                    </div>
                    <div>
                      <p className="text-gray-500 text-xs">Propinas a Repartir</p>
                      <p className="font-bold">{formatCurrency(w.tipsNet)}</p>
                    </div>
                  </div>

                  <div className="bg-gray-50 p-3 rounded text-xs grid grid-cols-5 gap-2 text-center">
                    <div>
                      <p className="text-gray-500">Mesero</p>
                      <p className="font-bold">{formatCurrency(w.waiterShare)}</p>
                    </div>
                    <div>
                      <p className="text-gray-500">Barra</p>
                      <p className="font-bold">{formatCurrency(w.barShare)}</p>
                    </div>
                    <div>
                      <p className="text-gray-500">Garrotero</p>
                      <p className="font-bold">{formatCurrency(w.busserShare)}</p>
                    </div>
                    <div>
                      <p className="text-gray-500">Encargado</p>
                      <p className="font-bold">{formatCurrency(w.managerShare)}</p>
                    </div>
                    <div>
                      <p className="text-gray-500">Caja</p>
                      <p className="font-bold">{formatCurrency(w.cashierShare)}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Distribución Total */}
        <div className="mb-8 border border-gray-300 rounded-lg overflow-hidden break-inside-avoid">
          <div className="bg-gray-100 px-4 py-2 font-bold uppercase border-b border-gray-300">Distribución Total de Propinas</div>
          <div className="p-4 grid grid-cols-5 gap-2 text-center text-sm">
            <div>
              <p className="text-gray-500 mb-1">Meseros (46.67%)</p>
              <p className="font-bold text-lg">{formatCurrency(summary.totalTipsNet * 0.4667)}</p>
            </div>
            <div>
              <p className="text-gray-500 mb-1">Barra (20.00%)</p>
              <p className="font-bold text-lg">{formatCurrency(summary.totalBarShare)}</p>
            </div>
            <div>
              <p className="text-gray-500 mb-1">Garrotero (13.33%)</p>
              <p className="font-bold text-lg">{formatCurrency(summary.totalBusserShare)}</p>
            </div>
            <div>
              <p className="text-gray-500 mb-1">Encargado (13.33%)</p>
              <p className="font-bold text-lg">{formatCurrency(summary.totalManagerShare)}</p>
            </div>
            <div>
              <p className="text-gray-500 mb-1">Caja (6.67%)</p>
              <p className="font-bold text-lg">{formatCurrency(summary.totalCashierShare)}</p>
            </div>
          </div>
        </div>

        <div className="text-center text-xs text-gray-400 mt-12 pt-4 border-t border-gray-200">
          Wikka Despecho Punto de Venta • Documento generado automáticamente
        </div>
      </div>
    );
  }
);

PrintableDailySummary.displayName = 'PrintableDailySummary';
