import React, { useState, useEffect } from 'react';
import { getConfig, type PaymentDocument } from '../../services/firestoreService';
import { collection, getDocs, doc, getDoc } from 'firebase/firestore';
import { db } from '../../services/firebase';
import type { Order } from '../../utils/types';

const TerminalPayments: React.FC = () => {
  const [payments, setPayments] = useState<(PaymentDocument & { id: string })[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedPayment, setSelectedPayment] = useState<(PaymentDocument & { id: string }) | null>(null);
  const [config, setConfig] = useState<any | null>(null);
  const [orderData, setOrderData] = useState<Order | null>(null);
  const [loadingOrder, setLoadingOrder] = useState(false);

  // Load business config for display
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const cfg = await getConfig();
        if (mounted) setConfig(cfg?.success ? cfg.data : null);
      } catch (err) {
        console.debug('Could not load config/general for TerminalPayments:', err);
      }
    })();
    return () => { mounted = false; };
  }, []);

  // Load all payments from Firestore
  useEffect(() => {
    let mounted = true;
    const loadPayments = async () => {
      setLoading(true);
      try {
        const paymentsRef = collection(db, 'payments');
        const querySnapshot = await getDocs(paymentsRef);
        
        const allPayments = querySnapshot.docs
          .map(doc => ({ id: doc.id, ...doc.data() } as PaymentDocument & { id: string }))
          .sort((a, b) => {
            const dateA = a.created_date || '';
            const dateB = b.created_date || '';
            return dateB.localeCompare(dateA); // newest first
          });
        
        if (mounted) {
          setPayments(allPayments);
        }
      } catch (err) {
        console.error('Error loading payments:', err);
      } finally {
        if (mounted) setLoading(false);
      }
    };
    
    void loadPayments();
    return () => { mounted = false; };
  }, []);

  const openModal = (payment: PaymentDocument & { id: string }) => setSelectedPayment(payment);
  const closeModal = () => setSelectedPayment(null);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'processed':
      case 'paid':
        return 'text-green-400';
      case 'failed':
      case 'canceled':
        return 'text-red-400';
      case 'pending':
        return 'text-yellow-400';
      default:
        return 'text-gray-400';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'processed':
        return 'Procesado';
      case 'paid':
        return 'Pagado';
      case 'failed':
        return 'Fallido';
      case 'canceled':
        return 'Cancelado';
      case 'pending':
        return 'Pendiente';
      default:
        return status;
    }
  };

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

  // Helper function to extract waiter name from external_reference
  const getWaiterNameFromReference = (external_reference?: string): string | null => {
    if (!external_reference) return null;
    // Format: {orderId}-{waiterName}-{total}-{DD}-{MM}-{YY}
    const parts = external_reference.split('-');
    if (parts.length >= 2) {
      return parts[1]; // waiterName is the second part
    }
    return null;
  };

  // Helper function to extract order ID from external_reference
  const getOrderIdFromReference = (external_reference?: string): string | null => {
    if (!external_reference) return null;
    // Format: {orderId}-{waiterName}-{total}-{DD}-{MM}-{YY}
    const parts = external_reference.split('-');
    if (parts.length >= 1) {
      return parts[0]; // orderId is the first part
    }
    return null;
  };

  // Load order data when opening ticket modal
  const loadOrderData = async (external_reference?: string) => {
    const orderId = getOrderIdFromReference(external_reference);
    if (!orderId || orderId === 'setting') {
      setOrderData(null);
      return;
    }

    setLoadingOrder(true);
    try {
      const orderRef = doc(db, 'orders', orderId);
      const orderSnap = await getDoc(orderRef);
      
      if (orderSnap.exists()) {
        setOrderData({ id: orderSnap.id, ...orderSnap.data() } as Order);
      } else {
        setOrderData(null);
      }
    } catch (err) {
      console.error('Error loading order:', err);
      setOrderData(null);
    } finally {
      setLoadingOrder(false);
    }
  };

  return (
    <div className="p-4 md:p-6">
      <h1 className="text-3xl font-bold mb-2">💳 Pagos Terminal Mercado Pago</h1>
      <p className="text-gray-400 mb-6">Historial completo de pagos procesados con terminal.</p>

      <div className="mb-4">
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Buscar por ID de pago, mesa, mesero, monto, referencia..."
          className="w-full md:w-1/2 bg-gray-800 text-white rounded-lg p-3 border border-gray-700"
        />
      </div>

      {loading ? (
        <div className="text-center py-8">Cargando pagos...</div>
      ) : (
        (() => {
          const groups: Record<string, (PaymentDocument & { id: string })[]> = {};
          const q = (searchQuery || '').trim().toLowerCase();

          const filtered = payments.filter(p => {
            if (!q) return true;
            // match payment id
            if (p.id && p.id.toLowerCase().includes(q)) return true;
            // match order id
            if (p.id && p.id.slice(0, 6).toLowerCase().includes(q)) return true;
            // match external reference
            if (p.external_reference && p.external_reference.toLowerCase().includes(q)) return true;
            // match amount
            const amount = p.transactions?.payments?.[0]?.amount || '';
            if (amount.includes(q)) return true;
            // match user name
            if (p.userData?.displayName && p.userData.displayName.toLowerCase().includes(q)) return true;
            // match waiter name from external reference
            const waiterName = getWaiterNameFromReference(p.external_reference);
            if (waiterName && waiterName.toLowerCase().includes(q)) return true;
            return false;
          });

          filtered.forEach(p => {
            const d = p.created_date ? new Date(p.created_date) : new Date();
            const key = makeLocalDateKey(d);
            if (!groups[key]) groups[key] = [];
            groups[key].push(p);
          });

          const dateKeys = Object.keys(groups).sort((a, b) => b.localeCompare(a));
          const todayKey = makeLocalDateKey(new Date());

          return (
            <div className="space-y-8">
              {dateKeys.map(dateKey => {
                const date = parseLocalDateKey(dateKey);
                const isToday = dateKey === todayKey;
                const headerLabel = isToday
                  ? `Hoy, ${date.toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' })}`
                  : date.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

                return (
                  <div key={dateKey}>
                    <h2 className="text-xl font-bold text-amber-400 border-b-2 border-amber-400/30 pb-2 mb-4">{headerLabel}</h2>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                      {groups[dateKey].map(payment => {
                        const amount = payment.transactions?.payments?.[0]?.amount || '0.00';
                        const referenceId = payment.transactions?.payments?.[0]?.reference_id || 'N/A';
                        const createdDate = payment.created_date ? new Date(payment.created_date) : new Date();
                        const isTestPayment = payment.external_reference?.toLowerCase().includes('setting');
                        const waiterName = getWaiterNameFromReference(payment.external_reference);
                        
                        return (
                          <div 
                            key={payment.id} 
                            className={`bg-gray-800 rounded-2xl border ${isTestPayment ? 'border-blue-700/50' : 'border-gray-700'} p-5 flex flex-col justify-between hover:border-amber-500/50 transition-colors cursor-pointer`}
                            onClick={() => openModal(payment)}
                          >
                            <div>
                              <div className="flex justify-between items-start mb-3">
                                <div>
                                  <h3 className="text-lg font-bold text-white">#{payment.id.slice(0, 8).toUpperCase()}</h3>
                                  {isTestPayment && (
                                    <span className="inline-block mt-1 text-xs bg-blue-900/50 text-blue-300 px-2 py-0.5 rounded">
                                      🧪 Prueba
                                    </span>
                                  )}
                                </div>
                                <div className="text-sm text-gray-400 text-right">
                                  <div>{createdDate.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}</div>
                                  <div className="text-xs">{createdDate.toLocaleDateString('es-ES')}</div>
                                </div>
                              </div>
                              
                              <div className="space-y-2 text-sm">
                                <p className={`font-semibold ${getStatusColor(payment.status)}`}>
                                  {payment.status === 'processed' || payment.status === 'paid' ? '✅' : '❌'} {getStatusText(payment.status)}
                                </p>
                                
                                {waiterName && (
                                  <p className="text-gray-300">
                                    <span className="font-semibold">Mesero:</span> {waiterName}
                                  </p>
                                )}
                                
                                {payment.userData?.displayName && (
                                  <p className="text-gray-300">
                                    <span className="font-semibold">Usuario:</span> {payment.userData.displayName}
                                  </p>
                                )}
                                
                                <p className="text-gray-400 text-xs">
                                  <span className="font-semibold">Ref:</span> {referenceId}
                                </p>
                              </div>
                            </div>
                            
                            <div className="mt-4 pt-4 border-t border-gray-700">
                              <p className="text-2xl font-bold text-amber-400">${parseFloat(amount).toFixed(2)}</p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          );
        })()
      )}

      {/* Modal de Detalles */}
      {selectedPayment && (() => {
        const waiterName = getWaiterNameFromReference(selectedPayment.external_reference);
        
        return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="bg-gray-800 rounded-2xl shadow-xl w-full max-w-2xl m-4 border border-gray-700 relative max-h-[90vh] overflow-y-auto">
            <button onClick={closeModal} className="absolute top-4 right-4 text-gray-400 hover:text-white text-3xl z-10">&times;</button>
            
            <div className="p-8">
              <div className="text-center mb-6 border-b border-gray-600 pb-6">
                <h2 className="text-2xl font-bold text-amber-400 tracking-widest">DETALLES DE PAGO</h2>
                <p className="text-lg font-semibold text-white mt-1">{config?.name ?? 'ChepeChupes'} — Pago Terminal</p>
                {selectedPayment.created_date && (
                  <p className="text-sm text-gray-400">
                    Fecha: {new Date(selectedPayment.created_date).toLocaleDateString('es-ES', { 
                      day: 'numeric', 
                      month: 'long', 
                      year: 'numeric' 
                    })}, {new Date(selectedPayment.created_date).toLocaleTimeString('es-ES', { 
                      hour: '2-digit', 
                      minute: '2-digit' 
                    })}
                  </p>
                )}
                <p className="text-xs text-gray-400 mt-1">ID de Orden: {selectedPayment.id}</p>
              </div>

              {/* Estado del Pago */}
              <div className="mb-6 p-4 bg-gray-900 rounded-lg">
                <div className="flex items-center justify-between">
                  <span className="text-gray-400">Estado:</span>
                  <span className={`text-lg font-bold ${getStatusColor(selectedPayment.status)}`}>
                    {selectedPayment.status === 'processed' || selectedPayment.status === 'paid' ? '✅' : '❌'} {getStatusText(selectedPayment.status)}
                  </span>
                </div>
              </div>

              {/* Información del Pago */}
              <div className="grid grid-cols-2 gap-4 mb-6">
                <div className="p-4 bg-gray-900 rounded-lg">
                  <p className="text-sm text-gray-400 mb-1">Monto Total</p>
                  <p className="text-2xl font-bold text-amber-400">
                    ${parseFloat(selectedPayment.transactions?.payments?.[0]?.amount || '0').toFixed(2)}
                  </p>
                </div>
                
                <div className="p-4 bg-gray-900 rounded-lg">
                  <p className="text-sm text-gray-400 mb-1">Reference ID</p>
                  <p className="text-sm font-mono text-white break-all">
                    {selectedPayment.transactions?.payments?.[0]?.reference_id || 'N/A'}
                  </p>
                </div>
              </div>

              {/* Información del Usuario */}
              <div className="mb-6 p-4 bg-gray-900 rounded-lg">
                <h3 className="text-lg font-semibold text-white mb-3">👤 Información del Usuario</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                  {waiterName && (
                    <div>
                      <span className="text-gray-400">Mesero:</span>
                      <span className="text-white ml-2 font-semibold">{waiterName}</span>
                    </div>
                  )}
                  {selectedPayment.userData?.displayName && (
                    <div>
                      <span className="text-gray-400">Usuario del Sistema:</span>
                      <span className="text-white ml-2 font-semibold">{selectedPayment.userData.displayName}</span>
                    </div>
                  )}
                  {selectedPayment.userData?.email && (
                    <div>
                      <span className="text-gray-400">Email:</span>
                      <span className="text-white ml-2">{selectedPayment.userData.email}</span>
                    </div>
                  )}
                  {selectedPayment.userData?.role && (
                    <div>
                      <span className="text-gray-400">Rol:</span>
                      <span className="text-white ml-2 capitalize">{selectedPayment.userData.role}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Referencia Externa */}
              {selectedPayment.external_reference && (
                <div className="mb-6 p-4 bg-gray-900 rounded-lg">
                  <h3 className="text-lg font-semibold text-white mb-2">🔗 Referencia Externa</h3>
                  <p className="text-sm text-gray-300 font-mono break-all">{selectedPayment.external_reference}</p>
                  {selectedPayment.external_reference.toLowerCase().includes('setting') && (
                    <p className="text-xs text-blue-300 mt-2">🧪 Este es un pago de prueba realizado desde Configuración</p>
                  )}
                </div>
              )}

              {/* Detalles del Pago */}
              <div className="mb-6 p-4 bg-gray-900 rounded-lg">
                <h3 className="text-lg font-semibold text-white mb-3">💳 Detalles del Pago</h3>
                <div className="space-y-2 text-sm">
                  {/* Método de Pago */}
                  {selectedPayment.transactions?.payments?.[0]?.payment_method && (
                    <div className="flex justify-between">
                      <span className="text-gray-400">Método de Pago:</span>
                      <span className="text-white">
                        {(() => {
                          const pm = selectedPayment.transactions.payments[0].payment_method;
                          if (typeof pm === 'object' && pm.type) {
                            const typeMap: Record<string, string> = {
                              'credit_card': 'Tarjeta de Crédito',
                              'debit_card': 'Tarjeta de Débito',
                              'prepaid_card': 'Tarjeta Prepagada'
                            };
                            return typeMap[pm.type] || pm.type;
                          }
                          return String(pm);
                        })()}
                      </span>
                    </div>
                  )}
                  
                  {/* Marca de Tarjeta */}
                  {selectedPayment.transactions?.payments?.[0]?.payment_method?.id && (
                    <div className="flex justify-between">
                      <span className="text-gray-400">Marca de Tarjeta:</span>
                      <span className="text-white uppercase font-semibold">
                        {(() => {
                          const brandMap: Record<string, string> = {
                            'master': 'MASTERCARD',
                            'visa': 'VISA',
                            'amex': 'AMERICAN EXPRESS',
                            'maestro': 'MAESTRO'
                          };
                          const brand = selectedPayment.transactions.payments[0].payment_method.id;
                          return brandMap[brand] || brand;
                        })()}
                      </span>
                    </div>
                  )}
                  
                  {/* Número de Tarjeta */}
                  {selectedPayment.transactions?.payments?.[0]?.card && (
                    <div className="flex justify-between">
                      <span className="text-gray-400">Tarjeta:</span>
                      <span className="text-white font-mono">
                        {selectedPayment.transactions.payments[0].card.first_digits || '****'} **** **** {selectedPayment.transactions.payments[0].card.last_digits || '****'}
                      </span>
                    </div>
                  )}
                  
                  {/* Cuotas */}
                  {selectedPayment.transactions?.payments?.[0]?.payment_method?.installments && (
                    <div className="flex justify-between">
                      <span className="text-gray-400">Cuotas:</span>
                      <span className="text-white">
                        {selectedPayment.transactions.payments[0].payment_method.installments === 1 
                          ? 'Pago único' 
                          : `${selectedPayment.transactions.payments[0].payment_method.installments} cuotas`}
                      </span>
                    </div>
                  )}
                  
                  {/* Monto Pagado */}
                  {selectedPayment.transactions?.payments?.[0]?.paid_amount && (
                    <div className="flex justify-between">
                      <span className="text-gray-400">Monto Pagado:</span>
                      <span className="text-green-400 font-semibold">${parseFloat(selectedPayment.transactions.payments[0].paid_amount).toFixed(2)}</span>
                    </div>
                  )}
                  
                  {/* Estado del Pago */}
                  {selectedPayment.transactions?.payments?.[0]?.status_detail && (
                    <div className="flex justify-between">
                      <span className="text-gray-400">Detalle de Estado:</span>
                      <span className="text-white capitalize">{selectedPayment.transactions.payments[0].status_detail}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Detalles Técnicos */}
              <div className="mb-6 p-4 bg-gray-900 rounded-lg">
                <h3 className="text-lg font-semibold text-white mb-3">⚙️ Información Técnica</h3>
                <div className="space-y-2 text-sm">
                  {/* ID de Pago */}
                  {selectedPayment.transactions?.payments?.[0]?.id && (
                    <div className="flex justify-between">
                      <span className="text-gray-400">Payment ID:</span>
                      <span className="text-white font-mono text-xs break-all">{selectedPayment.transactions.payments[0].id}</span>
                    </div>
                  )}
                  
                  {/* Terminal ID */}
                  {selectedPayment.config?.point?.terminal_id && (
                    <div className="flex justify-between">
                      <span className="text-gray-400">Terminal ID:</span>
                      <span className="text-white font-mono text-xs break-all">{selectedPayment.config.point.terminal_id}</span>
                    </div>
                  )}
                  
                  {/* Tipo de Procesamiento */}
                  {selectedPayment.processing_mode && (
                    <div className="flex justify-between">
                      <span className="text-gray-400">Modo de Procesamiento:</span>
                      <span className="text-white capitalize">{selectedPayment.processing_mode}</span>
                    </div>
                  )}
                  
                  {/* Tipo de Transacción */}
                  {selectedPayment.type && (
                    <div className="flex justify-between">
                      <span className="text-gray-400">Tipo de Transacción:</span>
                      <span className="text-white uppercase">{selectedPayment.type}</span>
                    </div>
                  )}
                  
                  {/* Application ID */}
                  {selectedPayment.integration_data?.application_id && (
                    <div className="flex justify-between">
                      <span className="text-gray-400">Application ID:</span>
                      <span className="text-white font-mono text-xs">{selectedPayment.integration_data.application_id}</span>
                    </div>
                  )}
                  
                  {/* Total Paid Amount */}
                  {(selectedPayment as any).total_paid_amount && (
                    <div className="flex justify-between">
                      <span className="text-gray-400">Total Cobrado:</span>
                      <span className="text-white font-semibold">${parseFloat((selectedPayment as any).total_paid_amount).toFixed(2)} {selectedPayment.currency || 'MXN'}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Información Adicional */}
              <div className="text-center pt-6 border-t border-gray-600">
                <p className="text-gray-400">Procesado por Mercado Pago Point</p>
                <p className="text-xs text-gray-500 mt-2">{config?.address ?? 'Prof. Mercedes Camacho 82, Praderas del Sol, 76808 San Juan del Río, Qro.'}<br/>Tel: {config?.phone ?? '427-123-4567'}</p>
              </div>
            </div>

            <div className="p-6 bg-gray-900/50 rounded-b-2xl flex gap-4">
              <button 
                onClick={async () => {
                  // Cargar datos de la orden antes de abrir el modal
                  await loadOrderData(selectedPayment.external_reference);
                  // Abrir modal de ticket
                  const ticketModal = document.getElementById('ticket-modal');
                  if (ticketModal) ticketModal.style.display = 'flex';
                }}
                className="w-full bg-amber-600 hover:bg-amber-700 text-white font-bold py-3 px-5 rounded-lg"
              >
                📄 Ver Ticket
              </button>
              <button onClick={closeModal} className="w-full bg-gray-700 hover:bg-gray-600 text-white font-bold py-3 px-5 rounded-lg">Cerrar</button>
            </div>
          </div>
        </div>
        );
      })()}

      {/* Modal de Ticket (Formato de impresión) */}
      {selectedPayment && (() => {
        const waiterName = getWaiterNameFromReference(selectedPayment.external_reference);
        const amount = selectedPayment.transactions?.payments?.[0]?.amount || '0.00';
        
        return (
          <div 
            id="ticket-modal"
            className="hidden fixed inset-0 z-[60] items-center justify-center bg-black/70 p-4"
            onClick={(e) => {
              if (e.target === e.currentTarget) {
                (e.currentTarget as HTMLDivElement).style.display = 'none';
              }
            }}
          >
            <div className="bg-gray-800 rounded-2xl shadow-xl w-full max-w-md m-4 border border-gray-700 relative">
              <button 
                onClick={() => {
                  const modal = document.getElementById('ticket-modal');
                  if (modal) modal.style.display = 'none';
                }}
                className="absolute top-4 right-4 text-gray-400 hover:text-white text-3xl z-10"
              >
                &times;
              </button>
              
              <div className="p-8">
                <div className="text-center mb-6 border-b border-gray-600 pb-6">
                  <h2 className="text-2xl font-bold text-amber-400 tracking-widest">COMPROBANTE DE PAGO</h2>
                  <p className="text-lg font-semibold text-white mt-1">{config?.name ?? 'ChepeChupes'} — Terminal Mercado Pago</p>
                  {selectedPayment.created_date && (
                    <p className="text-sm text-gray-400">
                      Fecha: {new Date(selectedPayment.created_date).toLocaleDateString('es-ES', { 
                        day: 'numeric', 
                        month: 'long', 
                        year: 'numeric' 
                      })}, {new Date(selectedPayment.created_date).toLocaleTimeString('es-ES', { 
                        hour: '2-digit', 
                        minute: '2-digit' 
                      })}
                    </p>
                  )}
                  <p className="text-xs text-gray-400 mt-1">ID de Orden: {selectedPayment.id}</p>
                  <p className="text-xs text-gray-400">Ref: {selectedPayment.transactions?.payments?.[0]?.reference_id || 'N/A'}</p>
                </div>

                {/* Información del Usuario/Mesero */}
                <div className="grid grid-cols-3 gap-4 mb-6 text-center">
                  {orderData && orderData.tableNumber !== undefined && (
                    <div>
                      <p className="text-sm text-gray-400">{orderData.tableNumber === 0 ? 'Barra' : 'Mesa'}</p>
                      <p className="font-bold text-white text-lg">{orderData.tableNumber === 0 ? 'Principal' : orderData.tableNumber}</p>
                    </div>
                  )}
                  {waiterName && (
                    <div>
                      <p className="text-sm text-gray-400">Mesero</p>
                      <p className="font-bold text-white text-lg">{waiterName}</p>
                    </div>
                  )}
                  <div>
                    <p className="text-sm text-gray-400">Usuario</p>
                    <p className="font-bold text-white text-lg">{selectedPayment.userData?.displayName || '-'}</p>
                  </div>
                </div>

                {/* Productos Consumidos */}
                {loadingOrder && (
                  <div className="border-t border-b border-dashed border-gray-600 py-4">
                    <p className="text-center text-gray-400">Cargando productos...</p>
                  </div>
                )}
                
                {!loadingOrder && orderData && orderData.items && orderData.items.length > 0 && (
                  <div className="border-t border-b border-dashed border-gray-600 py-4 space-y-3 mb-4">
                    <div className="flex justify-between text-sm">
                      <span className="font-semibold text-white">CANT. PRODUCTO</span>
                      <span className="font-semibold text-white">SUBTOTAL</span>
                    </div>
                    {orderData.items.filter(i => !i.isDeleted).map((item) => (
                      <div key={item.id} className="flex justify-between">
                        <span className="text-gray-300">{item.quantity}x {item.productName}</span>
                        <span className="text-gray-300">${((item.productPrice ?? 0) * (item.quantity ?? 1)).toFixed(2)}</span>
                      </div>
                    ))}
                  </div>
                )}

                {!loadingOrder && !orderData && getOrderIdFromReference(selectedPayment.external_reference) && getOrderIdFromReference(selectedPayment.external_reference) !== 'setting' && (
                  <div className="border-t border-b border-dashed border-gray-600 py-4 mb-4">
                    <p className="text-center text-gray-400 text-sm">⚠️ No se encontraron productos para esta orden</p>
                  </div>
                )}

                {/* Información de la Tarjeta */}
                {selectedPayment.transactions?.payments?.[0] && (
                  <div className="border-t border-b border-dashed border-gray-600 py-4 space-y-3">
                    <div className="flex justify-between text-sm">
                      <span className="font-semibold text-white">MÉTODO DE PAGO</span>
                      <span className="font-semibold text-white">DETALLES</span>
                    </div>
                    
                    <div className="flex justify-between">
                      <span className="text-gray-300">Tipo:</span>
                      <span className="text-gray-300">
                        {(() => {
                          const pm = selectedPayment.transactions.payments[0].payment_method;
                          if (typeof pm === 'object' && pm.type) {
                            const typeMap: Record<string, string> = {
                              'credit_card': 'Crédito',
                              'debit_card': 'Débito',
                              'prepaid_card': 'Prepagada'
                            };
                            return typeMap[pm.type] || pm.type;
                          }
                          return '-';
                        })()}
                      </span>
                    </div>
                    
                    {selectedPayment.transactions.payments[0].payment_method?.id && (
                      <div className="flex justify-between">
                        <span className="text-gray-300">Marca:</span>
                        <span className="text-gray-300 uppercase font-semibold">
                          {(() => {
                            const brandMap: Record<string, string> = {
                              'master': 'MASTERCARD',
                              'visa': 'VISA',
                              'amex': 'AMEX',
                              'maestro': 'MAESTRO'
                            };
                            return brandMap[selectedPayment.transactions.payments[0].payment_method.id] || selectedPayment.transactions.payments[0].payment_method.id;
                          })()}
                        </span>
                      </div>
                    )}
                    
                    {selectedPayment.transactions.payments[0].card && (
                      <div className="flex justify-between">
                        <span className="text-gray-300">Tarjeta:</span>
                        <span className="text-gray-300 font-mono text-sm">
                          {selectedPayment.transactions.payments[0].card.first_digits || '****'} **** {selectedPayment.transactions.payments[0].card.last_digits || '****'}
                        </span>
                      </div>
                    )}
                    
                    {selectedPayment.transactions.payments[0].payment_method?.installments && (
                      <div className="flex justify-between">
                        <span className="text-gray-300">Cuotas:</span>
                        <span className="text-gray-300">
                          {selectedPayment.transactions.payments[0].payment_method.installments === 1 
                            ? 'Pago único' 
                            : `${selectedPayment.transactions.payments[0].payment_method.installments} cuotas`}
                        </span>
                      </div>
                    )}
                  </div>
                )}

                {/* Total */}
                <div className="py-6 space-y-2">
                  {orderData && orderData.subtotal !== undefined && (
                    <div className="flex justify-between items-center text-md">
                      <span className="text-gray-300">Subtotal:</span>
                      <span className="font-semibold text-white">${(orderData.subtotal ?? 0).toFixed(2)}</span>
                    </div>
                  )}
                  
                  {orderData && orderData.total !== undefined && orderData.subtotal !== undefined && (
                    <div className="flex justify-between items-center text-md">
                      <span className="text-gray-300">Propina{(() => {
                        const tipPercent = orderData.payments?.[0]?.tipPercent ?? 0;
                        return tipPercent > 0 ? ` (${(tipPercent * 100).toFixed(0)}%)` : '';
                      })()}:</span>
                      <span className="font-semibold text-white">${((orderData.total ?? 0) - (orderData.subtotal ?? 0)).toFixed(2)}</span>
                    </div>
                  )}
                  
                  {!orderData && (
                    <div className="flex justify-between items-center text-md">
                      <span className="text-gray-300">Monto:</span>
                      <span className="font-semibold text-white">${parseFloat(amount).toFixed(2)}</span>
                    </div>
                  )}
                  
                  {selectedPayment.transactions?.payments?.[0]?.status_detail && (
                    <div className="flex justify-between items-center text-md">
                      <span className="text-gray-300">Estado:</span>
                      <span className={`font-semibold ${getStatusColor(selectedPayment.status)}`}>
                        {getStatusText(selectedPayment.status)}
                      </span>
                    </div>
                  )}
                  
                  <div className="flex justify-between items-center text-2xl mt-4 pt-4 border-t border-gray-600">
                    <span className="font-bold text-amber-400">TOTAL:</span>
                    <span className="font-bold text-amber-400">${parseFloat(amount).toFixed(2)}</span>
                  </div>
                </div>

                {/* Información del Negocio */}
                <div className="text-center pt-6 border-t border-gray-600">
                  <p className="text-gray-400">Procesado por Mercado Pago Point</p>
                  <p className="text-xs text-gray-400 mt-2">Terminal: {selectedPayment.config?.point?.terminal_id?.split('__')[0] || 'N/A'}</p>
                  <p className="text-xs text-gray-500 mt-2">{config?.address ?? 'Prof. Mercedes Camacho 82, Praderas del Sol, 76808 San Juan del Río, Qro.'}<br/>Tel: {config?.phone ?? '427-123-4567'}</p>
                  <p className="text-xs text-gray-500 mt-3">¡Gracias por su preferencia!</p>
                </div>
              </div>

              <div className="p-6 bg-gray-900/50 rounded-b-2xl flex gap-4">
                <button 
                  onClick={() => {
                    const modal = document.getElementById('ticket-modal');
                    if (modal) modal.style.display = 'none';
                  }}
                  className="w-full bg-gray-700 hover:bg-gray-600 text-white font-bold py-3 px-5 rounded-lg"
                >
                  Cerrar
                </button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
};

export default TerminalPayments;

