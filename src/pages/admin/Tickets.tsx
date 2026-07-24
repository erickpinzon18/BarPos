import React, { useState, useEffect } from 'react';
import { useOrders } from '../../hooks/useOrders';
import { printTicket } from '../../utils/printTicket';
import { getConfig, updateOrderPaymentMethod } from '../../services/firestoreService';
import { verifyUserPin } from '../../services/orderService';
import type { Order } from '../../utils/types';
import { useAuth } from '../../contexts/AuthContext';
import { usePaperSize } from '../../hooks/usePaperSize';
import PinModal from '../../components/common/PinModal';

const AdminTickets: React.FC = () => {
  // Show historical tickets: use status 'pagado'
  const { orders, loading } = useOrders('pagado');
  const [selected, setSelected] = useState<Order | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [config, setConfig] = useState<any | null>(null);
  const { currentUser } = useAuth();
  const [paperSize, setPaperSize] = usePaperSize(currentUser?.id);

  // Payment method edit state
  const [paymentMethodFeedback, setPaymentMethodFeedback] = useState<'success' | 'error' | null>(null);
  const [pendingPaymentMethod, setPendingPaymentMethod] = useState<'efectivo' | 'tarjeta' | 'transferencia' | 'mixto' | null>(null);
  const [showPinModal, setShowPinModal] = useState(false);
  const [pinLoading, setPinLoading] = useState(false);
  // Mixto form state
  const [showMixtoForm, setShowMixtoForm] = useState(false);
  const [mixtoAmounts, setMixtoAmounts] = useState({ efectivo: '', tarjeta: '', transferencia: '' });

  const openModal = (order: Order) => setSelected(order);
  const closeModal = () => {
    setSelected(null);
    setPaymentMethodFeedback(null);
    setPendingPaymentMethod(null);
    setShowPinModal(false);
    setShowMixtoForm(false);
    setMixtoAmounts({ efectivo: '', tarjeta: '', transferencia: '' });
  };

  // Load business config (name, address, phone) from Firestore for ticket display
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const cfg = await getConfig();
        if (mounted) setConfig(cfg?.success ? cfg.data : null);
      } catch (err) {
        console.debug('Could not load config/general for Tickets:', err);
      }
    })();
    return () => { mounted = false; };
  }, []);

  // Step 1: user clicks a method
  const handleChangePaymentMethod = (newMethod: 'efectivo' | 'tarjeta' | 'transferencia' | 'mixto') => {
    if (!selected || pinLoading) return;
    if (newMethod === 'mixto') {
      // For mixto: show the amount form first, then PIN
      setPendingPaymentMethod('mixto');
      setShowMixtoForm(true);
      setMixtoAmounts({ efectivo: '', tarjeta: '', transferencia: '' });
    } else {
      if (selected.paymentMethod === newMethod) return;
      setPendingPaymentMethod(newMethod);
      setShowPinModal(true);
      setShowMixtoForm(false);
    }
  };

  // Step 2: PIN confirmed → verify admin role → save
  const handleConfirmPin = async (pin: string) => {
    if (!selected || !pendingPaymentMethod) return;
    setPinLoading(true);
    try {
      const authorizedUser = await verifyUserPin(pin);
      if (authorizedUser.role !== 'admin') {
        throw new Error('PIN válido, pero el usuario no tiene permisos. Solo administradores pueden cambiar el método de pago.');
      }
      // Build splitAmounts only for mixto
      const splitAmounts = pendingPaymentMethod === 'mixto' ? {
        efectivo: parseFloat(mixtoAmounts.efectivo) || 0,
        tarjeta: parseFloat(mixtoAmounts.tarjeta) || 0,
        transferencia: parseFloat(mixtoAmounts.transferencia) || 0,
      } : undefined;

      const res = await updateOrderPaymentMethod(selected.id, pendingPaymentMethod, splitAmounts);
      if (res.success) {
        const method = pendingPaymentMethod;
        setSelected(prev => prev ? { ...prev, paymentMethod: method, payments: (prev.payments ?? []).map(p => ({ ...p, method })) } : prev);
        setPaymentMethodFeedback('success');
        setTimeout(() => setPaymentMethodFeedback(null), 2500);
        setShowPinModal(false);
        setShowMixtoForm(false);
        setPendingPaymentMethod(null);
        setMixtoAmounts({ efectivo: '', tarjeta: '', transferencia: '' });
      } else {
        throw new Error('Error al actualizar método de pago');
      }
    } catch (err: any) {
      throw new Error(err.message || 'Error al verificar PIN');
    } finally {
      setPinLoading(false);
    }
  };

  const handlePrint = (order: Order) => {
    const subtotal = order.subtotal ?? 0;
    const total = order.total ?? 0;
    const discountAmount = (order as any).discount ?? 0;
    const tipAmount = (order as any).tipAmount ?? order.payments?.[0]?.tipAmount ?? Math.max(0, total - subtotal + discountAmount);
    const tipPercent = order.payments?.[0]?.tipPercent;
    const perPerson = order.peopleCount ? total / order.peopleCount : undefined;

    printTicket({ order, subtotal, tipAmount, tipPercent, discountAmount, total, perPerson, paperSize, businessName: config?.name, businessAddress: config?.address, businessPhone: config?.phone });
  };

  return (
    <div className="p-4 md:p-6">
      <h1 className="text-3xl font-bold mb-2">Historial de Tickets</h1>
      <p className="text-gray-400 mb-6">Consulta, revisa y reimprime tickets pagados.</p>

      <div className="mb-4">
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Buscar por ticket, id de pago, mesa, mesero, nombre de mesa, comentarios..."
          className="w-full md:w-1/2 bg-gray-800 text-white rounded-lg p-3 border border-gray-800"
        />
      </div>

      {loading ? (
        <div className="text-center py-8">Cargando tickets...</div>
      ) : (
        // Group orders by local date (YYYY-MM-DD, local timezone)
        (() => {
          const makeLocalDateKey = (d: Date) => {
            const y = d.getFullYear();
            const m = String(d.getMonth() + 1).padStart(2, '0');
            const day = String(d.getDate()).padStart(2, '0');
            return `${y}-${m}-${day}`;
          };

          const parseLocalDateKey = (key: string) => {
            const [y, m, day] = key.split('-').map(Number);
            return new Date(y, m - 1, day);
          };

          // Orders between midnight and 5 AM belong to the previous evening's shift
          const getShiftDateKey = (d: Date) => {
            if (d.getHours() < 5) {
              const prev = new Date(d);
              prev.setDate(prev.getDate() - 1);
              return makeLocalDateKey(prev);
            }
            return makeLocalDateKey(d);
          };

          const groups: Record<string, Order[]> = {};
          const q = (searchQuery || '').trim().toLowerCase();

          const filtered = orders.filter(o => {
            if (!q) return true;
            if (o.id && o.id.toLowerCase().includes(q)) return true;
            if (o.id && o.id.slice(0, 6).toLowerCase().includes(q)) return true;
            if (typeof o.folio === 'number' && String(o.folio).includes(q)) return true;
            if (o.tableNumber && String(o.tableNumber).includes(q)) return true;
            if (o.waiterName && o.waiterName.toLowerCase().includes(q)) return true;
            if (Array.isArray(o.payments) && o.payments.some(p => p.id && p.id.toLowerCase().includes(q))) return true;
            if (o.tableName && o.tableName.toLowerCase().includes(q)) return true;
            if (o.adminComments && o.adminComments.toLowerCase().includes(q)) return true;
            return false;
          });

          filtered.forEach(o => {
            const d = new Date(o.completedAt || o.createdAt || Date.now());
            const key = getShiftDateKey(d);
            if (!groups[key]) groups[key] = [];
            groups[key].push(o);
          });

          // Sort each group by completedAt descending (most recently closed first)
          Object.keys(groups).forEach(key => {
            groups[key].sort((a, b) => {
              const tA = new Date(a.completedAt || a.createdAt || 0).getTime();
              const tB = new Date(b.completedAt || b.createdAt || 0).getTime();
              return tB - tA;
            });
          });

          // sort dates descending (most recent first)
          const dateKeys = Object.keys(groups).sort((a, b) => b.localeCompare(a));

          const currentShiftKey = getShiftDateKey(new Date());

          return (
            <div className="space-y-8">
              {dateKeys.map(dateKey => {
                const shiftStart = parseLocalDateKey(dateKey);
                const shiftEnd = new Date(shiftStart);
                shiftEnd.setDate(shiftEnd.getDate() + 1);
                const isCurrentShift = dateKey === currentShiftKey;

                const startLabel = shiftStart.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
                const endLabel = shiftEnd.toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'short' });
                const headerLabel = isCurrentShift
                  ? `Turno actual — ${startLabel} · 5:00 PM → ${endLabel} 5:00 AM`
                  : `Turno ${startLabel} · 5:00 PM → ${endLabel} 5:00 AM`;

                return (
                  <div key={dateKey}>
                    <h2 className={`text-xl font-bold pb-2 mb-4 border-b-2 ${isCurrentShift ? 'text-red-500 border-red-500/30' : 'text-gray-400 border-gray-600/50'}`}>
                      {isCurrentShift ? '🔴 ' : '📅 '}{headerLabel}
                    </h2>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                      {groups[dateKey].map(order => (
                        <div key={order.id} className="bg-gray-800 rounded-2xl border border-gray-800 p-5 flex flex-col justify-between">
                          <div>
                            <div className="flex justify-between items-center mb-2">
                              <h3 className="text-lg font-bold text-white">
                                {typeof order.folio === 'number' ? `Folio #${order.folio}` : `Ticket #${order.id?.slice(0, 6).toUpperCase()}`}
                              </h3>
                                {/* <div className="text-xs text-gray-400">ID: { (order.payments && order.payments.length > 0 && order.payments[0].id) ? order.payments[0].id : order.id }</div> */}
                              <div className="text-sm text-gray-400 text-right">
                                <div>{new Date(order.completedAt || Date.now()).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}</div>
                                <div className="text-xs">{new Date(order.completedAt || Date.now()).toLocaleDateString('es-ES')}</div>
                              </div>
                            </div>
                            <p className="text-sm text-gray-300"><span className="font-semibold">{order.tableNumber === 0 ? 'Barra:' : 'Mesa:'}</span> {order.tableNumber === 0 ? 'Principal' : (order.tableNumber ?? '-')}</p>
                            {order.tableName && (
                              <p className="text-sm text-red-400"><span className="font-semibold">🏷️</span> {order.tableName}</p>
                            )}
                            <p className="text-sm text-gray-300"><span className="font-semibold">Mesero:</span> {order.waiterName ?? '-'}</p>
                            {order.payments?.[0]?.cashierName && (
                              <p className="text-sm text-gray-400"><span className="font-semibold">Cajero:</span> {order.payments[0].cashierName}</p>
                            )}
                          </div>
                            <div className="mt-4 pt-4 border-t border-gray-800 flex justify-between items-center">
                            <p className="text-xl font-bold text-red-500">${(order.total ?? 0).toFixed(2)}</p>
                            <div className="flex gap-2">
                              <button onClick={() => openModal(order)} className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-lg">Ver / Reimprimir</button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          );
        })()
      )}

      {/* Modal */}
      {selected && (
        <>
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="bg-gray-800 rounded-2xl shadow-xl w-full max-w-md m-4 border border-gray-800 relative flex flex-col max-h-[90vh]">
            <button onClick={closeModal} className="absolute top-4 right-4 text-gray-400 hover:text-white text-3xl">&times;</button>
            <div className="p-8 overflow-y-auto flex-1">
                <div className="text-center mb-6 border-b border-gray-600 pb-6">
                <h2 className="text-2xl font-bold text-red-500 tracking-widest">PASE DE SALIDA</h2>
                <p className="text-lg font-semibold text-white mt-1">{config?.name ?? 'Wikka Despecho'} — Ticket de salida</p>
                <p className="text-sm text-gray-400">Fecha: {new Date(selected.createdAt || Date.now()).toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' })}, {new Date(selected.createdAt || Date.now()).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}</p>
                {typeof selected.folio === 'number' && (
                  <p className="text-lg font-bold text-white mt-1">Folio #{selected.folio}</p>
                )}
                <p className="text-xs text-gray-400 mt-1">ID ticket: {selected.id}</p>
                {selected.payments && selected.payments.length > 0 && (
                  <div className="text-xs text-gray-400 mt-1">Pago: {selected.payments[0].id} — {selected.payments[0].method}{selected.payments[0].cardType ? ` (${selected.payments[0].cardType})` : ''} ${selected.payments[0].receivedAmount ?? selected.payments[0].change ?? ''}</div>
                )}
                {selected.payments && selected.payments.length > 1 && (
                  <div className="text-xs text-gray-400 mt-1 space-y-0.5">
                    {selected.payments.map((p, i) => (
                      <div key={p.id ?? i}>
                        {p.method}{p.cardType ? ` (${p.cardType})` : ''}{p.cardDetail ? ` — ${p.cardDetail}` : ''}: ${(p.amount ?? 0).toFixed(2)}
                      </div>
                    ))}
                  </div>
                )}
                {(() => {
                  const pmt = selected.payments?.[0];
                  if (!pmt?.cashierName && !pmt?.closedAt) return null;
                  const closedDate = pmt?.closedAt ? (typeof (pmt.closedAt as any).toDate === 'function' ? (pmt.closedAt as any).toDate() : new Date(pmt.closedAt as any)) : null;
                  return (
                    <div className="text-xs text-gray-400 mt-1">
                      {pmt?.cashierName && <span>Cajero: <span className="text-white font-semibold">{pmt.cashierName}</span></span>}
                      {pmt?.cashierName && closedDate && ' · '}
                      {closedDate && <span>Cerrado: <span className="text-white font-semibold">{closedDate.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit', hour12: false })}</span></span>}
                    </div>
                  );
                })()}
              </div>
              <div className="grid grid-cols-3 gap-4 mb-6 text-center">
                <div><p className="text-sm text-gray-400">{selected.tableNumber === 0 ? 'Barra' : 'Mesa'}</p><p className="font-bold text-white text-lg">{selected.tableNumber === 0 ? 'Principal' : (selected.tableNumber ?? '-')}</p></div>
                <div><p className="text-sm text-gray-400">Mesero</p><p className="font-bold text-white text-lg">{selected.waiterName ?? '-'}</p></div>
                <div><p className="text-sm text-gray-400">Personas</p><p className="font-bold text-white text-lg">{selected.peopleCount ?? 1}</p></div>
              </div>
              <div className="border-t border-b border-dashed border-gray-600 py-4 space-y-3">
                <div className="flex justify-between text-sm"><span className="font-semibold text-white">CANT. PRODUCTO</span><span className="font-semibold text-white">SUBTOTAL</span></div>
                {(selected.items || []).filter(i => !i.isDeleted).map((it) => {
                  const serviceMatch = (it.notes || '').match(/^Servicios:\s*(.+)$/s);
                  const services = serviceMatch
                    ? serviceMatch[1].split(',').map(s => s.trim()).filter(Boolean)
                    : [];
                  return (
                    <div key={it.id}>
                      <div className="flex justify-between">
                        <span className="text-gray-300">{it.quantity}x {it.productName}</span>
                        <span className="text-gray-300">${((it.productPrice ?? 0) * (it.quantity ?? 1)).toFixed(2)}</span>
                      </div>
                      {services.map((svc, i) => (
                        <div key={i} className="flex justify-between pl-4 text-xs text-gray-500">
                          <span>↳ {svc}</span>
                          <span>$0.00</span>
                        </div>
                      ))}
                    </div>
                  );
                })}
              </div>
              <div className="py-6 space-y-2">
                <div className="flex justify-between items-center text-md">
                  <span className="text-gray-300">Subtotal:</span>
                  <span className="font-semibold text-white">${(selected.subtotal ?? 0).toFixed(2)}</span>
                </div>
                {(() => {
                  const discount = (selected as any).discount ?? 0;
                  return discount > 0 ? (
                    <div className="flex justify-between items-center text-md">
                      <span className="text-green-400">Descuento:</span>
                      <span className="font-semibold text-green-400">-${discount.toFixed(2)}</span>
                    </div>
                  ) : null;
                })()}
                <div className="flex justify-between items-center text-md">
                  <span className="text-gray-300">Propina{(() => {
                    const tipPercent = selected.payments?.[0]?.tipPercent ?? 0;
                    return tipPercent > 0 ? ` (${(tipPercent * 100).toFixed(0)}%)` : '';
                  })()}:</span>
                  <span className="font-semibold text-white">${(() => {
                    const discount = (selected as any).discount ?? 0;
                    const tip = (selected as any).tipAmount ?? selected.payments?.[0]?.tipAmount ?? Math.max(0, (selected.total ?? 0) - (selected.subtotal ?? 0) + discount);
                    return tip.toFixed(2);
                  })()}</span>
                </div>
                <div className="flex justify-between items-center text-2xl mt-2">
                  <span className="font-bold text-red-500">TOTAL:</span>
                  <span className="font-bold text-red-500">${(selected.total ?? 0).toFixed(2)}</span>
                </div>
              </div>
              <div className="text-center pt-6 border-t border-gray-600">
                <p className="text-gray-400">Gracias por su preferencia.</p>
                <p className="text-xs text-gray-500 mt-2">{config?.address ?? 'Prof. Mercedes Camacho 82, Praderas del Sol, 76808 San Juan del Río, Qro.'}<br/>Tel: {config?.phone ?? '427-123-4567'}</p>
              </div>

              {/* Método de pago editable */}
              <div className="mt-4 pt-4 border-t border-gray-700">
                <div className="bg-gray-900/60 rounded-xl border border-gray-700 p-4">
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-3">💳 Método de Pago</p>
                  <div className="grid grid-cols-2 gap-2">
                    {(['efectivo', 'tarjeta', 'transferencia', 'mixto'] as const).map(method => {
                      const isActive = selected.paymentMethod === method && !showMixtoForm;
                      const isMixtoEditing = method === 'mixto' && showMixtoForm;
                      const labels: Record<string, string> = {
                        efectivo: '💵 Efectivo',
                        tarjeta: '💳 Tarjeta',
                        transferencia: '🏦 Transferencia',
                        mixto: '🔀 Mixto',
                      };
                      const activeColors: Record<string, string> = {
                        efectivo: 'bg-green-600 border-green-500 text-white shadow-green-900/40 shadow-md',
                        tarjeta: 'bg-blue-600 border-blue-500 text-white shadow-blue-900/40 shadow-md',
                        transferencia: 'bg-purple-600 border-purple-500 text-white shadow-purple-900/40 shadow-md',
                        mixto: 'bg-orange-600 border-orange-500 text-white shadow-orange-900/40 shadow-md',
                      };
                      return (
                        <button
                          key={method}
                          onClick={() => handleChangePaymentMethod(method)}
                          disabled={pinLoading}
                          className={`py-2.5 px-3 rounded-lg border text-sm font-semibold transition-all duration-200 ${
                            isActive || isMixtoEditing
                              ? activeColors[method]
                              : 'bg-gray-800 border-gray-700 text-gray-400 hover:border-gray-500 hover:text-gray-200'
                          } ${pinLoading ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'}`}
                        >
                          {labels[method]}
                        </button>
                      );
                    })}
                  </div>

                  {/* Mixto amounts form */}
                  {showMixtoForm && (() => {
                    const total = selected.total ?? 0;
                    const ef = parseFloat(mixtoAmounts.efectivo) || 0;
                    const ta = parseFloat(mixtoAmounts.tarjeta) || 0;
                    const tr = parseFloat(mixtoAmounts.transferencia) || 0;
                    const suma = ef + ta + tr;
                    const restante = total - suma;
                    const valido = suma > 0 && Math.abs(restante) < 0.01;
                    return (
                      <div className="mt-3 border-t border-orange-500/30 pt-3 space-y-2">
                        <p className="text-xs text-orange-300 font-semibold mb-2">Ingresa el monto por método (total: ${total.toFixed(2)})</p>
                        {(['efectivo', 'tarjeta', 'transferencia'] as const).map(sub => {
                          const icons: Record<string, string> = { efectivo: '💵', tarjeta: '💳', transferencia: '🏦' };
                          const caps: Record<string, string> = { efectivo: 'Efectivo', tarjeta: 'Tarjeta', transferencia: 'Transferencia' };
                          return (
                            <div key={sub} className="flex items-center gap-2">
                              <span className="text-sm w-28 text-gray-300 shrink-0">{icons[sub]} {caps[sub]}</span>
                              <div className="relative flex-1">
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">$</span>
                                <input
                                  type="number"
                                  min="0"
                                  step="0.01"
                                  placeholder="0.00"
                                  value={mixtoAmounts[sub]}
                                  onChange={e => setMixtoAmounts(prev => ({ ...prev, [sub]: e.target.value }))}
                                  className="w-full bg-gray-800 border border-gray-600 text-white rounded-lg pl-7 pr-3 py-2 text-sm focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                                />
                              </div>
                            </div>
                          );
                        })}
                        <div className={`flex justify-between items-center text-xs pt-1 font-semibold ${
                          valido ? 'text-green-400' : restante < 0 ? 'text-red-400' : 'text-yellow-400'
                        }`}>
                          <span>Suma: ${suma.toFixed(2)}</span>
                          <span>{valido ? '✅ Listo' : restante > 0 ? `Faltan $${restante.toFixed(2)}` : `Excede $${Math.abs(restante).toFixed(2)}`}</span>
                        </div>
                        <div className="flex gap-2 pt-1">
                          <button
                            onClick={() => { setShowMixtoForm(false); setPendingPaymentMethod(null); }}
                            className="flex-1 py-2 rounded-lg bg-gray-700 hover:bg-gray-600 text-white text-sm font-semibold transition-colors"
                          >
                            Cancelar
                          </button>
                          <button
                            onClick={() => { if (valido) setShowPinModal(true); }}
                            disabled={!valido || pinLoading}
                            className="flex-1 py-2 rounded-lg bg-orange-600 hover:bg-orange-700 text-white text-sm font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            Confirmar →  PIN
                          </button>
                        </div>
                      </div>
                    );
                  })()}

                  {paymentMethodFeedback === 'success' && (
                    <p className="text-xs text-green-400 mt-2 flex items-center gap-1">✅ Método de pago actualizado</p>
                  )}
                  {paymentMethodFeedback === 'error' && (
                    <p className="text-xs text-red-400 mt-2 flex items-center gap-1">❌ Error al actualizar. Intenta de nuevo.</p>
                  )}
                </div>
              </div>
            </div>
            <div className="p-6 bg-gray-900/50 rounded-b-2xl space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-400">🖨️ Papel</span>
                <div className="flex bg-gray-800 rounded-lg overflow-hidden border border-gray-700">
                  <button
                    onClick={() => setPaperSize('58mm')}
                    className={`px-4 py-2 text-sm font-semibold transition-colors ${paperSize === '58mm' ? 'bg-red-600 text-white' : 'text-gray-400 hover:text-white'}`}
                  >58mm</button>
                  <button
                    onClick={() => setPaperSize('80mm')}
                    className={`px-4 py-2 text-sm font-semibold transition-colors ${paperSize === '80mm' ? 'bg-red-600 text-white' : 'text-gray-400 hover:text-white'}`}
                  >80mm</button>
                </div>
              </div>
              <div className="flex gap-4">
                <button onClick={() => handlePrint(selected)} className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-5 rounded-lg">Imprimir</button>
                <button onClick={closeModal} className="w-full bg-gray-700 hover:bg-gray-600 text-white font-bold py-3 px-5 rounded-lg">Cerrar</button>
              </div>
            </div>
          </div>
        </div>

        <PinModal
          isOpen={showPinModal}
          onClose={() => { setShowPinModal(false); if (!showMixtoForm) setPendingPaymentMethod(null); }}
          onConfirm={handleConfirmPin}
          loading={pinLoading}
          title="Cambiar Método de Pago"
          message={pendingPaymentMethod === 'mixto'
            ? `Pago mixto — Efectivo: $${parseFloat(mixtoAmounts.efectivo || '0').toFixed(2)}, Tarjeta: $${parseFloat(mixtoAmounts.tarjeta || '0').toFixed(2)}, Transferencia: $${parseFloat(mixtoAmounts.transferencia || '0').toFixed(2)}. Autorización de administrador requerida.`
            : `Se cambiará el método de pago a "${pendingPaymentMethod ?? ''}". Esta acción requiere autorización de administrador.`
          }
        />
        </>
      )}

    </div>
  );
};

export default AdminTickets;
