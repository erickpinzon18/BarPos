// src/pages/waiter/Checkout.tsx
import React, { useMemo, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { useOrderById, useOrderByTableId } from '../../hooks/useOrders';
import type { Order } from '../../utils/types';
import { closeTable, getConfig } from '../../services/firestoreService';
import { verifyUserPin } from '../../services/orderService';
import PinModal from '../../components/common/PinModal';
import MercadoPagoTerminalModal from '../../components/common/MercadoPagoTerminalModal';
import { printTicket80mm } from '../../utils/printTicket';
import { ArrowLeft, Printer, Check } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import toast from 'react-hot-toast';
import { QRCodeSVG } from 'qrcode.react';

const WaiterCheckout: React.FC = () => {
  const { currentUser } = useAuth();
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
  const [showTicket, setShowTicket] = useState<boolean>(true); // Mobile: toggle ticket view
  const [splitBetween, setSplitBetween] = useState<number>(1); // Número de personas para dividir la cuenta
  const [showMPTerminalModal, setShowMPTerminalModal] = useState(false);

  // Función para copiar link del ticket digital
  const handleShareTicket = async () => {
    if (!order) return;
    
    const ticketUrl = `${window.location.origin}/ticket/${order.id}`;
    
    try {
      await navigator.clipboard.writeText(ticketUrl);
      toast.success('🔗 Link del ticket copiado', {
        duration: 3000,
      });
    } catch (err) {
      console.error('Error al copiar link:', err);
      toast.error('No se pudo copiar el link');
    }
  };

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

  const subtotal = useMemo(() => {
    const activeItems = order?.items.filter(item => !item.isDeleted) ?? [];
    return activeItems.reduce((sum, item) => sum + (item.productPrice * item.quantity), 0);
  }, [order]);

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
    if (!order) return;
    
    // Si es tarjeta o transferencia (Mercado Pago), usar el modal de terminal
    if (paymentMethod === 'tarjeta' || paymentMethod === 'transferencia') {
      setShowMPTerminalModal(true);
      return;
    }
    
    // Para efectivo, usar PIN modal
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

  // Handlers for Mercado Pago Terminal
  const handleMPTerminalSuccess = async () => {
    console.log('✅ [Checkout] Pago con MP Terminal exitoso');
    setShowMPTerminalModal(false);
    
    // Finalizar sin pedir PIN porque MP ya validó el pago
    if (!order) return;
    setClosing(true);
    try {
      const tableId = order.tableId;
      const orderId = order.id;

      // Payment details for MP Terminal (no cashier ID needed, MP handles auth)
      const paymentDetails = { 
        tipAmount: tipAmount, 
        tipPercent: tipPercent,
        cashierId: 'mp-terminal' // Identifier for MP Terminal payments
      };

      const res = await closeTable(tableId, orderId, paymentMethod, peopleCount, paymentDetails);
      if (!res.success) throw new Error(res.error || 'Error al cerrar mesa');
      setIsReadOnly(true);
    } catch (err: any) {
      console.error('Error closing table:', err);
      alert(err.message || 'Error al cerrar la mesa');
    } finally {
      setClosing(false);
    }
  };

  const handleMPTerminalError = (error: string) => {
    console.error('❌ [Checkout] Error en MP Terminal:', error);
    setShowMPTerminalModal(false);
    alert('Error en el pago: ' + error);
  };

  const handleMPTerminalClose = () => {
    console.log('🔴 [Checkout] Usuario cerró modal de MP Terminal');
    setShowMPTerminalModal(false);
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
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-400 mx-auto mb-4"></div>
          <p className="text-gray-400">Cargando checkout...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-8 px-4">
        <p className="text-red-400 mb-4">{error}</p>
        <button
          onClick={() => navigate('/waiter/home')}
          className="bg-green-500 hover:bg-green-600 text-white px-6 py-3 rounded-lg font-medium"
        >
          Volver a Mesas
        </button>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="text-center py-8 px-4">
        <h2 className="text-xl font-bold text-white mb-2">Orden no encontrada</h2>
        <p className="text-gray-400 mb-4">No se encontró una orden activa.</p>
        <button
          onClick={() => navigate('/waiter/home')}
          className="bg-green-500 hover:bg-green-600 text-white px-6 py-3 rounded-lg font-medium"
        >
          Volver a Mesas
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 pb-32">
      {/* Fixed Header - Mobile Optimized */}
      <div className="sticky top-0 z-10 bg-gray-800 border-b border-gray-700 shadow-lg">
        <div className="flex items-center justify-between p-4">
          <div className="flex items-center flex-1">
            <button
              onClick={() => navigate('/waiter/home')}
              className="mr-3 p-2 hover:bg-gray-700 rounded-lg transition-colors"
            >
              <ArrowLeft className="w-6 h-6 text-gray-400" />
            </button>
            <div className="flex-1">
              <h1 className="text-xl md:text-2xl font-bold text-white flex items-center gap-2">
                Checkout - {order.tableNumber === 0 ? '🍹 Barra' : `Mesa ${order.tableNumber}`}
                {/* Status badge */}
                <span className={`px-2 py-1 rounded-full text-xs font-semibold ${order.status === 'pagado' ? 'bg-green-600 text-white' : order.status === 'cancelado' ? 'bg-red-600 text-white' : 'bg-yellow-500 text-gray-900'}`}>
                  {order.status === 'pagado' ? 'PAGADO' : order.status === 'cancelado' ? 'CANCELADO' : 'PENDIENTE'}
                </span>
              </h1>
              <p className="text-xs text-gray-400">Finaliza el pago</p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-xl md:text-2xl font-bold text-green-400">${total.toFixed(2)}</p>
            <p className="text-xs text-gray-400">Total</p>
          </div>
        </div>
      </div>

      <div className="p-4 space-y-4">
        {/* Mobile: Toggle Ticket Button */}
        <button
          onClick={() => setShowTicket(!showTicket)}
          className="w-full md:hidden bg-gray-800 border border-gray-700 text-white font-medium py-3 px-4 rounded-lg flex items-center justify-center gap-2"
        >
          {showTicket ? '📋 Ocultar Ticket' : '👁️ Ver Ticket'}
        </button>

        {/* Layout: Stack on mobile, side-by-side on desktop */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Ticket Preview - Hidden on mobile unless toggled */}
          <div className={`${showTicket ? 'block' : 'hidden'} md:block bg-gray-800 p-4 md:p-6 rounded-2xl border border-gray-700`}>
            <div className="ticket bg-gray-900 p-4 md:p-6 rounded-lg text-sm text-white">
              <div className="text-center mb-4">
                <h2 className="text-xl md:text-2xl font-extrabold text-green-400">PASE DE SALIDA</h2>
                <p className="text-xs md:text-sm text-gray-400">{config?.name ?? 'ChepeChupes'} — Ticket de salida</p>
                <p className="text-xs text-gray-500 mt-2">{new Date().toLocaleString()}</p>
                <p className="text-xs text-gray-500 mt-1">Id: {order.id}</p>
              </div>

              <div className="border-t border-dashed border-gray-600 pt-3 mb-3 grid grid-cols-3 gap-2">
                <div>
                  <p className="text-xs text-gray-400">Mesa</p>
                  <p className="text-base md:text-lg font-semibold text-white">
                    {order.tableNumber === 0 ? 'Barra' : order.tableNumber}
                  </p>
                </div>

                <div>
                  <p className="text-xs text-gray-400">Mesero</p>
                  <p className="text-base md:text-lg font-semibold text-white truncate">{order.waiterName}</p>
                </div>

                <div className="text-right">
                  <p className="text-xs text-gray-400">Personas</p>
                  <p className="text-lg md:text-xl font-extrabold text-green-400">{order.peopleCount ?? 1}</p>
                </div>
              </div>

              <div className="border-t border-dashed border-gray-600 pt-2">
                <div className="flex justify-between text-xs md:text-sm font-semibold mb-2">
                  <span>PRODUCTO</span>
                  <span>SUBTOTAL</span>
                </div>
                {activeItems.map(item => (
                  <div key={item.id} className="flex justify-between mt-2 text-xs md:text-sm">
                    <span className="flex-1 truncate">{item.quantity}x {item.productName}</span>
                    <span className="ml-2">${(item.productPrice * item.quantity).toFixed(2)}</span>
                  </div>
                ))}
              </div>

              <div className="border-t border-dashed border-gray-600 mt-4 pt-2 space-y-1">
                <div className="flex justify-between text-sm">
                  <span className="font-bold">Subtotal:</span>
                  <span>${subtotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="font-bold">Propina ({(tipPercent * 100).toFixed(0)}%):</span>
                  <span>${tipAmount.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-lg md:text-xl mt-2 text-green-400 font-bold">
                  <span>TOTAL:</span>
                  <span>${total.toFixed(2)}</span>
                </div>

                {/* Per-person total */}
                <div className="flex justify-between mt-2 items-center border-t border-gray-700 pt-2 text-sm">
                  <span className="text-gray-300">Por persona ({order.peopleCount ?? 1})</span>
                  <span className="font-semibold text-white">
                    ${((total) / Math.max(1, (order.peopleCount ?? 1))).toFixed(2)}
                  </span>
                </div>
              </div>

              <div className="border-t border-dashed border-gray-600 mt-4 pt-4 text-center">
                <p className="text-xs md:text-sm text-gray-400">Gracias por su preferencia.</p>
              </div>

              {/* Footer with address and phone */}
              <div className="text-center mt-4 text-xs text-gray-400">
                <div>{config?.address ?? 'Prof. Mercedes Camacho 82, Praderas del Sol, 76808 San Juan del Río, Qro.'}</div>
                <div>Tel: {config?.phone ?? '427-123-4567'}</div>
              </div>
            </div>
          </div>

          {/* Controls Column */}
          <div className="space-y-4">
            {/* Propina Section */}
            <div className="bg-gray-800 p-4 md:p-6 rounded-2xl border border-gray-700">
              <h3 className="font-semibold text-white mb-3 md:mb-4">💰 Propina</h3>
              <div className="grid grid-cols-4 gap-2">
                <button 
                  disabled={isReadOnly} 
                  onClick={() => updateTotalWithPercent(0.10)} 
                  className={`font-bold py-3 px-2 rounded-lg transition text-sm md:text-base ${tipPercent === 0.10 ? 'bg-green-500 text-white' : isReadOnly ? 'bg-gray-700 text-gray-400 cursor-not-allowed' : 'bg-gray-700 hover:bg-gray-600 text-white'}`}
                >
                  10%
                </button>
                <button 
                  disabled={isReadOnly} 
                  onClick={() => updateTotalWithPercent(0.15)} 
                  className={`font-bold py-3 px-2 rounded-lg transition text-sm md:text-base ${tipPercent === 0.15 ? 'bg-green-500 text-white' : isReadOnly ? 'bg-gray-700 text-gray-400 cursor-not-allowed' : 'bg-gray-700 hover:bg-gray-600 text-white'}`}
                >
                  15%
                </button>
                <button 
                  disabled={isReadOnly} 
                  onClick={() => updateTotalWithPercent(0.20)} 
                  className={`font-bold py-3 px-2 rounded-lg transition text-sm md:text-base ${tipPercent === 0.20 ? 'bg-green-500 text-white' : isReadOnly ? 'bg-gray-700 text-gray-400 cursor-not-allowed' : 'bg-gray-700 hover:bg-gray-600 text-white'}`}
                >
                  20%
                </button>
                <input 
                  disabled={isReadOnly} 
                  type="number" 
                  value={customTipPercent} 
                  onChange={(e) => handleCustomTipChange(e.target.value)} 
                  placeholder="%" 
                  className="bg-gray-900 border border-gray-700 text-center rounded-lg focus:ring-green-500 focus:border-green-500 py-3 text-sm md:text-base text-white disabled:bg-gray-800 disabled:text-gray-500" 
                />
              </div>
              <div className="mt-2 text-xs md:text-sm text-gray-400">
                Seleccionado: {(tipPercent * 100).toFixed(0)}% = ${tipAmount.toFixed(2)}
              </div>
            </div>

            {/* División de Cuenta Section */}
            <div className="bg-gray-800 p-4 md:p-6 rounded-2xl border border-gray-700">
              <h3 className="font-semibold text-white mb-3 md:mb-4">🧮 Dividir Cuenta</h3>
              <div className="space-y-3">
                <div>
                  <label className="text-sm text-gray-400 block mb-2">¿Entre cuántas personas?</label>
                  <div className="grid grid-cols-10 gap-3">
                    <button
                      onClick={() => setSplitBetween(Math.max(1, splitBetween - 1))}
                      className="col-span-3 h-14 bg-gray-700 hover:bg-gray-600 rounded-lg font-bold text-white text-2xl"
                      aria-label="Disminuir"
                    >
                      -
                    </button>
                    <input
                      type="number"
                      min="1"
                      value={splitBetween}
                      onChange={(e) => setSplitBetween(Math.max(1, parseInt(e.target.value) || 1))}
                      className="col-span-4 bg-gray-900 border border-gray-700 text-center rounded-lg focus:ring-green-500 focus:border-green-500 py-3 text-2xl font-bold text-white"
                    />
                    <button
                      onClick={() => setSplitBetween(splitBetween + 1)}
                      className="col-span-3 h-14 bg-gray-700 hover:bg-gray-600 rounded-lg font-bold text-white text-2xl"
                      aria-label="Aumentar"
                    >
                      +
                    </button>
                  </div>
                </div>

                {/* Resultado de la división */}
                <div className="bg-gradient-to-br from-green-900/40 to-green-800/20 border-2 border-green-500 rounded-xl p-4">
                  <div className="text-center">
                    <p className="text-sm text-gray-300 mb-2">Cada persona paga:</p>
                    <p className="text-4xl md:text-5xl font-extrabold text-green-400">
                      ${(total / Math.max(1, splitBetween)).toFixed(2)}
                    </p>
                    <p className="text-xs text-gray-400 mt-2">
                      Total: ${total.toFixed(2)} ÷ {splitBetween} {splitBetween === 1 ? 'persona' : 'personas'}
                    </p>
                  </div>

                  {/* Desglose detallado */}
                  <div className="mt-4 pt-4 border-t border-green-700/50 space-y-1.5 text-sm">
                    <div className="flex justify-between text-gray-300">
                      <span>Subtotal c/u:</span>
                      <span>${(subtotal / Math.max(1, splitBetween)).toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-gray-300">
                      <span>Propina c/u:</span>
                      <span>${(tipAmount / Math.max(1, splitBetween)).toFixed(2)}</span>
                    </div>
                  </div>
                </div>

                {/* Botones rápidos de división común */}
                <div className="grid grid-cols-4 gap-2">
                  <button
                    onClick={() => setSplitBetween(1)}
                    className={`py-2 px-3 rounded-lg font-semibold text-sm transition ${splitBetween === 1 ? 'bg-green-500 text-white' : 'bg-gray-700 hover:bg-gray-600 text-gray-300'}`}
                  >
                    1
                  </button>
                  <button
                    onClick={() => setSplitBetween(2)}
                    className={`py-2 px-3 rounded-lg font-semibold text-sm transition ${splitBetween === 2 ? 'bg-green-500 text-white' : 'bg-gray-700 hover:bg-gray-600 text-gray-300'}`}
                  >
                    2
                  </button>
                  <button
                    onClick={() => setSplitBetween(3)}
                    className={`py-2 px-3 rounded-lg font-semibold text-sm transition ${splitBetween === 3 ? 'bg-green-500 text-white' : 'bg-gray-700 hover:bg-gray-600 text-gray-300'}`}
                  >
                    3
                  </button>
                  <button
                    onClick={() => setSplitBetween(4)}
                    className={`py-2 px-3 rounded-lg font-semibold text-sm transition ${splitBetween === 4 ? 'bg-green-500 text-white' : 'bg-gray-700 hover:bg-gray-600 text-gray-300'}`}
                  >
                    4
                  </button>
                </div>

                {/* Info adicional */}
                <div className="text-xs text-gray-400 bg-gray-900 p-2 rounded flex items-start gap-2">
                  <span className="text-green-400">💡</span>
                  <span>Esta división es independiente del número de comensales ({order.peopleCount ?? 1}). Úsala para calcular cuánto debe pagar cada persona si dividen la cuenta.</span>
                </div>
              </div>
            </div>

            {/* Método de Pago Section */}
            <div className="bg-gray-800 p-4 md:p-6 rounded-2xl border border-gray-700">
              <h3 className="font-semibold text-white mb-3 md:mb-4">💳 Método de Pago</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <button
                  disabled={isReadOnly}
                  onClick={() => setPaymentMethod('efectivo')}
                  className={`py-3 px-4 rounded-lg font-bold transition-colors text-sm md:text-base ${paymentMethod === 'efectivo' 
                    ? 'bg-green-600 text-white shadow-md ring-2 ring-green-300' 
                    : isReadOnly 
                    ? 'bg-transparent text-gray-500 border border-gray-700 cursor-not-allowed' 
                    : 'bg-transparent text-green-300 border border-green-700 hover:bg-green-700/20'}`}
                >
                  💵 Efectivo
                </button>

                <button
                  disabled={isReadOnly}
                  onClick={() => setPaymentMethod('tarjeta')}
                  className={`py-3 px-4 rounded-lg font-bold transition-colors text-sm md:text-base ${paymentMethod === 'tarjeta' 
                    ? 'bg-blue-600 text-white shadow-md ring-2 ring-blue-300' 
                    : isReadOnly 
                    ? 'bg-transparent text-gray-500 border border-gray-700 cursor-not-allowed' 
                    : 'bg-transparent text-blue-300 border border-blue-700 hover:bg-blue-700/20'}`}
                >
                  💳 Tarjeta
                </button>

                <button
                  disabled={isReadOnly}
                  onClick={() => setPaymentMethod('transferencia')}
                  className={`py-3 px-4 rounded-lg font-bold transition-colors text-sm md:text-base ${paymentMethod === 'transferencia' 
                    ? 'bg-purple-600 text-white shadow-md ring-2 ring-purple-300' 
                    : isReadOnly 
                    ? 'bg-transparent text-gray-500 border border-gray-700 cursor-not-allowed' 
                    : 'bg-transparent text-purple-300 border border-purple-700 hover:bg-purple-700/20'}`}
                >
                  📱 Transferencia
                </button>
              </div>

              {/* Cash helper: show when efectivo selected */}
              {paymentMethod === 'efectivo' && (
                <div className="mt-4">
                  <label className="text-sm text-gray-400 block mb-2">Monto recibido</label>
                  <div className="flex items-center gap-2">
                    <input
                      disabled={isReadOnly}
                      type="number"
                      min="0"
                      step="0.01"
                      value={cashReceived}
                      onChange={(e) => setCashReceived(e.target.value)}
                      placeholder="0.00"
                      className="flex-1 bg-gray-900 border border-gray-700 text-right rounded-lg focus:ring-green-500 focus:border-green-500 py-3 px-3 text-white disabled:bg-gray-800"
                    />
                    <button
                      type="button"
                      disabled={isReadOnly}
                      onClick={() => setCashReceived(total.toFixed(2))}
                      className="bg-green-500 text-white font-bold py-3 px-4 rounded-lg disabled:bg-gray-700 disabled:text-gray-400 text-sm md:text-base"
                    >
                      Exacto
                    </button>
                  </div>

                  <div className="mt-3 p-3 bg-gray-900 rounded-lg">
                    <div className="flex justify-between text-sm text-gray-300">
                      <span>Pago:</span>
                      <span className="font-semibold">${Number(cashReceived || 0).toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-base md:text-lg font-bold text-green-400 mt-1">
                      <span>Cambio:</span>
                      <span>${Math.max(0, Number(cashReceived || 0) - total).toFixed(2)}</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Transfer helper: show when transferencia selected */}
              {paymentMethod === 'transferencia' && (
                <div className="mt-4">
                  <h4 className="text-sm text-white font-semibold mb-2">📋 Datos para Transferencia</h4>
                  <div className="space-y-2 text-sm">
                    <div className="flex items-center justify-between bg-gray-900 p-3 rounded-lg">
                      <div className="flex-1">
                        <div className="text-xs text-gray-400">Banco</div>
                        <div className="font-semibold text-white">Banco Ejemplo</div>
                      </div>
                      <button
                        type="button"
                        onClick={() => { navigator.clipboard?.writeText('Banco Ejemplo') }}
                        className="ml-2 bg-gray-700 hover:bg-gray-600 text-gray-200 px-3 py-2 rounded-lg text-xs"
                      >
                        Copiar
                      </button>
                    </div>

                    <div className="flex items-center justify-between bg-gray-900 p-3 rounded-lg">
                      <div className="flex-1 min-w-0">
                        <div className="text-xs text-gray-400">CLABE</div>
                        <div className="font-mono text-white text-xs md:text-sm truncate">012345678901234567</div>
                      </div>
                      <button
                        type="button"
                        onClick={() => { navigator.clipboard?.writeText('012345678901234567') }}
                        className="ml-2 bg-gray-700 hover:bg-gray-600 text-gray-200 px-3 py-2 rounded-lg text-xs flex-shrink-0"
                      >
                        Copiar
                      </button>
                    </div>

                    <div className="flex items-center justify-between bg-gray-900 p-3 rounded-lg">
                      <div className="flex-1">
                        <div className="text-xs text-gray-400">Titular</div>
                        <div className="font-semibold text-white text-xs md:text-sm">Chepe Chupes S.A. de C.V.</div>
                      </div>
                      <button
                        type="button"
                        onClick={() => { navigator.clipboard?.writeText('Chepe Chupes S.A. de C.V.') }}
                        className="ml-2 bg-gray-700 hover:bg-gray-600 text-gray-200 px-3 py-2 rounded-lg text-xs"
                      >
                        Copiar
                      </button>
                    </div>

                    <div className="text-xs text-gray-400 bg-gray-900 p-2 rounded">
                      💡 Guarda el comprobante y confirma el pago con el cliente.
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Código QR para Compartir Ticket Digital */}
            <div className="bg-gray-800 p-4 md:p-6 rounded-2xl border border-gray-700">
              <h3 className="font-semibold text-white mb-3 text-center">📱 Ticket Digital</h3>
              <p className="text-sm text-gray-400 text-center mb-4">
                Escanea el código QR para ver el ticket
              </p>
              <div className="flex justify-center mb-4">
                <div className="bg-white p-4 rounded-xl">
                  <QRCodeSVG 
                    value={`${window.location.origin}/ticket/${order.id}`}
                    size={200}
                    level="H"
                    includeMargin={false}
                  />
                </div>
              </div>
              <button 
                disabled={closing} 
                onClick={handleShareTicket} 
                className={`w-full ${closing ? 'bg-gray-700 text-gray-400 cursor-not-allowed' : 'bg-blue-600 text-white hover:bg-blue-700'} font-semibold py-2 px-4 rounded-lg transition text-sm`}
              >
                📋 Copiar Link
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Fixed Bottom Action Buttons - Mobile Optimized */}
      <div className="fixed bottom-0 left-0 right-0 bg-gray-800 border-t border-gray-700 p-4 shadow-lg z-20">
        <div className="flex flex-col gap-3">
          <div className="grid grid-cols-2 gap-2">
            <button 
              disabled={closing} 
              onClick={handlePrint} 
              className={`flex items-center justify-center gap-1 ${closing ? 'bg-gray-700 text-gray-400 cursor-not-allowed' : 'bg-gray-600 text-white hover:bg-gray-700'} font-semibold py-3 px-2 rounded-lg transition text-sm`}
            >
              <Printer className="w-4 h-4" />
              <span className="hidden sm:inline">Imprimir</span>
            </button>
            
            <button 
              disabled={closing || isReadOnly} 
              onClick={handleFinalize} 
              className={`flex items-center justify-center gap-1 ${isReadOnly ? 'bg-gray-700 text-gray-400 cursor-not-allowed' : closing ? 'bg-green-600 text-white' : 'bg-green-500 text-white hover:bg-green-600'} font-semibold py-3 px-2 rounded-lg transition text-sm`}
            >
              {closing ? (
                <>
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                  Cerrando...
                </>
              ) : (
                <>
                  <Check className="w-5 h-5" />
                  Finalizar
                </>
              )}
            </button>
          </div>

          {paymentMethod === 'efectivo' && !isReadOnly && (
            <div className="text-xs text-center text-gray-400">
              💡 Verifica el cambio antes de finalizar
            </div>
          )}
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

      {/* Mercado Pago Terminal modal for transferencia payments */}
      <MercadoPagoTerminalModal
        isOpen={showMPTerminalModal}
        onClose={handleMPTerminalClose}
        onSuccess={handleMPTerminalSuccess}
        onError={handleMPTerminalError}
        amount={total}
        orderId={order?.id || ''}
        waiterName={currentUser?.displayName || order?.waiterName || 'Mesero'}
        userData={currentUser ? {
          id: currentUser.id,
          displayName: currentUser.displayName || 'Usuario',
          email: currentUser.email || '',
          role: currentUser.role || 'waiter'
        } : undefined}
      />
    </div>
  );
};

export default WaiterCheckout;
