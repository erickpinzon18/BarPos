// src/pages/kitchen/Checkout.tsx
import React, { useMemo, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { useOrderById, useOrderByTableId } from '../../hooks/useOrders';
import type { Order } from '../../utils/types';
import { closeTable, getConfig } from '../../services/firestoreService';
import { verifyUserPin } from '../../services/orderService';
import PinModal from '../../components/common/PinModal';
import { useAuth } from '../../contexts/AuthContext';
import { Tag, Clock } from 'lucide-react';
import { printTicket } from '../../utils/printTicket';
import { usePaperSize } from '../../hooks/usePaperSize';

const KitchenCheckout: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const params = useParams<{ orderId?: string }>();
  const state = (location.state || {}) as { orderId?: string; tableId?: string; tableNumber?: number };
  const { currentUser } = useAuth();
  const [paperSize] = usePaperSize(currentUser?.id);

  const paramOrderId = params.orderId;
  const propOrderId = paramOrderId ?? state.orderId;
  const propTableId = state.tableId;

  const { order: orderById, loading: loadingById, error: errorById } = useOrderById(propOrderId ?? null);
  const { order: orderByTable, loading: loadingByTable, error: errorByTable } = useOrderByTableId(propTableId ?? undefined);

  const loading = loadingById || loadingByTable;
  const error = errorById || errorByTable;

  const order: Order | null = useMemo(() => orderById ?? orderByTable ?? null, [orderById, orderByTable]);

  const [tipPercent, setTipPercent] = useState<number>(0.15);
  const [customTipPercent, setCustomTipPercent] = useState<string>('');
  const [closing, setClosing] = useState(false);
  const [showPinModal, setShowPinModal] = useState(false);
  const [pinLoading, setPinLoading] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<'efectivo' | 'tarjeta' | 'transferencia' | 'mixto'>('efectivo');
  const [cashReceived, setCashReceived] = useState<string>('');
  const [mixedEfectivo, setMixedEfectivo] = useState<string>('');
  const [mixedTarjeta, setMixedTarjeta] = useState<string>('');
  const [mixedTransferencia, setMixedTransferencia] = useState<string>('');
  const [isReadOnly, setIsReadOnly] = useState<boolean>(false);
  const [config, setConfig] = useState<any | null>(null);

  const { promotions: activePromotions } = useActivePromotions();

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

  const peopleCount = order?.peopleCount ?? 1;
  const activeItems = order?.items?.filter(i => !i.isDeleted) ?? [];
  const subtotal = useMemo(() => activeItems.reduce((s, it) => s + it.productPrice * it.quantity, 0), [activeItems]);
  const tipAmount = useMemo(() => subtotal * tipPercent, [subtotal, tipPercent]);

  const selectedPromo = useMemo(() => {
    return activePromotions.find(promo => {
      if (!isPromotionWithinSchedule(promo.cutoffTime)) return false;
      return activeItems.some(i => {
        const catOk = promo.categories.length === 0 || promo.categories.includes(i.category);
        const prodOk = !promo.productIds || promo.productIds.length === 0 || promo.productIds.includes(i.productId);
        return catOk && prodOk;
      });
    }) ?? null;
  }, [activePromotions, activeItems]);

  const discountAmount = useMemo(() => {
    if (!selectedPromo) return 0;
    const applicableItems = (() => {
      let items = selectedPromo.categories.length > 0
        ? activeItems.filter(i => selectedPromo.categories.includes(i.category))
        : activeItems;
      if (selectedPromo.productIds && selectedPromo.productIds.length > 0) {
        items = items.filter(i => selectedPromo.productIds.includes(i.productId));
      }
      // Solo aplicar a items ordenados antes de la hora de corte de la promo
      items = items.filter(i => isPromotionWithinSchedule(selectedPromo.cutoffTime, i.createdAt));
      return items;
    })();
    const applicableSubtotal = applicableItems.reduce((s, i) => s + (i.productPrice * i.quantity), 0);
    switch (selectedPromo.discountType) {
      case 'percentage':
        return applicableSubtotal * (selectedPromo.discountValue / 100);
      case 'fixed':
        return Math.min(selectedPromo.discountValue, applicableSubtotal);
      case '2x1': {
        let discount = 0;
        for (const item of applicableItems) {
          const freeItems = Math.floor(item.quantity / 2);
          discount += freeItems * item.productPrice;
        }
        return discount;
      }
      case 'fixedprice': {
        let discount = 0;
        for (const item of applicableItems) {
          const diff = item.productPrice - selectedPromo.discountValue;
          if (diff > 0) discount += diff * item.quantity;
        }
        return discount;
      }
      default:
        return 0;
    }
  }, [selectedPromo, activeItems]);

  const total = useMemo(() => subtotal - discountAmount + tipAmount, [subtotal, discountAmount, tipAmount]);

  const updateTotalWithPercent = (percent: number) => {
    setTipPercent(prev => prev === percent ? 0 : percent);
    setCustomTipPercent('');
  };

  const handleCustomTipChange = (value: string) => {
    setCustomTipPercent(value);
    const parsed = parseFloat(value);
    if (!isNaN(parsed) && parsed >= 0) {
      const bounded = Math.min(Math.max(parsed, 0), 100);
      const percent = bounded >= 1 ? bounded / 100 : bounded;
      setTipPercent(percent);
    } else if (value === '') {
      setTipPercent(0);
    }
  };

  const handlePrint = (customOrder?: Order) => {
    if (!order && !customOrder) return;
    const orderToPrint = customOrder || order;
    const perPerson = total / Math.max(1, orderToPrint!.peopleCount ?? 1);
    printTicket({
      order: orderToPrint as Order,
      subtotal,
      tipAmount,
      tipPercent,
      total,
      perPerson,
      paperSize,
      businessName: config?.name,
      businessAddress: config?.address,
      businessPhone: config?.phone,
    });
  };

  const handleFinalize = async () => {
    if (!order) return;
    if (paymentMethod === 'mixto') {
      const efe = Number(mixedEfectivo || 0);
      const tar = Number(mixedTarjeta || 0);
      const tra = Number(mixedTransferencia || 0);
      const sum = efe + tar + tra;
      if (Math.abs(sum - total) > 0.01) {
        alert(`En el pago mixto, la suma de los montos ($${sum.toFixed(2)}) debe ser igual al total ($${total.toFixed(2)}).`);
        return;
      }
    }
    setShowPinModal(true);
  };

  const finalizeWithAuthorizedUser = async (authorizedUser: any) => {
    if (!order) return;
    setClosing(true);
    try {
      const tableId = order.tableId;
      const orderId = order.id;
      let paymentDetails: any;
      if (paymentMethod === 'efectivo') {
        const received = Number(cashReceived || 0);
        const change = Math.max(0, received - total);
        paymentDetails = { receivedAmount: received, change, tipAmount, tipPercent, cashierId: authorizedUser?.id };
      } else if (paymentMethod === 'mixto') {
        const efe = Number(mixedEfectivo || 0);
        const tar = Number(mixedTarjeta || 0);
        const tra = Number(mixedTransferencia || 0);
        const splitPayments = [];
        if (efe > 0) splitPayments.push({ method: 'efectivo', amount: efe, receivedAmount: Number(cashReceived || efe), change: Math.max(0, Number(cashReceived || efe) - efe) });
        if (tar > 0) splitPayments.push({ method: 'tarjeta', amount: tar });
        if (tra > 0) splitPayments.push({ method: 'transferencia', amount: tra });
        paymentDetails = { tipAmount, tipPercent, cashierId: authorizedUser?.id, splitPayments };
      } else {
        paymentDetails = { tipAmount, tipPercent, cashierId: authorizedUser?.id };
      }
      const res = await closeTable(tableId, orderId, paymentMethod, peopleCount, paymentDetails);
      if (!res.success) throw new Error(res.error || 'Error al cerrar mesa');
      setIsReadOnly(true);

      const finalPayments = paymentMethod === 'mixto'
        ? paymentDetails.splitPayments
        : [{
            method: paymentMethod,
            amount: total,
            receivedAmount: paymentMethod === 'efectivo' ? paymentDetails.receivedAmount : undefined,
            change: paymentMethod === 'efectivo' ? paymentDetails.change : undefined
          }];

      const updatedOrder = {
        ...order,
        status: "pagado",
        paymentMethod,
        payments: finalPayments
      } as Order;

      handlePrint(updatedOrder);
    } catch (err: any) {
      console.error('Error closing table:', err);
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
      await finalizeWithAuthorizedUser(authorizedUser);
    } catch (err: any) {
      setPinLoading(false);
      throw err;
    }
  };

  React.useEffect(() => {
    if (!order) return;
    if (order.paymentMethod === 'efectivo' || order.paymentMethod === 'tarjeta' || order.paymentMethod === 'transferencia' || order.paymentMethod === 'mixto') {
      setPaymentMethod(order.paymentMethod);
    }
    if (order.status === 'pagado') setIsReadOnly(true);
  }, [order]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-400 mx-auto mb-4"></div>
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
          onClick={() => navigate('/kitchen/mesas')}
          className="mt-4 bg-orange-500 hover:bg-orange-600 text-gray-900 px-4 py-2 rounded-lg"
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
          onClick={() => navigate('/kitchen/mesas')}
          className="bg-orange-500 hover:bg-orange-600 text-gray-900 px-4 py-2 rounded-lg"
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
              <h1 className="text-3xl font-bold text-white">
                Checkout - {order.tableNumber === 0 ? '🍹 Barra' : `Mesa ${order.tableNumber}`}
              </h1>
            </div>
            <span className={`px-3 py-1 rounded-full text-sm font-semibold ${order.status === 'pagado' ? 'bg-green-600 text-white' : order.status === 'cancelado' ? 'bg-red-600 text-white' : 'bg-yellow-500 text-gray-900'}`}>
              {order.status === 'pagado' ? 'PAGADO' : order.status === 'cancelado' ? 'CANCELADO' : 'PENDIENTE'}
            </span>
          </div>
          <p className="text-gray-400">Finaliza el pago y genera el ticket.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="bg-gray-800 p-6 rounded-2xl border border-gray-800">
          <div className="ticket bg-gray-900 p-6 rounded-lg text-sm text-white">
            <div className="text-center mb-4">
              <h2 className="text-2xl font-extrabold text-orange-400">PASE DE SALIDA</h2>
              <p className="text-sm text-gray-400">{config?.name ?? 'Bar POS'} — Ticket de salida</p>
              <p className="text-xs text-gray-500 mt-2">Fecha: {new Date().toLocaleString()}</p>
              <p className="text-xs text-gray-500 mt-1">Id: {order.id}</p>
            </div>

            <div className="border-t border-dashed border-gray-600 pt-3 mb-3 flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-400">Mesa</p>
                <p className="text-lg font-semibold text-white">{order.tableNumber === 0 ? 'Barra' : `${order.tableNumber}`}</p>
              </div>
              <div>
                <p className="text-sm text-gray-400">Mesero</p>
                <p className="text-lg font-semibold text-white">{order.waiterName}</p>
              </div>
              <div className="text-right">
                <p className="text-sm text-gray-400">Personas</p>
                <p className="text-xl font-extrabold text-orange-400">{order.peopleCount ?? 1}</p>
              </div>
            </div>

            <div className="border-t border-dashed border-gray-600 pt-2">
              <div className="flex justify-between"><span>CANT. PRODUCTO</span><span>SUBTOTAL</span></div>
              {activeItems.map(item => (
                <div key={item.id} className="flex justify-between mt-2">
                  <span>{item.quantity}x {item.productName}</span>
                  <span>${(item.productPrice * item.quantity).toFixed(2)}</span>
                </div>
              ))}
            </div>

            <div className="border-t border-dashed border-gray-600 mt-4 pt-2">
              <div className="flex justify-between"><span className="font-bold">Subtotal:</span><span>${subtotal.toFixed(2)}</span></div>
              <div className="flex justify-between"><span className="font-bold">Propina ({(tipPercent * 100).toFixed(0)}%):</span><span>${tipAmount.toFixed(2)}</span></div>
              {discountAmount > 0 && (
                <div className="flex justify-between text-green-400"><span className="font-bold">Desc. {selectedPromo?.name}:</span><span>-${discountAmount.toFixed(2)}</span></div>
              )}
              <div className="flex justify-between text-xl mt-2 text-orange-400"><span className="font-bold">TOTAL:</span><span>${total.toFixed(2)}</span></div>
              <div className="flex justify-between mt-2 items-center border-t border-gray-800 pt-2">
                <span className="text-sm text-gray-300">Total por persona ({order.peopleCount ?? 1})</span>
                <span className="text-sm font-semibold text-white">${(total / Math.max(1, order.peopleCount ?? 1)).toFixed(2)}</span>
              </div>
            </div>

            <div className="border-t border-dashed border-gray-600 mt-4 pt-4 text-center">
              <p className="text-sm text-gray-400">Gracias por su preferencia.</p>
            </div>

            <div className="text-center mt-4 text-xs text-gray-400">
              <div>{config?.address ?? 'Prof. Mercedes Camacho 82, Praderas del Sol, 76808 San Juan del Río, Qro.'}</div>
              <div>Tel: {config?.phone ?? '427-123-4567'}</div>
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="bg-gray-800 p-6 rounded-2xl border border-gray-800">
            <h3 className="font-semibold text-white mb-4">Propina</h3>
            <div className="flex space-x-2 items-center">
              <button disabled={isReadOnly} onClick={() => updateTotalWithPercent(0.10)} className={`flex-1 font-bold py-3 px-2 rounded-lg transition duration-300 ${tipPercent === 0.10 ? 'bg-orange-500 text-gray-900' : isReadOnly ? 'bg-gray-800 text-gray-400 cursor-not-allowed' : 'bg-gray-700 hover:bg-gray-600'}`}>10%</button>
              <button disabled={isReadOnly} onClick={() => updateTotalWithPercent(0.15)} className={`flex-1 font-bold py-3 px-2 rounded-lg transition duration-300 ${tipPercent === 0.15 ? 'bg-orange-500 text-gray-900' : isReadOnly ? 'bg-gray-800 text-gray-400 cursor-not-allowed' : 'bg-gray-700 hover:bg-gray-600'}`}>15%</button>
              <button disabled={isReadOnly} onClick={() => updateTotalWithPercent(0.20)} className={`flex-1 font-bold py-3 px-2 rounded-lg transition duration-300 ${tipPercent === 0.20 ? 'bg-orange-500 text-gray-900' : isReadOnly ? 'bg-gray-800 text-gray-400 cursor-not-allowed' : 'bg-gray-700 hover:bg-gray-600'}`}>20%</button>
              <input disabled={isReadOnly} type="number" value={customTipPercent} onChange={e => handleCustomTipChange(e.target.value)} placeholder="Otro %" className="w-24 bg-gray-900 border border-gray-800 text-center rounded-lg focus:ring-orange-500 focus:border-orange-500 py-3" />
            </div>
            <div className="mt-2 text-sm text-gray-400">Seleccionado: {(tipPercent * 100).toFixed(0)}%</div>
          </div>

          {/* Promoción auto-aplicada */}
          {selectedPromo && (
            <div className="bg-green-900/20 border border-green-700/50 p-4 rounded-2xl flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Tag size={16} className="text-green-400 flex-shrink-0" />
                <div>
                  <p className="text-sm font-semibold text-green-300">{selectedPromo.name}</p>
                  <p className="text-xs text-green-600 flex items-center gap-1">
                    <Clock size={10} /> Hasta {selectedPromo.cutoffTime} hrs
                  </p>
                </div>
              </div>
              <span className="text-green-400 font-bold text-sm">-${discountAmount.toFixed(2)}</span>
            </div>
          )}

          <div className="bg-gray-800 p-6 rounded-2xl border border-gray-800">
            <h3 className="font-semibold text-white mb-4">Método de Pago</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <button disabled={isReadOnly} onClick={() => setPaymentMethod('efectivo')} className={`py-3 px-4 rounded-lg font-bold transition-colors flex items-center justify-center ${paymentMethod === 'efectivo' ? 'bg-green-600 text-white shadow-md ring-2 ring-green-300' : isReadOnly ? 'bg-transparent text-gray-500 border border-gray-800 cursor-not-allowed' : 'bg-transparent text-green-300 border border-green-700 hover:bg-green-700/20'}`}>Efectivo</button>
              <button disabled={isReadOnly} onClick={() => setPaymentMethod('tarjeta')} className={`py-3 px-4 rounded-lg font-bold transition-colors flex items-center justify-center ${paymentMethod === 'tarjeta' ? 'bg-blue-600 text-white shadow-md ring-2 ring-blue-300' : isReadOnly ? 'bg-transparent text-gray-500 border border-gray-800 cursor-not-allowed' : 'bg-transparent text-blue-300 border border-blue-700 hover:bg-blue-700/20'}`}>Tarjeta</button>
              <button disabled={isReadOnly} onClick={() => setPaymentMethod('transferencia')} className={`py-3 px-4 rounded-lg font-bold transition-colors flex items-center justify-center ${paymentMethod === 'transferencia' ? 'bg-purple-600 text-white shadow-md ring-2 ring-purple-300' : isReadOnly ? 'bg-transparent text-gray-500 border border-gray-800 cursor-not-allowed' : 'bg-transparent text-purple-300 border border-purple-700 hover:bg-purple-700/20'}`}>Transferencia</button>
              <button disabled={isReadOnly} onClick={() => setPaymentMethod('mixto')} className={`py-3 px-4 rounded-lg font-bold transition-colors flex items-center justify-center ${paymentMethod === 'mixto' ? 'bg-yellow-600 text-white shadow-md ring-2 ring-yellow-300' : isReadOnly ? 'bg-transparent text-gray-500 border border-gray-800 cursor-not-allowed' : 'bg-transparent text-yellow-300 border border-yellow-700 hover:bg-yellow-700/20'}`}>Mixto</button>
            </div>
            {paymentMethod === 'efectivo' && (
              <div className="mt-4">
                <label className="text-sm text-gray-400 block mb-2">Monto recibido</label>
                <div className="flex items-center space-x-2">
                  <input disabled={isReadOnly} type="number" min="0" step="0.01" value={cashReceived} onChange={e => setCashReceived(e.target.value)} placeholder="0.00" className="w-full bg-gray-900 border border-gray-800 text-right rounded-lg focus:ring-orange-500 focus:border-orange-500 py-3 px-3 text-white" />
                  <button type="button" disabled={isReadOnly} onClick={() => setCashReceived(total.toFixed(2))} className="ml-2 bg-orange-500 text-gray-900 font-bold py-2 px-3 rounded-lg">Exacto</button>
                </div>
                <div className="mt-2 text-sm text-gray-300">
                  <div>Pago: ${Number(cashReceived || 0).toFixed(2)}</div>
                  <div className="mt-1 font-semibold">Cambio: ${Math.max(0, Number(cashReceived || 0) - total).toFixed(2)}</div>
                </div>
              </div>
            )}
            {paymentMethod === 'transferencia' && (
              <div className="mt-4">
                <h4 className="text-sm text-white font-semibold mb-2">Datos para Transferencia</h4>
                <div className="space-y-2 text-sm text-gray-300">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-xs text-gray-400">Banco</div>
                      <div className="font-semibold">Mercado Pago W</div>
                    </div>
                    <button type="button" onClick={() => navigator.clipboard?.writeText('Mercado Pago W')} className="ml-4 bg-gray-700 hover:bg-gray-600 text-gray-200 px-3 py-2 rounded-lg">Copiar</button>
                  </div>
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-xs text-gray-400">Cuenta / CLABE</div>
                      <div className="font-mono">5428 7801 3323 8824</div>
                    </div>
                    <button type="button" onClick={() => navigator.clipboard?.writeText('5428780133238824')} className="ml-4 bg-gray-700 hover:bg-gray-600 text-gray-200 px-3 py-2 rounded-lg">Copiar</button>
                  </div>
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-xs text-gray-400">Titular</div>
                      <div className="font-semibold">Oswaldo Reyes Olivera</div>
                    </div>
                    <button type="button" onClick={() => navigator.clipboard?.writeText('Oswaldo Reyes Olivera')} className="ml-4 bg-gray-700 hover:bg-gray-600 text-gray-200 px-3 py-2 rounded-lg">Copiar</button>
                  </div>
                </div>
              </div>
            )}

            {paymentMethod === 'mixto' && (
              <div className="mt-4 p-4 bg-gray-900 rounded-lg border border-gray-700">
                <h4 className="text-sm font-semibold text-white mb-3">Montos por Método</h4>
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <label className="text-sm text-gray-400 w-24">Efectivo:</label>
                    <input disabled={isReadOnly} type="number" min="0" step="0.01" value={mixedEfectivo} onChange={(e) => setMixedEfectivo(e.target.value)} placeholder="0.00" className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white disabled:bg-gray-800" />
                  </div>
                  {Number(mixedEfectivo) > 0 && (
                    <div className="flex items-center gap-2 pl-26">
                      <label className="text-xs text-gray-500 w-24">Recibido:</label>
                      <input disabled={isReadOnly} type="number" min="0" step="0.01" value={cashReceived} onChange={(e) => setCashReceived(e.target.value)} placeholder="Monto entregado" className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-1 text-white disabled:bg-gray-800 text-sm" />
                    </div>
                  )}
                  <div className="flex items-center gap-2">
                    <label className="text-sm text-gray-400 w-24">Tarjeta:</label>
                    <input disabled={isReadOnly} type="number" min="0" step="0.01" value={mixedTarjeta} onChange={(e) => setMixedTarjeta(e.target.value)} placeholder="0.00" className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white disabled:bg-gray-800" />
                  </div>
                  <div className="flex items-center gap-2">
                    <label className="text-sm text-gray-400 w-24">Transf.:</label>
                    <input disabled={isReadOnly} type="number" min="0" step="0.01" value={mixedTransferencia} onChange={(e) => setMixedTransferencia(e.target.value)} placeholder="0.00" className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white disabled:bg-gray-800" />
                  </div>
                </div>
                
                <div className="mt-4 pt-3 border-t border-gray-700">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-400">Total a cubrir:</span>
                    <span className="text-white font-medium">${total.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-sm mt-1">
                    <span className="text-gray-400">Suma actual:</span>
                    <span className={`font-bold ${Math.abs((Number(mixedEfectivo||0)+Number(mixedTarjeta||0)+Number(mixedTransferencia||0)) - total) < 0.01 ? 'text-green-400' : 'text-red-400'}`}>
                      ${(Number(mixedEfectivo||0)+Number(mixedTarjeta||0)+Number(mixedTransferencia||0)).toFixed(2)}
                    </span>
                  </div>
                  {Number(mixedEfectivo) > 0 && Number(cashReceived) > Number(mixedEfectivo) && (
                    <div className="flex justify-between text-sm mt-1 text-green-400">
                      <span>Cambio (Efectivo):</span>
                      <span className="font-bold">${(Number(cashReceived) - Number(mixedEfectivo)).toFixed(2)}</span>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          <div className="flex flex-col space-y-3">
            <button disabled={closing || isReadOnly} onClick={handleFinalize} className={`w-full ${isReadOnly ? 'bg-gray-800 text-gray-400 cursor-not-allowed' : 'bg-orange-500 text-gray-900 hover:bg-orange-600'} font-bold py-3 px-4 rounded-lg transition`}>
              {closing ? 'Cerrando...' : 'Finalizar y Cerrar Mesa'}
            </button>
          </div>
        </div>
      </div>

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

export default KitchenCheckout;
