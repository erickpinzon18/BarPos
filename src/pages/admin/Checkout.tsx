// src/pages/admin/Checkout.tsx
import React, { useMemo, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { useOrderById, useOrderByTableId } from '../../hooks/useOrders';
import type { Order } from '../../utils/types';
import { closeTable, getConfig } from '../../services/firestoreService';
import { verifyUserPin } from '../../services/orderService';
import PinModal from '../../components/common/PinModal';
import { printTicket80mm } from '../../utils/printTicket';

const AdminCheckout: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const params = useParams<{ orderId?: string }>();
  const state = (location.state || {}) as { orderId?: string; tableId?: string; tableNumber?: number };

  // Prefer orderId from URL params, then fallback to location.state
  const paramOrderId = params.orderId;
  const propOrderId = paramOrderId ?? state.orderId;
  const propTableId = state.tableId;

  // Prefer subscribing by orderId when available
  const { order: orderById, loading: loadingById, error: errorById } = useOrderById(propOrderId ?? null);
  const { order: orderByTable, loading: loadingByTable, error: errorByTable } = useOrderByTableId(propTableId ?? undefined);

  const loading = loadingById || loadingByTable;
  const error = errorById || errorByTable;

  // Choose which order we got
  const order: Order | null = useMemo(() => {
    return orderById ?? orderByTable ?? null;
  }, [orderById, orderByTable]);

  // Debug: log the order object to confirm peopleCount is present (remove in production)
  React.useEffect(() => {
    if (order) console.debug('Checkout loaded order:', order);
  }, [order]);

  

  // Tip and payment state (percentage)
  const [tipPercent, setTipPercent] = useState<number>(0); // e.g. 0.15 for 15%
  const [customTipPercent, setCustomTipPercent] = useState<string>(''); // user's input like '15' means 15%
  const [closing, setClosing] = useState(false);
  const [showPinModal, setShowPinModal] = useState(false);
  const [pinLoading, setPinLoading] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<'efectivo' | 'tarjeta' | 'transferencia'>('efectivo');
  const [cashReceived, setCashReceived] = useState<string>(''); // string to allow empty and partial inputs
  const [isReadOnly, setIsReadOnly] = useState<boolean>(false);
  const [config, setConfig] = useState<any | null>(null);
  // Load business config (name, address, phone) from Firestore to show on tickets
  React.useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const cfg = await getConfig();
        if (mounted) setConfig(cfg?.success ? cfg.data : null);
      } catch (e) {
        console.debug('Could not load config/general:', e);
      }
    })();
    return () => { mounted = false; };
  }, []);
  // peopleCount is saved on the order by OrderDetails; prefer order.peopleCount
  const peopleCount = order?.peopleCount ?? 1;

  const activeItems = order?.items?.filter(i => !i.isDeleted) ?? [];

  const subtotal = useMemo(() => activeItems.reduce((s, it) => s + (it.productPrice * it.quantity), 0), [activeItems]);

  // tipPercent is stored as decimal (0.15). tipAmount is computed from subtotal.
  const tipAmount = useMemo(() => subtotal * tipPercent, [subtotal, tipPercent]);
  const total = useMemo(() => subtotal + tipAmount, [subtotal, tipAmount]);

  const updateTotalWithPercent = (percent: number) => {
    setTipPercent(percent);
    setCustomTipPercent('');
  };

  const handleCustomTipChange = (value: string) => {
    setCustomTipPercent(value);
    const parsed = parseFloat(value);
    if (!isNaN(parsed) && parsed >= 0) {
      // Interpret numbers >= 1 as percentage values (e.g. 15 -> 15%), numbers < 1 as decimals (e.g. 0.15)
      const bounded = Math.min(Math.max(parsed, 0), 100); // clamp between 0 and 100
      const percent = bounded >= 1 ? bounded / 100 : bounded; // 1 -> 0.01 (1%)
      setTipPercent(percent);
    } else if (value === '') {
      setTipPercent(0);
    }
  };

  const handlePrint = () => {
    if (!order) return;
    const perPerson = ((total) / Math.max(1, (order.peopleCount ?? 1)));
    printTicket80mm({ order: order as Order, subtotal, tipAmount, tipPercent, total, perPerson });
  };

  const handleFinalize = async () => {
    // Instead of immediately finalizing, open PIN modal to verify cashier
    if (!order) return;
    setShowPinModal(true);
  };

  // Finalize after successful PIN verification
  const finalizeWithAuthorizedUser = async (authorizedUser: any) => {
    if (!order) return;
    setClosing(true);
    try {
      const tableId = order.tableId;
      const orderId = order.id;

      // Prepare payment details when paying with cash
      let paymentDetails: { receivedAmount?: number; change?: number; tipAmount?: number; tipPercent?: number; cashierId?: string } | undefined;
      if (paymentMethod === 'efectivo') {
        const received = Number(cashReceived || 0);
        const change = Math.max(0, received - total);
        paymentDetails = { receivedAmount: received, change, tipAmount: tipAmount, tipPercent: tipPercent, cashierId: authorizedUser?.id };
      } else {
        paymentDetails = { tipAmount: tipAmount, tipPercent: tipPercent, cashierId: authorizedUser?.id };
      }

      const res = await closeTable(tableId, orderId, paymentMethod, peopleCount, paymentDetails);
      if (!res.success) throw new Error(res.error || 'Error al cerrar mesa');
      // Mark UI as read-only so the user can view/print the ticket but not change anything
      setIsReadOnly(true);
    } catch (err: any) {
      console.error('Error closing table:', err);
      // show a basic alert; project may have a toast util
      alert(err.message || 'Error al cerrar la mesa');
    } finally {
      setClosing(false);
      setShowPinModal(false);
      setPinLoading(false);
    }
  };

  const handleConfirmPin = async (pin: string) => {
    setPinLoading(true);
    try {
      const authorizedUser = await verifyUserPin(pin);
      // proceed to finalize with the authorized user
      await finalizeWithAuthorizedUser(authorizedUser);
    } catch (err: any) {
      console.error('PIN verification failed:', err);
      setPinLoading(false);
      throw err; // PinModal will display the error
    }
  };

  // Sync local paymentMethod and read-only state from the live order
  React.useEffect(() => {
    if (!order) return;
    if (order.paymentMethod) {
      // Ensure we only set known values
      if (order.paymentMethod === 'efectivo' || order.paymentMethod === 'tarjeta' || order.paymentMethod === 'transferencia') {
        setPaymentMethod(order.paymentMethod);
      }
    }
    if (order.status === 'pagado') {
      setIsReadOnly(true);
    }
  }, [order]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-amber-400 mx-auto mb-4"></div>
          <p className="text-gray-400">Cargando detalles de la orden...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-8">
        <p className="text-red-400">{error}</p>
        <button
          onClick={() => navigate('/admin/home')}
          className="mt-4 bg-amber-500 hover:bg-amber-600 text-gray-900 px-4 py-2 rounded-lg"
        >
          Volver al Panel
        </button>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="text-center py-8">
        <h2 className="text-xl font-bold text-white mb-2">Orden no encontrada</h2>
        <p className="text-gray-400 mb-4">No se encontró una orden activa para esta mesa.</p>
        <button
          onClick={() => navigate('/admin/home')}
          className="bg-amber-500 hover:bg-amber-600 text-gray-900 px-4 py-2 rounded-lg"
        >
          Volver al Panel
        </button>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8">
      <div className="flex justify-between items-center mb-6">
        <div>
          <div className="flex items-center space-x-3">
            <div>
              <h1 className="text-3xl font-bold text-white">Checkout - Mesa {order.tableNumber}</h1>
              {order.payments && order.payments.length > 0 && (
                <div className="text-xs text-gray-400">Pago: {order.payments[0].id} — {order.payments[0].method} ${order.payments[0].receivedAmount ?? order.payments[0].change ?? ''}</div>
              )}
            </div>
            {/* Status badge */}
            <span className={`px-3 py-1 rounded-full text-sm font-semibold ${order.status === 'pagado' ? 'bg-green-600 text-white' : order.status === 'cancelado' ? 'bg-red-600 text-white' : 'bg-yellow-500 text-gray-900'}`}>
              {order.status === 'pagado' ? 'PAGADO' : order.status === 'cancelado' ? 'CANCELADO' : 'PENDIENTE'}
            </span>
          </div>
          <p className="text-gray-400">Finaliza el pago y genera el ticket.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="bg-gray-800 p-6 rounded-2xl border border-gray-700">
          <div className="ticket bg-gray-900 p-6 rounded-lg text-sm text-white">
            <div className="text-center mb-4">
              <h2 className="text-2xl font-extrabold text-amber-400">PASE DE SALIDA</h2>
              <p className="text-sm text-gray-400">{config?.name ?? 'ChepeChupes'} — Ticket de salida</p>
              <p className="text-xs text-gray-500 mt-2">Fecha: {new Date().toLocaleString()}</p>
              <p className="text-xs text-gray-500 mt-1">Id: {order.id}</p>
            </div>

            <div className="border-t border-dashed border-gray-600 pt-3 mb-3 flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-400">Mesa</p>
                <p className="text-lg font-semibold text-white">{order.tableNumber}</p>
              </div>

              <div>
                <p className="text-sm text-gray-400">Mesero</p>
                <p className="text-lg font-semibold text-white">{order.waiterName}</p>
              </div>

              <div className="text-right">
                <p className="text-sm text-gray-400">Personas</p>
                <p className="text-xl font-extrabold text-amber-400">{order.peopleCount ?? 1}</p>
              </div>
            </div>

            {/* peopleCount is managed in OrderDetails and stored on the order document */}

            <div className="border-t border-dashed border-gray-600 pt-2">
              <div className="flex justify-between"><span>CANT. PRODUCTO</span><span>SUBTOTAL</span></div>
              {activeItems.map(item => (
                <div key={item.id} className="flex justify-between mt-2"><span>{item.quantity}x {item.productName}</span><span>${(item.productPrice * item.quantity).toFixed(2)}</span></div>
              ))}
            </div>

            <div className="border-t border-dashed border-gray-600 mt-4 pt-2">
              <div className="flex justify-between"><span className="font-bold">Subtotal:</span><span>${subtotal.toFixed(2)}</span></div>
                            <div className="flex justify-between"><span>Subtotal:</span><span>${subtotal.toFixed(2)}</span></div>
              {/* <div className="flex justify-between"><span>Propina ({(tipPercent * 100).toFixed(0)}%):</span><span>${tipAmount.toFixed(2)}</span></div> */}
              <div className="flex justify-between"><span className="font-bold">Propina ({(tipPercent * 100).toFixed(0)}%):</span><span id="tip-amount">${tipAmount.toFixed(2)}</span></div>
              <div className="flex justify-between text-xl mt-2 text-amber-400"><span className="font-bold">TOTAL:</span><span id="total-amount">${total.toFixed(2)}</span></div>

              {/* Per-person total */}
              <div className="flex justify-between mt-2 items-center border-t border-gray-700 pt-2">
                <span className="text-sm text-gray-300">Total por persona ({order.peopleCount ?? 1})</span>
                <span className="text-sm font-semibold text-white">
                  ${((total) / Math.max(1, (order.peopleCount ?? 1))).toFixed(2)}
                </span>
              </div>
            </div>

            <div id="ai-message-container" className="border-t border-dashed border-gray-600 mt-4 pt-4 text-center">
              <p className="text-sm text-gray-400">Gracias por su preferencia.</p>
            </div>

            {/* Footer with address and phone (loaded from config/general when available) */}
            <div className="text-center mt-4 text-xs text-gray-400">
              <div>{config?.address ?? 'Prof. Mercedes Camacho 82, Praderas del Sol, 76808 San Juan del Río, Qro.'}</div>
              <div>Tel: {config?.phone ?? '427-123-4567'}</div>
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="bg-gray-800 p-6 rounded-2xl border border-gray-700">
            <h3 className="font-semibold text-white mb-4">Propina</h3>
            <div className="flex space-x-2 items-center">
              <button disabled={isReadOnly} onClick={() => updateTotalWithPercent(0.10)} className={`flex-1 font-bold py-3 px-2 rounded-lg transition duration-300 ${tipPercent === 0.10 ? 'bg-amber-500 text-gray-900' : isReadOnly ? 'bg-gray-800 text-gray-400 cursor-not-allowed' : 'bg-gray-700 hover:bg-gray-600'}`}>10%</button>
              <button disabled={isReadOnly} onClick={() => updateTotalWithPercent(0.15)} className={`flex-1 font-bold py-3 px-2 rounded-lg transition duration-300 ${tipPercent === 0.15 ? 'bg-amber-500 text-gray-900' : isReadOnly ? 'bg-gray-800 text-gray-400 cursor-not-allowed' : 'bg-gray-700 hover:bg-gray-600'}`}>15%</button>
              <button disabled={isReadOnly} onClick={() => updateTotalWithPercent(0.20)} className={`flex-1 font-bold py-3 px-2 rounded-lg transition duration-300 ${tipPercent === 0.20 ? 'bg-amber-500 text-gray-900' : isReadOnly ? 'bg-gray-800 text-gray-400 cursor-not-allowed' : 'bg-gray-700 hover:bg-gray-600'}`}>20%</button>
              <input disabled={isReadOnly} type="number" value={customTipPercent} onChange={(e) => handleCustomTipChange(e.target.value)} placeholder="Otro %" className="w-24 bg-gray-900 border border-gray-700 text-center rounded-lg focus:ring-amber-500 focus:border-amber-500 py-3" />
            </div>

            <div className="mt-2 text-sm text-gray-400">Seleccionado: {(tipPercent * 100).toFixed(0)}%</div>
          </div>

          <div className="bg-gray-800 p-6 rounded-2xl border border-gray-700">
            <h3 className="font-semibold text-white mb-4">Método de Pago</h3>
             <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                 <button
                   disabled={isReadOnly}
                   onClick={() => setPaymentMethod('efectivo')}
                   className={`py-3 px-4 rounded-lg font-bold transition-colors flex items-center justify-center ${paymentMethod === 'efectivo' ? 'bg-green-600 text-white shadow-md ring-2 ring-green-300' : isReadOnly ? 'bg-transparent text-gray-500 border border-gray-700 cursor-not-allowed' : 'bg-transparent text-green-300 border border-green-700 hover:bg-green-700/20'}`}
                 >
                   Efectivo
                 </button>

                 <button
                   disabled={isReadOnly}
                   onClick={() => setPaymentMethod('tarjeta')}
                   className={`py-3 px-4 rounded-lg font-bold transition-colors flex items-center justify-center ${paymentMethod === 'tarjeta' ? 'bg-blue-600 text-white shadow-md ring-2 ring-blue-300' : isReadOnly ? 'bg-transparent text-gray-500 border border-gray-700 cursor-not-allowed' : 'bg-transparent text-blue-300 border border-blue-700 hover:bg-blue-700/20'}`}
                 >
                   Tarjeta
                 </button>

                 <button
                   disabled={isReadOnly}
                   onClick={() => setPaymentMethod('transferencia')}
                   className={`py-3 px-4 rounded-lg font-bold transition-colors flex items-center justify-center ${paymentMethod === 'transferencia' ? 'bg-purple-600 text-white shadow-md ring-2 ring-purple-300' : isReadOnly ? 'bg-transparent text-gray-500 border border-gray-700 cursor-not-allowed' : 'bg-transparent text-purple-300 border border-purple-700 hover:bg-purple-700/20'}`}
                 >
                   Transferencia
                 </button>
             </div>
            {/* Cash helper: show when efectivo selected */}
            {paymentMethod === 'efectivo' && (
              <div className="mt-4">
                <label className="text-sm text-gray-400 block mb-2">Monto recibido</label>
                <div className="flex items-center space-x-2">
                  <input
                    disabled={isReadOnly}
                    type="number"
                    min="0"
                    step="0.01"
                    value={cashReceived}
                    onChange={(e) => setCashReceived(e.target.value)}
                    placeholder="0.00"
                    className="w-full bg-gray-900 border border-gray-700 text-right rounded-lg focus:ring-amber-500 focus:border-amber-500 py-3 px-3 text-white"
                  />
                  <button
                    type="button"
                    disabled={isReadOnly}
                    onClick={() => setCashReceived(total.toFixed(2))}
                    className="ml-2 bg-amber-500 text-gray-900 font-bold py-2 px-3 rounded-lg"
                  >
                    Exacto
                  </button>
                </div>

                <div className="mt-2 text-sm text-gray-300">
                  <div>Pago: ${Number(cashReceived || 0).toFixed(2)}</div>
                  <div className="mt-1 font-semibold">Cambio: ${Math.max(0, Number(cashReceived || 0) - total).toFixed(2)}</div>
                </div>
              </div>
            )}
            {/* Transfer helper: show when transferencia selected */}
            {paymentMethod === 'transferencia' && (
              <div className="mt-4">
                <h4 className="text-sm text-white font-semibold mb-2">Datos para Transferencia</h4>
                <div className="space-y-2 text-sm text-gray-300">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-xs text-gray-400">Banco</div>
                      <div className="font-semibold">Mercado Pago W</div>
                    </div>
                    <button
                      type="button"
                      onClick={() => { navigator.clipboard?.writeText('Mercado Pago W') }}
                      className="ml-4 bg-gray-700 hover:bg-gray-600 text-gray-200 px-3 py-2 rounded-lg"
                    >
                      Copiar
                    </button>
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-xs text-gray-400">Cuenta / CLABE</div>
                      <div className="font-mono">5428 7801 3323 8824</div>
                    </div>
                    <button
                      type="button"
                      onClick={() => { navigator.clipboard?.writeText('5428780133238824') }}
                      className="ml-4 bg-gray-700 hover:bg-gray-600 text-gray-200 px-3 py-2 rounded-lg"
                    >
                      Copiar
                    </button>
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-xs text-gray-400">Titular</div>
                      <div className="font-semibold">Oswaldo Reyes Olivera</div>
                    </div>
                    <button
                      type="button"
                      onClick={() => { navigator.clipboard?.writeText('Oswaldo Reyes Olivera') }}
                      className="ml-4 bg-gray-700 hover:bg-gray-600 text-gray-200 px-3 py-2 rounded-lg"
                    >
                      Copiar
                    </button>
                  </div>

                  <div className="text-xs text-gray-400">Instrucciones: Al realizar la transferencia, guarda el comprobante y solicita al cliente confirmar el pago.</div>
                </div>
              </div>
            )}
          </div>

      {/* Removed 'Guardar Cliente' block to reduce clutter */}

          <div className="flex flex-col space-y-3">
            {/* Imprimir debe permanecer disponible incluso en modo solo-lectura; solo deshabilitamos mientras cerramos */}
            <button disabled={closing} onClick={handlePrint} className={`w-full ${closing ? 'bg-gray-800 text-gray-400 cursor-not-allowed' : 'bg-gray-600 text-white hover:bg-gray-700'} font-bold py-3 px-4 rounded-lg transition`}>Imprimir Pase de Salida</button>
            <button disabled={closing || isReadOnly} onClick={handleFinalize} className={`w-full ${isReadOnly ? 'bg-gray-800 text-gray-400 cursor-not-allowed' : 'bg-amber-500 text-gray-900 hover:bg-amber-600'} font-bold py-3 px-4 rounded-lg transition`}>{closing ? 'Cerrando...' : 'Finalizar y Cerrar Mesa'}</button>
          </div>
        </div>
      </div>
      {/* PIN modal shown when finalizing to identify cashier */}
      <PinModal
        isOpen={showPinModal}
        onClose={() => { setShowPinModal(false); setPinLoading(false); }}
        onConfirm={handleConfirmPin}
        title="Confirmar Cobro"
        message="Ingresa tu PIN para autorizar el cobro y registrar quién recibió el pago."
        loading={pinLoading}
      />
    </div>
  );
};

export default AdminCheckout;
